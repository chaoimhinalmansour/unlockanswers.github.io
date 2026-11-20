"use strict";

(function () {
  const session = window.UnlockSession;
  if (!session.requireSession("teacher")) return;
  const { escapeHTML: esc } = window.UnlockRules;
  const { specialUnit, findMeta, allowsWorksheet, unitLabel, subjectTitle, renderDirectory,
    createOpening, renderOpening, readResource, loadUnit } = window.UnlockPracticeCatalog;
  const { render: renderWorkbench, readingSource } = window.UnlockWorkbench;
  const { renderSolution, markEvidence } = window.UnlockWorksheet;
  const screens = window.UnlockScreens;
  const listening = window.UnlockListening;
  const surface = document.getElementById("practice-surface");
  const app = document.getElementById("app");
  const account = document.getElementById("practice-account");
  const dock = document.getElementById("practice-docks");
  const operations = document.getElementById("practice-operations");
  const guides = new Map();
  const evidenceCache = new Map();
  const state = {
    book: 2, unit: 1, worksheet: null,
    focus: 0, solutionShown: false, largePicture: false, readingOffset: 0, opening: null
  };

  function currentMeta() {
    return findMeta(state.book, state.unit);
  }

  function review() {
    const { worksheet, focus, largePicture } = state;
    const content = renderWorkbench(worksheet, null, {
      current: worksheet.questions[focus], visible: worksheet.questions, largePicture,
      teaching: true
    });
    return '<div class="quiz-header"><div class="session-top"><div><div class="quiz-location">' +
      '<button type="button" class="text-action subtle-action" data-action="directory">讲评目录</button>' +
      '<p class="page-context">' + esc(unitLabel(worksheet.unit)) + '</p></div>' +
      '<div class="session-title"><h1>' + subjectTitle(worksheet.code) + '</h1></div></div></div></div>' + content;
  }

  function renderDocks(working) {
    dock.hidden = !working;
    const worksheet = working ? state.worksheet : null;
    listening.update(worksheet, worksheet?.questions[state.focus]);
    operations.innerHTML = working
      ? '<button type="button" class="button secondary" data-step="-1"' + (state.focus === 0 ? " disabled" : "") +
        '>上一题</button><button type="button" class="button" data-action="toggle-solution" ' +
        'aria-expanded="false" aria-controls="teaching-solution">显示答案与解析</button>' +
        '<button type="button" class="button secondary" data-step="1"' +
        (state.focus === worksheet.questions.length - 1 ? " disabled" : "") + ">下一题</button>"
      : "";
  }

  function markReadingEvidence(ranges = []) {
    const paragraphs = app.querySelectorAll("#reading-screen .passage > p");
    const { worksheet, focus } = state;
    const passages = readingSource(worksheet, worksheet.questions[focus])?.passages || [];
    for (const [index, paragraph] of paragraphs.entries()) {
      const { label, text } = passages[index];
      markEvidence(paragraph, text, ranges.filter(range => range[0] === label), "reading-evidence");
    }
    return paragraphs.length ? app.querySelector("#reading-screen .reading-evidence") : null;
  }

  function showSolution(show) {
    const solution = document.getElementById("teaching-solution");
    const button = operations.querySelector('[data-action="toggle-solution"]');
    if (!solution || !button) return;
    const { worksheet, focus } = state;
    state.solutionShown = show;
    solution.innerHTML = show ? renderSolution(worksheet.questions[focus], worksheet.guide[focus]) : "";
    solution.hidden = !show;
    const listeningQuestion = worksheet.code.startsWith("L_") || Boolean(worksheet.questions[focus]?.audio?.length);
    const evidence = show ? worksheet.evidence?.[focus] : undefined;
    if (show && /^(R|L)_/.test(worksheet.code) && !worksheet.evidence) {
      solution.insertAdjacentHTML("beforeend", '<p class="feedback" role="status">原文标记暂时无法加载。请返回讲评目录后重试。</p>');
    }
    if (listeningQuestion) {
      listening.setEvidence(evidence?.recordings || []);
      if (evidence?.limited) {
        solution.insertAdjacentHTML("beforeend", '<p class="feedback" role="status">此题的录音字幕未包含完整依据，请结合解析中的引文讲评。</p>');
      }
    }
    const firstEvidence = listeningQuestion ? null : markReadingEvidence(evidence ?? []);
    button.setAttribute("aria-expanded", String(show));
    button.textContent = show ? "收起答案与解析" : "显示答案与解析";
    screens.connect(app);
    screens.reveal(show ? solution : app.querySelector(".q-prompt"));
    if (firstEvidence) screens.reveal(firstEvidence);
  }

  function render() {
    const working = Boolean(state.worksheet && !state.opening);
    const priorPassage = app.querySelector("#reading-screen");
    if (priorPassage) state.readingOffset = priorPassage.scrollTop;
    const content = state.opening ? renderOpening(state.opening, true)
      : working ? review() : renderDirectory(currentMeta());
    surface.classList.toggle("in-worksheet", working);
    app.innerHTML = content;
    if (working) app.querySelector(".workspace-question .screen-content")?.classList.add("unlock-card-enter");
    renderDocks(working);
    const passage = app.querySelector("#reading-screen");
    if (passage) {
      if (passage.dataset.readingArticle !== priorPassage?.dataset.readingArticle) state.readingOffset = 0;
      passage.scrollTop = state.readingOffset;
    }
    if (working && state.solutionShown) showSolution(true);
    else screens.connect(app);
  }

  async function loadGuide(meta, signal) {
    const saved = guides.get(meta.id);
    if (saved?.revision === meta.revision) return saved;
    const path = meta.guidePath || "data/alpha-a4-teaching/" + meta.id.toLowerCase() + ".json";
    const response = await readResource(path + "?v=" + (meta.guidePath ? meta.revision : "20261116-8"), signal);
    const result = await response.json();
    if (result.id !== meta.id || result.revision !== meta.revision) throw new Error("Teacher source revision mismatch");
    guides.set(meta.id, result);
    return result;
  }

  async function loadEvidence(meta, code, signal) {
    const skill = { R: "reading", L: "listening" }[code[0]];
    if (meta.unit === specialUnit || !skill) return null;
    try {
      let data = evidenceCache.get(skill);
      if (!data) {
        const asset = "data/alpha-a4-teaching/" + skill + "-evidence.json?v=20261117-4";
        const response = await readResource(asset, signal);
        data = await response.json();
      }
      const unit = data[meta.id];
      if (unit?.revision !== meta.revision) throw new Error("Teaching evidence revision mismatch");
      evidenceCache.set(skill, data);
      return unit.sheets[code];
    } catch {
      if (!signal.aborted) evidenceCache.delete(skill);
      return null;
    }
  }

  async function openReview(code) {
    const meta = currentMeta();
    if ((state.opening && !state.opening.failed) || !allowsWorksheet(meta, code)) return;
    const opening = createOpening(meta, code);
    state.opening = opening;
    render();
    app.focus({ preventScroll: true });
    try {
      const [unit, bank, evidence] = await Promise.all([
        loadUnit(meta, opening.signal), loadGuide(meta, opening.signal), loadEvidence(meta, code, opening.signal)
      ]);
      if (opening !== state.opening) return;
      const sheet = unit.sheets[code];
      const guide = bank.sheets[code];
      if (guide.length !== sheet.questions.length ||
          !guide.every((item, index) => item.id === sheet.questions[index].id)) {
        throw new Error("Teacher questions do not match this worksheet");
      }
      state.worksheet = {
        key: meta.id + ":" + code, code, unit, sheet, questions: sheet.questions, guide,
        evidence: meta.unit === specialUnit ? guide.map(item => item.marks)
          : evidence?.length === sheet.questions.length ? evidence : null
      };
      state.focus = 0;
      state.solutionShown = false;
      state.largePicture = false;
      state.readingOffset = 0;
    } catch {
      if (opening === state.opening) {
        opening.failed = true;
        opening.cancel();
        state.worksheet = null;
      }
    } finally {
      opening.finish();
      if (opening === state.opening) {
        if (!opening.failed) state.opening = null;
        render();
        window.scrollTo(0, 0);
        const focusTarget = opening.failed ? app.querySelector('[data-action="retry-open"]') : app;
        focusTarget?.focus({ preventScroll: true });
      }
    }
  }

  function resetView(returnToTask = false) {
    const code = returnToTask && (state.worksheet?.code || state.opening?.code);
    state.opening?.cancel();
    state.opening = null;
    state.worksheet = null;
    state.solutionShown = false;
    render();
    window.scrollTo(0, 0);
    const focusTarget = code ? app.querySelector('[data-task="' + code + '"]') : app;
    focusTarget?.focus({ preventScroll: true });
  }

  function go(index) {
    const question = state.worksheet?.questions[index];
    if (!question || index === state.focus) return;
    if (question.picture !== state.worksheet.questions[state.focus].picture) state.largePicture = false;
    state.focus = index;
    state.solutionShown = false;
    render();
    document.getElementById("item-" + question.id)?.focus({ preventScroll: true });
  }

  surface.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    const { book, unit, task, questionNumber, step, action } = button.dataset;
    if (book) {
      state.book = Number(book);
      state.unit = 1;
      resetView();
      app.querySelector('[data-book="' + book + '"]')?.focus();
    } else if (unit) {
      state.unit = Number(unit);
      render();
      app.querySelector('[data-unit="' + unit + '"]')?.focus();
    } else if (action === "special") {
      state.unit = specialUnit;
      render();
      app.querySelector('[data-action="special"]')?.focus({ preventScroll: true });
    } else if (task) {
      openReview(task);
    } else if (action === "retry-open" && state.opening?.failed) {
      openReview(state.opening.code);
    } else if (questionNumber) {
      go(Number(questionNumber) - 1);
    } else if (step) {
      go(state.focus + Number(step));
    } else if (action === "toggle-solution") {
      showSolution(!state.solutionShown);
    } else if (action === "expand-photo") {
      state.largePicture = !state.largePicture;
      render();
      app.querySelector('[data-action="expand-photo"]')?.focus({ preventScroll: true });
    } else if (action === "directory") {
      resetView(true);
    } else if (action === "sign-out") {
      session.signOut();
    }
  });

  account.innerHTML = '<div class="identity-info"><strong>教师</strong></div>' +
    '<button type="button" class="text-action subtle-action" data-action="sign-out">退出登录</button>';
  render();
})();
