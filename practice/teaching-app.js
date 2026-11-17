"use strict";

(function () {
  const { escapeHTML: esc } = window.UnlockRules;
  const { specialUnit, findMeta, allowsWorksheet, unitLabel, subjectTitle, renderDirectory, loadUnit } =
    window.UnlockPracticeCatalog;
  const { render: renderWorkbench, readingSource } = window.UnlockWorkbench;
  const { renderSolution, markEvidence } = window.UnlockWorksheet;
  const screens = window.UnlockScreens;
  const listening = window.UnlockListening;
  const surface = document.getElementById("practice-surface");
  const app = document.getElementById("app");
  const account = document.getElementById("practice-account");
  const dock = document.getElementById("practice-docks");
  const operations = document.getElementById("practice-operations");
  const sessionKey = "unlock.practice.teaching.v1";
  const expected = "1f81fc017f9006f147330dd5e9072b98074791e9e759d3fbddfc16cab073950d";
  const guides = new Map();
  const evidenceLoads = new Map();
  const state = {
    authorized: false, book: 2, unit: 1, worksheet: null,
    focus: 0, solutionShown: false, largePicture: false, readingOffset: 0, loading: false,
    notice: "", navigation: 0
  };

  function entry() {
    return '<section class="entry-layout"><h1>教学与讲评</h1>' +
      '<form id="teacher-form" class="identity-form teacher-login">' +
      '<div><label for="teacher-password" class="field-label">教师密码</label>' +
      '<input id="teacher-password" class="text-input" type="password" autocomplete="off" required ' +
      'aria-describedby="teacher-message"></div><button type="submit" class="button">进入讲评</button>' +
      '<p id="teacher-message" class="feedback" role="status" hidden></p></form></section>';
  }

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
    const working = Boolean(state.authorized && state.worksheet && !state.loading);
    const priorPassage = app.querySelector("#reading-screen");
    if (priorPassage) state.readingOffset = priorPassage.scrollTop;
    const notice = state.notice ? '<p class="feedback" role="status">' + esc(state.notice) + "</p>" : "";
    const content = !state.authorized ? entry()
      : state.loading ? '<p class="empty-state panel" role="status">正在打开讲评。</p>'
      : working ? review() : renderDirectory(currentMeta());
    surface.classList.toggle("in-worksheet", working);
    account.innerHTML = state.authorized
      ? '<button type="button" class="text-action subtle-action" data-action="sign-out">退出讲评</button>' : "";
    app.innerHTML = notice + content;
    renderDocks(working);
    const passage = app.querySelector("#reading-screen");
    if (passage) {
      if (passage.dataset.readingArticle !== priorPassage?.dataset.readingArticle) state.readingOffset = 0;
      passage.scrollTop = state.readingOffset;
    }
    if (working && state.solutionShown) showSolution(true);
    else screens.connect(app);
  }

  async function loadGuide(meta) {
    const saved = guides.get(meta.id);
    if (saved) return saved;
    const path = meta.guidePath || "data/alpha-a4-teaching/" + meta.id.toLowerCase() + ".json";
    const response = await fetch(path + "?v=" + (meta.guidePath ? meta.revision : "20261116-8"));
    if (!response.ok) throw new Error("Teacher source unavailable");
    const result = await response.json();
    if (result.id !== meta.id || result.revision !== meta.revision) throw new Error("Teacher source revision mismatch");
    guides.set(meta.id, result);
    return result;
  }

  async function loadEvidence(meta, code) {
    const skill = { R: "reading", L: "listening" }[code[0]];
    if (meta.unit === specialUnit || !skill) return null;
    if (!evidenceLoads.has(skill)) {
      const asset = "data/alpha-a4-teaching/" + skill + "-evidence.json?v=20261117-4";
      evidenceLoads.set(skill, fetch(asset).then(response => {
        if (!response.ok) throw new Error("Teaching evidence unavailable");
        return response.json();
      }));
    }
    try {
      const unit = (await evidenceLoads.get(skill))[meta.id];
      if (unit?.revision !== meta.revision) throw new Error("Teaching evidence revision mismatch");
      return unit.sheets[code];
    } catch {
      evidenceLoads.delete(skill);
      return null;
    }
  }

  async function openReview(code) {
    const meta = currentMeta();
    if (!state.authorized || state.loading || !allowsWorksheet(meta, code)) return;
    const ticket = ++state.navigation;
    state.loading = true;
    state.notice = "";
    render();
    try {
      const [unit, bank, evidence] = await Promise.all([
        loadUnit(meta), loadGuide(meta), loadEvidence(meta, code)
      ]);
      if (ticket !== state.navigation) return;
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
      if (ticket === state.navigation) state.notice = "这份讲评暂时打不开，请从目录重试。";
    } finally {
      if (ticket === state.navigation) {
        state.loading = false;
        render();
        window.scrollTo(0, 0);
        app.focus({ preventScroll: true });
      }
    }
  }

  function resetView() {
    state.navigation++;
    state.loading = false;
    state.worksheet = null;
    state.solutionShown = false;
    state.notice = "";
    render();
    window.scrollTo(0, 0);
    app.focus({ preventScroll: true });
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

  surface.addEventListener("submit", async event => {
    const form = event.target;
    if (form.id !== "teacher-form") return;
    event.preventDefault();
    const button = form.querySelector("button");
    if (button.disabled) return;
    const input = form.querySelector("input");
    const message = document.getElementById("teacher-message");
    button.disabled = true;
    message.hidden = true;
    try {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input.value.trim()));
      const supplied = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
      if (supplied !== expected) {
        message.textContent = "密码不正确，请重新输入。";
        message.hidden = false;
        input.select();
        return;
      }
      try { sessionStorage.setItem(sessionKey, "1"); } catch {}
      state.authorized = true;
      resetView();
    } catch {
      message.textContent = "请从网站或本机预览地址打开后重试。";
      message.hidden = false;
    } finally {
      button.disabled = false;
    }
  });

  surface.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!state.authorized || !button) return;
    const { book, unit, task, questionNumber, step, action } = button.dataset;
    if (book) {
      state.book = Number(book);
      state.unit = 1;
      resetView();
      app.querySelector('[data-book="' + book + '"]')?.focus();
    } else if (unit) {
      state.unit = Number(unit);
      state.notice = "";
      render();
      app.querySelector('[data-unit="' + unit + '"]')?.focus();
    } else if (action === "special") {
      state.unit = specialUnit;
      state.notice = "";
      render();
      app.querySelector('[data-action="special"]')?.focus({ preventScroll: true });
    } else if (task) {
      openReview(task);
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
      resetView();
    } else if (action === "sign-out") {
      try { sessionStorage.setItem(sessionKey, ""); } catch {}
      state.authorized = false;
      resetView();
    }
  });

  try { state.authorized = sessionStorage.getItem(sessionKey) === "1"; } catch {}
  render();
})();