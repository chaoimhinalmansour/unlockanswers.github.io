(()=>{'use strict';
  const page=location.pathname.split('/').pop()||'index.html';
  const params=new URLSearchParams(location.search);
  const current=page.includes('-alpha')?'alpha':page==='index.html'&&params.get('version')==='alpha'?'alpha':'old';
  const names={old:{teacher:'teacher.html',student:'student.html',homework:'homework.html'},alpha:{teacher:'teacher-alpha.html',student:'student-alpha.html',homework:'homework-alpha.html'}};
  window.UNLOCK_VERSION={current,label:current==='alpha'?'新版':'旧版'};
  function rewrite(){
    for(const a of document.querySelectorAll('a[href]')){
      let u;try{u=new URL(a.getAttribute('href'),location.href);}catch{continue;}
      if(u.origin!==location.origin)continue;
      const file=u.pathname.split('/').pop();
      if(file==='index.html'){u.searchParams.set('version',current);a.href=u.href;}
      if(page==='index.html')for(const kind of ['teacher','student'])if([names.old[kind],names.alpha[kind]].includes(file)){u.pathname=u.pathname.slice(0,u.pathname.lastIndexOf('/')+1)+names[current][kind];u.searchParams.set('version',current);a.href=u.href;}
    }
  }
  function change(next){
    document.querySelectorAll('audio,video').forEach(a=>a.pause());
    const f=document.querySelector('#homework-frame');f?.contentWindow.postMessage({type:'unlock-pause'},location.origin==='null'?'*':location.origin);
    const kind=page.startsWith('teacher')?'teacher':page.startsWith('student')?'student':page.startsWith('homework')?'homework':'index';
    const u=new URL(kind==='index'?'index.html':names[next][kind],location.href);u.searchParams.set('version',next);u.hash=location.hash;
    if(kind==='student'){
      const state=window.STUDENT_TEST?.state;
      if(state)for(const k of ['book','unit','h'])u.searchParams.set(k,state[k]);
    }
    location.assign(u.href);
  }
  function init(){
    rewrite();
    const top=document.querySelector('.apple-navigation')||document.querySelector('.apple-onebar .apple-context .apple-filter-row')||document.querySelector('.apple-onebar .apple-context')||document.querySelector('body>header');
    if(!top)return;
    const field=document.createElement('label');field.className='apple-select-field unlock-version-field';
    const caption=document.createElement('span');caption.textContent='版本';
    const select=document.createElement('select');select.setAttribute('aria-label','版本');select.className='apple-select unlock-version-select';
    for(const [value,label]of [['old','旧版'],['alpha','新版']]){const o=document.createElement('option');o.value=value;o.textContent=label;select.append(o);}
    select.value=current;select.title=current==='alpha'?'2026 Fall alpha 1.0 Reviewed r2':'现行旧版';select.onchange=()=>change(select.value);field.append(caption,select);
    if(page==='index.html'){top.append(field);document.querySelector('header>span')?.classList.add('unlock-version-hide-small');}
    else top.prepend(field);
    if(page.startsWith('student')){
      for(const [key,id]of [['book','books'],['unit','units'],['h','homeworks']]){
        const n=Number(params.get(key));
        if(Number.isInteger(n)&&n>0)document.querySelector('#'+id+' [data-'+key+'="'+n+'"]')?.click();
      }
    }
    document.title=(current==='alpha'?'新版':'旧版')+' | '+document.title.replace(/^(旧版|新版) \| /,'');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
