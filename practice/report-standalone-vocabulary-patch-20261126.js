"use strict";

(function () {
  const { escapeHTML: esc, displayAnswer, displayKeys } = window.UnlockRules;

  const { clipTime, isSpeaking, requiresRecording = isSpeaking } = window.UnlockRecordings;

  const styles = [
    "html{color-scheme:light;background:var(--unlock-shell)}",
    "*{box-sizing:border-box}",
    "body{margin:0;color:var(--unlock-ink);font:10.5pt/1.5 Arial,'PingFang SC','Microsoft YaHei',sans-serif}",
    ".tools{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:10px max(16px,calc((100vw - 210mm)/2));background:var(--unlock-white);color:var(--unlock-secondary);border-bottom:1px solid var(--unlock-line);z-index:2}",
    ".tools div{font-size:13px}.tools button{font:inherit;font-weight:bold;background:var(--unlock-blue);color:var(--unlock-white);border:0;border-radius:24px;padding:7px 12px;cursor:pointer}",
    ".paper{width:210mm;max-width:100%;min-height:297mm;margin:14px auto;padding:14mm 13mm 17mm;background:var(--unlock-white);box-shadow:var(--unlock-float-shadow)}",
    "h1,h2,h3,p{margin:0}h1{font-size:23pt;line-height:1.18;color:var(--unlock-ink)}h2{font-size:14pt;color:var(--unlock-ink)}",
    ".report-head{border-bottom:2px solid var(--unlock-blue);padding-bottom:9px;margin-bottom:13px}",
    ".report-head>p{margin-top:4px;font-size:11pt;font-weight:bold;color:var(--unlock-secondary)}",
    ".meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px 14px;margin:0 0 8px 0}",
    ".meta div{min-width:0;border-bottom:1px solid var(--unlock-line);padding-bottom:5px}",
    "dt{font-size:9pt;color:var(--unlock-secondary)}dd{margin:0;font-weight:bold;overflow-wrap:anywhere}",
    ".summary{margin:0 0 12px;padding:7px 9px;background:var(--unlock-shell);color:var(--unlock-secondary)}",
    ".paper-section{margin-top:16px}.paper-section h2{border-bottom:1px solid var(--unlock-line);padding-bottom:4px;margin-bottom:7px}",
    ".record{border:1px solid var(--unlock-line);border-radius:4px;margin-bottom:6px;padding:7px 9px}",
    ".record.objective,.record.short-open{break-inside:avoid}.record.open{border-left:2px solid var(--unlock-blue)}",
    ".record header{break-inside:avoid;break-after:avoid;margin-bottom:4px}.record h3{font-size:9pt;color:var(--unlock-secondary)}",
    ".record .prompt{font-size:10pt;color:var(--unlock-ink);font-weight:bold;overflow-wrap:anywhere}",
    ".answers{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}",
    ".answers .item{min-width:0;border-top:1px solid var(--unlock-line);padding-top:4px}",
    ".item-title{font-weight:bold;font-size:8.7pt;color:var(--unlock-secondary);break-after:avoid}",
    ".value{white-space:pre-wrap;overflow-wrap:anywhere;orphans:2;widows:2}",
    ".wd-record h3 span{font-size:10pt;color:var(--unlock-ink)}.wd-record header p{font-size:9pt;color:var(--unlock-secondary)}",
    ".wd-report-steps{margin:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}",
    ".wd-report-meaning{grid-column:1/-1}",
    ".wd-report-steps div{border-top:1px solid var(--unlock-line);padding-top:4px;min-width:0}",
    ".wd-report-steps dd{white-space:pre-wrap}.wd-report-steps .wd-report-check{color:var(--unlock-secondary);font-size:8.5pt;font-weight:400}",
    "@media screen and (max-width:520px){.wd-report-steps{grid-template-columns:1fr}}",
    ".item .status{margin-top:2px;font-size:8.5pt;color:var(--unlock-secondary)}.item .status.needs{color:var(--unlock-ink);font-weight:bold}",
    ".item .clip{margin-top:4px;font-size:8.5pt;color:var(--unlock-secondary);break-inside:avoid}.item audio{width:100%;height:34px;margin-top:2px}",
    ".open .answers{display:block}.open .item+.item{margin-top:5px}.open .item-title{margin-bottom:2px}",
    ".question-detail,.report-links{margin:4px 0;color:var(--unlock-secondary)}.question-detail p+p{margin-top:4px}",
    ".homework-vocab-results{list-style:none;margin:6px 0 0;padding:0}",
    ".homework-vocab-results li{display:grid;grid-template-columns:1fr minmax(150px,30%);gap:4px 14px;padding:7px 0;border-bottom:1px solid var(--unlock-line);break-inside:avoid}",
    ".homework-vocab-results li p{margin:2px 0}.homework-vocab-results audio{width:100%;height:35px}",
    ".homework-vocab-results li .vocab-grades{font-size:.88em;color:var(--unlock-secondary)}",
    "@media screen and (max-width:520px){.homework-vocab-results li{grid-template-columns:1fr}}",
    "@media print{.homework-vocab-results li{display:block}.homework-vocab-results .clip{display:none}}",
    ".report-links{display:flex;flex-wrap:wrap;gap:4px 12px}.report-links a,.clip a,.material a{color:var(--unlock-blue)}",
    ".material{margin:9px 0 14px}.material h3{margin-bottom:4px}.material p{white-space:pre-wrap;margin:4px 0}",
    ".material img{max-width:100%;max-height:118mm;object-fit:contain}.material audio{display:block;max-width:100%}",
    "@media screen and (max-width:650px){.paper{margin:0 auto;padding:18px 13px;min-height:100vh}.meta{grid-template-columns:1fr 1fr}.answers{grid-template-columns:1fr}.record{margin-bottom:8px}}",
    "@page{size:A4;margin:14mm 13mm 16mm;@bottom-left{content:'UNLOCK 作答单';color:var(--unlock-secondary);font:8pt 'Microsoft YaHei',sans-serif}@bottom-right{content:'第 ' counter(page) ' 页';color:var(--unlock-secondary);font:8pt 'Microsoft YaHei',sans-serif}}",
    "@media print{html,body{background:var(--unlock-white)}.tools,audio,.clip a,.material-file{display:none}.paper{width:auto;max-width:none;min-height:0;padding:0;margin:0;box-shadow:none}.report-head,.meta,.summary{break-inside:avoid}.paper-section h2{break-after:avoid}*{print-color-adjust:exact;-webkit-print-color-adjust:exact}}"
  ].join("\n");

  function reportStyles() {
    const theme = getComputedStyle(document.documentElement);
    const names = ["white", "blue", "shell", "line", "ink", "secondary", "float-shadow"];
    const declarations = names.map(name => {
      const property = "--unlock-" + name;
      return property + ":" + theme.getPropertyValue(property).trim();
    }).join(";");
    return ":root{" + declarations + "}\n" + styles;
  }

  const dateFormat = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  });

  function labelFor(result) {
    return { correct: "答对", incorrect: "答错", blank: "未作答" }[result] || "";
  }

  function summary(questions, attempt) {
    return questions.reduce((total, question) => {
      if (question.homeworkDictation) return total;
      if (question.type === "open") return { ...total, open: total.open + 1 };
      return {
        objective: total.objective + 1, open: total.open,
        first: total.first + (attempt.first.results[question.id] === "correct" ? 1 : 0),
        second: total.second + (attempt.second.results[question.id] === "correct" ? 1 : 0)
      };
    }, { objective: 0, open: 0, first: 0, second: 0 });
  }

  const recordingExtensions = {
    "audio/mp4": "m4a", "audio/webm": "webm", "audio/ogg": "ogg",
    "audio/wav": "wav", "audio/mpeg": "mp3", "audio/aac": "aac"
  };

  function takeLabel(stage) {
    return stage === "主动重录" ? stage : stage + "录音";
  }

  function makeDocument({
    student, title, worksheet = {}, sections, attempt, dictationItems = [],
    tracks = {}, groupAudio, homeworkVocabulary, bundled = false
  }) {
    const { first, second, wordDictation, selfCheckedAt, completedAt } = attempt;
    const words = window.UnlockWordDictation;
    const wordItems = wordDictation ? dictationItems.filter(item => words.complete(item, wordDictation))
      .map(item => words.recordedItem(item, wordDictation[item.id])) : [];
    const wordsById = new Map(wordItems.map(item => [item.id, item]));
    const media = new Map();
    const recordings = new Map();
    const files = [];

    function material(key, entry) {
      if (!media.has(key)) {
        const number = media.size + 1;
        media.set(key, { id: "material-" + number, number, ...entry });
      }
      return media.get(key).id;
    }

    function mediaFile(kind, label, source) {
      const key = kind + ":" + source;
      if (!media.has(key)) {
        const extension = source?.match(/\.([a-z0-9]+)$/i)?.[1].toLowerCase();
        if (!extension) throw new Error("找不到" + label + "的题目资料。");
        const path = "题目资料/" + kind + "-" + (media.size + 1) + "." + extension;
        files.push({ path, source, label });
        return material(key, { kind, label, path });
      }
      return media.get(key).id;
    }

    function studentRecording(clip, question, stage, vocabularyWord) {
      if (!clip) return null;
      if (!recordings.has(clip.id)) {
        const entry = { id: clip.id, mime: clip.mime, durationMs: clip.durationMs, size: clip.size };
        if (bundled) {
          const item = vocabularyWord ?? (question.wordCard ? "词卡 " + question.vocabulary.position : "第 " + question.number + " 题");
          const label = item + takeLabel(stage);
          const extension = recordingExtensions[clip.mime?.split(";")[0].toLowerCase()];
          if (!extension) throw new Error(label + "的文件格式无法识别。");
          entry.path = "录音/" + label + "." + extension;
          files.push({ path: entry.path, label, size: entry.size, recordingId: clip.id });
        }
        recordings.set(clip.id, entry);
      }
      return recordings.get(clip.id);
    }

    function questionMaterials(section, question, item) {
      if (!bundled) return [];
      const ids = [];
      const article = section.articles ? section.articles[question.article] : section;
      if (article?.passages?.length) {
        const label = article.passageTitle || "阅读原文";
        ids.push(material(article, { kind: "passage", label, passages: article.passages }));
      }
      if (question.picture) {
        const label = question.wordCard ? question.prompt + " 词卡配图" : "第 " + question.number + " 题配图";
        ids.push(mediaFile("image", label, question.picture));
      }
      for (const option of question.pictureOptions || []) {
        if (option.picture) ids.push(mediaFile("image", "词汇配对图片", option.picture));
      }
      if (question.wordCard?.wordAudio) ids.push(mediaFile("audio", question.prompt + " 单词示范", question.wordCard.wordAudio));
      if (question.wordCard?.exampleAudio) ids.push(mediaFile("audio", question.prompt + " 例句示范", question.wordCard.exampleAudio));
      if (item) {
        ids.push(mediaFile("audio", "第 " + item.number + " 题单词音频", words.audioPath(item)));
      } else {
        if (groupAudio && question.kind === "单词听写") {
          ids.push(mediaFile("audio", "整组听写录音", groupAudio));
        }
        for (const trackId of question.audio || []) {
          const track = tracks[trackId];
          ids.push(mediaFile("audio", track?.label || "第 " + question.number + " 题原题音频", track?.file));
        }
      }
      return [...new Set(ids)];
    }

    function response(question, round, clip) {
      if (!round) return null;
      const value = round.answers[question.id] ?? null;
      return { value, text: displayAnswer(question, value), result: round.results[question.id] ?? null, recording: clip };
    }

    const groups = sections.map(section => ({
      name: section.name,
      questions: section.questions.map(question => {
        const { id, number } = question;
        const item = wordsById.get(id);
        const materialIds = questionMaterials(section, question, item);
        if (item) {
          const dictation = wordDictation[id];
          return {
            id, number, type: "dictation", kind: "单词听写", prompt: item.word,
            answerKey: { accepted: item.keys, text: item.word, ipa: item.ipa, language: item.locale }, materialIds,
            dictation: { attempts: dictation.attempts, syllables: dictation.syllables ?? null,
              plays: Number(dictation.plays) || 0, outcome: words.outcome(dictation),
              ...(dictation.meaning ? { meaning: dictation.meaning } : {}) }
          };
        }
        const open = question.type === "open";
        const speaking = isSpeaking(question);
        const original = first?.recordings?.[id];
        const revised = second?.recordings?.[id];
        if (bundled && requiresRecording(question) && (!original || !revised)) {
          const stage = original ? "完成时" : "首次";
          const label = question.wordCard ? "词卡 " + question.prompt : "第 " + number + " 题";
          throw new Error(label + "缺少" + stage + "录音。请在原作答浏览器中重试。");
        }
        const firstResponse = response(question, first, studentRecording(original, question, "首次"));
        const finalResponse = response(question, second, studentRecording(revised, question, selfCheckedAt ? "主动重录" : "二次"));
        const fields = ["instruction", "notes", "options", "pick", "bank", "summary",
          "responsePrefix", "fixedStart", "orderedSentences", "matchCase", "vocabulary"];
        const context = Object.fromEntries(fields.filter(field => question[field] !== undefined)
          .map(field => [field, question[field]]));
        if (question.wordCard) {
          const { example, exampleMark, pos, ipa, definition } = question.wordCard;
          context.wordCard = { word: question.prompt, example, exampleMark, pos, ipa, definition };
        }
        if (question.pictureOptions) {
          context.pictureOptions = question.pictureOptions.map(({ key, text, picture }) => ({
            key, text, materialId: picture ? media.get("image:" + picture)?.id : undefined
          }));
        }
        const examples = (question.notes || []).filter(note => /^(?:model|example|sample|参考答案|参考表达|范例)\s*[:：]/i.test(note));
        const correctedKeys = second?.legacyDictationKeys?.[id];
        const reference = correctedKeys ? { ...question, keys: correctedKeys } : question;
        return {
          id, number, type: question.type, kind: question.kind, prompt: question.prompt, ...context, materialIds,
          textRole: question.wordCard ? "wordCardReading" : speaking && open ? "speakingNotes" : "answer",
          ...(examples.length ? { referenceExamples: examples } : {}),
          answerKey: open ? null : { accepted: reference.keys, text: displayKeys(reference) },
          first: firstResponse, final: finalResponse,
          selfCheck: selfCheckedAt && (open || speaking) ? {
            completedAt: selfCheckedAt,
            answerChanged: JSON.stringify(firstResponse?.value) !== JSON.stringify(finalResponse?.value),
            recordingChanged: Boolean(original && revised && original.id !== revised.id)
          } : null
        };
      })
    }));
    const vocabulary = homeworkVocabulary ? window.UnlockHomeworkVocabulary.results(
      homeworkVocabulary.bank, homeworkVocabulary.saved, (clip, card, position, part) => {
        if (bundled && !clip) {
          throw new Error("词汇「" + card.word + "」缺少" + part + "录音。请在原作答浏览器中重试。");
        }
        return studentRecording(clip, null, part, "词汇第 " + position + " 词");
      }
    ) : null;
    const data = {
      schemaVersion: 1,
      worksheet: { ...worksheet, title },
      student: { name: student.name, level: student.level, adminClass: student.adminClass },
      submission: { firstAt: first?.time ?? null, finalAt: second?.time ?? null,
        completedAt: completedAt ?? second?.time ?? null, selfCheckedAt: selfCheckedAt ?? null },
      totals: first && second ? summary(sections.flatMap(section => section.questions), attempt) : null,
      dictationSummary: wordItems.length ? words.summary(wordItems, wordDictation) : "",
      ...(vocabulary ? { homeworkVocabulary: vocabulary } : {}),
      sections: groups,
      materials: [...media.values()]
    };
    return { data, files };
  }

  function recordingPlayer(clip, question, round, reused = false) {
    if (!clip) return "";
    const item = question.wordCard ? question.wordCard.word + " 词卡" : "第 " + question.number + " 题";
    const label = item + takeLabel(round);
    const info = reused ? "沿用首次录音" : takeLabel(round);
    const file = clip.path ? ' src="' + esc(clip.path) + '"' : "";
    const download = clip.path ? '<a href="' + esc(clip.path) + '" download>保存录音文件</a>' : "";
    return '<div class="clip"><p>' + esc(info) + "　" +
      clipTime(clip.durationMs) + '</p><audio controls preload="none" data-recording="' +
      esc(clip.id) + '" aria-label="' + esc(label) + '"' + file + '></audio>' + download + '</div>';
  }

  function answerCell(label, value, result = "", needs = false, player = "", notes = false) {
    const noteLabel = notes && value ? '<p class="status">口语笔记</p>' : "";
    const response = value || !player ? '<p class="value">' + esc(value || "未作答") + "</p>" : "";
    return '<div class="item"><p class="item-title">' + esc(label) + "</p>" + noteLabel + response + player +
      (result ? '<p class="status' + (needs ? " needs" : "") + '">' + esc(result) + "</p>" : "") + "</div>";
  }

  function materialLinks(question, materials) {
    if (!question.materialIds.length) return "";
    return '<nav class="report-links" aria-label="题目资料">' + question.materialIds.map(id => {
      const { number, label } = materials.get(id);
      return '<a href="#' + esc(id) + '">资料 ' + number + ' ' + esc(label) + '</a>';
    }).join("") + '</nav>';
  }

  function questionDetails(question) {
    const blocks = [question.instruction, ...(question.notes || []), ...(question.summary || [])]
      .filter(Boolean).map(line => '<p>' + esc(line) + '</p>');
    if (question.wordCard) {
      blocks.push('<p lang="en-GB"><strong>Example</strong> ' + esc(question.wordCard.example) + '</p>');
    }
    if (question.pictureOptions) {
      const choices = question.pictureOptions.map(({ key, text, materialId }) => '<li>' + esc(key) + ' ' +
        (materialId ? '<a href="#' + esc(materialId) + '">图片</a>' : esc(text)) + '</li>');
      blocks.push('<ul>' + choices.join("") + '</ul>');
    }
    for (const choices of [question.pictureOptions ? null : question.options, question.bank]) {
      if (choices?.length) {
        blocks.push('<ul>' + choices.map(([id, value]) =>
          '<li>' + esc(id === value ? id : id + ' ' + value) + '</li>').join("") + '</ul>');
      }
    }
    return blocks.length ? '<div class="question-detail">' + blocks.join("") + '</div>' : "";
  }

  function record(question, materials) {
    const links = materialLinks(question, materials);
    if (question.dictation) {
      return window.UnlockWordDictation.recordHTML(
        { id: question.id, number: question.number, word: question.prompt }, question.dictation, links);
    }
    const open = question.type === "open";
    const { first, final, selfCheck } = question;
    const before = first?.text || "";
    const after = final?.text || "";
    const firstClip = first?.recording;
    const secondClip = final?.recording;
    const firstResult = first?.result;
    const secondResult = final?.result;
    const reused = Boolean(firstClip && firstClip.id === secondClip?.id);
    const notes = question.textRole === "speakingNotes";

    const firstCell = answerCell("首次作答", before, open ? "" : labelFor(firstResult),
      !open && firstResult !== "correct", recordingPlayer(firstClip, question, "首次"), notes);
    const changed = before !== after || firstClip?.id !== secondClip?.id;
    const reviewLabel = secondClip ? "" : changed ? "主动修改" : before ? "保留原稿" : "未作答";
    const secondLabel = open ? (selfCheck ? reviewLabel : changed ? "已修改" : "未修改")
      : firstResult === "correct" ? "首次答对，已锁定" : labelFor(secondResult);
    const secondCell = answerCell(open && selfCheck ? "自检后作答" : "二次作答", after,
      secondLabel, !open && secondResult !== "correct",
      recordingPlayer(secondClip, question, selfCheck && !reused ? "主动重录" : "二次", reused), notes);
    const key = open ? "" : answerCell("正确答案", question.answerKey.text);
    const compact = before.length + after.length < 650 &&
      [before, after].every(value => value.split("\n").length < 9);
    const style = open ? (compact ? "open short-open" : "open") : "objective";
    return '<article class="record ' + style + '" data-question="' +
      esc(question.id) + '"><header><h3>第 ' + question.number + " 题 " + esc(question.kind) +
      '</h3><p class="prompt">' + esc(question.prompt) + '</p></header>' +
      questionDetails(question) + links + '<div class="answers">' +
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

  function renderMaterial(item) {
    const path = esc(item.path || "");
    let content;
    if (item.kind === "passage") {
      content = item.passages.map(({ label, text }) => '<p lang="en"><strong>' + esc(label) + '</strong> ' + esc(text) + '</p>').join("");
    } else if (item.kind === "image") {
      content = '<img src="' + path + '" alt="' + esc(item.label) + '">';
    } else {
      content = '<audio controls preload="none" src="' + path + '" aria-label="' + esc(item.label) +
        '"></audio><a class="material-file" href="' + path + '" download>保存原题音频</a>';
    }
    return '<section class="material" id="' + esc(item.id) + '"><h3>资料 ' + item.number + ' ' +
      esc(item.label) + '</h3>' + content + '</section>';
  }

  function renderHomeworkVocabulary(vocabulary) {
    const { scores, items } = vocabulary;
    const summary = scores.map(({ name, firstCorrect, total }) =>
      esc(name) + "首答 " + firstCorrect + " / " + total).join("，");
    const detail = items.map(item => {
      const grades = scores.map(({ id, name }) => {
        const responses = item.responses[id];
        const outcome = responses[0]?.correct ? "首答正确" : responses[1]?.correct ? "重试正确" :
          responses.length ? "答错" : "未作答";
        return esc(name) + " " + outcome;
      }).join("，");
      const target = { wordCard: { word: item.word } };
      const clip = recordingPlayer(item.recording, target, "朗读") +
        recordingPlayer(item.recordings?.word, target, "单词") +
        recordingPlayer(item.recordings?.example, target, "例句");
      return '<li><div><strong lang="en-GB">' + esc(item.word) + '</strong><p lang="en-GB">' + esc(item.example) +
        '</p><p class="vocab-grades">' + grades + '</p></div>' + clip + '</li>';
    }).join("");
    return '<section class="paper-section"><h2>词汇学练</h2><p>' + summary +
      '。</p><ol class="homework-vocab-results">' + detail + '</ol></section>';
  }

  function render(data, audio = {}) {
    const { student, worksheet, sections, submission, totals, dictationSummary, materials, homeworkVocabulary } = data;
    const { title } = worksheet;
    const fields = [
      ["姓名", student.name], ["英语学习阶段", student.level], ["行政班", student.adminClass]
    ];
    const date = time => time && Number.isFinite(Date.parse(time)) ? dateFormat.format(new Date(time)) : "未记录";
    if (totals) {
      fields.push(["首次提交", date(submission.firstAt)],
        [submission.selfCheckedAt ? "完成自检" : "二次提交", date(submission.finalAt)], ["时间", "北京时间"]);
    } else if (submission.completedAt) {
      fields.push(["完成时间", date(submission.completedAt)], ["时间", "北京时间"]);
    }
    const details = fields.map(([name, value]) =>
      "<div><dt>" + esc(name) + "</dt><dd>" + esc(value) + "</dd></div>").join("");
    const scores = [];
    if (totals) {
      if (totals.objective) scores.push("客观题首次答对 " + totals.first + " / " + totals.objective +
        "，二次答对 " + totals.second + " / " + totals.objective +
        (dictationSummary ? "（听写按完整拼写计）。" : "。"));
      if (totals.open) scores.push("开放题 " + totals.open + " 道，" +
        (submission.selfCheckedAt ? "已完成自检。" : "记录两次作答。"));
    }
    if (dictationSummary) scores.push("听写" + dictationSummary);
    if (homeworkVocabulary) scores.push("词汇首答正确 " + homeworkVocabulary.firstCorrect + " / " + homeworkVocabulary.total + "。");
    const lookup = new Map(materials.map(item => [item.id, item]));
    const groups = sections.map(section =>
      '<section class="paper-section"><h2>' + esc(section.name) + "</h2>" +
      section.questions.map(q => record(q, lookup)).join("") + "</section>").join("");
    const sources = materials.length ? '<section class="paper-section"><h2>题目资料</h2>' +
      materials.map(renderMaterial).join("") + "</section>" : "";
    const hasAudio = Object.keys(audio).length || homeworkVocabulary?.items.some(item =>
      item.recording || item.recordings?.word || item.recordings?.example) || sections.some(section =>
      section.questions.some(q => q.first?.recording?.path || q.final?.recording?.path));

    return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      "<title>" + esc(title + " 作答单 " + student.name) + "</title><style>" + reportStyles() +
      '</style></head><body><div class="tools"><div>' +
      (hasAudio ? "在本页可回听录音。请将本页与录音文件一同保留。"
        : "在打印窗口可选择「另存为 PDF」。") + '</div>' +
      '<button type="button" onclick="window.print()">打印或保存为 PDF</button></div>' +
      '<main class="paper"><header class="report-head"><h1>UNLOCK 作答单</h1><p>' +
      esc(title) + '</p></header><dl class="meta">' + details + '</dl><p class="summary">' +
      scores.map(esc).join("<br>") + "</p>" + (homeworkVocabulary ? renderHomeworkVocabulary(homeworkVocabulary) : "") +
      groups + sources + "</main>" + embeddedRecordings(audio) + "</body></html>";
  }

  function html(options) {
    return render(makeDocument(options).data, options.audio);
  }

  function prepare(options) {
    return makeDocument({ ...options, bundled: true });
  }

  window.UnlockReport = { html, summary, prepare, render };
})();
