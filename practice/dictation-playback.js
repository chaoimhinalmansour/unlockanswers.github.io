"use strict";

(function () {
  const dock = document.getElementById("dictation-dock");
  const player = dock.querySelector("audio");
  const button = dock.querySelector("[data-dictation-start]");
  const status = dock.querySelector("[data-dictation-status]");
  const progress = dock.querySelector("progress");
  const countdown = document.getElementById("dictation-countdown");
  const numeral = countdown.querySelector("[data-countdown-number]");
  const countdownSeconds = 5;
  // The first 209 frames of each countdown MP3 are silent so playback can start in the click handler.
  const audioLeadIn = 5.016;
  const namespace = "unlock.practice.dictation.v1:";
  const replayNamespace = "unlock.practice.dictation-replay.v1:";
  let session = null;
  let current = null;
  let loadedKey;

  function stored(entry) {
    if (entry.storageFailed) return { state: "unavailable" };
    try {
      const value = localStorage.getItem(entry.key) || "ready";
      const match = /^resume:(\d+(?:\.\d+)?)$/.exec(value);
      const time = match ? Number(match[1]) : 0;
      return match && Number.isFinite(time) ? { state: "resume", time } : { state: value, time: 0 };
    } catch {
      return { state: "unavailable" };
    }
  }

  function canStart(state) {
    return state === "ready" || state === "resume";
  }

  function save(entry, value) {
    try {
      localStorage.setItem(entry.key, value);
      return true;
    } catch {
      entry.storageFailed = true;
      return false;
    }
  }

  function position(entry) {
    return loadedKey === entry.key ? Math.max(entry.offset, player.currentTime - entry.leadIn) : entry.offset;
  }

  function checkpoint(entry, force) {
    const time = position(entry);
    if (force || Math.floor(time) > Math.floor(entry.offset)) {
      if (save(entry, "resume:" + Math.floor(time * 1000) / 1000)) entry.offset = time;
    }
  }

  function updateProgress() {
    const leadIn = current?.leadIn ?? 0;
    const duration = player.duration - leadIn;
    const time = current ? position(current) : 0;
    progress.hidden = !leadIn || loadedKey !== current.key || current.counting ||
      !Number.isFinite(duration) || duration <= 0 || (!current.playing && !time);
    if (!progress.hidden) progress.value = Math.min(1, time / duration);
  }

  function paintGroup(entry, waiting) {
    const { state } = stored(entry);
    button.hidden = !entry.playing && !canStart(state);
    button.disabled = !entry.playing && (!canStart(state) || waiting || document.hidden);
    const label = entry.playing ? "暂停" : state === "resume" ? "继续播放" : "播放听写";
    if (button.textContent !== label) button.textContent = label;
    const message = entry.counting ? "正在倒计时。"
      : entry.playing ? "听写录音播放中。"
      : state === "done" ? "听写已播完。可以继续填写或检查。"
      : state === "unavailable" ? "浏览器无法保存播放状态，请检查本地存储设置。"
      : !canStart(state) ? "本组的播放机会已使用。"
      : waiting ? "正在准备播放听写。"
      : entry.retry ? "录音未能播放。请重试。"
      : state === "resume" ? "听写已暂停，可以从原位置继续。"
      : "首次作答可以播放整组一次。播放中可以暂停。";
    if (status.textContent !== message) status.textContent = message;
    updateProgress();
  }

  function paintReplays(waiting) {
    for (const control of document.querySelectorAll("[data-dictation-replay]")) {
      const entry = session.replays.get(control.dataset.dictationReplay);
      const state = entry ? stored(entry).state : "unavailable";
      const playing = Boolean(entry?.playing);
      const label = playing ? "暂停"
        : state === "resume" ? "继续听"
        : state === "done" ? "已重听"
        : state === "unavailable" ? "无法播放"
        : entry?.retry ? "重试" : "重听";
      control.disabled = !playing && (!canStart(state) || waiting || document.hidden);
      if (control.textContent !== label) {
        control.textContent = label;
        control.setAttribute("aria-label", label + "第 " + control.dataset.replayNumber + " 题听写");
      }
    }
  }

  function paint() {
    const group = session?.group;
    const waiting = Boolean(navigator.locks && session && !session.withoutLock && !session.reservation?.release);
    dock.hidden = !(group && (session.shown || group.playing));
    if (!dock.hidden) paintGroup(group, waiting);
    if (session?.shown && !group) paintReplays(waiting);
  }

  function release(playback) {
    const reservation = playback.reservation;
    if (!reservation) return;
    playback.reservation = null;
    reservation.controller.abort();
    reservation.release?.();
  }

  function reserve(playback) {
    const reservation = { controller: new AbortController(), release: null };
    playback.reservation = reservation;
    // Acquire before the click so that play() runs inside the browser's user gesture.
    navigator.locks.request(playback.key, { signal: reservation.controller.signal }, () => {
      if (playback !== session || playback.reservation !== reservation) return;
      return new Promise(resolve => {
        reservation.release = resolve;
        paint();
      });
    }).catch(() => {
      if (playback !== session || playback.reservation !== reservation) return;
      playback.reservation = null;
      playback.withoutLock = true;
      paint();
    });
  }

  function sync() {
    if (session && navigator.locks && !session.withoutLock) {
      const tracks = session.group ? [session.group] : Array.from(session.replays.values());
      const needsLock = current?.playing || (session.shown && !document.hidden &&
        tracks.some(entry => canStart(stored(entry).state)));
      if (needsLock && !session.reservation) reserve(session);
      if (!needsLock) release(session);
    }
    paint();
  }

  function announce() {
    document.dispatchEvent(new Event("dictation-playback-change"));
  }

  function focusFirstAnswer() {
    const field = document.querySelector("[data-dictation-answer]");
    if (field) {
      field.focus({ preventScroll: true });
      window.UnlockScreens.reveal(field);
    }
  }

  function closeCountdown(entry) {
    if (!entry.counting) return;
    entry.counting = false;
    cancelAnimationFrame(entry.countdownFrame);
    if (countdown.open && typeof countdown.close === "function") countdown.close();
    else countdown.removeAttribute("open");
  }

  function openCountdown(entry) {
    entry.counting = true;
    numeral.textContent = String(countdownSeconds);
    if (typeof countdown.showModal === "function") countdown.showModal();
    else countdown.setAttribute("open", "");

    function tick() {
      if (!entry.counting || entry !== current) return;
      const remaining = audioLeadIn - player.currentTime;
      if (remaining <= 0) {
        closeCountdown(entry);
        checkpoint(entry, true);
        paint();
        focusFirstAnswer();
        return;
      }
      const next = String(Math.min(countdownSeconds, Math.ceil(remaining)));
      if (numeral.textContent !== next) numeral.textContent = next;
      entry.countdownFrame = requestAnimationFrame(tick);
    }
    entry.countdownFrame = requestAnimationFrame(tick);
  }

  function park(entry, failed = false) {
    if (!entry.playing) return;
    const leftDuringCountdown = entry.counting;
    closeCountdown(entry);
    entry.playing = false;
    entry.retry = failed;
    if (player.ended) save(entry, "done");
    else if (position(entry) === 0 && (leftDuringCountdown || (failed && entry.firstPlay))) save(entry, "ready");
    else checkpoint(entry, true);
    player.pause();
  }

  function pause(failed = false) {
    if (!current?.playing) return;
    park(current, failed);
    sync();
    announce();
  }

  function track(key, file, leadIn = 0) {
    return { key, file, leadIn, playing: false, offset: 0, run: 0 };
  }

  function update(worksheet, show, firstRound, replayQuestions) {
    const config = worksheet?.dictation;
    let key = null;
    if (config && firstRound) key = namespace + worksheet.key;
    else if (config && replayQuestions.length) key = replayNamespace + worksheet.key;

    if (key !== (session?.key || null)) {
      if (current) park(current);
      if (session) release(session);
      if (loadedKey) {
        loadedKey = null;
        player.removeAttribute("src");
        player.load();
      }
      const group = key && firstRound
        ? track(key, config.file.replace(/\.mp3$/, "-countdown.mp3"), audioLeadIn) : null;
      const replays = new Map();
      for (const question of replayQuestions) {
        const file = worksheet.unit.audio[question.audio?.[0]]?.file;
        if (file) replays.set(question.id, track(key + ":" + encodeURIComponent(question.id), file));
      }
      session = key ? { key, group, replays, shown: false } : null;
      current = group;
    }
    if (session) {
      session.shown = show;
      if (!session.group && !show && current) park(current);
    }
    sync();
    return Boolean(current?.playing);
  }

  function start(entry) {
    if (entry.playing) { pause(); return; }
    const { state, time } = stored(entry);
    if (!canStart(state)) { sync(); return; }
    const firstPlay = state === "ready";
    if (!save(entry, firstPlay ? "ready" : "resume:" + time)) {
      sync();
      return;
    }
    if (current && current !== entry) park(current);
    current = entry;
    entry.firstPlay = firstPlay;
    entry.offset = time;
    entry.playing = true;
    const run = ++entry.run;
    if (loadedKey !== entry.key || player.error) {
      player.src = "../" + entry.file;
      loadedKey = entry.key;
    }
    if (firstPlay) {
      player.currentTime = 0;
      if (entry.leadIn) openCountdown(entry);
    } else if (player.currentTime < entry.leadIn + time) {
      player.currentTime = entry.leadIn + time;
    }
    const pending = player.play();
    sync();
    announce();
    pending.catch(() => { if (entry === current && run === entry.run) pause(true); });
  }

  button.addEventListener("click", () => {
    const entry = session?.group;
    if (entry && (entry.playing || (session.shown && !button.disabled))) start(entry);
  });

  document.addEventListener("click", event => {
    const control = event.target.closest?.("[data-dictation-replay]");
    if (!control || control.disabled || !session?.shown) return;
    const entry = session.replays.get(control.dataset.dictationReplay);
    if (entry) start(entry);
  });

  countdown.addEventListener("cancel", event => {
    event.preventDefault();
    pause();
  });
  player.addEventListener("ended", () => { if (player.ended) pause(); });
  player.addEventListener("error", () => { if (current?.key === loadedKey && player.error) pause(true); });
  player.addEventListener("pause", () => {
    if (player.paused && !player.ended && !player.error) pause();
  });
  player.addEventListener("timeupdate", () => {
    if (current?.playing && !current.counting && loadedKey === current.key && !player.ended) checkpoint(current, false);
    updateProgress();
  });
  player.addEventListener("durationchange", updateProgress);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && current?.counting) pause();
    else sync();
  });
  window.addEventListener("pagehide", () => {
    if (current) park(current);
    if (session) release(session);
  });
  window.addEventListener("pageshow", () => { sync(); announce(); });
  window.addEventListener("storage", event => {
    if (session && (event.key === session.key || event.key?.startsWith(session.key + ":"))) sync();
  });

  window.UnlockDictation = { update, pause };
})();
