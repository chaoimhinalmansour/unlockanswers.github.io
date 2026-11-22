"use strict";

/*
 * Exercise pages use printed page numbers. Reading sections and dependencies
 * keep their own source pages, even when they appear inside another exercise.
 * These bindings are shared by the renderer and the validation page.
 */
function buildClassroomModel(data) {
 const active = data.lessonFlow?.entries ?? [];
 const activeIds = new Set(active.map(c=>c.id));
 const glossaryEntries = data.taskGlossaries?.entries ?? [];
 const cases = [...data.fixtures, ...(data.reuseFixtures ?? []), ...active, ...(data.unitOpenings?.entries ?? []),
  ...glossaryEntries.filter(c=>!activeIds.has(c.id))];
 const byId = new Map();
 const sources = new Map();
 const issues = new Map();
 const readings = new Map(Object.entries(data.readings ?? {}));
 const lessonSteps=new Map((data.lessonFlow?.lessons??[]).flatMap(lesson=>lesson.steps.map(step=>[step.id,step])));
 const issue = (c, message) => issues.get(c.id).push(message);
 const bookNumber = c => c.book ?? Number(/^B(\d+)-/.exec(c.id)?.[1]);
 const unitKey = c => c.id.split(/-(?:question|classroom):/)[0];
 const sourceKey = (book, track, page) => book + "/" + track + "/" + page;

 for (const c of cases) {
  if (byId.has(c.id)) throw new Error("Duplicate exercise " + c.id);
  byId.set(c.id, c);
  issues.set(c.id, []);
  const pages = c.sourcePages ?? c.pages;
  if (pages.length !== c.sourceImages.length) issue(c, "教材页码与原页文件的数量不一致。");
  pages.forEach((page, index) => {
   const image = c.sourceImages[index];
   if (!image) return;
   const book = bookNumber(c), key = sourceKey(book, c.track, page);
   const registered = sources.get(key);
   if (registered && registered.image !== image) {
    issue(c, "教材第 " + page + " 页出现不同的原页文件。");
    return;
   }
   const edition = data.textbooks?.[book + "/" + c.track];
   const pdfPage = edition?.printedPages?.[page];
   sources.set(key, {book, track:c.track, page, image, pdf:pdfPage ? edition.file + "#page=" + pdfPage : null});
  });
 }

 function source(c, page) {
  return sources.get(sourceKey(bookNumber(c), c.track, Number(page)));
 }

 function readingPage(ref) {
  const reading = readings.get(ref.reading);
  const page = reading?.pages.find(entry => entry.id === ref.section);
  return page ? {...page, reading:ref.reading, articleTitle:reading.title} : null;
 }

 function distinctReadingPrintPages(pages) {
  const seen = new Map();
  const result=[];
  for (const page of pages) {
   if (!page.reading) {
    result.push(page);
    continue;
   }
   const key=page.reading+"/"+page.sourcePage;
   if (!seen.has(key)) {
    const primary={...page,sections:[]};
    seen.set(key,primary);
    result.push(primary);
   }
   seen.get(key).sections.push(page.id);
  }
  return result;
 }

 function readingPages(view) {
  const reading = readings.get(view.reading);
  if (!reading) return [];
  const ids = view.sections ?? reading.pages.map(page => page.id);
  return distinctReadingPrintPages(ids.map(section => readingPage({reading:view.reading, section})).filter(Boolean));
 }

 function materialDecks(c) {
  return (c.materialDecks ?? []).map(deck => ({
   label:deck.label,
   pages:distinctReadingPrintPages(deck.pages.map(page => page.reading ? readingPage(page) : page).filter(Boolean))
  }));
 }

 function workKey(c, name) {
  return unitKey(c) + "/" + name;
 }

 function relation(c, ref) {
  const target = byId.get(ref.id);
  if (!target) return {ref, target:null, embedded:false};
  const sameBoard = c.presentation?.key && c.presentation.key === target.presentation?.key &&
   c.presentation.kind === target.presentation.kind && unitKey(c) === unitKey(target);
  const bank = c.presentation?.bank, targetBank = target.presentation?.bank;
  const sameBank = ref.kind === "material-reference" && bank?.length &&
   JSON.stringify(bank) === JSON.stringify(targetBank);
  return {ref, target, embedded:Boolean(sameBoard || sameBank || ref.use === "visible")};
 }

 function relations(c) {
  return c.references.map(ref => relation(c, ref));
 }

 function related(c) {
  return relations(c).filter(entry => !entry.embedded && entry.target);
 }

 function reader(c) {
  if (c.reader || c.readingView?.fullReader) return c.reader ?? c.readingView.reading;
  return null;
 }

 function workFields(c) {
  if (Array.isArray(c.work?.fields)) return c.work.fields;
  if (c.presentation?.kind === "shared-board") return c.presentation.labels;
  if (c.taskTable?.questionColumn) return c.taskTable.rows.map(row => row[0]);
  return (c.presentation?.items ?? c.items).map(item => item.label + ". " + item.prompt);
 }

 const openings=(data.unitOpenings?.order??[]).map(id=>{
  const c=byId.get(id);
  if(c?.flow?.kind!=="unit-opening")throw new Error("Missing unit opening "+id);
  return c;
 });
 const glossaries=glossaryEntries.map(entry=>{
  const c=byId.get(entry.id);
  if(c?.flow?.kind!=="glossary")throw new Error("Missing task Glossary "+entry.id);
  return c;
 });
 const indexById = new Map(cases.map((c,index)=>[c.id,index]));
 function playback(c) {
  const player=c.playback;
  if(!player?.mediaId)return player;
  const asset=data.classroomMedia?.[player.mediaId];
  return asset ? {...asset,...player,src:asset.src} : null;
 }

 function header(c) {
  const {moduleLabel=c.module,phaseTitle=""}=lessonSteps.get(c.id)?.context??c.context??{};
  const phase=phaseTitle!==moduleLabel?phaseTitle:"";
  const label=c.flow?.kind==="glossary"?"GLOSSARY FOR EX "+c.flow.targetExercise:c.ex?"Ex "+c.ex:c.module;
  const repeated=label===moduleLabel||label===phase||(["resource","unit-opening"].includes(c.flow?.kind)&&c.instruction===phase);
  return {module:moduleLabel,phase,activity:repeated?"":label};
 }

 function vocabularyLinks(c) {
  return lessonSteps.get(c.id)?.vocabularyLinks??[];
 }

 function checks(c) {
  const reasons = [...issues.get(c.id)];
  if(vocabularyLinks(c).some(link=>{
   const expected=link.kind==="glossary"&&data.taskGlossaries?"glossary":"resource";
   return byId.get(link.id)?.flow?.kind!==expected;
  })){
   reasons.push("找不到任务对应的词汇材料。");
  }
  const player=playback(c);
  if(c.playback&&!player?.src)reasons.push("音视频缺少可播放的原文件。");
  const pages = [...c.pages];
  if (c.readingView) {
   const view = readingPages(c.readingView);
   if (!view.length || c.readingView.sections?.some(section=>!readingPage({reading:c.readingView.reading,section}))) reasons.push("阅读内容缺少对应原文。");
   pages.push(...view.map(page => page.sourcePage));
  }
  if (reader(c)) {
   const full = readingPages({reading:reader(c)});
   if (!full.length) reasons.push("阅读全文入口缺少对应原文。");
   pages.push(...full.map(page => page.sourcePage));
  }
  materialDecks(c).forEach((deck, i) => {
   if (!deck.pages.length || c.materialDecks[i].pages.some(page=>page.reading&&!readingPage(page))) reasons.push("课堂材料缺少对应段落。");
   pages.push(...deck.pages.map(page => page.sourcePage));
  });
  pages.push(c.presentation?.sourcePage, ...(c.feedback?.rows ?? []).map(row => row.sourcePage));
  for (const page of new Set(pages.filter(Boolean))) {
   if (!source(c,page)) reasons.push("缺少教材第 " + page + " 页的原页。");
  }
  for (const {ref,target} of relations(c)) {
   if (ref.sourceOnly) {
    if (!ref.pages.every(page => source(c,page))) reasons.push("缺少引用的教材原页。");
   } else if (!target) {
    reasons.push("找不到前题 " + ref.title + "。");
   } else if (!["student-work","material-reference"].includes(ref.kind)) {
    reasons.push("请确认 " + ref.title + " 的引用方式。");
   }
  }
  if (c.work && !workFields(c).length) reasons.push("课堂记录缺少对应的题目或栏目。");
  return reasons;
 }

 return {cases, openings, glossaries, byId, indexById, bookNumber, source, readingPages, materialDecks, related, relations, reader, workKey, workFields, playback, header, vocabularyLinks, checks};
}

if (typeof module !== "undefined") module.exports = {buildClassroomModel};

