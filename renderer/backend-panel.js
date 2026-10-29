import { CircuitApi, toCircuitDraft, fromCircuit, definitionToPart, loadComponentImage, loadComponentCatalog } from './circuit-api.js';
import { runtimeApi } from './web-api.js?v=chat-recovery-2';

export function initBackendPanel({ getState, replace, renderParts, message }) {
  const $ = (id) => document.getElementById(id);
  let client = null, current = null, busy = false, saved = '';
  const status = (text) => { $('dbStatus').textContent = text; };
  const draft = () => toCircuitDraft(getState(), current);
  function reset() { client = null; current = null; saved = ''; $('dbCircuitId').value = ''; status('새 회로 · DB 저장 전'); }
  async function run(action) {
    if (busy) return;
    busy = true;
    ['btnDbConnect', 'btnDbLoad', 'btnDbSave', 'btnDbValidate', 'btnDbClose'].forEach((id) => { $(id).disabled = true; });
    try { await action(); }
    catch (e) { status(`실패: ${e.message}`); message(`배선 API: ${e.message}`); }
    finally {
      busy = false;
      ['btnDbConnect', 'btnDbLoad', 'btnDbSave', 'btnDbValidate', 'btnDbClose'].forEach((id) => { $(id).disabled = false; });
    }
  }
  async function connect() {
    if (!(await runtimeApi.getAutoAuthStatus?.())?.ready) throw new Error('서버 연결이 준비되지 않았습니다. 연결 설정의 공유 서버 주소·키 또는 로컬 서버 실행 상태를 확인하세요.');
    const next = new CircuitApi(runtimeApi.requestCircuit, '');
    const parts = await loadComponentCatalog(next);
    client = next;
    for (const def of parts) {
      const old = getState().defs.get(def.id);
      const converted = definitionToPart(def);
      const samePins = old && JSON.stringify(old.pins.map((p) => p.id).sort()) === JSON.stringify(def.pins.map((p) => p.id).sort());
      const base = samePins ? { ...old, ...converted,
        pins: converted.pins.map((p) => ({ ...p, side: old.pins.find((x) => x.id === p.id).side })) } : converted;
      delete base._layout;
      getState().defs.set(def.id, await loadComponentImage(next, base));
    }
    renderParts();
    status(`서버 자동 연결됨 · 등록 부품 ${parts.length}개`);
  }
  async function requireClient() { if (!client) await connect(); }
  async function load() {
    await requireClient();
    const id = $('dbCircuitId').value.trim();
    if (!id) throw new Error('에이전트가 반환한 회로 ID를 입력하세요.');
    if (getState().instances.length && !confirm('현재 화면을 이 DB 회로로 바꿀까요? 저장하지 않은 변경은 사라집니다.')) return;
    const record = await client.call(`/circuits/${encodeURIComponent(id)}`);
    const next = fromCircuit(record);
    const defs = getState().defs;
    for (const partId of new Set(next.instances.map((i) => i.part))) {
      try {
        const def = await client.call(`/components/${encodeURIComponent(partId)}`);
        // API 핀 정의를 우선한다. 같은 id의 그림은 핀 집합이 같을 때만 재사용한다.
        const old = defs.get(partId);
        const samePins = old && JSON.stringify(old.pins.map((p) => p.id).sort()) === JSON.stringify(def.pins.map((p) => p.id).sort());
        const converted = definitionToPart(def);
        const base = samePins ? { ...old, ...converted,
          pins: converted.pins.map((p) => ({ ...p, side: old.pins.find((x) => x.id === p.id).side })) } : converted;
        delete base._layout;
        defs.set(partId, await loadComponentImage(client, base));
      } catch (e) {
        if (e.status !== 404) throw e;
        if (!defs.has(partId)) {
          const refs = new Set(next.instances.filter((i) => i.part === partId).map((i) => i.ref));
          const pins = [...new Set(record.nets.flatMap((n) => n.connected_pin_refs).filter((p) => refs.has(p.instance_id)).map((p) => p.pin_id))];
          defs.set(partId, { id: partId, name: `${partId} (DB 미등록)`, category: 'module',
            pins: pins.map((id) => ({ id, label: id, type: 'passive', side: 'left' })) });
        }
        message(`부품 DB 미등록: ${partId}. 화면 표시는 가능하며 사양 검증이 필요합니다.`);
      }
    }
    renderParts(); replace(next);
    current = record; saved = JSON.stringify(draft());
    $('dbCircuitId').value = record.id;
    if (next.instances.some((i) => i.rotation % 360 !== 0)) message('회전 값은 저장 시 유지되지만 미르 그림은 회전을 표시하지 않습니다.');
    status(`${record.id} · v${record.version} · ${record.status}`);
    message(`DB 회로 불러옴: ${record.name} (v${record.version})`);
  }

  $('btnBackend').onclick = () => $('backendModal').classList.remove('hidden');
  $('btnDbClose').onclick = () => $('backendModal').classList.add('hidden');
  $('btnDbConnect').onclick = () => run(connect);
  $('btnDbLoad').onclick = () => run(load);
  $('btnDbSave').onclick = () => run(async () => {
    await requireClient();
    if (getState().pendingProposal) throw new Error('수정안을 먼저 적용하거나 취소하세요.');
    const data = draft();
    const record = current
      ? await client.call(`/circuits/${encodeURIComponent(current.id)}`, 'PUT', { ...data, expected_version: current.version })
      : await client.call('/circuits', 'POST', data);
    current = record; saved = JSON.stringify(data); $('dbCircuitId').value = record.id;
    status(`${record.id} · v${record.version} · 저장됨 (재검증 필요)`);
    message(`DB 저장 완료: ${record.id} · v${record.version}`);
  });
  $('btnDbValidate').onclick = () => run(async () => {
    await requireClient();
    if (!current || saved !== JSON.stringify(draft()) || getState().pendingProposal) throw new Error('현재 편집 내용을 먼저 DB에 저장하세요.');
    const result = await client.call(`/circuits/${encodeURIComponent(current.id)}/validate`, 'POST', { expected_version: current.version });
    status(`v${result.version} · 서버 검증: ${result.status}`);
    message(`서버 검증: ${result.status}\n${result.issues.map((i) => `[${i.severity}] ${i.message}`).join('\n') || '구현된 검사 범위에서 이슈 없음'}\n검사 제외: ${result.excluded_checks.join(', ')}`);
  });
  const linked = new URLSearchParams(location.search).get('circuit');
  if (linked) { $('dbCircuitId').value = linked; $('backendModal').classList.remove('hidden'); }
  return { reset, connectAutomatically: () => run(connect), refreshAfterAgent: () => client ? run(connect) : Promise.resolve(),
    openCircuit: (id) => { $('dbCircuitId').value = id; $('backendModal').classList.remove('hidden'); } };
}
