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
  const { label, setLabel } = window.UnlockStudentUI;
  const resetNotice = label("This exercise was reset in another window.", "这份练习已在另一个窗口重置。");
  const { isAnswered, judge, escapeHTML: esc } = window.UnlockRules;
  const { sectionName, renderOrder, voiceHTML } = window.UnlockWorksheet;
  const { render: renderWorkbench, applyQuestionState, isDictation, questionStops } = window.UnlockWorkbench;
  const { specialUnit, findMeta, allowsWorksheet, unitLabel, subjectTitle, renderDirectory,
    createOpening, renderOpening, renderDirectoryBack, loadUnit } = window.UnlockPracticeCatalog;
  const classroomVocabulary = window.UnlockClassroomVocabulary;
  const homeworkVocabulary = window.UnlockHomeworkVocabulary;
  const readingBeta = window.UnlockReadingBeta;
  const listening = window.UnlockListening;
  const dictation = window.UnlockDictation;
  const words = window.UnlockWordDictation;
  const homeworkDictation = window.UnlockHomeworkDictation;
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
  const assignedBook = { L1: 2, L2: 3 }[student.level];
  const availableBooks = [...readingBeta.extraBooks, ...(assignedBook ? [assignedBook] : [])]
    .sort((a, b) => a - b);
  const remembered = "unlock.practice.navigation.v5";
  const cache = new Map();
  const activeAttempts = new Map();
  let voiceJob = null;
  let unmountWordPanel = null;
  let homeworkPanel = null;

  const state = {
    student, book: assignedBook ?? availableBooks[0], unit: 1, worksheet: null, attempt: null, focus: null,
    all: false, readingOffset: 0, largePicture: false, homeworkView: false,
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
    const revision = readingBeta.revision(meta, code);
    return "unlock.practice.subject.v1:" + userKey(revision ? { ...meta, revision } : meta) + ":" + code;
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
      showAttempt(active, resetNotice);
      return false;
    }
    if (state.worksheet.vocabularyQuestions.length && !next.classroomVocabularyVersion) {
      next = { ...next, classroomVocabularyVersion: state.worksheet.vocabularyVersion };
    }
    if (state.storageWorks) {
      try {
        const latest = storedAttempt(key) || newAttempt();
        if (latest.sequence !== state.attempt.sequence) {
          showStoredAttempt(latest, { focus: state.focus,
            notice: label("The latest responses from another window have loaded.", "这个练习已在另一个窗口更新。已载入最新作答。") });
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
    const attempt = readingBeta.revision(meta, code) || key !== baseKey || saved.sequence || meta.unit === specialUnit
      ? saved : fromLegacy(meta, code);
    return { baseKey, key, attempt };
  }

  function saveNavigation() {
    try {
      sessionStorage.setItem(remembered, JSON.stringify({
        student: state.student?.name, book: state.book, unit: state.unit, code: state.worksheet?.code,
        focus: state.focus, all: state.all, homeworkView: state.homeworkView
      }));
    } catch {}
  }

  function currentMeta() {
    return findMeta(state.book, state.unit);
  }

  function status(attempt, code) {
    if (attempt.second) return { name: "已完成", english: "Completed", style: "finished" };
    if (attempt.first) {
      const entries = Object.entries(attempt.first.results);
      const check = code[0] === "S" || entries.some(([, result]) => result === "ungraded");
      const correct = entries.some(([id, result]) =>
        (result === "incorrect" || result === "blank") && !attempt.wordDictation?.[id]);
      return check && !correct
        ? { name: "待自检", english: "Self-Check", style: "correction" }
        : { name: "待订正", english: "Needs Correction", style: "correction" };
    }
    if (Object.keys(attempt.draft).length || Object.keys(attempt.draftRecordings || {}).length ||
        Object.keys(attempt.wordDictation || {}).length || attempt.homeworkVocabulary) {
      return { name: "作答中", english: "In Progress", style: "in-progress" };
    }
    return { name: "未开始", english: "Not Started", style: "" };
  }

  function identityBar() {
    const student = state.student;
    return '<div class="identity-info"><strong>' + esc(student.name) +
      '</strong><span>' + esc(student.level) + '</span><span class="class-label">' +
      esc(student.adminClass) + '</span></div>';
  }

  function directory() {
    const meta = currentMeta();
    if (!meta) return '<section class="empty-state panel"><h1>' + label("Practice Unavailable", "练习暂未开放") +
      "</h1><p>" + label("No unit practice for " + state.student.level + " yet.", state.student.level + " 暂未开放单元练习。") + "</p></section>";
    return renderDirectory(meta, code => status(worksheetAttempt(meta, code).attempt, code), availableBooks);
  }


  function usesWordDictation() {
    const { worksheet, attempt } = state;
    return Boolean(worksheet?.dictationItems.length && (!attempt.first || attempt.wordDictation));
  }

  function selectedVocabularyVersion(attempt, unit, code) {
    const version = homeworkVocabulary.versionFor(unit, code, attempt);
    if (unit.readingOnly) return version;
    return version ??
      (attempt.first && !attempt.classroomVocabulary ? null : classroomVocabulary.versionFor(attempt));
  }

  function homeworkProgress() {
    return homeworkVocabulary.progress(state.worksheet.homeworkBank, state.attempt.homeworkVocabulary);
  }

  function saveHomeworkProgress(next) {
    const before = progress();
    const wasDone = homeworkProgress().done;
    if (!saveAttempt({ ...state.attempt, sequence: state.attempt.sequence + 1, homeworkVocabulary: next })) return false;
    const after = progress();
    if (before.now !== after.now || wasDone !== next.done) updateProgress();
    return true;
  }

  function showHomeworkVocabulary(show) {
    const { worksheet } = state;
    if (!worksheet?.homeworkBank || (!show && !homeworkProgress().done)) return;
    if (state.homeworkView === show) return;
    state.homeworkView = show;
    state.notice = "";
    if (!show) pickFocus(state.focus);
    saveNavigation();
    render(true);
    const target = show ? app.querySelector("[data-hw-heading]") : document.getElementById("item-" + state.focus);
    target?.focus({ preventScroll: true });
  }

  function configureAttempt(attempt) {
    const worksheet = state.worksheet;
    state.attempt = attempt;
    // Vocabulary answers and recordings stay bound to the questions shown for that attempt.
    worksheet.vocabularyVersion = selectedVocabularyVersion(attempt, worksheet.unit, worksheet.code);
    const version = worksheet.vocabularyVersion;
    worksheet.homeworkBank = typeof version === "string" ? worksheet.vocabularySections[version] : null;
    state.homeworkView = Boolean(worksheet.homeworkBank && (state.homeworkView || !homeworkProgress().done));
    const prefix = version === null || worksheet.homeworkBank ? [] : worksheet.vocabularySections[version];
    worksheet.vocabularyQuestions = prefix.flatMap(section => section.questions);
    const homework = worksheet.homeworkBank || worksheet.unit.readingOnly
      ? null : homeworkDictation.plan(worksheet.unit, worksheet.code, attempt, worksheet.lessonData);
    worksheet.homework = homework;
    worksheet.dictationItems = homework?.questions || worksheet.originalDictationItems;
    const sections = [worksheet.sheet];
    if (homework) sections.push({ name: "词汇听写和中文义", questions: homework.questions });
    const numbered = [...(homework?.questions || []), ...worksheet.sheet.questions];
    worksheet.byNumber = new Map(numbered.map(question => [question.number, question]));
    worksheet.sections = [...prefix, ...sections];
    worksheet.questions = [...(homework?.questions || []), ...worksheet.vocabularyQuestions, ...worksheet.sheet.questions];
    worksheet.byId = new Map(worksheet.questions.map(question => [question.id, question]));
  }

  function unfinishedVocabulary() {
    if (state.attempt.first) return undefined;
    return state.worksheet.vocabularyQuestions.find(question => !hasResponse(question));
  }

  function homeworkDictationPending() {
    const { worksheet, attempt } = state;
    return Boolean(worksheet?.homework && attempt && !attempt.first &&
      worksheet.homework.questions.some(item => !words.complete(item, attempt.wordDictation)));
  }

  function questionsInView() {
    const { attempt, worksheet, all } = state;
    if (homeworkDictationPending()) return worksheet.homework.questions;
    const pendingVocabulary = unfinishedVocabulary();
    if (pendingVocabulary) {
      return worksheet.vocabularyQuestions.slice(0, worksheet.vocabularyQuestions.indexOf(pendingVocabulary) + 1);
    }
    if (!attempt.first || attempt.second || all) return worksheet.questions;
    return worksheet.questions.filter(q => isRequired(q) || selfCheckQuestion(q));
  }

  function focusedQuestion() {
    return state.worksheet?.byId.get(state.focus);
  }

  function pickFocus(id) {
    const visible = questionsInView();
    const preferred = visible.find(q => q.id === id);
    const pendingVocabulary = homeworkDictationPending() ? null : unfinishedVocabulary();
    const next = visible.find(q => !q.homeworkDictation) || visible[0];
    state.focus = (preferred || pendingVocabulary || next)?.id ?? null;
  }

  function hasResponse(question) {
    if (usesWordDictation() && isDictation(state.worksheet, question)) {
      return words.complete(question, state.attempt.wordDictation);
    }
    const written = isAnswered(question, state.attempt.draft[question.id]);
    if (!recordings.requiresRecording(question)) return written;
    const clip = state.attempt.draftRecordings?.[question.id] || state.attempt.first?.recordings?.[question.id];
    return Boolean(clip && (question.type === "open" || written));
  }

  function isRequired(question) {
    const first = state.attempt.first;
    if (first && usesWordDictation() && isDictation(state.worksheet, question)) return false;
    return !first || (question.type !== "open" && first.results[question.id] !== "correct");
  }

  function selfCheckQuestion(question) {
    return question.type === "open" || recordings.requiresRecording(question);
  }

  function review() {
    const { worksheet } = state;
    const voice = worksheet.questions.some(recordings.requiresRecording);
    const writing = worksheet.questions.some(q => q.type === "open" && !recordings.requiresRecording(q));
    const correction = worksheet.questions.some(isRequired);
    let detail = "";
    if (voice && writing) {
      detail = label("Listen back to your recordings and reread your answers. You can keep them or revise them.",
        "回听自己的录音，也回读开放题的回答。可以保留作答，也可以重录或修改。");
    } else if (voice) {
      detail = label("Listen back to your recordings. You can keep them or record again.",
        "回听自己的录音。可以沿用录音，也可以主动重录。");
    } else if (writing) {
      detail = label("Reread your answer and check whether it addresses the question. You can keep it or revise it.",
        "回读自己的答案，想一想是否答到题目要求。可以保留原稿或主动修改。");
    }
    return { check: voice || writing, correction, detail };
  }

  function isHomework(code) {
    return /^[LSRW]_H[123]$/.test(code);
  }

  function isVocabularyQuestion(question) {
    return Boolean(question?.vocabulary || question?.homeworkDictation);
  }

  function assignmentStageTarget(visible, vocabulary) {
    return vocabulary
      ? visible.find(question => question.vocabulary) || visible.find(question => question.homeworkDictation)
      : visible.find(question => !isVocabularyQuestion(question));
  }

  function assignmentTabs(visible, current) {
    const { worksheet } = state;
    if (!worksheet.homeworkBank && !worksheet.vocabularyQuestions.length && !worksheet.homework) return "";
    const activeVocabulary = worksheet.homeworkBank ? state.homeworkView : isVocabularyQuestion(current);
    function tab(key, english, chinese, vocabulary) {
      const target = assignmentStageTarget(visible, vocabulary);
      const active = activeVocabulary === vocabulary;
      const destination = worksheet.homeworkBank ? (vocabulary || homeworkProgress().done ? "" : " disabled")
        : target ? (active ? "" : ' data-question-id="' + esc(target.id) + '"') : " disabled";
      return '<button type="button" class="question-chip" data-assignment-stage="' + key + '"' +
        (active ? ' aria-current="step"' : "") + destination + ">" + label(english, chinese) + "</button>";
    }
    return '<nav class="assignment-tabs" aria-label="Assignment stages 作业阶段">' +
      tab("vocabulary", "Vocabulary", "词汇学练", true) +
      tab("questions", "Questions", "学科题", false) + "</nav>";
  }

  function syncAssignmentTabs() {
    const tabs = app.querySelector(".assignment-tabs");
    if (!tabs) return;
    if (state.worksheet.homeworkBank) {
      tabs.querySelector('[data-assignment-stage="questions"]').disabled = !homeworkProgress().done;
      return;
    }
    const visible = questionsInView();
    for (const button of tabs.querySelectorAll("button")) {
      const target = assignmentStageTarget(visible, button.dataset.assignmentStage === "vocabulary");
      button.disabled = !target;
      if (target && !button.hasAttribute("aria-current")) button.dataset.questionId = target.id;
      else button.removeAttribute("data-question-id");
    }
  }

  function progress() {
    const { worksheet, attempt } = state;
    if (state.homeworkView) return homeworkVocabulary.meter(worksheet.homeworkBank, homeworkProgress());
    if (attempt.second) {
      const stats = report.summary(worksheet.questions, attempt);
      if (!stats.objective) return { max: 0, detail: attempt.selfCheckedAt
        ? label("Self-check complete.", "已完成自检。") : label("Responses saved.", "已记录作答。") };
      const first = stats.first + " / " + stats.objective;
      const second = stats.second + " / " + stats.objective;
      const dictationNote = usesWordDictation() && !worksheet.homework;
      return { name: "客观题答对", english: "Objective Items Correct", now: stats.second, max: stats.objective,
        detail: label("First " + first + ", second " + second + (dictationNote ? " (full spellings count)" : ""),
          "首次 " + first + "，二次 " + second + (dictationNote ? "（听写按完整拼写计）" : "")) };
    }
    if (attempt.first) {
      const wrong = worksheet.questions.filter(isRequired);
      return { name: "已填写订正", english: "Corrections Entered", now: wrong.filter(hasResponse).length, max: wrong.length, detail: review().detail };
    }
    if (isHomework(worksheet.code) && (worksheet.homeworkBank || worksheet.vocabularyQuestions.length || worksheet.homework)) {
      const current = focusedQuestion();
      let items = worksheet.sheet.questions;
      if (current?.vocabulary) {
        items = worksheet.vocabularyQuestions.filter(question => question.vocabulary.stage === current.vocabulary.stage);
      } else if (current?.homeworkDictation) {
        items = worksheet.homework.questions;
      }
      return { name: "已完成", english: "Completed", now: items.filter(hasResponse).length, max: items.length };
    }
    if (worksheet.code[0] === "S" && !worksheet.vocabularyQuestions.length) {
      return { name: "已录音", english: "Recordings", now: Object.keys(attempt.draftRecordings || {}).length, max: worksheet.questions.length };
    }
    return { name: "已作答", english: "Answered", now: worksheet.questions.filter(hasResponse).length, max: worksheet.questions.length };
  }

  function progressDetail(p) {
    return p.detail || (p.max ? "" : label("No objective items to correct.", "没有待订正的客观题。"));
  }

  function progressHTML(p, compact = false) {
    if (!p.max) return compact ? "" : '<p class="small">' + progressDetail(p) + "</p>";
    const percent = Math.round(p.now / p.max * 100);
    return '<div class="work-progress-line">' + label(p.english, p.name) + '<strong>' + p.now + " / " +
      p.max + '</strong></div><div class="work-meter" role="progressbar" aria-label="' + esc(p.english) +
      '" aria-valuenow="' + p.now + '" aria-valuemin="0" aria-valuemax="' + (p.max || 1) +
      '"><span style="width:' + percent + '%"></span></div>' +
      (!compact && p.detail ? '<p class="small progress-detail">' + p.detail + "</p>" : "");
  }

  function updateProgress() {
    const meter = document.getElementById("work-progress");
    if (meter) {
      const stats = progress();
      const detail = document.getElementById("assignment-progress-detail");
      meter.innerHTML = progressHTML(stats, Boolean(detail));
      if (detail) {
        const text = progressDetail(stats);
        detail.innerHTML = text;
        detail.hidden = !text;
      }
    }
    syncAssignmentTabs();
    const storage = document.getElementById("storage-note");
    if (storage) storage.hidden = state.storageWorks;
    for (const button of app.querySelectorAll(".question-chip[data-question-number]:not([data-dictation-nav])")) {
      const question = state.worksheet.byNumber.get(Number(button.dataset.questionNumber));
      applyQuestionState(button, question, state.attempt, question.id === state.focus, hasResponse(question));
    }
    if (focusedQuestion()?.vocabulary && !state.attempt.first) renderDocks();
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
      sections: worksheet.sections.map(section => ({ ...section, name: section.name ?? sectionName(section.key) })),
      homeworkVocabulary: worksheet.homeworkBank ? { bank: worksheet.homeworkBank, saved: homeworkProgress() } : null
    }));
  }


  function quiz() {
    const { worksheet, attempt } = state;
    const finished = Boolean(attempt.second);
    const correction = Boolean(attempt.first) && !finished;
    const pending = correction ? review() : null;
    const phase = finished ? label("Completed", "已完成") : !pending ? label("First Attempt", "首次作答")
      : pending.check ? (pending.correction ? label("Correction and Self-Check", "订正和自检")
        : label("Self-Check", "自检")) : label("Correction", "订正");
    const context = worksheet.unit.unit === specialUnit
      ? label("Book " + worksheet.unit.book + " Midterm Practice", "期中特别练习") : esc(unitLabel(worksheet.unit));
    const title = subjectTitle(worksheet.code);
    const current = focusedQuestion();
    const visible = questionsInView();
    const stats = progress();
    const panel = state.homeworkView ? '<section class="hw-vocab-shell" data-homework-vocabulary aria-label="词汇学练"></section>'
      : renderWorkbench(worksheet, attempt, {
      current, visible, all: state.all, largePicture: state.largePicture,
      answered: hasResponse, editable, wordDictation: usesWordDictation()
    });
    const reset = '<button type="button" class="text-action subtle-action" data-action="reset-exercise">' +
      label("Reset Exercise", "重置练习") + "</button>";
    const phaseLabel = '<span class="state-label' + (correction ? " correction" : "") + '">' + phase + "</span>";
    const reportActions = finished && !state.homeworkView ? '<div class="final-actions" data-report-actions></div>' : "";
    if (isHomework(worksheet.code)) {
      const vocabularyStage = state.homeworkView || (!attempt.first && isVocabularyQuestion(current));
      const homework = worksheet.homeworkBank ? " homework-header" : "";
      const detail = progressDetail(stats);
      return '<div class="quiz-header assignment-header' + homework + (vocabularyStage ? " is-vocabulary" : "") + '">' +
        '<div class="assignment-identity">' + renderDirectoryBack() +
        '<div class="assignment-title"><h1>' + esc(title) + '</h1><p class="page-context">' + context + '</p></div></div>' +
        assignmentTabs(visible, current) +
        (homework ? '<div class="assignment-phase">' + phaseLabel + '</div>' : "") +
        '<div id="work-progress" class="work-progress" aria-live="polite">' + progressHTML(stats, true) + '</div>' +
        '<div class="assignment-actions"><button type="button" class="ui-nav assignment-more" data-header-more ' +
        'aria-expanded="false" aria-controls="assignment-action-list">' + label("More", "更多") +
        '</button><div class="assignment-action-list" id="assignment-action-list">' + (homework ? "" : phaseLabel) + reset +
        '</div></div></div><p class="feedback assignment-progress-detail" id="assignment-progress-detail" role="status"' +
        (detail ? "" : " hidden") + ">" + detail + "</p>" + reportActions + panel;
    }
    return '<div class="quiz-header"><div class="session-top"><div><div class="quiz-location">' +
      renderDirectoryBack() + '<p class="page-context">' + context + '</p>' + reset +
      '</div><div class="session-title"><h1>' + esc(title) + '</h1>' + phaseLabel +
      '</div></div><div class="session-tools"><div id="work-progress" class="work-progress" ' +
      'aria-live="polite">' + progressHTML(stats) + "</div>" + reportActions + "</div></div></div>" + panel;
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
    const doingHomeworkDictation = working && homeworkDictationPending();
    dock.hidden = !working || doingHomeworkDictation || state.homeworkView;
    const legacyDictation = !state.homeworkView && !usesWordDictation() && worksheet?.dictation ? worksheet : null;
    const firstDictation = Boolean(legacyDictation && !state.attempt.first);
    const replayQuestions = legacyDictation && state.attempt.first && !state.attempt.second
      ? worksheet.questions.filter(q => isDictation(worksheet, q) && editable(q)).map(question => {
        const item = worksheet.dictationItems.find(term => term.id === question.id);
        return item ? { ...question, dictationAudio: words.audioPath(item) } : question;
      }) : [];
    const playing = dictation.update(legacyDictation, Boolean(legacyDictation && groupShown), firstDictation, replayQuestions);
    listening.update(worksheet, state.homeworkView || groupShown || playing ? null : current, state.student);
    if (!working || doingHomeworkDictation || state.homeworkView) {
      operations.innerHTML = "";
      return;
    }
    const { stops, index } = navigationPosition();
    function step(direction, name, enabled) {
      return '<button type="button" class="button secondary ui-action" data-step="' + direction + '"' +
        (enabled ? "" : " disabled") + ">" + name + "</button>";
    }
    const pending = state.attempt.first && !state.attempt.second ? review() : null;
    const submitLabel = !pending ? label("Submit", "首次提交") : pending.check
      ? (pending.correction ? label("Finish Review", "完成订正和自检") : label("Finish Self-Check", "完成自检"))
      : label("Submit Corrections", "提交订正");
    const doingVocabulary = current?.vocabulary && !state.attempt.first;
    const actions = state.attempt.second || doingVocabulary ? "" : '<button type="button" class="button ui-action ui-primary" data-action="' +
        (state.attempt.first ? "submit-second" : "submit-first") + '"' + (playing ? " disabled" : "") + ">" +
        submitLabel + "</button>";
    const previous = isDictation(worksheet, stops[index - 1]) ? label("Back to Dictation", "返回听写") : label("Previous", "上一题");
    operations.innerHTML = '<div class="step-actions">' + step(-1, previous, index > 0) +
      step(1, label("Next", "下一题"), index >= 0 && index < stops.length - 1) + "</div>" + actions;
  }

  function mountWordPanel() {
    const panel = app.querySelector("[data-word-dictation]");
    if (!panel) return;
    const { dictationItems: items, sheet } = state.worksheet;
    unmountWordPanel = words.mount(panel, {
      items, read: () => state.attempt.wordDictation,
      draft: item => state.attempt.draft[item.id],
      save: (item, record) => saveAttempt({
        ...state.attempt,
        ...(state.worksheet.homework ? {
          homeworkDictationSeed: state.worksheet.homework.seed,
          homeworkDictationLayout: state.worksheet.homework.layout
        } : {}),
        sequence: state.attempt.sequence + 1,
        wordDictation: { ...state.attempt.wordDictation, [item.id]: record }
      }),
      onProgress: updateProgress,
      onFinish: (feedback, english, answer) => {
        const next = state.worksheet.homework
          ? unfinishedVocabulary() || questionsInView().find(q => !isDictation(state.worksheet, q))
          : sheet.questions.find(q => q.number > items[items.length - 1].number && !isDictation(state.worksheet, q));
        if (!next) return false;
        state.notice = '<span class="wd-a11y">' + label(english, feedback) + '</span>' + answer;
        goToQuestion(next.id, { keepNotice: true });
        return true;
      }
    });
  }

  function render(scrollTop = false) {
    homeworkPanel?.dispose();
    homeworkPanel = null;
    unmountWordPanel?.();
    unmountWordPanel = null;
    account.innerHTML = identityBar();
    const notice = state.notice ? '<p class="feedback" role="status">' + state.notice + "</p>" : "";
    const storage = '<p class="feedback" id="storage-note" role="status"' +
      (state.storageWorks ? " hidden" : "") + ">" +
      label("This browser cannot save your progress. Finish and export your work on this page.",
        "此浏览器无法保存进度。请在当前页面完成作答和导出。") + "</p>";
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
    const vocabulary = app.querySelector("[data-homework-vocabulary]");
    if (vocabulary) {
      homeworkPanel = homeworkVocabulary.mount(vocabulary, {
        bank: state.worksheet.homeworkBank, read: homeworkProgress, save: saveHomeworkProgress,
        onFinish: () => showHomeworkVocabulary(false), readonly: Boolean(state.attempt.first)
      });
    }
    renderDocks();
    hydrateAudio(app);
    syncVoiceControls();
    screens.connect(app);
    const activeChip = app.querySelector(".question-chips .question-chip[aria-current=step]");
    if (activeChip) {
      const rail = activeChip.parentElement;
      const bounds = rail.getBoundingClientRect();
      const chip = activeChip.getBoundingClientRect();
      if (chip.right > bounds.right) rail.scrollLeft += chip.right - bounds.right + 2;
    }
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

  async function openWorksheet(code, rememberedView = {}, notice = "") {
    const meta = currentMeta();
    if (!allowsWorksheet(meta, code) || (state.opening && !state.opening.failed)) return;
    const opening = createOpening(meta, code, rememberedView);
    state.opening = opening;
    state.notice = notice;
    render(true);
    try {
      const vocabularySections = {};
      const lessonDataPromise = meta.readingOnly
        ? Promise.resolve(null) : window.UnlockPracticeLessonData.load(meta, code, opening.signal);
      const unitPromise = readingBeta.revision(meta, code)
        ? readingBeta.loadUnit(meta, opening.signal) : loadUnit(meta, opening.signal);
      async function loadVocabulary(version) {
        if (version === null) return;
        try {
          vocabularySections[version] = typeof version === "string"
            ? await homeworkVocabulary.load(meta, code, version, opening.signal)
            : await classroomVocabulary.load(meta, code, opening.signal, version, lessonDataPromise);
        } catch (error) {
          const activeVersion = selectedVocabularyVersion(worksheetAttempt(meta, code).attempt, meta, code);
          if (opening.signal.aborted || version === activeVersion) throw error;
        }
      }
      let saved = worksheetAttempt(meta, code);
      const [unit, lessonData] = await Promise.all([
        unitPromise,
        lessonDataPromise,
        loadVocabulary(selectedVocabularyVersion(saved.attempt, meta, code))
      ]);
      // Another tab can reset the exercise while its resources are loading.
      while (opening === state.opening) {
        saved = worksheetAttempt(meta, code);
        const version = selectedVocabularyVersion(saved.attempt, meta, code);
        if (version === null || vocabularySections[version]) break;
        await loadVocabulary(version);
      }
      if (opening !== state.opening) return;
      const sheet = { ...unit.sheets[code], key: code };
      const questions = sheet.questions;
      if (!questions?.length) throw new Error("Worksheet unavailable");
      const { baseKey, key, attempt } = saved;
      state.worksheet = {
        baseKey, key, code, title: unitLabel(meta) + " " + subjectTitle(code), unit, sheet,
        dictation: window.UNLOCK_DICTATION?.[meta.id]?.[code],
        originalDictationItems: questions.filter(q => q.kind === "单词听写")
          .map(q => words.makeItem(q.id, q.number, q.keys[0], q.keys)),
        vocabularySections, lessonData
      };
      state.homeworkView = Boolean(rememberedView.homeworkView);
      configureAttempt(attempt);
      state.all = Boolean(rememberedView.all);
      state.largePicture = false;
      state.readingOffset = 0;
      const focus = rememberedView.focus;
      pickFocus(typeof focus === "number" ? state.worksheet.byNumber.get(focus)?.id : focus);
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
    state.homeworkView = false;
    state.notice = "";
    saveNavigation();
    render(true);
    const task = code && app.querySelector('[data-task="' + code + '"]');
    if (task) {
      task.focus({ preventScroll: true });
      task.scrollIntoView({ block: "nearest" });
    }
  }

  function showStoredAttempt(attempt, { notice, focus, scrollTop = false }) {
    const { code, unit, vocabularySections } = state.worksheet;
    const version = selectedVocabularyVersion(attempt, unit, code);
    if (version !== null && !vocabularySections[version]) {
      openWorksheet(code, { focus, all: state.all, homeworkView: state.homeworkView }, notice);
      return;
    }
    configureAttempt(attempt);
    state.notice = notice;
    pickFocus(focus);
    if (scrollTop) saveNavigation();
    render(scrollTop);
  }

  function showAttempt(key, notice = "") {
    state.worksheet.key = key;
    state.homeworkView = false;
    state.all = false;
    state.largePicture = false;
    state.readingOffset = 0;
    showStoredAttempt(getAttempt(key), { notice, scrollTop: true });
  }

  function resetExercise() {
    if (!state.worksheet || voiceJob) return;
    const { key, baseKey } = state.worksheet;
    const current = activeAttemptKey(baseKey);
    if (current !== key) {
      showAttempt(current, resetNotice);
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
    const english = "The exercise will restart and clear the current answers and recordings from this page." +
      (state.worksheet.dictationItems.length ? " Dictation starts at the first word." : "");
    dialog.innerHTML = '<h2 id="reset-title">' + label("Reset This Exercise?", "重置练习？") +
      '</h2><p id="reset-description">' + label(english, message) +
      '</p><div class="dialog-actions"><button type="button" class="button secondary ui-action" data-action="cancel-reset" autofocus>' +
      label("Continue", "继续作答") + '</button><button type="button" class="button ui-action ui-primary" data-action="confirm-reset">' +
      label("Reset Exercise", "重置练习") + '</button></div>';
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    app.append(dialog);
    dialog.showModal();
  }

  function goToQuestion(id, { keepNotice = false, focusBlank = false } = {}) {
    const question = state.worksheet?.byId.get(id);
    if (!question) return;
    if (!questionsInView().includes(question)) {
      if (!state.attempt.first) return;
      state.all = true;
    }
    if (!keepNotice) state.notice = "";
    if (focusedQuestion()?.picture !== question.picture) state.largePicture = false;
    state.focus = id;
    saveNavigation();
    render(true);
    const item = document.getElementById("item-" + question.id);
    const field = item?.querySelector("[data-dictation-answer]");
    const wordControl = app.querySelector("[data-wd-play], .wd-meaning-question #wd-heading, .wd-review h2");
    const activeBlank = field || item?.querySelector(".summary-blank.current input");
    (wordControl || (focusBlank ? activeBlank : field) || item)?.focus({ preventScroll: true });
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
    const legacyDictationKeys = {};
    for (const question of state.worksheet.questions) {
      if (usesWordDictation() && isDictation(state.worksheet, question)) {
        const checked = words.spellingRound(state.attempt.wordDictation?.[question.id], round);
        answers[question.id] = checked?.text ?? "";
        results[question.id] = checked?.result === "correct" ? "correct" : "incorrect";
        continue;
      }
      const value = draft[question.id] ?? (["multi", "order"].includes(question.type) ? [] : "");
      answers[question.id] = Array.isArray(value) ? [...value] : value;
      if (round && isDictation(state.worksheet, question)) {
        const item = state.worksheet.dictationItems.find(term => term.id === question.id);
        if (item?.locale === "en-GB" && state.attempt.first.results[question.id] !== "correct") {
          legacyDictationKeys[question.id] = item.keys;
          results[question.id] = judge({ ...question, keys: item.keys }, value);
          continue;
        }
      }
      results[question.id] = judge(question, value);
    }
    return { time: new Date().toISOString(), answers, results, recordings: { ...clips },
      ...(Object.keys(legacyDictationKeys).length ? { legacyDictationKeys } : {}) };
  }

  function needsMoreDictation() {
    if (!usesWordDictation()) return false;
    const missing = state.worksheet.dictationItems.find(item => !words.complete(item, state.attempt.wordDictation));
    if (!missing) return false;
    state.notice = state.worksheet.homework
      ? label("Finish the dictation and Chinese meanings before submitting.", "请完成词汇听写和中文义选择后再提交。")
      : label("Finish the dictation before submitting.", "请完成本组听写后再提交练习。");
    goToQuestion(missing.id, { keepNotice: true });
    return true;
  }

  function needsMoreVocabulary() {
    if (state.worksheet.homeworkBank && !homeworkProgress().done) {
      showHomeworkVocabulary(true);
      return true;
    }
    const pending = unfinishedVocabulary();
    if (!pending) return false;
    state.notice = label("Finish the vocabulary practice before submitting.", "请先完成课堂词汇学练。");
    goToQuestion(pending.id, { keepNotice: true });
    return true;
  }

  function needsMoreVoice() {
    const missing = state.worksheet.questions.filter(question => recordings.requiresRecording(question) &&
      !state.attempt.draftRecordings?.[question.id]);
    if (!missing.length) return false;
    state.notice = label("Record the remaining " + missing.length + " speaking responses before submitting.",
      "还有 " + missing.length + " 道口语题需要录音。请录完后提交。");
    goToQuestion(missing[0].id, { keepNotice: true });
    return true;
  }

  function commitFirst() {
    if (!state.attempt || state.attempt.first || needsMoreDictation() || needsMoreVocabulary() || needsMoreVoice()) return;
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
    const classroomVocabulary = Boolean(state.worksheet.vocabularyQuestions.length);
    if (!saveAttempt({
      ...state.attempt, sequence: state.attempt.sequence + 1, first, draft, draftRecordings, classroomVocabulary
    })) return;
    const next = remaining[0] || state.worksheet.questions.find(selfCheckQuestion);
    state.notice = "";
    state.all = false;
    pickFocus(next?.id);
    saveNavigation();
    render(true);
  }

  function requestFirst() {
    if (!state.attempt || state.attempt.first || needsMoreDictation() || needsMoreVocabulary() || needsMoreVoice()) return;
    const missing = state.worksheet.questions.filter(q => !hasResponse(q)).length;
    if (!missing) {
      commitFirst();
      return;
    }

    const dialog = document.createElement("dialog");
    dialog.setAttribute("aria-labelledby", "submit-title");
    dialog.innerHTML = '<h2 id="submit-title">' + label("Unanswered Questions", "还有题目未完成") + '</h2><p>' +
      label(missing + " questions are unanswered. You can keep working or submit now.",
        "有 " + missing + " 道题尚未完成。可以返回作答，也可以按当前内容提交。") +
      '</p><div class="dialog-actions"><button type="button" class="button secondary ui-action" data-action="cancel-submit">' +
      label("Keep Working", "返回作答") + '</button><button type="button" class="button ui-action ui-primary" data-action="confirm-submit">' +
      label("Submit", "提交当前作答") + '</button></div>';
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
      state.notice = label("Finish the required corrections before submitting.", "请完成所有待订正的客观题，再次提交。");
      goToQuestion(missing.id, { keepNotice: true });
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

  const voiceMessages = {
    "请在浏览器提示中允许使用麦克风。": "Allow microphone access when your browser asks.",
    "正在保存录音。": "Saving your recording.",
    "请先结束当前录音，再切换或提交。": "Stop recording before moving on or submitting.",
    "请结束录音后再播放音频。": "Stop recording before playing the audio.",
    "当前浏览器无法保存录音。": "This browser could not save the recording.",
    "请关闭其他练习页面后再试。": "Close other practice tabs and try again.",
    "录音保存失败。请检查设备空间后重录。": "Check your available storage and record again.",
    "这段录音在当前浏览器中无法读取。": "This browser could not open the recording.",
    "录音读取失败。": "The recording could not be opened.",
    "生成随作答单携带的录音失败。": "The recording could not be prepared for export.",
    "请在浏览器里允许访问麦克风，再点击开始录音。": "Allow microphone access in your browser settings and try again.",
    "没有找到麦克风。请连接麦克风后重试。": "Connect a microphone and try again.",
    "麦克风暂时无法使用。请检查设备或关闭正在使用麦克风的程序。": "Check the microphone and close other apps using it.",
    "当前浏览器暂时无法使用麦克风。": "The microphone is unavailable in this browser.",
    "请在支持录音的浏览器中打开 HTTPS 页面或本机预览。": "Use a browser that supports recording over HTTPS or open the local preview.",
    "录音中断，请重录。": "Recording was interrupted. Record again.",
    "没录到有效音频，请重录。": "Record again to capture your response.",
    "设备无法开始录音。请重新打开练习后再试。": "The device could not record. Reopen the exercise and try again.",
    "当前浏览器无法启动录音。": "This browser could not start recording."
  };

  function voiceMessage(id, message) {
    const element = voiceField(id)?.querySelector("[data-voice-message]");
    if (!element) return;
    setLabel(element, message ? voiceMessages[message] || "Recording is unavailable. Try again." : "", message);
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
      const waiting = active && voiceJob.phase === "permission";
      const stopLabel = waiting ? "Cancel" : "Stop Recording";
      if (stop.querySelector(".ui-en")?.textContent !== stopLabel) setLabel(stop, stopLabel, waiting ? "取消" : "结束录音");
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
    if (!question || !state.attempt || state.attempt.second || !recordings.requiresRecording(question)) return;
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


  function closeAssignmentActions() {
    const button = app.querySelector('[data-header-more][aria-expanded="true"]');
    button?.setAttribute("aria-expanded", "false");
    return button;
  }

  document.addEventListener("click", event => {
    if (event.target instanceof Element && !event.target.closest(".assignment-actions, dialog")) {
      closeAssignmentActions();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !app.querySelector("dialog[open]")) closeAssignmentActions()?.focus();
  });

  surface.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.hasAttribute("data-header-more")) {
      button.setAttribute("aria-expanded", String(button.getAttribute("aria-expanded") !== "true"));
      return;
    }
    const d = button.dataset;
    if (homeworkPanel?.busy() && (d.assignmentStage || d.action)) {
      homeworkPanel.focusRecording();
      return;
    }
    if (button.hasAttribute("data-record-start")) { startVoice(button); return; }
    if (button.hasAttribute("data-record-stop")) { stopVoice(); return; }
    if (voiceJob && (d.task || d.unit || d.book || d.questionId || d.questionNumber || d.step || d.action || "vocabularyPlay" in d)) {
      voiceMessage(voiceJob.id, "请先结束当前录音，再切换或提交。");
      voiceField(voiceJob.id)?.querySelector("[data-record-stop]:not([hidden])")?.focus();
      return;
    }
    if (d.assignmentStage && state.worksheet?.homeworkBank) {
      showHomeworkVocabulary(d.assignmentStage === "vocabulary");
    } else if ("vocabularyPlay" in d) {
      const player = button.nextElementSibling;
      const status = button.closest(".word-card-read").querySelector("[data-vocabulary-audio-status]");
      status.hidden = true;
      player.currentTime = 0;
      player.play().catch(() => {
        status.innerHTML = label("Could not play this sample.", "示范音频暂时无法播放。");
        status.hidden = false;
      });
    } else if (d.book) {
      const book = Number(d.book);
      if (!availableBooks.includes(book) || !findMeta(book, 1)) return;
      state.book = book;
      state.unit = 1;
      state.notice = "";
      saveNavigation();
      render();
      app.querySelector('[data-book="' + book + '"]')?.focus({ preventScroll: true });
    } else if (d.unit) {
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
    } else if (d.questionId) {
      goToQuestion(d.questionId);
    } else if (d.questionNumber) {
      const id = state.worksheet?.byNumber.get(Number(d.questionNumber))?.id;
      goToQuestion(id, { focusBlank: button.classList.contains("summary-blank") });
    } else if (d.step) {
      const { stops, index } = navigationPosition();
      const target = stops[index + Number(d.step)];
      if (target) goToQuestion(target.id);
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
    if (voiceJob || homeworkPanel?.busy() || !worksheet || state.opening) return;
    if (event.key === attemptPointer(worksheet.baseKey)) {
      const key = activeAttemptKey(worksheet.baseKey);
      if (key !== worksheet.key) showAttempt(key, resetNotice);
      return;
    }
    if (event.key !== worksheet.key) return;
    const updated = getAttempt(event.key);
    if (updated.sequence !== state.attempt.sequence) {
      showStoredAttempt(updated, { focus: state.focus,
        notice: label("This assignment was updated in another window.", "这份作业已在另一个窗口更新。") });
    }
  });

  function restore() {
    try {
      const current = JSON.parse(sessionStorage.getItem(remembered) || "null");
      if (!current?.student || ![student.name, student.storageName].includes(current.student)) return;
      if (availableBooks.includes(current.book)) state.book = current.book;
      if (findMeta(state.book, current.unit)) state.unit = current.unit;
      if (current.code) openWorksheet(current.code, current);
    } catch {}
  }


  const requested = new URLSearchParams(location.search);
  const linkedBook = Number(requested.get("book"));
  const linkedUnit = Number(requested.get("unit"));
  const linkedCode = requested.get("assignment");
  const linkedMeta = availableBooks.includes(linkedBook) && findMeta(linkedBook, linkedUnit);
  if (linkedCode && allowsWorksheet(linkedMeta, linkedCode)) {
    state.book = linkedBook;
    state.unit = linkedUnit;
    openWorksheet(linkedCode, { homeworkView: true });
  } else restore();
  render();
})();
