export function createTutorialGhost({ getTargets, getPowerTarget = () => null }) {
  const ns = 'http://www.w3.org/2000/svg';
  const overlay = document.createElementNS(ns, 'svg');
  overlay.id = 'tutorialGhost';
  overlay.setAttribute('aria-hidden', 'true');
  document.body.append(overlay);
  let frame = null, running = false, previous = '';
  function node(tag, attributes, parent = overlay) {
    const element = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    parent.append(element);
    return element;
  }
  function paint() {
    const targets = getTargets().filter(element => element?.getClientRects().length).slice(0, 2);
    const positions = targets.map(element => {
      const r = element.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, pin: element.classList.contains('pin-hit'), key: element.dataset.key };
    });
    const power = getPowerTarget();
    const rect = power?.getClientRects().length ? power.getBoundingClientRect() : null;
    const powerPosition = rect && rect.width > 0 && rect.height > 0 ? { x: rect.x + rect.width / 2, top: rect.top, bottom: rect.bottom } : null;
    const signature = JSON.stringify([innerWidth, innerHeight, positions, powerPosition]);
    if (signature === previous) return;
    previous = signature;
    overlay.replaceChildren();
    overlay.setAttribute('viewBox', '0 0 ' + innerWidth + ' ' + innerHeight);
    // 전원 켜기 단계만 실제 버튼의 화면 좌표에 맞춰 가리킨다.
    if (powerPosition && powerPosition.x >= 8 && powerPosition.x <= innerWidth - 8 && powerPosition.bottom > 0 && powerPosition.top < innerHeight) {
      const { x } = powerPosition;
      const below = powerPosition.bottom + 76 <= innerHeight;
      const tipY = below ? powerPosition.bottom + 9 : powerPosition.top - 9;
      const direction = below ? 1 : -1;
      const tailY = tipY + direction * 50;
      const headY = tipY + direction * 12;
      const d = `M${x} ${tailY}V${tipY}M${x - 9} ${headY}L${x} ${tipY}L${x + 9} ${headY}`;
      const group = node('g', { class: 'tutorial-power-guide', 'data-tip-x': x, 'data-tip-y': tipY });
      node('path', { d, fill:'none', stroke:'var(--surface)', 'stroke-width':8, 'stroke-linecap':'round', 'stroke-linejoin':'round' }, group);
      node('path', { d, fill:'none', stroke:'currentColor', 'stroke-width':3.5, 'stroke-linecap':'round', 'stroke-linejoin':'round' }, group);
    }

    if (positions.length === 2 && positions.every(p => p.pin)) {
      const [a, b] = positions;
      const dx = (b.x - a.x) * .45;
      const d = 'M' + a.x + ' ' + a.y + ' C' + (a.x + dx) + ' ' + a.y + ' ' + (b.x - dx) + ' ' + b.y + ' ' + b.x + ' ' + b.y;
      node('path', { d, class:'tutorial-ghost-halo' });
      node('path', { d, class:'tutorial-ghost-wire' });
    }
  }

  function tick() { if (!running) return; paint(); frame = requestAnimationFrame(tick); }
  return {
    start() { if (running) return; running = true; previous = ''; tick(); },
    stop() { running = false; cancelAnimationFrame(frame); frame = null; previous = ''; overlay.replaceChildren(); }
  };
}
