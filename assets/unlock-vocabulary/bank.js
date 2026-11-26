"use strict";

(() => {
  const root = new URL(".", document.currentScript.src);
  const catalog = window.UNLOCK_VOCABULARY_CATALOG;

  function entry(id) {
    return Object.hasOwn(catalog, id) ? catalog[id] : null;
  }

  function id(book, unit, track) {
    return "B" + String(book).padStart(2, "0") + "-" + track + "-U" + String(unit).padStart(2, "0");
  }

  function siteMedia(file) {
    if (!/^media\/(?:word|example|picture)\/[a-z0-9-]+\.(?:mp3|webp)$/.test(file)) {
      throw new Error("Unexpected vocabulary media path");
    }
    return window.UNLOCK_VOCABULARY_LIVE_MEDIA[file] || "assets/unlock-vocabulary/" + file;
  }

  function media(file) {
    return new URL(siteMedia(file), new URL("../../", root)).href;
  }

  async function load(key, signal) {
    const expected = entry(key);
    if (!expected) throw new Error("Unknown vocabulary wordlist");
    const response = await fetch(new URL(expected.file, root), { signal });
    if (!response.ok) throw new Error("Cannot load vocabulary wordlist");
    const bank = await response.json();
    if (bank.id !== key || bank.book !== expected.book || bank.unit !== expected.unit ||
        bank.track !== expected.track || bank.cards?.length !== expected.count) {
      throw new Error("Vocabulary wordlist did not match the selected unit");
    }
    return { ...bank, revision: expected.revision };
  }

  window.UnlockVocabularyBank = { catalog, entry, id, media, siteMedia, load };
})();
