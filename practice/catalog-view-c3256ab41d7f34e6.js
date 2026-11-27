"use strict";

(function () {
  const { escapeHTML: esc } = window.UnlockRules;
  const { sectionName } = window.UnlockWorksheet;
  const readingBeta = window.UnlockReadingBeta;
  const catalog = [...window.UNLOCK_CATALOG, ...readingBeta.extraUnits]
    .sort((a, b) => a.book - b.book || a.unit - b.unit);
  const specials = window.UNLOCK_SPECIALS || [];
  const specialUnit = "STP1116";
  const subjects = { L: "Listening", S: "Speaking", R: "Reading", W: "Writing" };
  const ui = window.UnlockStudentUI;
  const label = (en, zh) => ui ? ui.label(en, zh) : esc(zh || en);

  function unitNumber(unit) {
    return String(unit).padStart(2, "0");
  }

  function findMeta(book, unit) {
    return (unit === specialUnit ? specials : catalog).find(item => item.book === book && item.unit === unit);
  }

  function allowsWorksheet(meta, code) {
    if (!meta) return false;
    if (meta.readingOnly) return Boolean(readingBeta.revision(meta, code));
    return (meta.unit === specialUnit ? /^[LSRW]_STP$/ : /^[LSRW]_H[123]$/).test(code);
  }

  function unitLabel(meta) {
    const name = meta.unit === specialUnit ? meta.topic : "Unit " + unitNumber(meta.unit);
    return "Book " + meta.book + " " + name;
  }

  function subjectTitle(code) {
    return code.endsWith("_STP") ? subjects[code[0]] : subjects[code[0]] + " " + code.slice(2);
  }

  function taskButton(code, title, activityFor) {
    const activity = activityFor?.(code);
    const status = activity ? '<span class="mini-status ' + activity.style + '">' +
      label(activity.english, activity.name) + "</span>" : "";
    const name = activity && code.endsWith("_STP") ? label("Open Practice", title) : esc(title);
    return '<button type="button" class="assignment-button' + (activity?.style ? " started" : "") +
      '" data-task="' + esc(code) + '"><strong>' + name + "</strong>" + status + "</button>";
  }

  function subjectCard(skill, title, activityFor, isSpecial) {
    const actions = isSpecial
      ? taskButton(skill + "_STP", activityFor ? "打开练习" : "打开讲评", activityFor)
      : [1, 2, 3].map(h => taskButton(skill + "_H" + h, "H" + h, activityFor)).join("");
    return '<section class="track" aria-label="' + title + '"><h2>' + title +
      '</h2><p class="track-caption">' + sectionName(skill) + '</p><div class="assignment-list">' +
      actions + "</div></section>";
  }

  function directorySelect(field, title, translation, options, selected) {
    return '<label class="directory-filter">' + label(title, translation) +
      '<select data-directory-filter="' + field + '">' + options.map(([value, name]) =>
        '<option value="' + esc(value) + '"' + (value === selected ? " selected" : "") + '>' +
        esc(name) + '</option>'
      ).join("") + '</select></label>';
  }

  function renderStudentDirectory(meta, availableBooks, units, special, tracks) {
    const isSpecial = meta.unit === specialUnit;
    const bookOptions = availableBooks.map(book => [book, "Book " + book]);
    const unitOptions = units.map(item => [item.unit, "Unit " + unitNumber(item.unit)]);
    if (special) unitOptions.push([specialUnit, "Midterm Practice 期中特别练习"]);
    const section = "Unit " + unitNumber(meta.unit);
    const topic = isSpecial ? label("Midterm Practice", "期中特别练习")
      : meta.readingOnly ? label(section, "第 " + unitNumber(meta.unit) + " 单元")
      : label(section + " " + meta.topic, ui?.topicTranslation(meta.topic));
    return '<section class="catalog practice-directory" aria-labelledby="practice-directory-title">' +
      '<div class="catalog-head"><h1 id="practice-directory-title" class="ui-page-title">' +
      label("Unit Practice", "单元练习") + '</h1></div><div class="directory-filters">' +
      directorySelect("book", "Book", "册次", bookOptions, meta.book) +
      directorySelect("unit", "Unit", "单元", unitOptions, meta.unit) +
      '</div><div class="unit-heading"><h2>' + topic + '</h2></div>' +
      '<div class="catalog-grid">' + tracks + '</div></section>';
  }

  function renderDirectory(meta, activityFor, availableBooks = []) {
    const special = findMeta(meta.book, specialUnit);
    const isSpecial = meta.unit === specialUnit;
    const unitMetas = catalog.filter(item => item.book === meta.book);
    const tracks = Object.entries(subjects).filter(([skill]) => !meta.readingOnly || skill === "R")
      .map(([skill, title]) => subjectCard(skill, title, activityFor, isSpecial)).join("");
    if (activityFor) return renderStudentDirectory(meta, availableBooks, unitMetas, special, tracks);

    const specialButton = special ? '<button type="button" data-action="special" aria-pressed="' + isSpecial + '">' +
      esc(special.topic) + '</button>' : "";
    const section = isSpecial ? "Book " + meta.book : "Unit " + unitNumber(meta.unit);
    const units = unitMetas.map(item =>
      '<button type="button" data-unit="' + item.unit + '" aria-pressed="' + (item.unit === meta.unit) +
      '">Unit ' + unitNumber(item.unit) + "</button>"
    ).join("");
    const bookNumbers = [...new Set(catalog.map(item => item.book))];
    const books = bookNumbers.length ? '<nav class="unit-picker book-picker" aria-label="Books 教材">' +
      bookNumbers.map(book =>
        '<button type="button" data-book="' + book + '" aria-pressed="' + (book === meta.book) +
        '">Book ' + book + "</button>"
      ).join("") + "</nav>" : "";
    return '<section class="catalog"><div class="catalog-head"><h1>Book ' + meta.book +
      ' 讲评目录</h1><p>选择练习和科目，打开讲评。</p></div>' +
      books + '<nav class="unit-picker" aria-label="选择单元">' + units + '</nav>' +
      (specialButton ? '<nav class="unit-picker special-picker" aria-label="特别练习">' + specialButton + '</nav>' : "") +
      '<div class="unit-heading"><span>' + esc(section) + "</span><h2>" +
      esc(meta.topic) + '</h2></div><div class="catalog-grid">' +
      tracks + "</div></section>";
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

  function renderDirectoryBack() {
    return '<button type="button" class="ui-nav ui-back" data-action="directory" ' +
      'aria-label="Back to the Unit Practice directory 返回单元练习目录">' + label("Back", "返回") + '</button>';
  }

  function renderOpening(opening, teaching = false) {
    const { meta, code, failed } = opening;
    const context = ui && !teaching && meta.unit === specialUnit ? "Book " + meta.book + " Midterm Practice" : unitLabel(meta);
    const title = context + " " + subjectTitle(code);
    const mode = teaching ? "讲评" : "练习";
    if (ui && !teaching) {
      return '<section class="empty-state unit-opening' + (failed ? "" : " is-loading") +
        '" aria-labelledby="opening-title">' + renderDirectoryBack() + '<h1 id="opening-title">' + esc(title) + '</h1>' +
        '<p class="unit-opening-status" role="status">' +
        (failed ? label("Practice could not load.", "暂时无法载入这份练习。") : label("Loading practice", "正在载入练习")) +
        '</p>' +
        (failed ? '<button type="button" class="button ui-action ui-primary" data-action="retry-open">' +
          label("Retry", "重试") + '</button>' : '') + '</section>';
    }
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
    createOpening, renderOpening, renderDirectoryBack, readResource, loadUnit
  };
})();