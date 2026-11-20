"use strict";

(function () {
  const { escapeHTML: esc } = window.UnlockRules;
  const { markEvidence } = window.UnlockWorksheet;
  const dock = document.getElementById("listening-dock");
  const player = dock.querySelector("audio");
  const directAccess = dock.dataset.listenStudyAccess === "direct";
  const ui = window.UnlockStudentUI;
  const label = (en, zh) => ui ? ui.label(en, zh) : esc(zh);
  const template = document.createElement("template");
  template.innerHTML = `
    <div class="listen-study-controls" hidden>
      <output id="listen-pass-count" data-listen-passes role="status"></output>
      <button type="button" class="button secondary ui-action" data-listen-study aria-expanded="false"
        aria-controls="listening-study" disabled>${label("Audio Study", "音频精听")}</button>
    </div>
    <aside id="listening-study" class="workspace-source listening-study-panel" aria-labelledby="listen-study-title">
      <header class="listen-study-head">
        <h2 id="listen-study-title">${label("Audio Study", "音频精听")}</h2>
        <div class="listen-study-actions">
          <button type="button" data-listen-translation aria-pressed="false" disabled>${label("Chinese Captions", "中文字幕")}</button>
          <button type="button" data-close-listen-study aria-label="收起音频精听">${label("Close", "收起")}</button>
        </div>
      </header>
      <p data-listen-study-message role="status" hidden></p>
      <div class="listen-study-lines" tabindex="0" role="region" aria-label="听力原文" hidden></div>
    </aside>
  `;
  const [controls, panel] = template.content.children;
  const button = controls.querySelector("[data-listen-study]");
  const passText = controls.querySelector("[data-listen-passes]");
  passText.hidden = directAccess;
  if (!directAccess) button.setAttribute("aria-describedby", passText.id);
  dock.querySelector(".listen-extras").append(controls);
  const translation = panel.querySelector("[data-listen-translation]");
  const close = panel.querySelector("[data-close-listen-study]");
  const message = panel.querySelector("[data-listen-study-message]");
  const lines = panel.querySelector(".listen-study-lines");
  const captions = new Map();
  const unsaved = new Set();
  const required = 3;
  let active = null;
  let passEnded = false;
  let panelOpen = false;
  let request = 0;
  let cues = [];
  let rows = [];
  let current = -1;
  let evidence = [];
  let evidenceRow = null;
  let openedForEvidence = false;

  function readPasses() {
    const prefix = active?.prefix;
    if (!prefix) return 0;
    const passes = new Set();
    for (const key of unsaved) {
      if (key.startsWith(prefix)) passes.add(key);
    }
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(prefix)) passes.add(key);
      }
    } catch { /* Listening still works while this page is open. */ }
    return Math.min(passes.size, required);
  }

  function refreshAccess() {
    controls.hidden = !active;
    const count = readPasses();
    button.disabled = !active || (!directAccess && count < required);
    if (!directAccess) {
      const status = count === required ? "已解锁" : "完整收听 " + count + " / " + required + " 次";
      if (ui) {
        const english = count === required ? "Unlocked" : "Full plays " + count + " / " + required;
        if (passText.querySelector(".ui-en")?.textContent !== english) ui.setLabel(passText, english, status);
      } else if (passText.textContent !== status) passText.textContent = status;
    }
    if (button.disabled && panelOpen) hidePanel();
  }

  function completeCoverage() {
    const { duration, played } = player;
    if (!Number.isFinite(duration) || duration <= 0 || !played.length) return false;
    let end = 0;
    let skipped = 0;
    for (let i = 0; i < played.length; i++) {
      skipped += Math.max(0, played.start(i) - end);
      end = played.end(i);
    }
    // Allow media timestamp rounding across the whole pass, not a grace period for each seek.
    return skipped + Math.max(0, duration - end) <= 0.06;
  }

  player.addEventListener("ended", () => {
    if (!active?.prefix || passEnded || !player.ended || player.currentSrc !== active.url) return;
    passEnded = true;
    if (readPasses() < required && completeCoverage()) {
      const token = globalThis.crypto?.randomUUID?.() || (Date.now() + "-" + Math.random().toString(36).slice(2));
      const key = active.prefix + token;
      // An independent entry preserves passes completed in different tabs.
      try { localStorage.setItem(key, "1"); }
      catch { unsaved.add(key); }
    }
    refreshAccess();
  });

  function restartPassIfEnded() {
    if (!active?.prefix || (!passEnded && !player.ended)) return;
    passEnded = false;
    const rate = player.playbackRate;
    player.load();
    player.playbackRate = rate;
  }

  function scrollLine(row) {
    if (!row || !panel.isConnected || lines.scrollHeight <= lines.clientHeight) return;
    const viewport = lines.getBoundingClientRect();
    const line = row.getBoundingClientRect();
    const offset = Math.max(0, viewport.height - line.height) * 0.4;
    lines.scrollTop += line.top - viewport.top - offset;
  }

  function followCurrentLine() {
    scrollLine((player.paused && evidenceRow) || rows[current]);
  }

  function paintEvidence(locate) {
    const ranges = evidence.find(recording => recording.file === active?.file)?.ranges || [];
    for (const [index, row] of rows.entries()) {
      markEvidence(row.firstElementChild, cues[index].text, ranges.filter(range => range[0] === index), "listening-evidence");
    }
    evidenceRow = locate ? rows[ranges[0]?.[0]] : null;
    if (evidenceRow) scrollLine(evidenceRow);
  }

  function setEvidence(recordings) {
    if (!directAccess) return;
    evidence = recordings;
    const locate = evidence.some(recording => recording.file === active?.file);
    if (!evidence.length && openedForEvidence) hidePanel();
    else if (panelOpen) paintEvidence(locate);
    else if (locate) openPanel({ forEvidence: true, focusClose: false });
  }

  function sync(follow = false) {
    if (!panelOpen || !cues.length) return;
    const time = player.currentTime;
    const next = cues.findIndex(cue => cue.start <= time && time < cue.end);
    if (next !== current) {
      rows[current]?.removeAttribute("aria-current");
      current = next;
      rows[current]?.setAttribute("aria-current", "true");
      follow = true;
    }
    if (follow) followCurrentLine();
  }

  function mountPanel() {
    const workspace = document.querySelector("#app .workspace");
    if (!panelOpen || !workspace || panel.parentElement === workspace) return;
    workspace.classList.add("with-material");
    workspace.insertBefore(panel, workspace.querySelector(".workspace-question"));
    sync(true);
  }

  function showTranslation(on) {
    translation.setAttribute("aria-pressed", String(on));
    panel.classList.toggle("with-translation", on);
    sync(true);
  }

  function hidePanel() {
    panelOpen = false;
    openedForEvidence = false;
    evidenceRow = null;
    request++;
    button.setAttribute("aria-expanded", "false");
    showTranslation(false);
    const workspace = panel.parentElement;
    panel.remove();
    if (workspace && !workspace.querySelector(".workspace-source")) workspace.classList.remove("with-material");
  }

  async function getCues(selection) {
    const { id, revision } = selection.unit;
    const key = id + ":" + revision;
    if (!captions.has(key)) {
      const path = selection.unit.captionsPath || "data/alpha-a4-listening/" + id.toLowerCase() + ".json";
      const url = path + "?v=" + encodeURIComponent(revision);
      const pending = fetch(url).then(async response => {
        if (!response.ok) throw new Error("Audio timeline unavailable");
        const data = await response.json();
        if (data.id !== id || data.revision !== revision) throw new Error("Audio timeline version mismatch");
        return data;
      }).catch(error => {
        captions.delete(key);
        throw error;
      });
      captions.set(key, pending);
    }
    const result = (await captions.get(key)).tracks[selection.file];
    if (!result?.length) throw new Error("Audio timeline not assigned to this clip");
    return result;
  }

  async function openPanel({ forEvidence = false, focusClose = true } = {}) {
    if (!active || button.disabled) return;
    panelOpen = true;
    openedForEvidence = forEvidence;
    const ticket = ++request;
    button.setAttribute("aria-expanded", "true");
    cues = [];
    rows = [];
    current = -1;
    lines.replaceChildren();
    lines.hidden = true;
    translation.disabled = true;
    showTranslation(false);
    message.innerHTML = label("Loading transcript", "正在加载听力原文。");
    message.hidden = false;
    mountPanel();
    if (focusClose) close.focus({ preventScroll: true });
    try {
      const items = await getCues(active);
      if (ticket !== request) return;
      cues = items;
      lines.innerHTML = cues.map(cue =>
        '<div class="listen-study-line"><p lang="en">' + esc(cue.text) +
        '</p><p class="listen-study-zh" lang="zh-CN">' + esc(cue.zh) + '</p></div>').join("");
      rows = Array.from(lines.children);
      lines.hidden = false;
      lines.scrollTop = 0;
      translation.disabled = false;
      message.hidden = true;
      sync(true);
      if (evidence.length) paintEvidence(true);
    } catch {
      if (ticket === request) message.innerHTML = label("Close and reopen Audio Study to load the transcript.",
        "听力原文暂时无法加载。请收起后重新打开。");
    }
  }

  function update(student, unit, file) {
    const nextFile = file && (directAccess || student) ? file : null;
    const prefix = nextFile && !directAccess ? "unlock.practice.listening-pass.v1:" +
      [student.name, student.level, student.adminClass, file].map(encodeURIComponent).join(":") + ":" : "";
    if (nextFile !== (active?.file || null) || prefix !== (active?.prefix || "")) {
      const reopen = panelOpen && evidence.some(recording => recording.file === nextFile);
      const forEvidence = openedForEvidence;
      hidePanel();
      active = nextFile ? { prefix, unit, file, url: new URL("../" + file, document.baseURI).href } : null;
      passEnded = false;
      refreshAccess();
      if (reopen) openPanel({ forEvidence, focusClose: false });
    }
    mountPanel();
  }

  button.addEventListener("click", () => {
    if (panelOpen) hidePanel();
    else openPanel();
  });
  close.addEventListener("click", () => {
    hidePanel();
    button.focus({ preventScroll: true });
  });
  translation.addEventListener("click", () => {
    showTranslation(translation.getAttribute("aria-pressed") !== "true");
  });
  player.addEventListener("seeking", () => { evidenceRow = null; });
  player.addEventListener("play", () => {
    evidenceRow = null;
    sync(true);
  });
  player.addEventListener("seeked", () => sync(true));
  for (const type of ["loadedmetadata", "timeupdate", "ended"]) {
    player.addEventListener(type, () => sync());
  }
  window.addEventListener("storage", event => {
    if (active?.prefix && (event.key === null || event.key.startsWith(active.prefix))) refreshAccess();
  });

  if (typeof ResizeObserver === "function") new ResizeObserver(followCurrentLine).observe(lines);

  window.UnlockListeningStudy = { update, setEvidence, restartPassIfEnded };
})();
