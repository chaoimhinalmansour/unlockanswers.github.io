"use strict";

(function () {
  const dock = document.getElementById("dictation-dock");
  const player = dock.querySelector("audio");
  const button = dock.querySelector("[data-dictation-start]");
  const status = dock.querySelector("[data-dictation-status]");
  const progress = dock.querySelector("progress");
  const namespace = "unlock.practice.dictation.v1:";
  let current = null;

  function stored(entry) {
    if (entry.storageFailed) return "unavailable";
    try { return localStorage.getItem(entry.key) || "ready"; }
    catch { return "unavailable"; }
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

  function updateProgress() {
    const duration = player.duration;
    progress.hidden = !current?.playing || !Number.isFinite(duration) || duration <= 0;
    if (!progress.hidden) progress.value = Math.min(1, player.currentTime / duration);
  }

  function paint() {
    const entry = current;
    dock.hidden = !(entry?.shown || entry?.playing);
    if (dock.hidden) return;
    const state = stored(entry);
    const ready = state === "ready" && !entry.playing;
    const waiting = navigator.locks && !entry.withoutLock && !entry.reservation?.release;
    button.hidden = !ready;
    button.disabled = !ready || Boolean(waiting) || document.hidden;
    const message = entry.playing ? "正在连续播放听写录音。请按题号填写。"
      : state === "done" ? "听写已播完。可以继续填写或检查。"
      : state === "interrupted" ? "播放已中断，本组的播放机会已使用。"
      : state === "unavailable" ? "浏览器无法保存播放状态，请检查本地存储设置。"
      : state !== "ready" ? "本组的播放机会已使用。"
      : waiting ? "正在准备播放听写。"
      : entry.retry ? "录音未能开始播放。请重试。"
      : "整组只播放一次，准备好再开始。";
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
      const needsLock = entry.shown && !document.hidden && stored(entry) === "ready";
      if (needsLock && !entry.reservation) reserve(entry);
      if (!needsLock) release(entry);
    }
    paint();
  }

  function announce() {
    document.dispatchEvent(new Event("dictation-playback-change"));
  }

  function finish(value) {
    const entry = current;
    if (!entry?.playing) return;
    entry.playing = false;
    entry.retry = value === "ready";
    save(entry, value);
    sync();
    announce();
  }

  function failed() {
    finish(player.currentTime > 0 || player.played.length ? "interrupted" : "ready");
  }

  function update(worksheet, show, canPlay) {
    const config = worksheet?.dictation;
    const key = config ? namespace + worksheet.key : null;
    if (current && (current.key !== key || !canPlay) && current.playing) {
      current.playing = false;
      save(current, "interrupted");
      player.pause();
    }
    if (key !== (current?.key || null)) {
      if (current) release(current);
      current = config ? { key, file: config.file, shown: false, playing: false } : null;
    }
    if (current) current.shown = show && canPlay;
    sync();
    return Boolean(current?.playing);
  }

  button.addEventListener("click", () => {
    const entry = current;
    if (!entry?.shown || button.disabled || stored(entry) !== "ready" || !save(entry, "started")) {
      sync();
      return;
    }
    entry.playing = true;
    player.src = "../" + entry.file;
    const pending = player.play();
    sync();
    announce();
    const field = document.querySelector("[data-dictation-answer]");
    if (field) {
      field.focus({ preventScroll: true });
      window.UnlockScreens.reveal(field);
    }
    pending.catch(() => { if (entry === current) failed(); });
  });

  player.addEventListener("ended", () => finish("done"));
  player.addEventListener("error", failed);
  player.addEventListener("pause", () => {
    if (player.paused && !player.ended && player.currentTime > 0) finish("interrupted");
  });
  player.addEventListener("timeupdate", updateProgress);
  player.addEventListener("durationchange", updateProgress);
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("storage", event => {
    if (current && event.key === current.key) sync();
  });

  window.UnlockDictation = { update };
})();
