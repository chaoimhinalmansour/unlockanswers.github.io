"use strict";

(function () {
  const account = window.UnlockSession;
  const activeSession = account.requireSession("student");
  if (!activeSession) return;
  const student = account.student(activeSession);
  if (!student) {
    account.signOut("student", location.href);
    return;
  }
  const $ = id => document.getElementById(id);
  const { setLabel, topicTranslation } = window.UnlockStudentUI;
  const copy = (id, english, chinese) => setLabel($(id), english, chinese);
  const data = window.UNLOCK_LESSON_DICTATION;
  const previousUnits = window.UNLOCK_CLASSROOM_UNITS.books;
  const playback = window.UnlockDictation;
  const words = window.UnlockWordDictation;
  const preclass = window.UnlockPreclassVocabulary;
  const { buildQuestions } = window.UnlockMeaningChoice;
  const intro = document.querySelector(".intro");
  const { judge } = window.UnlockRules;
  const download = window.UnlockWorkPackage.downloadControl("primary");
  const assignedBooks = { L1: 2, L2: 3 };
  const selectionSession = "unlock.classroom.lesson-selection.v1:" + encodeURIComponent(storageName(student));
  const trackNames = { LS: "听说", RW: "读写" };
  const drafts = new Map();
  const maxAnswerLength = 160;
  let current = null;
  let unmountWordPanel = null;
  let unmountPreclass = null;

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function session(key) {
    try { return sessionStorage.getItem(key); } catch { return null; }
  }

  function remember(key, value) {
    try { sessionStorage.setItem(key, value); } catch {}
  }

  function storageName(person) {
    return person.storageName ?? person.name;
  }

  function unitLabel(unit) {
    return "Unit " + String(unit.number).padStart(2, "0") + " " + unit.topic;
  }

  function attemptKey(unit) {
    const name = [storageName(student), student.level, student.adminClass].map(encodeURIComponent).join(":");
    const scope = [name, unit.book, unit.number];
    return (unit.track
      ? ["unlock.classroom.lesson-dictation.v1", ...scope, unit.track, unit.lesson, unit.revision]
      : ["unlock.classroom.whole-dictation.v2", ...scope, unit.revision]).join(":");
  }

  function answers(value, count) {
    return Array.from({ length: count }, (_, index) =>
      typeof value?.[index] === "string" ? value[index].slice(0, maxAnswerLength) : "");
  }

  function parseAttempt(raw, count) {
    try {
      const record = JSON.parse(raw || "null");
      if (!record || !Number.isInteger(record.sequence) || record.sequence < 1 || !Array.isArray(record.draft)) return null;
      const first = Array.isArray(record.first) ? answers(record.first, count) : null;
      const second = first && Array.isArray(record.second) ? answers(record.second, count) : null;
      const wordDictation = record.wordDictation && typeof record.wordDictation === "object" ? record.wordDictation : undefined;
      const { meaningPlan } = record;
      const validPlan = Number.isInteger(meaningPlan?.seed) && meaningPlan.seed >= 0 && meaningPlan.seed <= 0xffffffff &&
        Number.isInteger(meaningPlan.startAt) && meaningPlan.startAt >= 0 && meaningPlan.startAt < count;
      return { sequence: record.sequence, draft: answers(record.draft, count), first, second,
        wordDictation, completedAt: record.completedAt, correctionLocale: record.correctionLocale,
        meaningPlan: validPlan ? meaningPlan : undefined };
    } catch {
      return null;
    }
  }

  function loadAttempt(key, count) {
    const draft = drafts.get(key);
    try {
      const saved = parseAttempt(localStorage.getItem(key), count);
      if (saved && (!draft || saved.sequence >= draft.sequence)) return saved;
    } catch {}
    return draft || { sequence: 0, draft: answers(null, count), first: null, second: null };
  }

  function saveAttempt(updates) {
    const { key, unit, attempt } = current;
    const latest = loadAttempt(key, unit.items.length);
    if (latest.sequence !== attempt.sequence) {
      current.attempt = latest;
      render();
      copy("save-status", "This dictation was updated in another window.", "这份听写已在另一个窗口更新。");
      return false;
    }
    const next = { ...attempt, ...updates, sequence: attempt.sequence + 1 };
    current.attempt = next;
    drafts.set(key, next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
      $("save-status").textContent = "";
    } catch {
      copy("save-status", "This browser cannot save your progress. Finish this dictation on this page.",
        "当前浏览器无法保存这次作答。请在此页面完成听写。");
    }
    return true;
  }

  function correctionKey(item, first, locale) {
    if (locale !== "en-GB") return item.original;
    const alreadyCorrect = judge({ type: "text", keys: item.original.keys }, first) === "correct";
    return alreadyCorrect ? item.original : item;
  }

  function right(index, value, corrected = false) {
    const item = current.wordItems[index];
    const { first, correctionLocale } = current.attempt;
    const answer = corrected ? correctionKey(item, first[index], correctionLocale) : item.original;
    return judge({ type: "text", keys: answer.keys }, value) === "correct";
  }

  function required() {
    const { unit, attempt } = current;
    return unit.items.map((_, index) => index).filter(index =>
      !attempt.first || !right(index, attempt.first[index]));
  }

  function updatePlayback() {
    const attempt = current?.attempt;
    const first = Boolean(attempt && !attempt.first);
    const replays = attempt?.first && !attempt.second ? required().map(index => ({
      id: current.wordItems[index].id, audio: [current.wordItems[index].id]
    })) : [];
    const worksheet = attempt?.first ? current.worksheet : null;
    const playing = playback.update(worksheet, Boolean(worksheet && !attempt.second), first, replays);
    $("submit").disabled = playing;
  }

  function closeWordPanel() {
    unmountWordPanel?.();
    unmountWordPanel = null;
    download.clear();
  }

  function showPicker() {
    closePreclass();
    closeWordPanel();
    current = null;
    intro.hidden = false;
    updatePlayback();
    $("practice").hidden = true;
    $("picker").hidden = false;
    const url = new URL(location.href);
    for (const key of ["book", "unit", "track", "lesson", "week", "legacy", "previous"]) url.searchParams.delete(key);
    history.replaceState(null, "", url);
    updateUnitPreview();
  }

  function unitChoice(unit, selected) {
    const label = element("label", undefined, "unit-choice");
    const input = element("input");
    input.type = "radio";
    input.name = "unit";
    input.value = String(unit.number);
    input.checked = unit.number === selected;
    const card = element("span", undefined, "unit-choice-body");
    card.lang = "en";
    const number = element("span", "Unit " + String(unit.number).padStart(2, "0"), "unit-choice-number");
    const topic = element("strong");
    setLabel(topic, unit.topic, topicTranslation(unit.topic));
    card.append(number, topic);
    label.append(input, card);
    return label;
  }

  function selectedUnit() {
    return $("unit-options").querySelector('input[name="unit"]:checked');
  }

  function selectedBook() {
    return Number($("book-select").value);
  }

  function selectedUnitData() {
    return data.books[selectedBook()]?.find(unit => unit.number === Number(selectedUnit()?.value));
  }

  function assessment(unit, track, lesson, book) {
    const set = unit?.sets.find(item => item.track === track && item.lesson === lesson);
    return set ? { ...set, book, number: unit.number, topic: unit.topic } : null;
  }

  function currentSelection() {
    return assessment(selectedUnitData(), $("track-select").value, Number($("lesson-select").value), selectedBook());
  }

  function selectedWeek() {
    return Number($("week-select").value);
  }

  function preclassSelection(unit, week) {
    return unit.track ? preclass.assignment(student, unit, week) : null;
  }

  function closePreclass() {
    unmountPreclass?.();
    unmountPreclass = null;
    $("preclass-panel").hidden = true;
  }

  function previousSelection(book, number) {
    const unit = previousUnits[book]?.units.find(item => item.number === number);
    if (!unit) return null;
    const candidate = { ...unit, book };
    const attempt = loadAttempt(attemptKey(candidate), unit.items.length);
    return attempt.sequence ? candidate : null;
  }

  function loadUnits(book, preferred) {
    const units = data.books[book];
    const initial = units.find(unit => unit.number === preferred) || units[0];
    $("unit-options").replaceChildren(...units.map(unit => unitChoice(unit, initial.number)));
  }

  function selectionFromUrl() {
    const params = new URLSearchParams(location.search);
    const book = Number(params.get("book"));
    const number = Number(params.get("unit"));
    const track = params.get("track");
    const lesson = Number(params.get("lesson"));
    const unit = data.books[book]?.find(item => item.number === number);
    const previous = params.get("previous") === "1";
    const week = Number(params.get("week"));
    return {
      book, number, track, lesson, week, explicitWeek: params.has("week"),
      legacy: params.get("legacy") === "1",
      hasSelection: ["book", "unit", "track", "lesson", "week", "previous"].some(k => params.has(k)),
      open: previous ? previousSelection(book, number) : assessment(unit, track, lesson, book)
    };
  }

  function updateUnitPreview() {
    const unit = currentSelection();
    const action = $("unit-form").querySelector('button[type="submit"]');
    action.disabled = !unit;
    if (!unit) return;
    copy("unit-preview-title", unitLabel(unit), topicTranslation(unit.topic));
    const week = selectedWeek();
    const plan = preclassSelection(unit, week);
    const count = plan?.count ?? unit.items.length;
    copy("unit-word-count", count + " words and phrases", "共 " + count + " 个单词和短语");
    const old = loadAttempt(attemptKey(unit), unit.items.length);
    const oldComplete = old.completedAt || (!old.meaningPlan &&
      unit.items.every(item => words.complete(item, old.wordDictation)));
    $("week-filter").hidden = !plan;
    $("previous-lesson").hidden = !plan || !old.sequence;
    if (plan) {
      copy("picker-practice-title", "Pre-Class Vocabulary", "课前词汇学练");
      const saved = preclass.read(plan.key);
      if (saved?.view === "complete") setLabel(action, "View Results", "查看学练结果");
      else if (saved) setLabel(action, "Resume Vocabulary", "继续词汇学练");
      else setLabel(action, "Start Vocabulary", "开始词汇学练");
      copy("previous-lesson", oldComplete ? "Previous Dictation Results" : "Resume Previous Dictation",
        oldComplete ? "查看旧版听写结果" : "继续旧版听写");
    } else {
      copy("picker-practice-title", "Pre-Class Dictation", "课前听写");
      if (oldComplete) setLabel(action, "View Report", "查看结果");
      else if (old.sequence) setLabel(action, "Resume Dictation", "继续听写");
      else setLabel(action, "Start Dictation", "开始听写");
    }
    $("previous-dictation").hidden = !previousSelection(unit.book, unit.number);
    remember(selectionSession, JSON.stringify([unit.book, unit.number, unit.track, unit.lesson, week]));
  }

  function openClassroom() {
    const deepLink = selectionFromUrl();
    let preference = [];
    try {
      const remembered = JSON.parse(session(selectionSession) || "[]");
      if (Array.isArray(remembered)) preference = remembered;
    } catch {}
    const [lastBook, lastUnit, lastTrack, lastLesson, lastWeek] = preference;
    const book = [deepLink.book, lastBook, assignedBooks[student.level], 1]
      .find(number => Number.isInteger(number) && data.books[number]);
    $("student-name").textContent = student.name;
    $("book-select").value = String(book);
    const isTrack = value => Object.prototype.hasOwnProperty.call(trackNames, value);
    $("track-select").value = isTrack(deepLink.track) ? deepLink.track
      : isTrack(lastTrack) ? lastTrack : "LS";
    $("lesson-select").value = [1, 2].includes(deepLink.lesson) ? String(deepLink.lesson)
      : [1, 2].includes(lastLesson) ? String(lastLesson) : "1";
    const week = [1, 2].includes(deepLink.week) ? deepLink.week
      : (!deepLink.open && [1, 2].includes(lastWeek) ? lastWeek : 1);
    $("week-select").value = String(week);
    loadUnits(book, deepLink.number || lastUnit);
    $("classwork").hidden = false;
    $("account").hidden = false;
    if (deepLink.open) {
      const unit = deepLink.open;
      const oldLink = !deepLink.explicitWeek && loadAttempt(attemptKey(unit), unit.items.length).sequence > 0;
      openUnit(unit, { updateUrl: false, week, legacy: deepLink.legacy || oldLink });
    } else {
      if (deepLink.hasSelection) {
        copy("availability", "Choose a book, unit, track and lesson to start.",
          "请选择册次、单元、分册和课次后开始听写。");
      }
      updateUnitPreview();
    }
  }

  function showWorksheet(unit, updateUrl, plan, legacy) {
    if (updateUrl || plan) {
      const url = new URL(location.href);
      url.searchParams.set("book", String(unit.book));
      url.searchParams.set("unit", String(unit.number));
      url.searchParams.delete("week");
      url.searchParams.delete("legacy");
      if (unit.track) {
        url.searchParams.set("track", unit.track);
        url.searchParams.set("lesson", String(unit.lesson));
        url.searchParams.delete("previous");
        if (plan) url.searchParams.set("week", String(plan.week));
        if (legacy) url.searchParams.set("legacy", "1");
      } else {
        url.searchParams.delete("track");
        url.searchParams.delete("lesson");
        url.searchParams.set("previous", "1");
      }
      history.replaceState(null, "", url);
    }
    intro.hidden = true;
    $("picker").hidden = true;
    $("practice").hidden = false;
    $("set-title").textContent = "Book " + unit.book + " " + unitLabel(unit);
    if (plan) {
      copy("set-lesson", unit.track + " Week " + plan.week + " Lesson " + unit.lesson,
        trackNames[unit.track] + "第 " + plan.week + " 周第 " + unit.lesson + " 节");
    } else if (unit.track) {
      copy("set-lesson", unit.track + " Lesson " + unit.lesson, trackNames[unit.track] + "第 " + unit.lesson + " 节");
    } else {
      copy("set-lesson", "Previous Unit Dictation", "旧版整单元听写");
    }
    $("save-status").textContent = "";
  }

  function openUnit(unit, { updateUrl = true, week = selectedWeek(), legacy = false } = {}) {
    closePreclass();
    const plan = legacy ? null : preclassSelection(unit, week);
    showWorksheet(unit, updateUrl, plan, legacy);
    if (plan) {
      closeWordPanel();
      current = null;
      updatePlayback();
      copy("phase-title", "Pre-Class Vocabulary", "课前词汇学练");
      $("directions").hidden = true;
      $("classroom-word-panel").hidden = true;
      $("legacy-unit-attempt").hidden = true;
      const root = $("preclass-panel");
      root.hidden = false;
      unmountPreclass = preclass.mount({ root, student, unit, selection: plan,
        position: $("classroom-word-position"), saveStatus: $("save-status"), download });
      return;
    }
    const key = attemptKey(unit);
    const wordItems = unit.items.map((item, index) => unit.track
      ? words.makeItem(item.id, index + 1, item.word, item.keys, data.pronunciations[item.pronunciation])
      : words.makeItem(String(index + 1), index + 1, item.word, item.keys));
    const audio = Object.fromEntries(wordItems.map(item => [item.id, {
      file: words.audioPath(item), label: "第 " + item.number + " 题单词音频"
    }]));
    current = {
      key, unit, showAll: false, attempt: loadAttempt(key, unit.items.length),
      baseWordItems: wordItems, wordItems,
      worksheet: { key, dictation: { file: unit.file, count: unit.items.length }, unit: { audio } }
    };
    render();
    const panel = $("classroom-word-panel");
    const card = panel.querySelector(".wd-question");
    card?.classList.add("unlock-card-enter");
    const focus = card?.querySelector("[data-wd-play]") || card?.querySelector("#wd-heading") || $("phase-title");
    focus.focus({ preventScroll: true });
  }

  function line(label, value) {
    const row = element("p", undefined, "answer-line");
    const term = element("span", label);
    const response = element("span", value || "未作答");
    if (value) response.lang = "en";
    row.append(term, response);
    return row;
  }

  function answerRow(index, needsCorrection) {
    const { attempt } = current;
    const number = index + 1;
    const row = element("li", undefined, "answer-row");
    if (attempt.second) {
      const correct = right(index, attempt.second[index], true);
      const tag = element("span", correct ? "答对" : "待巩固", correct ? "answer-tag correct" : "answer-tag needs-work");
      const heading = element("h3", "第 " + number + " 题");
      const key = correctionKey(current.wordItems[index], attempt.first[index], attempt.correctionLocale);
      const answer = line("答案", key.word);
      row.append(heading, tag, line("首次", attempt.first[index]), line("二次", attempt.second[index]), answer);
    } else if (attempt.first && !needsCorrection) {
      row.append(element("h3", "第 " + number + " 题"),
        element("span", "已锁定", "answer-tag correct"), line("首次", attempt.first[index]));
    } else {
      const input = element("input");
      input.id = "answer-" + number;
      input.type = "text";
      input.lang = "en";
      input.maxLength = maxAnswerLength;
      input.autocomplete = "off";
      input.autocapitalize = "none";
      input.spellcheck = false;
      input.enterKeyHint = "next";
      input.dataset.answerIndex = String(index);
      input.setAttribute("data-dictation-answer", "");
      input.value = attempt.draft[index];
      const label = element("label", "第 " + number + " 题");
      label.htmlFor = input.id;
      row.append(label, input);
      if (attempt.first) {
        const replay = element("button", undefined, "small-button ui-action");
        setLabel(replay, "Replay Word", "重听");
        replay.type = "button";
        replay.disabled = true;
        replay.dataset.dictationReplay = String(number);
        replay.dataset.replayNumber = String(number);
        replay.setAttribute("aria-label", "重听第 " + number + " 题听写");
        row.append(line("首次", attempt.first[index]), replay);
      }
    }
    return row;
  }

  function updateProgress() {
    const { attempt, unit } = current;
    const remaining = required();
    const score = (values, corrected = false) => values.filter((value, index) => right(index, value, corrected)).length;
    const count = remaining.filter(index => attempt.draft[index].trim()).length;
    const text = attempt.second ? "首次答对 " + score(attempt.first) + " / " + unit.items.length +
      "，二次答对 " + score(attempt.second, true) + " / " + unit.items.length
      : attempt.first ? "已订正 " + count + " / " + remaining.length
      : "已填写 " + count + " / " + unit.items.length;
    if ($("progress").textContent !== text) $("progress").textContent = text;
  }

  function updateWordReport() {
    const { key, unit, wordItems, attempt, worksheet: playbackSheet } = current;
    const legacy = Boolean(attempt.first);
    if (legacy ? !attempt.second : !wordItems.every(item => words.complete(item, attempt.wordDictation))) return;
    const title = $("set-title").textContent + (unit.track ? " " + unit.track + " Lesson " + unit.lesson : "") + " 课前听写";
    const learner = student;
    const worksheet = {
      id: unit.id || "B" + unit.book + "U" + String(unit.number).padStart(2, "0"),
      revision: unit.revision, book: unit.book, unit: unit.number, code: "CLASSROOM_DICTATION"
    };
    if (unit.track) Object.assign(worksheet, { track: unit.track, lesson: unit.lesson });
    download.show($("classroom-report"), key + ":" + attempt.sequence, () => {
      if (!legacy) {
        return window.UnlockReport.prepare({
          student: learner, title, worksheet, attempt, dictationItems: wordItems,
          sections: [{ name: "听写作答记录", questions: wordItems }]
        });
      }
      const questions = wordItems.map((item, index) => ({
        id: item.id, number: item.number, kind: "单词听写", prompt: "听写第 " + item.number + " 题",
        type: "text", keys: correctionKey(item, attempt.first[index], attempt.correctionLocale).keys, audio: [item.id]
      }));
      const capture = (values, time, corrected = false) => ({
        time, answers: Object.fromEntries(questions.map((q, index) => [q.id, values[index]])),
        results: Object.fromEntries(questions.map((q, index) => {
          const keys = corrected ? q.keys : wordItems[index].original.keys;
          return [q.id, judge({ ...q, keys }, values[index])];
        }))
      });
      return window.UnlockReport.prepare({
        student: learner, title, worksheet, tracks: playbackSheet.unit.audio,
        attempt: { completedAt: attempt.completedAt, first: capture(attempt.first), second: capture(attempt.second, attempt.completedAt, true) },
        sections: [{ name: "听写作答记录", questions }]
      });
    });
  }

  function assignMeaningQuestions() {
    const { unit, baseWordItems, attempt } = current;
    let plan = attempt.meaningPlan;
    if (!plan && unit.track && !attempt.completedAt) {
      const startAt = baseWordItems.findIndex(item => !words.complete(item, attempt.wordDictation));
      if (startAt !== -1) plan = { startAt, seed: crypto.getRandomValues(new Uint32Array(1))[0] };
    }
    current.meaningPlan = plan;
    if (!plan || !unit.track) {
      current.wordItems = baseWordItems;
      return;
    }
    const questions = buildQuestions(unit, baseWordItems.slice(plan.startAt), plan.seed);
    current.wordItems = baseWordItems.map(item => {
      const meaningQuestion = questions.get(item.id);
      return meaningQuestion ? { ...item, meaningQuestion } : item;
    });
  }

  function render() {
    closeWordPanel();
    const legacy = Boolean(current.attempt.first);
    $("legacy-unit-attempt").hidden = !legacy;
    $("directions").hidden = !legacy;
    $("classroom-word-panel").hidden = legacy;
    if (legacy) {
      renderLegacy();
      return;
    }
    updatePlayback();
    copy("phase-title", "Pre-Class Dictation", "课前听写");
    assignMeaningQuestions();
    const { wordItems } = current;
    unmountWordPanel = words.mount($("classroom-word-panel"), {
      items: wordItems, read: () => current.attempt.wordDictation,
      positionTarget: $("classroom-word-position"),
      draft: item => current.attempt.draft[item.number - 1],
      save: (item, record) => {
        const wordDictation = { ...current.attempt.wordDictation, [item.id]: record };
        const completedAt = wordItems.every(term => words.complete(term, wordDictation))
          ? new Date().toISOString() : undefined;
        return saveAttempt({ wordDictation, completedAt, meaningPlan: current.meaningPlan });
      },
      onProgress: updateWordReport
    });
    updateWordReport();
  }

  function renderLegacy() {
    const { attempt, unit, showAll } = current;
    const active = new Set(required());
    copy("phase-title", ...(attempt.second ? ["Dictation Report", "听写结果"]
      : attempt.first ? ["Correction", "订正"] : ["First Attempt", "首次作答"]));
    const directions = attempt.second ? ["Compare both attempts with the answer key.", "对照两次作答和词表答案。"]
      : attempt.first && active.size ? ["Correct the incorrect and unanswered items. Replay each word once.",
        "订正首次答错或空着的题。每道待订正题可单独重听一次。"]
      : attempt.first ? ["All answers were correct. Open the report to review them.", "首次作答全对，可以直接查看结果。"]
      : ["Listen for the question number. Each word or phrase is read twice. Type your answer in English.",
        "音频按题号读完整个单元，每个单词或短语读两遍。请按题号填写英文。"];
    copy("directions", ...directions);
    $("answer-list").replaceChildren(...unit.items.flatMap((_, index) =>
      !attempt.first || attempt.second || active.has(index) || showAll ? [answerRow(index, active.has(index))] : []));
    $("toggle-correct").hidden = !attempt.first || Boolean(attempt.second) || active.size === unit.items.length;
    copy("toggle-correct", ...(showAll ? ["Show Corrections", "只看待订正题"] : ["Show All", "查看全部题目"]));
    $("submit").hidden = Boolean(attempt.second);
    copy("submit", ...(!attempt.first ? ["Submit", "首次提交"] : active.size
      ? ["Submit Corrections", "提交订正"] : ["View Report", "查看结果"]));
    updateProgress();
    updatePlayback();
    updateWordReport();
  }

  function commitFirst() {
    if (!current || current.attempt.first || $("submit").disabled) return;
    const first = [...current.attempt.draft];
    const draft = first.map((value, index) => right(index, value) ? value : "");
    if (!saveAttempt({ first, draft })) return;
    current.showAll = false;
    render();
    $("phase-title").focus();
  }

  $("submit").addEventListener("click", () => {
    if (!current || current.attempt.second || $("submit").disabled) return;
    const { attempt } = current;
    const missing = required().filter(index => !attempt.draft[index].trim());
    if (!attempt.first) {
      if (!missing.length) {
        commitFirst();
      } else {
        const message = "还有 " + missing.length + " 道题未填写。可以返回作答，也可以提交当前作答。";
        copy("submit-message", missing.length + " answers are blank. You can keep working or submit now.", message);
        if (typeof $("submit-confirm").showModal === "function") $("submit-confirm").showModal();
        else if (window.confirm(message)) commitFirst();
      }
      return;
    }
    if (missing.length) {
      copy("save-status", "Complete each correction before submitting.", "请填写所有待订正题，再提交订正。");
      $("answer-" + (missing[0] + 1))?.focus();
      return;
    }
    const second = attempt.draft.map((value, index) => right(index, attempt.first[index]) ? attempt.first[index] : value);
    const correctionLocale = current.wordItems[0].locale;
    if (saveAttempt({ second, correctionLocale, completedAt: new Date().toISOString() })) {
      render();
      $("phase-title").focus();
    }
  });

  $("confirm-first").addEventListener("click", () => {
    $("submit-confirm").close();
    commitFirst();
  });
  $("toggle-correct").addEventListener("click", () => {
    if (!current) return;
    current.showAll = !current.showAll;
    render();
  });
  $("answer-list").addEventListener("input", event => {
    const index = Number(event.target.dataset.answerIndex);
    if (!current || current.attempt.second || !Number.isInteger(index) || index < 0 || index >= current.unit.items.length ||
        (current.attempt.first && right(index, current.attempt.first[index]))) return;
    const draft = [...current.attempt.draft];
    draft[index] = event.target.value.slice(0, maxAnswerLength);
    if (saveAttempt({ draft })) updateProgress();
  });
  $("answer-list").addEventListener("keydown", event => {
    if (event.key !== "Enter" || event.isComposing || !event.target.matches("[data-dictation-answer]")) return;
    const fields = Array.from($("answer-list").querySelectorAll("[data-dictation-answer]"));
    event.preventDefault();
    fields[fields.indexOf(event.target) + 1]?.focus();
  });
  document.addEventListener("dictation-playback-change", updatePlayback);
  window.addEventListener("storage", event => {
    if (!current || event.key !== current.key) return;
    const next = parseAttempt(event.newValue, current.unit.items.length);
    if (!next || next.sequence <= current.attempt.sequence) return;
    current.attempt = next;
    render();
    copy("save-status", "This dictation was updated in another window.", "这份听写已在另一个窗口更新。");
  });

  $("book-select").addEventListener("change", () => {
    loadUnits(selectedBook(), Number(selectedUnit()?.value));
    updateUnitPreview();
  });
  $("unit-form").addEventListener("change", event => {
    if (event.target !== $("book-select")) updateUnitPreview();
  });
  $("unit-form").addEventListener("submit", event => {
    event.preventDefault();
    const unit = currentSelection();
    if (unit) openUnit(unit);
  });
  $("previous-lesson").addEventListener("click", () => {
    const unit = currentSelection();
    if (unit && loadAttempt(attemptKey(unit), unit.items.length).sequence) openUnit(unit, { legacy: true });
  });
  $("previous-dictation").addEventListener("click", () => {
    const unit = previousSelection(selectedBook(), Number(selectedUnit()?.value));
    if (unit) openUnit(unit);
  });
  $("back-units").addEventListener("click", () => {
    showPicker();
    selectedUnit()?.focus();
  });
  $("classroom-sign-out").addEventListener("click", () => account.signOut());
  openClassroom();
})();

