"use strict";

(function () {
  const library = window.UnlockVocabularyBank;
  const { escapeHTML: esc, judge } = window.UnlockRules;
  const { label, setLabel } = window.UnlockStudentUI;
  const syllableDrag = window.UnlockSyllableDrag;
  const rounds = [
    { id: "meaning", en: "Listen and Choose the Meaning", zh: "听音选义", directions: "听单词音频，选出正确的中文词义。" },
    { id: "syllables", en: "Listen and Arrange the Syllables", zh: "听音拼音节", directions: "按顺序点选音节，填满后自动检查。点选已填音节可撤回。" },
    { id: "spelling", en: "Listen and Spell", zh: "听音完整拼写", directions: "听单词音频并输入完整拼写。输完后自动检查。" }
  ];

  function bankID(unit) {
    return "B" + String(unit.book).padStart(2, "0") + "-" + unit.track +
      "-U" + String(unit.number).padStart(2, "0");
  }

  function assignment(student, unit, week, mode = "preclass") {
    const id = bankID(unit);
    const entry = library.entry(id);
    if (!entry || ![1, 2].includes(week)) return null;
    const scope = [student.storageName ?? student.name, student.level, student.adminClass,
      id, "W" + week, "L" + unit.lesson].map(encodeURIComponent).join(":");
    return { id, week, mode, count: entry.count, revision: entry.revision,
      key: "unlock.classroom." + mode + "-vocabulary.v1:" + scope };
  }

  function read(key) {
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (saved && /^[a-f0-9]{16}$/.test(saved.revision) && Number.isSafeInteger(saved.sequence) &&
          saved.sequence > 0 && Number.isInteger(saved.round) && rounds[saved.round] &&
          Number.isInteger(saved.index) && saved.index >= 0 && saved.answers &&
          ["question", "review", "complete"].includes(saved.view)) return saved;
    } catch {}
    return null;
  }

  function button(id, en, zh, primary = false) {
    return '<button type="button" id="' + id + '" class="ui-action' +
      (primary ? " ui-primary" : "") + '">' + label(en, zh) + "</button>";
  }

  function spellQuestion(card) {
    return { type: "text", keys: [card.spoken] };
  }

  function correctValue(stage, card, value) {
    if (stage === "spelling") return judge(spellQuestion(card), value) === "correct";
    if (stage === "meaning") return value === card.meaning.correct;
    const { options, parts } = card.syllables;
    return parts.length === value.length && parts.every((part, index) => options[value[index]] === part);
  }

  function finalAnswer(history) {
    return history.length === 2 || history[0]?.correct === true;
  }

  function statistics(saved, stage, cards) {
    const history = cards.map(card => saved.answers[stage]?.[card.id] || []);
    return {
      first: history.filter(row => row[0]?.correct).length,
      retry: history.filter(row => row[1]?.correct).length,
      unresolved: history.filter(row => row[1] && !row[1].correct).length,
      completed: history.filter(finalAnswer).length
    };
  }

  function report(student, unit, selection, bank, saved, mediaRoot) {
    const first = { time: saved.startedAt, answers: {}, results: {} };
    const second = { time: saved.completedAt, answers: {}, results: {} };
    const tracks = {};
    const sections = rounds.map(({ id, zh }) => ({
      name: zh,
      questions: bank.cards.map((card, index) => {
        const key = id + ":" + card.id;
        const attempts = saved.answers[id][card.id];
        const item = { id: key, number: index + 1, kind: zh, prompt: card.spoken, audio: [card.id] };
        if (id === "meaning") {
          item.type = "choice";
          item.options = card.meaning.options.map((option, n) => [String.fromCharCode(65 + n), option]);
          item.keys = [item.options[card.meaning.correct][0]];
        } else if (id === "syllables") {
          item.type = "order";
          item.options = card.syllables.options.map((option, n) => [String(n + 1), option]);
          const available = new Set(item.options.map((_, n) => n));
          item.keys = [card.syllables.parts.map(part => {
            const n = [...available].find(candidate => card.syllables.options[candidate] === part);
            available.delete(n);
            return item.options[n][0];
          })];
          item.canonical = card.syllables.parts.join(" / ");
        } else {
          Object.assign(item, spellQuestion(card));
        }
        if (id !== "spelling") item.picture = mediaRoot + card.picture;
        tracks[card.id] = { file: mediaRoot + card.wordAudio, label: card.spoken + " 单词音频" };
        const format = value => id === "meaning" ? item.options[value][0]
          : id === "syllables" ? value.map(n => item.options[n][0]) : value;
        const record = (capture, answer) => {
          capture.answers[key] = format(answer.value);
          capture.results[key] = answer.correct ? "correct" : "incorrect";
        };
        record(first, attempts[0]);
        record(second, attempts.at(-1));
        return item;
      })
    }));
    const title = "Book " + unit.book + " Unit " + String(unit.number).padStart(2, "0") + " " +
      unit.track + " Week " + selection.week + " Lesson " + unit.lesson + (selection.mode === "classroom" ? " 课堂词汇练习" : " 课前词汇学练");
    return window.UnlockReport.prepare({
      student, title, sections, tracks,
      worksheet: { id: selection.id + "-W" + selection.week + "-L" + unit.lesson,
        revision: saved.revision, book: unit.book, unit: unit.number, week: selection.week,
        track: unit.track, lesson: unit.lesson, code: selection.mode === "classroom" ? "CLASSROOM_VOCABULARY" : "CLASSROOM_PRECLASS_VOCABULARY" },
      attempt: { first, second, completedAt: saved.completedAt }
    });
  }

  function mount({ root, student, unit, selection, position, saveStatus, download, autoPlay = false }) {
    const lifetime = new AbortController();
    const { signal } = lifetime;
    const audio = new Audio();
    audio.preload = "none";
    let startedPlay = 0;
    let playbackControl;
    let bank, saved, currentQuestion, spellingCheck, hintTimer;
    const find = query => root.querySelector(query);
    const status = (en, zh) => setLabel(saveStatus, en, zh);
    const dragSyllables = selection.mode === "preclass";
    const bookOne = selection.id.startsWith("B01-");
    const oldMedia = bookOne ? "assets/preclass-vocabulary/" : "assets/homework-vocabulary/";
    const oldData = bookOne ? "data/preclass-vocabulary/" : "../practice/data/homework-vocabulary/";
    let packageMediaRoot, mediaRoot;

    function restore() {
      return read(selection.key) || { sequence: 0, revision: selection.revision, round: 0,
        index: 0, view: "question", answers: {}, draft: "" };
    }

    function save(updates) {
      const latest = read(selection.key);
      if (latest && latest.sequence > saved.sequence) {
        if (latest.revision !== saved.revision) {
          load();
          return false;
        }
        saved = latest;
        render();
        status("Progress updated in another window.", "这份学练已在另一个窗口更新。");
        return false;
      }
      saved = { ...saved, startedAt: saved.startedAt || new Date().toISOString(), ...updates,
        sequence: saved.sequence + 1 };
      try {
        localStorage.setItem(selection.key, JSON.stringify(saved));
        saveStatus.textContent = "";
      } catch {
        status("Progress could not be saved. Keep this page open.", "当前浏览器无法保存进度，请留在此页完成。");
      }
      return true;
    }

    function wordPlayButton(id, role = "", attributes = "") {
      const [en, zh] = library.playLabel(role);
      return '<button type="button"' + (id ? ' id="' + id + '"' : "") +
        ' class="ui-action pcv-word-control" aria-pressed="false" data-pcv-play-role="' + esc(role) + '"' +
        attributes + '><span class="pcv-play-label">' + label(en, zh) + '</span>' +
        '<span class="pcv-bars" aria-hidden="true"><i></i><i></i><i></i></span></button>';
    }

    function setPlaybackLabel(control, playing) {
      const [en, zh] = library.playLabel(control.dataset.pcvPlayRole);
      control.setAttribute("aria-pressed", String(playing));
      setLabel(control.querySelector(".pcv-play-label"), playing ? "Playing" : en, playing ? "正在播放" : zh);
    }

    function playbackState(playing) {
      if (playbackControl) setPlaybackLabel(playbackControl, playing);
      if (!playing) playbackControl = undefined;
    }

    function revealPronunciations(card, done) {
      if (!card.pronunciations || card.pronunciations.length < 2) return;
      const group = find(".pcv-word-audio");
      const main = find("#pcv-play");
      group.classList.toggle("is-paired", done);
      main.dataset.pcvPlayRole = done ? card.pos : "";
      setPlaybackLabel(main, playbackControl === main);
      for (const control of group.querySelectorAll("[data-pcv-variant]")) control.hidden = !done;
    }

    function stopSound() {
      startedPlay++;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      playbackState(false);
    }

    function play(automatic = false, variant, control = find("#pcv-play")) {
      window.UnlockVocabularyPatch.stopFeedback();
      const token = ++startedPlay;
      audio.pause();
      playbackState(false);
      playbackControl = control;
      const source = new URL(mediaRoot + (variant?.audio ?? currentQuestion.card.wordAudio), location.href).href;
      if (audio.src !== source) audio.src = source;
      audio.currentTime = 0;
      playbackState(true);
      find(".pcv-audio-status").textContent = "";
      audio.play().catch(error => {
        if (token !== startedPlay || signal.aborted) return;
        playbackState(false);
        find(".pcv-audio-status").textContent = automatic === true && error.name === "NotAllowedError"
          ? "点按播放单词以开启音频。" : "音频未能播放，请再试一次。";
      });
    }

    function updatePosition() {
      const { round, index, view } = saved;
      const numbers = bank.cards.length;
      position.hidden = false;
      if (view === "question") {
        setLabel(position, "Round " + (round + 1) + " / 3, Word " + (index + 1) + " / " + numbers,
          "第 " + (round + 1) + " / 3 轮，第 " + (index + 1) + " / " + numbers + " 词");
      } else if (view === "review") {
        setLabel(position, "Round " + (round + 1) + " / 3", "第 " + (round + 1) + " / 3 轮");
      } else {
        setLabel(position, "3 / 3 Rounds Completed", "已完成 3 轮");
      }
    }

    function wire(id, type, handler) {
      find("#" + id).addEventListener(type, handler);
    }

    function focus(query) {
      find(query)?.focus({ preventScroll: true });
    }

    function showQuestion() {
      const stage = rounds[saved.round];
      const card = bank.cards[saved.index];
      const same = currentQuestion?.stage === stage.id && currentQuestion?.card.id === card.id;
      currentQuestion = { stage: stage.id, card };
      if (!same) {
        stopSound();
        const spellingClass = stage.id === "spelling" ? " pcv-spelling-mode" : "";
        const directions = stage.id === "syllables" && dragSyllables
          ? "把音节拖到对应空位，填满后自动检查。判对的音节会留在原位。" : stage.directions;
        root.innerHTML = '<div class="pcv-body' + spellingClass +
          '"><div class="pcv-prompt"><h3 id="pcv-heading" tabindex="-1">' +
          label(stage.en, stage.zh) + '</h3><p class="pcv-directions">' + esc(directions) + '</p></div>' +
          '<div class="pcv-audio"><div class="pcv-word-audio">' + wordPlayButton("pcv-play") +
          (card.pronunciations?.slice(1).map((variant, index) =>
            wordPlayButton("", variant.pos, ' data-pcv-variant="' + (index + 1) + '" hidden')).join("") || "") +
          '</div><span class="pcv-audio-status" role="status"></span></div><div class="pcv-work"><div id="pcv-answer"></div>' +
          '<div id="pcv-feedback" class="pcv-feedback" aria-live="polite" aria-atomic="true"></div></div>' +
          '<div class="pcv-picture"></div></div><footer class="pcv-footer">' +
          button("pcv-next", saved.index + 1 === bank.cards.length ? "Review Round" : "Next Word",
            saved.index + 1 === bank.cards.length ? "查看本轮结果" : "下一个词", true) + "</footer>";
        if (stage.id !== "spelling") {
          const img = new Image();
          img.alt = "当前词的情境配图";
          img.src = mediaRoot + card.picture;
          find(".pcv-picture").append(img);
        }
        wire("pcv-play", "click", () => play());
        for (const control of root.querySelectorAll("[data-pcv-variant]")) {
          control.addEventListener("click", () => play(false, card.pronunciations[Number(control.dataset.pcvVariant)], control));
        }
        wire("pcv-next", "click", advance);
      }
      updateAnswer();
      if (!same) {
        focus(stage.id === "spelling" && find("#pcv-word:not(:disabled)") ? "#pcv-word" : "#pcv-play");
        if (autoPlay) play(true);
      }
    }

    function logSyllables(card, history) {
      return history.map(({ value, correct }, index) => {
        const tiles = value.map((tile, position) => {
          const fragment = card.syllables.options[tile];
          const right = fragment === card.syllables.parts[position];
          return '<b class="pcv-chip is-' + (right ? "correct" : "incorrect") + '">' +
            esc(fragment) + "</b>";
        });
        return '<div class="pcv-attempt"><span>第 ' + (index + 1) + " 次 " +
          '</span><span class="vocab-a11y">' + (correct ? "答对" : "答错") + "</span>" + tiles.join("") + "</div>";
      }).join("");
    }

    function updateAnswer(focusAfter, animatedTile) {
      clearTimeout(spellingCheck);
      clearTimeout(hintTimer);
      const { stage, card } = currentQuestion;
      const history = saved.answers[stage]?.[card.id] || [];
      const done = finalAnswer(history);
      const response = history.at(-1);
      const answer = find("#pcv-answer");
      const feedback = find("#pcv-feedback");
      let hint = "";
      if (stage === "meaning") {
        answer.innerHTML = '<div class="pcv-choices" role="group" aria-label="请选择中文词义">' +
          card.meaning.options.map((option, n) => {
            const shownCorrect = done && n === card.meaning.correct;
            const shownWrong = history.some(item => !item.correct && item.value === n);
            const answerClass = shownCorrect ? " is-correct" : shownWrong ? " is-incorrect" : "";
            const result = shownCorrect ? "，正确答案" : shownWrong ? "，答错" : "";
            return '<button type="button" class="ui-action pcv-option' + answerClass + '" data-choice="' + n +
              '" aria-label="' + esc(option + result) + '"' +
              (done || shownWrong ? " disabled" : "") + ">" + esc(option) + "</button>";
          }).join("") + "</div>";
        for (const choice of answer.querySelectorAll("[data-choice]")) {
          choice.addEventListener("click", () => submit(Number(choice.dataset.choice)));
        }
      } else if (stage === "syllables") {
        const { parts, options } = card.syllables;
        if (dragSyllables) {
          syllableDrag.render(answer, {
            syllables: card.syllables,
            draft: Array.isArray(saved.draft) ? saved.draft : saved.draft?.order,
            last: response?.value,
            done,
            onChange(order) {
              if (order.every(tile => tile !== null)) submit(order);
              else if (save({ draft: { order } })) updateAnswer();
            }
          });
        } else {
          const chosen = Array.isArray(saved.draft) ? saved.draft : [];
          answer.innerHTML = '<div class="pcv-tray" role="group" aria-label="按顺序已选的音节">' +
            parts.map((_, n) => {
              const value = chosen[n];
              if (value === undefined) return '<span class="pcv-slot" aria-hidden="true"></span>';
              return '<button type="button" class="ui-action pcv-chip' +
                (value === animatedTile ? ' pcv-tile-enter' : '') + '" data-undo="' + value +
                '" aria-label="撤回音节 ' + esc(options[value]) + '">' + esc(options[value]) + "</button>";
            }).join("") + '</div><div class="pcv-tiles" role="group" aria-label="可选音节">' +
            options.map((tile, n) => '<button type="button" class="ui-action pcv-tile' +
              (chosen.includes(n) ? " is-used" : "") + '" data-tile="' + n + '"' +
              (done || chosen.includes(n) ? " disabled" : "") + ">" + esc(tile) + "</button>").join("") + "</div>";
          for (const chip of answer.querySelectorAll("[data-undo]")) {
            chip.addEventListener("click", () => {
              const value = Number(chip.dataset.undo);
              if (save({ draft: chosen.filter(item => item !== value) })) updateAnswer('[data-tile="' + value + '"]');
            });
          }
          for (const tile of answer.querySelectorAll("[data-tile]")) {
            tile.addEventListener("click", () => {
              const value = Number(tile.dataset.tile);
              const next = [...chosen, value];
              if (next.length === parts.length) submit(next);
              else if (save({ draft: next })) updateAnswer("[data-tile]:not(:disabled)", value);
            });
          }
        }
        hint = logSyllables(card, history);
        if (done && !response.correct) {
          hint += '<div class="pcv-attempt"><span>正确顺序</span>' +
            parts.map(part => '<b class="pcv-chip is-correct">' + esc(part) + "</b>").join("") + "</div>";
        }
      } else {
        answer.innerHTML = '<form id="pcv-spelling"><label for="pcv-word">' + label("Full Spelling", "完整拼写") +
          '</label><div class="pcv-letter-field"><div class="pcv-letter-mirror" aria-hidden="true"></div>' +
          '<input id="pcv-word" type="text" lang="en-GB" autocomplete="off" autocapitalize="off"' +
          ' spellcheck="false" maxlength="160"' + (done ? " disabled" : "") + '></div></form>';
        const input = find("#pcv-word");
        const mirror = find(".pcv-letter-mirror");
        const target = Array.from(card.spoken.normalize("NFC"));
        const cue = saved.spellingHint;
        const remaining = history.length === 1 && !done && cue?.id === card.id
          ? Math.max(0, cue.until - Date.now()) : 0;
        let showGrey = remaining > 0;
        input.value = done ? response.value : typeof saved.draft === "string" ? saved.draft : "";
        function drawLetters() {
          const letterKey = letter => letter?.toLowerCase().replace(/[‘’]/g, "'");
          const entered = Array.from(input.value.normalize("NFC"));
          const typed = entered.map((character, index) =>
            '<span class="' + (letterKey(character) === letterKey(target[index]) ? "is-correct" : "is-incorrect") +
            '">' + esc(character) + '</span>').join("");
          const cueLetters = showGrey ? target.slice(entered.length).map(character => esc(character)).join("") : "";
          const cueLength = showGrey ? Math.max(0, target.length - entered.length) : 0;
          input.parentElement.style.setProperty("--pcv-letter-count", Math.max(target.length, entered.length, 1));
          input.style.setProperty("--pcv-cue-width", cueLength + "ch");
          mirror.innerHTML = typed + (cueLetters ? '<span class="pcv-letter-hint">' + cueLetters + '</span>' : "");
          mirror.scrollLeft = input.scrollLeft;
        }
        function acceptInput() {
          clearTimeout(spellingCheck);
          if (done || !input.isConnected || !save({ draft: input.value })) return;
          drawLetters();
          if (correctValue(stage, card, input.value)) {
            submit(input.value);
            return;
          }
          const length = value => Array.from(value.normalize("NFC")).filter(letter => /[\p{L}\p{N}]/u.test(letter)).length;
          if (length(input.value) < length(card.spoken)) return;
          const value = input.value;
          spellingCheck = setTimeout(() => {
            if (input.isConnected && input.value === value) submit(value);
          }, 400);
        }
        drawLetters();
        if (showGrey) hintTimer = setTimeout(() => {
          showGrey = false;
          if (input.isConnected) drawLetters();
        }, remaining);
        input.addEventListener("scroll", () => { mirror.scrollLeft = input.scrollLeft; });
        input.addEventListener("input", event => { if (!event.isComposing) acceptInput(); });
        input.addEventListener("compositionend", acceptInput);
        wire("pcv-spelling", "submit", event => {
          event.preventDefault();
          clearTimeout(spellingCheck);
          if (!done && input.value.trim()) submit(input.value);
        });
        if (done && !response.correct) {
          hint += '<div class="pcv-attempt"><span>正确拼写</span><b class="pcv-chip is-correct" lang="en">' +
            esc(card.spoken) + "</b></div>";
        }
      }
      revealPronunciations(card, done);
      const result = response ? response.correct ? "答对了。" : "答错了。" : "";
      const nextAction = response && !done
        ? (stage === "syllables" && dragSyllables ? "请把音节拖到待订正的位置。" : "再试一次。") : "";
      feedback.innerHTML = '<p class="vocab-a11y">' + esc([result, nextAction].filter(Boolean).join(" ")) +
        "</p>" + hint;
      find("#pcv-next").disabled = !done;
      if (focusAfter) focus(focusAfter);
    }

    function submit(value) {
      const { stage, card } = currentQuestion;
      const answers = saved.answers[stage] || {};
      const history = answers[card.id] || [];
      if (finalAnswer(history)) return;
      const correct = correctValue(stage, card, value);
      const next = [...history, { value, correct }];
      const spellingHint = stage === "spelling" && !history.length && !correct
        ? { id: card.id, until: Date.now() + 2000 } : null;
      if (!save({ draft: "", spellingHint, answers: { ...saved.answers, [stage]: { ...answers, [card.id]: next } } })) return;
      stopSound();
      window.UnlockVocabularyPatch.feedback(correct);
      const retryFocus = {
        meaning: "[data-choice]:not(:disabled)",
        syllables: dragSyllables ? "[data-syllable-option]:not(:disabled)" : "[data-tile]:not(:disabled)",
        spelling: "#pcv-word"
      };
      updateAnswer(finalAnswer(next) ? "#pcv-next" : retryFocus[stage]);
    }

    function advance() {
      const { stage, card } = currentQuestion;
      if (!finalAnswer(saved.answers[stage]?.[card.id] || [])) return;
      if (saved.index + 1 < bank.cards.length) {
        if (save({ index: saved.index + 1, draft: "" })) render();
      } else if (save({ view: "review", draft: "" })) render();
    }

    function resultCard(stage) {
      const stats = statistics(saved, stage.id, bank.cards);
      return '<section class="pcv-score"><h4>' + esc(stage.zh) + "</h4><dl><div><dt>首答正确</dt><dd>" +
        stats.first + " / " + bank.cards.length + "</dd></div><div><dt>重试答对</dt><dd>" +
        stats.retry + "</dd></div><div><dt>仍需复习</dt><dd>" + stats.unresolved + "</dd></div></dl></section>";
    }

    function showReview() {
      clearTimeout(spellingCheck);
      clearTimeout(hintTimer);
      if (currentQuestion) stopSound();
      currentQuestion = null;
      const complete = saved.view === "complete";
      const stage = rounds[saved.round];
      const next = rounds[saved.round + 1];
      const sections = complete ? rounds : [stage];
      root.innerHTML = '<div class="pcv-body pcv-review"><div class="pcv-content"><h3 id="pcv-heading" tabindex="-1">' +
        (complete ? label("Practice Complete", selection.mode === "classroom" ? "课堂词汇练习已完成" : "课前词汇学练已完成") : label("Round Results", "本轮结果")) +
        '</h3><div class="pcv-scores">' + sections.map(resultCard).join("") + '</div></div></div>' +
        '<footer class="pcv-footer"></footer>';
      const footer = find(".pcv-footer");
      if (complete) {
        download.show(footer, selection.key + ":" + saved.sequence,
          () => report(student, unit, selection, bank, saved, packageMediaRoot));
      } else {
        footer.innerHTML = next ? button("pcv-next-round", "Start Next Round", "开始" + next.zh, true)
          : button("pcv-next-round", "Finish Practice", "完成学练", true);
        wire("pcv-next-round", "click", () => {
          const updates = next ? { round: saved.round + 1, index: 0, view: "question" }
            : { view: "complete", completedAt: new Date().toISOString() };
          if (save(updates)) render();
        });
      }
      focus("#pcv-heading");
    }

    function render() {
      updatePosition();
      if (saved.view === "question") showQuestion();
      else showReview();
    }

    async function load() {
      download.clear();
      root.innerHTML = '<div class="pcv-body pcv-review"><p role="status">' +
        label("Loading Vocabulary", "正在载入词汇") + "</p></div>";
      currentQuestion = null;
      position.hidden = true;
      saved = restore();
      try {
        let data;
        if (library.entry(selection.id, saved.revision)) {
          packageMediaRoot = "";
          data = await library.load(selection.id, signal, saved.revision);
          data.cards = data.cards.map(card => ({
            ...card, wordAudio: library.siteMedia(card.wordAudio), picture: library.siteMedia(card.picture),
            pronunciations: card.pronunciations?.map(variant => ({
              ...variant, audio: library.siteMedia(variant.audio)
            }))
          }));
        } else {
          packageMediaRoot = oldMedia;
          const response = await fetch(oldData + selection.id + "-" + saved.revision + ".json", { signal });
          if (!response.ok) throw new Error("Missing vocabulary bank");
          data = await response.json();
        }
        mediaRoot = "../" + packageMediaRoot;
        if (signal.aborted) return;
        if (data.id !== selection.id || !Array.isArray(data.cards) || !data.cards[saved.index]) {
          throw new Error("Invalid vocabulary bank");
        }
        bank = data;
        render();
      } catch {
        if (signal.aborted) return;
        root.innerHTML = '<div class="pcv-body pcv-review"><div class="pcv-content"><p role="status">' +
          label("Vocabulary could not be loaded.", "词汇未能载入。") + "</p>" +
          button("pcv-retry", "Try Again", "重试载入") + "</div></div>";
        wire("pcv-retry", "click", load);
        focus("#pcv-retry");
      }
    }

    audio.addEventListener("ended", () => {
      if (audio.ended) playbackState(false);
    }, { signal });
    window.addEventListener("storage", event => {
      if (event.key !== selection.key) return;
      const latest = read(selection.key);
      if (!bank || !latest || latest.sequence <= saved.sequence) return;
      if (latest.revision !== saved.revision) {
        stopSound();
        load();
      } else {
        saved = latest;
        render();
        status("Progress updated in another window.", "这份学练已在另一个窗口更新。");
      }
    }, { signal });
    load();
    return () => {
      lifetime.abort();
      clearTimeout(spellingCheck);
      clearTimeout(hintTimer);
      stopSound();
      window.UnlockVocabularyPatch.stopFeedback();
      download.clear();
      root.replaceChildren();
      position.hidden = true;
    };
  }

  window.UnlockPreclassVocabulary = { assignment, read, mount };
})();

