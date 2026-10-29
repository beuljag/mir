import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../renderer/verification-panel.js', import.meta.url), 'utf8')
  .replace("import { runtimeApi } from './web-api.js?v=chat-recovery-2';", 'const runtimeApi = globalThis.verificationTestApi;');

test('폴더의 상대 경로를 보존하고 검사 결과·작업 ID를 키 없이 표시', async () => {
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, { value: '', textContent: '', checked: false, files: [], disabled: false,
      classList: { add() {}, remove() {} }, replaceChildren() { this.value = ''; },
      appendChild(option) { if (!this.value) this.value = option.value; } });
    return elements.get(id);
  };
  globalThis.document = { getElementById: element, createElement: () => ({ value: '', textContent: '' }) };
  const calls = [];
  const projectId = 'a'.repeat(32);
  const jobId = '11111111-1111-1111-1111-111111111111';
  globalThis.verificationTestApi = { requestCircuit: async (path, options) => {
    calls.push({ path, options });
    if (path.endsWith('/config')) return { status: 200, body: { kicad_available: false, ngspice_available: false } };
    if (path === '/verification/projects') return { status: 201, body: { id: projectId, name: 'fixture', files: [{ name: 'main.kicad_sch' }] } };
    if (path.endsWith('/verify')) return { status: 202, body: { id: jobId } };
    if (path.startsWith('/jobs/')) return { status: 200, body: { status: 'completed', result: { erc: { status: 'unavailable' }, note: 'fixture' } } };
    throw new Error(path);
  } };
  const { initVerificationPanel } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const messages = [];
  initVerificationPanel({ message: (text) => messages.push(text) });
  await element('btnFileVerification').onclick();
  assert.match(element('verificationConfig').textContent, /미설치/);
  element('verificationFolder').files = [
    { name: 'main.kicad_sch', webkitRelativePath: 'project/main.kicad_sch', size: 100, text: async () => '(kicad_sch)' },
    { name: 'pump.lib', webkitRelativePath: 'project/models/pump.lib', size: 100, text: async () => '.model pump D()' },
    { name: 'board.kicad_pcb', webkitRelativePath: 'project/board.kicad_pcb', size: 100, text: async () => '' }
  ];
  element('verificationFolder').onchange();
  await element('btnVerificationImport').onclick();
  const body = JSON.parse(calls.find((c) => c.path === '/verification/projects').options.body);
  assert.equal(body.main_file, 'main.kicad_sch');
  assert.deepEqual(body.files.map((f) => f.name), ['main.kicad_sch', 'models/pump.lib']);
  assert.equal(element('verificationProjectId').value, projectId);
  element('verificationAnalysis').value = 'op';
  element('verificationStep').value = '.00001';
  element('verificationDuration').value = '.01';
  await element('btnVerificationRun').onclick();
  assert.match(element('verificationResult').textContent, /unavailable/);
  assert.ok(messages.some((message) => message.includes(jobId)));
  assert.ok(calls.every((call) => !call.options.headers?.['X-API-Key']));
});
