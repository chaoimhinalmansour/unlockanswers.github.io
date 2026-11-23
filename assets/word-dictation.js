"use strict";

(function () {
  const { normalized, escapeHTML: esc } = window.UnlockRules;
  const motion = window.UnlockMotion;
  const ui = window.UnlockStudentUI;
  const label = (english, chinese) => ui ? ui.label(english, chinese) : esc(chinese);
  const setLabel = ui?.setLabel || ((node, english, chinese) => { node.textContent = chinese; });
  const source = window.UNLOCK_WORD_DICTATION_ITEMS;
  const outcomes = {
    first: "首次拼写正确",
    second: "二次拼写正确",
    assisted: "音节拼接正确",
    incorrect: "音节拼接仍有误"
  };
  const checks = { correct: "正确", incorrect: "有误", case: "大小写形式有误" };
  const englishOutcomes = {
    first: "Correct on first spelling",
    second: "Correct on second spelling",
    assisted: "Correct with syllables",
    incorrect: "Syllable order incorrect"
  };
  const englishChecks = { correct: "Correct", incorrect: "Incorrect", case: "Capitalization error" };
  const empty = { plays: 0, draft: "", attempts: [] };

  function makeItem(id, number, word, keys, prepared = source[normalized(keys[0])]) {
    if (!prepared) throw new Error("Missing dictation audio or syllables for " + id);
    const spelling = prepared.spelling || word;
    const accepted = prepared.spelling ? [...new Set([prepared.spelling, ...keys.slice(1)])] : keys;
    return {
      id, number, word: spelling, keys: accepted, audio: prepared.audio, file: prepared.file, parts: prepared.parts,
      ipa: prepared.ipa, locale: prepared.ipa ? "en-GB" : "en-US", revisedParts: prepared.revisedParts,
      original: { word, keys }
    };
  }

  function audioPath(item) {
    if (item.file) return item.file;
    const directory = item.locale === "en-GB" ? "word-dictation-en-gb-v1" : "word-dictation-v1";
    return "assets/" + directory + "/" + item.audio + ".wav";
  }

  function recordedItem(item, record) {
    if (item.locale !== "en-GB" || record?.locale === "en-GB") return item;
    return { ...item, ...item.original, locale: "en-US", ipa: undefined };
  }

  function checkSpelling(item, typed) {
    const value = normalized(typed, true);
    const lower = value.toLowerCase();
    if (!item.keys.some(key => normalized(key) === lower)) return "incorrect";
    const initial = lower.replace(/\p{L}/u, letter => letter.toUpperCase());
    return value === lower || value === lower.toUpperCase() || value === initial ? "correct" : "case";
  }

  function outcome(record) {
    if (record?.attempts?.[0]?.result === "correct") return "first";
    if (record?.attempts?.[1]?.result === "correct") return "second";
    if (record?.syllables) return record.syllables.result === "correct" ? "assisted" : "incorrect";
    return "";
  }

  function complete(item, records) {
    const record = records?.[item.id];
    return Boolean(outcome(record) && (!item.meaningQuestion || record.meaning?.result));
  }

  function spellingRound(record, round) {
    const first = record?.attempts?.[0];
    return (round === 0 || first?.result === "correct" ? first : record?.attempts?.[1]) || null;
  }

  function assemble(item, order) {
    return order.map((index, slot) => {
      const space = item.parts[slot].startsWith(" ") ? " " : "";
      return space + item.parts[index].trim();
    }).join("");
  }

  function shuffledParts(item) {
    const order = item.parts.map((_, index) => index);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (assemble(item, order) === item.parts.join("")) {
      const different = order.findIndex(index => item.parts[index].trim() !== item.parts[order[0]].trim());
      if (different > 0) [order[0], order[different]] = [order[different], order[0]];
    }
    return order;
  }

  function newSelection(item) {
    return { offered: shuffledParts(item), order: [], partsKey: item.parts.join("|") };
  }

  function outcomeCounts(items, records) {
    const counts = { first: 0, second: 0, assisted: 0, incorrect: 0 };
    for (const item of items) {
      const result = outcome(records?.[item.id]);
      if (result) counts[result]++;
    }
    return Object.entries(counts);
  }

  function meaningScore(items, records) {
    const results = items.map(item => records?.[item.id]?.meaning?.result).filter(Boolean);
    return results.length ? results.filter(result => result === "correct").length + " / " + results.length : "";
  }

  function summary(items, records) {
    const score = meaningScore(items, records);
    const spelling = outcomeCounts(items, records).map(([result, n]) => outcomes[result] + " " + n + " 题").join("，") + "。";
    return spelling + (score ? "中文义答对 " + score + " 题。" : "");
  }

  function recordHTML(item, record, links = "", bilingual = false) {
    if (!record) return "";
    const copy = bilingual ? label : (english, chinese) => esc(chinese);
    const result = outcome(record);
    const field = (english, chinese, value, status) => '<div><dt>' + copy(english, chinese) +
      '</dt><dd lang="en">' + (value ? esc(value) : copy("Step not reached", "未进入此步")) +
      '</dd>' + (status ? '<dd class="wd-report-check">' + copy(englishChecks[status], checks[status]) + '</dd>' : "") + "</div>";
    const [first, second] = record.attempts;
    const { syllables, meaning } = record;
    const meaningField = meaning ? '<div class="wd-report-meaning"><dt>' +
      copy("Chinese Meaning", "中文义选择") + '</dt><dd lang="zh-CN">' +
      copy("Selected", "所选") + " " + esc(meaning.selected) + '</dd><dd lang="zh-CN">' +
      copy("Answer", "正确义项") + " " + esc(meaning.answer) + '</dd><dd class="wd-report-check">' +
      copy(englishChecks[meaning.result], checks[meaning.result]) + "</dd></div>" : "";
    const plays = Number(record.plays) || 0;
    item = recordedItem(item, record);
    const heading = bilingual
      ? copy("Word " + item.number + " " + item.word, "第 " + item.number + " 题")
      : '第 ' + item.number + ' 题 <span lang="en">' + esc(item.word) + '</span>';
    return '<article class="record objective wd-record" data-question="' + esc(item.id) + '">' +
      '<header><h3>' + heading + '</h3><p>' +
      copy((englishOutcomes[result] || "In progress") + ", played " + plays + " times",
        (outcomes[result] || "作答中") + "，播放 " + plays + " 次") + '</p></header>' +
      '<dl class="wd-report-steps">' +
      field("First Spelling", "首次拼写", first?.text, first?.result) +
      field("Second Spelling", "二次拼写", second?.text, second?.result) +
      field("Syllable Order", "音节选择顺序", syllables?.parts.join("、"), syllables?.result) +
      meaningField + "</dl>" + links + "</article>";
  }

  function reviewHTML(items, records) {
    const score = meaningScore(items, records);
    const results = outcomeCounts(items, records).map(([result, n]) => englishOutcomes[result] + " " + n).join(", ");
    const english = results + (score ? ". Chinese meanings correct " + score + "." : "");
    return '<div class="wd-review"><h2 tabindex="-1">' + label("Dictation Report", "听写报告") +
      '</h2><p class="wd-summary">' + label(english, summary(items, records)) + "</p>" +
      items.map(item => recordHTML(item, records?.[item.id], "", Boolean(ui))).join("") + "</div>";
  }

  function mount(root, { items, read, draft = () => "", save, onProgress, onFinish, positionTarget }) {
    const listeners = new AbortController();
    const options = { signal: listeners.signal };
    const touchScreen = matchMedia("(any-pointer: coarse)");
    let current, audio, starting, playing, refreshedSelection;
    let previous = "";
    let previousEnglish = "";

    function record() {
      const saved = read()?.[current.id] || { ...empty, draft: draft(current) || "" };
      if (saved.attempts.length !== 2 || outcome(saved)) return saved;
      const partsChanged = saved.partsKey == null
        ? current.revisedParts
        : saved.partsKey !== current.parts.join("|");
      if (!partsChanged) return saved;
      refreshedSelection ??= newSelection(current);
      return { ...saved, ...refreshedSelection };
    }

    function saveRecord(next) {
      if (!save(current, { ...next, locale: current.locale })) return false;
      onProgress?.();
      return true;
    }

    function updateSyllables(focusNext = false, origin) {
      const { offered, order } = record();
      const buttons = root.querySelectorAll("[data-wd-piece]");
      for (const button of buttons) button.disabled = order.includes(Number(button.dataset.wdPiece));
      const output = root.querySelector("[data-wd-choice]");
      const spelling = assemble(current, order);
      if (origin && order.length) {
        const added = current.parts[order[order.length - 1]].trim();
        const piece = document.createElement("span");
        piece.className = "wd-added-piece";
        piece.textContent = added;
        output.replaceChildren(spelling.slice(0, spelling.length - added.length), piece);
        motion.place(piece, origin);
      } else {
        if (spelling) output.textContent = spelling;
        else setLabel(output, "Select syllables", "请选择音节");
      }
      root.querySelector("[data-wd-undo]").disabled = !order.length;
      const submit = root.querySelector("[data-wd-submit]");
      submit.disabled = order.length !== offered.length;
      if (focusNext) (root.querySelector("[data-wd-piece]:not(:disabled)") || submit).focus({ preventScroll: true });
    }

    function fitCompactCard() {
      const viewport = window.visualViewport;
      const height = viewport?.scale === 1 ? viewport.height : window.innerHeight;
      const compact = touchScreen.matches && height < 480;
      root.classList.toggle("wd-compact", compact);
      if (!compact) return;

      if (positionTarget) {
        const top = root.getBoundingClientRect().top - (viewport?.offsetTop || 0);
        const available = Math.max(120, Math.floor(height - Math.max(0, top) - 8));
        root.style.setProperty("--wd-compact-height", available + "px");
      }

      const editor = root.querySelector("[data-wd-input]:focus");
      if (!editor) return;
      const content = editor.closest(".wd-content");
      const hidden = editor.getBoundingClientRect().bottom - content.getBoundingClientRect().bottom;
      if (hidden > 0) content.scrollTop += hidden + 4;
    }

    function questionHeader(heading, position, focus, className = "") {
      return '<form class="wd-question' + className + (focus ? " unlock-card-enter" : "") +
        '" data-word-number="' + current.number +
        '" data-question="' + esc(current.id) + '" aria-labelledby="wd-heading"><div class="wd-content">' +
        (positionTarget ? "" : '<p class="wd-position">' + position + "</p>") +
        '<div class="wd-heading-line"><h2 id="wd-heading" tabindex="-1">' + heading + "</h2>";
    }

    function paintMeaning(state, position, focus) {
      const heading = label("Choose the Chinese Meaning", "选择中文义");
      const spelling = outcome(state);
      const lesson = current.meaningContextLesson;
      const context = lesson ? '<p class="wd-note">' +
        label("Lesson " + lesson + " usage", "第 " + lesson + " 节用法") + "</p>" : "";
      const options = current.meaningQuestion.options.map(option =>
        '<label class="wd-meaning-option"><input type="radio" name="wd-meaning" value="' + esc(option.id) +
        '" data-wd-meaning required' + (state.meaningDraft === option.id ? " checked" : "") +
        '><span lang="zh-CN"><b lang="en">' + esc(option.pos) + "</b> " + esc(option.text) + "</span></label>").join("");
      root.innerHTML = questionHeader(heading, position, focus, " wd-meaning-question") +
        '<p class="wd-feedback">' + label(englishOutcomes[spelling], outcomes[spelling]) + '</p></div>' +
        '<p lang="en" class="wd-meaning-term">' + esc(current.word) + '</p>' + context +
        '<fieldset class="wd-meaning-choices" aria-label="中文释义选项">' + options + '</fieldset></div>' +
        '<button type="submit" class="wd-button wd-primary ui-action ui-primary" data-wd-submit>' +
        label("Submit Meaning", "提交词义") + "</button></form>";
      if (focus) root.querySelector("#wd-heading").focus({ preventScroll: true });
    }

    function paint(focus) {
      audio?.pause();
      audio = null;
      refreshedSelection = undefined;
      starting = playing = false;
      root.scrollTop = 0;
      current = items.find(item => !complete(item, read()));
      if (!current) {
        if (positionTarget) positionTarget.hidden = true;
        root.innerHTML = reviewHTML(items, read());
        if (focus) root.querySelector("h2").focus({ preventScroll: true });
        return;
      }
      const state = record();
      const number = items.indexOf(current) + 1;
      const position = label("Word " + number + " of " + items.length,
        "第 " + number + " 题，共 " + items.length + " 题");
      if (positionTarget) {
        if (positionTarget.innerHTML !== position) positionTarget.innerHTML = position;
        positionTarget.hidden = false;
      }
      if (current.meaningQuestion && outcome(state)) {
        paintMeaning(state, position, focus);
        return;
      }
      const attemptNo = state.attempts.length;
      const syllableStep = attemptNo === 2;
      const last = state.attempts[attemptNo - 1];
      let feedback = previous ? label(previousEnglish, previous) : "";
      if (syllableStep) feedback = label("Choose the syllables in order.", "两次拼写未通过，请按顺序选出音节。");
      else if (attemptNo) feedback = last.result === "case"
        ? label("Check capitalization and try again.", "上一次大小写形式有误，请再拼写一次。")
        : label("That spelling was incorrect. Try again.", "上一次拼写有误，请再试一次。");
      const fields = syllableStep
        ? '<div class="wd-pieces" aria-label="可选音节">' + state.offered.map(index =>
          '<button type="button" class="wd-button wd-piece" lang="en" data-wd-piece="' + index + '">' +
          esc(current.parts[index].trim()) + "</button>").join("") + '</div><div class="wd-assembly">' +
          '<output class="wd-choice" lang="en" aria-live="polite" data-wd-choice></output>' +
          '<button type="button" class="wd-undo ui-action" data-wd-undo>' + label("Undo", "撤销上一步") + '</button></div>'
        : '<label for="wd-input">' + label("Full Spelling", "完整拼写") + '</label><input id="wd-input" data-wd-input lang="en" type="text" ' +
          'autocomplete="off" autocapitalize="none" spellcheck="false" enterkeyhint="done" maxlength="160" required ' +
          'aria-describedby="wd-case" value="' + esc(state.draft) + '">' +
          '<p id="wd-case" class="wd-note">' +
          label("Use lowercase, uppercase, or an initial capital.", "可用全小写、全大写或仅首字母大写。") + '</p>';
      const heading = syllableStep ? label("Arrange Syllables", "拼接音节") : attemptNo
        ? label("Try Again", "再拼写一次") : label("Listen and Spell", "听音拼写");
      root.innerHTML = questionHeader(heading, position, focus) +
        '<p class="wd-feedback" role="status">' + feedback + '</p></div>' +
        '<div class="wd-listen"><audio hidden preload="none" src="../' + esc(audioPath(current)) + '"></audio>' +
        '<button type="button" class="wd-button wd-play ui-action" data-wd-play>' + label("Play Audio", "播放音频") + '</button>' +
        '<p class="wd-note" data-wd-play-note role="status">' + label("Replay anytime.", "可重复播放。") + '</p></div>' +
        '<div class="wd-fields">' + fields + '</div></div>' +
        '<button type="submit" class="wd-button wd-primary ui-action ui-primary" data-wd-submit>' + label("Submit", "提交") + '</button></form>';
      const player = root.querySelector("audio");
      audio = player;
      const playButton = root.querySelector("[data-wd-play]");
      player.addEventListener("timeupdate", () => {
        if (player !== audio || !Number.isFinite(player.duration) || player.duration <= 0) return;
        const fraction = Math.min(1, player.currentTime / player.duration);
        playButton.style.setProperty("--wd-audio-progress", String(fraction));
      }, options);
      const resetPlay = () => {
        if (player !== audio) return;
        playing = false;
        if (player.ended) playButton.style.setProperty("--wd-audio-progress", "1");
        setLabel(playButton, "Play Audio", "播放音频");
        playButton.removeAttribute("aria-disabled");
      };
      player.addEventListener("ended", resetPlay, options);
      player.addEventListener("pause", resetPlay, options);
      if (syllableStep) updateSyllables();
      if (focus) {
        const target = syllableStep ? "[data-wd-piece]:not(:disabled),[data-wd-submit]"
          : attemptNo ? "[data-wd-input]" : "[data-wd-play]";
        root.querySelector(target)?.focus({ preventScroll: true });
      }
    }

    async function play(button) {
      if (starting || playing) return;
      const player = audio;
      const note = root.querySelector("[data-wd-play-note]");
      starting = true;
      button.setAttribute("aria-disabled", "true");
      button.style.setProperty("--wd-audio-progress", "0");
      setLabel(note, "Loading audio.", "正在加载音频。");
      const loadingTimeout = setTimeout(() => {
        if (player === audio && starting) player.load();
      }, 10000);
      try {
        if (player.error) player.load();
        player.currentTime = 0;
        await player.play();
        if (player !== audio || listeners.signal.aborted) return;
        playing = !player.paused && !player.ended;
        setLabel(button, playing ? "Playing" : "Play Audio", playing ? "播放中" : "播放音频");
        setLabel(note, "Replay anytime.", "可重复播放。");
        const state = record();
        saveRecord({ ...state, plays: state.plays + 1 });
      } catch {
        if (player === audio) setLabel(note, "The audio could not play. Try again.", "音频未能播放，请重试。");
      } finally {
        clearTimeout(loadingTimeout);
        if (player === audio) {
          starting = false;
          if (!playing) button.removeAttribute("aria-disabled");
        }
      }
    }

    function saveSpellingDraft(event) {
      if (!event.target.matches("[data-wd-input]")) return;
      saveRecord({ ...record(), draft: event.target.value });
    }

    function saveMeaningChoice(event) {
      if (event.target.matches("[data-wd-meaning]")) {
        saveRecord({ ...record(), meaningDraft: event.target.value });
      }
    }

    function handleWordControl(event) {
      const button = event.target.closest("button");
      if (!current || !button) return;
      if (button.hasAttribute("data-wd-play")) {
        play(button);
        return;
      }
      if (!button.hasAttribute("data-wd-piece") && !button.hasAttribute("data-wd-undo")) return;
      const state = record();
      const piece = Number(button.dataset.wdPiece);
      const undo = button.hasAttribute("data-wd-undo");
      const origin = undo ? undefined : button.getBoundingClientRect();
      const order = undo ? state.order.slice(0, -1) : [...state.order, piece];
      if (saveRecord({ ...state, order })) updateSyllables(!undo || !order.length, origin);
    }

    function submitResponse(event) {
      if (!event.target.matches(".wd-question")) return;
      event.preventDefault();
      if (!current) return;
      const state = record();
      let next;
      const meaning = current.meaningQuestion;
      if (meaning && outcome(state)) {
        const value = root.querySelector("[data-wd-meaning]:checked")?.value;
        const selected = meaning.options.find(option => option.id === value);
        if (!selected) return;
        const answer = meaning.options.find(option => option.id === meaning.answerId);
        next = { ...state, meaningDraft: "", meaning: {
          selected: selected.label, answer: answer.label, result: selected.id === answer.id ? "correct" : "incorrect"
        } };
      } else if (state.attempts.length < 2) {
        const typed = root.querySelector("[data-wd-input]").value;
        if (!typed.trim()) return;
        const result = checkSpelling(current, typed);
        const attempts = [...state.attempts, { text: typed, result }];
        next = { ...state, draft: "", attempts };
        if (attempts.length === 2 && result !== "correct") {
          Object.assign(next, newSelection(current));
        }
      } else {
        if (state.order.length !== current.parts.length) return;
        const text = assemble(current, state.order);
        next = { ...state, syllables: {
          parts: state.order.map(index => current.parts[index].trim()),
          result: text === current.parts.join("") ? "correct" : "incorrect"
        } };
      }
      if (!saveRecord(next)) return;
      if (complete(current, read())) {
        const result = outcome(next);
        const meaningResult = next.meaning?.result;
        previous = "第 " + current.number + " 题" + (meaningResult === "correct" ? "中文义答对。"
          : meaningResult === "incorrect" ? "的正确中文义是「" + next.meaning.answer + "」。" : outcomes[result] + "。");
        previousEnglish = "Word " + current.number + ". " + (meaningResult === "correct" ? "Correct meaning."
          : meaningResult === "incorrect" ? "The correct meaning is " + next.meaning.answer + "." : englishOutcomes[result] + ".");
        if (items.every(item => complete(item, read())) && onFinish?.(previous, previousEnglish)) return;
      }
      paint(true);
    }

    root.addEventListener("input", saveSpellingDraft);
    root.addEventListener("change", saveMeaningChoice);
    root.addEventListener("click", handleWordControl);
    root.addEventListener("submit", submitResponse);
    window.addEventListener("resize", fitCompactCard);
    window.visualViewport?.addEventListener("resize", fitCompactCard);
    paint(false);
    fitCompactCard();
    return () => {
      listeners.abort();
      root.removeEventListener("input", saveSpellingDraft);
      root.removeEventListener("change", saveMeaningChoice);
      root.removeEventListener("click", handleWordControl);
      root.removeEventListener("submit", submitResponse);
      window.removeEventListener("resize", fitCompactCard);
      window.visualViewport?.removeEventListener("resize", fitCompactCard);
      root.classList.remove("wd-compact");
      root.style.removeProperty("--wd-compact-height");
      if (positionTarget) positionTarget.hidden = true;
      const player = audio;
      audio = null;
      player?.pause();
      audio = null;
    };
  }

  window.UnlockWordDictation = { makeItem, audioPath, recordedItem, checkSpelling, complete, outcome, spellingRound, summary, recordHTML, mount };
})();
