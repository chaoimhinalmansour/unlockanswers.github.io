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

  function createOpening(meta, code, view) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 15000);
    const finish = () => window.clearTimeout(timer);
    return {
      meta, code, view, failed: false, signal: controller.signal, finish,
      cancel() {
        finish();
        controller.abort();
      }
    };
  }

  function renderOpening(opening, teaching = false) {
    const { meta, code, failed } = opening;
    const title = unitLabel(meta) + " " + subjectTitle(code);
    const mode = teaching ? "讲评" : "练习";
    return '<section class="empty-state unit-opening' + (failed ? "" : " is-loading") +
      '" aria-labelledby="opening-title"><h1 id="opening-title">' + esc(title) + "</h1>" +
      '<p class="unit-opening-status" role="status">' +
      (failed ? "暂时无法载入这份" + mode + "。" : "正在载入" + mode + "。") + '</p>' +
      '<div class="unit-opening-actions">' +
      (failed ? '<button type="button" class="button" data-action="retry-open">重试</button>' : "") +
      '<button type="button" class="button secondary" data-action="directory">返回目录</button></div></section>';
  }

  async function readResource(path, signal) {
    const response = await fetch(path, { signal });
    if (!response.ok) throw new Error("Cannot load resource");
    return response;
  }

  async function loadUnit(meta, signal) {
    const current = window.UNLOCK_UNITS[meta.id];
    if (current?.revision === meta.revision) return current;

    const path = (meta.scriptPath || "data/alpha-a4/" + meta.id.toLowerCase() + ".js") + "?v=" + meta.revision;
    const response = await readResource(path, signal);
    const source = (await response.text()).trim();
    // The data files wrap generated JSON in one assignment to this unit.
    const prefix = "window.UNLOCK_UNITS[" + JSON.stringify(meta.id) + "]";
    const assignment = source.slice(prefix.length).trimStart();
    if (!source.startsWith(prefix) || !assignment.startsWith("=") || !assignment.endsWith(";")) {
      throw new Error("Unexpected unit data format");
    }
    const unit = JSON.parse(assignment.slice(1, -1));
    if (unit?.id !== meta.id || unit.revision !== meta.revision) throw new Error("Unit revision mismatch");
    if (signal?.aborted) throw new Error("Unit loading cancelled");
    window.UNLOCK_UNITS[meta.id] = unit;
    return unit;
  }

  window.UnlockPracticeCatalog = {
    specialUnit, findMeta, allowsWorksheet, unitLabel, subjectTitle, renderDirectory,
    createOpening, renderOpening, readResource, loadUnit
  };
})();