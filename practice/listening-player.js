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
  const speed = dock.querySelector("[data-listen-speed]");
  const study = window.UnlockListeningStudy;
  const teacher = dock.dataset.listenStudyAccess === "direct";
  const ui = window.UnlockStudentUI;
  let questionId;
  let questionTracks = [];
  let learner = null;
  let unit = null;
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
    time.textContent = !seconds && player.hasAttribute("src")
      ? (ui ? "Loading audio" : "正在载入音频") : clock(player.currentTime) + " / " + clock(seconds);
    const chinese = player.paused ? "播放" : "暂停";
    if (ui) {
      const english = player.paused ? "Play" : "Pause";
      if (play.querySelector(".ui-en")?.textContent !== english) ui.setLabel(play, english, chinese);
    } else {
      play.textContent = chinese;
    }
  }

  function selectTrack(id) {
    const track = audioIndex[id];
    if (!track) return;
    label.textContent = track.label;
    selector.value = id;
    if (id !== selected) {
      const source = "../" + track.file;
      if (!selected || player.getAttribute("src") !== source) {
        player.pause();
        warning.hidden = true;
        player.src = source;
        player.playbackRate = Number(speed.value);
        showTime();
      }
      selected = id;
    }
    study?.update(learner, unit, track.file);
  }

  function offerTracks(offered, preferred = selected) {
    if (offered.join("|") !== tracks.join("|")) {
      tracks = offered;
      selector.innerHTML = tracks.map(id =>
        '<option value="' + esc(id) + '">' + esc(audioIndex[id].label) + "</option>").join("");
      picker.hidden = tracks.length < 2;
    }
    if (tracks.length) selectTrack(tracks.includes(preferred) ? preferred : tracks[0]);
  }

  function setEvidence(recordings) {
    if (!teacher || !study?.setEvidence) return;
    if (!recordings.length) {
      study.setEvidence([]);
      offerTracks(questionTracks);
      return;
    }
    const available = [...new Set([...questionTracks, ...Object.keys(audioIndex)])];
    const targets = recordings.map(recording => available.find(id => audioIndex[id].file === recording.file))
      .filter(Boolean);
    const preferred = targets.includes(selected) ? selected : targets[0];
    offerTracks([...new Set([...questionTracks, ...targets])], preferred);
    study.setEvidence(recordings);
  }

  function releaseTrack() {
    if (player.hasAttribute("src")) {
      player.pause();
      player.removeAttribute("src");
      player.load();
    }
    selected = "";
    tracks = [];
    warning.hidden = true;
  }

  function update(worksheet, question, student) {
    if (teacher && questionId !== question?.id) {
      questionId = question?.id;
      study?.setEvidence?.([]);
    }
    learner = student;
    unit = worksheet?.unit;
    questionTracks = worksheet ? question?.audio || [] : [];
    dock.hidden = !questionTracks.length;
    if (worksheetKey !== worksheet?.key || !questionTracks.length) {
      releaseTrack();
      worksheetKey = worksheet?.key;
      study?.update(null);
    }
    if (!questionTracks.length) return;
    audioIndex = worksheet.unit.audio;
    offerTracks(questionTracks);
  }

  play.addEventListener("click", () => {
    if (!player.paused) { player.pause(); return; }
    const source = player.getAttribute("src");
    warning.hidden = true;
    if (player.error) {
      player.load();
      player.playbackRate = Number(speed.value);
    }
    study?.restartPassIfEnded();
    player.play().catch(error => {
      if (error.name !== "AbortError" && player.getAttribute("src") === source) warning.hidden = false;
    });
  });
  selector.addEventListener("change", () => selectTrack(selector.value));
  function seek(seconds) {
    if (!Number.isFinite(player.duration)) return;
    study?.restartPassIfEnded();
    player.currentTime = seconds;
  }

  range.addEventListener("input", () => seek(Number(range.value)));
  dock.querySelector("[data-listen-back]").addEventListener("click", () => {
    seek(Math.max(0, player.currentTime - 5));
  });
  speed.addEventListener("change", () => { player.playbackRate = Number(speed.value); });
  for (const type of ["loadedmetadata", "timeupdate", "play", "pause", "ended"]) {
    player.addEventListener(type, showTime);
  }
  player.addEventListener("error", () => {
    if (player.error && player.hasAttribute("src")) warning.hidden = false;
  });

  window.UnlockListening = { update, setEvidence, player };
})();
