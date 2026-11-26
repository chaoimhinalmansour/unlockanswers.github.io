"use strict";

(() => {
  const source = document.currentScript;
  const id = source.dataset.wordlist;
  const root = new URL("../assets/unlock-vocabulary/", source.src);
  const toolbar = document.querySelector(".stage-nav-tools") ||
    document.querySelector("[data-courseware-catalog]")?.parentElement;
  if (!toolbar || toolbar.querySelector("[data-course-vocabulary]")) return;

  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = new URL("courseware-cards.css", root);
  document.head.append(style);

  const launch = document.createElement("button");
  launch.type = "button";
  launch.dataset.courseVocabulary = "";
  launch.textContent = "词汇词卡";
  toolbar.append(launch);
  const frame = document.querySelector("#preview");
  let opener = launch;

  const dialog = document.createElement("dialog");
  dialog.className = "unit-wordlist-dialog";
  dialog.setAttribute("aria-labelledby", "unit-wordlist-title");
  dialog.innerHTML = [
    '<header><h2 id="unit-wordlist-title">词汇词卡</h2><form method="dialog">',
    '<button type="submit">关闭词卡</button></form></header>',
    '<p data-wordlist-status role="status"></p><div data-wordlist-select hidden>',
    '<label>选择词条 <select aria-label="选择词条"></select></label>',
    '<button type="button" data-step="-1">上一张</button>',
    '<button type="button" data-step="1">下一张</button><output aria-live="polite"></output></div>',
    '<div data-wordlist-card></div>'
  ].join("");
  document.body.append(dialog);

  const title = dialog.querySelector("h2");
  const status = dialog.querySelector("[data-wordlist-status]");
  const nav = dialog.querySelector("[data-wordlist-select]");
  const picker = nav.querySelector("select");
  const position = nav.querySelector("output");
  const host = dialog.querySelector("[data-wordlist-card]");
  let bank, libraryPromise, bankPromise, request, current = 0;

  function importScript(file) {
    return new Promise((resolve, reject) => {
      const node = document.createElement("script");
      node.src = new URL(file, root);
      node.onload = resolve;
      node.onerror = () => reject(new Error("Cannot load vocabulary"));
      document.head.append(node);
    });
  }

  function library() {
    if (!libraryPromise) {
      libraryPromise = (async () => {
        if (!window.UNLOCK_VOCABULARY_CATALOG) await importScript("catalog.js");
        if (!window.UnlockVocabularyBank) await importScript("bank.js");
        return window.UnlockVocabularyBank;
      })().catch(error => {
        libraryPromise = undefined;
        throw error;
      });
    }
    return libraryPromise;
  }

  function loadBank() {
    if (!bankPromise) {
      bankPromise = library().then(source => source.load(id)).catch(error => {
        bankPromise = undefined;
        throw error;
      });
    }
    return bankPromise;
  }

  function node(tag, text) {
    const element = document.createElement(tag);
    if (text != null) element.textContent = text;
    return element;
  }

  function stopAudio() {
    for (const player of host.querySelectorAll("audio")) player.pause();
  }

  function audioLine(label, path, translation) {
    const line = node("section");
    const caption = node("h4", label);
    const player = node("audio");
    player.controls = true;
    player.preload = "none";
    player.src = window.UnlockVocabularyBank.media(path);
    player.setAttribute("aria-label", label);
    const chinese = node("p", translation);
    chinese.hidden = true;
    player.addEventListener("ended", () => { chinese.hidden = false; });
    player.addEventListener("play", () => {
      for (const other of host.querySelectorAll("audio")) if (other !== player) other.pause();
      status.textContent = "";
    });
    player.addEventListener("error", () => { status.textContent = "录音未能播放，请重试。"; });
    line.append(caption, player, chinese);
    return line;
  }

  function showCard(index) {
    if (!bank?.cards[index]) return;
    stopAudio();
    current = index;
    const card = bank.cards[index];
    picker.value = String(index);
    position.textContent = (index + 1) + " / " + bank.cards.length;
    nav.querySelector('[data-step="-1"]').disabled = index === 0;
    nav.querySelector('[data-step="1"]').disabled = index === bank.cards.length - 1;
    host.dataset.cardId = card.id;
    const copy = node("article");
    const heading = node("h3", card.word);
    heading.lang = "en-GB";
    const ipa = node("p", card.ipa + " (" + card.pos + ")");
    const definition = node("p", card.definition);
    definition.lang = "en-GB";
    const example = node("p");
    example.lang = "en-GB";
    example.append(card.exampleParts[0], node("strong", card.exampleParts[1]), card.exampleParts[2]);
    const image = node("img");
    image.src = window.UnlockVocabularyBank.media(card.picture);
    image.alt = card.word + " 的例句配图";
    image.decoding = "async";
    copy.append(heading, ipa, definition, audioLine("播放单词", card.wordAudio, card.translation),
      example, audioLine("播放例句", card.exampleAudio, card.exampleTranslation));
    host.replaceChildren(copy, image);
  }

  async function open(event) {
    if (event?.currentTarget?.hasAttribute("data-course-vocabulary")) opener = event.currentTarget;
    if (!dialog.open) dialog.showModal();
    if (bank) {
      status.textContent = "";
      showCard(current);
      return;
    }
    if (request) return;
    const controller = new AbortController();
    request = controller;
    status.textContent = "正在载入词表";
    try {
      const data = await loadBank();
      if (controller.signal.aborted) return;
      bank = data;
      status.textContent = "";
      title.textContent = "Book " + bank.book + " Unit " + bank.unit + " " +
        (bank.track === "LS" ? "听说" : "读写") + "词卡";
      picker.replaceChildren(...bank.cards.map((card, index) => new Option(card.word + " (" + card.pos + ")", index)));
      nav.hidden = false;
      showCard(current);
    } catch {
      if (!controller.signal.aborted) {
        const retry = node("button", "重新载入词表");
        retry.type = "button";
        retry.addEventListener("click", open);
        status.replaceChildren(retry);
      }
    } finally {
      if (request === controller) request = undefined;
    }
  }

  launch.addEventListener("click", open);
  picker.addEventListener("change", () => showCard(Number(picker.value)));
  nav.addEventListener("click", event => {
    const step = event.target.closest("[data-step]");
    if (step) showCard(current + Number(step.dataset.step));
  });
  dialog.addEventListener("close", () => {
    request?.abort();
    request = undefined;
    stopAudio();
    if (opener.isConnected) opener.focus();
    else frame?.contentDocument?.querySelector("[data-course-vocabulary]")?.focus();
  });
  function spelling(text) {
    return text.normalize("NFC").toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
  }

  function partOfSpeech(text) {
    const role = spelling(text).replace(/[.()]/g, "").replace(/-/g, " ");
    return ({ noun: "n", verb: "v", adjective: "adj", adverb: "adv",
      "noun phrase": "n phr", "phrasal verb": "phr v", "plural noun": "n pl" })[role] || role;
  }

  function refreshDeck(doc, data) {
    for (const article of doc.querySelectorAll("[data-flow-word]")) {
      const head = article.querySelector(".flow-card-head h2");
      if (!head) continue;
      const label = head.querySelector("small");
      const term = spelling(label ? head.textContent.slice(0, -label.textContent.length) : head.textContent);
      const role = label ? partOfSpeech(label.textContent) : "";
      const sourceUnit = /B0[1-5]-(?:LS|RW)-U\d{2}/.exec(article.dataset.flowWord)?.[0];
      if (sourceUnit && sourceUnit !== data.id) continue;
      const matches = data.cards.filter(card => [card.word, card.spoken].some(word => spelling(word) === term));
      const sameRole = matches.filter(card => partOfSpeech(card.pos) === role);
      const card = sameRole.length === 1 ? sameRole[0] : matches.length === 1 ? matches[0] : null;
      if (!card) continue;
      const wordAudio = article.querySelector('[data-card-audio="word"]');
      const exampleAudio = article.querySelector('[data-card-audio="example"]');
      const example = article.querySelector(".flow-card-example");
      const ipa = article.querySelector(".flow-card-ipa");
      const definition = article.querySelector(".flow-card-definition");
      const figure = article.querySelector(".flow-visual, .course-word-theme");
      if (!wordAudio || !exampleAudio || !example || !ipa || !definition || !figure) continue;
      const mark = doc.createElement("strong");
      mark.textContent = card.exampleParts[1];
      example.replaceChildren(card.exampleParts[0], mark, card.exampleParts[2]);
      if (label) label.textContent = "(" + card.pos + ")";
      ipa.textContent = card.ipa;
      definition.textContent = card.definition;
      wordAudio.src = window.UnlockVocabularyBank.media(card.wordAudio);
      exampleAudio.src = window.UnlockVocabularyBank.media(card.exampleAudio);
      const img = doc.createElement("img");
      img.src = window.UnlockVocabularyBank.media(card.picture);
      img.alt = card.word + " 的例句配图";
      figure.className = "flow-visual";
      figure.replaceChildren(img);
      article.dataset.verifiedVocabulary = card.id;
    }
  }

  function bindFrame() {
    const doc = frame?.contentDocument;
    if (!doc?.body) return;
    const rail = doc.querySelector(".rail");
    if (rail && !rail.querySelector("[data-course-vocabulary]")) {
      const openInFrame = doc.createElement("button");
      openInFrame.type = "button";
      openInFrame.dataset.courseVocabulary = "";
      openInFrame.textContent = launch.textContent;
      openInFrame.addEventListener("click", open);
      rail.append(openInFrame);
    }
    if (doc.querySelector("[data-flow-word]")) {
      loadBank().then(data => {
        if (frame.contentDocument === doc) refreshDeck(doc, data);
      }).catch(() => {});
    }
  }

  frame?.addEventListener("load", bindFrame);
  bindFrame();
  if (new URL(location.href).searchParams.get("panel") === "wordlist") open();
})();
