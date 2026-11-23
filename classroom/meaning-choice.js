"use strict";

(function () {
  const units = window.UNLOCK_LESSON_MEANINGS;

  function randomFor(seed) {
    let state = seed >>> 0;
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  function shuffled(entries, random) {
    const order = entries.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  }

  function glossKeys(text) {
    return text.normalize("NFKC").replace(/\([^()]*\)/g, "").split(/[、,，;；/]/)
      .map(part => part.replace(/[\p{P}\s]/gu, "").replace(/的$/, "")).filter(Boolean);
  }

  function sameGloss(a, b) {
    return a.keys.some(key => b.keys.includes(key));
  }

  function pickThree(list, usedLabels, usedWords, related) {
    const tooClose = (a, b) => sameGloss(a, b) || related[a.id]?.includes(b.id);
    for (const [i, a] of list.entries()) {
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (tooClose(a, b)) continue;
        for (let k = j + 1; k < list.length; k++) {
          const c = list[k];
          if (tooClose(a, c) || tooClose(b, c)) continue;
          const group = [a, b, c];
          const labelKey = group.map(term => term.label).sort().join("|");
          const wordKey = group.map(term => term.id).sort().join("|");
          if (usedLabels.has(labelKey) || usedWords.has(wordKey)) continue;
          usedLabels.add(labelKey);
          usedWords.add(wordKey);
          return group;
        }
      }
    }
    return null;
  }

  function shownMeaning(term, lesson) {
    const { pos, text, byLesson } = term;
    return byLesson?.[lesson] || { pos, text };
  }

  function sameLessonMeaning(scope, id) {
    const term = units[scope].terms.find(row => row.id === id);
    const first = shownMeaning(term, 1);
    const second = shownMeaning(term, 2);
    return first.pos === second.pos && first.text === second.text;
  }

  function buildQuestions(unit, items, seed) {
    const scope = unit.id.slice(0, -3);
    const { terms, related = {} } = units[scope];
    const lessonPools = new Map();

    function poolFor(lesson) {
      if (!lessonPools.has(lesson)) {
        const pool = terms.map(term => {
          const shown = shownMeaning(term, lesson);
          return { id: term.id, ...shown, label: shown.pos + " " + shown.text, keys: glossKeys(shown.text) };
        });
        lessonPools.set(lesson, { pool, byId: new Map(pool.map(term => [term.id, term])) });
      }
      return lessonPools.get(lesson);
    }

    const random = randomFor(seed);
    const usedLabels = new Set();
    const usedWords = new Set();
    const usedTimes = new Map();
    const lastUsedAt = new Map();
    const questions = new Map();
    let previous = new Set();
    for (const [index, item] of items.entries()) {
      const { pool, byId } = poolFor(item.meaningLesson || unit.lesson);
      const wordId = item.wordId || item.id;
      const answer = byId.get(wordId);
      const blocked = new Set([wordId, ...(related[wordId] || [])]);
      const eligible = pool.filter(term => !blocked.has(term.id) && !sameGloss(answer, term));
      const ranked = shuffled(eligible, random).sort((a, b) =>
        (usedTimes.get(a.id) || 0) - (usedTimes.get(b.id) || 0) ||
        (lastUsedAt.get(a.id) ?? -1) - (lastUsedAt.get(b.id) ?? -1));
      const fresh = ranked.filter(term => !previous.has(term.id));
      const distractors = pickThree(fresh, usedLabels, usedWords, related) || pickThree(ranked, usedLabels, usedWords, related);
      if (!distractors) throw new Error("Insufficient distinct Chinese meanings for " + item.id);
      previous = new Set(distractors.map(term => term.id));
      for (const id of previous) {
        usedTimes.set(id, (usedTimes.get(id) || 0) + 1);
        lastUsedAt.set(id, index);
      }
      const options = shuffled([answer, ...distractors], random)
        .map(({ id, pos, text, label }) => ({ id, pos, text, label }));
      questions.set(item.id, { answerId: answer.id, options });
    }
    return questions;
  }

  window.UnlockMeaningChoice = { buildQuestions, sameLessonMeaning };
})();
