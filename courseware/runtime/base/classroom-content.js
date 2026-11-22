"use strict";

const classroomRecords = new Map();

function readingText(text, marks) {
 return numberMarkup(text, marks).replace(/\*\*([^*]+)\*\*/g, "<mark>$1</mark>");
}

function readingScreen(c, page, showInstruction = true) {
 const text = value => readingText(value, c.numberMarks);
 const lines = page.body.split(/\n+/).filter(Boolean).map(line => {
  const numbered = /^(\d+|[A-Z])\s+(.+)$/.exec(line);
  return numbered
   ? '<div class="line"><span class="num">'+esc(numbered[1])+'</span><p>'+text(numbered[2])+'</p></div>'
   : '<p>'+text(line)+'</p>';
 }).join("");
 const style = page.background ? ' style="background-image:url(&quot;'+esc(page.background)+'&quot;)"' : "";
 const title = page.title === page.articleTitle ? "" : '<h2>'+esc(page.title)+'</h2>';
 const subtitle = page.subtitle ? '<p class="reading-subtitle">'+esc(page.subtitle)+'</p>' : "";
 const lead = page.lead ? '<p class="reading-definition">'+text(page.lead)+'</p>' : "";
 const photo = page.photo && !page.background
  ? '<figure class="reading-picture"><img src="'+esc(page.photo)+'" alt="'+esc(page.alt)+'"></figure>' : "";
 const notes = (page.notes ?? []).map(note => '<p class="minor">'+esc(note)+'</p>').join("");
 return '<section class="reading '+(page.background ? 'scene' : 'textbook-reading')+'"'+style+'><div class="content reading-content">'+
  (showInstruction ? instructionHTML(c) : "")+
  '<div class="reading-heading"><h1>'+esc(page.articleTitle)+'</h1>'+title+subtitle+'</div>'+
  '<div class="reading-main'+(photo ? ' with-picture' : '')+'"><div class="reading-copy">'+lead+
  '<div class="paragraphs">'+lines+'</div>'+notes+'</div>'+photo+'</div></div></section>';
}

function readerHTML(c) {
 const id = classroom.reader(c);
 if (!id) return "";
 const pages = classroom.readingPages({reading:id});
 return '<section class="reader-panel" data-reader-panel hidden aria-label="原文阅读">'+
  pages.map((page,i) => '<div class="reader-sheet" data-reader-page="'+i+'"'+(i ? ' hidden' : '')+'>'+
   readingScreen(c,page,false)+'</div>').join("")+
  '<div class="reader-tools"><button type="button" data-reader-prev>上段</button>'+
  '<span data-reader-count aria-live="polite"></span><button type="button" data-reader-next>下段</button>'+
  '<button type="button" data-reader-source>材料原页</button><button type="button" data-reader-close>返回题目</button></div></section>';
}

function wireReader(doc,c) {
 const toggle = doc.querySelector("[data-reader-toggle]");
 const panel = doc.querySelector("[data-reader-panel]");
 if (!toggle || !panel) return;
 const pages = classroom.readingPages({reading:classroom.reader(c)});
 const nodes = [...panel.querySelectorAll("[data-reader-page]")];
 const previous = panel.querySelector("[data-reader-prev]"), next = panel.querySelector("[data-reader-next]");
 const source = panel.querySelector("[data-reader-source]");
 const close = panel.querySelector("[data-reader-close]");
 let selected = 0;
 function show(index) {
  if (!pages[index]) return;
  selected = index;
  nodes.forEach((node,i) => node.hidden = i !== index);
  panel.querySelector("[data-reader-count]").textContent = (index+1)+" / "+pages.length;
  previous.disabled = index === 0;
  next.disabled = index === pages.length-1;
 }
 function dismiss() {
  panel.hidden = true;
  toggle.setAttribute("aria-expanded","false");
  toggle.focus({preventScroll:true});
 }
 toggle.onclick = () => {
  if (!panel.hidden) return dismiss();
  const section = doc.querySelector("[data-deck-card]:not([hidden])")?.dataset.readingSection ??
   doc.querySelector("[data-relation-card]:not([hidden])")?.dataset.readingSection;
  const index = pages.findIndex(page => page.id === section);
  if (index >= 0) selected = index;
  show(selected);
  panel.hidden = false;
  toggle.setAttribute("aria-expanded","true");
  close.focus({preventScroll:true});
 };
 previous.onclick = () => show(selected-1);
 next.onclick = () => show(selected+1);
 close.onclick = dismiss;
 source.onclick = () => original(c,pages[selected].sourcePage,source);
 doc.addEventListener("keydown",event => {
  if (event.key === "Escape" && !panel.hidden) dismiss();
 });
}

function classroomExerciseNumber(c) {
 const number=String(c.ex??"");
 // Unit opener item numbers are part of its questions, not a printed exercise number.
 if (!c.id.includes("-question:") || c.module==="UNLOCK YOUR KNOWLEDGE") return "";
 return /^\d+[a-z]?(?:[-–]\d+[a-z]?)?$/i.test(number) ? number : "";
}

function instructionHTML(c,showNumber=true) {
 if (c.exerciseVocabulary) return "";
 const number=classroomExerciseNumber(c);
 let wording=c.instruction??"";
 if (c.module==="WATCH AND LISTEN") wording=wording.replace(/^\s*[▶►]\s*/,"");
 // Retain track references such as 6.1, including when a track starts the instruction.
 const prefixed=wording.match(/^\s*(\d+[a-z]?(?:[-–]\d+[a-z]?)?)(?:[.)])?\s+/i);
 if (number && prefixed?.[1].toLowerCase()===number.toLowerCase()) wording=wording.slice(prefixed[0].length);
 const instruction=esc(wording).replace(/(Student [A-Z]:)/g,"<strong>$1</strong>");
 if (!showNumber || !number) return '<p class="instruction" data-original-instruction>'+instruction+'</p>';
 return '<p class="instruction course-numbered-instruction"><span class="course-exercise-number" aria-label="Exercise '+
  esc(number)+'">'+esc(number)+'</span><span data-original-instruction>'+instruction+'</span></p>';
}

function workRecordKey(c,deck) {
 return c.id + "/" + (c.work?.byMaterial ? deck : 0);
}

function workValues(c,deck) {
 if (c.presentation?.kind === "shared-board") {
  return sharedBoards.get(classroom.workKey(c,c.presentation.key)) ?? [];
 }
 return classroomRecords.get(workRecordKey(c,deck)) ?? [];
}

function workSheetHTML(c, deck = 0, editable = false, useRecord = true) {
 const fields = classroom.workFields(c);
 if (!fields.length) return "";
 const values = useRecord ? workValues(c,deck) : [];
 return '<div class="work-sheet" data-work-sheet="'+esc(c.id)+'"><table aria-label="课堂记录"><tbody>'+
  fields.map((prompt,i) => '<tr><th scope="row">'+esc(prompt)+'</th><td>'+
   (editable ? '<textarea rows="2" aria-label="'+esc(prompt)+'" data-record-index="'+i+'">'+esc(values[i]??"")+'</textarea>'
    : '<span class="work-value">'+esc(values[i]??"")+'</span>')+'</td></tr>').join("")+
  '</tbody></table></div>';
}

function recordDrawerHTML(c) {
 return c.work ? '<section class="classroom-drawer" data-record-drawer hidden aria-label="本班记录">'+
  '<header><h2>本班记录</h2><button type="button" data-record-close>返回题目</button></header>'+
  '<div class="drawer-content" data-record-body></div></section>' : "";
}

function wireWorkRecord(doc,c) {
 const toggle = doc.querySelector("[data-record-toggle]");
 const drawer = doc.querySelector("[data-record-drawer]");
 if (!toggle || !drawer) return;
 const body = drawer.querySelector("[data-record-body]");
 const close = drawer.querySelector("[data-record-close]");
 function dismiss() {
  drawer.hidden = true;
  toggle.setAttribute("aria-expanded","false");
  toggle.focus({preventScroll:true});
 }
 toggle.onclick = () => {
  if (!drawer.hidden) return dismiss();
  const deck = Number(activeMaterial(doc)), key = workRecordKey(c,deck);
  if (!classroomRecords.has(key)) classroomRecords.set(key,[]);
  const values = classroomRecords.get(key);
  const label = c.work.byMaterial ? classroom.materialDecks(c)[deck]?.label : "";
  body.innerHTML = (label ? '<h3>'+esc(label)+'</h3>' : "")+workSheetHTML(c,deck,true);
  for (const field of body.querySelectorAll("[data-record-index]")) {
   field.addEventListener("input",() => { values[Number(field.dataset.recordIndex)] = field.value; });
  }
  drawer.hidden = false;
  toggle.setAttribute("aria-expanded","true");
  body.querySelector("textarea")?.focus({preventScroll:true});
 };
 close.onclick = dismiss;
 doc.addEventListener("keydown",event => {
  if (event.key === "Escape" && !drawer.hidden) dismiss();
 });
}

function materialCardHTML(card, feedback, attributes = "") {
 return '<section class="material-card"'+attributes+'>'+
  '<h2>'+esc(card.title)+'</h2>'+(card.subtitle ? '<p class="material-subtitle">'+esc(card.subtitle)+'</p>' : "")+
  '<div class="material-body">'+(card.photo ? '<img class="material-photo" src="'+esc(card.photo)+'" alt="'+esc(card.alt)+'">' : "")+
  (card.lead ? '<p>'+esc(card.lead)+'</p>' : "")+inlineMaterialHTML(card.body,feedback)+'</div>'+
  (card.notes ?? []).map(note => '<p class="material-notes">'+esc(note)+'</p>').join("")+'</section>';
}

function referencePages(c) {
 return classroom.related(c).flatMap(entry => {
  if (entry.ref.kind !== "student-work" || !entry.target.work?.byMaterial) return [entry];
  return classroom.materialDecks(entry.target).map((deck,index) => ({
   ...entry, material:deck.pages[0], deck:index, label:deck.label
  }));
 });
}

function referenceCopy({ref,target,deck,material},compact) {
 const plan = target.presentation;
 if (target.work || plan?.kind === "shared-board") {
  const sheet = workSheetHTML(target,deck,false,ref.kind==="student-work");
  if (material && !compact) return '<div class="reference-with-material">'+materialCardHTML(material)+sheet+'</div>';
  return sheet;
 }
 if (plan?.kind === "table") return wordBank(plan.bank,true)+taskTable(plan);
 if (target.taskTable) return taskTable(target.taskTable);
 if (plan?.kind === "note-slots") {
  return '<div class="reference-notes">'+plan.groups.map(lines => lines.map(line => '<p>'+line.map(part =>
   typeof part === "string" ? esc(part) : esc(part.given ?? "____")).join("")+'</p>').join("")).join("")+'</div>';
 }
 if (plan?.kind === "gallery" || plan?.kind === "crops") {
  const bank = wordBank(plan.bank,true);
  if (ref.kind === "material-reference" && bank) return bank;
  const items = (plan.items ?? target.items).map(item => itemHTML(item)).join("");
  return presentationHTML(plan,items,[],undefined);
 }
 if (plan?.kind === "selection") {
  const state = sharedSelections.get(classroom.workKey(target,plan.key));
  const selected = plan.mode === "choose" ? state?.chosen : state?.agreed;
  const facts = selected?.length ? selected.map(label => plan.facts.find(fact => fact.label === label)) : plan.facts;
  return facts.map(fact => itemHTML({label:fact.label,prompt:fact.text})).join("");
 }
 const items = (plan?.items ?? target.items).map(item => itemHTML(item)).join("");
 const provided = target.provided ? markup(target.provided) : "";
 return '<div class="reference-copy">'+(items || provided ? provided+items : '<p>'+esc(target.instruction)+'</p>')+'</div>';
}

function referencePanelHTML(c, compact = false) {
 const entries = referencePages(c);
 if (!entries.length) return "";
 return '<section class="reference-panel'+(compact ? ' compact-reference' : '')+'" data-reference-panel aria-label="前题内容">'+
  (entries.length > 1 ? '<div class="material-tabs" role="group" aria-label="切换前题内容">'+entries.map((entry,i) =>
   '<button type="button" data-relation-tab="'+i+'" aria-pressed="'+(i===0)+'">'+esc(entry.label??entry.ref.title)+'</button>').join("")+'</div>' : "")+
  '<div class="reference-sheets">'+entries.map((entry,i) => ' <section class="reference-sheet" data-relation-card="'+i+'"'+(entry.material?.id ? ' data-reading-section="'+esc(entry.material.id)+'"' : '')+(i ? ' hidden' : '')+'>'+
   '<header><h2>'+esc(entry.ref.title)+(entry.label ? ' '+esc(entry.label) : "")+'</h2>'+
   '<button type="button" data-original-case="'+esc(entry.target.id)+'" data-original-page="'+entry.target.pages[0]+'">前题原页</button></header>'+
   referenceCopy(entry,compact)+'</section>').join("")+'</div></section>';
}

function referenceDrawerHTML(c) {
 if (!classroom.related(c).length) return "";
 return '<section class="classroom-drawer" data-reference-drawer hidden aria-label="前题内容">'+
  '<header><h2>前题内容</h2><button type="button" data-reference-close>返回题目</button></header>'+
  '<div class="drawer-content">'+referencePanelHTML(c)+'</div></section>';
}

function wireReferences(doc) {
 for (const panel of doc.querySelectorAll("[data-reference-panel]")) {
  const tabs = [...panel.querySelectorAll("[data-relation-tab]")];
  const cards = [...panel.querySelectorAll("[data-relation-card]")];
  tabs.forEach((tab,i) => tab.onclick = () => {
   tabs.forEach((node,j) => node.setAttribute("aria-pressed",String(j===i)));
   cards.forEach((card,j) => card.hidden = j!==i);
  });
 }
 const toggle = doc.querySelector("[data-reference-toggle]");
 const drawer = doc.querySelector("[data-reference-drawer]");
 if (!toggle || !drawer) return;
 const close = drawer.querySelector("[data-reference-close]");
 function dismiss() {
  drawer.hidden = true;
  toggle.setAttribute("aria-expanded","false");
  toggle.focus({preventScroll:true});
 }
 toggle.onclick = () => {
  if (!drawer.hidden) return dismiss();
  drawer.hidden = false;
  toggle.setAttribute("aria-expanded","true");
  close.focus({preventScroll:true});
 };
 close.onclick = dismiss;
 doc.addEventListener("keydown",event => {
  if (event.key === "Escape" && !drawer.hidden) dismiss();
 });
}


function classroomStepLabel(c) {
 return c.flow ? c.module : c.module+" Ex "+c.ex;
}

function flowMarks(text) {
 return esc(text).replace(/\*\*([^*]+)\*\*/g,"<mark>$1</mark>");
}

function flowVisualHTML(visual) {
 const focus=Number.isFinite(visual.focusX)?' style="object-position:'+visual.focusX+'% center"':"";
 const body=visual.src?'<img src="'+esc(visual.src)+'" alt=""'+focus+'>':
  '<div class="flow-visual-panel">'+visual.lines.map(line=>'<p>'+flowMarks(line)+'</p>').join("")+'</div>';
 const note=visual.caption?'<p class="flow-visual-note">'+esc(visual.caption)+'</p>':"";
 return '<div class="flow-visual">'+body+note+'</div>';
}

function wordCardAudioHTML(kind,label,description,clip,tooltip=description) {
 return '<button class="flow-pronounce" type="button" data-card-pronounce="'+kind+'" aria-pressed="false" aria-label="'+esc(description)+'" title="'+esc(tooltip)+'">'+label+'</button>'+
  '<audio hidden data-card-audio="'+kind+'" preload="none" src="'+
   esc(clip.startsWith("https://") || clip.startsWith("/") ? clip : "data:audio/mpeg;base64,"+clip)+'"></audio>';
}

function flowWordCardHTML(word) {
 const start=word.example.toLowerCase().indexOf(word.exampleMark.toLowerCase());
 const end=start+word.exampleMark.length;
 const example=start<0?esc(word.example):
  esc(word.example.slice(0,start))+'<strong>'+esc(word.example.slice(start,end))+'</strong>'+esc(word.example.slice(end));
 const pronunciation=window.UNLOCK_WORD_PRONUNCIATION;
 const wordAudio=wordCardAudioHTML("word","Word","Play word pronunciation for "+word.term,pronunciation.entries[word.term].audio);
 const exampleAudio=wordCardAudioHTML("example","Example","Play example sentence for "+word.term,pronunciation.examples[word.example]);
 const form=word.form&&!word.form.startsWith("/")?'<span class="flow-card-form">'+esc(word.form)+'</span>':"";
 return '<article data-flow-word="'+esc(word.id)+'"><div class="flow-card-copy" lang="en-GB">'+
  '<div class="flow-card-controls" role="group" aria-label="British English audio">'+wordAudio+exampleAudio+'</div>'+
  '<div class="flow-card-head"><h2>'+flowMarks(word.termDisplay??word.term)+(word.pos?' <small>'+esc(word.pos)+'</small>':"")+'</h2></div>'+
  '<div class="flow-card-sound"><p class="flow-card-ipa" aria-label="British phonetic transcription">'+esc(word.ipa)+'</p>'+form+'</div>'+
  '<p class="flow-card-definition">'+esc(word.definition)+'</p>'+
  '<p class="flow-card-example">'+example+'</p>'+
  '<p class="flow-pronunciation-error" data-card-audio-error role="status" hidden></p></div>'+
  flowVisualHTML(word.visual)+'</article>';
}

function wireWordPronunciation(doc) {
 const players=[...doc.querySelectorAll("[data-card-audio]")];
 const message=doc.querySelector("[data-card-audio-error]");
 for(const audio of players){
  const button=audio.previousElementSibling;
  const update=()=>button.setAttribute("aria-pressed",String(!audio.paused&&!audio.ended));
  const failed=()=>{message.textContent=button.textContent+" audio could not play.";message.hidden=false;update();};
  button.addEventListener("click",()=>{
   message.hidden=true;
   if(!audio.paused&&!audio.ended){audio.pause();return;}
   for(const other of players)if(other!==audio)other.pause();
   audio.currentTime=0;
   audio.play().catch(error=>{if(error.name!=="AbortError")failed();});
  });
  for(const event of ["playing","pause","ended"])audio.addEventListener(event,update);
  audio.addEventListener("error",failed);
 }
}

function flowGlossaryHTML(entries) {
 const rows=Math.ceil(entries.length/2);
 const cards=window.UNLOCK_WORD_PRONUNCIATION, recordings=window.UNLOCK_TASK_GLOSSARY_AUDIO;
 const body=entries.map((entry,i)=>{
  const {term,pos,definition,wordAudio,cardWord}=entry;
  const wordClip=entry.pronunciation ? courseVoice(entry.pronunciation) :
   entry.exerciseClip ? classroomVocabularyData.clips[entry.exerciseClip] :
   cardWord ? cards.entries[wordAudio]?.audio : recordings.words[wordAudio];
  const word=wordClip ? wordCardAudioHTML("word","Word","Play word pronunciation for "+term,wordClip) : "";
  return '<div class="flow-glossary-entry"'+(i%rows===0?' data-column-start':"")+'>'+
   '<dt class="flow-glossary-head"><span class="flow-glossary-term"><strong>'+esc(term)+'</strong> <small>'+esc(pos)+'</small></span>'+
   (word?'<span class="flow-glossary-controls" role="group" aria-label="Word pronunciation">'+word+'</span>':"")+'</dt>'+
   '<dd>'+esc(definition)+'</dd></div>';
 }).join("");
 return '<dl class="flow-glossary" lang="en-GB" data-rows="'+rows+'" style="--glossary-rows:'+rows+'">'+body+'</dl>'+
  '<p class="flow-glossary-audio-error" data-card-audio-error role="status" hidden></p>';
}

function unitOpeningHTML(c,opening) {
 const {outcome,goals,photo}=opening;
 const image=photo&&c.sourceImages[(c.sourcePages??c.pages).indexOf(photo.sourcePage??c.pages[0])];
 const picture=image?'<figure class="unit-opening-photo">'+cropHTML({...photo,src:image})+'</figure>':"";
 const rows=goals.map(({label,text})=>'<div class="unit-opening-goal"><dt>'+esc(label)+'</dt><dd>'+
  text.split(/(?<=;)\s+/).map(line=>'<span>'+esc(line)+'</span>').join("")+'</dd></div>').join("");
 return '<section class="unit-opening'+(image?' with-opening-photo':'')+'" lang="en">'+
  '<div class="unit-opening-copy"><h1 class="unit-opening-title">'+esc(c.topic)+'</h1>'+
  '<section class="unit-opening-outcome"><h2>'+esc(outcome.label)+'</h2><p>'+esc(outcome.text)+'</p></section>'+
  '<dl class="unit-opening-goals">'+rows+'</dl></div>'+picture+'</section>';
}

function classroomFlowHTML(c,p) {
 const flow=c.flow, content=flow.pages?.[p], answers=new Map(inlineRows(c.feedback).map(row=>[row.label,row]));
 switch(flow.kind){
  case "unit-opening":
   return unitOpeningHTML(c,content);
  case "glossary":
   return flowGlossaryHTML(content);
  case "resource":
   return '<div class="flow-resource">'+content.split(/(<table\b[\s\S]*?<\/table>)/i).filter(text=>text.trim()).map(markup).join("")+'</div>';
  case "cards":
   return '<div class="flow-wordcards">'+content.map(flowWordCardHTML).join("")+'</div>';
  case "match":
   return '<div class="flow-match-pictures" data-match-columns="'+content.visuals.length+'">'+content.visuals.map((visual,i)=>
    '<figure>'+flowVisualHTML(visual)+'<figcaption>'+String.fromCharCode(65+i)+'</figcaption></figure>').join("")+
    '</div><div class="flow-questions">'+content.rows.map(row=>'<div class="flow-match-row" data-flow-word="'+esc(row.id)+'"><span class="num">'+esc(row.label)+'</span>'+
    '<p>'+flowMarks(row.prompt)+'</p>'+inlineAnswer(answers.get(row.label),row.answer,"status")+'</div>').join("")+'</div>';
  case "use":
   return wordBank(content.bank,true)+'<div class="flow-questions flow-practice" data-flow-mode="'+esc(flow.mode)+'">'+content.rows.map(row=>{
    const answer=answers.get(row.label);
    const field=flow.fitAnswer?"text":"gap";
    const cue=row.cue?' <span class="flow-form-cue">('+esc(row.cue)+')</span>':"";
    const options=row.choices?'<div class="flow-choices">'+row.choices.map(option=>'<span>'+esc(option)+'</span>').join("")+'</div>':"";
    const sentence=flow.mode==="example"?'<p>'+esc(row.before)+'</p>'+
     '<div class="flow-speaking-example"><p>Example</p>'+inlineAnswer(answer,row.answer,"line")+'</div>':
     '<p>'+esc(row.before)+inlineAnswer(answer,row.answer,field)+esc(row.after)+cue+'</p>'+options;
    return '<div class="v-item" data-flow-word="'+esc(row.id)+'"><span class="num">'+esc(row.label)+'</span><div>'+sentence+'</div></div>';
   }).join("")+'</div>';
  case "word-review":
   return '<ul class="flow-word-review" style="--word-review-rows:'+Math.ceil(content.length/3)+'">'+
    content.map(({id,form})=>'<li data-wordlist-form="'+esc(id)+'">'+esc(form)+'</li>').join("")+'</ul>';
  case "dictation":
   return '<div class="flow-dictation" style="--dictation-rows:'+Math.ceil(flow.rows.length/3)+'">'+flow.rows.map(row=>
    '<div><span class="num">'+esc(row.number)+'</span>'+inlineAnswer(answers.get(row.number),row.term,"line")+'</div>').join("")+'</div>';
  case "review":
   return '<p class="flow-scale">'+Object.keys(flow.scale).reverse().map(n=>esc(n)+" = "+esc(flow.scale[n])).join("　　")+'</p>'+
    '<ol class="flow-review">'+flow.rows.map(row=>'<li>'+esc(row)+'</li>').join("")+'</ol>';
  default:return "";
 }
}
