"use strict";

(function () {
  const { escapeHTML: esc, displayAnswer, displayKeys } = window.UnlockRules;
  const { renderQuestion, renderReviewQuestion } = window.UnlockWorksheet;
  const { controls: screenControls } = window.UnlockScreens;

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

  function isDictation(worksheet, question) {
    if (!question) return false;
    if (worksheet?.dictationItems?.length) return worksheet.dictationItems.some(item => item.id === question.id);
    return Boolean(worksheet?.dictation && question.number <= worksheet.dictation.count);
  }

  function questionStops(worksheet, visible) {
    if (!worksheet.dictation && !worksheet.dictationItems?.length) return visible;
    const first = visible.find(q => isDictation(worksheet, q));
    return visible.filter(q => q === first || !isDictation(worksheet, q));
  }

  function navigation(worksheet, visible, attempt, current, all, answered) {
    const correction = attempt?.first && !attempt.second;
    const hasOpen = visible.some(q => q.type === "open");
    const restrictedTitle = hasOpen ? "待订正与开放题" : "待订正题号";
    const title = correction && !all ? restrictedTitle : "题号";
    const toggle = correction ? '<button type="button" class="text-action subtle-action" data-action="toggle-all">' +
      (all ? "只看" + restrictedTitle : "查看全部题目") + "</button>" : "";
    const chips = questionStops(worksheet, visible).map(q => {
      if (isDictation(worksheet, q)) {
        const beginning = worksheet.dictationItems?.[0]?.number ?? 1;
        const ending = worksheet.dictationItems?.at(-1)?.number ?? worksheet.dictation.count;
        const range = "听写 " + beginning + (ending === beginning ? "" : " 至 " + ending);
        const active = isDictation(worksheet, current) ? ' aria-current="step"' : "";
        return '<button type="button" class="question-chip dictation-chip" data-dictation-nav data-question-number="' +
          q.number + '"' + active + ">" + range + "</button>";
      }
      const [style, name] = attempt ? questionState(q, attempt, answered(q)) : ["", ""];
      const label = "第 " + q.number + " 题" + (name ? "，" + name : "");
      return '<button type="button" class="question-chip ' + style + '" data-question-number="' + q.number +
        '" aria-label="' + label + '"' + (q === current ? ' aria-current="step"' : "") +
        ">" + q.number + "</button>";
    }).join("");
    const firstResults = correction ? Object.values(attempt.first.results) : [];
    const gradeable = firstResults.filter(result => result !== "ungraded");
    const firstScore = gradeable.length ? '<p class="rail-score">首次答对 ' +
      gradeable.filter(result => result === "correct").length + " / " + gradeable.length + "</p>" : "";
    return '<section class="question-rail"><div class="rail-head"><h2 class="aside-title">' + title + "</h2>" +
      toggle + "</div>" + firstScore + '<nav class="question-chips" aria-label="' +
      (attempt ? "作答题号" : "讲评题号") + '">' + chips + "</nav></section>";
  }

  function readingSource(worksheet, question) {
    const { sheet } = worksheet;
    return sheet.articles ? sheet.articles[question?.article] : sheet;
  }

  function material(worksheet, question, preferences) {
    if (question?.picture) {
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
    const source = readingSource(worksheet, question);
    if (!source?.passages?.length) return "";
    const text = source.passages.map(p =>
      '<div class="passage" lang="en"><strong>' + esc(p.label) + '</strong><p>' + esc(p.text) + "</p></div>"
    ).join("");
    const title = source.passageTitle;
    const article = question?.article === undefined ? "" : 'data-reading-article="' + esc(question.article) + '" ';
    return '<section class="material-card reading-material" id="reading-material"><div class="rail-head">' +
      '<h2 class="aside-title">阅读原文</h2></div><div id="reading-screen" class="reading-text screen-view" ' +
      article + 'data-screen-view tabindex="0" aria-label="阅读原文"><div class="screen-content">' +
      (title ? '<h3 class="passage-title" lang="en">' + esc(title) + "</h3>" : "") + text +
      "</div></div>" + screenControls("reading-screen", "阅读原文") + "</section>";
  }

  function summaryBlock(questions, current, attempt, editable) {
    if (!current.summary?.length) return "";
    const rows = current.summary.map(raw => {
      const safe = esc(raw).replace(/\((\d+)\)\s*_{3,}/g, (token, digits) => {
        const n = Number(digits);
        const q = questions.find(question => question.number === n);
        if (!q) return token;
        const value = attempt?.second?.answers[q.id] ?? attempt?.draft[q.id];
        const answer = displayAnswer(q, value);
        if (q === current && editable?.(q)) {
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

  function dictationAnswer(label, value, className = "") {
    return "<dt>" + label + '</dt><dd class="' + className + '" lang="en">' + esc(value || "未作答") + "</dd>";
  }

  function dictationCard(worksheet, attempt, visible, editable) {
    const { first, second, draft } = attempt;
    const intro = second ? "查看两次作答和正确答案。" : first
      ? "每道待订正题可单独重听一次。"
      : "音频会报题号，每个单词读两次。听到题号后，在对应的答题框填写一个单词。";
    const items = visible.filter(q => isDictation(worksheet, q)).map(q => {
      const id = esc(q.id);
      const number = '<span class="dictation-number">' + q.number + "</span>";
      const before = first?.answers[q.id];
      const firstAnswer = first ? dictationAnswer("首次", before) : "";
      let field;
      if (second) {
        field = number + '<dl class="dictation-answers">' + firstAnswer +
          dictationAnswer("二次", second.answers[q.id]) +
          dictationAnswer("答案", displayKeys(q), "dictation-key") + "</dl>";
      } else if (editable(q)) {
        const replay = first ? '<button type="button" class="text-action dictation-replay" data-dictation-replay="' +
          id + '" data-replay-number="' + q.number + '" aria-label="重听第 ' + q.number + ' 题听写" disabled>重听</button>' : "";
        field = '<label class="dictation-number" for="dictation-' + id + '">' + q.number + "</label>" +
          '<input id="dictation-' + id + '" class="text-input" type="text" aria-label="听写第 ' + q.number +
          ' 题" lang="en" data-dictation-answer data-answer="' + id +
          '" autocomplete="off" autocapitalize="none" spellcheck="false" enterkeyhint="next" value="' +
          esc(draft[q.id]) + '">' + (first ? '<dl class="dictation-answers">' + firstAnswer + "</dl>" : "") + replay;
      } else {
        field = number + '<div class="dictation-locked"><span lang="en">' + esc(before) + "</span><small>已锁定</small></div>";
      }
      return '<li class="dictation-item" id="item-' + id + '" data-question="' + id + '" tabindex="-1">' + field + "</li>";
    }).join("");
    return '<section class="question-card dictation-card" aria-labelledby="dictation-title">' +
      '<div class="question-pane"><div id="question-screen" class="screen-view" data-screen-view tabindex="0" ' +
      'aria-label="听写作答区"><div class="screen-content"><h2 id="dictation-title" class="q-prompt">单词听写</h2>' +
      '<p class="dictation-intro">' + intro + '</p><ol class="dictation-fields' +
      (second ? " is-result" : "") + '">' + items + "</ol></div></div>" +
      screenControls("question-screen", "听写作答区") + "</div></section>";
  }

  function render(worksheet, attempt, view) {
    const { current, visible, all, largePicture, answered, editable, teaching } = view;
    const wordMode = view.wordDictation && isDictation(worksheet, current);
    const source = wordMode ? "" : material(worksheet, current, { largePicture });
    const rail = navigation(worksheet, visible, attempt, current, all, answered);
    const summary = current ? summaryBlock(worksheet.questions, current, attempt, editable) : "";
    const question = teaching ? renderReviewQuestion(current, worksheet.unit, summary) :
      wordMode ? '<section class="question-card word-dictation-card" aria-label="逐词听写">' +
        '<div class="word-dictation" data-word-dictation tabindex="0"></div></section>' :
      isDictation(worksheet, current) ? dictationCard(worksheet, attempt, visible, editable) :
      current ? renderQuestion(current, worksheet.unit, attempt, summary) :
      '<section class="question-card empty-question"><h2>本份作业无需订正</h2><p>可以查看全部题目，或再次提交。</p></section>';
    const layout = source ? " with-material" : "";
    const wide = largePicture && current?.picture ? " wide-picture" : "";
    return '<div class="workspace' + layout + wide + '">' + rail +
      (source ? '<aside class="workspace-source">' + source + "</aside>" : "") +
      '<div class="workspace-question">' + question + "</div></div>";
  }

  window.UnlockWorkbench = { render, applyQuestionState, readingSource, isDictation, questionStops };
})();
