const rail = document.createElement('aside');
rail.className = 'workspace-rail';
rail.id = 'workspaceRail';
rail.inert = false;
rail.setAttribute('aria-label', '작업 공간 메뉴');
rail.innerHTML = `<div class="frame-brand"></div>
<button class="frame-new" data-target="btnNew"><span aria-hidden="true">＋</span> 새 프로젝트</button>
<nav aria-label="작업 공간"><button class="frame-current" aria-current="page" data-target="workspace"><span aria-hidden="true">▣</span> 제작판</button><button data-target="btnWireSettings"><span aria-hidden="true">⚙</span> 앱 설정</button><button data-target="btnSettings"><span aria-hidden="true">↗</span> 에이전트 연결</button></nav>
<section class="frame-project"><span>현재 프로젝트</span><strong id="frameProjectName">새 프로젝트</strong><hr class="project-section-divider"><span class="recent-project-heading">최근 프로젝트</span><div id="recentProjects" aria-label="최근 프로젝트"></div><p id="recentProjectStatus" role="status"></p></section>
<footer><strong>PLAYLABS</strong><span>만들며 배우는 전자 실습</span></footer>`;
document.body.append(rail);
const brand = document.querySelector('.brand');
const menu = document.getElementById('btnMenu');
brand.removeChild(menu);
rail.querySelector('.frame-brand').append(brand);
const top = document.querySelector('.topbar');
const heading = document.createElement('div');heading.className='frame-heading';
heading.append(menu);
top.prepend(heading);
const save=document.createElement('button');save.textContent='프로젝트 저장';save.onclick=()=>document.getElementById('btnSave').click();document.querySelector('.top-actions').append(save);
rail.addEventListener('click',e=>{const b=e.target.closest('[data-target]');if(!b)return;const id=b.dataset.target;if(id==='workspace'){document.querySelector('.canvas').focus();return;}document.getElementById(id)?.click();});
menu.setAttribute('aria-controls','workspaceRail');
menu.setAttribute('aria-expanded','false');
menu.setAttribute('aria-label','메뉴 열기');
function setFrameOpen(open, keyboard=false) {
  document.body.classList.toggle('frame-no-motion',keyboard);
  document.body.classList.toggle('frame-open',open);
  menu.setAttribute('aria-expanded',String(open));
  menu.setAttribute('aria-label',open?'메뉴 닫기':'메뉴 열기');
  const details=rail.querySelector('.frame-project');
  details.inert=!open;
  if(!open && details.contains(document.activeElement))menu.focus();
}
rail.querySelectorAll('button[data-target]').forEach(button=>{
  const label=button.textContent.trim().replace(/^[＋▣⚙↗]\s*/, '');
  button.setAttribute('aria-label',label);button.title=label;
  const text=[...button.childNodes].find(n=>n.nodeType===Node.TEXT_NODE && n.textContent.trim());
  if(text){const span=document.createElement('span');span.className='frame-label';span.textContent=text.textContent;text.replaceWith(span);}
});
rail.querySelector('.frame-project').inert=true;
menu.addEventListener('click',e=>{e.stopImmediatePropagation();setFrameOpen(!document.body.classList.contains('frame-open'),e.detail===0);},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape' && document.body.classList.contains('frame-open') && !document.querySelector('dialog[open],.modal:not(.hidden)')){setFrameOpen(false,true);e.preventDefault();}});
