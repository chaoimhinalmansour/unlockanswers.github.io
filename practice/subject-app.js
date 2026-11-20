"use strict";

(function () {
  const session = window.UnlockSession;
  const activeSession = session.requireSession("student");
  if (!activeSession) return;
  const student = session.student(activeSession);
  if (!student) {
    session.signOut("student", location.href);
    return;
  }
  const { isAnswered, judge, escapeHTML: esc } = window.UnlockRules;
  const { sectionName, renderOrder, voiceHTML } = window.UnlockWorksheet;
  const { render: renderWorkbench, applyQuestionState, isDictation, questionStops } = window.UnlockWorkbench;
  const { specialUnit, findMeta, allowsWorksheet, unitLabel, subjectTitle, renderDirectory,
    createOpening, renderOpening, loadUnit } = window.UnlockPracticeCatalog;
  const listening = window.UnlockListening;
  const dictation = window.UnlockDictation;
  const words = window.UnlockWordDictation;
  const motion = window.UnlockMotion;
  const screens = window.UnlockScreens;
  const recordings = window.UnlockRecordings;
  const report = window.UnlockReport;
  const download = window.UnlockWorkPackage.downloadControl("button");
  const surface = document.getElementById("practice-surface");
  const app = document.getElementById("app");
  const account = document.getElementById("practice-account");
  const dock = document.getElementById("practice-docks");
  const operations = document.getElementById("practice-operations");
  const books = { L1: 2, L2: 3 };
  const remembered = "unlock.practice.navigation.v5";
  const cache = new Map();
  const activeAttempts = new Map();
  let voiceJob = null;
  let unmountWordPanel = null;

  const state = {
    student, unit: 1, worksheet: null, attempt: null, focus: null,
    all: false, readingOffset: 0, largePicture: false,
    notice: "", opening: null, storageWorks: true
  };

  function newAttempt() {
    return { sequence: 0, draft: {}, draftRecordings: {}, first: null, second: null };
  }

  function userKey(meta) {
    return [state.student.storageName ?? state.student.name, state.student.level, state.student.adminClass, meta.id, meta.revision]
      .map(encodeURIComponent).join(":");
  }

  function attemptKey(meta, code) {
    return "unlock.practice.subject.v1:" + userKey(meta) + ":" + code;
  }

  function attemptPointer(baseKey) {
    return "unlock.practice.current-attempt.v1:" + baseKey;
  }

  function attemptRunKey(baseKey, token) {
    return baseKey + ":run:" + token;
  }

  function activeAttemptKey(baseKey) {
    if (state.storageWorks) {
      try {
        const token = localStorage.getItem(attemptPointer(baseKey));
        const key = token && /^[a-z0-9-]{1,80}$/.test(token) ? attemptRunKey(baseKey, token) : baseKey;
        activeAttempts.set(baseKey, key);
        return key;
      } catch {
        state.storageWorks = false;
      }
    }
    return activeAttempts.get(baseKey) || baseKey;
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
    const { key, baseKey } = state.worksheet;
    const active = activeAttemptKey(baseKey);
    if (active !== key) {
      showAttempt(active, "这份练习已在另一个窗口重置。");
      return false;
    }
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

  function worksheetAttempt(meta, code) {
    const baseKey = attemptKey(meta, code);
    const key = activeAttemptKey(baseKey);
    const saved = getAttempt(key);
    const attempt = key !== baseKey || saved.sequence || meta.unit === specialUnit ? saved : fromLegacy(meta, code);
    return { baseKey, key, attempt };
  }

  function saveNavigation() {
    try {
      sessionStorage.setItem(remembered, JSON.stringify({
        student: state.student?.name, unit: state.unit, code: state.worksheet?.code,
        focus: state.focus, all: state.all
      }));
    } catch {}
  }

  function currentMeta() {
    return findMeta(books[state.student?.level], state.unit);
  }

  function status(attempt, code) {
    if (attempt.second) return { name: "已完成", style: "finished" };
    if (attempt.first) {
      const entries = Object.entries(attempt.first.results);
      const check = code[0] === "S" || entries.some(([, result]) => result === "ungraded");
      const correct = entries.some(([id, result]) =>
        (result === "incorrect" || result === "blank") && !attempt.wordDictation?.[id]);
      return { name: check && !correct ? "待自检" : "待订正", style: "correction" };
    }
    if (Object.keys(attempt.draft).length || Object.keys(attempt.draftRecordings || {}).length ||
        Object.keys(attempt.wordDictation || {}).length) {
      return { name: "作答中", style: "in-progress" };
    }
    return { name: "未开始", style: "" };
  }

  function identityBar() {
    const student = state.student;
    return '<div class="identity-info"><strong>' + esc(student.name) +
      '</strong><span>' + esc(student.level) + '</span><span class="class-label">' +
      esc(student.adminClass) + '</span></div><button type="button" class="text-action subtle-action" ' +
      'data-action="identity">退出登录</button>';
  }

  function directory() {
    const meta = currentMeta();
    if (!meta) return '<section class="empty-state panel"><h1>练习暂未开放</h1><p>' +
      esc(state.student.level) + " 暂未开放单元练习。</p></section>";
    return renderDirectory(meta, code => status(worksheetAttempt(meta, code).attempt, code));
  }


  function usesWordDictation() {
    const { worksheet, attempt } = state;
    return Boolean(worksheet?.dictationItems.length && (!attempt.first || attempt.wordDictation));
  }

  function questionsInView() {
    const { attempt, worksheet, all } = state;
    if (!attempt.first || attempt.second || all) return worksheet.questions;
    return worksheet.questions.filter(q => isRequired(q) || selfCheckQuestion(q));
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
    if (usesWordDictation() && isDictation(state.worksheet, question)) {
      return words.complete(question, state.attempt.wordDictation);
    }
    const written = isAnswered(question, state.attempt.draft[question.id]);
    if (!recordings.isSpeaking(question)) return written;
    const clip = state.attempt.draftRecordings?.[question.id] || state.attempt.first?.recordings?.[question.id];
    return Boolean(clip && (question.type === "open" || written));
  }

  function isRequired(question) {
    const first = state.attempt.first;
    if (first && usesWordDictation() && isDictation(state.worksheet, question)) return false;
    return !first || (question.type !== "open" && first.results[question.id] !== "correct");
  }

  function selfCheckQuestion(question) {
    return question.type === "open" || recordings.isSpeaking(question);
  }

  function review() {
    const { worksheet } = state;
    const check = worksheet.questions.some(selfCheckQuestion);
    const correction = worksheet.questions.some(isRequired);
    const detail = !check ? "" : worksheet.code[0] === "S"
      ? "回听录音，想一想是否答到题目要求。可以沿用录音或主动重录。"
      : "回读自己的答案，想一想是否答到题目要求。可以保留原稿或主动修改。";
    return { check, correction, detail };
  }

  function progress() {
    const { worksheet, attempt } = state;
    if (attempt.second) {
      const stats = report.summary(worksheet.questions, attempt);
      if (!stats.objective) return { max: 0, detail: attempt.selfCheckedAt ? "已完成自检。" : "已记录作答。" };
      return { label: "客观题答对", now: stats.second, max: stats.objective,
        detail: "首次 " + stats.first + " / " + stats.objective + "，二次 " + stats.second + " / " + stats.objective +
          (usesWordDictation() ? "（听写按完整拼写计）" : "") };
    }
    if (attempt.first) {
      const wrong = worksheet.questions.filter(isRequired);
      return { label: "已填写订正", now: wrong.filter(hasResponse).length, max: wrong.length, detail: review().detail };
    }
    if (worksheet.code[0] === "S") {
      return { label: "已录音", now: Object.keys(attempt.draftRecordings || {}).length, max: worksheet.questions.length };
    }
    return { label: "已作答", now: worksheet.questions.filter(hasResponse).length, max: worksheet.questions.length };
  }

  function progressHTML(p) {
    if (!p.max) return '<p class="small">' + esc(p.detail || "没有待订正的客观题。") + "</p>";
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
    for (const button of app.querySelectorAll(".question-chip:not([data-dictation-nav])")) {
      const question = state.worksheet.byNumber.get(Number(button.dataset.questionNumber));
      applyQuestionState(button, question, state.attempt, question.number === state.focus, hasResponse(question));
    }
  }

  function mountDownload() {
    const panel = app.querySelector("[data-report-actions]");
    if (!panel) {
      download.clear();
      return;
    }
    const { worksheet, attempt, student } = state;
    const { id, revision, book, unit, audio } = worksheet.unit;
    const key = worksheet.key + ":" + attempt.sequence + ":" + attempt.second.time;
    const wordMode = usesWordDictation();
    download.show(panel, key, () => report.prepare({
      student, title: worksheet.title, attempt, tracks: audio,
      worksheet: { id, revision, book, unit, code: worksheet.code },
      dictationItems: worksheet.dictationItems,
      groupAudio: wordMode ? undefined : worksheet.dictation?.file.replace(/\.mp3$/, "-countdown.mp3"),
      sections: worksheet.sections.map(section => ({ ...section, name: sectionName(section.key) }))
    }));
  }


  function quiz() {
    const { worksheet, attempt } = state;
    const finished = Boolean(attempt.second);
    const correction = Boolean(attempt.first) && !finished;
    const pending = correction ? review() : null;
    const phase = finished ? "已完成" : !pending ? "首次作答"
      : pending.check ? (pending.correction ? "订正和自检" : "自检") : "订正";
    const context = unitLabel(worksheet.unit);
    const title = subjectTitle(worksheet.code);
    const panel = renderWorkbench(worksheet, attempt, {
      current: focusedQuestion(), visible: questionsInView(), all: state.all,
      largePicture: state.largePicture, answered: hasResponse, editable, wordDictation: usesWordDictation()
    });
    return '<div class="quiz-header"><div class="session-top"><div><div class="quiz-location">' +
      '<button type="button" class="text-action subtle-action" data-action="directory">作业目录</button>' +
      '<p class="page-context">' + esc(context) + '</p>' +
      '<button type="button" class="text-action subtle-action" data-action="reset-exercise">重置练习</button>' +
      '</div><div class="session-title"><h1>' + esc(title) +
      '</h1><span class="state-label' + (correction ? " correction" : "") + '">' + phase +
      '</span></div></div><div class="session-tools"><div id="work-progress" class="work-progress" ' +
      'aria-live="polite">' + progressHTML(progress()) + "</div>" +
      (finished ? '<div class="final-actions" data-report-actions></div>' : "") + "</div></div></div>" + panel;
  }

  function navigationPosition() {
    const stops = questionStops(state.worksheet, questionsInView());
    const current = focusedQuestion();
    const index = isDictation(state.worksheet, current)
      ? stops.findIndex(q => isDictation(state.worksheet, q)) : stops.indexOf(current);
    return { stops, index };
  }

  function renderDocks() {
    const working = Boolean(state.worksheet && !state.opening);
    const worksheet = working ? state.worksheet : null;
    const current = working ? focusedQuestion() : null;
    const groupShown = isDictation(worksheet, current);
    dock.hidden = !working;
    const legacyDictation = !usesWordDictation() && worksheet?.dictation ? worksheet : null;
    const firstDictation = Boolean(legacyDictation && !state.attempt.first);
    const replayQuestions = legacyDictation && state.attempt.first && !state.attempt.second
      ? worksheet.questions.filter(q => isDictation(worksheet, q) && editable(q)) : [];
    const playing = dictation.update(legacyDictation, Boolean(legacyDictation && groupShown), firstDictation, replayQuestions);
    listening.update(worksheet, groupShown || playing ? null : current, state.student);
    if (!working) {
      operations.innerHTML = "";
      return;
    }
    const { stops, index } = navigationPosition();
    function step(direction, label, enabled) {
      return '<button type="button" class="button secondary" data-step="' + direction + '"' +
        (enabled ? "" : " disabled") + ">" + label + "</button>";
    }
    const pending = state.attempt.first && !state.attempt.second ? review() : null;
    const submitLabel = !pending ? "首次提交" : pending.check
      ? (pending.correction ? "完成订正和自检" : "完成自检") : "提交订正";
    const actions = state.attempt.second
      ? '<button type="button" class="button secondary" data-action="directory">返回目录</button>'
      : '<button type="button" class="button" data-action="' +
        (state.attempt.first ? "submit-second" : "submit-first") + '"' + (playing ? " disabled" : "") + ">" +
        submitLabel + "</button>";
    const previous = isDictation(worksheet, stops[index - 1]) ? "返回听写" : "上一题";
    operations.innerHTML = '<div class="step-actions">' + step(-1, previous, index > 0) +
      step(1, "下一题", index >= 0 && index < stops.length - 1) + "</div>" + actions;
  }

  function mountWordPanel() {
    const panel = app.querySelector("[data-word-dictation]");
    if (!panel) return;
    const { dictationItems: items, questions } = state.worksheet;
    unmountWordPanel = words.mount(panel, {
      items, read: () => state.attempt.wordDictation,
      draft: item => state.attempt.draft[item.id],
      save: (item, record) => saveAttempt({
        ...state.attempt,
        sequence: state.attempt.sequence + 1,
        wordDictation: { ...state.attempt.wordDictation, [item.id]: record }
      }),
      onProgress: updateProgress,
      onFinish: feedback => {
        const next = questions.find(q => q.number > items.at(-1).number && !isDictation(state.worksheet, q));
        if (!next) return false;
        state.notice = feedback;
        goToQuestion(next.number, true);
        return true;
      }
    });
  }

  function render(scrollTop = false) {
    unmountWordPanel?.();
    unmountWordPanel = null;
    account.innerHTML = identityBar();
    const notice = state.notice ? '<p class="feedback" role="status">' + esc(state.notice) + "</p>" : "";
    const storage = '<p class="feedback" id="storage-note" role="status"' +
      (state.storageWorks ? " hidden" : "") + ">此浏览器无法保存进度。请在当前页面完成作答和导出。</p>";
    let content;
    if (state.opening) content = renderOpening(state.opening);
    else if (state.worksheet) content = quiz();
    else content = directory();
    const working = Boolean(state.worksheet && !state.opening);
    const priorPassage = app.querySelector("#reading-screen");
    if (priorPassage) state.readingOffset = priorPassage.scrollTop;
    const questionOffset = scrollTop ? 0 : app.querySelector("#question-screen")?.scrollTop || 0;
    surface.classList.toggle("in-worksheet", working);
    app.innerHTML = notice + storage + content;
    mountDownload();
    if (working && scrollTop) app.querySelector(".workspace-question .screen-content")?.classList.add("unlock-card-enter");
    mountWordPanel();
    renderDocks();
    hydrateAudio(app);
    syncVoiceControls();
    screens.connect(app);
    const passage = app.querySelector("#reading-screen");
    const question = app.querySelector("#question-screen");
    if (passage) {
      if (passage.dataset.readingArticle !== priorPassage?.dataset.readingArticle) state.readingOffset = 0;
      passage.scrollTop = state.readingOffset;
    }
    if (question) question.scrollTop = questionOffset;
    if (scrollTop) {
      window.scrollTo(0, 0);
      app.focus({ preventScroll: true });
    }
  }

  async function openWorksheet(code, rememberedView = {}) {
    const meta = currentMeta();
    if (!allowsWorksheet(meta, code) || (state.opening && !state.opening.failed)) return;
    const opening = createOpening(meta, code, rememberedView);
    state.opening = opening;
    state.notice = "";
    render(true);
    try {
      const unit = await loadUnit(meta, opening.signal);
      if (opening !== state.opening) return;
      const sheet = { ...unit.sheets[code], key: code };
      const questions = sheet.questions;
      if (!questions?.length) throw new Error("Worksheet unavailable");
      const { baseKey, key, attempt } = worksheetAttempt(meta, code);
      state.worksheet = {
        baseKey, key, code, title: unitLabel(meta) + " " + subjectTitle(code), unit, sheet,
        dictation: window.UNLOCK_DICTATION?.[meta.id]?.[code],
        dictationItems: questions.filter(q => q.kind === "单词听写")
          .map(q => words.makeItem(q.id, q.number, q.keys[0], q.keys)),
        sections: [sheet], questions, byId: new Map(questions.map(q => [q.id, q])),
        byNumber: new Map(questions.map(q => [q.number, q]))
      };
      state.attempt = attempt;
      state.all = Boolean(rememberedView.all);
      state.largePicture = false;
      state.readingOffset = 0;
      pickFocus(rememberedView.focus);
      saveNavigation();
    } catch {
      if (opening === state.opening) {
        opening.failed = true;
        opening.cancel();
        state.worksheet = null;
        state.attempt = null;
      }
    } finally {
      opening.finish();
      if (opening === state.opening) {
        if (!opening.failed) state.opening = null;
        render(true);
        if (opening.failed) app.querySelector('[data-action="retry-open"]')?.focus({ preventScroll: true });
      }
    }
  }

  function backToDirectory() {
    const code = state.worksheet?.code || state.opening?.code;
    state.opening?.cancel();
    state.opening = null;
    state.worksheet = null;
    state.attempt = null;
    state.focus = null;
    state.notice = "";
    saveNavigation();
    render(true);
    if (code) app.querySelector('[data-task="' + code + '"]')?.focus({ preventScroll: true });
  }

  function showAttempt(key, notice = "") {
    state.worksheet.key = key;
    state.attempt = getAttempt(key);
    state.all = false;
    state.largePicture = false;
    state.readingOffset = 0;
    state.notice = notice;
    pickFocus();
    saveNavigation();
    render(true);
  }

  function resetExercise() {
    if (!state.worksheet || voiceJob) return;
    const { key, baseKey } = state.worksheet;
    const current = activeAttemptKey(baseKey);
    if (current !== key) {
      showAttempt(current, "这份练习已在另一个窗口重置。");
      return;
    }
    const token = globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
    const next = attemptRunKey(baseKey, token);
    if (state.storageWorks) {
      try { localStorage.setItem(attemptPointer(baseKey), token); }
      catch { state.storageWorks = false; }
    }
    // Switch to a new attempt key and keep the previous answers and recordings available in storage.
    activeAttempts.set(baseKey, next);
    showAttempt(next);
  }

  function requestReset() {
    if (!state.worksheet || voiceJob) return;
    dictation.pause();
    const message = "练习会回到首次作答，当前答案、提交结果和录音会从作答页面清空。" +
      (state.worksheet.dictationItems.length ? "听写会从第一题开始。" : "");
    const dialog = document.createElement("dialog");
    if (typeof dialog.showModal !== "function") {
      if (window.confirm(message)) resetExercise();
      return;
    }
    dialog.setAttribute("aria-labelledby", "reset-title");
    dialog.setAttribute("aria-describedby", "reset-description");
    dialog.innerHTML = '<h2 id="reset-title">重置练习？</h2><p id="reset-description">' + esc(message) +
      '</p><div class="dialog-actions"><button type="button" class="button secondary" data-action="cancel-reset" autofocus>' +
      '继续作答</button><button type="button" class="button" data-action="confirm-reset">重置练习</button></div>';
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    app.append(dialog);
    dialog.showModal();
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
    const item = document.getElementById("item-" + question.id);
    const field = item?.querySelector("[data-dictation-answer]");
    const wordControl = app.querySelector("[data-wd-play], .wd-review h2");
    (wordControl || field || item)?.focus({ preventScroll: true });
    const activeBlank = field || item?.querySelector(".summary-blank.current input");
    if (activeBlank) screens.reveal(activeBlank);
  }

  function editable(question) {
    return question && state.attempt && !state.attempt.second &&
      !(usesWordDictation() && isDictation(state.worksheet, question)) &&
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

  function capture(draft, clips = {}, round = 0) {
    const answers = {};
    const results = {};
    for (const question of state.worksheet.questions) {
      if (usesWordDictation() && isDictation(state.worksheet, question)) {
        const checked = words.spellingRound(state.attempt.wordDictation?.[question.id], round);
        answers[question.id] = checked?.text ?? "";
        results[question.id] = checked?.result === "correct" ? "correct" : "incorrect";
        continue;
      }
      const value = draft[question.id] ?? (["multi", "order"].includes(question.type) ? [] : "");
      answers[question.id] = Array.isArray(value) ? [...value] : value;
      results[question.id] = judge(question, value);
    }
    return { time: new Date().toISOString(), answers, results, recordings: { ...clips } };
  }

  function needsMoreDictation() {
    if (!usesWordDictation()) return false;
    const missing = state.worksheet.dictationItems.find(item => !words.complete(item, state.attempt.wordDictation));
    if (!missing) return false;
    state.notice = "请完成本组听写后再提交练习。";
    goToQuestion(missing.number, true);
    return true;
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
    if (!state.attempt || state.attempt.first || needsMoreDictation() || needsMoreVoice()) return;
    const first = capture(state.attempt.draft, state.attempt.draftRecordings);
    const remaining = state.worksheet.questions.filter(q =>
      q.type !== "open" && first.results[q.id] !== "correct" &&
      !(usesWordDictation() && isDictation(state.worksheet, q)));
    const draft = {};
    const draftRecordings = { ...first.recordings };
    for (const q of state.worksheet.questions) {
      if (q.type === "open" || first.results[q.id] === "correct") {
        draft[q.id] = first.answers[q.id];
      }
    }
    if (!saveAttempt({ ...state.attempt, sequence: state.attempt.sequence + 1, first, draft, draftRecordings })) return;
    const next = remaining[0] || state.worksheet.questions.find(selfCheckQuestion);
    state.notice = "";
    state.all = false;
    pickFocus(next?.number);
    saveNavigation();
    render(true);
  }

  function requestFirst() {
    if (!state.attempt || state.attempt.first || needsMoreDictation() || needsMoreVoice()) return;
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
    if (!state.attempt?.first || state.attempt.second) return;
    const missing = state.worksheet.questions.find(q => isRequired(q) && !hasResponse(q));
    if (missing) {
      state.notice = "请完成所有待订正的客观题，再次提交。";
      goToQuestion(missing.number, true);
      return;
    }
    const draft = { ...state.attempt.draft };
    const clips = { ...state.attempt.first.recordings, ...state.attempt.draftRecordings };
    for (const question of state.worksheet.questions) {
      if (state.attempt.first.results[question.id] === "correct") {
        draft[question.id] = state.attempt.first.answers[question.id];
      }
    }
    const second = capture(draft, clips, 1);
    const selfCheckedAt = state.worksheet.questions.some(selfCheckQuestion) ? second.time : undefined;
    if (!saveAttempt({
      ...state.attempt, sequence: state.attempt.sequence + 1, second, selfCheckedAt, draft: {}, draftRecordings: {}
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
    if (!state.attempt || state.attempt.second) return;
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
    if (!question || !state.attempt || state.attempt.second || !recordings.isSpeaking(question)) return;
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
    const origin = orderAdd ? button.getBoundingClientRect() : undefined;
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
    const next = Array.from(control.querySelectorAll("button"))
      .find(candidate => candidate.dataset[property] === (orderAdd || orderRemove || part));
    if (next) {
      next.focus({ preventScroll: true });
      screens.reveal(next);
      if (origin) motion.place(next, origin);
    }
  }

  app.addEventListener("input", event => {
    const input = event.target;
    if (!input.matches("input[data-answer],textarea[data-answer]") ||
        (input instanceof HTMLInputElement && input.type !== "text")) return;
    updateAnswer(state.worksheet?.byId.get(input.dataset.answer), input.value);
  });

  app.addEventListener("keydown", event => {
    if (event.key !== "Enter" || event.isComposing || !event.target.matches("[data-dictation-answer]")) return;
    const fields = Array.from(app.querySelectorAll("[data-dictation-answer]"));
    const next = fields[fields.indexOf(event.target) + 1];
    if (!next) return;
    event.preventDefault();
    next.focus({ preventScroll: true });
    screens.reveal(next);
  });

  document.addEventListener("dictation-playback-change", renderDocks);

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
    } else if (d.action === "special") {
      state.unit = specialUnit;
      state.notice = "";
      saveNavigation();
      render();
      app.querySelector('[data-action="special"]')?.focus({ preventScroll: true });
    } else if (d.task) {
      openWorksheet(d.task);
    } else if (d.action === "retry-open" && state.opening?.failed) {
      openWorksheet(state.opening.code, state.opening.view);
    } else if (d.questionNumber) {
      goToQuestion(Number(d.questionNumber));
    } else if (d.step) {
      const { stops, index } = navigationPosition();
      const target = stops[index + Number(d.step)];
      if (target) goToQuestion(target.number);
    } else if (d.orderAdd || d.orderRemove || d.orderShift) {
      changeOrder(button);
    } else if (d.action === "identity") {
      session.signOut();
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
    } else if (d.action === "reset-exercise") requestReset();
    else if (d.action === "confirm-reset") resetExercise();
    else if (d.action === "submit-first") requestFirst();
    else if (d.action === "cancel-submit" || d.action === "cancel-reset") button.closest("dialog").close();
    else if (d.action === "confirm-submit") commitFirst();
    else if (d.action === "submit-second") commitSecond();
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
    const worksheet = state.worksheet;
    if (voiceJob || !worksheet) return;
    if (event.key === attemptPointer(worksheet.baseKey)) {
      const key = activeAttemptKey(worksheet.baseKey);
      if (key !== worksheet.key) showAttempt(key, "这份练习已在另一个窗口重置。");
      return;
    }
    if (event.key !== worksheet.key) return;
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
      if (!current?.student || ![student.name, student.storageName].includes(current.student)) return;
      if (findMeta(books[student.level], current.unit)) state.unit = current.unit;
      if (current.code) openWorksheet(current.code, current);
    } catch {}
  }


  restore();
  render();
})();
