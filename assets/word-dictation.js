"use strict";

(function () {
  const { normalized, escapeHTML: esc } = window.UnlockRules;
  const motion = window.UnlockMotion;
  const source = window.UNLOCK_WORD_DICTATION_ITEMS;
  const outcomes = {
    first: "首次拼写正确",
    second: "二次拼写正确",
    assisted: "音节拼接正确",
    incorrect: "音节拼接仍有误"
  };
  const checks = { correct: "正确", incorrect: "有误", case: "大小写形式有误" };
  const empty = { plays: 0, draft: "", attempts: [] };

  function makeItem(id, number, word, keys) {
    const prepared = source[normalized(keys[0])];
    if (!prepared) throw new Error("Missing dictation audio or syllables for " + id);
    return { id, number, word, keys, audio: prepared.audio, parts: prepared.parts };
  }

  function audioPath(item) {
    return "assets/word-dictation-v1/" + item.audio + ".wav";
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

  function summary(items, records) {
    const counts = { first: 0, second: 0, assisted: 0, incorrect: 0 };
    for (const item of items) {
      const result = outcome(records?.[item.id]);
      if (result) counts[result]++;
    }
    return Object.entries(counts).map(([result, n]) => outcomes[result] + " " + n + " 题").join("，") + "。";
  }

  function recordHTML(item, record, links = "") {
    if (!record) return "";
    const result = outcome(record);
    const field = (label, value, status) => '<div><dt>' + label + '</dt><dd lang="en">' +
      esc(value || "未进入此步") + '</dd>' + (status ? '<dd class="wd-report-check">' + esc(status) + '</dd>' : "") + "</div>";
    const [first, second] = record.attempts;
    const syllables = record.syllables;
    return '<article class="record objective wd-record" data-question="' + esc(item.id) + '">' +
      '<header><h3>第 ' + item.number + ' 题 <span lang="en">' + esc(item.word) + '</span></h3><p>' +
      esc(outcomes[result] || "作答中") + '，播放 ' + (Number(record.plays) || 0) + ' 次</p></header>' +
      '<dl class="wd-report-steps">' +
      field("首次拼写", first?.text, checks[first?.result]) +
      field("二次拼写", second?.text, checks[second?.result]) +
      field("音节选择顺序", syllables?.parts.join("、"), checks[syllables?.result]) +
      "</dl>" + links + "</article>";
  }

  function reviewHTML(items, records) {
    return '<div class="wd-review"><h2 tabindex="-1">听写报告</h2><p class="wd-summary">' +
      esc(summary(items, records)) + "</p>" +
      items.map(item => recordHTML(item, records?.[item.id])).join("") + "</div>";
  }

  function mount(root, { items, read, draft = () => "", save, onProgress, onFinish }) {
    const listeners = new AbortController();
    const options = { signal: listeners.signal };
    let current, audio, starting, playing;
    let previous = "";

    function record() {
      return read()?.[current.id] || { ...empty, draft: draft(current) || "" };
    }

    function saveRecord(next) {
      if (!save(current, next)) return false;
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
        output.textContent = spelling || "请选择音节";
      }
      root.querySelector("[data-wd-undo]").disabled = !order.length;
      const submit = root.querySelector("[data-wd-submit]");
      submit.disabled = order.length !== offered.length;
      if (focusNext) (root.querySelector("[data-wd-piece]:not(:disabled)") || submit).focus({ preventScroll: true });
    }

    function paint(focus) {
      audio?.pause();
      audio = null;
      starting = playing = false;
      root.scrollTop = 0;
      current = items.find(item => !complete(item, read()));
      if (!current) {
        root.innerHTML = reviewHTML(items, read());
        if (focus) root.querySelector("h2").focus({ preventScroll: true });
        return;
      }
      const state = record();
      const attemptNo = state.attempts.length;
      const syllableStep = attemptNo === 2;
      const last = state.attempts.at(-1);
      let feedback = previous;
      if (syllableStep) feedback = "两次拼写未通过，请按顺序选出音节。";
      else if (attemptNo) feedback = last.result === "case"
        ? "上一次大小写形式有误，请再拼写一次。" : "上一次拼写有误，请再试一次。";
      const fields = syllableStep
        ? '<div class="wd-pieces" aria-label="可选音节">' + state.offered.map(index =>
          '<button type="button" class="wd-button wd-piece" lang="en" data-wd-piece="' + index + '">' +
          esc(current.parts[index].trim()) + "</button>").join("") + '</div><output class="wd-choice" lang="en" ' +
          'aria-live="polite" data-wd-choice></output><button type="button" class="wd-undo" data-wd-undo>撤销上一步</button>'
        : '<label for="wd-input">完整拼写</label><input id="wd-input" data-wd-input lang="en" type="text" ' +
          'autocomplete="off" autocapitalize="none" spellcheck="false" enterkeyhint="done" maxlength="160" required ' +
          'aria-describedby="wd-case" value="' + esc(state.draft) + '">' +
          '<p id="wd-case" class="wd-note">可用全小写、全大写或仅首字母大写。</p>';
      root.innerHTML = '<form class="wd-question' + (focus ? " unlock-card-enter" : "") +
        '" data-word-number="' + current.number +
        '" data-question="' + esc(current.id) + '" aria-labelledby="wd-heading"><p class="wd-position">第 ' +
        (items.indexOf(current) + 1) +
        ' 题，共 ' + items.length + ' 题</p><h2 id="wd-heading">' +
        (syllableStep ? "拼接音节" : attemptNo ? "再拼写一次" : "听音拼写") +
        '</h2><p class="wd-feedback" role="status">' + esc(feedback) + '</p>' +
        '<div class="wd-listen"><audio hidden preload="none" src="../' + esc(audioPath(current)) + '"></audio>' +
        '<button type="button" class="wd-button wd-play" data-wd-play>播放音频</button>' +
        '<p class="wd-note" data-wd-play-note role="status">每次播放一遍，可重复听。</p></div>' +
        '<div class="wd-fields">' + fields + '</div>' +
        '<button type="submit" class="wd-button wd-primary" data-wd-submit>提交</button></form>';
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
        playButton.textContent = "播放音频";
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
        button.textContent = playing ? "播放中" : "播放音频";
        note.textContent = "每次播放一遍，可重复听。";
        const state = record();
        saveRecord({ ...state, plays: state.plays + 1 });
      } catch {
        if (player === audio) note.textContent = "音频未能播放，请重试。";
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
          next.offered = shuffledParts(current);
          next.order = [];
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
        if (items.every(item => complete(item, read())) && onFinish?.(previous)) return;
      }
      paint(true);
    }, options);

    paint(false);
    return () => {
      listeners.abort();
      audio?.pause();
      audio = null;
    };
  }

  window.UnlockWordDictation = { makeItem, audioPath, checkSpelling, complete, outcome, spellingRound, summary, recordHTML, mount };
})();
