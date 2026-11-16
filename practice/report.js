"use strict";

(function () {
  const { escapeHTML: esc, displayAnswer, displayKeys } = window.UnlockRules;

  const { clipTime } = window.UnlockRecordings;

  const styles = [
    "html{color-scheme:light;background:#f5f5f7}",
    "*{box-sizing:border-box}",
    "body{margin:0;color:#1d1d1f;font:10.5pt/1.5 Arial,'PingFang SC','Microsoft YaHei',sans-serif}",
    ".tools{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:10px max(16px,calc((100vw - 210mm)/2));background:#fff;color:#515154;border-bottom:1px solid #e6e6eb;z-index:2}",
    ".tools div{font-size:13px}.tools button{font:inherit;font-weight:bold;background:#0071e3;color:#fff;border:0;border-radius:24px;padding:7px 12px;cursor:pointer}",
    ".paper{width:210mm;max-width:100%;min-height:297mm;margin:14px auto;padding:14mm 13mm 17mm;background:white;box-shadow:0 2px 14px #1d1d1f1c}",
    "h1,h2,h3,p{margin:0}h1{font-size:23pt;line-height:1.18;color:#1d1d1f}h2{font-size:14pt;color:#1d1d1f}",
    ".report-head{border-bottom:2px solid #0071e3;padding-bottom:9px;margin-bottom:13px}",
    ".report-head>p{margin-top:4px;font-size:11pt;font-weight:bold;color:#515154}",
    ".meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px 14px;margin:0 0 8px 0}",
    ".meta div{min-width:0;border-bottom:1px solid #d2d2d7;padding-bottom:5px}",
    "dt{font-size:9pt;color:#6e6e73}dd{margin:0;font-weight:bold;overflow-wrap:anywhere}",
    ".summary{margin:0 0 12px;padding:7px 9px;background:#f5f5f7;color:#515154}",
    ".paper-section{margin-top:16px}.paper-section h2{border-bottom:1px solid #d2d2d7;padding-bottom:4px;margin-bottom:7px}",
    ".record{border:1px solid #d2d2d7;border-radius:4px;margin-bottom:6px;padding:7px 9px}",
    ".record.objective,.record.short-open{break-inside:avoid}.record.open{border-left:2px solid #0071e3}",
    ".record header{break-inside:avoid;break-after:avoid;margin-bottom:4px}.record h3{font-size:9pt;color:#515154}",
    ".record .prompt{font-size:10pt;color:#1d1d1f;font-weight:bold;overflow-wrap:anywhere}",
    ".answers{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}",
    ".answers .item{min-width:0;border-top:1px solid #e6e6eb;padding-top:4px}",
    ".item-title{font-weight:bold;font-size:8.7pt;color:#515154;break-after:avoid}",
    ".value{white-space:pre-wrap;overflow-wrap:anywhere;orphans:2;widows:2}",
    ".item .status{margin-top:2px;font-size:8.5pt;color:#6e6e73}.item .status.needs{color:#a42b3b}",
    ".item .clip{margin-top:4px;font-size:8.5pt;color:#515154;break-inside:avoid}.item audio{width:100%;height:34px;margin-top:2px}",
    ".open .answers{display:block}.open .item+.item{margin-top:5px}.open .item-title{margin-bottom:2px}",
    "@media screen and (max-width:650px){.paper{margin:0 auto;padding:18px 13px;min-height:100vh}.meta{grid-template-columns:1fr 1fr}.answers{grid-template-columns:1fr}.record{margin-bottom:8px}}",
    "@page{size:A4;margin:14mm 13mm 16mm;@bottom-left{content:'UNLOCK 作答单';color:#6e6e73;font:8pt 'Microsoft YaHei',sans-serif}@bottom-right{content:'第 ' counter(page) ' 页';color:#6e6e73;font:8pt 'Microsoft YaHei',sans-serif}}",
    "@media print{html,body{background:#fff}.tools,.item audio{display:none}.paper{width:auto;max-width:none;min-height:0;padding:0;margin:0;box-shadow:none}.report-head,.meta,.summary{break-inside:avoid}.paper-section h2{break-after:avoid}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}}"
  ].join("\n");

  const dateFormat = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  });

  function labelFor(result) {
    return { correct: "答对", incorrect: "答错", blank: "未作答" }[result] || "";
  }

  function summary(questions, attempt) {
    return questions.reduce((total, question) => {
      if (question.type === "open") return { ...total, open: total.open + 1 };
      return {
        objective: total.objective + 1, open: total.open,
        first: total.first + (attempt.first.results[question.id] === "correct" ? 1 : 0),
        second: total.second + (attempt.second.results[question.id] === "correct" ? 1 : 0)
      };
    }, { objective: 0, open: 0, first: 0, second: 0 });
  }

  function recordingPlayer(clip, question, round, reused = false) {
    if (!clip) return "";
    const label = "第 " + question.number + " 题" + round + "录音";
    const info = reused ? "沿用首次录音" : round + "录音";
    return '<div class="clip"><p>' + esc(info) + "　" +
      clipTime(clip.durationMs) + '</p><audio controls preload="none" data-recording="' +
      esc(clip.id) + '" aria-label="' + esc(label) + '"></audio></div>';
  }

  function answerCell(label, value, result = "", needs = false, player = "") {
    const response = value || !player ? '<p class="value">' + esc(value || "未作答") + "</p>" : "";
    return '<div class="item"><p class="item-title">' + esc(label) + "</p>" + response + player +
      (result ? '<p class="status' + (needs ? " needs" : "") + '">' + esc(result) + "</p>" : "") + "</div>";
  }

  function record(question, first, second) {
    const open = question.type === "open";
    const firstValue = first.answers[question.id];
    const secondValue = second.answers[question.id];
    const firstClip = first.recordings?.[question.id];
    const secondClip = second.recordings?.[question.id];
    const firstResult = first.results[question.id];
    const secondResult = second.results[question.id];
    const before = displayAnswer(question, firstValue);
    const after = displayAnswer(question, secondValue);

    const firstCell = answerCell("首次作答", before, open ? "" : labelFor(firstResult),
      !open && firstResult !== "correct", recordingPlayer(firstClip, question, "首次"));
    const changed = before !== after || firstClip?.id !== secondClip?.id;
    const secondLabel = open ? (changed ? "已修改" : "未修改")
      : firstResult === "correct" ? "首次答对，已锁定" : labelFor(secondResult);
    const secondCell = answerCell("二次作答", after, secondLabel, !open && secondResult !== "correct",
      recordingPlayer(secondClip, question, "二次", Boolean(firstClip && firstClip.id === secondClip?.id)));
    const key = open ? "" : answerCell("正确答案", displayKeys(question));
    const compact = before.length + after.length < 650 &&
      [before, after].every(value => value.split("\n").length < 9);
    const style = open ? (compact ? "open short-open" : "open") : "objective";
    return '<article class="record ' + style + '" data-question="' +
      esc(question.id) + '"><header><h3>第 ' + question.number + " 题 " + esc(question.kind) +
      '</h3><p class="prompt">' + esc(question.prompt) + '</p></header><div class="answers">' +
      firstCell + secondCell + key + "</div></article>";
  }

  function embeddedRecordings(audio) {
    if (!Object.keys(audio).length) return "";
    return '<script id="practice-audio" type="application/json">' +
      JSON.stringify(audio).replace(/</g, "\\u003c") + '</script><script>' +
      'const clips=JSON.parse(document.getElementById("practice-audio").textContent);' +
      'for(const player of document.querySelectorAll("audio[data-recording]")){player.src=clips[player.dataset.recording];}' +
      '</script>';
  }

  function html({ student, title, sections, attempt, audio = {} }) {
    const { first, second } = attempt;
    const totals = summary(sections.flatMap(section => section.questions), attempt);
    const fields = [
      ["姓名", student.name], ["英语学习阶段", student.level], ["行政班", student.adminClass],
      ["首次提交", dateFormat.format(new Date(first.time))],
      ["二次提交", dateFormat.format(new Date(second.time))], ["时间", "北京时间"]
    ];
    const details = fields.map(([name, value]) =>
      "<div><dt>" + esc(name) + "</dt><dd>" + esc(value) + "</dd></div>").join("");
    const score = "客观题首次答对 " + totals.first + " / " + totals.objective +
      "，二次答对 " + totals.second + " / " + totals.objective +
      (totals.open ? "。开放题 " + totals.open + " 道，记录两次作答。" : "。");
    const groups = sections.map(section =>
      '<section class="paper-section"><h2>' + esc(section.name) + "</h2>" +
      section.questions.map(q => record(q, first, second)).join("") + "</section>").join("");

    return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      "<title>" + esc(title + " 作答单 " + student.name) + "</title><style>" + styles +
      '</style></head><body><div class="tools"><div>' +
      (Object.keys(audio).length ? "在本页可回听录音。打印版会显示录音标记和时长。"
        : "在打印窗口可选择「另存为 PDF」。") + '</div>' +
      '<button type="button" onclick="window.print()">打印或保存为 PDF</button></div>' +
      '<main class="paper"><header class="report-head"><h1>UNLOCK 作答单</h1><p>' +
      esc(title) + '</p></header><dl class="meta">' + details + '</dl><p class="summary">' +
      esc(score) + "</p>" + groups + "</main>" + embeddedRecordings(audio) + "</body></html>";
  }

  window.UnlockReport = { html, summary };
})();