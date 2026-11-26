"use strict";

const unit6PilotAssetRoot = new URL(".", document.currentScript.src);
const unit6Track61 = [
  {"start": 0.0, "end": 3.4, "en": "Unit six, six point one.", "zh": "第六单元，音轨 6.1。"},
  {"start": 3.4, "end": 6.68, "en": "Welcome to the Museum of Science.", "zh": "欢迎来到科学博物馆。"},
  {"start": 7.36, "end": 13.42, "en": "The exhibition that we're about to see is called Discovering Medieval Science.", "zh": "我们即将参观的展览名叫《探索中世纪科学》。"},
  {"start": 14.14, "end": 20.06, "en": "As some of you may know, the Middle Ages have often been called the Dark Ages.", "zh": "你们中有些人可能知道，中世纪常被称作黑暗时代。"},
  {"start": 20.92, "end": 25.56, "en": "During this tour, you will find out that they were not.", "zh": "在这次参观中，你们会发现事实并非如此。"},
  {"start": 25.56, "end": 33.52, "en": "The Middle Ages were an interesting time and they were full of scientific discoveries.", "zh": "中世纪是个有趣的时代，那时有许多科学发现。"},
  {"start": 34.92, "end": 45.62, "en": "During this time, inventions and technology from India, China, North Africa and the Middle East were brought to Europe.", "zh": "在此期间，印度、中国、北非和中东的发明与技术传入了欧洲。"},
  {"start": 46.94, "end": 58.02, "en": "Inventions and machines designed by medieval scholars made a great contribution to society and many are still in use today.", "zh": "中世纪学者设计的发明和机器为社会作出了重大贡献，其中许多至今仍在使用。"},
  {"start": 58.8, "end": 62.42, "en": "And some of these inventions are very common.", "zh": "其中一些发明如今十分常见。"},
  {"start": 63.22, "end": 70.6, "en": "For example, the first fountain pen was made in 953 in Africa.", "zh": "例如，第一支自来水笔于 953 年在非洲制成。"},
  {"start": 71.66, "end": 76.86, "en": "Before then, people used bird feathers and ink to write with.", "zh": "在那之前，人们用鸟羽和墨水写字。"},
  {"start": 77.8, "end": 83.78, "en": "This method would often leave your fingers and clothes covered with black ink.", "zh": "这种写法常常把人的手指和衣服弄得满是黑墨水。"},
  {"start": 83.78, "end": 97.14, "en": "So the first fountain pen had a small container with ink inside and did not stain people's clothes or fingers while the user was writing.", "zh": "所以，第一支自来水笔里面有一个装墨水的小容器，写字时便不会弄脏衣服或手指。"},
  {"start": 98.46, "end": 103.8, "en": "You can see a model of this fountain pen in room 11b.", "zh": "你们可以在 11b 展室看到这支自来水笔的模型。"},
  {"start": 104.16, "end": 108.5, "en": "In the same room, you'll find early examples of glasses.", "zh": "在同一间展室，还能看到早期的眼镜。"},
  {"start": 108.5, "end": 113.8, "en": "Glasses were invented in Italy in the 13th century.", "zh": "眼镜于 13 世纪在意大利发明。"},
  {"start": 114.62, "end": 117.04, "en": "No one knows who invented them.", "zh": "没有人知道是谁发明了眼镜。"},
  {"start": 117.58, "end": 123.26, "en": "The first glasses were held in front of the eyes or balanced on the nose.", "zh": "最早的眼镜要么拿在眼睛前面，要么架在鼻梁上。"},
  {"start": 124.3, "end": 128.28, "en": "They were developed to help people with bad vision to read.", "zh": "人们设计眼镜，是为了帮助视力不好的人阅读。"},
  {"start": 129.26, "end": 133.18, "en": "But let's now move on to some other inventions.", "zh": "接下来，让我们看看其他几项发明。"},
  {"start": 134.06, "end": 143.0, "en": "In rooms 12a and 12b, we have works by the great medieval engineer Al-Jazari.", "zh": "12a 和 12b 展室陈列着中世纪杰出工程师贾扎里的作品。"},
  {"start": 143.98, "end": 147.66, "en": "Al-Jazari lived in 12th century Turkey.", "zh": "贾扎里生活在 12 世纪的土耳其。"},
  {"start": 148.42, "end": 162.48, "en": "His work, The Book of Knowledge of Ingenious Mechanical Devices, lists 100 different machines with instructions and diagrams explaining how to build them.", "zh": "他的著作《精巧机械装置知识》列举了 100 种不同的机器，并用说明和图解讲解如何制作。"},
  {"start": 163.54, "end": 170.14, "en": "In this exhibition, you can see models of some of the devices which were designed by Al-Jazari.", "zh": "在这次展览中，你们可以看到贾扎里所设计的部分装置的模型。"},
  {"start": 171.14, "end": 174.36, "en": "Here you can see his mechanical clocks.", "zh": "在这里，你们可以看到他设计的机械钟。"},
  {"start": 175.5, "end": 179.28, "en": "Water and weights make the clocks work.", "zh": "水和配重驱动这些钟运转。"},
  {"start": 179.28, "end": 184.78, "en": "However, his most important invention was the crankshaft.", "zh": "不过，他最重要的发明是曲轴。"},
  {"start": 185.74, "end": 192.1, "en": "The crankshaft is a long arm which allows machines to move in a straight line.", "zh": "曲轴是一根长杆，能让机器做直线运动。"},
  {"start": 193.02, "end": 198.12, "en": "It was first used for watering gardens and fields on farms.", "zh": "它最早用来给花园和农田浇水。"},
  {"start": 199.12, "end": 203.94, "en": "In more modern times, a crankshaft is used in car engines.", "zh": "到了现代，汽车发动机里也用上了曲轴。"},
  {"start": 205.02, "end": 211.48, "en": "As we move along, you'll find one of the most important inventions of medieval times.", "zh": "继续往前走，你们会看到中世纪最重要的发明之一。"},
  {"start": 212.42, "end": 219.1, "en": "This invention has changed the history of the world in ways that we can't even imagine.", "zh": "这项发明以我们难以想象的方式改变了世界历史。"},
  {"start": 220.18, "end": 226.38, "en": "It's one of the four great inventions of Chinese culture, gunpowder.", "zh": "它是中国四大发明之一，名叫火药。"},
  {"start": 226.38, "end": 238.28, "en": "Gunpowder was invented in the 9th century by Chinese scientists who were trying to create a powder which would make you live forever.", "zh": "9 世纪，中国科学家想制出一种能让人长生不老的粉末，由此发明了火药。"},
  {"start": 239.36, "end": 247.88, "en": "They weren't successful, of course, but their attempts led to the invention of fireworks and weapons.", "zh": "当然，他们没能找到长生不老的方法，但这番尝试促成了烟花和武器的发明。"},
  {"start": 248.82, "end": 260.84, "en": "The first instructions on how to make gunpowder were written in the 11th century by Zeng Gongliang, Ding Du and Yang Wei De.", "zh": "最早的火药制作说明由曾公亮、丁度和杨惟德于 11 世纪写成。"},
  {"start": 262.04, "end": 266.96, "en": "The invention of gunpowder has changed the way we fight wars.", "zh": "火药的发明改变了作战方式。"},
  {"start": 267.9, "end": 275.22, "en": "It changed the outcome of many medieval battles and affected the history of the world.", "zh": "它改变了许多中世纪战役的结果，也影响了世界历史。"},
  {"start": 275.22, "end": 282.68, "en": "Many people think gunpowder is the most important invention in history.", "zh": "许多人认为火药是历史上最重要的发明。"},
  {"start": 284.28, "end": 289.4, "en": "Now, let's move to the next room, which is all about medieval medicine.", "zh": "现在，我们去下一个展室，那里介绍的是中世纪医学。"}
];

function createUnit6Pilot({cases}) {
  const unit = "B03-LS-U06";
  const knowledgeId = unit + "-question:b4639";
  const photoId = unit + "-question:b4642";
  const summaryId = unit + "-question:b4647";
  const listeningPhotosId = unit + "-question:b4652";
  const strongFormsId = unit + "-question:b4664";
  const inventionsId = unit + "-question:b4666";
  const passiveExtractsId = unit + "-question:b4676";
  const ideasMapId = unit + "-question:b4707";
  const speakingOrderId = unit + "-question:b4725";
  const numberedCopy = new Set([listeningPhotosId, strongFormsId, inventionsId, passiveExtractsId, ideasMapId]);
  const listeningFillId = unit + "-question:b4653";
  const listeningMatchId = unit + "-question:b4654";
  const listeningMainId = unit + "-question:b4656";
  const listeningNotesId = unit + "-question:b4657";
  const listeningReferencesId = unit + "-question:b4661";
  const rewatchId = unit + "-question:b4648";
  const rewatchCase = cases.find(c => c.id === rewatchId);
  const wholeRewatch = rewatchCase.coursePages.flatMap((_, p) => coursePageBlocks(rewatchCase, p));
  const inventions = cases.find(c => c.id === inventionsId);
  const inventionQuestions = inventions.coursePages.flatMap((_, p) => coursePageBlocks(inventions, p));
  const listeningFill = cases.find(c => c.id === listeningFillId);
  const listeningBank = listeningFill.items[0].options;
  const listeningRows = listeningFill.coursePages
    .flatMap((_, p) => coursePageBlocks(listeningFill, p))
    .filter(block => block.kind === "item");
  if (listeningBank.length !== 8 || listeningRows.length !== 8 ||
      listeningRows.some(row => row.answer?.mode !== "gap")) {
    throw new Error("Listening 1 Ex 2 的词库或答位已经变化。");
  }
  if (wholeRewatch.length !== 4) {
    throw new Error("Unit 6 试排的复看题已变化。");
  }

  const listeningMatch = cases.find(c => c.id === listeningMatchId);
  const listeningMatchRows = listeningMatch.coursePages
    .flatMap((_, p) => coursePageBlocks(listeningMatch, p))
    .filter(block => block.kind === "item")
    .map(({label,prompt,options,answer}) => ({label,prompt,letter:options?.[answer?.option]}));
  if (listeningMatchRows.length !== 4 ||
      listeningMatchRows.some(({label,letter}, i) => label !== String(i+1) || !/^[a-d]$/.test(letter)) ||
      new Set(listeningMatchRows.map(row => row.letter)).size !== 4) {
    throw new Error("Listening 1 Ex 3 的图文匹配题或答案已变化。");
  }

  const listeningNotes = cases.find(c => c.id === listeningNotesId);
  const listeningNotesBlocks = listeningNotes.coursePages.flatMap((_,p) => coursePageBlocks(listeningNotes,p));


  const cards = cases.filter(c => c.flow?.kind === "cards").flatMap(c => c.flow.pages.flat());
  const allow = cards.find(w => w.term === "allow");
  const oldAllow = allow.visual.src;
  allow.visual = {
    src: new URL("allow.png", unit6PilotAssetRoot).href,
    alt: "旅客和车站工作人员用手机里的实时翻译应用沟通"
  };
  for (const c of cases.filter(c => c.flow?.kind === "match")) {
    for (const p of c.flow.pages) {
      p.visuals = p.visuals.map(visual => visual.src === oldAllow ? allow.visual : visual);
    }
  }

  function numberedInstruction(c) {
    const number=classroomExerciseNumber(c);
    if (!number) return instructionHTML(c);
    const label = '<span class="u6-ex-number" aria-label="Exercise '+esc(number)+'">'+esc(number)+'</span>';
    return '<div class="u6-instruction">'+label+instructionHTML(c,false)+'</div>';
  }

  function projectionInstruction(c) {
    if (c.flow?.kind === "skills") {
      return '<h1 class="instruction u6-skill-title" data-original-instruction lang="en-GB">'+esc(c.instruction)+'</h1>';
    }
    if (c.id === knowledgeId || c.id === photoId) return "";
    return numberedInstruction(c);
  }

  function split(copy, visual, variant) {
    return '<div class="u6-split u6-split-'+variant+'">'+copy+visual+'</div>';
  }

  function originalPage(c) {
    return courseSourceImage({src:c.sourceImages[0]}, "教材第 "+c.pages[0]+" 页原页");
  }

  function photoCard(src, left, number) {
    const photo = {src, nativeWidth:772, box:[left,70,332,215], alt:"Photo "+number};
    return '<figure class="u6-photo-card" data-u6-photo="'+number+'">'+cropHTML(photo)+'</figure>';
  }

  function photos(c) {
    const first = c.sourceImages[0];
    const second = "https://raw.githubusercontent.com/chaoimhinalmansour/unlockanswers.github.io/c735105a953f4d8574afdae6c989e097094dd043/content/65e7fda8da0d73fa4bbd182877105fcfd1ea996d383bc6e88c0e603372f86dd5.png";
    return '<aside class="u6-photo-area" aria-label="教材照片">'
      +photoCard(first,48,1)+photoCard(first,394,2)
      +photoCard(second,48,3)+photoCard(second,394,4)+'</aside>';
  }

  function listeningPhotos(c) {
    const {src, width:nativeWidth} = c.courseVisuals[0];
    const images = [
      {box:[122,186,222,143], alt:"Paper money"},
      {box:[357,186,160,143], alt:"A cannon"},
      {box:[530,186,160,143], alt:"A mechanical clock"}
    ];
    return '<aside class="u6-invention-photos" aria-label="教材照片">'
      +images.map(photo=>'<figure class="u6-photo-card">'+cropHTML({...photo,src,nativeWidth})+'</figure>').join("")
      +'</aside>';
  }

  const inventionPhotos = [
    {"file":"p132-compass-textbook-300dpi.jpg","width":648,"height":528,"alt":"Brass pocket compass"},
    {"file":"p132-making-paper-textbook-300dpi.jpg","width":648,"height":528,"alt":"A sheet of handmade paper with rolled paper"},
    {"file":"p132-printing-textbook-300dpi.jpg","width":648,"height":528,"alt":"Woodblock printing plate on printed paper"},
  ];

  function inventionsPhotoGallery() {
    const photos = inventionPhotos.map(({file,width,height,alt}) =>
      '<figure class="u6-photo-card"><img src="../../media/lesson-art/B03-LS-U06/'+esc(file)+
      '" width="'+width+'" height="'+height+'" alt="'+esc(alt)+'" decoding="async"></figure>'
    );
    return '<aside class="u6-discussion-photos" aria-label="教材照片">'+photos.join("")+'</aside>';
  }

  function inventionsDiscussion() {
    const questions = inventionQuestions.map(courseBlockHTML).join("");
    return '<div class="u6-discussion" lang="en-GB">'+inventionsPhotoGallery()+
      '<div class="course-exercise-copy">'+questions+'</div></div>';
  }

  function listeningMatchProjection() {
    const {src, width:nativeWidth} = listeningMatch.courseVisuals[0];
    const photos = [
      {label:"a", box:[82,190,294,152], alt:"A small pile of dark powder beside a match"},
      {label:"b", box:[391,184,294,152], alt:"A metal shaft with offset weights"},
      {label:"c", box:[82,375,294,152], alt:"Round frames with clear lenses"},
      {label:"d", box:[391,375,294,152], alt:"A pen beside an ink bottle and paper"}
    ];
    const figures = photos.map(({label,box,alt}) =>
      '<figure data-match-photo="'+label+'">'+flowVisualHTML({src,nativeWidth,box,alt})+
      '<figcaption>'+label+'</figcaption></figure>').join("");
    const questions = listeningMatchRows.map(({label,prompt,letter}) =>
      '<div class="flow-match-row"><span class="num">'+esc(label)+'</span><p>'+esc(prompt)+'</p>'+
      '<span class="inline-anchor" data-field="status"><span data-course-answer-target>'+esc(letter)+
      '</span></span></div>').join("");
    return '<div class="u6-listening-match" lang="en-GB">'+
      '<div class="flow-match-pictures" data-match-columns="4">'+figures+'</div>'+
      '<div class="flow-questions">'+questions+'</div></div>';
  }

  function glossary(entries) {
    const rows = Math.ceil(entries.length / 2);
    const words = window.UNLOCK_WORD_PRONUNCIATION;
    const recordings = window.UNLOCK_TASK_GLOSSARY_AUDIO;
    const body = entries.map(({term, pos, definition, wordAudio, cardWord}, i) => {
      const clip = cardWord ? words.entries[wordAudio].audio : recordings.words[wordAudio];
      const word = wordCardAudioHTML("word", "Word", "Play word pronunciation for "+term, clip);
      return '<div class="flow-glossary-entry"'+(i%rows===0 ? ' data-column-start' : '')+'>'
        +'<dt class="flow-glossary-head"><span class="flow-glossary-term"><strong>'+esc(term)
        +'</strong> <small>'+esc(pos)+'</small></span><span class="flow-glossary-controls">'+word+'</span></dt>'
        +'<dd>'+esc(definition)+'</dd></div>';
    }).join("");
    return '<dl class="flow-glossary" lang="en-GB" data-rows="'+rows+'" style="--glossary-rows:'+rows+'">'+body+'</dl>'
      +'<p class="flow-glossary-audio-error" data-card-audio-error role="status" hidden></p>';
  }

  function flow(c,p) {
    if (c.flow.kind === "unit-opening") {
      const opening = c.flow.pages[p];
      return split(unitOpeningHTML(c, {...opening, photo: null}), originalPage(c), "opening");
    }
    if (c.flow.kind === "glossary") return glossary(c.flow.pages[p]);
    if (c.flow.kind === "skills") {
      const {paragraphs,example} = c.flow.pages[p];
      const copy = paragraphs.map(text => '<p>'+courseText(text)+'</p>').join("");
      return '<section class="u6-skills-copy" lang="en-GB">'+copy
        +'<p class="u6-skills-example">'+courseText(example)+'</p></section>';
    }
    return courseFlowHTML(c,p);
  }

  function watchSummary(c,p) {
    const [block] = coursePageBlocks(c,p);
    const values = block.answer.values;
    const slots = [...block.text.matchAll(/(\(\d+\))\s*_{2,}(\s*[.,;:!?])?/g)];
    if (slots.length !== values.length) throw new Error("Ex 3 的答位数量已变化。");
    let html = "", from = 0;
    slots.forEach(([whole,label,punctuation], i) => {
      const position = slots[i].index;
      html += courseFragment(block.text.slice(from,position))
        +'<span class="u6-summary-slot">'+esc(label)
        +' <span class="course-gap"><span data-course-answer-target>'+esc(values[i])+'</span></span>'
        +esc(punctuation?.trim() ?? "")+'</span>';
      from = position + whole.length;
    });
    return '<div class="course-exercise-copy u6-watch-summary"><p lang="en">'
      +html+courseFragment(block.text.slice(from))+'</p></div>';
  }

  function listeningNotesProjection() {
    const topics = [];
    for (const block of listeningNotesBlocks) {
      if (block.kind === "text" && block.text.startsWith("## ")) {
        topics.push({title:block.text.slice(3),blocks:[]});
      } else {
        topics.at(-1).blocks.push(block);
      }
    }
    const content = topics.map(({title,blocks},index) => {
      const headingId = "u6-note-topic-title-"+(index+1);
      return '<section class="u6-note-topic" aria-labelledby="'+headingId+'">'
        +'<h2 id="'+headingId+'">'+esc(title)+'</h2>'
        +'<div class="u6-note-copy">'+blocks.map(courseBlockHTML).join("")+'</div></section>';
    }).join("");
    return '<div class="u6-listening-notes" lang="en-GB">'+content+'</div>';
  }

  function task(c,p) {
    if (c.id === listeningNotesId) return listeningNotesProjection();
    if (c.id === listeningMatchId) return listeningMatchProjection();
    if (c.id === listeningFillId) {
      return '<div class="u6-listening-fill">'+wordBank(listeningBank,true)
        +'<div class="course-exercise-copy">'+listeningRows.map(courseItemHTML).join("")+'</div></div>';
    }
    if (c.id === listeningPhotosId) {
      const text = '<div class="course-exercise-copy">'+coursePageBlocks(c,p).map(courseBlockHTML).join("")+'</div>';
      return split(text,listeningPhotos(c),"listening");
    }
    if (c.id === inventionsId) return inventionsDiscussion();
    if (c.id === summaryId) return watchSummary(c,p);
    if (c.id === rewatchId) {
      return '<div class="course-exercise-copy u6-rewatch">'+wholeRewatch.map(courseBlockHTML).join("")+'</div>';
    }
    if (c.id !== knowledgeId && c.id !== photoId) return courseTaskHTML(c,p);
    const content = coursePageBlocks(c,p).map(courseBlockHTML).join("");
    const left = '<div class="u6-split-copy">'+numberedInstruction(c)+'<div class="course-exercise-copy">'+content+'</div></div>';
    if (c.id === photoId) return split(left,photos(c),"photos");
    const visual = c.courseVisualAdapted ? c.courseVisuals?.[0] : null;
    return split(left,visual ? courseSourceImage(visual) : originalPage(c),"knowledge");
  }

  function bindTrackScript(doc) {
    const audio = [...doc.querySelectorAll("[data-course-panel=media] .course-media-entry audio")]
      .find(player => player.src.endsWith("/Unl3_SB_IN_LS_L3_U06_t01.mp3"));
    if (!audio) return;

    const entry = audio.closest(".course-media-entry");
    entry.classList.add("u6-track-entry");
    const spoken = unit6Track61.map(({en,zh}, index) =>
      '<button type="button" class="u6-track-line" data-track-cue="'+index+'">'+
      '<span lang="en-GB">'+esc(en)+'</span><span class="u6-track-translation" lang="zh-CN">'+esc(zh)+
      '</span></button>').join("");
    entry.insertAdjacentHTML("beforeend",
      '<div class="u6-track-controls"><button type="button" data-track-script-toggle aria-expanded="false" '+
      'aria-controls="u6-track-script">显示原文</button><p data-track-status role="status" hidden></p></div>'+
      '<section class="u6-track-script" id="u6-track-script" aria-labelledby="u6-track-script-title" hidden>'+
      '<div class="u6-track-script-head"><h3 id="u6-track-script-title" lang="en">Script</h3>'+
      '<div class="u6-track-script-tools"><button type="button" data-track-chinese aria-pressed="false">中文字幕</button>'+
      '<button type="button" data-track-continuous aria-pressed="false" title="点击原文后从该句接着播">从此连续</button></div></div>'+
      '<div class="u6-track-lines" aria-label="录音原文">'+spoken+'</div></section>');

    const view = doc.defaultView;
    const toggle = entry.querySelector("[data-track-script-toggle]");
    const script = entry.querySelector(".u6-track-script");
    const viewport = script.querySelector(".u6-track-lines");
    const lines = [...viewport.querySelectorAll("[data-track-cue]")];
    const chinese = script.querySelector("[data-track-chinese]");
    const continuous = script.querySelector("[data-track-continuous]");
    const message = entry.querySelector("[data-track-status]");
    let active = -1;
    let single = null;
    let finished = null;
    let requestedStart = null;
    let frame = null;
    let followAfter = 0;

    function update(jump = false) {
      const time = audio.currentTime;
      if (single !== null && !audio.paused && !audio.seeking && time >= unit6Track61[single].end) {
        finished = single;
        single = null;
        audio.pause();
      }

      const index = finished ?? unit6Track61.findLastIndex(cue => cue.start <= time);
      const changed = index !== active;
      if (changed) {
        lines[active]?.removeAttribute("aria-current");
        active = index;
        lines[active]?.setAttribute("aria-current","true");
      }

      const line = lines[active];
      if (!line || script.hidden || !viewport.clientHeight || viewport.scrollHeight <= viewport.clientHeight) return;
      if (!jump && (!changed || view.performance.now() < followAfter)) return;
      const bounds = viewport.getBoundingClientRect();
      const above = bounds.top + viewport.clientHeight * .34;
      const y = line.getBoundingClientRect().top;
      if (jump || y > above || y < bounds.top) {
        const behavior = jump || view.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
        viewport.scrollTo({top:Math.max(0,viewport.scrollTop+y-above),behavior});
      }
    }

    function schedule() {
      if (frame !== null || audio.paused) return;
      frame = view.requestAnimationFrame(() => {
        frame = null;
        update();
        schedule();
      });
    }

    toggle.onclick = () => {
      const shown = script.hidden;
      script.hidden = !shown;
      entry.toggleAttribute("data-script-open",shown);
      toggle.setAttribute("aria-expanded",String(shown));
      toggle.textContent = shown ? "收起原文" : "显示原文";
      if (shown) update(true);
    };
    chinese.onclick = () => {
      const shown = script.toggleAttribute("data-chinese-visible");
      chinese.setAttribute("aria-pressed",String(shown));
      update(true);
    };
    continuous.onclick = () => {
      const enabled = continuous.getAttribute("aria-pressed") !== "true";
      continuous.setAttribute("aria-pressed",String(enabled));
      if (enabled) single = null;
    };
    viewport.addEventListener("wheel",() => {followAfter = view.performance.now()+3000;},{passive:true});
    viewport.addEventListener("click",event => {
      const line = event.target.closest("[data-track-cue]");
      if (!line) return;
      const index = Number(line.dataset.trackCue);
      finished = null;
      single = continuous.getAttribute("aria-pressed") === "true" ? null : index;
      requestedStart = unit6Track61[index].start;
      audio.currentTime = requestedStart;
      update(true);
      message.hidden = true;
      audio.play().catch(error => {
        if (error.name === "AbortError") return;
        message.textContent = error.name === "NotAllowedError" ? "请点击播放器的播放键。" : "录音暂时无法播放。";
        message.hidden = false;
      });
    });
    audio.addEventListener("play",() => {
      finished = null;
      message.hidden = true;
      update();
      schedule();
    });
    audio.addEventListener("pause",() => {
      if (frame !== null) view.cancelAnimationFrame(frame);
      frame = null;
      update();
    });
    audio.addEventListener("timeupdate",() => update());
    audio.addEventListener("seeking",() => {
      if (requestedStart === null || Math.abs(audio.currentTime-requestedStart) > .08) {
        single = null;
        finished = null;
      }
      update(true);
    });
    audio.addEventListener("seeked",() => {
      requestedStart = null;
      update(true);
    });
  }

  function bindSequentialReview(doc,c,p) {
    const button = doc.querySelector("[data-course-reveal]");
    if (!button || !c.coursePages) return;
    const blocks = coursePageBlocks(c,p);
    const answered = blocks.filter(block => block.answer);
    const modes = c.id === listeningReferencesId ? ["indexed-mark"] : ["gap","blanks","choice"];
    if (!answered.length || answered.some(block => !modes.includes(block.answer.mode))) return;
    const content = doc.querySelector(".content");
    const groups = new Map();
    for (const target of content.querySelectorAll("[data-course-answer-target],.course-item [data-course-correct-choice]")) {
      const choice = target.hasAttribute("data-course-correct-choice");
      const group = choice ? target.closest(".course-item") : target.closest(".course-gap") ?? target;
      if (!groups.has(group)) groups.set(group,[]);
      groups.get(group).push({target,choice});
    }
    const steps = [...groups.values()];
    if (!steps.length) return;
    let count = 0;
    const refresh = () => {
      steps.forEach((step,index) => step.forEach(({target,choice}) =>
        target.toggleAttribute(choice ? "data-u6-choice-shown" : "data-u6-answer-shown",index < count)));
      button.dataset.u6ReviewSteps = String(count);
      button.textContent = count === steps.length ? "收起" : count > 0 ? "下一项" : "核对";
      button.setAttribute("aria-pressed",String(count > 0));
      button.setAttribute("aria-label",count === steps.length ? "收起本页核对内容" : "原位揭示第 "+(count+1)+" 项");
    };
    button.onclick = () => {
      count = count === steps.length ? 0 : count + 1;
      refresh();
    };
    refresh();
  }

  function alignNumberedCopy(root,id) {
    const doc = root.ownerDocument;
    if (id === speakingOrderId) {
      for (const row of root.querySelectorAll(".course-item")) {
        const number = row.querySelector(".num")?.textContent;
        const text = row.querySelector("p")?.firstChild;
        if (number && text?.nodeType === 3 && text.data === number+" ____") text.deleteData(0,number.length+1);
      }
    }
    if (!numberedCopy.has(id)) return;

    const copy = root.querySelector(".course-exercise-copy");
    if (!copy) return;
    const labelPattern = id === strongFormsId ? /^([a-c])\s+/ : /^(\d+)\s+/;
    const hasContinuations = id === listeningPhotosId || id === inventionsId;
    let body;
    for (const paragraph of copy.querySelectorAll(":scope > p.course-copy")) {
      const text = paragraph.firstChild;
      const match = text?.nodeType === 3 ? text.data.match(labelPattern) : null;
      if (!match) {
        if (hasContinuations && body) body.append(paragraph);
        continue;
      }
      text.deleteData(0,match[0].length);
      const row = doc.createElement("div");
      row.className = "course-item u6-text-item";
      const label = doc.createElement("span");
      label.className = "num";
      label.textContent = match[1];
      body = doc.createElement("div");
      paragraph.replaceWith(row);
      row.append(label,body);
      body.append(paragraph);
    }
  }

  function alignQuestionNumbers(doc,c) {
    const content = doc.querySelector(".content");
    if (content) alignNumberedCopy(content,c.id);
    for (const reference of doc.querySelectorAll(".reference-sheet")) {
      const origin = reference.querySelector(":scope > header [data-original-case]");
      if (origin) alignNumberedCopy(reference,origin.dataset.originalCase);
    }
    for (const gap of doc.querySelectorAll(".content .course-gap, .course-reference-copy .course-gap")) {
      const text = gap.previousSibling;
      const match = text?.nodeType === 3 ? text.data.match(/(\(\d+\))([ \t]*)$/) : null;
      if (!match) continue;
      const label = doc.createElement("span");
      label.className = "u6-inline-number";
      label.textContent = match[1];
      text.deleteData(match.index,match[0].length);
      if (gap.closest(".u6-listening-notes")) {
        const cluster = doc.createElement("span");
        cluster.className = "u6-note-slot";
        gap.before(cluster);
        cluster.append(label,match[2],gap);
        const next = cluster.nextSibling;
        if (next?.nodeType === 3 && /^[),.!?]/.test(next.data)) {
          cluster.append(next.data[0]);
          next.deleteData(0,1);
        }
      } else {
        gap.before(label,match[2]);
      }
    }
  }

  function wire(doc,c,p) {
    alignQuestionNumbers(doc,c);
    const reference = doc.querySelector(
      '.reference-sheet:has(> header [data-original-case="'+inventionsId+'"]) .course-reference-copy > .course-exercise-copy'
    );
    if (reference) reference.insertAdjacentHTML("beforebegin", inventionsPhotoGallery());
    bindSequentialReview(doc,c,p);
    if (c.id === listeningMainId || c.id === listeningNotesId) bindTrackScript(doc);
  }

  return {
    bind(c) {
      if (c.id === rewatchId) return {chunks:[wholeRewatch],decks:[]};
      if (c.id === listeningFillId) return {chunks:[listeningRows],decks:[]};
      if (c.id === listeningMatchId) return {chunks:[listeningMatchRows],decks:[]};
      if (c.id === listeningNotesId) return {chunks:[listeningNotesBlocks],decks:[]};
      if (c.id === inventionsId) return {chunks:[inventionQuestions],decks:[]};
      return null;
    },
    heading(c,heading) {
      if (c.flow?.kind === "skills") return {...heading,activity:"SKILLS"};
      return c.id === knowledgeId ? {...heading,activity:""} : heading;
    },
    navLabel:step=>step.id===knowledgeId ? "UNLOCK YOUR KNOWLEDGE" : step.label,
    children: (c,p) => c.coursePages ? task(c,p) : flow(c,p),
    instruction:projectionInstruction,
    panels:coursePanels,
    wire
  };
}

