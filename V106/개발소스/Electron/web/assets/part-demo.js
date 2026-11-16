export function createPartDemo(getPreview) {
  const figure = document.createElement('figure');
  figure.className = 'lesson-part-demo';
  figure.hidden = true;
  figure.innerHTML = '<div class="part-demo-heading"><strong class="part-demo-name"></strong><button type="button" aria-label="부품 꺼내기 시범 일시정지" aria-pressed="false">일시정지</button></div>' +
    '<svg viewBox="0 0 320 232" role="img" aria-label="왼쪽 아래 부품함을 클릭하고 필요한 부품을 골라 가운데 제작대로 끌어다 놓는 시범">' +
    '<rect x="1" y="1" width="318" height="230" rx="12" class="demo-work"/><path d="M44 1v230M44 32h275" class="demo-line"/>' +
    '<text x="180" y="22" text-anchor="middle">제작대</text><rect x="8" y="175" width="31" height="42" rx="7" class="demo-trigger"/><path d="M15 187h16m-13-5v10m10-10v10" class="demo-line"/><text x="23" y="208" text-anchor="middle" font-size="9">부품함</text>' +
    '<g class="demo-drawer"><rect x="48" y="52" width="100" height="154" rx="10" class="demo-card"/><text x="98" y="72" text-anchor="middle">부품함</text><rect x="58" y="83" width="80" height="105" rx="7" class="demo-slot"/><g class="demo-source-art"></g></g>' +
    '<rect x="193" y="77" width="108" height="114" rx="12" class="demo-drop"/><text x="247" y="210" text-anchor="middle" font-size="11">여기에 놓아요</text>' +
    '<g class="demo-moving-part"><g class="demo-drag-art"></g></g>' +
    '<circle cx="23" cy="193" r="19" class="demo-click demo-first-click"/><circle cx="98" cy="130" r="19" class="demo-click demo-second-click"/>' +
    '<g class="demo-cursor"><path d="M0 0v24l6-6 5 11 5-2-5-11h10Z" class="demo-cursor-shape"/></g></svg>' +
    '<figcaption><span>① 부품함 열기</span><span>② 그림 선택</span><span>③ 제작대로 이동</span></figcaption>';
  const button = figure.querySelector('button');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function applyPreference() {
    button.disabled = reduced.matches;
    button.title = reduced.matches ? '동작 줄이기 설정에 따라 정지 그림으로 보여요.' : '';
  }
  reduced.addEventListener('change', applyPreference);
  applyPreference();
  button.onclick = () => {
    const paused = figure.classList.toggle('demo-paused');
    button.textContent = paused ? '재생' : '일시정지';
    button.setAttribute('aria-pressed', String(paused));
    button.setAttribute('aria-label', '부품 꺼내기 시범 ' + (paused ? '재생' : '일시정지'));
  };
  function show(id, name) {
    figure.hidden = false;
    figure.dataset.part = id;
    figure.querySelector('.part-demo-name').textContent = '가져올 부품 · ' + name;
    for (const selector of ['.demo-source-art', '.demo-drag-art']) {
      const slot = figure.querySelector(selector);
      slot.replaceChildren();
      const art = getPreview(id);
      if (art) {
        art.setAttribute('x', '65'); art.setAttribute('y', '92');
        art.setAttribute('width', '66'); art.setAttribute('height', '82');
        art.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        art.setAttribute('aria-hidden', 'true');
        slot.append(art);
      }
    }
    figure.querySelector('svg').setAttribute('aria-label', '왼쪽 아래 부품함을 열고 ' + name + ' 그림을 선택해 가운데 제작대로 옮기는 시범. 직접 실습하려면 부품함에서 찾기를 누르세요.');
  }
  return { element: figure, show, hide: () => { figure.hidden = true; } };
}
