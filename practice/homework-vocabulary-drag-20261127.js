"use strict";

(function () {
  const { escapeHTML: esc } = window.UnlockRules;
  const { label, setLabel } = window.UnlockStudentUI;
  const recordings = window.UnlockRecordings;
  const cues = window.UnlockVocabularyPatch;
  const recordingParts = [
    { id: "word", en: "Word", zh: "单词" },
    { id: "example", en: "Example Sentence", zh: "例句" }
  ];
  const library = window.UnlockVocabularyBank;
  const syllableDrag = window.UnlockSyllableDrag;
  const mediaRoot = "../assets/homework-vocabulary/";
  const stages = [
    { id: "cards", en: "Word Cards", zh: "词卡学习" },
    { id: "meaning", en: "Listen and Choose the Meaning", zh: "听音选义",
      instruction: "听单词音频，点选正确的中文词义。" },
    { id: "syllables", en: "Listen and Arrange the Syllables", zh: "听音拼音节",
      instruction: "把音节拖到对应空位，填满后自动检查。判对的音节会留在原位。" },
    { id: "match", en: "Match the Word to its Example", zh: "词卡匹配例句",
      instruction: "把所给单词代入空格，点选句意最通顺的一句。" },
    { id: "spelling", en: "Listen, Spell and Record", zh: "听音完整拼写并录音",
      instruction: "听单词音频并完整拼写。完成拼写后，分别录制单词和例句。" }
  ];

  function bankId(meta, code) {
    if (!/^[LSRW]_H[123]$/.test(code) || !Number.isInteger(meta?.unit)) return "";
    const track = /^[LS]/.test(code) ? "LS" : "RW";
    return "B" + String(meta.book).padStart(2, "0") + "-" + track + "-U" + String(meta.unit).padStart(2, "0");
  }

  function versionFor(meta, code, attempt) {
    const id = bankId(meta, code);
    if (!id) return null;
    const saved = attempt.homeworkVocabulary;
    if (saved?.bankId === id && /^[a-f0-9]{16}$/.test(saved.revision)) return saved.revision;
    const isStarted = attempt.sequence || attempt.first || attempt.second || attempt.classroomVocabulary ||
      attempt.classroomVocabularyVersion || Number.isInteger(attempt.homeworkDictationSeed) ||
      [attempt.draft, attempt.draftRecordings, attempt.wordDictation].some(items => Object.keys(items || {}).length);
    return isStarted ? null : library.entry(id)?.revision || null;
  }

  async function load(meta, code, revision, signal) {
    const id = bankId(meta, code);
    if (library.entry(id, revision)) {
      const bank = await library.load(id, signal, revision);
      return { ...bank, cards: bank.cards.map(card => ({
        ...card, mediaRoot: "../", picture: library.siteMedia(card.picture),
        wordAudio: library.siteMedia(card.wordAudio), exampleAudio: library.siteMedia(card.exampleAudio),
        pronunciations: card.pronunciations?.map(variant => ({
          ...variant, audio: library.siteMedia(variant.audio)
        }))
      })) };
    }
    const file = "data/homework-vocabulary/" + id + "-" + revision + ".json";
    const response = await window.UnlockPracticeCatalog.readResource(file, signal);
    const bank = await response.json();
    if (bank.id !== id || bank.book !== meta.book || bank.unit !== meta.unit || !bank.cards?.length) {
      throw new Error("Homework vocabulary does not match this assignment");
    }
    return { ...bank, revision };
  }

  function progress(bank, saved) {
    if (saved?.bankId === bank.id && saved.revision === bank.revision) return saved;
    return { bankId: bank.id, revision: bank.revision, step: 0, position: 0, done: false, items: {} };
  }

  function stageRecord(saved, card, kind) {
    return saved.items[card.id]?.[kind] || {};
  }

  function spelling(value) {
    return value.trim().normalize("NFC").replace(/[()]/g, "").replace(/[’‘]/g, "'")
      .replace(/[‐‑]/g, "-").replace(/\s+/g, " ").toLowerCase();
  }

  function correct(kind, card, answer) {
    if (kind === "spelling") {
      const key = spelling(answer);
      return key === spelling(card.word) || key === spelling(card.spoken);
    }
    if (kind === "syllables") {
      const { parts, options } = card.syllables;
      return answer.length === parts.length && parts.every((piece, index) => options[answer[index]] === piece);
    }
    return answer === card[kind].correct;
  }

  function graded(kind, card, record) {
    const answers = record.answers || [];
    return answers.length === 2 || (answers.length > 0 && correct(kind, card, answers.at(-1)));
  }

  function hasSeparateTakes(record) {
    const word = record.recordings?.word?.id;
    const example = record.recordings?.example?.id;
    return Boolean(word && example && word !== example);
  }

  function finished(kind, card, record) {
    if (kind === "cards") return Boolean(record.word && record.example);
    return graded(kind, card, record) &&
      (kind !== "spelling" || Boolean(record.recording?.id) || hasSeparateTakes(record));
  }

  function meter(bank, saved) {
    const kind = stages[saved.step].id;
    return {
      name: "已完成", english: "Completed", max: bank.cards.length,
      now: bank.cards.filter(card => finished(kind, card, stageRecord(saved, card, kind))).length
    };
  }

  function answerText(kind, card, answer) {
    if (kind === "spelling") return answer;
    if (kind === "syllables") return answer.map(index => card.syllables.options[index]).join(" / ");
    return card[kind].options[answer];
  }

  function results(bank, saved, copyRecording) {
    const objectiveStages = stages.slice(1);
    const items = bank.cards.map((card, index) => {
      const word = saved.items[card.id] || {};
      const responses = Object.fromEntries(objectiveStages.map(({ id }) => [
        id, (word[id]?.answers || []).map(answer => ({
          value: answerText(id, card, answer), correct: correct(id, card, answer)
        }))
      ]));
      const take = word.spelling || {};
      const position = index + 1;
      const recordings = {};
      const separate = hasSeparateTakes(take);
      const legacy = !separate && take.recording?.id
        ? copyRecording(take.recording, card, position, "朗读") : null;
      if (!legacy) {
        for (const { id, zh } of recordingParts) {
          recordings[id] = copyRecording(take.recordings?.[id], card, position, zh);
        }
      }
      return {
        id: card.id, position, word: card.word, example: card.example, responses,
        ...(card.match.term ? { matchTerm: card.match.term } : {}),
        recording: legacy, recordings
      };
    });
    const scores = objectiveStages.map(({ id, zh }) => ({
      id, name: zh, total: bank.cards.length,
      firstCorrect: items.filter(item => item.responses[id][0]?.correct).length
    }));
    return {
      wordlist: bank.id, revision: bank.revision, scores, items,
      firstCorrect: scores.reduce((sum, stage) => sum + stage.firstCorrect, 0),
      total: scores.reduce((sum, stage) => sum + stage.total, 0)
    };
  }

  function button(action, en, zh, attributes = "", primary = false) {
    return '<button type="button" class="button ui-action' + (primary ? " ui-primary" : "") +
      '" data-hw-action="' + action + '"' + (attributes ? " " + attributes : "") + ">" + label(en, zh) + "</button>";
  }

  function wordAudioButtons(card, showRoles = false) {
    const variants = card.pronunciations || [];
    const primary = showRoles && variants.length > 1 ? card.pos : "";
    const [en, zh] = library.playLabel(primary);
    return '<div class="hw-word-actions hw-word-audio" data-hw-word-audio>' + button("play-word", en, zh) +
      variants.slice(1).map((variant, index) =>
        button("play-variant", ...library.playLabel(variant.pos),
          'data-hw-pronunciation="' + (index + 1) + '"' + (showRoles ? "" : " hidden"))).join("") + '</div>';
  }

  function imageHTML(card) {
    return '<figure class="hw-vocab-picture-frame"><img class="hw-vocab-picture" src="' +
      esc((card.mediaRoot || mediaRoot) + card.picture) + '" alt="词汇例句配图" decoding="async"></figure>';
  }

  function cardsHTML(card) {
    const [before, term, after] = card.exampleParts;
    const variants = card.pronunciations || [];
    const translation = variants.length
      ? variants.map(item => esc(item.pos + ". " + item.meaning)).join("<br>") : esc(card.translation);
    const ipa = variants.length
      ? variants.map(item => esc(item.ipa + " (" + item.pos + ")")).join("　") : esc(card.ipa + " (" + card.pos + ")");
    const wordButtons = wordAudioButtons(card, true);
    return '<div class="hw-vocab-layout"><div><div class="hw-word-head"><h3 lang="en-GB">' + esc(card.word) +
      '</h3><strong class="hw-word-translation hw-vocab-reveal" data-hw-translation="word" lang="zh-CN" aria-hidden="true">' +
      translation + '</strong>' + wordButtons +
      '<p class="hw-word-ipa" lang="en-GB">' + ipa + '</p></div>' +
      '<h3 class="hw-vocab-label"><span lang="en">Meaning</span> 释义</h3>' +
      '<p class="hw-word-definition" lang="en-GB">' + esc(card.definition) + '</p><section class="hw-word-example">' +
      '<div class="hw-example-head"><h3 class="hw-vocab-label"><span lang="en">Example Sentence</span> 例句</h3>' +
      button("play-example", "Play Example", "播放例句") + '</div>' +
      '<p lang="en-GB">' + esc(before) + "<strong>" + esc(term) + "</strong>" + esc(after) + '</p>' +
      '<p class="hw-example-translation hw-vocab-reveal" data-hw-translation="example" lang="zh-CN" aria-hidden="true">' +
      esc(card.exampleTranslation) + "</p></section></div>" + imageHTML(card) + "</div>";
  }

  function optionsHTML(kind, card) {
    const locale = kind === "meaning" ? "zh-CN" : "en-GB";
    return '<div class="hw-vocab-options" data-hw-options="' + kind + '">' +
      card[kind].options.map((text, index) =>
        '<button type="button" class="hw-vocab-option" data-hw-option="' + index + '" lang="' + locale + '">' +
        esc(text) + "</button>"
      ).join("") + "</div>";
  }

  function audioPlayer(part, name) {
    return '<audio controls preload="metadata" data-hw-replay="' + part + '" aria-label="回听' + name +
      '" hidden></audio>';
  }

  function recordingHTML(card, readonly) {
    const targets = { word: card.word, example: card.example };
    const parts = recordingParts.map(({ id, en, zh }) =>
      '<section class="hw-recording-part" aria-labelledby="hw-record-label-' + id + '">' +
      '<h4 id="hw-record-label-' + id + '">' + label(en, zh) + '</h4>' +
      '<p class="hw-recording-target" lang="en-GB">' + esc(targets[id]) + '</p>' +
      '<div class="hw-vocab-record-actions">' + (readonly ? "" :
        button("record", "Start Recording", "开始录音", 'data-hw-part="' + id + '"')) +
      audioPlayer(id, zh + "录音") + '</div></section>'
    ).join("");
    return '<section class="hw-vocab-record" data-hw-recording hidden>' +
      '<h3>' + label("Read and Record", "朗读录音") + '</h3>' +
      '<p>分开录制单词和例句。录好后可以分别回听。</p>' +
      '<div class="hw-recording-parts">' + parts + '</div>' +
      '<div class="hw-recording-legacy" data-hw-legacy hidden><p>此前的单词与例句合录</p>' +
      audioPlayer("legacy", "此前的合录") + '</div>' +
      '<p class="hw-recording-status" data-hw-record-status role="status"></p></section>';
  }

  function spellingHTML(stage, card, record, readonly) {
    return '<div data-hw-spelling-stage><p class="hw-vocab-instruction">' + stage.instruction + '</p>' +
      button("play-word", "Play Word", "播放单词") +
      '<form data-hw-spelling><label for="hw-homework-spelling">完整拼写</label>' +
      '<input id="hw-homework-spelling" class="text-input" type="text" lang="en-GB" autocomplete="off" ' +
      'autocapitalize="none" spellcheck="false" maxlength="120" value="' + esc(record.draft || "") + '">' +
      '<button type="submit" class="button ui-action ui-primary" data-hw-check disabled>' +
      label("Check Answer", "检查答案") + "</button></form></div>" + recordingHTML(card, readonly);
  }

  function exerciseHTML(stage, card, record, readonly) {
    const kind = stage.id;
    const solution = '<div class="hw-syllable-row hw-vocab-reveal" data-hw-solution aria-hidden="true">' +
      '<strong id="hw-syllables-solution-label">正确顺序</strong>' +
      '<div data-hw-correct-order class="hw-syllable-order" role="group" aria-labelledby="hw-syllables-solution-label"></div></div>';
    const hasPicture = kind !== "spelling";
    const exercise = hasPicture ? '<p class="hw-vocab-instruction">' + stage.instruction + '</p>' +
      (kind === "match" ? '<p class="hw-vocab-target" lang="en-GB">' + esc(card.match.term || card.word) + "</p>"
        : kind === "meaning" ? wordAudioButtons(card) : button("play-word", "Play Word", "播放单词")) +
      (kind === "syllables" ? '<div data-hw-syllable-board></div>' : optionsHTML(kind, card))
      : spellingHTML(stage, card, record, readonly);
    return '<div class="hw-vocab-layout' + (hasPicture ? "" : " hw-vocab-one-column") + '"><div>' +
      exercise + '<p class="vocab-a11y" data-hw-verdict role="status"></p>' +
      (kind === "syllables" ? solution : "") +
      "</div>" + (hasPicture ? imageHTML(card) : "") + "</div>";
  }

  function syllableSlots(root, pieces) {
    if (root.children.length !== pieces.length) {
      root.replaceChildren(...pieces.map(() => {
        const slot = document.createElement("span");
        slot.className = "hw-syllable-slot";
        slot.setAttribute("role", "group");
        return slot;
      }));
    }
    for (const [index, slot] of Array.from(root.children).entries()) {
      const { text, result } = pieces[index];
      slot.dataset.result = result;
      const verdict = result === "correct" ? "，位置正确" : result === "wrong" ? "，位置错误" : "";
      slot.setAttribute("aria-label", "第 " + (index + 1) + " 个音节，" + (text || "待选") + verdict);
      if (slot.textContent === text) continue;
      if (text) {
        const tile = document.createElement("span");
        tile.className = "hw-syllable-tile";
        tile.lang = "en-GB";
        tile.textContent = text;
        slot.replaceChildren(tile);
      } else slot.replaceChildren();
    }
  }

  function mount(root, { bank, read, save, onFinish, readonly }) {
    const find = selector => root.querySelector(selector);
    let disposed = false;
    let recording = null;
    let activeAudio = null;
    let recordingError = "";

    function current() {
      const saved = read();
      const stage = stages[saved.step];
      const card = bank.cards[saved.position];
      return { saved, stage, card, record: stageRecord(saved, card, stage.id) };
    }

    function store(context, next) {
      const { saved, stage, card } = context;
      return save({ ...saved, items: { ...saved.items, [card.id]: { ...saved.items[card.id], [stage.id]: next } } });
    }

    function saveRecord(context, next, outcome) {
      if (!store(context, next)) return false;
      paint();
      if (typeof outcome === "boolean") {
        stopPlayback();
        cues.feedback(outcome);
      }
      return true;
    }

    function paintFeedback(kind, card, record, gradedNow) {
      const answers = record.answers || [];
      const latest = answers.at(-1);
      const right = answers.length > 0 && correct(kind, card, latest);
      const status = find("[data-hw-verdict]");
      const result = !answers.length ? "" : (right ? "作答正确。" : "作答错误。");
      const retry = answers.length === 1 && !gradedNow
        ? (kind === "syllables" ? "请把音节拖到红色空位。" : "请再试一次。") : "";
      const message = [result, retry].filter(Boolean).join(" ");
      if (status.textContent !== message) status.textContent = message;
    }

    function paintSyllables(card, record, gradedNow) {
      const { parts, options } = card.syllables;
      const latest = record.answers?.at(-1);
      syllableDrag.render(find("[data-hw-syllable-board]"), {
        syllables: card.syllables,
        draft: record.order,
        last: latest,
        done: gradedNow,
        readonly,
        onChange: arrangeSyllables
      });
      const solutionSlots = find("[data-hw-correct-order]");
      const longest = Math.max(...options.map(text => Array.from(text).length));
      solutionSlots.style.setProperty("--hw-tile-ch", longest);
      syllableSlots(solutionSlots, parts.map(text => ({ text, result: "correct" })));
      find("[data-hw-solution]").setAttribute("aria-hidden", String(!(gradedNow && !correct("syllables", card, latest))));
    }

    function recordingControl(part) {
      return find('[data-hw-action=record][data-hw-part="' + part + '"]');
    }

    function paintReplay(player, clip, visible = true) {
      const id = clip?.id || "";
      player.hidden = Boolean(recording) || !id || !visible;
      if (!id || player.dataset.clip === id) return;
      player.pause();
      player.removeAttribute("src");
      player.dataset.clip = id;
      recordings.url(id).then(url => {
        if (!disposed && player.isConnected && player.dataset.clip === id) player.src = url;
      }).catch(error => {
        if (!disposed && player.isConnected && player.dataset.clip === id) {
          delete player.dataset.clip;
          recordingError = error.message;
          find("[data-hw-record-status]").textContent = recordingError;
        }
      });
    }

    function paintRecording(record) {
      for (const { id, zh } of recordingParts) {
        const clip = record.recordings?.[id];
        const control = recordingControl(id);
        const phase = recording?.part === id ? recording.phase : null;
        const words = phase === "request" ? ["Preparing Microphone", "准备录音"]
          : phase === "recording" ? ["Stop Recording", "结束录音"]
            : phase === "saving" ? ["Saving Recording", "正在保存录音"]
              : clip ? ["Record Again", "重新录音"] : ["Start Recording", "开始录音"];
        if (control) {
          if (control.dataset.presentation !== words[0]) {
            control.innerHTML = label(...words);
            control.dataset.presentation = words[0];
          }
          control.setAttribute("aria-label", words[1] + "，" + zh);
          control.disabled = Boolean(recording) && phase !== "recording";
        }
        paintReplay(find('[data-hw-replay="' + id + '"]'), clip);
      }
      const showLegacy = Boolean(record.recording?.id);
      find("[data-hw-legacy]").hidden = !showLegacy;
      paintReplay(find('[data-hw-replay="legacy"]'), record.recording, showLegacy);
      const status = find("[data-hw-record-status]");
      const message = recordingError || (recording?.phase === "recording" ? "正在录音。" : "");
      if (status.textContent !== message) status.textContent = message;
    }

    function paint() {
      const { saved, stage: { id: kind }, card, record } = current();
      find("[data-hw-action=previous]").disabled = Boolean(recording) || (saved.step === 0 && saved.position === 0);
      find("[data-hw-action=next]").disabled = Boolean(recording) || !finished(kind, card, record);
      if (kind === "cards") {
        for (const part of ["word", "example"]) {
          find('[data-hw-translation="' + part + '"]').setAttribute("aria-hidden", String(!record[part]));
        }
        return;
      }
      const gradedNow = graded(kind, card, record);
      const answers = record.answers || [];
      paintFeedback(kind, card, record, gradedNow);
      if (kind === "meaning" && card.pronunciations?.length > 1) {
        const controls = find("[data-hw-word-audio]");
        const base = controls.querySelector('[data-hw-action="play-word"]');
        setLabel(base, ...library.playLabel(gradedNow ? card.pos : ""));
        for (const alternate of controls.querySelectorAll("[data-hw-pronunciation]")) alternate.hidden = !gradedNow;
      }
      if (kind === "spelling") {
        const input = find("#hw-homework-spelling");
        input.readOnly = gradedNow || readonly || Boolean(recording);
        input.dataset.result = answers.length ? (correct(kind, card, answers.at(-1)) ? "correct" :
          input.value === answers.at(-1) ? "wrong" : "") : "";
        find("[data-hw-check]").disabled = input.readOnly || !input.value.trim();
        const spellingStage = find("[data-hw-spelling-stage]");
        if (gradedNow && !spellingStage.hidden) {
          if (document.activeElement === input) input.blur();
          find(".hw-vocab-scroll").scrollTop = 0;
        }
        spellingStage.hidden = gradedNow;
        find("[data-hw-recording]").hidden = !gradedNow;
        if (gradedNow) paintRecording(record);
        return;
      }
      if (kind === "syllables") {
        paintSyllables(card, record, gradedNow);
        return;
      }
      for (const option of root.querySelectorAll("[data-hw-option]")) {
        const index = Number(option.dataset.hwOption);
        const wrong = answers.includes(index) && index !== card[kind].correct;
        const right = gradedNow && index === card[kind].correct;
        option.disabled = readonly || gradedNow || wrong;
        option.dataset.result = wrong ? "wrong" : right ? "correct" : "";
        if (kind === "match" && right && option.textContent !== card.example) option.textContent = card.example;
        const verdict = wrong ? "，答错" : right ? "，正确" : "";
        option.setAttribute("aria-label", option.textContent + verdict);
      }
    }

    function stopPlayback() {
      cues.stopFeedback();
      for (const replay of root.querySelectorAll("[data-hw-replay]")) {
        if (!replay.paused) replay.pause();
      }
      if (!activeAudio) return;
      const { player, control } = activeAudio;
      activeAudio = null;
      player.pause();
      control.setAttribute("aria-pressed", "false");
    }

    function play(part, control) {
      if (recording) return;
      stopPlayback();
      const context = current();
      const { card, stage } = context;
      const player = find("audio[data-hw-cue]");
      const variant = part === "variant" ? card.pronunciations?.[Number(control.dataset.hwPronunciation)] : null;
      if (part === "variant" && !variant) return;
      player.src = (card.mediaRoot || mediaRoot) + (variant?.audio ?? (part === "word" ? card.wordAudio : card.exampleAudio));
      const audioStatus = find("[data-hw-audio-status]");
      audioStatus.textContent = "";
      const request = { player, control };
      activeAudio = request;
      control.setAttribute("aria-pressed", "true");
      player.onended = () => {
        if (disposed || activeAudio !== request || !player.ended) return;
        stopPlayback();
        if (stage.id !== "cards" || readonly) return;
        const fresh = current();
        const reveal = part === "variant" ? "word" : part;
        if (fresh.card.id === card.id && fresh.stage.id === "cards" && !fresh.record[reveal]) {
          saveRecord(fresh, { ...fresh.record, [reveal]: true });
        }
      };
      player.play().catch(() => {
        if (disposed || activeAudio !== request) return;
        stopPlayback();
        audioStatus.textContent = "音频暂时无法播放，请重试。";
      });
    }

    function render(focusHeading = false) {
      const { saved, stage, card, record } = current();
      const first = saved.position === 0;
      const last = saved.position === bank.cards.length - 1;
      const finalStep = saved.step === stages.length - 1;
      const counter = (saved.position + 1) + " / " + bank.cards.length;
      root.dataset.hwStep = stage.id;
      root.innerHTML = '<div class="hw-vocab-scroll" tabindex="0" role="region" aria-label="词汇学练内容">' +
        '<header class="hw-vocab-heading"><h2 tabindex="-1" data-hw-heading>' +
        (stage.id === "cards" ? label(stage.en + " " + counter, stage.zh + " " + counter) : label(stage.en, stage.zh)) +
        '</h2>' + (stage.id === "cards" ? "" : '<p class="hw-vocab-counter" aria-label="本环节词汇进度">' + counter + "</p>") + "</header>" +
        (stage.id === "cards" ? cardsHTML(card) : exerciseHTML(stage, card, record, readonly)) +
        '<audio data-hw-cue preload="none" hidden></audio><p class="hw-vocab-audio-status" data-hw-audio-status role="status"></p></div>' +
        '<footer class="hw-vocab-footer">' +
        (first ? button("previous", "Previous Step", "上一环节") : button("previous", "Previous Word", "上一词")) +
        (last ? finalStep ? button("next", "Go to Questions", "进入学科题", "", true)
          : button("next", "Next Step", "下一环节", "", true) : button("next", "Next Word", "下一词", "", true)) + "</footer>";
      recordingError = "";
      paint();
      if (focusHeading) find("[data-hw-heading]").focus({ preventScroll: true });
    }

    function move(direction) {
      const { saved } = current();
      let { position, step, done } = saved;
      position += direction;
      if (position < 0) {
        step -= 1;
        position = bank.cards.length - 1;
      } else if (position === bank.cards.length) {
        step += 1;
        position = 0;
      }
      if (step < 0 || recording) return;
      stopPlayback();
      if (step === stages.length) {
        if (done || save({ ...saved, done: true })) onFinish();
        return;
      }
      if (save({ ...saved, step, position })) render(true);
    }

    function choose(index) {
      const context = current();
      const { card, stage: { id: kind }, record } = context;
      if (readonly || kind === "syllables" || graded(kind, card, record)) return;
      const answers = record.answers || [];
      if (answers.includes(index)) return;
      saveRecord(context, { answers: [...answers, index] }, correct(kind, card, index));
    }

    function arrangeSyllables(order) {
      const context = current();
      const { card, stage, record } = context;
      if (readonly || stage.id !== "syllables" || graded("syllables", card, record)) return;
      if (order.includes(null)) {
        saveRecord(context, { ...record, order });
        return;
      }
      const answers = [...(record.answers || []), order];
      const outcome = correct("syllables", card, order);
      const retry = answers.length === 1 && !outcome;
      const focused = find("[data-hw-syllable-board]").contains(document.activeElement);
      if (saveRecord(context, { answers, order: retry ? syllableDrag.retain(card.syllables, order) : order }, outcome) && focused) {
        find(retry ? "[data-syllable-option]:not(:disabled)" : "[data-hw-action=next]")?.focus({ preventScroll: true });
      }
    }

    function preventLeaving(event) {
      event.preventDefault();
      event.returnValue = "";
    }

    async function recordPart(part) {
      if (readonly || !recordingParts.some(item => item.id === part)) return;
      if (recording) {
        if (recording.part === part && recording.phase === "recording") {
          recording.phase = "saving";
          recording.handle.stop();
          paint();
        }
        return;
      }
      const { card, stage, record } = current();
      if (stage.id !== "spelling" || !graded(stage.id, card, record)) return;
      stopPlayback();
      recordingError = "";
      const job = { part, phase: "request", handle: null };
      recording = job;
      window.addEventListener("beforeunload", preventLeaving);
      paint();
      let clip;
      try {
        const handle = await recordings.begin();
        job.handle = handle;
        if (disposed || recording !== job) handle.cancel();
        else {
          job.phase = "recording";
          paint();
          recordingControl(part)?.focus({ preventScroll: true });
        }
        clip = await handle.result;
      } catch (error) {
        recordingError = error.message;
      } finally {
        if (recording === job) {
          recording = null;
          window.removeEventListener("beforeunload", preventLeaving);
        }
      }
      if (disposed) return;
      const context = current();
      if (context.card.id !== card.id || context.stage.id !== "spelling") return;
      if (clip?.id) {
        const next = { ...context.record, recordings: { ...context.record.recordings, [part]: clip } };
        const other = part === "word" ? "example" : "word";
        if (next.recordings[other]?.id === clip.id) {
          recordingError = "请为单词和例句分别录音。";
          paint();
        } else if (!saveRecord(context, next)) paint();
      } else paint();
      recordingControl(part)?.focus({ preventScroll: true });
    }

    root.addEventListener("click", event => {
      const control = event.target.closest("button");
      if (!control || control.disabled) return;
      if ("hwOption" in control.dataset) choose(Number(control.dataset.hwOption));
      const action = control.dataset.hwAction;
      if (action === "play-word" || action === "play-example" || action === "play-variant") play(action.slice(5), control);
      if (action === "previous") move(-1);
      if (action === "next") move(1);
      if (action === "record") recordPart(control.dataset.hwPart);
    });

    root.addEventListener("play", event => {
      if (!event.target.matches?.("[data-hw-replay]")) return;
      cues.stopFeedback();
      for (const player of root.querySelectorAll("[data-hw-replay]")) {
        if (player !== event.target && !player.paused) player.pause();
      }
    }, true);

    root.addEventListener("input", event => {
      if (event.target.id !== "hw-homework-spelling" || readonly) return;
      const context = current();
      saveRecord(context, { ...context.record, draft: event.target.value });
    });

    root.addEventListener("submit", event => {
      if (!event.target.matches("[data-hw-spelling]")) return;
      event.preventDefault();
      const context = current();
      const { card, record } = context;
      const input = find("#hw-homework-spelling");
      const value = input.value.trim();
      if (readonly || !value || graded("spelling", card, record) || recording) return;
      const outcome = correct("spelling", card, value);
      const retry = !record.answers?.length && !outcome;
      const kept = saveRecord(context, { ...record, answers: [...(record.answers || []), value], draft: input.value }, outcome);
      if (!kept) return;
      if (retry && input.isConnected) {
        input.focus({ preventScroll: true });
        input.select();
      } else recordingControl("word")?.focus({ preventScroll: true });
    });

    render();
    return {
      busy: () => Boolean(recording),
      focusRecording() { recordingControl(recording?.part || "word")?.focus({ preventScroll: true }); },
      dispose() {
        disposed = true;
        stopPlayback();
        recording?.handle?.cancel();
        recording = null;
        window.removeEventListener("beforeunload", preventLeaving);
      }
    };
  }

  window.UnlockHomeworkVocabulary = { versionFor, load, progress, meter, results, mount };
})();

