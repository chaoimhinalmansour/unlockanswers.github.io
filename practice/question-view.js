"use strict";

(function () {
  const { escapeHTML: esc, displayAnswer, displayKeys } = window.UnlockRules;

  const { isSpeaking, clipTime } = window.UnlockRecordings;
  const { controls: screenControls } = window.UnlockScreens;
  const ui = window.UnlockStudentUI;
  const label = (en, zh) => ui ? ui.label(en, zh) : esc(zh);
  const kinds = {
    "判断": "True or False",
    "单词听写": "Word Dictation",
    "单选": "Single Choice",
    "双选": "Multiple Choice",
    "参考表达": "Model Response",
    "句子排序": "Order Sentences",
    "填空": "Fill in the Blank",
    "摘要填空": "Summary Completion",
    "朗读单词": "Read Words Aloud",
    "朗读句子": "Read Sentences Aloud",
    "标题匹配": "Match Headings",
    "段落匹配": "Match Paragraphs",
    "看图写话": "Picture Writing",
    "看图表达": "Picture Description",
    "补全表达": "Complete the Response",
    "观点写作": "Opinion Writing",
    "词义匹配": "Match Meanings",
    "词块组句": "Build a Sentence",
    "词库填空": "Fill from a Word Bank",
    "连词成句": "Arrange Words",
    "选择句序": "Choose Sentence Order",
    "选词填空": "Choose a Word",
    "音频匹配": "Match Audio"
  };
  const outcomeLabels = { correct: "Correct", incorrect: "Incorrect", blank: "Unanswered", ungraded: "Response Saved" };
  const discipline = { L: "听力", S: "口语", R: "阅读", W: "写作" };
  const outcomes = { correct: "答对", incorrect: "答错", blank: "未作答", ungraded: "只记录作答" };
  const speakingNotesHint = "可记下关键词、回答顺序和一个例子，录音时用这些笔记提醒自己。";
  const readingAloudHints = {
    朗读单词: "可记下容易读错的音和单词重音，录音前用这些笔记提醒自己。",
    朗读句子: "可记下容易读错的词，并标出重音和停顿，帮助你先练一遍。"
  };

  const englishNotes = {
    朗读单词: "Note tricky sounds and word stress before you record.",
    朗读句子: "Mark tricky words, stress and pauses. Practise once before recording."
  };

  function sectionName(key) {
    return discipline[key[0]];
  }

  function arrayValue(value) {
    return Array.isArray(value) ? value : [];
  }

  function answerLine(name, text, extra = "", english = "") {
    return '<div class="answer-line ' + extra + '"><strong>' + (english ? label(english, name) : esc(name)) +
      "</strong><p>" + (text ? esc(text) : label("Unanswered", "未作答")) + "</p></div>";
  }

  function renderOrder(question, value) {
    const current = arrayValue(value);
    const optionText = ([key, label]) => question.orderedSentences ? key + "  " + label : label;
    const buttons = question.options.map(option => {
      const key = option[0];
      return '<button type="button" class="part-button" data-order-add="' + esc(key) + '"' +
        (current.includes(key) ? " disabled" : "") + ">" + esc(optionText(option)) + "</button>";
    }).join("");
    const selected = current.map((key, index) => {
      const option = question.options.find(item => item[0] === key);
      if (!option) return "";
      const title = esc(optionText(option));
      const shift = (direction, disabled, name) =>
        '<button type="button" class="part-shift" data-order-shift="' + direction + '" data-part="' + esc(key) +
        '" aria-label="' + name + " " + title + '"' + (disabled ? " disabled" : "") + ">" + name + "</button>";
      return '<li class="selected-part"><button type="button" class="part-button" data-order-remove="' +
        esc(key) + '" aria-label="撤回 ' + title + '">' + title + "</button>" +
        '<span class="shift-buttons">' + shift(-1, index === 0, "前移") +
        shift(1, index === current.length - 1, "后移") + "</span></li>";
    }).join("");
    const start = question.fixedStart
      ? '<strong class="fixed-response-start" aria-label="给定句首">' + esc(question.fixedStart) + "</strong>"
      : "";
    return '<div class="order-wrap' + (question.orderedSentences ? ' sentences' : '') +
      '" role="group" aria-labelledby="stem-' + esc(question.id) +
      '"><p class="small">' + label("Select the parts, then rearrange them or click one to remove it.",
        "点选词块后，可以前移、后移或点击撤回。") + '</p><div class="part-pool">' +
      buttons + '</div><div class="part-sequence" aria-label="已选顺序">' + start +
      (selected ? '<ol class="selected-parts">' + selected + "</ol>" : '<span class="order-label">' + label("Your Order", "作答顺序") + '</span>') + "</div></div>";
  }

  function renderInput(question, value) {
    const id = esc(question.id);
    const association = ' aria-labelledby="stem-' + id + '"';
    if (question.type === "text") {
      return '<input type="text" class="text-input"' + association + ' data-answer="' + id +
        '" autocomplete="off" spellcheck="false" value="' + esc(value) + '">';
    }
    if (question.type === "open") {
      const speaking = isSpeaking(question);
      const accessibleName = speaking ? ' aria-label="Speaking Notes (Optional) 口语笔记（可选）"' : association;
      const prefix = question.responsePrefix
        ? '<p id="response-prefix" class="fixed-response-start" lang="en">' + esc(question.responsePrefix) + "</p>"
        : "";
      const description = prefix ? ' aria-describedby="response-prefix"' : "";
      const hintAttributes = speaking ? ' placeholder=" " aria-describedby="notes-hint"' : "";
      const field = '<textarea id="response-screen" data-screen-view' + accessibleName +
        (speaking ? hintAttributes : description) + ' data-answer="' + id + '" spellcheck="false">\n' + esc(value) + "</textarea>";
      const paging = screenControls("response-screen", speaking ? "口语笔记" : "作答文字");
      if (!speaking) return prefix + field + paging;
      const hint = label(englishNotes[question.kind] ?? "Note key words, the order of your ideas, and one example to use when recording.",
        readingAloudHints[question.kind] ?? speakingNotesHint);
      return '<details class="optional-notes-box" data-notes-fit="' + id + '"' + (value?.trim() ? " open" : "") +
        '><summary>' + label("Speaking Notes (Optional)", "口语笔记（可选）") + '</summary>' + prefix +
        '<div class="notes-pad">' + field + '<p id="notes-hint">' + hint + '</p></div>' + paging + "</details>";
    }
    if (question.type === "order") return renderOrder(question, value);
    if (question.type === "select") {
      return '<select' + association + ' data-answer="' + id + '"><option value="">' + (ui ? "Choose an option 请选择" : "请选择") + '</option>' +
        question.options.map(([key]) => '<option value="' + esc(key) + '"' +
          (key === value ? " selected" : "") + ">" + esc(displayAnswer(question, key)) + "</option>").join("") +
        "</select>";
    }

    const multiple = question.type === "multi";
    const selected = multiple ? arrayValue(value) : [value];
    return '<div class="options" role="group"' + association + ">" + question.options.map(([key]) => {
      const active = selected.includes(key);
      const checked = active ? " checked" : "";
      const disabled = multiple && !active && selected.length === question.pick ? " disabled" : "";
      return '<label class="option"><input type="' + (multiple ? "checkbox" : "radio") +
        '" name="' + id + '" data-answer="' + id + '" value="' + esc(key) + '"' + checked + disabled +
        '><span>' + esc(displayAnswer(question, key)) + "</span></label>";
    }).join("") + "</div>";
  }

  function savedClip(clip, english, chinese) {
    const time = clipTime(clip.durationMs);
    return '<div class="voice-clip"><p class="clip-label">' + label(english + " " + time, chinese + " " + time) +
      '</p><audio controls preload="none" data-clip="' +
      esc(clip.id) + '" aria-label="' + esc(english + " " + chinese) + '"></audio></div>';
  }

  function voiceHTML(question, attempt) {
    if (!isSpeaking(question)) return "";
    const { first, second, draftRecordings } = attempt;
    const before = first?.recordings?.[question.id];
    const current = second ? second.recordings?.[question.id]
      : draftRecordings?.[question.id] || before;
    const previous = before && before.id !== current?.id ? savedClip(before, "First Recording", "首次录音") : "";
    const revised = second && !attempt.selfCheckedAt ? ["Second Recording", "二次录音"] : ["New Recording", "主动重录"];
    const status = current && before?.id === current.id ? ["First Recording Kept", "沿用首次录音"]
      : first ? revised : ["Your Recording", "本题录音"];
    const controls = second ? "" : '<div class="voice-controls">' +
      '<button type="button" class="button secondary ui-action' + (current ? "" : " ui-primary") + '" data-record-start>' +
      (current ? label("Record Again", "重录本题") : label("Start Recording", "开始录音")) + '</button>' +
      '<button type="button" class="button ui-action ui-primary" data-record-stop hidden>' + label("Stop Recording", "结束录音") + '</button>' +
      '<span class="voice-timer" data-voice-timer hidden>0:00</span></div>';
    return '<div class="voice-field" data-voice-question="' + esc(question.id) + '">' + previous +
      (current ? savedClip(current, ...status) : second ? '<p>' + label("No recording saved.", "这次作答没有录音。") + '</p>' : "") +
      controls + '<p class="voice-message" data-voice-message role="status" hidden></p></div>';
  }

  function promptHTML(question, title = esc(question.prompt)) {
    return '<h2 class="q-prompt" id="stem-' + esc(question.id) + '">' + title + "</h2>";
  }

  function opinionNotes(question) {
    const { notes } = question;
    if (question.type !== "open" || question.kind !== "观点写作" || !notes?.length) return "";
    const pros = notes.findIndex(note => note.startsWith("Pros:"));
    const cons = notes.findIndex(note => note.startsWith("Cons:"));
    if (pros < 0 || cons <= pros + 1 || cons >= notes.length - 1) return "";

    const renderSide = (heading, end) => '<section class="opinion-side"><h3>' + esc(notes[heading]) +
      "</h3><ul>" + notes.slice(heading + 1, end).map(note => "<li>" + esc(note) + "</li>").join("") +
      "</ul></section>";
    const context = notes.slice(0, pros).map(note =>
      '<p class="opinion-context" lang="en">' + esc(note) + "</p>").join("");
    return context + '<div class="opinion-sides" lang="en">' +
      renderSide(pros, cons) + renderSide(cons, notes.length) + "</div>";
  }

  function questionDetails(question, formattedNotes = "") {
    const notes = formattedNotes || (question.notes?.length ? '<div class="q-notes">' +
      question.notes.map(note => '<p class="q-note">' + esc(note) + "</p>").join("") + "</div>" : "");
    const bank = question.bank ? '<ol class="bank" type="A">' +
      question.bank.map(([, sentence]) => "<li>" + esc(sentence) + "</li>").join("") + "</ol>" : "";
    const instruction = question.instruction ? '<p class="question-instruction" lang="en">' +
      esc(question.instruction) + "</p>" : "";
    return notes + bank + instruction;
  }

  function card(question, unit, status, statusClass, content, footer = "") {
    const track = question.audio?.length === 1 ? question.audioLabel || unit.audio[question.audio[0]].label : null;
    const count = question.audio?.length;
    const audioLabel = track ? label("Audio " + track, "录音 " + track)
      : count ? label(count + " audio tracks", count + " 段候选录音") : "";
    const number = label("Question " + question.number + " " + (kinds[question.kind] || question.kind),
      "第 " + question.number + " 题 " + question.kind);
    return '<article class="question question-card" tabindex="-1" id="item-' + esc(question.id) +
      '" data-question="' + esc(question.id) + '"><div class="question-meta"><span class="q-number">' +
      number + '</span><div class="question-tags">' +
      (audioLabel ? '<span class="q-status ungraded">' + audioLabel + "</span>" : "") +
      (status ? '<span class="q-status ' + statusClass + '">' + status + "</span>" : "") +
      '</div></div><div class="question-pane"><div id="question-screen" class="screen-view" data-screen-view ' +
      'tabindex="0" aria-label="当前题内容"><div class="screen-content">' + content +
      "</div></div>" + screenControls("question-screen", "当前题") + "</div>" + footer + "</article>";
  }

  function markEvidence(paragraph, text, ranges, className) {
    if (!ranges.length) {
      if (paragraph.childElementCount) paragraph.textContent = text;
      return;
    }
    const parts = [];
    let offset = 0;
    for (const [, start, end] of ranges) {
      const mark = document.createElement("mark");
      mark.className = className;
      mark.textContent = text.slice(start, end);
      parts.push(text.slice(offset, start), mark);
      offset = end;
    }
    paragraph.replaceChildren(...parts, text.slice(offset));
  }

  function renderSolution(question, guide) {
    const answer = answerLine(question.type === "open" ? "参考答案" : "答案", guide.answer, "key teaching-answer");
    const reasons = '<section class="teaching-explanation"><h3 class="aside-title">解析</h3>' +
      guide.explanation.map(line => "<p>" + esc(line) + "</p>").join("") +
      guide.evidence.map(line => "<blockquote>" + esc(line) + "</blockquote>").join("") + "</section>";
    return answer + reasons;
  }

  function renderReviewQuestion(question, unit, summary) {
    const options = question.options?.length
      ? '<ul class="teaching-options" aria-label="题目选项">' +
        question.options.map(([key]) => "<li>" + esc(displayAnswer(question, key)) + "</li>").join("") + "</ul>"
      : "";
    const prefix = question.responsePrefix
      ? '<p class="fixed-response-start" lang="en">' + esc(question.responsePrefix) + "</p>" : "";
    const content = promptHTML(question) + questionDetails(question) + summary + options + prefix +
      '<div id="teaching-solution" hidden></div>';
    return card(question, unit, "", "", content);
  }

  function renderQuestion(question, unit, attempt, summary = "") {
    const { first, second, draft } = attempt;
    const firstResult = first?.results[question.id];
    const result = second?.results[question.id];
    const locked = firstResult === "correct" && !second;
    const value = second ? second.answers[question.id] : draft[question.id];
    const notesOnly = isSpeaking(question) && question.type === "open";

    const status = result ? label(outcomeLabels[result], outcomes[result]) : locked ? label("Correct and Locked", "首次答对，已锁定")
      : firstResult === "incorrect" ? label("Needs Correction", "待订正")
      : firstResult === "blank" ? label("Unanswered", "首次未完成")
      : question.type === "open" ? label("Open Response", "开放题") : "";
    const statusClass = result || firstResult || "ungraded";

    const firstValue = first?.answers[question.id];
    let partialFeedback = "";
    if (!second && !locked && question.type === "multi" && Array.isArray(firstValue)) {
      const matched = Math.max(0, ...question.keys.map(key => key.filter(option => firstValue.includes(option)).length));
      if (matched) {
        partialFeedback = '<p class="question-instruction" data-multi-feedback>' +
          label("You chose " + matched + " of the " + question.pick + " correct options on your first attempt.",
            "首次选对 " + matched + " 项，本题需选 " + question.pick + " 项。") + '</p>';
      }
    }
    const firstLine = first && (!notesOnly || firstValue)
      ? answerLine(notesOnly ? "首次口语笔记" : "首次作答", displayAnswer(question, firstValue), "",
        notesOnly ? "First Speaking Notes" : "First Response") : "";
    const secondLine = second && (!notesOnly || value)
      ? answerLine(notesOnly ? "二次口语笔记" : "二次作答", displayAnswer(question, value), "",
        notesOnly ? "Final Speaking Notes" : "Final Response") : "";
    const lengthyDraft = question.type === "open" && firstValue &&
      (firstValue.length > 220 || firstValue.split("\n").length > 4);
    const priorResponse = lengthyDraft ? '<details class="previous-draft"><summary>' +
      (notesOnly ? label("View First Notes", "查看首次口语笔记") : label("View First Response", "查看首次作答")) + "</summary><p>" +
      esc(displayAnswer(question, firstValue)) + "</p></details>" : firstLine;
    const comparison = second ? '<div class="answer-comparison">' + firstLine + secondLine +
      (question.type === "open" ? "" : answerLine("正确答案", displayKeys(question), "key", "Correct Answer")) + "</div>"
      : priorResponse;
    const opinion = opinionNotes(question);
    const editorBelow = Boolean(opinion && !locked && !second);
    const field = locked || second ? "" : '<div class="control' + (editorBelow ? " opinion-editor" : "") + '">' +
      (summary || renderInput(question, value)) + "</div>";
    const prompt = promptHTML(question, summary && !locked && !second ? label("Summary Completion", "摘要填空") : undefined);
    const content = prompt + questionDetails(question, opinion) + comparison + partialFeedback + (editorBelow ? "" : field);
    const footer = (editorBelow ? field : "") + voiceHTML(question, attempt);
    return card(question, unit, status, statusClass, content, footer);
  }

  window.UnlockWorksheet = { sectionName, renderQuestion, renderReviewQuestion, renderSolution, markEvidence, renderOrder, voiceHTML };
})();
