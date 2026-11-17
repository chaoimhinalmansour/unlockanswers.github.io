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
    return loadedKey === entry.key ? Math.max(entry.offset, player.currentTime - audioLeadIn) : entry.offset;
  }

  function checkpoint(entry, force) {
    const time = position(entry);
    if (force || Math.floor(time) > Math.floor(entry.offset)) {
      if (save(entry, "resume:" + Math.floor(time * 1000) / 1000)) entry.offset = time;
    }
  }

  function updateProgress() {
    const duration = player.duration - audioLeadIn;
    const time = current ? position(current) : 0;
    progress.hidden = !current || loadedKey !== current.key || current.counting ||
      !Number.isFinite(duration) || duration <= 0 || (!current.playing && !time);
    if (!progress.hidden) progress.value = Math.min(1, time / duration);
  }

  function paint() {
    const entry = current;
    dock.hidden = !(entry?.shown || entry?.playing);
    if (dock.hidden) return;
    const { state } = stored(entry);
    const waiting = navigator.locks && !entry.withoutLock && !entry.reservation?.release;
    button.hidden = !entry.playing && !canStart(state);
    button.disabled = !entry.playing && (!canStart(state) || Boolean(waiting) || document.hidden);
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
      : "整组只播放一次，播放中可以暂停。";
    if (status.textContent !== message) status.textContent = message;
    updateProgress();
  }

  function release(entry) {
    const reservation = entry.reservation;
    if (!reservation) return;
    entry.reservation = null;
    reservation.controller.abort();
    reservation.release?.();
  }

  function reserve(entry) {
    const reservation = { controller: new AbortController(), release: null };
    entry.reservation = reservation;
    // Acquire before the click so that play() runs inside the browser's user gesture.
    navigator.locks.request(entry.key, { signal: reservation.controller.signal }, () => {
      if (entry !== current || entry.reservation !== reservation) return;
      return new Promise(resolve => {
        reservation.release = resolve;
        paint();
      });
    }).catch(() => {
      if (entry !== current || entry.reservation !== reservation) return;
      entry.reservation = null;
      entry.withoutLock = true;
      paint();
    });
  }

  function sync() {
    const entry = current;
    if (entry && navigator.locks && !entry.withoutLock) {
      const needsLock = entry.playing || (entry.shown && !document.hidden && canStart(stored(entry).state));
      if (needsLock && !entry.reservation) reserve(entry);
      if (!needsLock) release(entry);
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

  function update(worksheet, show, canPlay) {
    const config = worksheet?.dictation;
    const key = config ? namespace + worksheet.key : null;
    if (current && (current.key !== key || !canPlay)) park(current);
    if (key !== (current?.key || null)) {
      if (current) release(current);
      current = config ? { key, file: config.file, shown: false, playing: false, offset: 0, run: 0 } : null;
    }
    if (current) current.shown = show && canPlay;
    sync();
    return Boolean(current?.playing);
  }

  button.addEventListener("click", () => {
    const entry = current;
    if (entry?.playing) { pause(); return; }
    if (!entry?.shown || button.disabled) return;
    const { state, time } = stored(entry);
    if (!canStart(state)) { sync(); return; }
    const firstPlay = state === "ready";
    if (!save(entry, firstPlay ? "ready" : "resume:" + time)) {
      sync();
      return;
    }
    entry.firstPlay = firstPlay;
    entry.offset = time;
    entry.playing = true;
    const run = ++entry.run;
    if (loadedKey !== entry.key || player.error) {
      player.src = "../" + entry.file.replace(/\.mp3$/, "-countdown.mp3");
      loadedKey = entry.key;
    }
    if (firstPlay) {
      player.currentTime = 0;
      openCountdown(entry);
    } else if (player.currentTime < audioLeadIn + time) {
      player.currentTime = audioLeadIn + time;
    }
    const pending = player.play();
    sync();
    announce();
    pending.catch(() => { if (entry === current && run === entry.run) pause(true); });
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
    if (!current) return;
    park(current);
    release(current);
  });
  window.addEventListener("pageshow", () => { sync(); announce(); });
  window.addEventListener("storage", event => {
    if (current && event.key === current.key) sync();
  });

  window.UnlockDictation = { update, pause };
})();
