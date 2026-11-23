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
    return Boolean(outcome(records?.[item.id]));
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

  function summary(items, records) {
    return outcomeCounts(items, records).map(([result, n]) => outcomes[result] + " " + n + " 题").join("，") + "。";
  }

  function recordHTML(item, record, links = "", bilingual = false) {
    if (!record) return "";
    const copy = bilingual ? label : (english, chinese) => esc(chinese);
    const result = outcome(record);
    const field = (english, chinese, value, status) => '<div><dt>' + copy(english, chinese) +
      '</dt><dd lang="en">' + (value ? esc(value) : copy("Step not reached", "未进入此步")) +
      '</dd>' + (status ? '<dd class="wd-report-check">' + copy(englishChecks[status], checks[status]) + '</dd>' : "") + "</div>";
    const [first, second] = record.attempts;
    const syllables = record.syllables;
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
      "</dl>" + links + "</article>";
  }

  function reviewHTML(items, records) {
    const english = outcomeCounts(items, records).map(([result, n]) => englishOutcomes[result] + " " + n).join(", ");
    return '<div class="wd-review"><h2 tabindex="-1">' + label("Dictation Report", "听写报告") +
      '</h2><p class="wd-summary">' + label(english, summary(items, records)) + "</p>" +
      items.map(item => recordHTML(item, records?.[item.id], "", Boolean(ui))).join("") + "</div>";
  }

  function mount(root, { items, read, draft = () => "", save, onProgress, onFinish, positionTarget }) {
    const listeners = new AbortController();
    const options = { signal: listeners.signal };
    let current, audio, starting, playing, refreshedSelection;
    let previous = "";
    let previousEnglish = "";

    function record() {
      const saved = read()?.[current.id] || { ...empty, draft: draft(current) || "" };
      if (saved.attempts.length !== 2 || saved.syllables) return saved;
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
        const added = current.parts[order.at(-1)].trim();
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
      const attemptNo = state.attempts.length;
      const syllableStep = attemptNo === 2;
      const last = state.attempts.at(-1);
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
      const number = items.indexOf(current) + 1;
      const position = label("Word " + number + " of " + items.length,
        "第 " + number + " 题，共 " + items.length + " 题");
      if (positionTarget) {
        if (positionTarget.innerHTML !== position) positionTarget.innerHTML = position;
        positionTarget.hidden = false;
      }
      root.innerHTML = '<form class="wd-question' + (focus ? " unlock-card-enter" : "") +
        '" data-word-number="' + current.number +
        '" data-question="' + esc(current.id) + '" aria-labelledby="wd-heading">' +
        (positionTarget ? "" : '<p class="wd-position">' + position + "</p>") +
        '<div class="wd-heading-line"><h2 id="wd-heading">' +
        (syllableStep ? label("Arrange Syllables", "拼接音节") : attemptNo ? label("Try Again", "再拼写一次")
          : label("Listen and Spell", "听音拼写")) +
        '</h2><p class="wd-feedback" role="status">' + feedback + '</p></div>' +
        '<div class="wd-listen"><audio hidden preload="none" src="../' + esc(audioPath(current)) + '"></audio>' +
        '<button type="button" class="wd-button wd-play ui-action" data-wd-play>' + label("Play Audio", "播放音频") + '</button>' +
        '<p class="wd-note" data-wd-play-note role="status">' + label("Replay anytime.", "可重复播放。") + '</p></div>' +
        '<div class="wd-fields">' + fields + '</div>' +
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
        if (player === audio) {
          starting = false;
          if (!playing) button.removeAttribute("aria-disabled");
        }
      }
    }

    root.addEventListener("input", event => {
      if (!event.target.matches("[data-wd-input]")) return;
      saveRecord({ ...record(), draft: event.target.value });
    }, options);

    root.addEventListener("click", event => {
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
    }, options);

    root.addEventListener("submit", event => {
      if (!event.target.matches(".wd-question")) return;
      event.preventDefault();
      if (!current || starting) return;
      const state = record();
      let next;
      if (state.attempts.length < 2) {
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
      const result = outcome(next);
      if (!saveRecord(next)) return;
      if (result) {
        previous = "第 " + current.number + " 题" + outcomes[result] + "。";
        previousEnglish = "Word " + current.number + ". " + englishOutcomes[result] + ".";
        if (items.every(item => complete(item, read())) && onFinish?.(previous, previousEnglish)) return;
      }
      paint(true);
    }, options);

    paint(false);
    return () => {
      listeners.abort();
      if (positionTarget) positionTarget.hidden = true;
      audio?.pause();
      audio = null;
    };
  }

  window.UnlockWordDictation = { makeItem, audioPath, recordedItem, checkSpelling, complete, outcome, spellingRound, summary, recordHTML, mount };
})();
