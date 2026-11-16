const dialog = document.getElementById('wireSettings');
const key = 'mir-accent-color';
const defaultColor = '#1c74c4';
let selected = null;
try { const saved = localStorage.getItem(key); if (/^#[0-9a-f]{6}$/i.test(saved || '')) selected = saved; } catch {}
const root = document.documentElement;
const tokens = ['--primary','--primary-hover','--primary-active','--primary-soft','--primary-text','--on-primary'];
function mix(color, target, amount) {
  const rgb = color.match(/\w\w/g).map(v => parseInt(v,16));
  return '#' + rgb.map(v => Math.round(v+(target-v)*amount).toString(16).padStart(2,'0')).join('');
}
function apply() {
  if (!selected) { tokens.forEach(k => root.style.removeProperty(k)); return; }
  const dark = root.dataset.theme === 'dark' || (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  const base = dark ? mix(selected.slice(1),255,.32) : selected;
  const values = base.slice(1).match(/\w\w/g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  const luminance = .2126*values[0]+.7152*values[1]+.0722*values[2];
  const colors = [base,mix(base.slice(1),dark?255:0,.15),mix(base.slice(1),dark?255:0,.28),mix(selected.slice(1),dark?0:255,dark?.78:.93),dark?mix(selected.slice(1),255,.65):mix(selected.slice(1),0,.48),luminance>.179?'#000000':'#ffffff'];
  tokens.forEach((k,i)=>root.style.setProperty(k,colors[i]));
}
const tabs = document.createElement('div');tabs.className='settings-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','설정 종류');
const wiring = document.createElement('section');wiring.id='settingsWiringPanel';wiring.setAttribute('role','tabpanel');wiring.setAttribute('aria-labelledby','settingsWiringTab');
for(const el of [...dialog.children])if(el.matches('.wiring-options,.wire-preview'))wiring.append(el);
const appearance = document.createElement('section');appearance.id='settingsColorPanel';appearance.setAttribute('role','tabpanel');appearance.setAttribute('aria-labelledby','settingsColorTab');appearance.hidden=true;
appearance.innerHTML='<h3>메인 색상</h3><p class="muted">버튼과 강조 표시에 사용할 색상을 골라 주세요.</p><div class="accent-presets" aria-label="추천 색상"></div><label class="accent-custom">직접 고르기 <input id="accentColor" type="color" aria-label="메인 색상 직접 고르기"></label><div class="accent-sample"><button class="primary" type="button">버튼 미리보기</button><span class="badge">강조 색상</span></div><button id="accentReset" type="button">기본 색상으로</button><p id="accentStatus" role="status" class="muted"></p>';
const theme = document.createElement('section');
theme.id = 'settingsThemePanel';
theme.setAttribute('role', 'tabpanel');
theme.setAttribute('aria-labelledby', 'settingsThemeTab');
theme.innerHTML = '<fieldset class="theme-options"><legend>테마 설정</legend><label><input type="radio" name="appTheme" value="light"> 라이트</label><label><input type="radio" name="appTheme" value="dark"> 다크</label></fieldset>';

const panels = [wiring, appearance, theme];
const tabLabels = ['배선 형태', '메인 색상', '다크/라이트 모드'];
const buttons = tabLabels.map((label, i) => {
  const button = document.createElement('button');
  button.id = panels[i].getAttribute('aria-labelledby');
  button.type = 'button';
  button.textContent = label;
  button.setAttribute('role', 'tab');
  button.setAttribute('aria-controls', panels[i].id);
  button.onclick = () => activate(i);
  button.onkeydown = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const offset = event.key === 'ArrowLeft' ? -1 : 1;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? panels.length - 1 : (i + offset + panels.length) % panels.length;
    activate(next, true);
  };
  return button;
});
function activate(index, focus = false) {
  panels.forEach((panel, i) => { panel.hidden = i !== index; });
  buttons.forEach((button, i) => {
    button.setAttribute('aria-selected', String(i === index));
    button.tabIndex = i === index ? 0 : -1;
  });
  if (focus) buttons[index].focus();
}
tabs.append(...buttons);
dialog.append(tabs, ...panels);
activate(0);
const input=appearance.querySelector('#accentColor');
function update(){input.value=selected||defaultColor;appearance.querySelectorAll('[data-color]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.color===input.value)));apply()}
function choose(value){selected=value;let saved=true;try{if(value)localStorage.setItem(key,value);else localStorage.removeItem(key)}catch{saved=false}update();document.getElementById('accentStatus').textContent=saved?'색상을 적용하고 저장했어요.':'색상을 적용했지만 저장할 수 없어요. 이번 실행에만 유지됩니다.'}
for(const [name,color] of [['파랑','#1c74c4'],['보라','#7950c8'],['초록','#218565'],['주황','#c96517'],['분홍','#b83e78'],['청록','#087f8c']]){const b=document.createElement('button');b.type='button';b.dataset.color=color;b.style.setProperty('--swatch',color);b.setAttribute('aria-label',name);b.title=name;b.onclick=()=>choose(color);appearance.querySelector('.accent-presets').append(b)}
input.oninput=()=>choose(input.value);document.getElementById('accentReset').onclick=()=>choose(null);
new MutationObserver(apply).observe(root,{attributes:true,attributeFilter:['data-theme']});matchMedia('(prefers-color-scheme: dark)').addEventListener('change',apply);update();
