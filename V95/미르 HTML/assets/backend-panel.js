import { confirmAction } from './confirm-dialog.js';
import { CircuitApi, toCircuitDraft, fromCircuit, definitionToPart, loadComponentImage, loadComponentCatalog } from './circuit-api.js';
import { runtimeApi } from './web-api.js';

export function initBackendPanel({ getState, getProjectGeneration = () => 0, canReplace = () => true,
  getCatalog = () => getState().defs, registerParts = (parts) => { for (const [id, def] of parts) getState().defs.set(id, def); }, replace, renderParts, message }) {
  const $ = (id) => document.getElementById(id);
  const dialog = $('backendModal');
  let client = null, current = null, busy = false, saved = '', editorWires = false;
  let dialogGeneration = 0;
  function openDialog() {
    if (dialog.open) return;
    dialogGeneration++;
    dialog.showModal();
  }
  function updateSaveScope() {
    $('dbSaveScope').hidden = editorWires;
    $('dbSaveScope').textContent = '이 서버는 배선의 핀 연결을 저장해요. 지정한 선 종류와 메모까지 보관하려면 프로젝트 파일로 저장해 주세요.';
  }
  window.addEventListener('mir-connection-status', async () => {
    editorWires = (await runtimeApi.getAutoAuthStatus()).editorWires;
    updateSaveScope();
  });
  const status = (text) => { $('dbStatus').textContent = text; };
  const draft = () => toCircuitDraft(getState(), current, { editorWires });
  function reset() { client = null; current = null; saved = ''; $('dbCircuitId').value = ''; status('새 회로 · DB 저장 전'); }
  async function run(action, loading = 'DB 작업을 처리하고 있어요…') {
    if (busy) return;
    busy = true;
    const controls = ['btnDbConnect', 'btnDbLoad', 'btnDbSave', 'btnDbValidate', 'btnFileVerification'].map($);
    const previous = $('dbStatus').textContent;
    status(loading);
    controls.forEach(control => { control.disabled = true; });
    try { return await action(); }
    catch (error) {
      status('실패 · ' + error.message);
      message('배선 API · ' + error.message);
    } finally {
      if ($('dbStatus').textContent === loading) status(previous);
      busy = false;
      controls.forEach(control => { control.disabled = false; });
    }
  }
  async function connect() {
    const readiness = await runtimeApi.getAutoAuthStatus();
    if (!readiness.ready) throw new Error('연결 확인을 눌러 배선 DB에 연결해 주세요.');
    editorWires = readiness.editorWires;
    updateSaveScope();
    const next = new CircuitApi(runtimeApi.requestCircuit, '');
    const parts = await loadComponentCatalog(next);
    client = next;
    const catalog = getCatalog();
    const loaded = new Map();
    for (const def of parts) {
      const old = catalog.get(def.id);
      const converted = definitionToPart(def);
      const samePins = old && JSON.stringify(old.pins.map((p) => p.id).sort()) === JSON.stringify(def.pins.map((p) => p.id).sort());
      const base = samePins ? { ...old, ...converted,
        pins: converted.pins.map((p) => ({ ...p, side: old.pins.find((x) => x.id === p.id).side })) } : converted;
      delete base._layout;
      loaded.set(def.id, await loadComponentImage(next, base));
    }
    registerParts(loaded);
    renderParts();
    status(`서버 자동 연결됨 · 등록 부품 ${parts.length}개`);
  }
  async function requireClient() { if (!client) await connect(); }
  async function fetchPart(id) {
    if (!client && !(await runtimeApi.getAutoAuthStatus?.())?.ready) return null;
    const api = client || new CircuitApi(runtimeApi.requestCircuit, '');
    try {
      const def = await api.call(`/components/${encodeURIComponent(id)}`);
      return await loadComponentImage(api, definitionToPart(def));
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
  }
  async function load(id = $('dbCircuitId').value.trim(), { automatic = false, guardDialog = true } = {}) {
    const generation = getProjectGeneration();
    const view = dialogGeneration;
    const canLoad = () => generation === getProjectGeneration() && canReplace() &&
      (automatic ? !getState().instances.length : !guardDialog || (dialog.open && view === dialogGeneration));
    if (!canLoad()) return false;
    if (!id) throw new Error('에이전트가 반환한 회로 ID를 입력하세요.');
    await requireClient();
    if (!canLoad()) return false;
    const circuitClient = client;
    const record = await circuitClient.call(`/circuits/${encodeURIComponent(id)}`);
    const next = fromCircuit(record);
    const defs = new Map(getCatalog());
    const projectParts = new Map();
    const missing = [];
    for (const partId of new Set(next.instances.map((i) => i.part))) {
      try {
        const def = await circuitClient.call(`/components/${encodeURIComponent(partId)}`);
        // API 핀 정의를 우선한다. 같은 id의 그림은 핀 집합이 같을 때만 재사용한다.
        const old = defs.get(partId);
        const samePins = old && JSON.stringify(old.pins.map((p) => p.id).sort()) === JSON.stringify(def.pins.map((p) => p.id).sort());
        const converted = definitionToPart(def);
        const base = samePins ? { ...old, ...converted,
          pins: converted.pins.map((p) => ({ ...p, side: old.pins.find((x) => x.id === p.id).side })) } : converted;
        delete base._layout;
        projectParts.set(partId, await loadComponentImage(circuitClient, base));
      } catch (e) {
        if (e.status !== 404) throw e;
        if (!defs.has(partId)) {
          const refs = new Set(next.instances.filter((i) => i.part === partId).map((i) => i.ref));
          const pins = [...new Set(record.nets.flatMap((n) => n.connected_pin_refs).filter((p) => refs.has(p.instance_id)).map((p) => p.pin_id))];
          projectParts.set(partId, { id: partId, name: `${partId} (DB 미등록)`, category: 'module',
            pins: pins.map((id) => ({ id, label: id, type: 'passive', side: 'left' })) });
        }
        missing.push(partId);
      }
    }
    const loadedDraft = JSON.stringify(toCircuitDraft(next, record, { editorWires }));
    if (!canLoad()) return false;
    if (getState().instances.length && !await confirmAction('현재 화면을 이 DB 회로로 바꿀까요? 저장하지 않은 변경은 사라집니다.')) return false;
    if (!canLoad()) return false;
    getState().defs = new Map([...defs, ...projectParts]);
    replace(next, projectParts); renderParts();
    for (const partId of missing) message(`부품 DB 미등록: ${partId}. 화면 표시는 가능하며 사양 검증이 필요합니다.`);
    current = record; saved = loadedDraft;
    $('dbCircuitId').value = record.id;
    status(`${record.id} · v${record.version} · ${record.status}`);
    message(`DB 회로 불러옴: ${record.name} (v${record.version})`);
    return true;
  }

  $('btnBackend').onclick = openDialog;
  $('btnDbClose').onclick = () => dialog.close();
  $('btnDbConnect').onclick = async () => {
    if (!(await runtimeApi.getAutoAuthStatus()).ready) {
      dialog.close();
      $('btnSettings').click();
      return;
    }
    await run(connect, '서버 연결과 부품 목록을 확인하고 있어요…');
  };
  $('btnDbLoad').onclick = () => run(load, 'DB에서 회로를 불러오고 있어요…');
  $('btnDbSave').onclick = () => run(async () => {
    const generation = getProjectGeneration();
    await requireClient();
    if (generation !== getProjectGeneration() || !canReplace()) return;
    if (getState().pendingProposal) throw new Error('수정안을 먼저 적용하거나 취소하세요.');
    const data = draft();
    const record = current
      ? await client.call(`/circuits/${encodeURIComponent(current.id)}`, 'PUT', { ...data, expected_version: current.version })
      : await client.call('/circuits', 'POST', data);
    if (generation !== getProjectGeneration()) {
      message('이전 회로 DB 저장 완료 · ' + record.id);
      return;
    }
    current = record; saved = JSON.stringify(data); $('dbCircuitId').value = record.id;
    status(`${record.id} · v${record.version} · 저장됨 (재검증 필요)`);
    message(`DB 저장 완료: ${record.id} · v${record.version}`);
  });
  $('btnDbValidate').onclick = () => run(async () => {
    await requireClient();
    if (!current || saved !== JSON.stringify(draft()) || getState().pendingProposal) throw new Error('현재 편집 내용을 먼저 DB에 저장하세요.');
    const result = await client.call(`/circuits/${encodeURIComponent(current.id)}/validate`, 'POST', { expected_version: current.version });
    status(`v${result.version} · 서버 검증: ${result.status}\n${result.issues.map((i) => `[${i.severity}] ${i.message}`).join('\n') || '검사 범위에서 이슈 없음'}\n검사 제외: ${result.excluded_checks.join(', ')}`);
    message(`서버 검증: ${result.status}\n${result.issues.map((i) => `[${i.severity}] ${i.message}`).join('\n') || '구현된 검사 범위에서 이슈 없음'}\n검사 제외: ${result.excluded_checks.join(', ')}`);
  });
  const linked = new URLSearchParams(location.search).get('circuit');
  if (linked) { $('dbCircuitId').value = linked; openDialog(); }
  return { reset, fetchPart, connectionChanged(sameServer) {
    client = null;
    if (!sameServer) {
      current = null;
      saved = '';
    }
  }, isBusy: () => busy, connectAutomatically: async () => {
    if ((await runtimeApi.getAutoAuthStatus?.())?.ready) await run(connect);
  }, refreshAfterAgent: () => client ? run(connect) : Promise.resolve(),
    openCircuit: (id, { showPanel = true, automatic = false } = {}) => {
      if (showPanel) $('dbCircuitId').value = id;
      if (showPanel) openDialog();
      return run(() => load(id, { automatic, guardDialog: showPanel }));
    } };
}
