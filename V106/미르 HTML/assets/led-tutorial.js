import { circuitDemo } from './tutorial-circuit-demo.js';
import { createPartDemo } from './part-demo.js';
import { createTutorialGhost } from './tutorial-ghost.js';
const PART_IDS = ['esp32-devkitc', 'resistor-220', 'led-red'];
const linked = (wires, a, b) => wires.some(wire =>
  (wire.from === a && wire.to === b) || (wire.from === b && wire.to === a));

export function ledLessonState(state, seenHigh = false) {
  const parts = PART_IDS.map(id => state.instances.find(part => part.part === id));
  const missing = parts.findIndex(part => !part);
  if (missing >= 0) return { step: missing, parts, seenHigh: false, pins: [] };
  const [board, resistor, led] = parts;
  const boardPin = board.ref + '.GPIO26';
  const firstPin = linked(state.wires, boardPin, resistor.ref + '.P2') ? 'P2' : 'P1';
  const otherPin = firstPin === 'P1' ? 'P2' : 'P1';
  const pairs = [
    [boardPin, resistor.ref + '.' + firstPin],
    [resistor.ref + '.' + otherPin, led.ref + '.A'],
    [led.ref + '.K', board.ref + '.GND1']
  ];
  const groundKeys = ['GND1', 'GND2', 'GND3'].map(pin => board.ref + '.' + pin);
  const ground = state.wires.find(wire => groundKeys.some(key =>
    (wire.from === pairs[2][0] && wire.to === key) || (wire.to === pairs[2][0] && wire.from === key)));
  if (ground) pairs[2] = [ground.from, ground.to];
  const complete = pairs.map(pair => linked(state.wires, ...pair));
  const extra = state.wires.some(wire => !pairs.some(([a, b]) =>
    (wire.from === a && wire.to === b) || (wire.from === b && wire.to === a)));
  const firstMissing = complete.indexOf(false);
  if (firstMissing >= 0) return { step: firstMissing + 3, parts, pins: pairs[firstMissing], seenHigh: false, extra };
  if (extra || state.instances.length !== 3 || state.wires.length !== 3) {
    return { step: 5, parts, pins: [], seenHigh: false, extra: true };
  }
  if (!state.power) return { step: 6, parts, pins: [], seenHigh: false };
  const light = state.sim?.parts?.[led.ref];
  const high = seenHigh || (state.gpio[boardPin] === 'HIGH' && light?.lit && !light?.burnt);
  if (!high) return { step: 7, parts, pins: [], seenHigh: false };
  const done = state.gpio[boardPin] === 'LOW' && light && !light.lit;
  return { step: done ? 9 : 8, parts, pins: [], seenHigh: true };
}

export function initLedTutorial({ getState, reset, openPart, fit, closeParts, getPreview = () => null }) {
  let active = false, seenHigh = false, starting = false, lastStep = -1, previousFocus = null;
  const panel = document.createElement('aside');
  panel.id = 'ledTutorial';
  panel.className = 'led-tutorial';
  panel.hidden = true;
  panel.setAttribute('aria-labelledby', 'ledTutorialTitle');
  panel.innerHTML = '<header><span>처음 배우는 배선</span><button id="btnTutorialAbout" type="button">부품 소개</button><button id="btnTutorialExit" aria-label="튜토리얼 닫기">×</button></header>' +
    '<p id="ledTutorialProgress" class="tutorial-progress"></p><progress id="ledTutorialMeter" max="9" value="0" aria-label="LED 튜토리얼 진행"></progress>' +
    '<h2 id="ledTutorialTitle"></h2><p id="ledTutorialText"></p><ol id="ledTutorialTasks" class="tutorial-tasks"></ol><details class="tutorial-word"><summary>이 단계의 말이 낯설어요</summary><p id="ledTutorialWord"></p></details>' +
    '<div class="tutorial-diagram" id="tutorialCircuitDemo"></div>' +
    '<p id="ledTutorialStatus" role="status" aria-live="polite"></p><div class="tutorial-actions"><button id="btnTutorialHelp" class="primary"></button><button id="btnTutorialFit">회로 보기</button></div>' +
    '<p class="tutorial-note">가상 실습이에요. 실제 배선은 전원을 분리한 뒤 진행하세요. LED에는 직렬 저항이 필요해요.</p>';
  document.body.append(panel);
  const partDemo = createPartDemo(getPreview);
  document.getElementById('ledTutorialTitle').after(partDemo.element);
  const welcome = document.createElement('dialog');
  welcome.id = 'ledTutorialWelcome';
  welcome.setAttribute('aria-labelledby', 'tutorialWelcomeTitle');
  welcome.innerHTML = '<header><span>배선을 처음 해도 괜찮아요</span><button id="btnTutorialWelcomeClose" aria-label="튜토리얼 소개 닫기">×</button></header>' +
    '<h2 id="tutorialWelcomeTitle">작은 불빛 하나를 켜 볼까요?</h2>' +
    '<p class="tutorial-intro">배선은 <strong>부품의 연결 지점을 선으로 이어 전기가 다닐 길을 만드는 것</strong>이에요.</p>' +
    '<div class="tutorial-ready"><strong>지금은 미르 안에서 연습해요.</strong><p>실물 부품·USB 연결·API 키를 준비하지 않아도 돼요. 필요한 가상 부품 세 개가 미르의 부품함에 들어 있어요.</p></div>' +
    '<div class="tutorial-kit"><article><div data-preview="esp32-devkitc"></div><h3>보드 · ESP32</h3><p>신호를 보내 불을 켜고 끄는 작은 제어판이에요. ESP32는 이번에 사용할 보드의 이름이에요.</p></article>' +
    '<article><div data-preview="resistor-220"></div><h3>저항 · 220Ω</h3><p>전류가 너무 많이 흐르지 않도록 도와 LED를 보호해요. Ω은 저항의 크기를 나타내는 단위예요.</p></article>' +
    '<article><div data-preview="led-red"></div><h3>LED · 작은 표시등</h3><p>전기가 알맞은 방향으로 흐르면 빛나요. 두 다리에는 연결 방향이 있어요.</p></article></div>' +
    '<section class="tutorial-map"><h3>화면에서 이렇게 찾아요</h3><ol><li><strong>왼쪽 아래 부품함</strong>에서 가상 부품을 꺼내요.</li><li><strong>가운데 제작대</strong>에 놓인 부품의 동그란 핀을 눌러 연결해요.</li><li><strong>위쪽 가상 전원</strong>을 켜고 보드 신호를 바꿔 불을 켜요.</li></ol><p>점선은 아직 연결하지 않은 길을 보여줘요. 실제 선은 1번 핀, 2번 핀을 차례로 누르면 생겨요.</p></section>' +
    '<details><summary>부품은 어디에서 구하나요?</summary><p>이번 연습은 미르의 부품함만 있으면 돼요. 부품을 사러 갈 필요가 없어요. 나중에 실물로 만들 때는 전자부품 판매처에서 보드·LED·저항 등을 준비하고, 사용 중인 보드의 핀 배치와 사양을 먼저 확인해요. 화면의 실습과 실물 조립은 별도로 진행해요.</p></details>' +
    '<details><summary>틀리거나 중간에 나가면요?</summary><p>가상 실습이므로 실물 부품이 손상되지 않아요. 잘못 만든 선은 선택해서 삭제하거나 Ctrl+Z로 되돌릴 수 있어요. 안내창의 ×를 누르면 만든 회로를 남긴 채 실습을 멈출 수 있어요.</p></details>' +
    '<div class="tutorial-welcome-actions"><button id="btnTutorialBegin" class="primary">준비됐어요 · 가상 부품 꺼내기</button></div>';
  document.body.append(welcome);
  function start() { void startPractice(); }
  function showIntroduction() {
    if (welcome.open || starting) return;
    for (const target of welcome.querySelectorAll('[data-preview]')) {
      const preview = getPreview(target.dataset.preview);
      target.replaceChildren();
      if (preview) { preview.setAttribute('aria-hidden', 'true'); target.append(preview); }
    }
    welcome.showModal();
  }
  document.getElementById('btnTutorialWelcomeClose').onclick = () => welcome.close();
  document.getElementById('btnTutorialBegin').onclick = () => { welcome.close(); if (!active) void startPractice(); };
  document.getElementById('btnTutorialAbout').onclick = showIntroduction;
  let ghostTargets = [];
  const ghost = createTutorialGhost({ getPowerTarget: () => active && panel.dataset.step === '6' ? document.getElementById('btnPower') : null, getTargets: () => ghostTargets.map(element => element.dataset.key ? [...document.querySelectorAll('#canvas .pin-hit')].find(pin => pin.dataset.key === element.dataset.key) : element) });
  const titles = ['보드를 직접 꺼내 볼까요?', '저항도 꺼내 주세요', '마지막 부품은 LED예요', '보드에서 저항으로 연결', '저항에서 LED로 연결', 'GND로 돌아오는 선 연결', '가상 전원을 켜 주세요', 'HIGH로 LED 켜기', 'LOW로 LED 끄기', '첫 LED 회로를 완성했어요!'];
  const $ = id => document.getElementById(id);
  const clearTargets = () => document.querySelectorAll('.tutorial-target').forEach(el => el.classList.remove('tutorial-target'));
  function stop() {
    active = false; seenHigh = false; lastStep = -1;
    ghost.stop();
    ghostTargets = [];
    partDemo.hide();
    panel.hidden = true;
    document.body.classList.remove('led-lesson-active');
    clearTargets();
    if (previousFocus?.isConnected && previousFocus.getClientRects().length) previousFocus.focus({ preventScroll: true });
  }
  async function startPractice() {
    if (starting) return;
    starting = true;
    try {
      if (!await reset()) return;
      previousFocus = document.activeElement;
      active = true; seenHigh = false; lastStep = -1;
      document.body.classList.add('led-lesson-active');
      panel.hidden = false;
      ghost.start();
      update();
      $('btnTutorialHelp').focus({ preventScroll: true });
    } finally { starting = false; }
  }
  function update() {
    if (!active) return;
    const lesson = ledLessonState(getState(), seenHigh);
    seenHigh = lesson.seenHigh;
    const { step, parts, pins } = lesson;
    const [board, resistor, led] = parts;
    const descriptions = [
      '보드는 작은 제어판이에요. 이번에는 ESP32라는 보드를 사용해요.',
      '저항은 LED에 전류가 너무 많이 흐르지 않게 도와줘요.',
      'LED의 A(+)는 긴 다리, K(-)는 짧은 다리예요.',
      '점선은 연결할 위치를 보여주는 안내선이에요.',
      '전류가 저항을 지나 LED로 가도록 연결해요.',
      'GND까지 연결하면 전류가 돌아오는 길이 완성돼요.',
      '이제 가상 회로에 전원을 공급해 볼까요?',
      'HIGH는 GPIO26에서 높은 전압을 내보내는 상태예요.',
      '불이 켜졌어요! 이번에는 낮은 전압 상태로 바꿔 볼게요.',
      '부품 꺼내기부터 배선과 점등까지 직접 해냈어요.'
    ];
    const tasks = [
      ['부품함에서 찾기를 누르면 왼쪽 아래 상자가 열려요.', '상자 안의 ESP32 그림을 클릭하면 가운데 제작대에 놓여요.'],
      ['부품함에서 찾기를 눌러 저항을 찾아요.', '색 띠가 그려진 220Ω 저항을 클릭해 꺼내세요.'],
      ['부품함에서 찾기를 눌러 작은 표시등을 찾아요.', '빨간 LED 그림을 클릭해 제작대에 놓으세요.'],
      ['보드의 26(GPIO26) 핀을 클릭하세요.', '저항의 1 또는 2 핀을 클릭하세요.'],
      ['저항의 아직 연결하지 않은 핀을 클릭하세요.', 'LED의 A(+) 핀을 클릭하세요.'],
      ['LED의 K(-) 핀을 클릭하세요.', '보드의 GND 핀을 클릭하세요.'],
      ['위쪽 가상 전원 버튼을 누르세요.', 'OFF가 ON으로 바뀌는지 확인하세요.'],
      ['GPIO26 줄의 HIGH를 누르세요.', '제작대의 LED가 켜지는지 살펴보세요.'],
      ['GPIO26 줄의 LOW를 누르세요.', 'LED가 꺼지면 실습 완료예요.'],
      ['자유롭게 만들기를 눌러 실습을 마치세요.', '만든 회로를 저장하거나 바꿔 보세요.']
    ];
    if (step !== lastStep) {
      $('ledTutorialTitle').textContent = step < 3 ? '이렇게 꺼내 보세요' : titles[step];
      if (step < 3) partDemo.show(PART_IDS[step], ['ESP32 보드', '220Ω 저항', '빨간 LED'][step]);
      else partDemo.hide();
      $('ledTutorialText').textContent = descriptions[step];
      const words = [
        '부품은 회로를 이루는 각각의 물건이에요. 보드, 저항, LED가 모두 부품이에요. 여기서는 미르가 제공하는 가상 그림을 꺼내 사용해요.',
        '220Ω은 이 저항의 저항값이에요. 옴이라고 읽어요. 이번 실습에서는 값을 바꾸지 않고 그대로 사용해요.',
        'A(+)는 전류가 들어오는 쪽, K(-)는 나가는 쪽이에요. 긴 다리와 짧은 다리를 화면에서는 A와 K로 구분해요.',
        '핀은 선을 연결하는 단자예요. 화면에서는 동그라미로 보여요. GPIO는 보드가 신호를 주고받는 핀이고, 26은 그 핀의 번호예요. 드래그하지 않고 두 핀을 차례로 클릭해도 연결돼요.',
        '직렬 연결은 보드 → 저항 → LED처럼 한 길로 차례대로 잇는 것이에요. 저항은 방향이 없어서 양쪽 중 어느 핀부터 사용해도 돼요.',
        'GND는 그라운드라고 읽어요. 전압을 비교하는 기준이자 이 실습에서 전류가 돌아오는 연결점이에요. 보드의 GND 중 하나를 사용하면 돼요.',
        '가상 전원은 미르 안의 회로 계산을 켜는 버튼이에요. 실물 USB나 전원을 연결하는 단계가 아니에요.',
        'HIGH는 하이라고 읽어요. 이 가상 ESP32에서는 GPIO에 약 3.3V를 출력하는 상태예요. 여기서는 코드를 쓰는 대신 화면의 HIGH 버튼으로 시험해요.',
        'LOW는 로우라고 읽어요. GPIO를 낮은 전압 상태로 바꿔 LED가 꺼지는지 확인해요.',
        '이 실습에서 바꾼 것은 미르 안의 가상 회로예요. 만든 회로를 보관하려면 파일 메뉴의 저장을 사용하세요. 실물로 만들 때는 보드 사양과 배선을 다시 확인해요.'
      ];
      $('ledTutorialWord').textContent = words[step];
      panel.querySelector('.tutorial-word').open = false;
      $('ledTutorialTasks').replaceChildren(...tasks[step].map(text => {
        const item = document.createElement('li'); item.textContent = text; return item;
      }));
      $('ledTutorialProgress').textContent = step === 9 ? '9 / 9 단계 완료' : (step + 1) + ' / 9 단계';
      $('ledTutorialMeter').value = step;
      $('btnTutorialHelp').textContent = step < 3 ? '부품함에서 찾기' : step < 6 ? '연결할 핀 보기' : step === 6 ? '전원 버튼 보기' : step < 9 ? 'GPIO 조작판 보기' : '자유롭게 만들기';
      panel.dataset.step = String(step);
      $('tutorialCircuitDemo').innerHTML = step >= 3 ? circuitDemo(step) : '';
      $('tutorialCircuitDemo').dataset.demo = step >= 3 && step <= 5 ? 'connect' : 'power';
      lastStep = step;
      panel.scrollTop = 0;
      requestAnimationFrame(() => { if (active) fit(); });
    }
    $('ledTutorialStatus').textContent = lesson.extra
      ? '안내와 다른 선이나 부품이 있어요. 불필요한 선·부품을 선택하고 삭제해 주세요. 삭제는 되돌릴 수 있어요.'
      : step < 6 && getState().power ? '배선을 바꾸기 전에 가상 전원을 OFF로 바꿔 주세요.' : '';
    clearTargets();
    if (step < 3) document.querySelectorAll('[data-part-id="' + PART_IDS[step] + '"]').forEach(el => el.classList.add('tutorial-target'));
    for (const key of pins) document.querySelectorAll('#canvas .pin-hit').forEach(el => { if (el.dataset.key === key) el.classList.add('tutorial-target'); });
    if (step < 3 && !$('partsPalette').hidden) { /* The filtered part is highlighted above. */ }
    else if (step < 3) $('btnTutorialHelp').classList.add('tutorial-target');
    if (step === 6) $('btnPower').classList.add('tutorial-target');
    if (step === 7 || step === 8) {
      const key = board.ref + '.GPIO26';
      document.querySelectorAll('#gpioList .gpio-row').forEach(row => {
        if (row.querySelector('.gname')?.textContent === board.ref + '.26') row.querySelector('[data-m="' + (step === 7 ? 'HIGH' : 'LOW') + '"]')?.classList.add('tutorial-target');
      });
    }
    ghostTargets = pins.length ? pins.map(key => [...document.querySelectorAll('#canvas .pin-hit')].find(el => el.dataset.key === key)).filter(Boolean)
      : [...document.querySelectorAll('.tutorial-target')];

  }
  $('btnTutorialHelp').onclick = () => {
    const step = Number(panel.dataset.step);
    if (step < 3) { openPart(PART_IDS[step]); update(); }
    else if (step === 9) { stop(); }
    else { closeParts(); fit(); update(); if (step === 6) $('btnPower').focus({ preventScroll: true }); }
  };
  $('btnTutorialFit').onclick = () => { closeParts(); fit(); update(); };
  $('btnTutorialExit').onclick = stop;
  const entry = document.createElement('button');
  entry.id = 'btnLedTutorial'; entry.className = 'tutorial-entry'; entry.textContent = 'LED 튜토리얼 바로 시작'; entry.onclick = start;
  document.getElementById('btnBuildManually').after(entry);
  return { start, stop, update, get active() { return active; } };
}
