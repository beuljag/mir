import { runtimeApi } from './web-api.js';

// KiCad 파일은 기존 키 자동 연결을 통해 서버로 보낸다. 원본 파일을 수정하지 않는다.
export function initVerificationPanel({ message }) {
  const $ = (id) => document.getElementById(id);
  const dialog = $('verificationModal');
  let busy = false, checking = false, dbReady = false, kicadReady = false;
  function updateControls() {
    $('btnVerificationConnect').hidden = dbReady || checking;
    $('btnVerificationImport').disabled = !dbReady || busy || checking;
    $('btnVerificationRun').disabled = !kicadReady || busy || checking;
  }
  let selectedFiles = [];
  const show = (value) => { $('verificationResult').textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2); };
  async function call(path, method = 'GET', body) {
    const response = await runtimeApi.requestCircuit(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (response.status >= 400) throw new Error(response.body?.detail?.code || `HTTP ${response.status}`);
    return response.body;
  }
  async function run(action) {
    if (busy) return;
    busy = true;
    updateControls();
    try { await action(); } catch (error) { show('실패 · ' + error.message); }
    finally { busy = false; updateControls(); }
  }
  async function checkTools() {
    checking = true;
    dbReady = kicadReady = false;
    $('verificationConfig').textContent = '배선 DB와 검사 도구를 확인하고 있어요…';
    updateControls();
    try {
      dbReady = (await runtimeApi.getAutoAuthStatus()).ready;
      if (!dbReady) {
        $('verificationConfig').textContent = '파일을 검증하려면 배선 DB에 연결해 주세요.';
        return;
      }
      const config = await call('/verification/config');
      kicadReady = Boolean(config.kicad_available);
      $('verificationSpice').disabled = !config.ngspice_available;
      if (!config.ngspice_available) $('verificationSpice').checked = false;
      $('verificationConfig').textContent = 'KiCad ' + (kicadReady ? '준비됨' : '미설치 또는 경로 미설정')
        + ' · ngspice ' + (config.ngspice_available ? '준비됨' : '미설치 또는 경로 미설정');
    } catch (error) {
      dbReady = (await runtimeApi.getAutoAuthStatus()).ready;
      $('verificationConfig').textContent = '검사 도구를 확인할 수 없어요. ' + error.message;
    } finally {
      checking = false;
      updateControls();
    }
  }
  $('btnFileVerification').onclick = () => {
    if (!dialog.open) dialog.showModal();
    if (!busy && !checking) {
      show('');
      void checkTools();
    }
  };
  $('btnVerificationClose').onclick = () => dialog.close();
  $('btnVerificationConnect').onclick = () => {
    dialog.close();
    $('backendModal').close();
    $('btnSettings').click();
  };
  window.addEventListener('mir-connection-status', async () => {
    if (!(await runtimeApi.getAutoAuthStatus()).ready && dialog.open && !checking) {
      dbReady = kicadReady = false;
      $('verificationConfig').textContent = '배선 DB 연결을 다시 확인해 주세요.';
      updateControls();
    }
  });
  function selectFiles(input, folder = false) {
    const supported = /\.(?:kicad_sch|kicad_pro|lib|inc|mod|cir|sp|model)$/i;
    selectedFiles = [...input.files].filter((file) => supported.test(file.name)).map((file) => ({ file,
      name: folder ? file.webkitRelativePath.split('/').slice(1).join('/') : file.name }));
    $('verificationMain').replaceChildren();
    for (const item of selectedFiles.filter((f) => f.name.toLowerCase().endsWith('.kicad_sch'))) {
      const option = document.createElement('option');
      option.value = item.name; option.textContent = item.name;
      $('verificationMain').appendChild(option);
    }
  }
  $('verificationFiles').onchange = () => selectFiles($('verificationFiles'));
  $('verificationFolder').onchange = () => selectFiles($('verificationFolder'), true);
  $('btnVerificationImport').onclick = () => run(async () => {
    const files = selectedFiles;
    if (!files.length || !setupMain()) throw new Error('회로도 파일과 주 회로도를 선택하세요.');
    if (files.length > 40 || files.reduce((sum, f) => sum + f.file.size, 0) > 16000000 || files.some((f) => f.file.size > 5000000)) throw new Error('최대 40개·전체 16MB·파일당 5MB까지 가져올 수 있습니다.');
    show('파일 가져오는 중…');
    const body = { name: $('verificationMain').value, main_file: $('verificationMain').value,
      files: await Promise.all(files.map(async (f) => ({ name: f.name, content: await f.file.text() }))) };
    const project = await call('/verification/projects', 'POST', body);
    $('verificationProjectId').value = project.id;
    show(`가져오기 완료 · ${project.files.length}개 파일\nproject_id: ${project.id}\n검사 실행 전에는 통과 여부를 판정하지 않습니다.`);
    message(`KiCad 파일 가져옴 · ${project.name}\nproject_id: ${project.id}\n이 ID로 에이전트에 ERC·시뮬레이션을 요청할 수 있습니다.`);
  });
  function setupMain() { return $('verificationMain').value; }
  $('btnVerificationRun').onclick = () => run(async () => {
    const id = $('verificationProjectId').value.trim();
    if (!/^[a-f0-9]{32}$/.test(id)) throw new Error('먼저 파일을 가져오거나 프로젝트 ID를 입력하세요.');
    const checks = { run_erc: true, run_ngspice: $('verificationSpice').checked,
      analysis: $('verificationAnalysis').value, timestep: Number($('verificationStep').value),
      duration: Number($('verificationDuration').value), vectors: $('verificationVectors').value.split(',').map((s) => s.trim()).filter(Boolean) };
    const job = await call(`/verification/projects/${id}/verify`, 'POST', checks);
    show(`검사 대기 중…\njob_id: ${job.id}`);
    for (let i = 0; i < 150; i++) {
      const state = await call(`/jobs/${job.id}`);
      if (!['queued', 'running'].includes(state.status)) {
        const summary = document.createElement('p');
        summary.textContent = `검사 상태: ${state.status} · ${state.result?.note || state.error?.code || '아래 상세 결과를 확인하세요.'}`;
        const details = document.createElement('details');
        const heading = document.createElement('summary');
        heading.textContent = '상세 결과 보기';
        const raw = document.createElement('pre');
        raw.textContent = JSON.stringify(state, null, 2);
        details.append(heading, raw);
        $('verificationResult').replaceChildren(summary, details);
        message(`KiCad 파일 검사 ${state.status}\nproject_id: ${id}\njob_id: ${job.id}\n${state.result?.note || state.error?.code || ''}`);
        return;
      }
      show(`검사 중 · ${i + 1}초\njob_id: ${job.id}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    show(`처리가 계속되고 있습니다. 에이전트의 GetJobStatus로 조회하세요.\njob_id: ${job.id}`);
  });
}
