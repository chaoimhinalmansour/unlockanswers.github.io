"use strict";

(function () {
  function normalized(value, matchCase = false) {
    const clean = String(value ?? "").normalize("NFC").replace(/[‘’]/g, "'")
      .replace(/[ \t\u00a0]+/g, " ").trim();
    return matchCase ? clean : clean.toLowerCase();
  }

  function answerText(value, matchCase) {
    const clean = normalized(value, matchCase);
    if (/^-?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(clean)) {
      return clean.replace(/,/g, "");
    }
    return clean;
  }

  function sequenceText(value) {
    return normalized(value).replace(/\s+([,.;?!])/g, "$1")
      .replace(/\s*[.?!]$/, "");
  }

  function isAnswered(question, value) {
    if (question.type === "multi" || question.type === "order") {
      const available = question.options.map(option => option[0]);
      const count = question.type === "order" ? available.length : question.pick;
      return Array.isArray(value) && value.length === count &&
        new Set(value).size === count && value.every(item => available.includes(item));
    }
    if (question.type === "choice" || question.type === "select") {
      return question.options.some(option => option[0] === value);
    }
    return typeof value === "string" && value.trim() !== "";
  }

  function judge(question, value) {
    if (question.type === "open") return "ungraded";
    if (!isAnswered(question, value)) return "blank";
    if (question.type === "text") {
      const response = answerText(value, question.matchCase);
      return question.keys.some(key => answerText(key, question.matchCase) === response)
        ? "correct" : "incorrect";
    }
    if (question.type === "order" || question.type === "multi") {
      const matches = question.keys.some(key => {
        if (question.type === "order") return key.every((part, index) => part === value[index]);
        return key.length === value.length && key.every(part => value.includes(part));
      });
      return matches ? "correct" : "incorrect";
    }
    return question.keys.includes(value) ? "correct" : "incorrect";
  }

  function optionText(question, key) {
    const option = question.options?.find(item => item[0] === key);
    if (!option) return String(key);
    const [value, label] = option;
    if (question.type === "order" && !question.orderedSentences) return label;
    return label && value !== label ? value + "  " + label : value;
  }

  function displayAnswer(question, value) {
    if (Array.isArray(value)) {
      if (question.type === "order") {
        return value.map(key => optionText(question, key)).join(question.orderedSentences ? " / " : " ");
      }
      return value.map(key => optionText(question, key)).join("\n");
    }
    if (value === "" || value == null) return "";
    return question.options ? optionText(question, value) : value;
  }

  function displayKeys(question) {
    if (question.type === "open") return "";
    if (question.type === "order" && !question.orderedSentences) {
      return question.canonical;
    }
    return question.keys.map(key => displayAnswer(question, key)).join(" / ");
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  const rules = { normalized, sequenceText, judge, isAnswered, displayAnswer, displayKeys, escapeHTML };
  if (typeof window === "object") window.UnlockRules = rules;
  if (typeof module === "object") module.exports = rules;
})();
