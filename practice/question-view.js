"use strict";

(function () {
  const { escapeHTML: esc, displayAnswer, displayKeys } = window.UnlockRules;

  const { isSpeaking, clipTime } = window.UnlockRecordings;
  const discipline = { L: "听力", S: "口语", R: "阅读", W: "写作" };
  const outcomes = { correct: "答对", incorrect: "答错", blank: "未作答", ungraded: "只记录作答" };

  function sectionName(key) {
    return discipline[key[0]];
  }

  function arrayValue(value) {
    return Array.isArray(value) ? value : [];
  }

  function answerLine(label, text, extra = "") {
    return '<div class="answer-line ' + extra + '"><strong>' + esc(label) +
      "</strong><p>" + esc(text || "未作答") + "</p></div>";
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
    return '<div class="order-wrap' + (question.orderedSentences ? ' sentences' : '') +
      '" role="group" aria-labelledby="stem-' + esc(question.id) +
      '"><p class="small">点选词块后，可以前移、后移或点击撤回。</p><div class="part-pool">' +
      buttons + '</div><div class="part-sequence" aria-label="已选顺序">' +
      (selected ? '<ol class="selected-parts">' + selected + "</ol>" : '<span class="order-label">作答顺序</span>') + "</div></div>";
  }

  function renderInput(question, value) {
    const id = esc(question.id);
    const label = ' aria-labelledby="stem-' + id + '"';
    if (question.type === "text") {
      return '<input type="text" class="text-input"' + label + ' data-answer="' + id +
        '" autocomplete="off" spellcheck="false" value="' + esc(value) + '">';
    }
    if (question.type === "open") {
      const speaking = isSpeaking(question);
      const accessibleName = speaking ? ' aria-label="口语笔记（可选）"' : label;
      const field = '<textarea' + accessibleName + ' data-answer="' + id +
        '" spellcheck="false">\n' + esc(value) + "</textarea>";
      if (!speaking) return field;
      return '<details class="optional-notes-box"' + (value?.trim() ? " open" : "") +
        '><summary>口语笔记（可选）</summary>' + field + "</details>";
    }
    if (question.type === "order") return renderOrder(question, value);
    if (question.type === "select") {
      return '<select' + label + ' data-answer="' + id + '"><option value="">请选择</option>' +
        question.options.map(([key]) => '<option value="' + esc(key) + '"' +
          (key === value ? " selected" : "") + ">" + esc(displayAnswer(question, key)) + "</option>").join("") +
        "</select>";
    }

    const multiple = question.type === "multi";
    const selected = multiple ? arrayValue(value) : [value];
    return '<div class="options" role="group"' + label + ">" + question.options.map(([key]) => {
      const active = selected.includes(key);
      const checked = active ? " checked" : "";
      const disabled = multiple && !active && selected.length === question.pick ? " disabled" : "";
      return '<label class="option"><input type="' + (multiple ? "checkbox" : "radio") +
        '" name="' + id + '" data-answer="' + id + '" value="' + esc(key) + '"' + checked + disabled +
        '><span>' + esc(displayAnswer(question, key)) + "</span></label>";
    }).join("") + "</div>";
  }

  function savedClip(clip, label) {
    return '<p class="clip-label">' + esc(label) + '　' +
      clipTime(clip.durationMs) + '</p><audio controls preload="none" data-clip="' +
      esc(clip.id) + '" aria-label="' + esc(label) + '"></audio>';
  }

  function voiceHTML(question, attempt) {
    if (!isSpeaking(question)) return "";
    const { first, second, draftRecordings } = attempt;
    const before = first?.recordings?.[question.id];
    const locked = first?.results[question.id] === "correct";
    const current = second ? second.recordings?.[question.id]
      : locked ? before : draftRecordings?.[question.id];
    const previous = before && (second || !locked) && before.id !== current?.id
      ? savedClip(before, "首次录音") : "";
    const status = locked && !second ? "首次录音" : current && before?.id === current.id
      ? "沿用首次录音" : first ? "二次录音" : "本题录音";
    const controls = second || locked ? "" : '<div class="voice-controls">' +
      '<button type="button" class="button secondary" data-record-start>' +
      (current ? "重录本题" : "开始录音") + '</button>' +
      '<button type="button" class="button" data-record-stop hidden>结束录音</button>' +
      '<span class="voice-timer" data-voice-timer hidden>0:00</span></div>';
    return '<div class="voice-field" data-voice-question="' + esc(question.id) + '">' + previous +
      (current ? savedClip(current, status) : second || locked ? '<p>这次作答没有录音。</p>' : "") +
      controls + '<p class="voice-message" data-voice-message role="status" hidden></p></div>';
  }

  function renderQuestion(question, unit, attempt, summary = "") {
    const { first, second, draft } = attempt;
    const firstResult = first?.results[question.id];
    const result = second?.results[question.id];
    const locked = firstResult === "correct" && !second;
    const value = second ? second.answers[question.id] : draft[question.id];
    const notesOnly = isSpeaking(question) && question.type === "open";

    const status = result ? outcomes[result] : locked ? "首次答对，已锁定"
      : firstResult === "incorrect" ? "待订正"
      : firstResult === "blank" ? "首次未完成"
      : question.type === "open" ? "开放题" : "";
    const statusClass = result || firstResult || "ungraded";

    const notes = question.notes?.length ? '<div class="q-notes">' +
      question.notes.map(note => '<p class="q-note">' + esc(note) + "</p>").join("") + "</div>" : "";
    const bank = question.bank ? '<ol class="bank" type="A">' +
      question.bank.map(([, sentence]) => "<li>" + esc(sentence) + "</li>").join("") + "</ol>" : "";
    const audioLabel = question.audio?.length === 1 ? "录音 " + (question.audioLabel || unit.audio[question.audio[0]].label)
      : question.audio?.length ? question.audio.length + " 段候选录音" : "";
    const instruction = question.instruction ? '<p class="question-instruction" lang="en">' +
      esc(question.instruction) + "</p>" : "";
    const firstValue = first?.answers[question.id];
    const firstLine = first && (!notesOnly || firstValue)
      ? answerLine(notesOnly ? "首次口语笔记" : "首次作答", displayAnswer(question, firstValue)) : "";
    const secondLine = second && (!notesOnly || value)
      ? answerLine(notesOnly ? "二次口语笔记" : "二次作答", displayAnswer(question, value)) : "";
    const comparison = second ? '<div class="answer-comparison">' + firstLine + secondLine +
      (question.type === "open" ? "" : answerLine("正确答案", displayKeys(question), "key")) + "</div>"
      : firstLine;
    const field = locked || second ? "" : '<div class="control">' +
      (summary ? summary : renderInput(question, value)) + "</div>";
    const voice = voiceHTML(question, attempt);
    return '<article class="question question-card" tabindex="-1" id="item-' + esc(question.id) +
      '" data-question="' + esc(question.id) + '"><div class="question-meta"><span class="q-number">第 ' +
      question.number + " 题 " + esc(question.kind) + '</span><div class="question-tags">' +
      (audioLabel ? '<span class="q-status ungraded">' + esc(audioLabel) + "</span>" : "") +
      (status ? '<span class="q-status ' + statusClass + '">' + esc(status) + "</span>" : "") +
      '</div></div><h2 class="q-prompt" id="stem-' + esc(question.id) +
      '">' + esc(summary && !locked && !second ? "摘要填空" : question.prompt) + "</h2>" +
      notes + bank + instruction + comparison + (notesOnly ? voice + field : field + voice) + "</article>";
  }

  window.UnlockWorksheet = { sectionName, renderQuestion, renderOrder, voiceHTML };
})();
