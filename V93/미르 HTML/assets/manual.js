window.addEventListener('message', event => {
  if (event.source !== window.parent || event.data?.type !== 'mir-manual-theme') return;
  const { theme } = event.data;
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
});
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const mouseHover = matchMedia('(hover: hover) and (pointer: fine)');
const easeOut = 'cubic-bezier(0.23,1,0.32,1)';
const easeTravel = 'cubic-bezier(0.77,0,0.175,1)';
const show = [{opacity:0},{opacity:1}];
const hold = [{opacity:1},{opacity:1}];
const move = (distance) => [{opacity:1,transform:'translateX(0)'},{opacity:1,transform:`translateX(${distance}px)`}];
const scenes = {
  // The first point is the cursor entrance, and paired points hold it on the target.
  start: { path:[[0,99,111],[480,57,67],[680,57,67],[1160,148,63],[1420,148,63]], clicks:[1] },
  parts: { path:[[0,27,66],[440,50,44],[610,50,44],[1310,227,44],[1490,227,44],[1720,246,61]], clicks:[1,3] },
  wire: { path:[[0,49,69],[420,77,45],[640,77,45],[1140,203,45],[1340,203,45],[1580,222,64]], clicks:[1,3] },
  move: {
    path:[[0,9,60],[420,26,18],[570,26,18],[1270,178,73],[1460,178,73],
      [1890,69,45],[2050,69,45],[2730,151,45],[2920,151,45],[3170,173,61]],
    clicks:[1,3,5,7]
  },
  power: { path:[[0,24,69],[400,47,43],[650,47,43],[1150,145,43],[1370,145,43],[1610,163,63]], clicks:[1,3] },
  save: { path:[[0,119,47],[430,144,68],[680,144,68],[1050,176,72]], clicks:[1] },
  agent: { path:[[0,43,55],[390,68,29],[620,68,29],[1110,189,29],[1310,189,29],[1570,210,45]], clicks:[1,3] }
};
const groupPath = scenes.move.path;
const selectStart = groupPath[2][0];
const selectEnd = groupPath[3][0];
const selectDuration = selectEnd - selectStart;
const dragStart = groupPath[6][0];
const dragEnd = groupPath[7][0];
const demos = {
  start: [show, 480, 150],
  result: [show, 730, 240],
  drag: [move(177), 610, 700, easeTravel],
  first: [hold, 420, 150, easeOut, 'none'],
  second: [hold, 1140, 150, easeOut, 'none'],
  wire: [[{opacity:1,transform:'scaleX(.01)'},{opacity:1,transform:'scaleX(1)'}], 1140, 240],
  marquee: [[
    {opacity:1,transform:'scale(.01)',easing:easeTravel},
    {opacity:1,transform:'scale(1)',offset:selectDuration/(selectDuration+180),easing:easeOut},
    {opacity:0,transform:'scale(1)'}
  ], selectStart, selectDuration+180, 'linear'],
  shift: [[{opacity:1},{opacity:1,offset:.86,easing:easeOut},{opacity:0}], groupPath[1][0], groupPath[4][0]-groupPath[1][0], 'linear'],
  selected: [show, selectEnd, 150],
  group: [move(groupPath[7][1]-groupPath[6][1]), dragStart, dragEnd-dragStart, easeTravel],
  toggle: [show, 400, 180],
  gpio: [show, 1150, 180],
  light: [show, 1250, 240],
  file: [move(169), 490, 650, easeTravel],
  saved: [show, 1140, 240],
  ask: [show, 390, 240],
  answer: [show, 1320, 240]
};
const svgNS = 'http://www.w3.org/2000/svg';
const translate = (x, y) => `translate(${x}px,${y}px)`;

let stopPreviousDemo;
window.addEventListener('message', event => {
  if (event.source === window.parent && event.data?.type === 'mir-manual-close') stopPreviousDemo?.();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopPreviousDemo?.();
});
for (const figure of document.querySelectorAll('section figure')) {
  const diagram = figure.querySelector('svg');
  const step = figure.closest('section');
  const scene = scenes[step.id];
  const shapes = [...diagram.querySelectorAll('[data-motion]')];

  const rings = scene.clicks.map(index => {
    const [,x,y] = scene.path[index];
    const ring = document.createElementNS(svgNS, 'circle');
    ring.setAttribute('class', 'demo-click');
    ring.setAttribute('cx', x);
    ring.setAttribute('cy', y);
    ring.setAttribute('r', 10);
    diagram.append(ring);
    return ring;
  });
  const pointer = document.createElementNS(svgNS, 'path');
  pointer.setAttribute('class', 'demo-pointer');
  pointer.setAttribute('d', 'M0 0L0 19L5 14L9 20L12 18L8 12L16 11Z');
  diagram.append(pointer);

  let loopTimer;
  const clear = () => diagram.getAnimations({subtree:true}).forEach(animation => animation.cancel());
  const stop = () => {
    clearTimeout(loopTimer);
    if (stopPreviousDemo === stop) stopPreviousDemo = undefined;
    clear();
  };
  const updatePreference = () => { stop(); figure.tabIndex = reduced.matches ? -1 : 0; };
  updatePreference();
  reduced.addEventListener('change', updatePreference);

  const run = () => {
    if (stopPreviousDemo !== stop) return;
    clear();
    const duration = scene.path.at(-1)[0] + 140;
    const [lastTime, lastX, lastY] = scene.path.at(-1);
    const [firstTime, firstX, firstY] = scene.path[0];
    const cursorFrames = [
      {offset:0, transform:translate(firstX,firstY), opacity:0, easing:easeOut},
      {offset:(firstTime + 100)/duration, transform:translate(firstX,firstY), opacity:1, easing:easeTravel},
      ...scene.path.slice(1).map(([time,x,y]) => ({
        offset:time/duration, transform:translate(x,y), opacity:1, easing:time === lastTime ? easeOut : easeTravel
      })),
      {offset:1, transform:translate(lastX,lastY), opacity:0}
    ];
    const cursor = pointer.animate(cursorFrames, {duration});
    for (const [i, ring] of rings.entries()) {
      ring.animate([{opacity:.9,transform:'scale(.95)'},{opacity:0,transform:'scale(1.55)'}],
        {delay:scene.path[scene.clicks[i]][0],duration:240,easing:easeOut});
    }
    for (const shape of shapes) {
      const [frames,delay,duration,easing=easeOut,fill='forwards'] = demos[shape.dataset.motion];
      shape.animate(frames, {duration,delay,fill,easing});
    }
    cursor.finished.then(() => {
      if (stopPreviousDemo === stop) loopTimer = setTimeout(run, 850);
    }, () => {});
  };
  const play = () => {
    if (reduced.matches || stopPreviousDemo === stop) return;
    stopPreviousDemo?.();
    stopPreviousDemo = stop;
    run();
  };
  figure.addEventListener('focus', play);
  step.addEventListener('pointerenter', event => {
    if (mouseHover.matches && event.pointerType === 'mouse') play();
  });
}
