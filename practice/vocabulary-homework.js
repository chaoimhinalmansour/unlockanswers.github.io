"use strict";

(() => {
  const session = window.UnlockSession;
  const active = session.requireSession("student");
  if (!active) return;
  const student = session.student(active);
  if (!student) {
    session.signOut("student", location.href);
    return;
  }
  const library = window.UnlockVocabularyBank;
  const homework = window.UnlockHomeworkVocabulary;
  const download = window.UnlockWorkPackage.downloadControl("button");
  const byId = id => document.getElementById("vocabulary-homework-" + id);
  const picker = byId("picker");
  const form = byId("form");
  const work = byId("work");
  const status = byId("status");
  const books = [...new Set(Object.values(library.catalog).map(item => item.book))];
  const assignedBook = { L1: 2, L2: 3 }[student.level];
  const subjectNames = { L: "Listening", S: "Speaking", R: "Reading", W: "Writing" };
  const params = new URLSearchParams(location.search);
  const bookField = form.elements.book;
  const unitField = form.elements.unit;
  const subjectField = form.elements.subject;
  const homeworkField = form.elements.number;
  let panel, request, activeRun;
  const volatile = new Map();

  function selected() {
    const book = Number(bookField.value);
    const unit = Number(unitField.value);
    const subject = subjectField.value;
    const code = subject + "_H" + homeworkField.value;
    const id = library.id(book, unit, /^[LS]/.test(subject) ? "LS" : "RW");
    return { book, unit, subject, code, id, entry: library.entry(id) };
  }

  function read(key) {
    try {
      const json = localStorage.getItem(key);
      return json ? JSON.parse(json) : volatile.get(key);
    } catch {
      return volatile.get(key);
    }
  }

  function updatePreview() {
    const { entry } = selected();
    byId("preview").textContent = entry ? entry.topic + "。共 " + entry.count + " 个词条。" : "";
  }

  function updateUnits(preferred) {
    const options = Object.values(library.catalog)
      .filter(item => item.track === "LS" && item.book === Number(bookField.value))
      .sort((a,b) => a.unit-b.unit);
    unitField.replaceChildren(...options.map(item => new Option("Unit " + item.unit, item.unit)));
    if (options.some(item => item.unit === preferred)) unitField.value = String(preferred);
    updatePreview();
  }

  function togglePicker(show) {
    picker.hidden = !show;
    work.hidden = show;
  }

  function close() {
    request?.abort();
    request = undefined;
    panel?.dispose();
    panel = undefined;
    activeRun = undefined;
    download.clear();
    byId("panel").replaceChildren();
    byId("progress").textContent = "";
    status.textContent = "";
    const url = new URL(location.href);
    url.search = "";
    history.replaceState(null, "", url);
    togglePicker(true);
    bookField.focus();
  }

  function paint(run) {
    panel?.dispose();
    const host = document.createElement("section");
    host.className = "homework-vocabulary-panel";
    byId("panel").replaceChildren(host);
    const saved = () => run.saved;
    const updateProgress = () => {
      if (run.saved.done) {
        byId("progress").textContent = "学练已完成";
        return;
      }
      const meter = homework.meter(run.bank, run.saved);
      byId("progress").textContent = "当前进度 " + meter.now + " / " + meter.max;
    };
    function completed() {
      const score = homework.results(run.bank, run.saved, () => null);
      status.textContent = "首答正确 " + score.firstCorrect + " / " + score.total + "。";
      download.show(byId("download"), run.key + ":" + run.saved.sequence, () => {
        return window.UnlockReport.prepare({
          student, title: run.title, sections: [],
          worksheet: { id: run.id, book: run.book, unit: run.unit, code: run.code, revision: run.bank.revision },
          attempt: { completedAt: run.saved.completedAt, first: null, second: null },
          homeworkVocabulary: { bank: run.bank, saved: run.saved }
        });
      });
    }
    function save(next) {
      const latest = read(run.key);
      if (latest && latest.sequence > run.saved.sequence) {
        run.saved = homework.progress(run.bank, latest);
        paint(run);
        status.textContent = "这份学练的进度已从另一窗口更新。";
        return false;
      }
      run.saved = { ...next, sequence: (run.saved.sequence || 0) + 1,
        ...(next.done ? { completedAt: run.saved.completedAt || new Date().toISOString() } : {}) };
      volatile.set(run.key, run.saved);
      try {
        localStorage.setItem(run.key, JSON.stringify(run.saved));
      } catch {
        status.textContent = "当前浏览器无法保存进度，请留在此页完成。";
      }
      updateProgress();
      return true;
    }
    panel = homework.mount(host, {
      bank: run.bank, read: saved, save, onFinish: completed, readonly: false
    });
    updateProgress();
    if (run.saved.done) completed();
  }

  async function open() {
    const picked = selected();
    if (!picked.entry || request || panel?.busy()) return;
    const { book, unit, subject, code, id } = picked;
    const search = new URLSearchParams({ book, unit, assignment: code });
    const readingBeta = window.UnlockReadingBeta;
    const readingUnit = { id: "B" + book + "U" + String(unit).padStart(2, "0") };
    const nativeReading = readingBeta.extraBooks.includes(book) && readingBeta.revision(readingUnit, code);
    if (book === assignedBook || nativeReading) {
      location.assign("index.html?" + search);
      return;
    }
    panel?.dispose();
    download.clear();
    const controller = new AbortController();
    request = controller;
    const key = "unlock.practice.homework-vocabulary.v1:" +
      [student.storageName ?? student.name, student.level, student.adminClass, id, code].map(encodeURIComponent).join(":");
    const title = "Book " + book + " Unit " + unit + " " + subjectNames[subject] + " " + code.slice(2);
    byId("title").textContent = title;
    togglePicker(false);
    byId("title").focus();
    status.textContent = "正在载入词汇学练";
    const url = new URL(location.href);
    url.search = search;
    history.replaceState(null, "", url);
    try {
      const prior = read(key);
      const revision = prior?.bankId === id && /^[a-f0-9]{16}$/.test(prior.revision) ?
        prior.revision : picked.entry.revision;
      const bank = await homework.load({ book, unit }, code, revision, controller.signal);
      if (controller.signal.aborted) return;
      status.textContent = "";
      activeRun = { ...picked, key, title, bank, saved: homework.progress(bank, prior) };
      paint(activeRun);
    } catch {
      if (!controller.signal.aborted) {
        status.textContent = "词汇学练未能载入。";
        const retry = document.createElement("button");
        retry.type = "button";
        retry.className = "ui-nav";
        retry.textContent = "重新载入";
        retry.addEventListener("click", open);
        status.append(" ", retry);
      }
    } finally {
      if (request === controller) request = undefined;
    }
  }

  form.addEventListener("change", event => {
    if (event.target === bookField) updateUnits(1);
    else updatePreview();
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    open();
  });
  byId("back").addEventListener("click", () => {
    if (panel?.busy()) panel.focusRecording();
    else close();
  });
  window.addEventListener("storage", event => {
    if (!activeRun || event.key !== activeRun.key || panel?.busy()) return;
    const latest = read(activeRun.key);
    if (latest?.sequence > activeRun.saved.sequence && latest.revision === activeRun.bank.revision) {
      activeRun.saved = homework.progress(activeRun.bank, latest);
      paint(activeRun);
    }
  });
  bookField.replaceChildren(...books.map(book => new Option("Book " + book, book)));
  const explicitBook = Number(params.get("book"));
  if (books.includes(explicitBook)) bookField.value = String(explicitBook);
  else if (assignedBook) bookField.value = String(assignedBook);
  updateUnits(Number(params.get("unit")));
  const directCode = /^([LSRW])_H([123])$/.exec(params.get("assignment") || "");
  if (directCode) {
    subjectField.value = directCode[1];
    homeworkField.value = directCode[2];
    updatePreview();
  }
  document.body.hidden = false;
  if (books.includes(explicitBook) && selected().unit === Number(params.get("unit")) && directCode) open();
})();
