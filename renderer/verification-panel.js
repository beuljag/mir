import { runtimeApi } from './web-api.js?v=chat-recovery-2';

// KiCad 파일은 기존 키 자동 연결을 통해 서버로 보낸다. 원본 파일을 수정하지 않는다.
export function initVerificationPanel({ message }) {
  const $ = (id) => document.getElementById(id);
  let busy = false;
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
    ['btnVerificationImport', 'btnVerificationRun'].forEach((id) => { $(id).disabled = true; });
    try { await action(); } catch (error) { show('실패: ' + error.message); }
    finally {
      busy = false;
      ['btnVerificationImport', 'btnVerificationRun'].forEach((id) => { $(id).disabled = false; });
    }
  }
  $('btnFileVerification').onclick = async () => {
    $('verificationModal').classList.remove('hidden');
    try {
      const config = await call('/verification/config');
      $('verificationConfig').textContent = `KiCad: ${config.kicad_available ? '준비됨' : '미설치 또는 경로 미설정'} · ngspice: ${config.ngspice_available ? '준비됨' : '미설치 또는 경로 미설정'}`;
    } catch (error) { show(error.message); }
  };
  $('btnVerificationClose').onclick = () => $('verificationModal').classList.add('hidden');
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
        show(state);
        message(`KiCad 파일 검사 ${state.status}\nproject_id: ${id}\njob_id: ${job.id}\n${state.result?.note || state.error?.code || ''}`);
        return;
      }
      show(`검사 중 · ${i + 1}초\njob_id: ${job.id}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    show(`처리가 계속되고 있습니다. 에이전트의 GetJobStatus로 조회하세요.\njob_id: ${job.id}`);
  });
}
