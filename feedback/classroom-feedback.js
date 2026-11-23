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

  const $ = id => document.getElementById(id);
  const form = $("feedback-form");
  const dateField = $("feedback-date");
  const weekField = $("feedback-week");
  const subjectField = $("feedback-subject");
  const roster = $("feedback-roster");
  const add = $("feedback-add");
  const rosterCount = $("feedback-roster-count");
  const exportButton = $("feedback-export");
  const studentList = $("feedback-students");
  const removalNotice = $("feedback-removal");
  const removalMessage = $("feedback-removal-message");
  const review = $("feedback-review");
  const reviewList = $("feedback-review-list");
  const records = new Map();
  const removedStudents = new Map();
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
    students.set(id, { name: student.name, option });
    groups.get(groupName).append(option);
  }

  function updateActions() {
    add.disabled = !students.has(roster.value) || records.has(roster.value);
    const count = records.size;
    exportButton.disabled = count === 0;
    const message = "已添加 " + count + " 名学生";
    if (rosterCount.textContent !== message) rosterCount.textContent = message;
  }

  function field(title, control) {
    const label = element("label", title, "feedback-field");
    label.append(control);
    return label;
  }

  function orderedRecords() {
    return Array.from(records.values()).sort((a, b) => a.order - b.order);
  }

  function showStudent(id, record, nextRow = null) {
    records.set(id, record);
    studentList.insertBefore(record.row, nextRow);
    students.get(id).option.disabled = true;
    roster.value = "";
    updateActions();
    record.scores[0].focus();
  }

  function updateRemovalNotice() {
    const latest = Array.from(removedStudents.values()).at(-1);
    removalNotice.hidden = !latest;
    removalMessage.textContent = latest ? "已移除 " + latest.name : "";
  }

  function restoreStudent(id) {
    const record = removedStudents.get(id);
    const next = orderedRecords().find(item => item.order > record.order);
    removedStudents.delete(id);
    showStudent(id, record, next?.row);
    updateRemovalNotice();
  }

  function addStudent(id) {
    if (!students.has(id) || records.has(id)) return;
    if (removedStudents.has(id)) {
      restoreStudent(id);
      return;
    }
    const student = students.get(id);
    const row = element("section", undefined, "feedback-student");
    const heading = element("h3", student.name);
    heading.id = "feedback-student-" + id;
    row.setAttribute("aria-labelledby", heading.id);
    const remove = element("button", "移除", "feedback-remove");
    remove.type = "button";
    remove.setAttribute("aria-label", "移除 " + student.name);
    const header = element("div", undefined, "feedback-person");
    header.append(heading, remove);
    const grid = element("div", undefined, "feedback-grid");
    const scores = scales.map(({ title, labels }, scale) => {
      const menu = element("select", undefined, "feedback-rating");
      menu.dataset.scale = String(scale);
      menu.append(new Option("待评", ""));
      labels.forEach((label, index) => menu.append(new Option((index + 1) + " " + label, String(index + 1))));
      grid.append(field(title, menu));
      return menu;
    });
    const joined = element("p", "未到课时，任务完成度和任务质量记 1。", "feedback-absence");
    joined.hidden = true;
    joined.setAttribute("role", "status");
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
      joined.hidden = attendance.value !== "1";
    });

    const feedback = element("div", undefined, "feedback-notes");
    const notes = feedbackFields.map(({ title, hint }) => {
      const input = element("textarea");
      input.rows = 4;
      input.placeholder = hint;
      feedback.append(field(title, input));
      return { title, input };
    });
    row.append(header, grid, joined, feedback);
    const record = { name: student.name, row, scores, notes, order: nextOrder++ };
    remove.addEventListener("click", () => {
      records.delete(id);
      removedStudents.set(id, record);
      row.remove();
      student.option.disabled = false;
      updateActions();
      updateRemovalNotice();
      roster.focus();
    });
    showStudent(id, record);
  }

  function hasDraft() {
    return records.size > 0 || removedStudents.size > 0 ||
      dateField.value !== initialDate || weekField.value !== "" || subjectField.value !== "";
  }

  function reviewItem(record) {
    const pending = scales.filter((_, index) => record.scores[index].value === "").map(({ title }) => title);
    const blank = record.notes.filter(({ input }) => input.value.trim() === "").map(({ title }) => title);
    const details = [];
    if (pending.length) details.push(pending.join("、") + "待评。");
    if (blank.length) details.push(blank.join("、") + "未填写。");
    if (!details.length) return null;
    const item = element("li");
    item.append(element("strong", record.name), element("p", details.join("")));
    return item;
  }

  function printStudent(record, subject) {
    const section = element("section", undefined, "paper-student");
    const header = element("div", undefined, "paper-student-header");
    header.append(element("h2", record.name), element("p", "科目 " + subject, "paper-subject"));
    const table = element("table", undefined, "paper-scores");
    const titleRow = table.createTHead().insertRow();
    const scoreRow = table.createTBody().insertRow();
    scales.forEach(({ title }, index) => {
      const heading = element("th", title);
      heading.scope = "col";
      titleRow.append(heading);
      scoreRow.insertCell().textContent = record.scores[index].selectedOptions[0].text;
    });
    header.append(table);
    section.append(header);
    for (const { title, input } of record.notes) {
      section.append(element("h3", title), element("p", input.value.trim() ? input.value : "未填写", "paper-feedback"));
    }
    return section;
  }

  function printFeedback() {
    const subject = subjectField.value;
    const meta = element("dl", undefined, "paper-meta");
    const entries = [
      ["日期", dateField.value],
      ["教学周", "第 " + weekField.valueAsNumber + " 周"],
      ["科目", subject]
    ];
    for (const [key, value] of entries) {
      const item = element("div");
      item.append(element("dt", key), element("dd", value));
      meta.append(item);
    }
    const header = element("header", undefined, "paper-heading");
    header.append(element("h1", "课堂反馈"), meta);
    $("feedback-paper").replaceChildren(header, ...orderedRecords().map(record => printStudent(record, subject)));
    window.print();
  }

  dateField.value = initialDate;
  roster.addEventListener("change", updateActions);
  add.addEventListener("click", () => addStudent(roster.value));
  $("feedback-undo").addEventListener("click", () => {
    const id = Array.from(removedStudents.keys()).at(-1);
    if (id !== undefined) restoreStudent(id);
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (records.size === 0) return;
    const incomplete = orderedRecords().map(reviewItem).filter(Boolean);
    if (!incomplete.length) {
      printFeedback();
      return;
    }
    reviewList.replaceChildren(...incomplete);
    review.showModal();
  });
  $("feedback-review-back").addEventListener("click", () => review.close());
  $("feedback-review-export").addEventListener("click", () => {
    review.close();
    printFeedback();
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
  updateActions();
  $("feedback-page").hidden = false;
})();
