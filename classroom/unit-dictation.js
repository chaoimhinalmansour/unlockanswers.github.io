"use strict";

(function () {
  const $ = id => document.getElementById(id);
  const students = window.UNLOCK_STUDENTS || [];
  const data = window.UNLOCK_CLASSROOM_UNITS;
  const playback = window.UnlockDictation;
  const words = window.UnlockWordDictation;
  const intro = document.querySelector(".intro");
  const { judge } = window.UnlockRules;
  const books = { L1: 2, L2: 3 };
  const studentSession = "unlock.classroom.student.v1";
  const unitSession = "unlock.classroom.unit.v2";
  const drafts = new Map();
  const maxAnswerLength = 160;
  let student = null;
  let current = null;
  let unmountWordPanel = null;
  let reportUrl = "";

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
      return { sequence: record.sequence, draft: answers(record.draft, count), first, second,
        wordDictation, completedAt: record.completedAt };
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
      $("save-status").textContent = "这份听写已在另一个窗口更新。";
      return false;
    }
    const next = { ...attempt, ...updates, sequence: attempt.sequence + 1 };
    current.attempt = next;
    drafts.set(key, next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
      $("save-status").textContent = "";
    } catch {
      $("save-status").textContent = "当前浏览器无法保存这次作答。请在此页面完成听写。";
    }
    return true;
  }

  function right(index, value) {
    return judge({ type: "text", keys: current.unit.items[index].keys }, value) === "correct";
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
      id: String(index + 1), audio: [current.unit.items[index].audio]
    })) : [];
    const worksheet = attempt?.first ? current.worksheet : null;
    const playing = playback.update(worksheet, Boolean(worksheet && !attempt.second), first, replays);
    $("submit").disabled = playing;
  }

  function closeWordPanel() {
    unmountWordPanel?.();
    unmountWordPanel = null;
    if (reportUrl) URL.revokeObjectURL(reportUrl);
    reportUrl = "";
    $("classroom-report").hidden = true;
  }

  function showPicker() {
    closeWordPanel();
    current = null;
    intro.hidden = false;
    updatePlayback();
    $("practice").hidden = true;
    $("picker").hidden = false;
    remember(unitSession, "");
  }

  function openStudent(person, restoreUnit = false) {
    const rememberedUnit = Number(session(unitSession));
    student = person;
    showPicker();
    remember(studentSession, person?.name || "");
    $("login").hidden = Boolean(person);
    $("classwork").hidden = !person;
    $("account").hidden = !person;
    $("availability").textContent = "";
    if (!person) {
      $("student-select").value = "";
      $("student-password").value = "";
      $("student-select").focus();
      return;
    }
    $("student-name").textContent = person.name;
    const book = books[person.level];
    const units = data.books[book]?.units || [];
    $("book-label").textContent = book ? "Book " + book : person.level;
    $("unit-form").hidden = !units.length;
    if (!units.length) {
      $("availability").textContent = "当前级别暂无可用的课前听写。";
      return;
    }
    $("unit-select").replaceChildren(...units.map(unit => new Option(unitLabel(unit), unit.number)));
    const unit = restoreUnit && units.find(item => item.number === rememberedUnit);
    if (unit) openUnit(unit);
  }

  function openUnit(unit) {
    const book = books[student.level];
    const name = [storageName(student), student.level, student.adminClass].map(encodeURIComponent).join(":");
    const key = ["unlock.classroom.whole-dictation.v2", name, book, unit.number, unit.revision].join(":");
    current = {
      key, unit, showAll: false, attempt: loadAttempt(key, unit.items.length),
      wordItems: unit.items.map((item, index) => words.makeItem(String(index + 1), index + 1, item.word, item.keys)),
      worksheet: { key, dictation: { file: unit.file, count: unit.items.length }, unit: { audio: data.audio } }
    };
    remember(unitSession, String(unit.number));
    intro.hidden = true;
    $("picker").hidden = true;
    $("practice").hidden = false;
    $("set-title").textContent = "Book " + book + " " + unitLabel(unit);
    $("save-status").textContent = "";
    render();
    const play = $("classroom-word-panel").querySelector("[data-wd-play]");
    const focus = !current.attempt.first && play ? play : $("phase-title");
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
    const { attempt, unit } = current;
    const number = index + 1;
    const row = element("li", undefined, "answer-row");
    if (attempt.second) {
      const correct = right(index, attempt.second[index]);
      const tag = element("span", correct ? "答对" : "待巩固", correct ? "answer-tag correct" : "answer-tag needs-work");
      const heading = element("h3", "第 " + number + " 题");
      const answer = line("答案", unit.items[index].word);
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
        const replay = element("button", "重听", "small-button");
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
    const score = values => values.filter((value, index) => right(index, value)).length;
    const count = remaining.filter(index => attempt.draft[index].trim()).length;
    const text = attempt.second ? "首次答对 " + score(attempt.first) + " / " + unit.items.length +
      "，二次答对 " + score(attempt.second) + " / " + unit.items.length
      : attempt.first ? "已订正 " + count + " / " + remaining.length
      : "已填写 " + count + " / " + unit.items.length;
    if ($("progress").textContent !== text) $("progress").textContent = text;
  }

  function updateWordReport() {
    const { wordItems, attempt } = current;
    if (!wordItems.every(item => words.complete(item, attempt.wordDictation)) || reportUrl) return;
    const title = $("set-title").textContent + " 课前听写";
    const printable = window.UnlockReport.html({
      student, title, attempt, dictationItems: wordItems,
      sections: [{ name: "听写作答记录", questions: wordItems }]
    });
    reportUrl = URL.createObjectURL(new Blob([printable], { type: "text/html;charset=utf-8" }));
    const link = $("classroom-report");
    link.href = reportUrl;
    link.download = title + " " + student.name + " 作答单.html";
    link.hidden = false;
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
    $("phase-title").textContent = "课前听写";
    const { wordItems } = current;
    unmountWordPanel = words.mount($("classroom-word-panel"), {
      items: wordItems, read: () => current.attempt.wordDictation,
      draft: item => current.attempt.draft[item.number - 1],
      save: (item, record) => {
        const wordDictation = { ...current.attempt.wordDictation, [item.id]: record };
        const completedAt = wordItems.every(term => words.complete(term, wordDictation))
          ? new Date().toISOString() : undefined;
        return saveAttempt({ wordDictation, completedAt });
      },
      onProgress: updateWordReport
    });
    updateWordReport();
  }

  function renderLegacy() {
    const { attempt, unit, showAll } = current;
    const active = new Set(required());
    const title = attempt.second ? "听写结果" : attempt.first ? "订正" : "首次作答";
    $("phase-title").textContent = title;
    $("directions").textContent = attempt.second ? "对照两次作答和词表答案。"
      : attempt.first && active.size ? "订正首次答错或空着的题。每道待订正题可单独重听一次。"
      : attempt.first ? "首次作答全对，可以直接查看结果。"
      : "音频按题号读完整个单元，每个单词或短语读两遍。请按题号填写英文。";
    $("answer-list").replaceChildren(...unit.items.flatMap((_, index) =>
      !attempt.first || attempt.second || active.has(index) || showAll ? [answerRow(index, active.has(index))] : []));
    $("toggle-correct").hidden = !attempt.first || Boolean(attempt.second) || active.size === unit.items.length;
    $("toggle-correct").textContent = showAll ? "只看待订正题" : "查看全部题目";
    $("submit").hidden = Boolean(attempt.second);
    $("submit").textContent = !attempt.first ? "首次提交" : active.size ? "提交订正" : "查看结果";
    updateProgress();
    updatePlayback();
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
        $("submit-message").textContent = message;
        if (typeof $("submit-confirm").showModal === "function") $("submit-confirm").showModal();
        else if (window.confirm(message)) commitFirst();
      }
      return;
    }
    if (missing.length) {
      $("save-status").textContent = "请填写所有待订正题，再提交订正。";
      $("answer-" + (missing[0] + 1))?.focus();
      return;
    }
    const second = attempt.draft.map((value, index) => right(index, attempt.first[index]) ? attempt.first[index] : value);
    if (saveAttempt({ second })) {
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
    $("save-status").textContent = "这份听写已在另一个窗口更新。";
  });

  for (const person of students) $("student-select").add(new Option(person.name, person.name));
  $("login-form").addEventListener("submit", event => {
    event.preventDefault();
    const person = students.find(entry => entry.name === $("student-select").value);
    const password = $("student-password");
    const expected = person?.name.match(/（([^）]+)）$/)?.[1];
    if (!expected || password.value.trim() !== expected) {
      $("login-message").textContent = "请检查所选姓名和英文名密码。";
      password.setAttribute("aria-invalid", "true");
      password.focus();
      password.select();
      return;
    }
    password.value = "";
    $("login-message").textContent = "";
    password.removeAttribute("aria-invalid");
    openStudent(person);
    if (!$("unit-form").hidden) $("unit-select").focus();
  });
  for (const field of ["student-select", "student-password"]) $(field).addEventListener("input", () => {
    if (field === "student-select") $("student-password").value = "";
    $("student-password").removeAttribute("aria-invalid");
    $("login-message").textContent = "";
  });
  $("unit-form").addEventListener("submit", event => {
    event.preventDefault();
    const unit = data.books[books[student?.level]]?.units.find(item => item.number === Number($("unit-select").value));
    if (unit) openUnit(unit);
  });
  $("back-units").addEventListener("click", () => {
    showPicker();
    $("unit-select").focus();
  });
  $("switch-student").addEventListener("click", () => openStudent(null));
  const name = session(studentSession);
  const previous = name && students.find(person => person.name === name || person.storageName === name);
  if (previous) openStudent(previous, true);
})();

