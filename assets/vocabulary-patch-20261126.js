"use strict";
(() => {
  const base = new URL("vocabulary-feedback-v1/", document.currentScript.src);
  const prompt = new Audio();
  prompt.preload = "none";
  function feedback(correct) {
    prompt.pause();
    prompt.src = new URL(correct ? "correct.wav" : "incorrect.wav", base).href;
    prompt.currentTime = 0;
    prompt.play().catch(() => {});
  }
  function stopFeedback() { prompt.pause(); }
  window.UnlockVocabularyPatch = { feedback, stopFeedback };
})();
