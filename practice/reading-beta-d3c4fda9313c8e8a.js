"use strict";

(function () {
  const { escapeHTML: esc } = window.UnlockRules;
  const revisions = {"B1U01":"reading-beta-20261126-75db78d39921-b1u01","B1U02":"reading-beta-20261126-75db78d39921-b1u02","B1U03":"reading-beta-20261126-75db78d39921-b1u03","B1U04":"reading-beta-20261126-75db78d39921-b1u04","B1U05":"reading-beta-20261126-75db78d39921-b1u05","B1U06":"reading-beta-20261126-75db78d39921-b1u06","B1U07":"reading-beta-20261126-75db78d39921-b1u07","B1U08":"reading-beta-20261126-75db78d39921-b1u08","B2U01":"reading-beta-20261126-75db78d39921-b2u01","B2U02":"reading-beta-20261126-75db78d39921-b2u02","B2U03":"reading-beta-20261126-75db78d39921-b2u03","B2U04":"reading-beta-20261126-75db78d39921-b2u04","B2U05":"reading-beta-20261126-75db78d39921-b2u05","B2U06":"reading-beta-20261126-75db78d39921-b2u06","B2U07":"reading-beta-20261126-75db78d39921-b2u07","B2U08":"reading-beta-20261126-75db78d39921-b2u08","B3U01":"reading-beta-20261126-75db78d39921-b3u01","B3U02":"reading-beta-20261126-75db78d39921-b3u02","B3U03":"reading-beta-20261126-75db78d39921-b3u03","B3U04":"reading-beta-20261126-75db78d39921-b3u04","B3U05":"reading-beta-20261126-75db78d39921-b3u05","B3U06":"reading-beta-20261126-75db78d39921-b3u06","B3U07":"reading-beta-20261126-75db78d39921-b3u07","B3U08":"reading-beta-20261126-75db78d39921-b3u08","B4U01":"reading-beta-20261126-75db78d39921-b4u01","B4U02":"reading-beta-20261126-75db78d39921-b4u02","B4U03":"reading-beta-20261126-75db78d39921-b4u03","B4U04":"reading-beta-20261126-75db78d39921-b4u04","B4U05":"reading-beta-20261126-75db78d39921-b4u05","B4U06":"reading-beta-20261126-75db78d39921-b4u06","B4U07":"reading-beta-20261126-75db78d39921-b4u07","B4U08":"reading-beta-20261126-75db78d39921-b4u08","B5U01":"reading-beta-20261126-75db78d39921-b5u01","B5U02":"reading-beta-20261126-75db78d39921-b5u02","B5U03":"reading-beta-20261126-75db78d39921-b5u03","B5U04":"reading-beta-20261126-75db78d39921-b5u04","B5U05":"reading-beta-20261126-75db78d39921-b5u05","B5U06":"reading-beta-20261126-75db78d39921-b5u06","B5U07":"reading-beta-20261126-75db78d39921-b5u07","B5U08":"reading-beta-20261126-75db78d39921-b5u08","B5U09":"reading-beta-20261126-75db78d39921-b5u09","B5U10":"reading-beta-20261126-75db78d39921-b5u10"};
  const extraUnits = [{"id":"B1U01","book":1,"unit":1,"revision":"reading-beta-20261126-75db78d39921-b1u01","topic":"Reading","readingOnly":true},{"id":"B1U02","book":1,"unit":2,"revision":"reading-beta-20261126-75db78d39921-b1u02","topic":"Reading","readingOnly":true},{"id":"B1U03","book":1,"unit":3,"revision":"reading-beta-20261126-75db78d39921-b1u03","topic":"Reading","readingOnly":true},{"id":"B1U04","book":1,"unit":4,"revision":"reading-beta-20261126-75db78d39921-b1u04","topic":"Reading","readingOnly":true},{"id":"B1U05","book":1,"unit":5,"revision":"reading-beta-20261126-75db78d39921-b1u05","topic":"Reading","readingOnly":true},{"id":"B1U06","book":1,"unit":6,"revision":"reading-beta-20261126-75db78d39921-b1u06","topic":"Reading","readingOnly":true},{"id":"B1U07","book":1,"unit":7,"revision":"reading-beta-20261126-75db78d39921-b1u07","topic":"Reading","readingOnly":true},{"id":"B1U08","book":1,"unit":8,"revision":"reading-beta-20261126-75db78d39921-b1u08","topic":"Reading","readingOnly":true},{"id":"B4U01","book":4,"unit":1,"revision":"reading-beta-20261126-75db78d39921-b4u01","topic":"Reading","readingOnly":true},{"id":"B4U02","book":4,"unit":2,"revision":"reading-beta-20261126-75db78d39921-b4u02","topic":"Reading","readingOnly":true},{"id":"B4U03","book":4,"unit":3,"revision":"reading-beta-20261126-75db78d39921-b4u03","topic":"Reading","readingOnly":true},{"id":"B4U04","book":4,"unit":4,"revision":"reading-beta-20261126-75db78d39921-b4u04","topic":"Reading","readingOnly":true},{"id":"B4U05","book":4,"unit":5,"revision":"reading-beta-20261126-75db78d39921-b4u05","topic":"Reading","readingOnly":true},{"id":"B4U06","book":4,"unit":6,"revision":"reading-beta-20261126-75db78d39921-b4u06","topic":"Reading","readingOnly":true},{"id":"B4U07","book":4,"unit":7,"revision":"reading-beta-20261126-75db78d39921-b4u07","topic":"Reading","readingOnly":true},{"id":"B4U08","book":4,"unit":8,"revision":"reading-beta-20261126-75db78d39921-b4u08","topic":"Reading","readingOnly":true},{"id":"B5U01","book":5,"unit":1,"revision":"reading-beta-20261126-75db78d39921-b5u01","topic":"Reading","readingOnly":true},{"id":"B5U02","book":5,"unit":2,"revision":"reading-beta-20261126-75db78d39921-b5u02","topic":"Reading","readingOnly":true},{"id":"B5U03","book":5,"unit":3,"revision":"reading-beta-20261126-75db78d39921-b5u03","topic":"Reading","readingOnly":true},{"id":"B5U04","book":5,"unit":4,"revision":"reading-beta-20261126-75db78d39921-b5u04","topic":"Reading","readingOnly":true},{"id":"B5U05","book":5,"unit":5,"revision":"reading-beta-20261126-75db78d39921-b5u05","topic":"Reading","readingOnly":true},{"id":"B5U06","book":5,"unit":6,"revision":"reading-beta-20261126-75db78d39921-b5u06","topic":"Reading","readingOnly":true},{"id":"B5U07","book":5,"unit":7,"revision":"reading-beta-20261126-75db78d39921-b5u07","topic":"Reading","readingOnly":true},{"id":"B5U08","book":5,"unit":8,"revision":"reading-beta-20261126-75db78d39921-b5u08","topic":"Reading","readingOnly":true},{"id":"B5U09","book":5,"unit":9,"revision":"reading-beta-20261126-75db78d39921-b5u09","topic":"Reading","readingOnly":true},{"id":"B5U10","book":5,"unit":10,"revision":"reading-beta-20261126-75db78d39921-b5u10","topic":"Reading","readingOnly":true}];
  const directory = "data/reading-beta-20261126-75db78d39921";
  const extraBooks = [...new Set(extraUnits.map(unit => unit.book))];
  const caches = { unit: new Map(), guide: new Map() };

  function revision(meta, code) {
    return /^R_H[123]$/.test(code) && Object.hasOwn(revisions, meta?.id) ? revisions[meta.id] : null;
  }

  async function loadPack(meta, type, signal) {
    const expected = revisions[meta.id];
    if (!expected) throw new Error("Reading worksheet unavailable");
    const cache = caches[type];
    if (cache.has(meta.id)) return cache.get(meta.id);
    const suffix = type === "guide" ? "-guide" : "";
    const path = directory + "/" + meta.id.toLowerCase() + suffix + ".json";
    const response = await window.UnlockPracticeCatalog.readResource(path, signal);
    const pack = await response.json();
    if (signal?.aborted || pack.id !== meta.id || pack.revision !== expected ||
        !["R_H1", "R_H2", "R_H3"].every(code => pack.sheets?.[code])) {
      throw new Error("Reading version mismatch");
    }
    cache.set(meta.id, pack);
    return pack;
  }

  async function loadUnit(meta, signal) {
    const pack = await loadPack(meta, "unit", signal);
    return { ...pack, topic: meta.topic };
  }

  function loadGuide(meta, signal) {
    return loadPack(meta, "guide", signal);
  }

  function renderText(passage, evidence = []) {
    const { text } = passage;
    const bold = passage.bold || [];
    const marks = evidence.map(([, start, end]) => [start, end]);
    if (!bold.length && !marks.length) return esc(text);
    const stops = [...new Set([0, text.length, ...bold.flat(), ...marks.flat()])].sort((a, b) => a - b);
    return stops.slice(1).map((end, index) => {
      const start = stops[index];
      const contains = ([from, to]) => from <= start && end <= to;
      const part = esc(text.slice(start, end));
      const marked = marks.some(contains) ? '<mark class="reading-evidence">' + part + "</mark>" : part;
      return bold.some(contains) ? "<strong>" + marked + "</strong>" : marked;
    }).join("");
  }

  window.UnlockReadingBeta = { extraBooks, extraUnits, revision, loadUnit, loadGuide, renderText };
})();
