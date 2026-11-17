"use strict";

(function () {
  const { escapeHTML: esc } = window.UnlockRules;
  const { sectionName } = window.UnlockWorksheet;
  const catalog = window.UNLOCK_CATALOG;
  const specials = window.UNLOCK_SPECIALS || [];
  const specialUnit = "STP1116";
  const subjects = { L: "Listening", S: "Speaking", R: "Reading", W: "Writing" };

  function unitNumber(unit) {
    return String(unit).padStart(2, "0");
  }

  function findMeta(book, unit) {
    return (unit === specialUnit ? specials : catalog).find(item => item.book === book && item.unit === unit);
  }

  function allowsWorksheet(meta, code) {
    if (!meta) return false;
    return (meta.unit === specialUnit ? /^[LSRW]_STP$/ : /^[LSRW]_H[123]$/).test(code);
  }

  function unitLabel(meta) {
    const label = meta.unit === specialUnit ? meta.topic : "Unit " + unitNumber(meta.unit);
    return "Book " + meta.book + " " + label;
  }

  function subjectTitle(code) {
    return code.endsWith("_STP") ? subjects[code[0]] : subjects[code[0]] + " " + code.slice(2);
  }

  function taskButton(code, title, activityFor) {
    const activity = activityFor?.(code);
    const label = activity ? '<span class="mini-status ' + activity.style + '">' + activity.name + "</span>" : "";
    return '<button type="button" class="assignment-button' + (activity?.style ? " started" : "") +
      '" data-task="' + esc(code) + '"><strong>' + esc(title) + "</strong>" + label + "</button>";
  }

  function subjectCard(skill, title, activityFor, isSpecial) {
    const actions = isSpecial
      ? taskButton(skill + "_STP", activityFor ? "打开练习" : "打开讲评", activityFor)
      : [1, 2, 3].map(h => taskButton(skill + "_H" + h, "H" + h, activityFor)).join("");
    return '<section class="track" aria-label="' + title + '"><h2>' + title +
      '</h2><p class="track-caption">' + sectionName(skill) + '</p><div class="assignment-list">' +
      actions + "</div></section>";
  }

  function renderDirectory(meta, activityFor) {
    const teaching = !activityFor;
    const special = findMeta(meta.book, specialUnit);
    const isSpecial = meta.unit === specialUnit;
    const specialButton = special ? '<nav class="unit-picker special-picker" aria-label="特别练习">' +
      '<button type="button" data-action="special" aria-pressed="' + isSpecial + '">' +
      esc(special.topic) + '</button></nav>' : "";
    const section = isSpecial ? "Book " + meta.book : "Unit " + unitNumber(meta.unit);
    const units = catalog.filter(item => item.book === meta.book).map(item =>
      '<button type="button" data-unit="' + item.unit + '" aria-pressed="' + (item.unit === meta.unit) +
      '">Unit ' + unitNumber(item.unit) + "</button>"
    ).join("");
    const books = teaching ? '<nav class="unit-picker book-picker" aria-label="选择教材">' +
      [...new Set(catalog.map(item => item.book))].map(book =>
        '<button type="button" data-book="' + book + '" aria-pressed="' + (book === meta.book) +
        '">Book ' + book + "</button>"
      ).join("") + "</nav>" : "";
    return '<section class="catalog"><div class="catalog-head"><h1>Book ' + meta.book +
      (teaching ? " 讲评目录" : " 作业目录") + "</h1><p>" +
      (teaching ? "选择练习和科目，打开讲评。" : "选择练习和科目，开始作答。") +
      '</p></div>' + books + '<nav class="unit-picker" aria-label="选择单元">' + units + '</nav>' +
      specialButton + '<div class="unit-heading"><span>' + esc(section) + "</span><h2>" +
      esc(meta.topic) + '</h2></div><div class="catalog-grid">' +
      Object.entries(subjects).map(([skill, title]) => subjectCard(skill, title, activityFor, isSpecial)).join("") + "</div></section>";
  }

  function loadUnit(meta) {
    const current = window.UNLOCK_UNITS[meta.id];
    if (current?.revision === meta.revision) return Promise.resolve(current);

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = (meta.scriptPath || "data/alpha-a4/" + meta.id.toLowerCase() + ".js") + "?v=" + meta.revision;
      script.addEventListener("error", () => reject(new Error("Cannot load unit")), { once: true });
      script.addEventListener("load", () => {
        const unit = window.UNLOCK_UNITS[meta.id];
        if (unit?.revision === meta.revision) resolve(unit);
        else reject(new Error("Unit revision mismatch"));
      }, { once: true });
      document.head.append(script);
    });
  }

  window.UnlockPracticeCatalog = { specialUnit, findMeta, allowsWorksheet, unitLabel, subjectTitle, renderDirectory, loadUnit };
})();