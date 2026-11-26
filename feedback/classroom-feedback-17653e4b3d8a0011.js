"use strict";

(function () {
  const session = window.UnlockSession;
  const active = session.requireSession("teacher");
  if (!active) return;

  const scales = [
    {
      title: "出勤情况",
      labels: ["确认未到课或请假", "到课不足50%", "到课50%至不足75%", "到课75%至不足100%", "全程到课"]
    },
    {
      title: "任务完成度",
      labels: ["确认未完成任何任务", "完成不足50%", "完成50%至不足75%", "完成75%至不足100%", "全部完成"]
    },
    {
      title: "任务质量",
      labels: ["核心要求未达", "少数关键项达标", "基本达标有错漏", "主要达标有小错", "全达标且关键准确"]
    }
  ];
  const feedbackFields = [
    {
      title: "具体表现",
      hint: "可写课堂参与、互动回应、专注情况和当堂练习过程。"
    },
    {
      title: "掌握情况",
      hint: "可写已掌握的知识点、当堂正确率、典型错漏和还需巩固的地方。"
    }
  ];

  const subjects = ["听力", "口语", "阅读", "写作"];
  const studentAccents = ["#7756a3", "#aa5825", "#315ea7", "#1f7664", "#a44362", "#476d27"];
  const $ = id => document.getElementById(id);
  const form = $("feedback-form");
  const dateField = $("feedback-date");
  const weekField = $("feedback-week");
  const defaults = [
    { title: "日期", source: dateField },
    { title: "教学周", source: weekField }
  ];
  const roster = $("feedback-roster");
  const add = $("feedback-add");
  const rosterCount = $("feedback-roster-count");
  const exportScope = $("feedback-export-scope");
  const exportButton = $("feedback-export");
  const exportStatus = $("feedback-export-status");
  const allStudents = "all";
  const studentList = $("feedback-students");
  const removalNotice = $("feedback-removal");
  const removalMessage = $("feedback-removal-message");
  const undoRemoval = $("feedback-undo");
  const review = $("feedback-review");
  const reviewList = $("feedback-review-list");
  const records = new Map();
  const removals = [];
  const students = new Map();
  const groups = new Map();
  const initialDate = chinaDate();
  let nextOrder = 0;

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function chinaDate() {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return [values.year, values.month, values.day].join("-");
  }

  for (const [index, student] of (window.UNLOCK_STUDENTS || []).entries()) {
    const id = String(index);
    const groupName = [student.level, student.adminClass].filter(Boolean).join(" ") || "学生";
    if (!groups.has(groupName)) {
      const group = element("optgroup");
      group.label = groupName;
      groups.set(groupName, group);
      roster.append(group);
    }
    const option = new Option(student.name, id);
    const accent = studentAccents[student.loginPortrait - 1] || studentAccents[index % studentAccents.length];
    students.set(id, { id, name: student.name, groupName, accent, option });
    groups.get(groupName).append(option);
  }

  function updateRosterAction() {
    add.disabled = !students.has(roster.value);
    add.textContent = records.has(roster.value) ? "查看反馈" : "添加学生";
  }

  function updateStudentOptions() {
    for (const student of students.values()) {
      student.option.textContent = student.name + (records.has(student.id) ? "，已添加" : "");
    }
    updateRosterAction();
    rosterCount.textContent = "已添加 " + records.size + " 名学生";
    updateExportOptions();
  }

  function exportableRecords() {
    return orderedRecords().filter(record => record.lessons.size > 0);
  }

  function updateExportControls(eligible = exportableRecords()) {
    const canExport = eligible.length > 0;
    const needsScope = canExport && !exportScope.value;
    exportScope.disabled = !canExport;
    exportButton.disabled = !canExport || needsScope;
    const messages = [];
    if (needsScope) messages.push("原选择已清除，请重新选择导出范围。");
    const pending = records.size - eligible.length;
    if (pending) messages.push(pending + " 名学生待选科目，添加科目后可导出。");
    exportStatus.textContent = messages.join("");
    exportStatus.hidden = messages.length === 0;
  }

  function updateExportOptions() {
    const eligible = exportableRecords();
    const selected = exportScope.value;
    const placeholder = new Option("请选择导出范围", "");
    placeholder.disabled = true;
    const options = eligible.map(record => new Option(record.student.name, record.student.id));
    exportScope.replaceChildren(placeholder, new Option("全部已添加科目的学生", allStudents), ...options);
    exportScope.value = selected === allStudents || eligible.some(record => record.student.id === selected)
      ? selected : "";
    updateExportControls(eligible);
  }

  function field(title, control) {
    const label = element("label", title, "feedback-field");
    label.append(control);
    return label;
  }

  function button(text, className) {
    const control = element("button", text, className);
    control.type = "button";
    return control;
  }

  function orderedRecords() {
    return Array.from(records.values()).sort((a, b) => a.order - b.order);
  }

  function orderedLessons(record) {
    return subjects.map(subject => record.lessons.get(subject)).filter(Boolean);
  }

  function studentFrame(student, headingTag) {
    const row = element("section", undefined, "feedback-student");
    row.style.setProperty("--feedback-student-accent", student.accent);
    const heading = element(headingTag, student.name);
    const identity = element("div", undefined, "feedback-identity");
    identity.append(heading, element("span", student.groupName));
    const header = element("header", undefined, "feedback-person");
    header.append(identity);
    const lessonGrid = element("div", undefined, "feedback-subjects");
    row.append(header, lessonGrid);
    return { row, heading, header, lessonGrid };
  }

  function lessonHeader(tag, student, subject) {
    const header = element(tag, undefined, "feedback-subject-heading");
    header.append(element(tag === "summary" ? "strong" : "h3", subject), element("span", student.name));
    return header;
  }

  function applyDefaults(lesson) {
    for (const { input, source, followsDefault } of lesson.meta) {
      if (followsDefault) input.value = source.value;
    }
  }

  function syncDefaults() {
    for (const record of records.values()) {
      for (const lesson of record.lessons.values()) applyDefaults(lesson);
    }
  }

  function courseFields(container, context) {
    return defaults.map(({ title, source }) => {
      const input = source.cloneNode(false);
      input.id = source.id + "-" + context;
      input.required = true;
      const label = element("label", title);
      label.htmlFor = input.id;
      const status = element("span", "随默认", "feedback-default-state");
      status.id = input.id + "-status";
      input.setAttribute("aria-describedby", status.id);
      const restore = button("恢复默认", "feedback-default-restore");
      restore.setAttribute("aria-label", "恢复默认" + title);
      restore.hidden = true;
      const heading = element("div", undefined, "feedback-course-heading");
      heading.append(label, status, restore);
      const group = element("div", undefined, "feedback-field");
      group.append(heading, input);
      container.append(group);

      const entry = { title, source, input, followsDefault: true };
      function setFollowing(followsDefault) {
        entry.followsDefault = followsDefault;
        status.textContent = followsDefault ? "随默认" : "单独设置";
        restore.hidden = followsDefault;
      }
      function restoreDefault() {
        input.value = source.value;
        setFollowing(true);
      }
      const compareDefault = () => setFollowing(!input.validity.badInput && input.value === source.value);
      input.addEventListener("input", compareDefault);
      input.addEventListener("change", () => {
        if (!input.value && !input.validity.badInput) restoreDefault();
        else compareDefault();
      });
      restore.addEventListener("click", () => {
        restoreDefault();
        input.focus({ preventScroll: true });
      });
      return entry;
    });
  }

  function ratingFields(grid, absence) {
    const scores = scales.map(({ title, labels }, scale) => {
      const menu = element("select", undefined, "feedback-rating");
      menu.dataset.scale = String(scale);
      menu.append(new Option("待评", ""));
      labels.forEach((label, index) => menu.append(new Option((index + 1) + " " + label, String(index + 1))));
      grid.append(field(title, menu));
      return menu;
    });
    const [attendance, ...task] = scores;
    let taskBeforeAbsence = null;
    attendance.addEventListener("change", () => {
      if (attendance.value === "1") {
        taskBeforeAbsence ??= task.map(menu => menu.value);
        for (const menu of task) {
          menu.value = "1";
          menu.disabled = true;
        }
      } else if (taskBeforeAbsence) {
        task.forEach((menu, index) => {
          menu.disabled = false;
          menu.value = taskBeforeAbsence[index];
        });
        taskBeforeAbsence = null;
      }
      absence.hidden = attendance.value !== "1";
    });
    return scores;
  }

  function makeLesson(record, subject) {
    const section = element("details", undefined, "feedback-subject");
    const summary = lessonHeader("summary", record.student, subject);
    const editor = element("div", undefined, "feedback-subject-body");
    const course = element("div", undefined, "feedback-lesson-meta");
    const ratings = element("div", undefined, "feedback-grid");
    const absence = element("p", "未到课时，任务完成度和任务质量记 1。", "feedback-absence");
    absence.hidden = true;
    absence.setAttribute("role", "status");
    const feedback = element("div", undefined, "feedback-notes");
    const meta = courseFields(course, record.student.id + "-" + subjects.indexOf(subject));
    const scores = ratingFields(ratings, absence);
    const notes = feedbackFields.map(({ title, hint }) => {
      const input = element("textarea");
      input.rows = 4;
      input.placeholder = hint;
      feedback.append(field(title, input));
      return { title, input };
    });
    const absenceReview = element("div", undefined, "feedback-absence-review");
    absenceReview.hidden = true;
    const absenceMessage = element("p", "本节课已标记未到课或请假。请核对上方评语。");
    absenceMessage.id = meta[0].input.id + "-absence-review";
    const confirmation = element("input");
    confirmation.type = "checkbox";
    confirmation.setAttribute("aria-describedby", absenceMessage.id);
    const confirmLabel = element("label", undefined, "feedback-absence-check");
    confirmLabel.append(confirmation, "已核对，确认将这些评语写入 PDF");
    absenceReview.append(absenceMessage, confirmLabel);
    function updateAbsenceReview() {
      const needsReview = scores[0].value === "1" && notes.some(({ input }) => input.value.trim());
      absenceReview.hidden = !needsReview;
      confirmation.required = needsReview;
      confirmation.checked = false;
    }
    scores[0].addEventListener("change", updateAbsenceReview);
    for (const { input } of notes) input.addEventListener("input", updateAbsenceReview);

    const remove = button("移除科目", "feedback-remove");
    remove.setAttribute("aria-label", "移除 " + record.student.name + " 的" + subject + "反馈");
    editor.append(course, ratings, absence, feedback, absenceReview, remove);
    section.append(summary, editor);
    const lesson = { subject, section, summary, meta, scores, notes, confirmation };
    remove.addEventListener("click", () => {
      record.lessons.delete(subject);
      section.remove();
      setPickerOpen(record, false);
      updateExportOptions();
      removals.push({ record, lesson });
      updateRemovalNotice();
      undoRemoval.focus({ preventScroll: true });
    });
    return lesson;
  }

  function showLesson(record, lesson) {
    record.lessons.set(lesson.subject, lesson);
    const order = orderedLessons(record);
    const next = order[order.indexOf(lesson) + 1];
    record.lessonGrid.insertBefore(lesson.section, next?.section || null);
    applyDefaults(lesson);
    lesson.section.open = true;
  }

  function setPickerOpen(record, open) {
    const available = subjects.filter(subject => !record.lessons.has(subject));
    record.addSubjects.disabled = available.length === 0;
    record.addSubjects.textContent = available.length ? "添加科目" : "全部科目已添加";
    const visible = open && available.length > 0;
    record.picker.hidden = !visible;
    record.emptyState.hidden = visible || record.lessons.size > 0;
    record.addSubjects.setAttribute("aria-expanded", String(visible));
    if (!visible) {
      record.choices.replaceChildren();
      record.confirmSubjects.disabled = true;
      return;
    }
    const choices = available.map(subject => {
      const check = element("input");
      check.type = "checkbox";
      check.value = subject;
      const label = element("label", undefined, "feedback-choice");
      label.append(check, subject);
      return label;
    });
    record.choices.replaceChildren(...choices);
    record.confirmSubjects.disabled = true;
    record.choices.querySelector("input").focus();
  }

  function updateRemovalNotice() {
    const latest = removals.at(-1);
    removalNotice.hidden = !latest;
    const subject = latest?.lesson ? "的" + latest.lesson.subject + "反馈" : "";
    removalMessage.textContent = latest ? "已移除 " + latest.record.student.name + subject : "";
  }

  function visitStudent(record) {
    const lessons = orderedLessons(record);
    const lesson = lessons.find(item => item.section.open) || lessons[0];
    record.row.scrollIntoView({ block: "start" });
    (lesson?.summary || record.addSubjects).focus({ preventScroll: true });
  }

  function showStudent(record) {
    const next = orderedRecords().find(item => item.order > record.order);
    records.set(record.student.id, record);
    studentList.insertBefore(record.row, next?.row || null);
    for (const lesson of record.lessons.values()) applyDefaults(lesson);
    updateStudentOptions();
  }

  function restoreRemoval(entry) {
    removals.splice(removals.indexOf(entry), 1);
    if (entry.lesson) {
      showLesson(entry.record, entry.lesson);
      setPickerOpen(entry.record, false);
      updateExportOptions();
      entry.lesson.summary.focus();
    } else {
      showStudent(entry.record);
      visitStudent(entry.record);
    }
    updateRemovalNotice();
  }

  function addStudent(id) {
    if (!students.has(id)) return;
    const existing = records.get(id);
    if (existing) {
      visitStudent(existing);
      return;
    }
    const removed = removals.find(entry => entry.record.student.id === id && !entry.lesson);
    if (removed) {
      restoreRemoval(removed);
      return;
    }

    const student = students.get(id);
    const { row, heading, header, lessonGrid } = studentFrame(student, "h3");
    heading.id = "feedback-student-" + id;
    row.setAttribute("aria-labelledby", heading.id);
    const actions = element("div", undefined, "feedback-person-actions");
    const addSubjects = button("添加科目", "feedback-button");
    const removeStudent = button("移除学生", "feedback-remove");
    removeStudent.setAttribute("aria-label", "移除 " + student.name);
    actions.append(addSubjects, removeStudent);
    header.append(actions);

    const picker = element("fieldset", undefined, "feedback-subject-picker");
    picker.id = "feedback-subject-picker-" + id;
    addSubjects.setAttribute("aria-controls", picker.id);
    const pickerRow = element("div", undefined, "feedback-picker-row");
    const choices = element("div", undefined, "feedback-choices");
    const pickerActions = element("div", undefined, "feedback-picker-actions");
    const cancelSubjects = button("取消添加", "feedback-button feedback-picker-cancel");
    const confirmSubjects = button("添加所选科目", "feedback-button feedback-picker-confirm");
    pickerActions.append(cancelSubjects, confirmSubjects);
    pickerRow.append(choices, pickerActions);
    picker.append(element("legend", "选择科目"), pickerRow);
    row.insertBefore(picker, lessonGrid);
    const emptyState = element("p", "尚未添加科目。添加科目后可导出。", "feedback-empty-state");
    emptyState.hidden = true;
    row.insertBefore(emptyState, lessonGrid);
    const record = {
      student, row, lessonGrid, addSubjects, picker, emptyState, choices, confirmSubjects,
      lessons: new Map(), order: nextOrder++
    };

    addSubjects.addEventListener("click", () => setPickerOpen(record, picker.hidden));
    cancelSubjects.addEventListener("click", () => {
      setPickerOpen(record, false);
      addSubjects.focus({ preventScroll: true });
    });
    choices.addEventListener("change", () => {
      confirmSubjects.disabled = !choices.querySelector("input:checked");
    });
    confirmSubjects.addEventListener("click", () => {
      const selected = Array.from(choices.querySelectorAll("input:checked"), check => check.value);
      let first;
      for (const subject of selected) {
        const entry = removals.find(item => item.record === record && item.lesson?.subject === subject);
        if (entry) removals.splice(removals.indexOf(entry), 1);
        const lesson = entry?.lesson || makeLesson(record, subject);
        showLesson(record, lesson);
        first ??= lesson;
      }
      setPickerOpen(record, false);
      updateExportOptions();
      updateRemovalNotice();
      first?.summary.focus();
    });
    removeStudent.addEventListener("click", () => {
      records.delete(id);
      removals.push({ record });
      row.remove();
      updateStudentOptions();
      updateRemovalNotice();
      undoRemoval.focus({ preventScroll: true });
    });

    showStudent(record);
    setPickerOpen(record, true);
  }

  function hasDraft() {
    return records.size > 0 || removals.length > 0 ||
      dateField.value !== initialDate || weekField.value !== "";
  }

  function exportRecords() {
    const eligible = exportableRecords();
    return exportScope.value === allStudents ? eligible
      : eligible.filter(record => record.student.id === exportScope.value);
  }

  function validateRecords(selection) {
    if (!selection.length) return false;
    for (const record of selection) {
      for (const lesson of orderedLessons(record)) {
        const controls = [...lesson.meta.map(({ input }) => input), lesson.confirmation];
        const invalid = controls.find(input => !input.validity.valid);
        if (invalid) {
          lesson.section.open = true;
          invalid.reportValidity();
          return false;
        }
      }
    }
    return true;
  }

  function reviewItem(record, lesson) {
    const pending = scales.filter((_, index) => !lesson.scores[index].value).map(({ title }) => title);
    const blank = lesson.scores[0].value === "1" ? []
      : lesson.notes.filter(({ input }) => !input.value.trim()).map(({ title }) => title);
    const details = [];
    if (pending.length) details.push(pending.join("、") + "待评。");
    if (blank.length) details.push(blank.join("、") + "未填写。");
    if (!details.length) return null;
    const item = element("li");
    item.append(element("strong", record.student.name + "，" + lesson.subject), element("p", details.join("")));
    return item;
  }

  function paperField(title, value, rating) {
    const group = element("div", undefined, "feedback-field");
    const printed = element("p", value, "paper-value");
    if (rating !== undefined) {
      printed.classList.add("feedback-rating");
      printed.dataset.rating = rating;
    }
    group.append(element("span", title), printed);
    return group;
  }

  function printLesson(record, lesson) {
    const section = element("section", undefined, "feedback-subject paper-subject");
    const body = element("div", undefined, "feedback-subject-body");
    const course = element("div", undefined, "feedback-lesson-meta");
    course.append(...lesson.meta.map(({ title, input }) => paperField(title, input.value)));
    const ratings = element("div", undefined, "feedback-grid");
    ratings.append(...scales.map(({ title }, index) => {
      const menu = lesson.scores[index];
      return paperField(title, menu.selectedOptions[0].text, menu.value);
    }));
    const notes = element("div", undefined, "feedback-notes");
    const emptyNote = lesson.scores[0].value === "1" ? "未评" : "未填写";
    notes.append(...lesson.notes.map(({ title, input }) => paperField(title, input.value.trim() ? input.value : emptyNote)));
    body.append(course, ratings, notes);
    section.append(lessonHeader("header", record.student, lesson.subject), body);
    return section;
  }

  function printStudent(record) {
    const { row, lessonGrid } = studentFrame(record.student, "h2");
    row.classList.add("paper-student");
    lessonGrid.append(...orderedLessons(record).map(lesson => printLesson(record, lesson)));
    return row;
  }

  function repeatSubjectHeading(section) {
    const [heading, body] = section.children;
    const table = element("table", undefined, "paper-continuation-table");
    table.setAttribute("role", "presentation");
    table.createTHead().insertRow().insertCell().append(heading);
    table.createTBody().insertRow().insertCell().append(body);
    section.append(table);
    section.classList.add("paper-continuation");
  }

  function fitPaperCards(paper) {
    paper.classList.add("paper-measuring");
    try {
      const pageHeight = paper.clientHeight;
      for (const card of paper.querySelectorAll(".paper-student")) {
        const grid = card.querySelector(".feedback-subjects");
        const style = getComputedStyle(grid);
        const frameHeight = card.offsetHeight - grid.offsetHeight +
          parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
        const subjectLimit = pageHeight - frameHeight;
        const sections = Array.from(grid.children);
        if (sections.some(section => section.offsetHeight > subjectLimit)) {
          card.classList.add("paper-flow");
          for (const section of sections.filter(section => section.offsetHeight > subjectLimit)) {
            repeatSubjectHeading(section);
          }
        }
        if (card.offsetHeight > pageHeight) card.classList.add("paper-breakable");
      }
    } finally {
      paper.classList.remove("paper-measuring");
    }
  }

  function printFeedback(selection) {
    const header = element("header", undefined, "paper-heading");
    header.append(element("strong", "UNLOCK", "paper-brand"), element("h1", "课堂反馈"));
    const paper = $("feedback-paper");
    paper.replaceChildren(header, ...selection.map(printStudent));
    fitPaperCards(paper);
    window.print();
  }

  dateField.value = initialDate;
  for (const { source } of defaults) {
    source.addEventListener("input", syncDefaults);
    source.addEventListener("change", syncDefaults);
  }
  roster.addEventListener("change", updateRosterAction);
  add.addEventListener("click", () => addStudent(roster.value));
  exportScope.addEventListener("change", () => updateExportControls());
  undoRemoval.addEventListener("click", () => {
    const latest = removals.at(-1);
    if (latest) restoreRemoval(latest);
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (records.size === 0) return;
    const selection = exportRecords();
    if (!validateRecords(selection)) return;
    const incomplete = selection.flatMap(record => orderedLessons(record).map(lesson => reviewItem(record, lesson))).filter(Boolean);
    if (!incomplete.length) {
      printFeedback(selection);
      return;
    }
    reviewList.replaceChildren(...incomplete);
    review.showModal();
  });
  $("feedback-review-back").addEventListener("click", () => review.close());
  $("feedback-review-export").addEventListener("click", () => {
    review.close();
    const selection = exportRecords();
    if (validateRecords(selection)) printFeedback(selection);
  });
  window.addEventListener("beforeunload", event => {
    if (session.current()?.id === active.id && hasDraft()) {
      event.preventDefault();
      event.returnValue = true;
    }
  });
  $("feedback-sign-out").addEventListener("click", () => {
    if (session.current()?.id === active.id && hasDraft() &&
        !window.confirm("当前页面有已填写的内容。请确认已另存需要的 PDF，再退出登录。")) return;
    session.signOut("teacher", location.href);
  });
  updateStudentOptions();
  $("feedback-page").hidden = false;
})();
