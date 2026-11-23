"use strict";

(function () {
  const data = window.UNLOCK_LESSON_DICTATION;
  const { makeItem } = window.UnlockWordDictation;
  const { buildQuestions } = window.UnlockMeaningChoice;

  function plan(unit, code, attempt) {
    if (!/^[LR]_H[123]$/.test(code)) return null;
    const savedSeed = attempt.homeworkDictationSeed;
    const resumed = Number.isInteger(savedSeed) && savedSeed >= 0 && savedSeed <= 0xffffffff;
    // Earlier submissions keep the questions they were graded on.
    if (attempt.first && !resumed) return null;
    const track = code[0] === "L" ? "LS" : "RW";
    const lesson = code.endsWith("3") ? 2 : 1;
    const source = data.books[unit.book]?.find(entry => entry.number === unit.unit)?.sets
      .find(entry => entry.track === track && entry.lesson === lesson);
    if (!source) return null;

    const seed = resumed ? savedSeed : crypto.getRandomValues(new Uint32Array(1))[0];
    const meanings = buildQuestions(source, source.items, seed);
    const lastNumber = Math.max(...unit.sheets[code].questions.map(question => question.number));
    const questions = source.items.map((word, index) => {
      const id = unit.id + "/" + code + "/dictation/" + word.id;
      const item = makeItem(id, lastNumber + index + 1, word.word, word.keys, data.pronunciations[word.pronunciation]);
      return {
        ...item, type: "text", kind: "单词听写", homeworkDictation: true,
        meaningQuestion: meanings.get(word.id)
      };
    });
    return { seed, source: source.id, questions };
  }

  window.UnlockHomeworkDictation = { plan };
})();
