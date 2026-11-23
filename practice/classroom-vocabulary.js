"use strict";

(function () {
  const stages = {
    cards: { english: "Word Cards", chinese: "词卡朗读" },
    match: { english: "Picture and Sentence Matching", chinese: "图片与句子匹配" },
    use: { english: "Vocabulary Practice", chinese: "选词填空" }
  };

  function makeSections(pack, code) {
    let number = 0;
    const generated = pack.source.version === 2 ? window.UNLOCK_VOCABULARY_PICTURES || {} : {};
    const scenePicture = (id, example) => {
      const scene = generated[id];
      return scene?.example === example ? scene.picture : undefined;
    };
    const cards = pack.cards.map(({ id, term, ...wordCard }) => {
      const picture = scenePicture(id, wordCard.example) ?? wordCard.picture;
      return { sourceId: id, type: "open", prompt: term, wordCard: { ...wordCard, picture }, picture };
    });
    const matching = pack.matching.flatMap(({ options, rows }) => {
      const picturesByAnswer = new Map();
      for (const row of rows) {
        const picture = scenePicture(row.id, row.prompt);
        if (picture) picturesByAnswer.set(row.answer, picture);
      }
      const choices = options.map(option => {
        const picture = picturesByAnswer.get(option.key);
        return picture ? { key: option.key, picture } : option;
      });
      const instruction = choices.some(option => option.text)
        ? "Match the sentence to the picture or meaning."
        : "Match the sentence to the picture.";
      return rows.map(({ id, prompt, answer }) => ({
        sourceId: id, type: "choice", prompt, instruction,
        keys: [answer], options: choices.map(({ key, text }) => [key, text ?? key]),
        pictureOptions: choices
      }));
    });
    const fill = pack.fill.flatMap(({ bank, rows }) => rows.map(({ id, before, after, cue, choices, answer }) => ({
      sourceId: id, type: "choice", keys: [answer],
      prompt: before + "____" + after + (cue ? " (" + cue + ")" : ""),
      instruction: "Choose the word that completes the sentence.",
      options: [...new Set(choices ?? bank)].map(word => [word, word])
    })));

    return [[stages.cards, "cards", cards], [stages.match, "match", matching], [stages.use, "use", fill]]
      .map(([title, stage, items]) => ({
        name: title.chinese,
        questions: items.map(({ sourceId, ...item }, index) => ({
          ...item,
          id: "classroom-vocabulary/" + pack.source.id + "-" + code + "/" + stage + "/" + sourceId,
          number: ++number,
          kind: title.chinese,
          vocabulary: { stage, position: index + 1, total: items.length, sourceId, ...pack.source }
        }))
      }));
  }

  function versionFor(attempt) {
    if (attempt.classroomVocabularyVersion === 1 || attempt.classroomVocabularyVersion === 2) {
      return attempt.classroomVocabularyVersion;
    }
    const previous = [attempt.draft, attempt.draftRecordings].some(entries =>
      Object.keys(entries || {}).some(id => id.startsWith("classroom-vocabulary/")));
    return attempt.classroomVocabulary || previous ? 1 : 2;
  }

  function verifyLesson(pack, meta) {
    const bank = window.UNLOCK_LESSON_DICTATION;
    const unit = bank.books[meta.book]?.find(unit => unit.number === meta.unit);
    const lesson = unit?.sets.find(set => set.track === pack.track && set.lesson === 1);
    if (!lesson || pack.source.version !== 2 || pack.source.dictationId !== lesson.id ||
        lesson.items.length !== pack.cards.length || pack.cards.some((card, index) => {
          const expected = lesson.items[index];
          return card.id !== expected.id || card.term.toLowerCase() !== expected.word.toLowerCase() ||
            card.wordAudio !== bank.pronunciations[expected.pronunciation]?.file;
        })) {
      throw new Error("Classroom vocabulary and pre-class dictation are out of sync");
    }
  }

  async function load(meta, code, signal, version = 2) {
    if (!/^[LSRW]_H[123]$/.test(code)) return [];
    const track = /^[LS]/.test(code) ? "LS" : "RW";
    const id = "B" + String(meta.book).padStart(2, "0") + "-" + track + "-U" + String(meta.unit).padStart(2, "0");
    const folder = version === 2 ? "data/classroom-vocabulary/v2/" : "data/classroom-vocabulary/";
    const response = await window.UnlockPracticeCatalog.readResource(folder + id + ".json", signal);
    const pack = await response.json();
    if (pack.unitId !== meta.id || pack.track !== track || pack.source?.id !== id || pack.source.lesson !== 1 ||
        !pack.cards?.length || !pack.matching?.length || !pack.fill?.length) {
      throw new Error("Classroom vocabulary does not match this assignment");
    }
    if (version === 2) verifyLesson(pack, meta);
    return makeSections(pack, code);
  }

  window.UnlockClassroomVocabulary = { stages, load, versionFor };
})();

