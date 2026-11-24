"use strict";

(function () {
  const { label, setLabel } = window.UnlockStudentUI;
  const byId = id => document.getElementById(id);
  const platform = window.UnlockSession;
  const workspaceAccess = window.UnlockWritingWorkspace;
  const signInNotice = "请用你的个人登录链接进入 UNLOCK，再点「写作复盘」。";

  const materialUrls = [];

  function releaseFigures() {
    for (const url of materialUrls.splice(0)) URL.revokeObjectURL(url);
  }

  function materialUrl(encoded, type) {
    const content = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([content], { type }));
    materialUrls.push(url);
    return url;
  }
  const notice = byId("writing-notice");
  const article = byId("writing-article");
  const studentPicker = byId("writing-student");
  const topicPicker = byId("writing-topic");
  const sourcePanel = byId("panel-source");
  const tabs = Array.from(document.querySelectorAll("[data-view]"));
  const criterionNames = {
    TA: ["Task Achievement", "任务完成度"],
    TR: ["Task Response", "任务回应"],
    CC: ["Coherence and Cohesion", "连贯与衔接"],
    LR: ["Lexical Resource", "词汇资源"],
    GRA: ["Grammatical Range and Accuracy", "语法多样性与准确性"]
  };
  const chars = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const safe = value => String(value).replace(/[&<>"']/g, char => chars[char]);
  let active;
  let workspaceId;
  let openingLink;
  let loadingTopic;
  let notes = [];

  function selectView(view) {
    for (const tab of tabs) {
      const current = tab.dataset.view === view;
      tab.setAttribute("aria-selected", String(current));
      tab.tabIndex = current ? 0 : -1;
      byId("panel-" + tab.dataset.view).hidden = !current;
    }
  }

  function noteIndex(review) {
    const editsById = new Map(review.edits.map(edit => [edit.id, edit]));
    const mentioned = new Set(review.comments.flatMap(item => item.edit_ids || []));
    const linked = review.comments.map(item => {
      const paragraph = review.paragraphs[item.paragraph];
      const offset = paragraph.indexOf(item.quote);
      const start = [...paragraph.slice(0, offset)].length;
      return { paragraph: item.paragraph, start, end: start + [...item.quote].length,
               quote: item.quote, text: item.text, edits: (item.edit_ids || []).map(id => editsById.get(id)) };
    });
    const other = review.edits.filter(edit => !mentioned.has(edit.id)).map(edit => ({
      paragraph: edit.paragraph, start: edit.start, end: edit.end, quote: edit.old,
      text: edit.reason, edits: [edit]
    }));
    return [...linked, ...other].sort((a, b) => a.paragraph - b.paragraph || a.start - b.start)
      .map((item, index) => ({ ...item, id: index + 1 }));
  }

  function markedParagraph(paragraph, index) {
    const chars = [...paragraph];
    const local = notes.filter(note => note.paragraph === index);
    const boundaries = [...new Set([0, chars.length, ...local.flatMap(note => [note.start, note.end])])]
      .sort((a, b) => a - b);
    const segments = boundaries.slice(1).map((end, i) => {
      const start = boundaries[i];
      const related = local.filter(note => start >= note.start && end <= note.end).map(note => note.id);
      const part = safe(chars.slice(start, end).join(""));
      const body = related.length ? '<span class="phrase" data-refs="' + related.join(" ") + '">' + part + "</span>" : part;
      const pins = local.filter(note => note.end === end).map(note =>
        '<button id="pin-' + note.id + '" type="button" class="pin" data-note="' + note.id +
        '" aria-label="查看批注 ' + note.id + '" aria-controls="note-' + note.id +
        '" aria-pressed="false">' + note.id + "</button>"
      );
      return body + pins.join("");
    });
    return '<p class="paragraph" data-original-text lang="en">' + segments.join("") + "</p>";
  }

  function renderNote(note) {
    const fixes = note.edits.map(edit =>
      '<span class="note-reason"><strong>' + (edit.new ? "建议改法" : "建议删去") + '</strong>' +
      (edit.new ? '<span lang="en">' + safe(edit.new) + "</span>" : "") + "</span>"
    ).join("");
    return '<article class="margin-note" id="note-' + note.id + '" data-note-card="' + note.id + '">' +
      '<button class="note-body" type="button" data-note="' + note.id + '" aria-controls="pin-' + note.id +
      '" aria-pressed="false"><span class="number">' + note.id + "</span>" +
      '<span><strong lang="en">' + safe(note.quote) + '</strong><span>' + safe(note.text) + "</span>" + fixes + "</span></button></article>";
  }

  function activateNote(id, inPaper) {
    for (const control of sourcePanel.querySelectorAll("[data-note]")) {
      control.setAttribute("aria-pressed", String(control.dataset.note === id));
    }
    for (const card of sourcePanel.querySelectorAll("[data-note-card]")) {
      card.classList.toggle("is-selected", card.dataset.noteCard === id);
    }
    for (const anchor of sourcePanel.querySelectorAll("[data-refs]")) {
      anchor.classList.toggle("is-selected", anchor.dataset.refs.split(" ").includes(id));
    }
    const target = inPaper ? byId("note-" + id).querySelector("button") : byId("pin-" + id);
    target.scrollIntoView({ block: "nearest" });
    target.focus({ preventScroll: true });
    byId("review-status").textContent = "已定位到批注 " + id + "。";
  }

  function renderAssessment(review, section) {
    const rows = Object.entries(review.criteria).map(([code, item]) =>
      '<tr><th scope="row"><span class="criterion-name">' + label(...criterionNames[code]) +
      '</span><span class="criterion-code" lang="en">' + code + '</span></th><td class="criterion-score"><span>' +
      item.score + '</span></td><td class="criterion-feedback">' + safe(review.feedback[code]) + "</td></tr>"
    ).join("");
    const count = "原文 " + review.words + " 词，" + (review.words >= review.minimum ? "达到 " : "未达到 ") +
      review.minimum + " 词要求。";
    return '<section class="assessment" aria-labelledby="assessment-' + section + '">' +
      '<header class="assessment-title"><div><h3 id="assessment-' + section + '">' +
      label("Assessment", "四项评价") + "</h3><p>" + count + "</p></div>" +
      '<div class="assessment-total"><span>' + label("Estimated Band", "单篇估分") +
      "</span><strong>" + review.band.toFixed(1) + "</strong></div></header>" +
      '<div class="assessment-frame"><table class="assessment-table"><caption class="sr-only">分项评分与评语</caption>' +
      '<colgroup><col class="criterion-col"><col class="score-col"><col></colgroup>' +
      '<thead><tr><th scope="col">评分项</th><th scope="col" class="criterion-score">分数</th><th scope="col">评语</th></tr></thead>' +
      "<tbody>" + rows + "</tbody></table></div></section>";
  }

  function renderDraft(review) {
    const content = review.paragraphs.map(markedParagraph).join("");
    const cards = notes.map(renderNote).join("");
    sourcePanel.innerHTML =
      '<div class="reading"><section class="paper" aria-labelledby="draft-heading">' +
      '<header class="paper-top"><h3 id="draft-heading">' + label("Original Draft", "学生原文") +
      "</h3><span>" + review.words + " 词</span></header>" + content +
      '</section><aside aria-labelledby="note-heading"><header class="margin-top"><h3 id="note-heading">' +
      label("Margin Notes", "页边批注") + "</h3><span>" + notes.length + ' 处</span></header><div class="notes">' +
      cards + "</div></aside></div>" + renderAssessment(review, "draft");
  }

  function renderReasoning(review) {
    const codes = [Object.hasOwn(review.criteria, "TA") ? "TA" : "TR", "CC"];
    return '<div class="actual-feedback">' + codes.map(code => {
      const item = review.criteria[code];
      const evidence = (items, title) => '<section class="writing-note"><h4>' + title + "</h4><ul>" +
        items.map(entry => '<li><blockquote class="quote" lang="en">' + safe(entry.quote) + "</blockquote>" +
          "<p>" + safe(entry.reason) + "</p></li>").join("") + "</ul></section>";
      return "<section><h3>" + label(...criterionNames[code]) + "</h3><p>" + safe(item.boundary_reason) +
        '</p><div class="feedback-examples">' + evidence(item.support, "做得好的地方") +
        evidence(item.limits, "可继续改进的地方") + "</div></section>";
    }).join("") + "</div>";
  }

  function renderLanguage(review) {
    return '<div class="actual-feedback"><h3>' + label("Local Edits", "局部修改") +
      '</h3><ol class="language-edits">' + review.edits.map(edit =>
        '<li class="writing-note"><p>原文</p><blockquote class="quote" lang="en">' + safe(edit.old) +
        "</blockquote><p>" + (edit.new ? "建议改法" : "建议删去") + "</p>" +
        (edit.new ? '<blockquote class="quote" lang="en">' + safe(edit.new) + "</blockquote>" : "") +
        "<p>" + safe(edit.reason) + "</p></li>"
      ).join("") + "</ol></div>";
  }

  function renderSummary(review) {
    const suggested = review.optional.length ? '<div class="actual-feedback"><h3>' +
      label("Next Revision", "下一稿可以试试") + "</h3><ul>" +
      review.optional.map(item =>
        '<li class="writing-note"><blockquote class="quote" lang="en">' + safe(item.quote) +
        "</blockquote><p>" + safe(item.text) + "</p></li>"
      ).join("") + "</ul></div>" : "";
    return suggested + renderAssessment(review, "summary");
  }

  function renderTopic({ topic, review }) {
    byId("task-label").textContent = "Task " + topic.task + " " + topic.date;
    setLabel(byId("task-title"), topic.en, topic.title);
    setLabel(byId("material-title"), topic.figures.length ? "Task and Charts" : "Writing Prompt",
      topic.figures.length ? "题目与图表" : "写作题目");
    byId("task-prompt").textContent = topic.prompt;
    releaseFigures();
    const panel = byId("task-figures");
    panel.classList.toggle("single", topic.figures.length === 1);
    panel.innerHTML = topic.figures.map(figure => {
      const diagram = materialUrl(figure.svg, "image/svg+xml");
      const original = materialUrl(figure.original, "image/png");
      return "<figure><figcaption>" + safe(figure.label) +
        '</figcaption><img class="question-chart" width="720" height="420" src="' + diagram + '" alt="' +
        safe(figure.label) + '"><details class="question-original"><summary>查看原图</summary>' +
        '<img loading="lazy" src="' + original + '" alt="' + safe(figure.label) + '原图"></details></figure>';
    }).join("");
    byId("task-material").open = !review;
    byId("review-pending").hidden = Boolean(review);
    byId("review-panels").hidden = !review;
    if (review) {
      notes = noteIndex(review);
      renderDraft(review);
      byId("panel-thought").innerHTML = renderReasoning(review);
      byId("panel-language").innerHTML = renderLanguage(review);
      byId("panel-summary").innerHTML = renderSummary(review);
      selectView("source");
    } else {
      notes = [];
      for (const tab of tabs) byId("panel-" + tab.dataset.view).replaceChildren();
    }
    article.hidden = false;
  }

  async function openTopic() {
    if (!active) return;
    loadingTopic?.abort();
    const controller = new AbortController();
    loadingTopic = controller;
    article.hidden = true;
    notice.textContent = "正在加载本题复盘。";
    const learner = active.viewing === "teacher" ? studentPicker.value : undefined;
    try {
      const selected = await active.select(topicPicker.value, learner, controller.signal);
      if (loadingTopic !== controller) return;
      renderTopic(selected);
      notice.textContent = "";
    } catch (error) {
      if (error.name !== "AbortError") notice.textContent = "本题暂时打不开，请重新选择题目。";
    }
  }

  function showSession(session) {
    active = session;
    byId("review-account-name").textContent = session.name;
    byId("review-close").hidden = false;
    byId("student-field").hidden = session.viewing !== "teacher";
    studentPicker.replaceChildren(...(session.students || []).map(name => new Option(name, name)));
    topicPicker.replaceChildren(...session.topics.map(topic => new Option(
      topic.date + "  Task " + topic.task + "  " + topic.title, topic.id
    )));
    const target = new URLSearchParams(location.search).get("topic");
    if (session.topics.some(topic => topic.id === target)) topicPicker.value = target;
    byId("writing-review-content").hidden = false;
    openTopic();
  }

  function clearView() {
    openingLink?.abort();
    openingLink = null;
    loadingTopic?.abort();
    loadingTopic = null;
    active = null;
    workspaceId = null;
    notes = [];
    releaseFigures();
    article.hidden = true;
    byId("writing-review-content").hidden = true;
    byId("review-close").hidden = true;
    byId("review-account-name").textContent = "";
    byId("task-title").textContent = "";
    byId("task-label").textContent = "";
    byId("task-prompt").textContent = "";
    byId("task-figures").replaceChildren();
    studentPicker.replaceChildren();
    topicPicker.replaceChildren();
    for (const tab of tabs) byId("panel-" + tab.dataset.view).replaceChildren();
  }

  function workspaceStillMatches(id) {
    return platform.current()?.id === id && Boolean(workspaceAccess.currentTicket());
  }

  async function openEntry() {
    const fragment = location.hash.slice(1);
    const code = new URLSearchParams(fragment).get("access");
    if (fragment) history.replaceState(history.state, "", location.pathname + location.search);
    clearView();

    const ticket = code === null ? workspaceAccess.currentTicket() : null;
    if (code === null && !ticket) {
      notice.textContent = signInNotice;
      return;
    }
    workspaceId = ticket ? platform.current().id : null;
    const currentWorkspace = workspaceId;
    const controller = new AbortController();
    openingLink = controller;
    notice.textContent = "正在打开写作复盘。";

    try {
      const proof = ticket || await window.UnlockWritingAccess.authorize(code, controller.signal);
      if (openingLink !== controller) return;
      if (!ticket && !workspaceAccess.matches(proof, platform.current())) workspaceAccess.forget();
      const result = await window.UnlockWritingAccess.openTicket(proof, controller.signal);
      if (openingLink !== controller) return;
      if (currentWorkspace && !workspaceStillMatches(currentWorkspace)) {
        clearView();
        notice.textContent = signInNotice;
        return;
      }
      showSession(result);
      byId("writing-review-title").focus();
    } catch (error) {
      if (openingLink !== controller || error.name === "AbortError") return;
      notice.textContent = error.message === "invalid-writing-code"
        ? "这个链接无法打开，请使用收到的原始链接。"
        : "暂时无法打开复盘，请稍后重试。";
    }
  }

  byId("review-close").addEventListener("click", () => {
    const backToWorkspace = Boolean(workspaceId && workspaceStillMatches(workspaceId));
    clearView();
    if (backToWorkspace) {
      location.assign(new URL("index.html", location.href));
      return;
    }
    notice.textContent = "已退出复盘。再次查看时，请打开你的专属链接。";
    byId("writing-review-title").focus();
  });

  studentPicker.addEventListener("change", openTopic);
  topicPicker.addEventListener("change", openTopic);
  sourcePanel.addEventListener("click", event => {
    const control = event.target.closest("[data-note]");
    if (control) activateNote(control.dataset.note, control.classList.contains("pin"));
  });

  for (const [i, tab] of tabs.entries()) {
    tab.addEventListener("click", () => selectView(tab.dataset.view));
    tab.addEventListener("keydown", event => {
      const key = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i + tabs.length - 1) % tabs.length,
                    Home: 0, End: tabs.length - 1 }[event.key];
      if (key === undefined) return;
      event.preventDefault();
      selectView(tabs[key].dataset.view);
      tabs[key].focus();
    });
  }

  platform.watch(() => {
    if (workspaceId && !workspaceStillMatches(workspaceId)) {
      clearView();
      notice.textContent = signInNotice;
    }
  });
  window.addEventListener("pagehide", clearView);
  window.addEventListener("pageshow", event => { if (event.persisted) openEntry(); });
  window.addEventListener("hashchange", openEntry);
  openEntry();
})();
