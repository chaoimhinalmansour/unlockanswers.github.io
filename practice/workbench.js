"use strict";

(function () {
  const { escapeHTML: esc, displayAnswer } = window.UnlockRules;
  const { renderQuestion } = window.UnlockWorksheet;

  function questionState(question, attempt, answered) {
    if (attempt.second) {
      const result = attempt.second.results[question.id];
      if (result === "correct") return ["done", "答对"];
      if (result === "ungraded") return ["done", "已记录"];
      return ["needs", "答错"];
    }
    if (attempt.first) {
      if (attempt.first.results[question.id] === "correct") return ["done", "已锁定"];
      if (question.type !== "open") return answered ? ["done", "已填写订正"] : ["needs", "待订正"];
    }
    return answered ? ["done", "已作答"] : ["", "未作答"];
  }

  function applyQuestionState(button, question, attempt, focused, answered) {
    const [style, name] = questionState(question, attempt, answered);
    button.classList.toggle("done", style === "done");
    button.classList.toggle("needs", style === "needs");
    button.setAttribute("aria-label", "第 " + question.number + " 题，" + name);
    if (focused) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  }

  function navigation(visible, attempt, current, all, answered) {
    const correction = attempt.first && !attempt.second;
    const hasOpen = visible.some(q => q.type === "open");
    const restrictedTitle = hasOpen ? "待订正与开放题" : "待订正题号";
    const title = correction && !all ? restrictedTitle : "题号";
    const toggle = correction ? '<button type="button" class="text-action subtle-action" data-action="toggle-all">' +
      (all ? "只看" + restrictedTitle : "查看全部题目") + "</button>" : "";
    const chips = visible.map(q => {
      const [style, name] = questionState(q, attempt, answered(q));
      return '<button type="button" class="question-chip ' + style + '" data-question-number="' + q.number +
        '" aria-label="第 ' + q.number + ' 题，' + name + '"' + (q === current ? ' aria-current="step"' : "") +
        ">" + q.number + "</button>";
    }).join("");
    const firstResults = correction ? Object.values(attempt.first.results) : [];
    const gradeable = firstResults.filter(result => result !== "ungraded");
    const firstScore = gradeable.length ? '<p class="rail-score">首次答对 ' +
      gradeable.filter(result => result === "correct").length + " / " + gradeable.length + "</p>" : "";
    return '<section class="question-rail"><div class="rail-head"><h2 class="aside-title">' + title + "</h2>" +
      toggle + "</div>" + firstScore + '<nav class="question-chips" aria-label="作答题号">' + chips + "</nav></section>";
  }

  function material(worksheet, question, preferences) {
    if (!question) return "";
    if (question.picture) {
      const numbers = worksheet.questions.filter(q => q.picture === question.picture).map(q => q.number);
      const range = numbers.length > 1 ? "第 " + numbers[0] + " 至 " + numbers.at(-1) + " 题共用图片"
        : "第 " + numbers[0] + " 题配图";
      return '<section class="material-card picture-material' + (preferences.largePicture ? " expanded" : "") +
        '"><div class="rail-head"><h2 class="aside-title">看图材料</h2>' +
        '<button type="button" class="text-action subtle-action" data-action="expand-photo" aria-expanded="' +
        preferences.largePicture + '">' + (preferences.largePicture ? "收起图片" : "放大图片") +
        '</button></div><figure><img src="../' + esc(question.picture) +
        '" alt="题组配图"><figcaption>' + esc(range) + "</figcaption></figure></section>";
    }
    if (!worksheet.sheet.passages.length) return "";
    const text = worksheet.sheet.passages.map(p =>
      '<div class="passage" lang="en"><strong>' + esc(p.label) + '</strong><p>' + esc(p.text) + "</p></div>"
    ).join("");
    const title = worksheet.sheet.passageTitle;
    return '<details class="material-card reading-material" id="reading-material"' + (preferences.readingOpen ? " open" : "") +
      '><summary>阅读原文</summary><div class="reading-text">' +
      (title ? '<h3 class="passage-title" lang="en">' + esc(title) + "</h3>" : "") + text + "</div></details>";
  }

  function summaryBlock(questions, current, attempt, editable) {
    if (!current.summary?.length) return "";
    const rows = current.summary.map(raw => {
      const safe = esc(raw).replace(/\((\d+)\)\s*_{3,}/g, (token, digits) => {
        const n = Number(digits);
        const q = questions.find(question => question.number === n);
        if (!q) return token;
        const value = attempt.second?.answers[q.id] ?? attempt.draft[q.id];
        const answer = displayAnswer(q, value);
        if (q === current && editable(q)) {
          return '<label class="summary-blank current"><span>' + n +
            '</span><input aria-label="摘要第 ' + n + ' 空" data-answer="' + esc(q.id) +
            '" autocomplete="off" spellcheck="false" value="' + esc(answer) + '"></label>';
        }
        return '<button type="button" class="summary-blank' + (q === current ? " current" : "") +
          '" data-question-number="' + n + '" aria-label="跳到摘要第 ' + n + ' 空"><span>' + n +
          "</span> " + esc(answer || "____") + "</button>";
      });
      return "<p>" + safe + "</p>";
    }).join("");
    return '<div class="inline-summary" lang="en">' + rows + "</div>";
  }

  function render(worksheet, attempt, view) {
    const { current, visible, all, readingOpen, largePicture, answered, editable } = view;
    const source = material(worksheet, current, { readingOpen, largePicture });
    const rail = navigation(visible, attempt, current, all, answered);
    const summary = current ? summaryBlock(worksheet.questions, current, attempt, editable) : "";
    const question = current ? renderQuestion(current, worksheet.unit, attempt, summary) :
      '<section class="question-card empty-question"><h2>本份作业无需订正</h2><p>可以查看全部题目，或再次提交。</p></section>';
    return '<div class="workspace' + (largePicture && current?.picture ? " wide-picture" : "") +
      '"><aside class="workspace-side"><div class="workspace-source">' + source +
      "</div>" + rail + '</aside><div class="workspace-question">' + question + "</div></div>";
  }

  window.UnlockWorkbench = { render, applyQuestionState };
})();
