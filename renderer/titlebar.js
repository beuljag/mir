const bar=document.createElement('header');bar.className='desktop-titlebar';bar.setAttribute('aria-label','앱 메뉴');
const click=id=>document.getElementById(id)?.click();
function button(label,text,action){const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',label);b.title=label;b.textContent=text;b.onclick=action;return b;}
bar.append(button('메뉴 열기/닫기','◧',()=>click('btnMenu')));
const groups=[['파일',[['새 프로젝트','btnNew'],['외부에서 가져오기','btnOpen'],['저장','btnSave'],['다른 이름으로 저장','btnSaveAs'],['배선 API · DB','btnBackend']]],['편집',[['되돌리기','btnUndo'],['다시 하기','btnRedo'],['삭제','btnDelete']]],['보기',[['화면에 맞추기','btnFit'],['확대','btnZoomIn'],['축소','btnZoomOut'],['다크/라이트 모드','btnTheme']]],['도움말',[['처음 사용하는 분을 위한 설명서','btnManual'],['연결 안내','guide'],['에이전트 연결 설정','btnSettings']]]];
for(const [name,items] of groups){const d=document.createElement('details');d.className='desktop-menu';const summary=document.createElement('summary');summary.textContent=name;const popup=document.createElement('div');popup.className='desktop-menu-popup';for(const [text,id] of items)popup.append(button(text,text,()=>{d.open=false;if(id==='guide')window.api.openDoc('Copilot-Studio-연결-안내.md');else click(id);}));d.append(summary,popup);d.addEventListener('toggle',()=>{if(d.open)for(const other of bar.querySelectorAll('details'))if(other!==d)other.open=false;});d.addEventListener('keydown',e=>{if(e.key==='Escape'){d.open=false;summary.focus();}});bar.append(d);}
document.body.prepend(bar);
document.addEventListener('pointerdown',e=>{if(!bar.contains(e.target))bar.querySelectorAll('details').forEach(d=>d.open=false);});

let lastTitlebarColors="";
function syncTitlebarColor(){
 let color=getComputedStyle(document.body).getPropertyValue('--frame-bg').trim();
 const modalOpen=!!document.querySelector('dialog[open]:modal, .modal:not(.hidden)');
 if(modalOpen && /^#[0-9a-f]{6}$/i.test(color)) color='#'+color.slice(1).match(/../g).map(x=>Math.round(parseInt(x,16)*.68+15*.32).toString(16).padStart(2,'0')).join('');
 const symbolColor=color==='#172332'?'#f4f4f4':'#202124';
 const signature=color+symbolColor;if(signature===lastTitlebarColors)return;lastTitlebarColors=signature;
 window.api?.setTitlebarColors?.({color,symbolColor});
}
new MutationObserver(syncTitlebarColor).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',syncTitlebarColor);
syncTitlebarColor();
const workspaceMenu=document.getElementById('btnMenu');const titlebarToggle=bar.querySelector(':scope > button');if(workspaceMenu && titlebarToggle)titlebarToggle.replaceWith(workspaceMenu);
const railMenu=document.getElementById('btnMenu');
const railBrand=document.querySelector('.frame-brand');
if(railMenu && railBrand)railBrand.after(railMenu);
const connectionPill=document.getElementById('connPill');
const chatToggle=document.getElementById('btnChatToggle');
if(connectionPill && chatToggle){chatToggle.after(connectionPill);connectionPill.classList.add('chat-connection-pill');}
if(connectionPill)bar.append(connectionPill);

new MutationObserver(syncTitlebarColor).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open','class']});
