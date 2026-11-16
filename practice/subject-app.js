"use strict";

(function () {
  const { isAnswered, judge, escapeHTML: esc } = window.UnlockRules;
  const { sectionName, renderOrder, voiceHTML } = window.UnlockWorksheet;
  const { render: renderWorkbench, applyQuestionState } = window.UnlockWorkbench;
  const listening = window.UnlockListening;
  const recordings = window.UnlockRecordings;
  const report = window.UnlockReport;
  const surface = document.getElementById("practice-surface");
  const app = document.getElementById("app");
  const account = document.getElementById("practice-account");
  const dock = document.getElementById("practice-docks");
  const operations = document.getElementById("practice-operations");
  const students = window.UNLOCK_STUDENTS;
  const catalog = window.UNLOCK_CATALOG;
  const books = { L1: 2, L2: 3 };
  const subjects = { L: "Listening", S: "Speaking", R: "Reading", W: "Writing" };
  const remembered = "unlock.practice.navigation.v4";
  const cache = new Map();
  const printPreviews = new Map();
  let voiceJob = null;

  const state = {
    student: null, unit: 1, worksheet: null, attempt: null, focus: null,
    all: false, readingOpen: true, largePicture: false,
    notice: "", loading: false, storageWorks: true, navigation: 0
  };

  function newAttempt() {
    return { sequence: 0, draft: {}, draftRecordings: {}, first: null, second: null };
  }

  function userKey(meta) {
    return [state.student.name, state.student.level, state.student.adminClass, meta.id, meta.revision]
      .map(encodeURIComponent).join(":");
  }

  function attemptKey(meta, code) {
    return "unlock.practice.subject.v1:" + userKey(meta) + ":" + code;
  }

  function storedAttempt(key) {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (!Number.isInteger(value.sequence) || !value.draft) throw new Error("Invalid local progress");
    return value;
  }

  function getAttempt(key) {
    if (state.storageWorks) {
      try {
        const saved = storedAttempt(key);
        if (saved) return saved;
      } catch {
        state.storageWorks = false;
      }
    }
    return cache.get(key) || newAttempt();
  }

  function saveAttempt(next) {
    const key = state.worksheet.key;
    if (state.storageWorks) {
      try {
        const latest = storedAttempt(key) || newAttempt();
        if (latest.sequence !== state.attempt.sequence) {
          state.attempt = latest;
          pickFocus(state.focus);
          state.notice = "这个练习已在另一个窗口更新。已载入最新作答。";
          render();
          return false;
        }
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        state.storageWorks = false;
      }
    }
    cache.set(key, next);
    state.attempt = next;
    return true;
  }


  function legacyAttempt(meta, code) {
    const listeningAndSpeaking = /^[LS]/.test(code);
    const group = (listeningAndSpeaking ? "LS-" : "RW-") + code.slice(2);
    const suffix = userKey(meta) + ":" + group;
    if (listeningAndSpeaking) {
      const withVoice = getAttempt("unlock.practice.voice.v1:" + suffix);
      if (withVoice.sequence) return withVoice;
    }
    return getAttempt("unlock.practice.v1:" + suffix);
  }

  function fromLegacy(meta, code) {
    const previous = legacyAttempt(meta, code);
    if (!previous.sequence) return newAttempt();
    const marker = "/" + code + "/";
    const scoped = entries => Object.fromEntries(Object.entries(entries || {}).filter(([id]) => id.includes(marker)));
    const snapshot = round => round ? {
      time: round.time, answers: scoped(round.answers), results: scoped(round.results), recordings: scoped(round.recordings)
    } : null;
    const first = snapshot(previous.first);
    const second = snapshot(previous.second);
    if (code[0] === "S" && first &&
      (Object.keys(first.recordings).length < 25 || (second && Object.keys(second.recordings).length < 25))) {
      return { ...newAttempt(), draft: { ...(second?.answers || first.answers), ...scoped(previous.draft) } };
    }
    return { sequence: 0, draft: scoped(previous.draft), draftRecordings: scoped(previous.draftRecordings), first, second };
  }

  function currentAttempt(meta, code) {
    const saved = getAttempt(attemptKey(meta, code));
    return saved.sequence ? saved : fromLegacy(meta, code);
  }

  function saveNavigation() {
    try {
      sessionStorage.setItem(remembered, JSON.stringify({
        student: state.student?.name, unit: state.unit, code: state.worksheet?.code,
        focus: state.focus, all: state.all, readingOpen: state.readingOpen
      }));
    } catch {}
  }

  function currentMeta() {
    return catalog.find(item => item.book === books[state.student?.level] && item.unit === state.unit);
  }

  function unitNumber(unit) {
    return String(unit).padStart(2, "0");
  }

  function practiceTitle(meta, code) {
    return "Book " + meta.book + " Unit " + unitNumber(meta.unit) + " " + subjects[code[0]] + " " + code.slice(2);
  }

  function status(attempt) {
    if (attempt.second) return { name: "已完成", style: "finished" };
    if (attempt.first) return { name: "待订正", style: "correction" };
    if (Object.keys(attempt.draft).length || Object.keys(attempt.draftRecordings || {}).length) {
      return { name: "作答中", style: "in-progress" };
    }
    return { name: "未开始", style: "" };
  }

  function entry() {
    const options = students.map(student => '<option value="' + esc(student.name) + '">' +
      esc(student.name) + "</option>").join("");
    return '<section class="entry-layout"><div class="entry-intro"><h1>在线练习</h1>' +
      '<p>选择姓名，查看适合你的练习。</p></div><form id="identity-form" class="identity-form">' +
      '<div><label for="student" class="field-label">选择姓名</label>' +
      '<select id="student" required><option value="">请选择你的姓名</option>' + options +
      '</select></div><button type="submit" class="button">进入练习</button></form></section>';
  }


  function identityBar() {
    const student = state.student;
    if (!student) return "";
    return '<div class="identity-info"><strong>' + esc(student.name) +
      '</strong><span>' + esc(student.level) + '</span><span class="class-label">' +
      esc(student.adminClass) + '</span></div><button type="button" class="text-action subtle-action" ' +
      'data-action="identity">切换学生</button>';
  }

  function taskButton(meta, code) {
    const activity = status(currentAttempt(meta, code));
    return '<button type="button" class="assignment-button' + (activity.style ? " started" : "") +
      '" data-task="' + esc(code) + '"><strong>' + esc(code.slice(2)) + '</strong><span class="mini-status ' +
      activity.style + '">' + activity.name + "</span></button>";
  }

  function subjectCard(meta, skill, name) {
    return '<section class="track" aria-label="' + esc(name) + '"><h2>' + esc(name) +
      '</h2><p class="track-caption">' + sectionName(skill) + '</p><div class="assignment-list">' +
      [1, 2, 3].map(h => taskButton(meta, skill + "_H" + h)).join("") +
      "</div></section>";
  }

  function directory() {
    const meta = currentMeta();
    if (!meta) return '<section class="empty-state panel"><h1>练习暂未开放</h1><p>' +
      esc(state.student.level) + " 暂未开放在线练习。</p></section>";
    const units = catalog.filter(item => item.book === meta.book);
    const buttons = units.map(item => '<button type="button" data-unit="' + item.unit +
      '" aria-pressed="' + String(item.unit === state.unit) + '">Unit ' + unitNumber(item.unit) +
      "</button>").join("");
    return '<section class="catalog"><div class="catalog-head"><h1>Book ' + meta.book +
      ' 作业目录</h1><p>选择一个科目，打开对应的 H1、H2 或 H3。</p></div>' +
      '<nav class="unit-picker" aria-label="选择单元">' + buttons + '</nav><div class="unit-heading">' +
      '<span>Unit ' + unitNumber(meta.unit) + '</span><h2>' + esc(meta.topic) +
      '</h2></div><div class="catalog-grid">' +
      Object.entries(subjects).map(([skill, title]) => subjectCard(meta, skill, title)).join("") +
      "</div></section>";
  }

  function questionsInView() {
    const { attempt, worksheet, all } = state;
    if (!attempt.first || attempt.second || all) return worksheet.questions;
    return worksheet.questions.filter(q => q.type === "open" || attempt.first.results[q.id] !== "correct");
  }

  function focusedQuestion() {
    return state.worksheet?.byNumber.get(state.focus);
  }

  function pickFocus(number) {
    const visible = questionsInView();
    const preferred = visible.find(q => q.number === number);
    state.focus = (preferred || visible[0])?.number ?? null;
  }

  function hasResponse(question) {
    const written = isAnswered(question, state.attempt.draft[question.id]);
    if (!recordings.isSpeaking(question)) return written;
    const clip = state.attempt.draftRecordings?.[question.id];
    return Boolean(clip && (question.type === "open" || written));
  }

  function isRequired(question) {
    const first = state.attempt.first;
    return !first || (question.type !== "open" && first.results[question.id] !== "correct");
  }


  function progress() {
    const { worksheet, attempt } = state;
    if (attempt.second) {
      const stats = report.summary(worksheet.questions, attempt);
      return { label: "客观题答对", now: stats.second, max: stats.objective,
        detail: "首次 " + stats.first + " / " + stats.objective + "，二次 " + stats.second + " / " + stats.objective };
    }
    if (attempt.first) {
      const wrong = worksheet.questions.filter(isRequired);
      return { label: "本轮已答", now: wrong.filter(hasResponse).length, max: wrong.length };
    }
    if (worksheet.code[0] === "S") {
      return { label: "已录音", now: Object.keys(attempt.draftRecordings || {}).length, max: worksheet.questions.length };
    }
    return { label: "已作答", now: worksheet.questions.filter(hasResponse).length, max: worksheet.questions.length };
  }

  function progressHTML(p) {
    if (!p.max) return '<p class="small">没有待订正的客观题。</p>';
    const percent = Math.round(p.now / p.max * 100);
    return '<div class="work-progress-line"><span>' + esc(p.label) + '</span><strong>' + p.now + " / " +
      p.max + '</strong></div><div class="work-meter" role="progressbar" aria-label="' + esc(p.label) +
      '" aria-valuenow="' + p.now + '" aria-valuemin="0" aria-valuemax="' + (p.max || 1) +
      '"><span style="width:' + percent + '%"></span></div>' +
      (p.detail ? '<p class="small progress-detail">' + esc(p.detail) + "</p>" : "");
  }

  function updateProgress() {
    const meter = document.getElementById("work-progress");
    if (meter) meter.innerHTML = progressHTML(progress());
    const storage = document.getElementById("storage-note");
    if (storage) storage.hidden = state.storageWorks;
    for (const button of app.querySelectorAll(".question-chip")) {
      const question = state.worksheet.byNumber.get(Number(button.dataset.questionNumber));
      applyQuestionState(button, question, state.attempt, question.number === state.focus, hasResponse(question));
    }
  }

  function reportURL(worksheet, attempt, student, audio = {}) {
    const printable = report.html({
      student, title: worksheet.title, attempt, audio,
      sections: worksheet.sections.map(section => ({
        name: sectionName(section.key), questions: section.questions
      }))
    });
    return URL.createObjectURL(new Blob([printable], { type: "text/html;charset=utf-8" }));
  }

  function reportKey() {
    return state.worksheet.key + ":" + state.attempt.second.time;
  }

  function exportLinks(entry) {
    if (entry.error) return '<p class="small" role="status">录音暂时无法读取。请在原作答浏览器中重试。</p>' +
      '<button type="button" class="button secondary" data-action="retry-report">重新生成作答单</button>';
    if (!entry.url) return '<p class="small" role="status">正在把录音放入作答单。</p>';
    const filename = state.worksheet.title + " 作答单 " + state.student.name + ".html";
    return '<a class="button" href="' + esc(entry.url) +
      '">导出作答</a><a class="button secondary" download="' + esc(filename) +
      '" href="' + esc(entry.url) + '">保存 HTML</a>';
  }

  function prepareReport(key) {
    const { worksheet, attempt, student } = state;
    const ids = [...new Set([attempt.first, attempt.second].flatMap(round =>
      Object.values(round.recordings || {}).map(clip => clip.id)))];
    const entry = {};
    printPreviews.set(key, entry);
    if (!ids.length) {
      entry.url = reportURL(worksheet, attempt, student);
      return entry;
    }
    Promise.all(ids.map(async id => [id, await recordings.dataURL(id)]))
      .then(data => { entry.url = reportURL(worksheet, attempt, student, Object.fromEntries(data)); })
      .catch(() => { entry.error = true; })
      .finally(() => {
        const panel = app.querySelector("[data-report-actions]");
        if (panel && panel.dataset.reportActions === key && printPreviews.get(key) === entry) {
          panel.innerHTML = exportLinks(entry);
        }
      });
    return entry;
  }

  function finalActions() {
    const key = reportKey();
    const entry = printPreviews.get(key) || prepareReport(key);
    return '<div class="final-actions" data-report-actions="' + esc(key) + '">' + exportLinks(entry) + "</div>";
  }


  function quiz() {
    const { worksheet, attempt } = state;
    const finished = Boolean(attempt.second);
    const correction = Boolean(attempt.first) && !finished;
    const phase = finished ? "已完成" : correction ? "订正" : "首次作答";
    const context = "Book " + worksheet.unit.book + " Unit " + unitNumber(worksheet.unit.unit);
    const title = subjects[worksheet.code[0]] + " " + worksheet.code.slice(2);
    const panel = renderWorkbench(worksheet, attempt, {
      current: focusedQuestion(), visible: questionsInView(), all: state.all, readingOpen: state.readingOpen,
      largePicture: state.largePicture, answered: hasResponse, editable
    });
    return '<div class="quiz-header"><button type="button" class="text-action subtle-action" data-action="directory">' +
      '返回作业目录</button><div class="session-top"><div><p class="page-context">' + esc(context) +
      '</p><div class="session-title"><h1>' + esc(title) + '</h1><span class="state-label' +
      (correction ? " correction" : "") + '">' + phase + '</span></div></div><div id="work-progress" class="work-progress" ' +
      'aria-live="polite">' + progressHTML(progress()) + '</div></div>' +
      (finished ? finalActions() : "") + "</div>" + panel;
  }

  function renderDocks() {
    const working = Boolean(state.worksheet) && !state.loading;
    dock.hidden = !working;
    listening.update(working ? state.worksheet : null, working ? focusedQuestion() : null);
    if (!working) {
      operations.innerHTML = "";
      return;
    }
    const visible = questionsInView();
    const i = visible.findIndex(q => q.number === state.focus);
    function step(direction, label, enabled) {
      return '<button type="button" class="button secondary" data-step="' + direction + '"' +
        (enabled ? "" : " disabled") + ">" + label + "</button>";
    }
    const actions = state.attempt.second
      ? '<button type="button" class="button secondary" data-action="directory">返回目录</button>'
      : '<button type="button" class="button" data-action="' +
        (state.attempt.first ? 'submit-second">再次提交' : 'submit-first">首次提交') + "</button>";
    operations.innerHTML = '<div class="step-actions">' + step(-1, "上一题", i > 0) +
      step(1, "下一题", i >= 0 && i < visible.length - 1) + "</div>" + actions;
  }

  function render(scrollTop = false) {
    account.innerHTML = identityBar();
    const notice = state.notice ? '<p class="feedback" role="status">' + esc(state.notice) + "</p>" : "";
    const storage = '<p class="feedback" id="storage-note" role="status"' +
      (state.storageWorks ? " hidden" : "") + ">此浏览器无法保存进度。请在当前页面完成作答和导出。</p>";
    let content;
    if (!state.student) content = entry();
    else if (state.loading) content = '<p class="empty-state panel" role="status">正在打开练习。</p>';
    else if (state.worksheet) content = quiz();
    else content = directory();
    const readingOffset = app.querySelector("#reading-material[open] .reading-text")?.scrollTop || 0;
    app.innerHTML = notice + storage + content;
    const passage = app.querySelector("#reading-material[open] .reading-text");
    if (passage) passage.scrollTop = readingOffset;
    renderDocks();
    hydrateAudio(app);
    syncVoiceControls();
    if (scrollTop) {
      window.scrollTo(0, 0);
      app.focus({ preventScroll: true });
    }
  }

  function loadUnit(meta) {
    const current = window.UNLOCK_UNITS[meta.id];
    if (current?.revision === meta.revision) return Promise.resolve(current);

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "data/alpha-a4/" + meta.id.toLowerCase() + ".js?v=" + meta.revision;
      script.addEventListener("error", () => reject(new Error("Cannot load unit")), { once: true });
      script.addEventListener("load", () => {
        const unit = window.UNLOCK_UNITS[meta.id];
        if (unit?.revision === meta.revision) resolve(unit);
        else reject(new Error("Unit revision mismatch"));
      }, { once: true });
      document.head.append(script);
    });
  }


  async function openWorksheet(code, rememberedView = {}) {
    const meta = currentMeta();
    if (!meta || !/^[LSRW]_H[123]$/.test(code) || state.loading) return;
    const ticket = ++state.navigation;
    state.loading = true;
    state.notice = "";
    render(true);
    try {
      const unit = await loadUnit(meta);
      if (ticket !== state.navigation) return;
      const sheet = { ...unit.sheets[code], key: code };
      const questions = sheet.questions;
      if (!questions?.length) throw new Error("Worksheet unavailable");
      const key = attemptKey(meta, code);
      state.worksheet = {
        key, code, title: practiceTitle(meta, code), unit, sheet,
        sections: [sheet], questions, byId: new Map(questions.map(q => [q.id, q])),
        byNumber: new Map(questions.map(q => [q.number, q]))
      };
      state.attempt = currentAttempt(meta, code);
      state.all = Boolean(rememberedView.all);
      state.largePicture = false;
      state.readingOpen = rememberedView.readingOpen ?? matchMedia("(min-width: 850px)").matches;
      pickFocus(rememberedView.focus);
      saveNavigation();
    } catch {
      if (ticket === state.navigation) state.notice = "这份练习暂时打不开，请返回目录后重试。";
    } finally {
      if (ticket === state.navigation) {
        state.loading = false;
        render(true);
      }
    }
  }

  function backToDirectory() {
    state.navigation++;
    state.loading = false;
    state.worksheet = null;
    state.attempt = null;
    state.focus = null;
    state.notice = "";
    saveNavigation();
    render(true);
  }

  function goToQuestion(number, keepNotice = false) {
    const question = state.worksheet.byNumber.get(number);
    if (!question) return;
    if (!questionsInView().includes(question)) state.all = true;
    if (!keepNotice) state.notice = "";
    if (focusedQuestion()?.picture !== question.picture) state.largePicture = false;
    state.focus = number;
    saveNavigation();
    render(true);
    document.getElementById("item-" + question.id)?.focus({ preventScroll: true });
  }

  function editable(question) {
    return question && state.attempt && !state.attempt.second &&
      state.attempt.first?.results[question.id] !== "correct";
  }

  function updateAnswer(question, value) {
    if (!editable(question)) return false;
    const next = {
      ...state.attempt,
      sequence: state.attempt.sequence + 1,
      draft: { ...state.attempt.draft, [question.id]: value }
    };
    if (!saveAttempt(next)) return false;
    updateProgress();
    return true;
  }

  function getDraft(question) {
    return state.attempt.draft[question.id];
  }

  function capture(draft, clips = {}) {
    const answers = {};
    const results = {};
    for (const question of state.worksheet.questions) {
      const value = draft[question.id] ?? (["multi", "order"].includes(question.type) ? [] : "");
      answers[question.id] = Array.isArray(value) ? [...value] : value;
      results[question.id] = judge(question, value);
    }
    return { time: new Date().toISOString(), answers, results, recordings: { ...clips } };
  }

  function needsMoreVoice() {
    const missing = state.worksheet.questions.filter(question => recordings.isSpeaking(question) &&
      !state.attempt.draftRecordings?.[question.id]);
    if (!missing.length) return false;
    state.notice = "还有 " + missing.length + " 道口语题需要录音。请录完后提交。";
    goToQuestion(missing[0].number, true);
    return true;
  }

  function commitFirst() {
    if (!state.attempt || state.attempt.first || needsMoreVoice()) return;
    const first = capture(state.attempt.draft, state.attempt.draftRecordings);
    const remaining = state.worksheet.questions.filter(q =>
      q.type !== "open" && first.results[q.id] !== "correct");
    const draft = {};
    const draftRecordings = {};
    for (const q of state.worksheet.questions) {
      if (q.type === "open" || first.results[q.id] === "correct") {
        draft[q.id] = first.answers[q.id];
        if (first.recordings[q.id]) draftRecordings[q.id] = first.recordings[q.id];
      }
    }
    if (!saveAttempt({ ...state.attempt, sequence: state.attempt.sequence + 1, first, draft, draftRecordings })) return;
    const next = remaining[0] || state.worksheet.questions.find(q => q.type === "open");
    state.notice = "";
    state.all = false;
    pickFocus(next?.number);
    saveNavigation();
    render(true);
  }

  function requestFirst() {
    if (!state.attempt || state.attempt.first || needsMoreVoice()) return;
    const missing = state.worksheet.questions.filter(q => !hasResponse(q)).length;
    if (!missing) {
      commitFirst();
      return;
    }

    const dialog = document.createElement("dialog");
    dialog.setAttribute("aria-labelledby", "submit-title");
    dialog.innerHTML = '<h2 id="submit-title">还有题目未完成</h2><p>有 ' + missing +
      ' 道题尚未完成。可以返回作答，也可以按当前内容提交。</p>' +
      '<div class="dialog-actions"><button type="button" class="button secondary" data-action="cancel-submit">' +
      '返回作答</button><button type="button" class="button" data-action="confirm-submit">提交当前作答</button></div>';
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    app.append(dialog);
    if (typeof dialog.showModal === "function") dialog.showModal();
    else if (window.confirm("有 " + missing + " 道题尚未完成。提交当前作答？")) commitFirst();
    else dialog.remove();
  }

  function commitSecond() {
    if (!state.attempt?.first || state.attempt.second || needsMoreVoice()) return;
    const missing = state.worksheet.questions.find(q => isRequired(q) && !hasResponse(q));
    if (missing) {
      state.notice = "请完成所有待订正的客观题，再次提交。";
      goToQuestion(missing.number, true);
      return;
    }
    const draft = { ...state.attempt.draft };
    const clips = { ...state.attempt.draftRecordings };
    for (const question of state.worksheet.questions) {
      if (state.attempt.first.results[question.id] === "correct") {
        draft[question.id] = state.attempt.first.answers[question.id];
        const clip = state.attempt.first.recordings?.[question.id];
        if (clip) clips[question.id] = clip;
      }
    }
    const second = capture(draft, clips);
    if (!saveAttempt({
      ...state.attempt, sequence: state.attempt.sequence + 1, second, draft: {}, draftRecordings: {}
    })) return;
    state.notice = "";
    state.all = false;
    pickFocus(state.focus);
    saveNavigation();
    render(true);
  }

  function voiceField(id) {
    return document.getElementById("item-" + id)?.querySelector("[data-voice-question]");
  }

  function voiceMessage(id, message) {
    const element = voiceField(id)?.querySelector("[data-voice-message]");
    if (!element) return;
    element.textContent = message;
    element.hidden = !message;
  }

  function hydrateAudio(root) {
    for (const player of root.querySelectorAll("audio[data-clip]:not([src])")) {
      recordings.url(player.dataset.clip).then(src => {
        if (player.isConnected) player.src = src;
      }).catch(error => {
        if (player.isConnected) voiceMessage(player.closest("[data-voice-question]").dataset.voiceQuestion, error.message);
      });
    }
  }

  function syncVoiceControls() {
    for (const field of app.querySelectorAll("[data-voice-question]")) {
      const start = field.querySelector("[data-record-start]");
      if (!start) continue;
      const active = voiceJob?.id === field.dataset.voiceQuestion;
      const stop = field.querySelector("[data-record-stop]");
      const timer = field.querySelector("[data-voice-timer]");
      start.disabled = Boolean(voiceJob);
      start.hidden = active;
      stop.hidden = !active || voiceJob.phase === "saving";
      stop.textContent = active && voiceJob.phase === "permission" ? "取消" : "结束录音";
      timer.hidden = !active || voiceJob.phase !== "recording";
      if (!timer.hidden) timer.textContent = recordings.timeText(performance.now() - voiceJob.handle.startedAt);
    }
  }

  function preventLeaving(event) {
    event.preventDefault();
    event.returnValue = "";
  }

  function finishVoice(job) {
    if (voiceJob !== job) return false;
    clearInterval(job.timer);
    voiceJob = null;
    window.removeEventListener("beforeunload", preventLeaving);
    syncVoiceControls();
    return true;
  }

  function saveVoice(question, clip) {
    if (!editable(question)) return;
    const next = {
      ...state.attempt,
      sequence: state.attempt.sequence + 1,
      draftRecordings: { ...state.attempt.draftRecordings, [question.id]: clip }
    };
    if (!saveAttempt(next)) return;
    const field = voiceField(question.id);
    if (field) {
      field.outerHTML = voiceHTML(question, next);
      const updated = voiceField(question.id);
      hydrateAudio(updated);
      voiceMessage(question.id, "");
      updated.querySelector("[data-record-start]")?.focus({ preventScroll: true });
    }
    updateProgress();
  }

  async function startVoice(button) {
    if (voiceJob) return;
    const id = button.closest("[data-voice-question]").dataset.voiceQuestion;
    const question = state.worksheet?.byId.get(id);
    if (!editable(question) || !recordings.isSpeaking(question)) return;
    for (const player of app.querySelectorAll("audio")) player.pause();

    const job = { id, phase: "permission", handle: null, timer: null };
    voiceJob = job;
    window.addEventListener("beforeunload", preventLeaving);
    syncVoiceControls();
    voiceMessage(id, "请在浏览器提示中允许使用麦克风。");
    voiceField(id)?.querySelector("[data-record-stop]")?.focus({ preventScroll: true });
    try {
      const handle = await recordings.begin();
      if (voiceJob !== job) {
        handle.cancel();
        await handle.result;
        return;
      }
      job.handle = handle;
      job.phase = "recording";
      voiceMessage(id, "");
      syncVoiceControls();
      job.timer = setInterval(syncVoiceControls, 250);
      const clip = await handle.result;
      if (finishVoice(job) && clip) saveVoice(question, clip);
    } catch (error) {
      if (finishVoice(job)) {
        voiceMessage(id, error.message);
        voiceField(id)?.querySelector("[data-record-start]")?.focus({ preventScroll: true });
      }
    }
  }

  function stopVoice() {
    const job = voiceJob;
    if (!job) return;
    if (!job.handle) {
      finishVoice(job);
      voiceMessage(job.id, "");
      return;
    }
    job.phase = "saving";
    job.handle.stop();
    syncVoiceControls();
    voiceMessage(job.id, "正在保存录音。");
  }


  function changeOrder(button) {
    const item = button.closest("[data-question]");
    const q = state.worksheet?.byId.get(item?.dataset.question);
    if (!editable(q)) return;
    const prior = getDraft(q) || [];
    const { orderAdd, orderRemove, orderShift, part } = button.dataset;
    let chosen;
    if (orderShift) {
      const from = prior.indexOf(part);
      const to = from + Number(orderShift);
      if (from < 0 || to < 0 || to >= prior.length) return;
      chosen = [...prior];
      [chosen[from], chosen[to]] = [chosen[to], chosen[from]];
    } else if (orderAdd) {
      if (prior.includes(orderAdd)) return;
      chosen = [...prior, orderAdd];
    } else {
      chosen = prior.filter(key => key !== orderRemove);
    }
    if (!updateAnswer(q, chosen)) return;
    const control = item.querySelector(".control");
    control.innerHTML = renderOrder(q, chosen);
    const property = orderRemove ? "orderAdd" : "orderRemove";
    Array.from(control.querySelectorAll("button"))
      .find(candidate => candidate.dataset[property] === (orderAdd || orderRemove || part))
      ?.focus({ preventScroll: true });
  }

  surface.addEventListener("submit", event => {
    if (event.target.id !== "identity-form") return;
    event.preventDefault();
    const name = document.getElementById("student").value;
    const student = students.find(person => person.name === name);
    if (!student) return;
    state.student = student;
    state.unit = 1;
    backToDirectory();
  });

  app.addEventListener("input", event => {
    const input = event.target;
    if (!input.matches("input[data-answer],textarea[data-answer]") ||
        (input instanceof HTMLInputElement && input.type !== "text")) return;
    updateAnswer(state.worksheet?.byId.get(input.dataset.answer), input.value);
  });

  app.addEventListener("change", event => {
    const input = event.target;
    if (!input.matches('select[data-answer],input[type="radio"][data-answer],input[type="checkbox"][data-answer]')) return;
    const item = state.worksheet?.byId.get(input.dataset.answer);
    if (!editable(item)) return;
    if (item.type === "multi") {
      const boxes = Array.from(input.closest(".options").querySelectorAll("input"));
      const values = boxes.filter(box => box.checked).map(box => box.value);
      if (updateAnswer(item, values)) {
        for (const box of boxes) box.disabled = !box.checked && values.length === item.pick;
      }
    } else {
      updateAnswer(item, input.value);
    }
  });

  app.addEventListener("toggle", event => {
    if (event.target.id === "reading-material") {
      state.readingOpen = event.target.open;
      saveNavigation();
    }
  }, true);

  surface.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    const d = button.dataset;
    if (button.hasAttribute("data-record-start")) { startVoice(button); return; }
    if (button.hasAttribute("data-record-stop")) { stopVoice(); return; }
    if (voiceJob && (d.task || d.unit || d.questionNumber || d.step || d.action)) {
      voiceMessage(voiceJob.id, "请先结束当前录音，再切换或提交。");
      voiceField(voiceJob.id)?.querySelector("[data-record-stop]:not([hidden])")?.focus();
      return;
    }
    if (d.unit) {
      state.unit = Number(d.unit);
      state.notice = "";
      saveNavigation();
      render();
      app.querySelector('[data-unit="' + d.unit + '"]')?.focus({ preventScroll: true });
    } else if (d.task) {
      openWorksheet(d.task);
    } else if (d.questionNumber) {
      goToQuestion(Number(d.questionNumber));
    } else if (d.step) {
      const visible = questionsInView();
      const position = visible.findIndex(q => q.number === state.focus) + Number(d.step);
      if (visible[position]) goToQuestion(visible[position].number);
    } else if (d.orderAdd || d.orderRemove || d.orderShift) {
      changeOrder(button);
    } else if (d.action === "identity") {
      state.student = null;
      backToDirectory();
    } else if (d.action === "directory") {
      backToDirectory();
    } else if (d.action === "toggle-all") {
      state.all = !state.all;
      pickFocus(state.focus);
      saveNavigation();
      render();
      app.querySelector('[data-action="toggle-all"]')?.focus({ preventScroll: true });
    } else if (d.action === "expand-photo") {
      state.largePicture = !state.largePicture;
      render();
      app.querySelector('[data-action="expand-photo"]')?.focus({ preventScroll: true });
    } else if (d.action === "submit-first") requestFirst();
    else if (d.action === "cancel-submit") button.closest("dialog").close();
    else if (d.action === "confirm-submit") commitFirst();
    else if (d.action === "submit-second") commitSecond();
    else if (d.action === "retry-report") {
      prepareReport(reportKey());
      render();
    }
  });

  surface.addEventListener("play", event => {
    if (!(event.target instanceof HTMLMediaElement)) return;
    if (voiceJob) {
      event.target.pause();
      voiceMessage(voiceJob.id, "请结束录音后再播放音频。");
    }
    for (const player of surface.querySelectorAll("audio")) {
      if (player !== event.target) player.pause();
    }
  }, true);

  window.addEventListener("storage", event => {
    if (voiceJob || !state.worksheet || event.key !== state.worksheet.key) return;
    const updated = getAttempt(event.key);
    if (updated.sequence !== state.attempt.sequence) {
      state.attempt = updated;
      pickFocus(state.focus);
      state.notice = "这份作业已在另一个窗口更新。";
      render();
    }
  });

  function restore() {
    try {
      const current = JSON.parse(sessionStorage.getItem(remembered) || "null");
      const previous = current || JSON.parse(sessionStorage.getItem("unlock.practice.navigation.v1") || "null");
      const student = students.find(person => person.name === previous?.student);
      if (!student) return;
      state.student = student;
      if (Number.isInteger(previous.unit) && previous.unit >= 1 && previous.unit <= 8) state.unit = previous.unit;
      const task = current ? current.code : previous.section;
      if (task) openWorksheet(task, current || {});
    } catch {}
  }

  if ("ResizeObserver" in window) {
    new ResizeObserver(() => surface.style.setProperty("--dock-height", (Math.ceil(dock.getBoundingClientRect().height) + 16) + "px"))
      .observe(dock);
  }

  restore();
  render();
})();
