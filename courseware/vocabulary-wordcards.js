"use strict";

(() => {
  const source = document.currentScript;
  const id = source.dataset.wordlist;
  const root = new URL("../assets/unlock-vocabulary/", source.src);

  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = new URL("courseware-cards.css", root);
  document.head.append(style);

  const frame = document.querySelector("#preview");

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
  let bank, readyBank, libraryPromise, bankPromise, request, current = 0;

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
      bankPromise = library().then(source => source.load(id)).then(data => {
        readyBank = data;
        return data;
      }).catch(error => {
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

  async function open() {
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

  picker.addEventListener("change", () => showCard(Number(picker.value)));
  nav.addEventListener("click", event => {
    const step = event.target.closest("[data-step]");
    if (step) showCard(current + Number(step.dataset.step));
  });
  dialog.addEventListener("close", () => {
    request?.abort();
    request = undefined;
    stopAudio();
  });
  function spelling(text) {
    return String(text ?? "").normalize("NFC").toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
  }

  function partOfSpeech(text) {
    const role = spelling(text).replace(/[.()]/g, "").replace(/-/g, " ");
    return ({ noun: "n", verb: "v", adjective: "adj", adverb: "adv",
      "noun phrase": "n phr", "phrasal verb": "phr v", "plural noun": "n pl" })[role] || role;
  }

function resolveBankCard(data, wordId, term, pos) {
    if (!data) return null;
    const unit = /B0[1-5]-(?:LS|RW)-U\d{2}/.exec(wordId)?.[0];
    if (unit && unit !== data.id) return null;
    const word = spelling(term);
    const role = partOfSpeech(pos);
    const matches = data.cards.filter(card => [card.word, card.spoken].some(name => spelling(name) === word));
    const sameRole = matches.filter(card => partOfSpeech(card.pos) === role);
    return sameRole.length === 1 ? sameRole[0] : matches.length === 1 ? matches[0] : null;
  }

  const studyCueDetails = {"B02-RW-U08-W-885534c19":["Scientists study distant planets to find out whether they can support life.","The scientists study a picture of the whole planet on their screen."],"B02-RW-U08-W-100ec4462":["Scientists look for evidence of life on other planets.","The scientists look for evidence of life in the rocky landscape shown on their screen."]};
  const reviewedMatchSwaps = {"B01-RW-U05":{"RW1":[["B01-RW-U05-W-c42f4609e","B01-RW-U05-W-43cf2e256"]],"RW2":[["B01-RW-U05-W-c42f4609e","B01-RW-U05-W-43cf2e256"]]},"B02-LS-U02":{"LS1":[["B02-LS-U02-W-c32b941d4","B02-LS-U02-W-3229225bb"]]},"B02-RW-U08":{"RW1":[["B02-RW-U08-W-885534c19","B02-RW-U08-W-306631de5"]]},"B03-RW-U02":{"RW2":[["B03-RW-U02-W-ccadf5de3","B03-RW-U02-W-535ae678f"]]},"B04-LS-U03":{"LS1":[["B04-LS-U03-W-069fd3a44","B04-LS-U03-W-8dfa30e02"]],"LS2":[["B04-LS-U03-W-069fd3a44","B04-LS-U03-W-c076bfe61"],["B04-LS-U03-W-1f6d9f4e2","B04-LS-U03-W-261e0f6ae"]]},"B05-LS-U03":{"LS2":[["B05-LS-U03-W-ccf09e2d4","B05-LS-U03-W-2f7586e45"]]},"B05-RW-U06":{"RW1":[["B05-RW-U06-W-b389d89ce","B05-RW-U06-W-46eba0297"]]}};
  const checkedPromptRetentions = {"B01-LS-U05":{"LS1":{"B01-LS-U05-W-2eda8ad16":{"revision":"33c7cfa72973c779","bankId":"B01-LS-U05-B-008:n","picture":"media/picture/b01-ls-u05-b-008-n.webp","prompt":"She has a job at the local library."}},"LS2":{"B01-LS-U05-W-2eda8ad16":{"revision":"33c7cfa72973c779","bankId":"B01-LS-U05-B-008:n","picture":"media/picture/b01-ls-u05-b-008-n.webp","prompt":"She has a job at the local library."}}},"B01-RW-U01":{"RW1":{"B01-RW-U01-W-d67cca5aa":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-002:n","picture":"media/picture/b01-rw-u01-b-002-n.webp","prompt":"Ray has one brother."},"B01-RW-U01-W-2c54892c4":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-003:n","picture":"media/picture/b01-rw-u01-b-003-n.webp","prompt":"Millions of people live in this city."},"B01-RW-U01-W-c33f059b0":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-007:n","picture":"media/picture/b01-rw-u01-b-007-n.webp","prompt":"He lives with his family."},"B01-RW-U01-W-6490e67e8":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-006:n","picture":"media/picture/b01-rw-u01-b-006-n.webp","prompt":"Marta's daughter Angela is a student."},"B01-RW-U01-W-cefe04428":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-012:adj-phr","picture":"media/picture/b01-rw-u01-b-012-adj-phr.webp","prompt":"Lina is interested in music and reads about her favourite bands."},"B01-RW-U01-W-dd6708dd6":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-009:n","picture":"media/picture/b01-rw-u01-b-009-n.webp","prompt":"My grandfather is my father's father."},"B01-RW-U01-W-ea39210a0":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-010:n","picture":"media/picture/b01-rw-u01-b-010-n.webp","prompt":"My grandmother lives in South Korea."},"B01-RW-U01-W-e11523c5f":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-014:n","picture":"media/picture/b01-rw-u01-b-014-n.webp","prompt":"English is the first language in many countries."},"B01-RW-U01-W-2147a9e5f":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-015:v","picture":"media/picture/b01-rw-u01-b-015-v.webp","prompt":"We listen to the news on the radio."},"B01-RW-U01-W-98aadb370":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-016:v","picture":"media/picture/b01-rw-u01-b-016-v.webp","prompt":"We live in Canada."},"B01-RW-U01-W-2eda8ad16":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-013:n","picture":"media/picture/b01-rw-u01-b-013-n.webp","prompt":"She has a job at the local library."},"B01-RW-U01-W-516626bf8":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-020:v","picture":"media/picture/b01-rw-u01-b-020-v.webp","prompt":"The children like to play outside after school."},"B01-RW-U01-W-1dd09baa1":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-021:n","picture":"media/picture/b01-rw-u01-b-021-n.webp","prompt":"Sultan has a wife, three brothers and one sister."},"B01-RW-U01-W-5116e4069":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-017:n","picture":"media/picture/b01-rw-u01-b-017-n.webp","prompt":"My father is a doctor, and my mother is a teacher."},"B01-RW-U01-W-3a01be172":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-018:n","picture":"media/picture/b01-rw-u01-b-018-n.webp","prompt":"We listen to music after dinner."},"B01-RW-U01-W-e274eeff7":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-026:v","picture":"media/picture/b01-rw-u01-b-026-v.webp","prompt":"I work at a shop near the station."},"B01-RW-U01-W-f0cbc0ee7":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-022:n","picture":"media/picture/b01-rw-u01-b-022-n.webp","prompt":"The woman took her son to school in the morning."},"B01-RW-U01-W-a5afc8df8":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-023:n","picture":"media/picture/b01-rw-u01-b-023-n.webp","prompt":"My uncle lives near the sea."},"B01-RW-U01-W-292b09019":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-025:v","picture":"media/picture/b01-rw-u01-b-025-v.webp","prompt":"We stopped to watch a bird build its nest."}},"RW2":{"B01-RW-U01-W-d67cca5aa":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-002:n","picture":"media/picture/b01-rw-u01-b-002-n.webp","prompt":"Ray has one brother."},"B01-RW-U01-W-2c54892c4":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-003:n","picture":"media/picture/b01-rw-u01-b-003-n.webp","prompt":"Millions of people live in this city."},"B01-RW-U01-W-c33f059b0":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-007:n","picture":"media/picture/b01-rw-u01-b-007-n.webp","prompt":"He lives with his family."},"B01-RW-U01-W-6490e67e8":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-006:n","picture":"media/picture/b01-rw-u01-b-006-n.webp","prompt":"Marta's daughter Angela is a student."},"B01-RW-U01-W-cefe04428":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-012:adj-phr","picture":"media/picture/b01-rw-u01-b-012-adj-phr.webp","prompt":"Lina is interested in music and reads about her favourite bands."},"B01-RW-U01-W-dd6708dd6":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-009:n","picture":"media/picture/b01-rw-u01-b-009-n.webp","prompt":"My grandfather is my father's father."},"B01-RW-U01-W-ea39210a0":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-010:n","picture":"media/picture/b01-rw-u01-b-010-n.webp","prompt":"My grandmother lives in South Korea."},"B01-RW-U01-W-e11523c5f":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-014:n","picture":"media/picture/b01-rw-u01-b-014-n.webp","prompt":"English is the first language in many countries."},"B01-RW-U01-W-2147a9e5f":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-015:v","picture":"media/picture/b01-rw-u01-b-015-v.webp","prompt":"We listen to the news on the radio."},"B01-RW-U01-W-98aadb370":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-016:v","picture":"media/picture/b01-rw-u01-b-016-v.webp","prompt":"We live in Canada."},"B01-RW-U01-W-2eda8ad16":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-013:n","picture":"media/picture/b01-rw-u01-b-013-n.webp","prompt":"She has a job at the local library."},"B01-RW-U01-W-516626bf8":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-020:v","picture":"media/picture/b01-rw-u01-b-020-v.webp","prompt":"The children like to play outside after school."},"B01-RW-U01-W-1dd09baa1":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-021:n","picture":"media/picture/b01-rw-u01-b-021-n.webp","prompt":"Sultan has a wife, three brothers and one sister."},"B01-RW-U01-W-5116e4069":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-017:n","picture":"media/picture/b01-rw-u01-b-017-n.webp","prompt":"My father is a doctor, and my mother is a teacher."},"B01-RW-U01-W-3a01be172":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-018:n","picture":"media/picture/b01-rw-u01-b-018-n.webp","prompt":"We listen to music after dinner."},"B01-RW-U01-W-e274eeff7":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-026:v","picture":"media/picture/b01-rw-u01-b-026-v.webp","prompt":"I work at a shop near the station."},"B01-RW-U01-W-f0cbc0ee7":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-022:n","picture":"media/picture/b01-rw-u01-b-022-n.webp","prompt":"The woman took her son to school in the morning."},"B01-RW-U01-W-a5afc8df8":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-023:n","picture":"media/picture/b01-rw-u01-b-023-n.webp","prompt":"My uncle lives near the sea."},"B01-RW-U01-W-292b09019":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-025:v","picture":"media/picture/b01-rw-u01-b-025-v.webp","prompt":"We stopped to watch a bird build its nest."},"B01-RW-U01-W-7cdf152a3":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-024:adj","picture":"media/picture/b01-rw-u01-b-024-adj.webp","prompt":"That is an unusual job."},"B01-RW-U01-W-e946d8db1":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-027:n-phr","picture":"media/picture/b01-rw-u01-b-027-n-phr.webp","prompt":"My name's Maya and I'm 20 years old."},"B01-RW-U01-W-9c2a6e480":{"revision":"5c2457dad5d1588f","bankId":"B01-RW-U01-B-019:adj","picture":"media/picture/b01-rw-u01-b-019-adj.webp","prompt":"On a normal day I go to work."}}},"B01-RW-U02":{"RW1":{"B01-RW-U02-W-ef926a852":{"revision":"030018a6694f4772","bankId":"B01-RW-U02-B-005:adj","picture":"media/picture/b01-rw-u02-b-005-adj.webp","prompt":"It has two seasons, the dry season and the rainy season."},"B01-RW-U02-W-14beca199":{"revision":"030018a6694f4772","bankId":"B01-RW-U02-B-007:adj","picture":"media/picture/b01-rw-u02-b-007-adj.webp","prompt":"It has two seasons, the dry season and the rainy season."}},"RW2":{"B01-RW-U02-W-ef926a852":{"revision":"030018a6694f4772","bankId":"B01-RW-U02-B-005:adj","picture":"media/picture/b01-rw-u02-b-005-adj.webp","prompt":"It has two seasons, the dry season and the rainy season."},"B01-RW-U02-W-14beca199":{"revision":"030018a6694f4772","bankId":"B01-RW-U02-B-007:adj","picture":"media/picture/b01-rw-u02-b-007-adj.webp","prompt":"It has two seasons, the dry season and the rainy season."}}},"B03-LS-U06":{"LS1":{"B03-LS-U06-W-7d1043473":{"revision":"7a1a68edc6fceb72","bankId":"B03-LS-U06-B-003:n","picture":"media/picture/b03-ls-u06-b-003-n.webp","prompt":"This app helps me organize my notes."},"B03-LS-U06-W-1984337fc":{"revision":"7a1a68edc6fceb72","bankId":"B03-LS-U06-B-009:n","picture":"media/picture/b03-ls-u06-b-009-n.webp","prompt":"The technology industry develops new devices."},"B03-LS-U06-W-f3a929b33":{"revision":"7a1a68edc6fceb72","bankId":"B03-LS-U06-B-006:n","picture":"media/picture/b03-ls-u06-b-006-n.webp","prompt":"A smartphone is a useful device for studying."},"B03-LS-U06-W-025dfb550":{"revision":"7a1a68edc6fceb72","bankId":"B03-LS-U06-B-021:n","picture":"media/picture/b03-ls-u06-b-021-n.webp","prompt":"The scholar studies medieval science."},"B03-LS-U06-W-87cf71420":{"revision":"7a1a68edc6fceb72","bankId":"B03-LS-U06-B-018:phr-v","picture":"media/picture/b03-ls-u06-b-018-phr-v.webp","prompt":"The council agreed to make public the results of the survey."},"B03-LS-U06-W-395d3b4c7":{"revision":"7a1a68edc6fceb72","bankId":"B03-LS-U06-B-024:n","picture":"media/picture/b03-ls-u06-b-024-n.webp","prompt":"The museum displays an old weapon."}},"LS2":{"B03-LS-U06-W-7d1043473":{"revision":"7a1a68edc6fceb72","bankId":"B03-LS-U06-B-003:n","picture":"media/picture/b03-ls-u06-b-003-n.webp","prompt":"This app helps me organize my notes."},"B03-LS-U06-W-1984337fc":{"revision":"7a1a68edc6fceb72","bankId":"B03-LS-U06-B-009:n","picture":"media/picture/b03-ls-u06-b-009-n.webp","prompt":"The technology industry develops new devices."},"B03-LS-U06-W-89fb511ff":{"revision":"7a1a68edc6fceb72","bankId":"B03-LS-U06-B-010:v","picture":"media/picture/b03-ls-u06-b-010-v.webp","prompt":"Install the app on your phone."},"B03-LS-U06-W-38a007151":{"revision":"7a1a68edc6fceb72","bankId":"B03-LS-U06-B-020:n","picture":"media/picture/b03-ls-u06-b-020-n.webp","prompt":"Read a product review before choosing."}}}};
  const secondLessonGroups = [["B03-LS-U06-W-6452e7c5a","B03-LS-U06-W-9b7c68a91","B03-LS-U06-W-0a79d647a"],["B03-LS-U06-W-7d1043473","B03-LS-U06-W-c2c45258c","B03-LS-U06-W-1984337fc"],["B03-LS-U06-W-ebc4e9f5a","B03-LS-U06-W-12dea96fe","B03-LS-U06-W-89fb511ff"],["B03-LS-U06-W-30f7a16c5","B03-LS-U06-W-38a007151","B03-LS-U06-W-0f12541af"]];
  const singleSentenceOptions = ["B04-RW-U06-W-a3ade6eb2","B04-RW-U06-W-190b435b7","B04-RW-U06-W-182b6cb55"];

  function openingMatchLessons() {
    if (typeof V === "undefined" || typeof classroom === "undefined") return [];
    return (V.lessonFlow?.lessons ?? []).flatMap(lesson => {
      const entries = lesson.steps.map(step => classroom.byId.get(step.id));
      const cards = new Map(entries.filter(entry => entry?.flow?.kind === "cards")
        .flatMap(entry => entry.flow.pages.flat().map(word => [word.id, word])));
      return entries.filter(entry => entry?.flow?.kind === "match").map(entry => ({
        key: lesson.key, entry, cards, flow: entry.flow, feedback: entry.feedback,
      }));
    });
  }

  const matchingLessons = openingMatchLessons();
  let matchingBank;
  let matchingPreparation;

  function matchingCard(word, data) {
    const term = word.wordVoice ? word.term : word.termDisplay ?? word.term;
    const card = resolveBankCard(data, word.id, term.replace(/\*\*/g, ""), word.pos);
    if (!card) return { visual: word.visual, example: word.example };
    return {
      visual: { src: window.UnlockVocabularyBank.media(card.picture) },
      example: card.exampleParts.join(""),
      bankId: card.id,
      picture: card.picture,
    };
  }

  function matchingPictureKey(visual) {
    return visual?.src ? JSON.stringify([new URL(visual.src, document.baseURI).href, visual.box ?? null]) : null;
  }

function swapReviewedOptions(pages, pairs) {
    const copy = pages.map(page => ({ ...page, rows: page.rows.slice(), visuals: page.visuals.slice() }));
    const positions = new Map(copy.flatMap(page => page.rows.map((row, index) => [row.id, { page, index }])));
    for (const [first, second] of pairs) {
      const left = positions.get(first), right = positions.get(second);
      if (!left || !right || left.page === right.page) continue;
      const a = left.page.rows[left.index], b = right.page.rows[right.index];
      const ai = a.answer.charCodeAt(0) - 65, bi = b.answer.charCodeAt(0) - 65;
      const photo = left.page.visuals[ai];
      left.page.visuals[ai] = right.page.visuals[bi];
      right.page.visuals[bi] = photo;
      left.page.rows[left.index] = { ...b, answer: a.answer };
      right.page.rows[right.index] = { ...a, answer: b.answer };
      positions.set(first, right);
      positions.set(second, left);
    }
    let label = 0;
    return copy.map(page => ({
      ...page, rows: page.rows.map(row => ({
        ...row, previousLabel: row.previousLabel ?? row.label, label: String(++label),
      })),
    }));
  }

  function revisedMatchingLesson(lesson, data) {
    const { key, cards, flow, feedback } = lesson;
    const selected = new Map([...cards].map(([wordId, word]) => [wordId, matchingCard(word, data)]));
    const previousAnswers = new Map(feedback.rows.map(answer => [answer.label, answer]));
    const verifiedPrompts = checkedPromptRetentions[id]?.[key] ?? {};
    const oldPages = flow.pages.map(page => {
      const photos = page.visuals.slice();
      const rows = page.rows.map(row => {
        const current = selected.get(row.id);
        if (!current?.visual?.src || !current.example) return row;
        const option = row.answer.charCodeAt(0) - 65;
        const approved = verifiedPrompts[row.id];
        const keep = data && approved?.revision === data.revision && approved.bankId === current.bankId &&
          approved.picture === current.picture && approved.prompt === row.prompt;
        const cue = data && id === "B02-RW-U08" && key === "RW1" ? studyCueDetails[row.id] : null;
        const prompt = cue?.[0] === current.example ? cue[1] : keep ? row.prompt : current.example;
        photos[option] = current.visual;
        return { ...row, prompt, basis: prompt };
      });
      return { ...page, rows, visuals: photos };
    });

    // These two original groups each ended with a single possible answer.
    let pages = oldPages;
    if (id === "B03-LS-U06" && key === "LS2") {
      const rows = oldPages.flatMap(page => page.rows);
      const perWord = new Map(rows.map(row => [row.id, row]));
      const groups = secondLessonGroups.map(group => group.map(wordId => perWord.get(wordId)));
      if (groups.flat().length === rows.length && groups.flat().every(Boolean)) {
        let label = 0;
        pages = groups.map((group, index) => {
          const offset = 1 + index % (group.length - 1);
          const options = group.slice(offset).concat(group.slice(0, offset));
          return {
            visuals: options.map(row => selected.get(row.id).visual),
            rows: group.map(row => ({
              ...row, previousLabel: row.label, label: String(++label),
              answer: String.fromCharCode(65 + options.indexOf(row)),
            })),
          };
        });
      }
    }
    if (id === "B04-RW-U06" && key === "RW2" && oldPages.length === 1 && oldPages[0].rows.length === 1) {
      const [page] = oldPages;
      const [row] = page.rows;
      const photos = singleSentenceOptions.map(wordId => selected.get(wordId)?.visual);
      if (row.id === singleSentenceOptions[1] && photos.every(photo => photo?.src)) {
        pages = [{ ...page, visuals: photos, rows: [{ ...row, answer: "B" }] }];
      }
    }

    const swaps = data && reviewedMatchSwaps[id]?.[key];
    if (swaps) pages = swapReviewedOptions(pages, swaps);

    const finalRows = pages.flatMap(page => page.rows.map(row => ({
      ...previousAnswers.get(row.previousLabel ?? row.label),
      label: row.label,
      answer: row.answer,
      basis: row.basis,
    })));
    const allPhotos = pages.every(page => page.visuals.every(visual => visual.src));
    for (const page of pages) {
      const keys = page.visuals.map(matchingPictureKey).filter(Boolean);
      if (new Set(keys).size !== keys.length) throw new Error("Duplicate picture in " + lesson.entry.id);
    }
    return {
      entry: lesson.entry,
      flow: { ...flow, pages, lessonPictureMatch: true },
      feedback: { ...feedback, rows: finalRows },
      instruction: allPhotos ? "Match each sentence to the correct picture." :
        "Match each sentence to the correct picture or description.",
    };
  }

  function applyMatching(data) {
    if (matchingBank === data) return;
    const changes = matchingLessons.map(lesson => revisedMatchingLesson(lesson, data));
    for (const { entry, ...change } of changes) Object.assign(entry, change);
    matchingBank = data;
  }

  function prepareLessonPictureMatching() {
    if (!matchingLessons.length || matchingBank) return;
    if (!matchingPreparation) {
      matchingPreparation = (async () => {
        if (matchingBank === null && !readyBank) {
          void loadBank().catch(() => {});
          return;
        }
        let timer;
        try {
          const timeout = new Promise(resolve => { timer = setTimeout(() => resolve(null), 3600); });
          const data = await Promise.race([loadBank().catch(() => null), timeout]);
          applyMatching(data);
        } finally {
          clearTimeout(timer);
        }
      })().finally(() => { matchingPreparation = null; });
    }
    return matchingPreparation;
  }

  if (window.UnlockCourseware) window.UnlockCourseware.prepareLessonPictureMatching = prepareLessonPictureMatching;

  function refreshDeck(doc, data) {
    for (const article of doc.querySelectorAll("[data-flow-word]")) {
      const head = article.querySelector(".flow-card-head h2");
      if (!head) continue;
      const label = head.querySelector("small");
      const term = label ? head.textContent.slice(0, -label.textContent.length) : head.textContent;
      const card = resolveBankCard(data, article.dataset.flowWord, term, label?.textContent);
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
    if (!doc?.querySelector("[data-flow-word]")) return;
    loadBank().then(data => {
      if (frame.contentDocument === doc) refreshDeck(doc, data);
    }).catch(() => {});
  }

  frame?.addEventListener("load", bindFrame);
  bindFrame();
  if (new URL(location.href).searchParams.get("panel") === "wordlist") open();
})();
