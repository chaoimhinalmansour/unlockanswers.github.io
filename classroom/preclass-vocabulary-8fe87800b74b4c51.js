window.UNLOCK_PRECLASS_VOCABULARY_BANKS = {"B01-RW-U01":{"revision":"c426a4118d433093","count":27},"B01-LS-U01":{"revision":"fda6a3c08c6086ad","count":14},"B01-RW-U02":{"revision":"4b108c12bf47d760","count":14},"B01-LS-U02":{"revision":"2ce797d63459debf","count":42},"B01-RW-U03":{"revision":"af997cb3d1da7606","count":35},"B01-LS-U03":{"revision":"2b065170467e33d9","count":36},"B01-RW-U04":{"revision":"62cd5766064c3db3","count":25},"B01-LS-U04":{"revision":"769d6a96c3c2cf23","count":27},"B01-RW-U05":{"revision":"a58a37973de5dcb1","count":26},"B01-LS-U05":{"revision":"62a4aafd3399256e","count":13},"B01-RW-U06":{"revision":"3636c751d68fcc59","count":35},"B01-LS-U06":{"revision":"5eb99ff1944552eb","count":32},"B01-RW-U07":{"revision":"debc059bb90d1f8e","count":29},"B01-LS-U07":{"revision":"718c2af616568f9c","count":21},"B01-RW-U08":{"revision":"380049822c932db2","count":22},"B01-LS-U08":{"revision":"5ae5e37732bbca57","count":20},"B02-RW-U01":{"revision":"0d22f01f57ed6a77","count":21},"B02-LS-U01":{"revision":"ea38a801ef1eb015","count":21},"B02-RW-U02":{"revision":"dda65e3cecefe18d","count":12},"B02-LS-U02":{"revision":"515dbf117c4fa15b","count":28},"B02-RW-U03":{"revision":"97590dbe69152a58","count":19},"B02-LS-U03":{"revision":"ef624c8ca76f7a39","count":38},"B02-RW-U04":{"revision":"048b6cdd5ec547fc","count":21},"B02-LS-U04":{"revision":"1e839c129ab71eb4","count":20},"B02-RW-U05":{"revision":"a24676564b333026","count":13},"B02-LS-U05":{"revision":"7a209e3ef1a0864f","count":14},"B02-RW-U06":{"revision":"ae4cb6577f1b15f3","count":22},"B02-LS-U06":{"revision":"efe6e326ba95e113","count":22},"B02-RW-U07":{"revision":"821e470c59608ce7","count":27},"B02-LS-U07":{"revision":"fbe3aa56ef19ad8d","count":33},"B02-RW-U08":{"revision":"4c2b2b32495221dc","count":20},"B02-LS-U08":{"revision":"b3ade804f6c2ca51","count":19},"B03-RW-U01":{"revision":"e8d1668249ea659e","count":21},"B03-LS-U01":{"revision":"72cb57252044caa1","count":28},"B03-RW-U02":{"revision":"a2fef121646f5783","count":23},"B03-LS-U02":{"revision":"86f935e40ecec7ce","count":15},"B03-RW-U03":{"revision":"4576089d8c5e7aaa","count":23},"B03-LS-U03":{"revision":"d194f17ef9011884","count":24},"B03-RW-U04":{"revision":"8d6ab34b27f6fad2","count":21},"B03-LS-U04":{"revision":"3ec399aae771c7a1","count":25},"B03-RW-U05":{"revision":"8de8b3dca0e31a3a","count":21},"B03-LS-U05":{"revision":"8bcf9ee202129bb9","count":31},"B03-RW-U06":{"revision":"17301ecbad20a619","count":19},"B03-LS-U06":{"revision":"c346c91eb24eec47","count":24},"B03-RW-U07":{"revision":"8dea02723b9b8c81","count":21},"B03-LS-U07":{"revision":"73daf0566bf99416","count":18},"B03-RW-U08":{"revision":"8d7847b2c0ba0b91","count":26},"B03-LS-U08":{"revision":"9e4f8ae6455053eb","count":27}};
"use strict";

(function () {
  const catalog = window.UNLOCK_PRECLASS_VOCABULARY_BANKS;
  const { escapeHTML: esc, judge } = window.UnlockRules;
  const { label, setLabel } = window.UnlockStudentUI;
  const rounds = [
    { id: "meaning", en: "Listen and Choose the Meaning", zh: "听音选义", directions: "听单词音频，选出正确的中文词义。" },
    { id: "syllables", en: "Listen and Arrange the Syllables", zh: "听音拼音节", directions: "按顺序点选音节，填满后自动检查。点选已填音节可撤回。" },
    { id: "spelling", en: "Listen and Spell", zh: "听音完整拼写", directions: "听单词音频，写出完整拼写，再按回车或点击检查拼写。" }
  ];

  function bankID(unit) {
    return "B" + String(unit.book).padStart(2, "0") + "-" + unit.track +
      "-U" + String(unit.number).padStart(2, "0");
  }

  function assignment(student, unit, week) {
    const id = bankID(unit);
    const entry = catalog[id];
    if (!entry || ![1, 2].includes(week)) return null;
    const scope = [student.storageName ?? student.name, student.level, student.adminClass,
      id, "W" + week, "L" + unit.lesson].map(encodeURIComponent).join(":");
    return { id, week, count: entry.count, revision: entry.revision,
      key: "unlock.classroom.preclass-vocabulary.v1:" + scope };
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
      unit.track + " Week " + selection.week + " Lesson " + unit.lesson + " 课前词汇学练";
    return window.UnlockReport.prepare({
      student, title, sections, tracks,
      worksheet: { id: selection.id + "-W" + selection.week + "-L" + unit.lesson,
        revision: saved.revision, book: unit.book, unit: unit.number, week: selection.week,
        track: unit.track, lesson: unit.lesson, code: "CLASSROOM_PRECLASS_VOCABULARY" },
      attempt: { first, second, completedAt: saved.completedAt }
    });
  }

  function mount({ root, student, unit, selection, position, saveStatus, download }) {
    const lifetime = new AbortController();
    const { signal } = lifetime;
    const audio = new Audio();
    audio.preload = "none";
    let startedPlay = 0;
    let bank, saved, currentQuestion;
    const find = query => root.querySelector(query);
    const status = (en, zh) => setLabel(saveStatus, en, zh);
    const packageMediaRoot = selection.id.startsWith("B01-")
      ? "assets/preclass-vocabulary/" : "assets/homework-vocabulary/";
    const mediaRoot = "../" + packageMediaRoot;
    const dataRoot = selection.id.startsWith("B01-")
      ? "data/preclass-vocabulary/" : "../practice/data/homework-vocabulary/";

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

    function playbackState(playing) {
      const control = find("#pcv-play");
      if (!control) return;
      control.setAttribute("aria-pressed", String(playing));
      setLabel(control.querySelector(".pcv-play-label"), playing ? "Playing" : "Play Word",
        playing ? "正在播放" : "播放单词");
    }

    function stopSound() {
      startedPlay++;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      playbackState(false);
    }

    function play() {
      const token = ++startedPlay;
      audio.pause();
      const source = new URL(mediaRoot + currentQuestion.card.wordAudio, location.href).href;
      if (audio.src !== source) audio.src = source;
      audio.currentTime = 0;
      playbackState(true);
      find(".pcv-audio-status").textContent = "";
      audio.play().catch(() => {
        if (token !== startedPlay || signal.aborted) return;
        playbackState(false);
        find(".pcv-audio-status").textContent = "音频未能播放，请再试一次。";
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
        root.innerHTML = '<div class="pcv-body"><div class="pcv-prompt"><h3 id="pcv-heading" tabindex="-1">' +
          label(stage.en, stage.zh) + '</h3><p class="pcv-directions">' + esc(stage.directions) + '</p></div>' +
          '<div class="pcv-audio"><button type="button" id="pcv-play" class="ui-action" aria-pressed="false">' +
          '<span class="pcv-play-label">' + label("Play Word", "播放单词") + '</span>' +
          '<span class="pcv-bars" aria-hidden="true"><i></i><i></i><i></i></span>' +
          '</button><span class="pcv-audio-status" role="status"></span></div><div class="pcv-work"><div id="pcv-answer"></div>' +
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
        wire("pcv-play", "click", play);
        wire("pcv-next", "click", advance);
      }
      updateAnswer();
      if (!same) focus("#pcv-play");
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
          (correct ? "答对" : "答错") + "</span>" + tiles.join("") + "</div>";
      }).join("");
    }

    function updateAnswer(focusAfter, animatedTile) {
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
        hint = logSyllables(card, history);
        if (done && !response.correct) {
          hint += '<div class="pcv-attempt"><span>正确顺序</span>' +
            parts.map(part => '<b class="pcv-chip is-correct">' + esc(part) + "</b>").join("") + "</div>";
        }
      } else {
        answer.innerHTML = '<form id="pcv-spelling"><label for="pcv-word">' + label("Full Spelling", "完整拼写") +
          '</label><input id="pcv-word" type="text" lang="en" autocomplete="off" autocapitalize="off"' +
          ' spellcheck="false" maxlength="160"' + (done ? " readonly" : "") + '><button id="pcv-check" type="submit"' +
          ' class="ui-action ui-primary">' + label("Check Spelling", "检查拼写") + "</button></form>";
        const input = find("#pcv-word");
        const check = find("#pcv-check");
        input.value = done ? "" : saved.draft;
        if (done) input.disabled = true;
        check.disabled = done || !input.value.trim();
        input.addEventListener("input", () => {
          if (save({ draft: input.value })) check.disabled = !input.value.trim();
        });
        wire("pcv-spelling", "submit", event => {
          event.preventDefault();
          if (!done && !check.disabled) submit(input.value);
        });
        hint = history.map(({ value, correct }, index) => '<div class="pcv-attempt"><span>第 ' +
          (index + 1) + " 次 " + (correct ? "答对" : "答错") + '</span><b class="pcv-chip is-' +
          (correct ? "correct" : "incorrect") + '" lang="en">' + esc(value) + "</b></div>").join("");
        if (done && !response.correct) {
          hint += '<div class="pcv-attempt"><span>正确拼写</span><b class="pcv-chip is-correct" lang="en">' +
            esc(card.spoken) + "</b></div>";
        }
      }
      const note = response ? response.correct ? history.length === 1 ? "答对了。" : "重试答对了。"
        : done ? "已显示正确答案。" : "这次答错了。还有一次机会。" : "";
      feedback.innerHTML = '<p class="pcv-result">' + esc(note) + "</p>" + hint;
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
      if (!save({ draft: "", answers: { ...saved.answers, [stage]: { ...answers, [card.id]: next } } })) return;
      const retryFocus = { meaning: "[data-choice]:not(:disabled)", syllables: "[data-tile]:not(:disabled)", spelling: "#pcv-word" };
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
      if (currentQuestion) stopSound();
      currentQuestion = null;
      const complete = saved.view === "complete";
      const stage = rounds[saved.round];
      const next = rounds[saved.round + 1];
      const sections = complete ? rounds : [stage];
      root.innerHTML = '<div class="pcv-body pcv-review"><div class="pcv-content"><h3 id="pcv-heading" tabindex="-1">' +
        (complete ? label("Practice Complete", "课前词汇学练已完成") : label("Round Results", "本轮结果")) +
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
        const response = await fetch(dataRoot + selection.id + "-" + saved.revision + ".json", { signal });
        if (!response.ok) throw new Error("Missing vocabulary bank");
        const data = await response.json();
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

    audio.addEventListener("ended", () => playbackState(false), { signal });
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
      stopSound();
      download.clear();
      root.replaceChildren();
      position.hidden = true;
    };
  }

  window.UnlockPreclassVocabulary = { assignment, read, mount };
})();

