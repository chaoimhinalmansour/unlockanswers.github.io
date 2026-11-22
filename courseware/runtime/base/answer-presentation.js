"use strict";

const circledNumbers="①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";

function bankNumber(index){
 return '<span class="bank-number" data-bank-number="'+(index+1)+'">'+(circledNumbers[index]??String(index+1))+'</span>';
}

function wordBank(words=[],numbered=false){
 const items=words.map((word,i)=>{
  const text=Array.isArray(word)?markedParts(word):esc(word);
  return '<span class="bank-entry" role="listitem">'+(numbered?bankNumber(i):"")+'<span>'+text+'</span></span>';
 }).join("");
 const columns=Math.min(5,Math.ceil(words.length/2));
 return items?'<div class="v-bank" role="list"'+(numbered?' data-numbered style="--bank-columns:'+columns+'"':'')+'>'+items+'</div>':"";
}

function numberBankTerms(value,bank){
 const words=bank.map(entry=>Array.isArray(entry)?entry.map(part=>part.text).join(""):entry);
 const byWord=new Map(words.map((word,i)=>[word,i]));
 const escaped=[...byWord.keys()].sort((a,b)=>b.length-a.length).map(word=>word.replace(/[.*+?^{}$()|[\]\\]/g,"\\$&"));
 if(!escaped.length)return esc(value);
 const pattern=new RegExp("(?<![\\p{L}\\p{N}])(?:"+escaped.join("|")+")(?![\\p{L}\\p{N}])","gu");
 let cursor=0,html="";
 for(const hit of value.matchAll(pattern)){
  html+=esc(value.slice(cursor,hit.index))+'<span class="numbered-answer-term">'+bankNumber(byWord.get(hit[0]))+esc(hit[0])+'</span>';
  cursor=hit.index+hit[0].length;
 }
 return html+esc(value.slice(cursor));
}

function inlineRows(feedback){
 return feedback?.placement==="inline"?feedback.rows:[];
}

function inlineHit(row,text,kind=""){
 return inlineAnchor(row.label,esc(text),kind?' data-hit="'+kind+'"':"");
}

function inlineAnswer(row,value=row.display??row.answer,kind="",key=row.label,bank=[]){
 const variants=row.byMaterial?Object.entries(row.byMaterial):[[null,value]];
 const copy='<span class="inline-stack">'+variants.map(([material,text])=>inlineValue(text,material,bank)).join("")+'</span>';
 const flags=(kind?' data-field="'+kind+'"':'')+(key!==row.label?' data-inline-key="'+esc(key)+'"':'');
 return inlineAnchor(row.label,copy,flags);
}

function markAttr(label){
 return ' data-inline-mark="'+esc(label)+'"';
}

function optionHTML(text,index,row){
 return '<span class="inline-option"'+(row.anchor.options.includes(index)?markAttr(row.label):"")+'>'+esc(text)+'</span>';
}

function inlineItemHTML(item,row,letterChoices){
 const mode=row.anchor.kind;
 const index='<span class="num">'+esc(item.label)+'</span>';
 let prompt=esc(item.prompt), answer="", options="", label=inlineHit(row,item.label,"item-index");
 switch(mode){
  case "gaps":{
   let cursor=0,i=0;
   prompt="";
   for(const slot of item.prompt.matchAll(/_{2,}/g)){
    const values=row.anchor.values??[row.display??row.answer];
    const key=values.length>1?row.label+"."+(i+1):row.label;
    prompt+=esc(item.prompt.slice(cursor,slot.index))+inlineAnswer(row,values[i++],"gap",key);
    cursor=slot.index+slot[0].length;
   }
   prompt+=esc(item.prompt.slice(cursor));
   label=index;
   break;
  }
  case "choice":
   options='<ol class="v-options inline-choices"'+(letterChoices?' type="a"':"")+'>'+item.options.map((option,i)=>'<li>'+optionHTML(option,i,row)+'</li>').join("")+'</ol>';
   break;
  case "alternatives":{
   const original=row.anchor.match??"____";
   const pos=item.prompt.indexOf(original);
   const pair=item.options.map((option,i)=>optionHTML(option,i,row)).join(" / ");
   prompt=row.anchor.append?prompt+" "+pair+".":esc(item.prompt.slice(0,pos))+pair+esc(item.prompt.slice(pos+original.length+(row.anchor.trimComma?1:0)));
   break;
  }
  case "status":
   label=index;
   answer=inlineAnswer(row,row.display??row.answer,(row.display??row.answer).length>2?"status-word":"status");
   break;
  case "marking":
   prompt=markedParts(row.parts,row.label);
   break;
  case "line":
   label=index;
   answer=inlineAnswer(row,row.display??row.answer,"line");
   break;
 }
 const status=mode==="status"&&row.anchor.side!=="end";
 if(mode==="status"&&!status){prompt+=" "+answer;answer="";}
 const labelClass=item.label.length>4?' text-label':'';
 return '<div class="v-item inline-exercise-item'+(status?' inline-status-item':'')+labelClass+(item.prompt?"":' inline-answer-only')+'">'+(status?answer:"")+(item.prompt?label:"")+
  '<div><p>'+prompt+'</p>'+options+(status?"":answer)+'</div></div>';
}

function itemWithFeedback(item,feedback,letterChoices=false){
 const row=inlineRows(feedback).find(entry=>entry.label===item.label&&entry.anchor);
 if(row)return inlineItemHTML(item,row,letterChoices);
 const given=feedback?.given?.[item.label];
 if(given)return '<div class="v-item inline-exercise-item"><span class="num">'+esc(item.label)+'</span><div><p>'+esc(item.prompt)+'</p><p class="inline-given-line" data-note-given>'+esc(given)+'</p></div></div>';
 return itemHTML(item,letterChoices);
}

function inlineTableCell(text,i,j,feedback,bank){
 const row=inlineRows(feedback).find(entry=>entry.anchor?.kind==="cell"&&entry.anchor.at[0]===i&&entry.anchor.at[1]===j);
 if(!row)return markup(text);
 return markup(text)+inlineAnswer(row,row.display??row.answer,feedback.kind==="criteria"?"criterion":"cell",row.label,bank);
}

function replaceInlineText(text,rows,format,render){
 const matches=rows.map(row=>({row,match:row.anchor.match,index:text.indexOf(row.anchor.match)}))
  .filter(hit=>hit.index>=0).sort((a,b)=>a.index-b.index);
 let html="",cursor=0;
 for(const hit of matches){
  html+=format(text.slice(cursor,hit.index))+render(hit.row,hit.match);
  cursor=hit.index+hit.match.length;
 }
 return html+format(text.slice(cursor));
}

function inlinePassageHTML(text,feedback){
 const rows=inlineRows(feedback);
 if(!rows.length)return markup(text);
 const first=rows[0];
 if(first.anchor?.kind==="marking")return '<p class="annotated-copy">'+inlineHit(first,first.label,"item-index")+'<span>'+markedParts(first.parts,first.label)+'</span></p>';
 if(first.anchor?.kind==="replacement"){
  return '<div class="inline-replacement"'+markAttr(first.label)+'><div data-inline-original>'+markup(text)+'</div>'+
   '<div data-inline-correction>'+markup(first.answer)+'</div></div>'+inlineHit(first,first.label,"text-index");
 }
 const placements=rows.filter(row=>["text-choice","text-status"].includes(row.anchor?.kind));
 if(!placements.length)return markup(text);
 return text.split(/\n+/).filter(Boolean).map(line=>'<p>'+replaceInlineText(line,placements,esc,(row,match)=>{
  if(row.anchor.kind==="text-status")return inlineAnswer(row,row.answer,"status")+" "+esc(match);
  const pair=row.anchor.alternatives.map((option,i)=>optionHTML(option,i,row)).join(" / ");
  return inlineHit(row,"("+row.label+")","text-index")+" "+pair;
 })+'</p>').join("");
}

function inlineMaterialHTML(text,feedback){
 const highlights=inlineRows(feedback).filter(row=>row.materialMatch).map(row=>({...row,anchor:{match:row.materialMatch}}));
 if(!highlights.length)return markup(text);
 const strong=value=>esc(value).replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>");
 return text.split(/\n+/).filter(Boolean).map(line=>'<p>'+replaceInlineText(line,highlights,strong,
  (row,match)=>'<span class="check-mark underline"'+markAttr(row.label)+'>'+strong(match)+'</span>')+'</p>').join("");
}


function boxStyle(box,basis){
 const [left,top,width,height]=basis, [x,y,w,h]=box;
 return 'left:'+100*(x-left)/width+'%;top:'+100*(y-top)/height+'%;width:'+100*w/width+'%;height:'+100*h/height+'%';
}

function artworkHTML(asset,box,outline="",alt=""){
 const [x,y,w,h]=box;
 const dimensions='width:'+100*asset.width/w+'%;height:'+100*asset.height/h+'%;left:'+(-100*x/w)+'%;top:'+(-100*y/h)+'%';
 return '<span class="artwork-crop"'+(outline?' style="clip-path:'+esc(outline)+'"':'')+'><img src="'+esc(asset.src)+'" alt="'+esc(alt)+'" style="'+dimensions+'"></span>';
}

function timelineChartHTML(plan){
 const {image,plot,points,years,scale}=plan;
 const frame=[0,0,image.width,image.height];
 const position=year=>100*(year-years[0])/(years[1]-years[0]);
 const grid=[];
 for(let value=0;value<=scale.max;value+=scale.step){
  grid.push('<span class="timeline-grid" style="bottom:'+100*value/scale.max+'%"><span class="timeline-axis-value">'+value+'</span></span>');
 }
 const ticks=plan.ticks.map(year=>'<span class="timeline-tick" style="left:'+position(year)+'%"><span>'+year+'</span></span>').join("");
 const markers=points.map(point=>{
  const pointStyle='left:'+position(point.year)+'%;height:'+100*point.value/scale.max+'%;width:'+100*point.art.box[2]/plot[2]+'%';
  return '<div class="timeline-point" data-chart-year="'+point.year+'" style="'+pointStyle+'">'+
   artworkHTML(image,point.art.box,point.art.outline)+
   '<span class="timeline-count" data-chart-value>'+point.value+'</span><span class="timeline-year">'+point.year+'</span></div>';
 }).join("");
 const callouts=points.filter(point=>point.share).map(point=>
  '<span class="timeline-share" style="'+boxStyle(point.share.box,frame)+'"><strong>'+esc(point.share.value)+'</strong><span>of the population</span></span>'
 ).join("");
 return '<figure class="timeline-view" aria-labelledby="timeline-title"><div class="timeline-chart" style="--graphic-ratio:'+image.width/image.height+'">'+
  '<div class="timeline-plot" style="'+boxStyle(plot,frame)+'">'+grid.join("")+ticks+markers+'</div>'+
  '<h2 class="timeline-title" id="timeline-title">'+esc(plan.title)+'</h2>'+callouts+'</div></figure>';
}

function factFileHTML(plan){
 const tag='<span class="fact-file-tag" style="'+boxStyle(plan.tag,plan.photo)+'">'+esc(plan.kicker).replace("\n","<br>")+'</span>';
 const facts=plan.facts.map(text=>'<li>'+esc(text)+'</li>').join("");
 return '<figure class="panel practice-fact"><div class="fact-file">'+
  '<div class="fact-file-photo">'+artworkHTML(plan.image,plan.photo,"",plan.alt)+tag+'</div>'+
  '<div class="fact-file-copy"><h2>'+esc(plan.title).replace("\n","<br>")+'</h2><ul>'+facts+'</ul></div></div></figure>';
}

function classificationDiagramHTML(plan,feedback){
 const [width,height]=plan.size, frame=[0,0,width,height];
 const responses=new Map(inlineRows(feedback).map(row=>[row.label,row]));
 const regions=plan.regions.map(region=>{
  const answer=responses.get(region.label);
  return '<h2 class="classification-title" style="'+boxStyle(region.titleBox,frame)+'">'+esc(region.title)+'</h2>'+
   inlineAnchor(region.label,inlineValue(answer.display??answer.answer,null,plan.bank),' data-field="diagram" style="'+boxStyle(region.answerBox,frame)+'"');
 }).join("");
 return '<div class="classification">'+wordBank(plan.bank,true)+
  '<figure class="classification-view"><div class="classification-graphic" style="--graphic-ratio:'+width/height+'">'+
  '<canvas data-classification-art width="'+2*width+'" height="'+2*height+'" aria-hidden="true"></canvas>'+regions+'</div></figure></div>';
}

function drawClassification(doc,plan){
 const canvas=doc.querySelector("[data-classification-art]"), context=canvas.getContext("2d");
 context.scale(2,2);
 for(const shape of plan.artwork){
  const path=new doc.defaultView.Path2D(shape.path??"");
  if(shape.oval)path.ellipse(...shape.oval,0,0,Math.PI*2);
  if(shape.fill){context.fillStyle=shape.fill;context.fill(path)}
  if(shape.stroke){context.strokeStyle=shape.stroke;context.lineWidth=shape.weight;context.stroke(path)}
 }
 canvas.dataset.drawn="true";
}

function routeMapHTML(plan,feedback){
 const answers=new Map(inlineRows(feedback).map(row=>[row.label,row]));
 const map=plan.image.box, key=plan.key;
 const labels=plan.positions.map(({label,box:[x,y,w,h]})=>{
  const style=boxStyle([x-h,y,w+h,h],map)+';--route-index:'+100*h/(w+h)+'%';
  return '<div class="route-slot" style="'+style+'"><span class="route-slot-number">'+esc(label)+'</span>'+
   inlineAnchor(label,inlineValue(answers.get(label).answer),' data-field="map"')+'</div>';
 }).join("");
 const caption=plan.captions.map(c=>'<span class="route-caption'+(c.tone?' '+esc(c.tone):"")+'" style="'+boxStyle(c.box,map)+'">'+esc(c.text)+'</span>').join("");
 const lines=key.lines.map(line=>'<li><span class="route-line '+esc(line.color)+'" aria-hidden="true"></span>'+esc(line.text)+'</li>').join("");
 const legend='<div class="route-key" style="'+boxStyle(key.box,map)+'"><strong>'+esc(key.title)+'</strong><ul>'+lines+'</ul></div>';
 return wordBank(plan.bank)+cropHTML(plan.image,legend+caption+labels);
}

function presentationHTML(plan,items,bank,feedback){
 switch(plan.kind){
  case "crops":return cropsHTML(plan,items);
  case "timeline-chart":return timelineChartHTML(plan);
  case "classification-diagram":return classificationDiagramHTML(plan,feedback);
  case "shared-board":return sharedBoardHTML(plan,feedback);
  case "selection":return selectionHTML(plan);
  case "gallery":{
   const columns=plan.showItems?1:Math.min(plan.photos.length,4);
   const photos=plan.photos.map(photo=>{
    const row=!plan.showItems&&inlineRows(feedback).find(entry=>entry.label===photo.label);
    const answer=row?inlineAnswer(row,row.answer,"caption",row.label,plan.bank??[]):"";
    return '<figure class="practice-photo"><img src="'+esc(photo.src)+'" alt="'+esc(photo.alt)+'"><figcaption>'+esc(photo.label)+answer+'</figcaption></figure>';
   }).join("");
   const ratio=plan.photoRatio??1.55, rows=Math.ceil(plan.photos.length/columns);
   const gallery='<div class="practice-gallery" style="--photo-columns:'+columns+';--photo-rows:'+rows+';--photo-ratio:'+ratio+'">'+photos+'</div>';
   return plan.showItems?'<div class="split practice-paired"><section class="panel">'+gallery+'</section><section class="panel">'+items+'</section></div>':wordBank(plan.bank,true)+gallery;
  }
  case "native":
   return '<figure class="focus-image practice-native"><img src="'+esc(plan.src)+'" alt="'+esc(plan.alt)+'"></figure>';
  case "definitions":
   return '<div class="split practice-paired"><section class="panel practice-definitions">'+plan.entries.map(([word,meaning])=>'<p><strong>'+esc(word)+'</strong> '+esc(meaning)+'</p>').join("")+'</section><section class="panel">'+items+'</section></div>';
  case "table":
   return '<div class="v-block practice-table">'+wordBank(plan.bank,true)+taskTable(plan,feedback)+'</div>';
  case "text":
   return '<div class="paper v-block practice-text'+(plan.paperStyle==="textbook"?' textbook-panel':'')+'">'+inlinePassageHTML(plan.text,feedback)+'</div>';
  case "match":{
   const left=plan.left.map(([label,text])=>itemWithFeedback({label,prompt:text},feedback)).join("");
   const right=plan.right.map(([label,text])=>{
    const row=inlineRows(feedback).find(entry=>entry.anchor?.matching===label);
    return '<div class="v-item"><span class="num">'+esc(label)+'</span><p class="match-sentence"'+(row?markAttr(row.label):"")+'>'+esc(text)+'</p></div>';
   }).join("");
   return '<div class="split practice-paired"><section class="panel">'+left+'</section><section class="panel">'+right+'</section></div>';
  }
  case "writing":{
   const lines=plan.rows.map(([word,number],i)=>{
    const row=inlineRows(feedback).find(entry=>entry.label===number);
    return '<li><span class="num">'+esc(number)+'</span>'+(i===0?'<p data-note-given>'+esc(plan.example)+'</p>':row?inlineAnswer(row,row.answer,"line"):'<p>'+esc(word)+'</p>')+'</li>';
   }).join("");
   const file=plan.factFile?factFileHTML(plan.factFile):'<figure class="panel practice-fact"><img src="'+esc(plan.image)+'" alt="'+esc(plan.alt)+'"></figure>';
   return '<div class="split practice-paired">'+file+'<section class="panel"><ol class="practice-lines">'+lines+'</ol></section></div>';
  }
  default:
   return '<div class="v-block">'+wordBank(plan.bank??bank)+'<div'+(plan.twoColumns?' class="practice-two-columns" style="--item-rows:'+Math.ceil(plan.itemCount/2)+'"':'')+'>'+items+'</div></div>';
 }
}

function feedbackProofHTML(row,playback){
 const excerpt=row.proofParts?'<p class="check-proof-excerpt">'+markedParts(row.proofParts)+'</p>':"";
 const originalPage=row.sourcePage?'<button type="button" data-proof-page="'+row.sourcePage+'">教材第 '+row.sourcePage+' 页</button>':"";
 const replay=Number.isFinite(row.seek)&&playback?'<button type="button" data-proof-time="'+row.seek+'">'+(playback.type==="video"?"回看片段":"回听片段")+'</button>':"";
 const rewrite=row.anchor?.showCorrection&&row.answer.includes("\n")?'<p class="check-proof-excerpt">'+esc(row.answer.split("\n")[1])+'</p>':"";
 return '<p class="check-basis">'+esc(row.basis)+'</p>'+rewrite+excerpt+
  (originalPage||replay?'<div class="check-links">'+originalPage+replay+'</div>':"");
}

function playbackHTML(config,showTitle=true){
 if(!config)return "";
 const video=config.type==="video";
 const name=video?"video":"audio";
 const player='<'+name+' src="'+esc(config.src)+'" preload="'+(config.fixed?'metadata':'none')+'" controls'+(video?' playsinline':'')+'></'+name+'>';
 const close='<button type="button" data-playback-close>关闭</button>';
 return '<section class="'+(video?'playback-video':'playback-audio')+'" data-playback hidden aria-label="'+esc(config.title)+'"><div class="playback-label">'+
  (showTitle?'<strong>'+esc(config.title)+'</strong>':"")+close+'</div>'+
  player+'<p data-playback-error hidden>原文件加载失败。</p></section>';
}

function lessonRailHTML(c){
 const material=c.presentation?.sourcePage?'<button type="button" data-task-source="'+c.presentation.sourcePage+'">'+esc(c.presentation.sourceLabel??"材料")+'</button>':"";
 const player=c.playback?'<button type="button" data-playback-toggle aria-expanded="false">'+(c.playback.type==="video"?"视频":"录音")+'</button>':"";
 const check=inlineRows(c.feedback).length?inlineCheckControls():"";
 const numberMarks=c.numberMarks?'<button type="button" data-number-marks aria-pressed="false">圈画</button>':"";
 return check+material+player+numberMarks;
}

function wirePlayback(doc){
 const panel=doc.querySelector("[data-playback]");
 if(!panel)return null;
 const toggle=doc.querySelector("[data-playback-toggle]");
 const media=panel.querySelector("audio,video");
 const error=panel.querySelector("[data-playback-error]");
 function close(){
  media.pause();
  panel.hidden=true;
  toggle.setAttribute("aria-expanded","false");
 }
 function open(offset,autoplay=true){
  panel.hidden=false;
  toggle?.setAttribute("aria-expanded","true");
  error.hidden=true;
  if(!Number.isFinite(offset))return;
  media.currentTime=offset;
  if(!autoplay)return;
  media.play().catch(failure=>{
   if(panel.hidden||failure.name==="AbortError")return;
   error.textContent=failure.name==="NotAllowedError"?"请点击播放器的播放键。":"原文件加载失败。";
   error.hidden=false;
  });
 }
 if(toggle){
  toggle.onclick=()=>panel.hidden?open():close();
  panel.querySelector("[data-playback-close]").onclick=close;
 }
 media.addEventListener("playing",()=>error.hidden=true);
 media.addEventListener("error",()=>{error.textContent="原文件加载失败。";error.hidden=false});
 return {open,close};
}

function alignGalleryAnswers(doc){
 for(const gallery of doc.querySelectorAll(".practice-gallery")){
  const fields=[...gallery.querySelectorAll("[data-field=caption]")];
  if(!fields.length)continue;
  const height=Math.ceil(Math.max(...fields.map(field=>field.getBoundingClientRect().height)));
  gallery.style.setProperty("--photo-answer-height",height+"px");
 }
}

function wireLessonControls(doc,c,resume){
 alignGalleryAnswers(doc);
 const playback=wirePlayback(doc)??courseProofVideo(doc,c);
 if(resume)playback?.open(resume.offset,resume.playing);
 if(c.flow?.kind==="video")playback?.open();
 if(c.presentation?.kind==="classification-diagram")drawClassification(doc,c.presentation);
 if(c.feedback?.placement==="inline")wireInlineCheck(doc,c,playback);
 if(c.presentation?.kind==="shared-board")wireSharedBoard(doc,c.presentation,c);
 if(c.presentation?.kind==="selection")wireSelection(doc,c.presentation,c);
 const numberMarks=doc.querySelector("[data-number-marks]");
 if(numberMarks)numberMarks.onclick=()=>{
  const shown=doc.querySelector(".reading").classList.toggle("show-number-marks");
  numberMarks.setAttribute("aria-pressed",String(shown));
  numberMarks.textContent=shown?"收起":"圈画";
 };
 for(const btn of doc.querySelectorAll("[data-task-source]"))btn.onclick=()=>original(c,Number(btn.dataset.taskSource),btn);
}

function lessonAssetsReady(doc){
 const chart=doc.querySelector("[data-classification-art]");
 return (!chart||chart.dataset.drawn==="true")&&[...doc.images].every(img=>img.complete&&img.naturalWidth>0);
}

function wireProofLinks(root,playback,c){
 for(const button of root.querySelectorAll("[data-proof-page]"))button.onclick=()=>original(c,Number(button.dataset.proofPage),button);
 for(const button of root.querySelectorAll("[data-proof-time]"))button.onclick=()=>playback?.open(Number(button.dataset.proofTime));
}

function inlineAnchor(label,body,extra=""){
 return '<span class="inline-anchor" data-inline-item="'+esc(label)+'"'+extra+'>'+body+'</span>';
}

function inlineValue(value,material=null,bank=[]){
 const content=bank.length?numberBankTerms(value,bank):esc(value);
 return '<span data-inline-value aria-hidden="true"'+(material===null?"":' data-inline-deck="'+esc(material)+'"')+'>'+content+'</span>';
}

function inlinePresentationHTML(c){
 const plan=c.presentation;
 const answers=new Map(c.feedback.rows.map(row=>[row.label,row]));
 switch(plan.kind){
  case "note-slots":{
   const groups=plan.groups.map(lines=>'<li>'+lines.map(line=>'<p>'+line.map(part=>{
    if(typeof part==="string")return esc(part);
    const index=part.printLabel===false?"":'<sup class="note-index">('+esc(part.label)+')</sup>';
    const field=part.given!==undefined?'<span class="note-given" data-note-given>'+esc(part.given)+'</span>':inlineAnswer(answers.get(part.label),undefined,part.size?"note-"+part.size:"note");
    return '<span class="note-field">'+index+field+'</span>';
   }).join("")+'</p>').join("")+'</li>').join("");
   return '<ul class="inline-notes'+(plan.bullets===false?' note-list':'')+'">'+groups+'</ul>';
  }
  case "judgments":{
   const statements=c.items.map(item=>{
    const row=answers.get(item.label), [mark,correction]=row.answer.split("\n");
    const status=inlineAnchor(item.label,inlineValue(mark),' data-field="judgment"'+(mark==="F"?' data-inline-false':''));
    const copy='<p data-inline-original>'+esc(item.prompt)+'</p>'+(correction?'<p data-inline-correction>'+esc(correction)+'</p>':"");
    return '<li data-inline-row'+markAttr(item.label)+'>'+status+'<span class="num">'+esc(item.label)+'</span><div class="statement-copy">'+copy+'</div></li>';
   }).join("");
   return '<ol class="inline-judgments">'+statements+'</ol>';
  }
  case "map-labels":return routeMapHTML(plan,c.feedback);
  default:return null;
 }
}


function inlineCheckControls(){
 return '<button type="button" data-inline-check>核对</button>'+
  '<button type="button" data-inline-evidence aria-controls="inline-proof" aria-expanded="false" disabled>依据</button>';
}

function inlineProofHTML(c){
 if(c.feedback?.placement!=="inline")return "";
 return '<section class="inline-proof" id="inline-proof" aria-labelledby="inline-proof-title" hidden>'+
  '<header><h2 id="inline-proof-title"></h2><button type="button" class="close" data-inline-proof-close>关闭</button></header>'+
  '<div data-inline-proof-content></div><div class="check-links proof-pager" data-inline-proof-pager hidden>'+
  '<button type="button" data-inline-proof-prev>上一项依据</button><button type="button" data-inline-proof-next>下一项依据</button></div></section>';
}

function activeMaterial(doc){
 return doc.querySelector('[data-deck][aria-pressed="true"]')?.dataset.deck??"0";
}

function inlineKey(item){
 return item.dataset.inlineKey??item.dataset.inlineItem;
}

function inlineLabel(item){
 return item.dataset.inlineItem??item.dataset.inlineMark;
}

function intersects(a,b,margin=0){
 return a.left<b.right+margin&&a.right>b.left-margin&&a.top<b.bottom+margin&&a.bottom>b.top-margin;
}

function placeInlineProof(proof,protectedElements){
 const area=proof.parentElement.getBoundingClientRect(), box=proof.getBoundingClientRect();
 const elements=protectedElements.map(el=>el.getBoundingClientRect());
 const left=area.left+36, right=area.right-box.width-36, top=area.top+26, bottom=area.bottom-box.height-32;
 const hasMap=proof.parentElement.querySelector(".with-inline-map");
 const coordinates=(hasMap?[[left,bottom],[left,top],[right,bottom],[right,top]]:[[right,bottom],[left,bottom],[right,top],[left,top]]);
 const [x,y]=coordinates.find(([x,y])=>elements.every(el=>!intersects({left:x,right:x+box.width,top:y,bottom:y+box.height},el,7)))??coordinates[0];
 proof.style.left=x-area.left+"px";
 proof.style.top=y-area.top+"px";
 proof.style.right="auto";
 proof.style.bottom="auto";
}

function wireInlineCheck(doc,c,playback){
 const rows=new Map(c.feedback.rows.map(row=>[row.label,row]));
 const items=[...doc.querySelectorAll("[data-inline-item]")];
 const marks=[...doc.querySelectorAll("[data-inline-mark]")];
 const check=doc.querySelector("[data-inline-check]"), evidence=doc.querySelector("[data-inline-evidence]");
 const proof=doc.getElementById("inline-proof"), title=doc.getElementById("inline-proof-title");
 const close=proof.querySelector("[data-inline-proof-close]"), copy=proof.querySelector("[data-inline-proof-content]");
 const pager=proof.querySelector("[data-inline-proof-pager]");
 const previous=proof.querySelector("[data-inline-proof-prev]"), next=proof.querySelector("[data-inline-proof-next]");
 const decks=new Map();
 const materialDependent=c.feedback.rows.some(row=>row.byMaterial);

 function getState(){
  const material=materialDependent?activeMaterial(doc):"0";
  if(!decks.has(material))decks.set(material,{count:0,proofIndex:0});
  return decks.get(material);
 }

 function paint(el,shown,material){
  el.toggleAttribute("data-inline-shown",shown);
  for(const value of el.querySelectorAll("[data-inline-value]")){
   const active=shown&&(!value.hasAttribute("data-inline-deck")||value.dataset.inlineDeck===material);
   value.setAttribute("aria-hidden",String(!active));
  }
 }

 function refresh(){
  const {count,proofIndex}=getState(), material=activeMaterial(doc);
  const revealed=new Set(items.slice(0,count).map(inlineKey));
  for(const item of items)paint(item,revealed.has(inlineKey(item)),material);
  for(const mark of marks)paint(mark,revealed.has(mark.dataset.inlineMark),material);
  const full=count===items.length&&count>0;
  check.disabled=items.length===0;
  check.textContent=full?"收起":count?"下一项":"核对";
  check.setAttribute("aria-label",full?"收起本页核对内容":"原位揭示第 "+(count+1)+" 项");
  evidence.disabled=count===0;
  if(proof.hidden||!count)return;
  const item=items[proofIndex], label=inlineLabel(item), row=rows.get(label);
  title.textContent=(/^\d+$/.test(label)?"第 "+inlineKey(item)+" 项":label)+"的依据";
  copy.innerHTML=feedbackProofHTML(row.byMaterial?{...row,sourcePage:row.materialPages?.[material]??row.sourcePage}:row,playback);
  wireProofLinks(copy,playback,c);
  pager.hidden=count<2;
  previous.disabled=proofIndex===0;
  next.disabled=proofIndex===count-1;
  const targets=[item,...marks.filter(mark=>inlineLabel(mark)===label)];
  placeInlineProof(proof,targets.filter(el=>el.getClientRects().length));
 }

 function closeProof(restoreFocus){
  proof.hidden=true;
  evidence.setAttribute("aria-expanded","false");
  if(restoreFocus)evidence.focus({preventScroll:true});
 }

 check.onclick=()=>{
  const state=getState();
  if(state.count===items.length){
   state.count=0;
   closeProof(false);
  }else{
   state.count++;
   state.proofIndex=state.count-1;
  }
  refresh();
 };
 evidence.onclick=()=>{
  if(!proof.hidden){closeProof(false);return;}
  getState().proofIndex=getState().count-1;
  proof.hidden=false;
  evidence.setAttribute("aria-expanded","true");
  refresh();
  close.focus({preventScroll:true});
 };
 previous.onclick=()=>{getState().proofIndex--;refresh()};
 next.onclick=()=>{getState().proofIndex++;refresh()};
 close.onclick=()=>closeProof(true);
 doc.addEventListener("keydown",event=>{
  if(event.key==="Escape"&&!proof.hidden)closeProof(true);
 });
 if(materialDependent)doc.addEventListener("classroom-material-change",()=>{closeProof(false);refresh()});
 refresh();
}

function inspectInlineCheck(doc,c){
 const items=[...doc.querySelectorAll("[data-inline-item]")];
 const labels=[...new Set(items.map(inlineLabel))], keys=items.map(inlineKey);
 const visible=el=>el.getClientRects().length&&doc.defaultView.getComputedStyle(el).visibility==="visible";
 const changed=()=>items.filter(item=>item.hasAttribute("data-inline-shown")).map(inlineKey);
 const origin=doc.querySelector(".content"), control=doc.querySelector("[data-inline-check]");
 const state=()=>[...doc.querySelectorAll(".slide-area,.content,[data-original-instruction],.inline-notes p,.v-item,.v-options li,[data-inline-item],[data-inline-mark],[data-inline-value],[data-inline-correction],.practice-photo,.native-crop,td")]
  .map(el=>el.getBoundingClientRect().toJSON());
 const geometry=JSON.stringify(state()), text=origin.innerText;
 const values=[...doc.querySelectorAll("[data-inline-value],[data-inline-correction]")];
 const initiallyHidden=changed().length===0&&values.every(el=>!visible(el))&&!doc.querySelector("[data-inline-mark][data-inline-shown]");
 if(!items.length)return {labels,points:0,initiallyHidden,hasPositions:false};
 items[0].click();
 const singleControl=doc.querySelectorAll("[data-inline-check]").length===1&&changed().length===0&&
  items.every(item=>!item.closest("button,[role=button]")&&item.tabIndex<0);
 const unique=new Set(keys).size===keys.length;
 const stepOrder=items.map((_,i)=>{
  control.click();
  return changed().join(",")===keys.slice(0,i+1).join(",");
 }).every(Boolean);
 const allShown=changed().length===items.length&&control.textContent==="收起";
 const stable=JSON.stringify(state())===geometry;
 const hasPositions=unique&&items.every(item=>[...item.querySelectorAll("[data-inline-value]")].some(visible)||
  [...doc.querySelectorAll("[data-inline-mark][data-inline-shown]")].some(mark=>inlineLabel(mark)===inlineLabel(item)&&visible(mark)));
 const clip=doc.querySelector(".slide-area").getBoundingClientRect();
 const readable=values.filter(visible).every(el=>{
  const range=doc.createRange();
  range.selectNodeContents(el);
  const box=(el.closest("[data-field],.statement-copy,.board-response,.inline-replacement")??el).getBoundingClientRect();
  const rect=range.getBoundingClientRect();
  return rect.left>=box.left-1.5&&rect.right<=box.right+1.5&&rect.bottom<=box.bottom+1.5&&!outside(el,clip);
 });
 const centered = items.filter(item=>item.dataset.field==="judgment").every(item=>{
  const range=doc.createRange();
  range.selectNodeContents(item.querySelector("[data-inline-value]"));
  const text=range.getBoundingClientRect(), box=item.getBoundingClientRect();
  return Math.abs((text.left+text.right)-(box.left+box.right))<=2 &&
   Math.abs((text.top+text.bottom)-(box.top+box.bottom))<=4;
 });
 const originalsVisible=[...doc.querySelectorAll(".inline-judgments [data-inline-original]")].every(visible);
 const proof=doc.getElementById("inline-proof");
 doc.querySelector("[data-inline-evidence]").click();
 const previous=proof.querySelector("[data-inline-proof-prev]");
 const proofShown=items.slice().reverse().map((item,i)=>{
  if(i)previous.click();
  const row=c.feedback.rows.find(r=>r.label===inlineLabel(item));
  const copy=proof.querySelector(".check-basis");
  return visible(proof)&&copy?.textContent===row.basis&&!outside(proof,clip)&&!intersects(proof.getBoundingClientRect(),item.getBoundingClientRect());
 }).every(Boolean);
 proof.querySelector("[data-inline-proof-close]").click();
 const proofReturned=proof.hidden&&changed().length===items.length;
 control.click();
 const restored=changed().length===0&&control.textContent==="核对"&&JSON.stringify(state())===geometry&&origin.innerText===text&&values.every(el=>!visible(el));
 return {labels,points:items.length,initiallyHidden,singleControl,stepOrder,allShown,stable,hasPositions,readable,proofShown,proofReturned,restored,centered,originalsVisible};
}

const sharedBoards=new Map();
const sharedSelections=new Map();

function markedParts(parts,label){
 return parts.map(part=>{
  if(!part.mark)return esc(part.text);
  if(part.mark==="link"){
   return part.text.split(" ").map((word,i)=>{
    if(!i)return esc(word);
    const given=part.givenLinks?.includes(i-1);
    return '<span class="check-link-junction"'+(label&&!given?markAttr(label):"")+'> </span>'+esc(word);
   }).join("");
  }
  return '<span class="check-mark '+esc(part.mark)+'"'+(label?markAttr(label):"")+'>'+esc(part.text)+'</span>';
 }).join("");
}

function cropHTML(photo,overlay=""){
 const [x,y,width,height]=photo.box;
 const ratio=width/height;
 const imgStyle='width:'+(100*(photo.nativeWidth??772)/width)+'%;left:'+(-100*x/width)+'%;top:'+(-100*y/height)+'%';
 return '<div class="native-view"><div class="native-crop" style="--crop-ratio:'+ratio+'"><img src="'+esc(photo.src)+'" alt="'+esc(photo.alt)+'" style="'+imgStyle+'">'+overlay+'</div></div>';
}

function cropsHTML(plan,items){
 const photos=plan.photos.map(photo=>cropHTML(photo)).join("");
 const gallery='<div class="native-gallery" style="--photo-columns:'+Math.min(plan.photos.length,4)+'">'+photos+'</div>';
 if(plan.showItems)return '<div class="split practice-paired crop-paired"><section class="panel">'+gallery+'</section><section class="panel">'+items+'</section></div>';
 return wordBank(plan.bank,true)+(plan.text?'<p class="practice-cue">'+esc(plan.text)+'</p>':"")+gallery;
}

function sharedBoardHTML(plan,feedback){
 const bank=wordBank(plan.bank,true);
 const fields=plan.labels.map((label,i)=>{
  const row=inlineRows(feedback).find(entry=>entry.anchor?.kind==="board"&&entry.anchor.at===i);
  const title=row?inlineHit(row,label,"board-label"):esc(label);
  const answer=row?'<div class="board-response"'+markAttr(row.label)+'>'+inlineValue(row.display??row.answer,null,plan.bank)+'</div>':"";
  const heading='<h3>'+title+'</h3>';
  const cue=plan.hints?.[i]?'<div class="shared-board-heading">'+heading+'<p>'+esc(plan.hints[i])+'</p></div>':heading;
  return '<section class="shared-board-cell">'+cue+
   (plan.examples[i]?'<p class="shared-board-example">'+(Array.isArray(plan.examples[i])?markedParts(plan.examples[i]):esc(plan.examples[i]))+'</p>':"")+
   '<div class="shared-board-entry"><textarea aria-label="'+esc(label)+'" data-board-field="'+i+'"></textarea>'+answer+'</div></section>';
 }).join("");
 const headers=plan.headers?'<div class="shared-board-column-head">'+plan.headers.map(label=>'<span>'+esc(label)+'</span>').join("")+'</div>':"";
 return '<div class="shared-board">'+(plan.opening?'<p class="practice-cue">'+esc(plan.opening)+'</p>':"")+bank+headers+
  '<div class="shared-board-grid '+esc(plan.layout)+'" style="--board-columns:'+plan.labels.length+'">'+fields+'</div></div>';
}

function selectionHTML(plan){
 return '<div class="selection-area"><header class="selection-header"><h2>'+esc(plan.title)+'</h2><p data-selection-count aria-live="polite"></p></header>'+
  (plan.example?'<p class="practice-cue">'+esc(plan.example)+'</p>':"")+'<div data-selection-list></div></div>';
}

function wireSelection(doc,plan,c){
 const key=classroom.workKey(c,plan.key);
 const list=doc.querySelector("[data-selection-list]");
 const count=doc.querySelector("[data-selection-count]");
 if(!sharedSelections.has(key))sharedSelections.set(key,{chosen:[],agreed:null,agreedEdited:false,order:[]});
 const state=sharedSelections.get(key);
 if(plan.mode==="agree"&&!state.agreedEdited){
  const changed=state.agreed?.join(",")!==state.chosen.join(",");
  state.agreed=state.chosen.slice();
  if(changed)state.order=state.agreed.length===7?state.agreed.slice():[];
 }
 const ranking=plan.mode==="rank";
 const current=()=>plan.mode==="choose"?state.chosen:state.agreed??[];
 function update(){
  const selected=current();
  const total=ranking?state.order.length:selected.length;
  count.textContent=total+" / 7";
  list.className="selection-list "+(ranking?"ranking":"choosing");
  if(ranking&&total!==7){
   list.innerHTML='<p class="practice-cue">先在 Ex 2 确定七条共同选择的事实。</p><button type="button" data-selection-back>回到 Ex 2</button>';
   return;
  }
  const facts=ranking?state.order.map(label=>plan.facts.find(fact=>fact.label===label)):plan.facts;
  list.innerHTML=facts.map((fact,i)=>{
   const active=selected.includes(fact.label);
   const choice='<button type="button" data-selection-choice="'+esc(fact.label)+'" aria-pressed="'+active+'"'+(!active&&selected.length>=7?' disabled':'')+'>'+(active?"已选":"选入")+'</button>';
   const order='<button type="button" data-order-index="'+i+'" data-direction="-1"'+(i===0?' disabled':'')+'>上移</button>'+
    '<button type="button" data-order-index="'+i+'" data-direction="1"'+(i===facts.length-1?' disabled':'')+'>下移</button>';
   return '<div class="selection-item"><span class="num">'+(ranking?i+1:esc(fact.label))+'</span><p>'+esc(fact.text)+'</p><div class="selection-buttons">'+(ranking?order:choice)+'</div></div>';
  }).join("");
 }
 list.addEventListener("click",event=>{
  const choose=event.target.closest("[data-selection-choice]");
  const move=event.target.closest("[data-order-index]");
  if(choose){
   const label=choose.dataset.selectionChoice,values=current(),index=values.indexOf(label);
   if(index>=0)values.splice(index,1);
   else if(values.length<7)values.push(label);
   if(plan.mode==="agree"){
    state.agreedEdited=true;
    state.order=values.length===7?values.slice():[];
   }
   update();
  }
  if(move){
   const i=Number(move.dataset.orderIndex),j=i+Number(move.dataset.direction);
   if(j<0||j>=state.order.length)return;
   [state.order[i],state.order[j]]=[state.order[j],state.order[i]];
   update();
  }
  if(event.target.closest("[data-selection-back]")){
   const i=cases.findIndex(other=>other.presentation?.mode==="agree"&&classroom.workKey(other,other.presentation.key)===key);
   if(i>=0)display(i);
  }
 });
 if(plan.mode==="agree"&&state.agreed.length===7&&state.order.length!==7)state.order=state.agreed.slice();
 update();
}

function wireSharedBoard(doc,plan,c){
 const key=classroom.workKey(c,plan.key);
 if(!sharedBoards.has(key))sharedBoards.set(key,plan.labels.map(()=>""));
 const values=sharedBoards.get(key);
 for(const field of doc.querySelectorAll("[data-board-field]")){
  const i=Number(field.dataset.boardField);
  field.value=values[i];
  field.addEventListener("input",()=>{values[i]=field.value});
 }
}

function numberMarkup(text,targets=[]){
 const literal=targets.slice().sort((a,b)=>b.length-a.length).map(value=>value.replace(/[.*+?^$(){}|[\]\\]/g,"\\$&"));
 if(!literal.length)return esc(text);
 const pattern=new RegExp("(?<![A-Za-z0-9])("+literal.join("|")+")(?![A-Za-z0-9])","g");
 let result="",cursor=0;
 for(const hit of text.matchAll(pattern)){
  result+=esc(text.slice(cursor,hit.index))+'<span class="reading-number">'+esc(hit[0])+'</span>';
  cursor=hit.index+hit[0].length;
 }
 return result+esc(text.slice(cursor));
}
