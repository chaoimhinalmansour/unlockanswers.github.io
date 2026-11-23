"use strict";

(function () {
  const data = window.UNLOCK_LESSON_DICTATION;
  const { makeItem } = window.UnlockWordDictation;
  const { buildQuestions, sameLessonMeaning } = window.UnlockMeaningChoice;

  function plan(unit, code, attempt) {
    if (!/^[LR]_H[123]$/.test(code)) return null;
    const savedSeed = attempt.homeworkDictationSeed;
    const resumed = Number.isInteger(savedSeed) && savedSeed >= 0 && savedSeed <= 0xffffffff;
    if (attempt.first && !resumed) return null;
    const track = code[0] === "L" ? "LS" : "RW";
    const anchorLesson = code.endsWith("3") ? 2 : 1;
    const unitData = data.books[unit.book]?.find(entry => entry.number === unit.unit);
    if (!unitData) return null;
    const lessons = new Map(unitData.sets.filter(entry => entry.track === track).map(entry => [entry.lesson, entry]));
    const anchor = lessons.get(anchorLesson);
    const earlierAttempt = resumed && !attempt.homeworkDictationLayout;
    // Keep the roster recorded for submitted work and the original order of a resumed H3 draft.
    const layout = attempt.homeworkDictationLayout || (earlierAttempt && attempt.first ? "original"
      : earlierAttempt && anchorLesson === 2 ? "second-first" : "cumulative");
    const selected = code.endsWith("1") || layout === "original" ? [anchorLesson]
      : layout === "second-first" ? [2, 1] : [1, 2];
    const scope = anchor.id.slice(0, -3);
    const seen = new Set();
    const assigned = [];
    const firstIds = new Set(lessons.get(1).items.map(word => word.id));
    const secondIds = new Set(lessons.get(2).items.map(word => word.id));
    for (const lesson of selected) for (const word of lessons.get(lesson).items) {
      const separateSenses = selected.length === 2 && firstIds.has(word.id) && secondIds.has(word.id) &&
        !sameLessonMeaning(scope, word.id);
      const key = separateSenses ? word.id + "/lesson-" + lesson : word.id;
      if (seen.has(key)) continue;
      seen.add(key);
      const suffix = separateSenses && lesson !== anchorLesson ? "/lesson-" + lesson : "";
      assigned.push({
        id: unit.id + "/" + code + "/dictation/" + word.id + suffix,
        wordId: word.id, word, meaningLesson: lesson, contextLesson: separateSenses ? lesson : undefined
      });
    }

    const seed = resumed ? savedSeed : crypto.getRandomValues(new Uint32Array(1))[0];
    const meanings = buildQuestions(anchor, assigned, seed);
    const lastNumber = Math.max(...unit.sheets[code].questions.map(question => question.number));
    const questions = assigned.map(({ id, word, contextLesson }, index) => {
      const item = makeItem(id, lastNumber + index + 1, word.word, word.keys, data.pronunciations[word.pronunciation]);
      return {
        ...item, type: "text", kind: "单词听写", homeworkDictation: true,
        meaningQuestion: meanings.get(id), meaningContextLesson: contextLesson
      };
    });
    return { seed, layout, sources: selected.map(lesson => lessons.get(lesson).id), questions };
  }

  window.UnlockHomeworkDictation = { plan };
})();
