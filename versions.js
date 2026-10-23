(()=>{'use strict';
window.UNLOCK_VERSION={current:'alpha',label:'当前版本'};
function init(){
 const aliases={'teacher-alpha.html':'teacher.html','student-alpha.html':'student.html','homework-alpha.html':'homework.html'};
 for(const a of document.querySelectorAll('a[href]')){
  let u;try{u=new URL(a.getAttribute('href'),location.href)}catch{continue}
  if(u.origin!==location.origin)continue;
  const file=u.pathname.split('/').pop();
  if(aliases[file])u.pathname=u.pathname.slice(0,u.pathname.lastIndexOf('/')+1)+aliases[file];
  if(['index.html','teacher.html','student.html','homework.html',...Object.keys(aliases)].includes(file)){u.searchParams.delete('version');u.searchParams.set('v','20261023-current');a.href=u.href;}
 }
 if(location.pathname.endsWith('/student.html')){
  const params=new URLSearchParams(location.search);
  for(const [key,id]of [['book','books'],['unit','units'],['h','homeworks']]){const n=Number(params.get(key));if(Number.isInteger(n)&&n>0)document.querySelector('#'+id+' [data-'+key+'="'+n+'"]')?.click();}
 }
 document.title=document.title.replace(/^(旧版|新版) \| /,'');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();