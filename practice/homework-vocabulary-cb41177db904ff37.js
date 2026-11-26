"use strict";

(function () {
  const { escapeHTML: esc } = window.UnlockRules;
  const { label } = window.UnlockStudentUI;
  const recordings = window.UnlockRecordings;
  const library = window.UnlockVocabularyBank;
  const mediaRoot = "../assets/homework-vocabulary/";
  const stages = [
    { id: "cards", en: "Word Cards", zh: "词卡学习" },
    { id: "meaning", en: "Listen and Choose the Meaning", zh: "听音选义",
      instruction: "听单词音频，点选正确的中文词义。" },
    { id: "syllables", en: "Listen and Arrange the Syllables", zh: "听音拼音节",
      instruction: "听音频，按顺序点选音节。选满后自动检查，选满前可再次点选撤销。" },
    { id: "match", en: "Match the Word to its Example", zh: "词卡匹配例句",
      instruction: "把所给单词代入空格，点选句意最通顺的一句。" },
    { id: "spelling", en: "Listen, Spell and Record", zh: "听音完整拼写并录音",
      instruction: "听单词音频并完整拼写。完成拼写后，朗读单词和例句。" }
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
    if (library.entry(id)?.revision === revision) {
      const bank = await library.load(id, signal);
      return { ...bank, cards: bank.cards.map(card => ({ ...card, mediaRoot: "../",
        picture: library.siteMedia(card.picture), wordAudio: library.siteMedia(card.wordAudio),
        exampleAudio: library.siteMedia(card.exampleAudio)
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

  function finished(kind, card, record) {
    if (kind === "cards") return Boolean(record.word && record.example);
    return graded(kind, card, record) && (kind !== "spelling" || Boolean(record.recording));
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
      return {
        id: card.id, position: index + 1, word: card.word, example: card.example, responses,
        ...(card.match.term ? { matchTerm: card.match.term } : {}),
        recording: copyRecording(word.spelling?.recording, card, index + 1)
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

  function imageHTML(card) {
    return '<img class="hw-vocab-picture" src="' + esc((card.mediaRoot || mediaRoot) + card.picture) + '" alt="词汇例句配图" decoding="async">';
  }

  function cardsHTML(card) {
    const [before, term, after] = card.exampleParts;
    return '<div class="hw-vocab-layout"><div><div class="hw-word-head"><h3 lang="en-GB">' + esc(card.word) +
      '</h3><strong class="hw-word-translation hw-vocab-reveal" data-hw-translation="word" lang="zh-CN" aria-hidden="true">' +
      esc(card.translation) + '</strong>' + button("play-word", "Play Word", "播放单词") +
      '<p class="hw-word-ipa" lang="en-GB">' + esc(card.ipa + " (" + card.pos + ")") + '</p></div>' +
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

  function spellingHTML(record, readonly) {
    return '<form data-hw-spelling><label for="hw-homework-spelling">完整拼写</label>' +
      '<input id="hw-homework-spelling" class="text-input" type="text" lang="en-GB" autocomplete="off" ' +
      'autocapitalize="none" spellcheck="false" maxlength="120" value="' + esc(record.draft || "") + '">' +
      '<button type="submit" class="button ui-action ui-primary" data-hw-check disabled>' +
      label("Check Answer", "检查答案") + "</button></form>" +
      '<section class="hw-vocab-record" data-hw-recording hidden><h3>' + label("Read and Record", "朗读录音") + '</h3>' +
      '<p>请在同一段录音里先读单词，再读完整例句。</p>' +
      '<p class="hw-vocab-target" data-hw-record-word lang="en-GB"></p><p data-hw-record-example lang="en-GB"></p>' +
      '<div class="hw-vocab-record-actions">' + (readonly ? "" : button("record", "Start Recording", "开始录音")) +
      '<audio controls preload="metadata" data-hw-replay aria-label="回听本词录音" hidden></audio></div>' +
      '<p data-hw-record-status role="status"></p></section>';
  }

  function exerciseHTML(stage, card, record, readonly) {
    const kind = stage.id;
    const slots = '<div class="hw-syllable-row"><strong id="hw-syllables-label">已选音节</strong>' +
      '<div data-hw-order class="hw-syllable-order" role="group" aria-labelledby="hw-syllables-label"></div></div>';
    const solution = '<div class="hw-syllable-row hw-vocab-reveal" data-hw-solution aria-hidden="true">' +
      '<strong id="hw-syllables-solution-label">正确顺序</strong>' +
      '<div data-hw-correct-order class="hw-syllable-order" role="group" aria-labelledby="hw-syllables-solution-label"></div></div>';
    const hasPicture = kind !== "spelling";
    return '<div class="hw-vocab-layout' + (hasPicture ? "" : " hw-vocab-one-column") + '"><div>' +
      '<p class="hw-vocab-instruction">' + stage.instruction + '</p>' +
      (kind === "match" ? '<p class="hw-vocab-target" lang="en-GB">' + esc(card.match.term || card.word) + "</p>"
        : button("play-word", "Play Word", "播放单词")) +
      (kind === "syllables" ? slots : "") + (kind === "spelling"
        ? spellingHTML(record, readonly)
        : optionsHTML(kind, card)) +
      '<p class="hw-vocab-feedback" data-hw-feedback role="status"></p>' +
      (kind === "syllables" ? solution : "") +
      (kind === "match" ? '<p class="hw-vocab-reveal" data-hw-solution aria-hidden="true" lang="en-GB">' + esc(card.example) + "</p>" : "") +
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
    let replayId = "";
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

    function saveRecord(context, next) {
      if (store(context, next)) paint();
    }

    function feedback(kind, card, record) {
      const answers = record.answers || [];
      if (answers.length === 0) return "";
      if (correct(kind, card, answers.at(-1))) return answers.length === 1 ? "首次作答正确。" : "重试后答对了。";
      if (answers.length === 1) return kind === "syllables" ? "请按顺序重选红色位置的音节。" : "请再试一次。";
      if (kind === "syllables") return "已用完重试。请查看正确顺序。";
      if (kind === "match") return "已用完重试。请查看正确例句。";
      return "正确答案是「" + (kind === "spelling" ? card.word : card.translation) + "」。";
    }

    function paintSyllables(card, record, gradedNow) {
      const { parts, options } = card.syllables;
      const latest = record.answers?.at(-1);
      const order = record.order || [];
      const pieces = parts.map((part, index) => {
        const chosen = order[index];
        const checked = latest?.[index];
        const marked = checked != null && (options[checked] === part || chosen == null || gradedNow);
        return {
          text: options[chosen ?? checked] || "",
          result: marked ? (options[checked] === part ? "correct" : "wrong") : ""
        };
      });
      syllableSlots(find("[data-hw-order]"), pieces);
      syllableSlots(find("[data-hw-correct-order]"), parts.map(text => ({ text, result: "correct" })));
      find("[data-hw-solution]").setAttribute("aria-hidden", String(!(gradedNow && !correct("syllables", card, latest))));
    }

    function paintRecording(card, record) {
      const controls = find("[data-hw-action=record]");
      const words = recording?.phase === "request" ? ["Preparing Microphone", "准备录音"]
        : recording?.phase === "recording" ? ["Stop Recording", "结束录音"]
          : recording?.phase === "saving" ? ["Saving Recording", "正在保存录音"]
            : record.recording ? ["Record Again", "重新录音"] : ["Start Recording", "开始录音"];
      if (controls) {
        controls.innerHTML = label(...words);
        controls.disabled = Boolean(recording && recording.phase !== "recording");
      }
      find("[data-hw-record-word]").textContent = card.word;
      find("[data-hw-record-example]").textContent = card.example;
      const status = find("[data-hw-record-status]");
      status.textContent = recordingError || (recording?.phase === "recording" ? "正在录音。" : "");
      const player = find("[data-hw-replay]");
      player.hidden = Boolean(recording) || !record.recording;
      const clip = record.recording;
      if (clip && clip.id !== replayId) {
        replayId = clip.id;
        recordings.url(clip.id).then(url => {
          if (!disposed && replayId === clip.id && player.isConnected) player.src = url;
        }).catch(error => {
          if (!disposed && player.isConnected) status.textContent = error.message;
        });
      }
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
      const message = feedback(kind, card, record);
      const status = find("[data-hw-feedback]");
      if (status.textContent !== message) status.textContent = message;
      if (kind === "spelling") {
        const input = find("#hw-homework-spelling");
        input.readOnly = gradedNow || readonly || Boolean(recording);
        input.dataset.result = answers.length ? (correct(kind, card, answers.at(-1)) ? "correct" :
          input.value === answers.at(-1) ? "wrong" : "") : "";
        find("[data-hw-check]").disabled = input.readOnly || !input.value.trim();
        find("[data-hw-recording]").hidden = !gradedNow;
        find("[data-hw-action=play-word]").disabled = Boolean(recording);
        if (gradedNow) paintRecording(card, record);
        return;
      }
      const currentOrder = record.order || [];
      for (const option of root.querySelectorAll("[data-hw-option]")) {
        const index = Number(option.dataset.hwOption);
        const last = answers.at(-1);
        const syllables = kind === "syllables";
        const position = syllables ? last?.indexOf(index) ?? -1 : -1;
        const locked = position >= 0 && card.syllables.options[index] === card.syllables.parts[position];
        const wrong = syllables ? position >= 0 && !locked && (gradedNow || !currentOrder.includes(index))
          : answers.includes(index) && index !== card[kind].correct;
        const right = syllables ? locked : gradedNow && index === card[kind].correct;
        option.disabled = readonly || gradedNow || (syllables ? locked : wrong);
        if (syllables) option.setAttribute("aria-pressed", String(currentOrder.includes(index)));
        option.dataset.result = wrong ? "wrong" : right ? "correct" : "";
        const verdict = wrong ? "，答错" : right ? "，正确" : "";
        option.setAttribute("aria-label", option.textContent + verdict);
      }
      if (kind === "syllables") paintSyllables(card, record, gradedNow);
      if (kind === "match") find("[data-hw-solution]").setAttribute("aria-hidden", String(!gradedNow));
    }

    function stopPlayback() {
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
      player.src = (card.mediaRoot || mediaRoot) + (part === "word" ? card.wordAudio : card.exampleAudio);
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
        if (fresh.card.id === card.id && fresh.stage.id === "cards" && !fresh.record[part]) {
          saveRecord(fresh, { ...fresh.record, [part]: true });
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
      replayId = "";
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
      if (step < 0) return;
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
      if (readonly || graded(kind, card, record)) return;
      const answers = record.answers || [];
      if (kind !== "syllables") {
        if (answers.includes(index)) return;
        saveRecord(context, { answers: [...answers, index] });
        return;
      }
      const { options, parts } = card.syllables;
      const order = [...(record.order || Array(parts.length).fill(null))];
      const selected = order.indexOf(index);
      if (selected >= 0) {
        if (answers.length && options[index] === parts[selected]) return;
        order[selected] = null;
      } else order[order.indexOf(null)] = index;
      if (order.includes(null)) {
        saveRecord(context, { ...record, order });
        return;
      }
      const history = [...answers, order];
      const retry = history.length === 1 && !correct(kind, card, order);
      saveRecord(context, { answers: history, order: retry ? order.map((value, pos) =>
        options[value] === parts[pos] ? value : null) : order });
    }

    function preventLeaving(event) {
      event.preventDefault();
      event.returnValue = "";
    }

    async function recordWord() {
      if (readonly) return;
      if (recording) {
        if (recording.phase === "recording") {
          recording.phase = "saving";
          recording.handle.stop();
          paint();
        }
        return;
      }
      const { card, stage, record } = current();
      if (stage.id !== "spelling" || !graded(stage.id, card, record)) return;
      stopPlayback();
      find("[data-hw-replay]").pause();
      recordingError = "";
      const job = { phase: "request", handle: null };
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
          find("[data-hw-action=record]")?.focus({ preventScroll: true });
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
      if (clip) {
        const context = current();
        saveRecord(context, { ...context.record, recording: clip });
      } else paint();
      find("[data-hw-action=record]")?.focus({ preventScroll: true });
    }

    root.addEventListener("click", event => {
      const control = event.target.closest("button");
      if (!control || control.disabled) return;
      if ("hwOption" in control.dataset) choose(Number(control.dataset.hwOption));
      const action = control.dataset.hwAction;
      if (action === "play-word" || action === "play-example") play(action.slice(5), control);
      if (action === "previous") move(-1);
      if (action === "next") move(1);
      if (action === "record") recordWord();
    });

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
      const retry = !record.answers?.length && !correct("spelling", card, value);
      saveRecord(context, { ...record, answers: [...(record.answers || []), value], draft: input.value });
      if (retry && input.isConnected) {
        input.focus({ preventScroll: true });
        input.select();
      }
    });

    render();
    return {
      busy: () => Boolean(recording),
      focusRecording() { find("[data-hw-action=record]")?.focus(); },
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

