"use strict";

(function () {
  const { escapeHTML: esc } = window.UnlockRules;
  const dock = document.getElementById("listening-dock");
  const player = dock.querySelector("audio");
  const play = dock.querySelector("[data-listen-play]");
  const selector = dock.querySelector("[data-listen-track]");
  const picker = dock.querySelector(".candidate-tracks");
  const label = dock.querySelector("[data-listen-label]");
  const range = dock.querySelector("[data-listen-range]");
  const time = dock.querySelector("[data-listen-time]");
  const warning = dock.querySelector("[data-listen-warning]");
  let worksheetKey;
  let tracks = [];
  let selected = "";
  let audioIndex = {};

  function clock(timeInSeconds) {
    const seconds = Number.isFinite(timeInSeconds) ? Math.floor(timeInSeconds) : 0;
    return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
  }

  function showTime() {
    const seconds = Number.isFinite(player.duration) ? player.duration : 0;
    range.disabled = !seconds;
    range.max = String(seconds || 1);
    range.value = String(player.currentTime);
    time.textContent = clock(player.currentTime) + " / " + clock(seconds);
    play.textContent = player.paused ? "播放" : "暂停";
  }

  function selectTrack(id) {
    const track = audioIndex[id];
    if (!track) return;
    label.textContent = track.label;
    selector.value = id;
    if (id === selected) return;
    player.pause();
    selected = id;
    warning.hidden = true;
    player.src = "../" + track.file;
    showTime();
  }

  function update(worksheet, question) {
    const offered = worksheet?.code.startsWith("L_") ? question?.audio || [] : [];
    dock.hidden = !offered.length;
    if (worksheetKey !== worksheet?.key) {
      player.pause();
      selected = "";
      tracks = [];
      worksheetKey = worksheet?.key;
    }
    if (!offered.length) {
      player.pause();
      return;
    }
    audioIndex = worksheet.unit.audio;
    if (offered.join("|") !== tracks.join("|")) {
      tracks = offered;
      selector.innerHTML = tracks.map(id =>
        '<option value="' + esc(id) + '">' + esc(audioIndex[id].label) + "</option>").join("");
      picker.hidden = tracks.length < 2;
    }
    selectTrack(tracks.includes(selected) ? selected : tracks[0]);
  }

  play.addEventListener("click", () => {
    if (!player.paused) { player.pause(); return; }
    player.play().catch(() => { warning.hidden = false; });
  });
  selector.addEventListener("change", () => selectTrack(selector.value));
  range.addEventListener("input", () => {
    if (Number.isFinite(player.duration)) player.currentTime = Number(range.value);
  });
  dock.querySelector("[data-listen-back]").addEventListener("click", () => {
    player.currentTime = Math.max(0, player.currentTime - 5);
  });
  dock.querySelector("[data-listen-speed]").addEventListener("change", event => {
    player.playbackRate = Number(event.target.value);
  });
  for (const type of ["loadedmetadata", "timeupdate", "play", "pause", "ended"]) {
    player.addEventListener(type, showTime);
  }
  player.addEventListener("error", () => { warning.hidden = false; });

  window.UnlockListening = { update, player };
})();
