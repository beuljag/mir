import { builtInParts, partTemplate } from './builtin-parts.js';
import './server-connection.js';
import { createServerChatApi } from './server-chat.js';
import { createBrowserProjects } from './browser-projects.js';

const DEFAULT_SERVER = 'https://rqc76xf3-8000.jpe1.devtunnels.ms';
let connection = { mode: 'remote', url: DEFAULT_SERVER, key: '' };
let availability = { db: false, ai: false, editorWires: false };

function setAvailability(next) {
  const changed = next.db !== availability.db || next.ai !== availability.ai;
  availability = next;
  if (changed) window.dispatchEvent(new Event('mir-connection-status'));
}

const serverErrors = {
  INVALID_API_KEY: '배선 API 키를 확인해 주세요.',
  LOCAL_API_KEY_NOT_CONFIGURED: '이 PC의 배선 서버에 API 키를 설정해 주세요.',
  COPILOT_SECRET_NOT_CONFIGURED: '배선 서버에 Copilot Direct Line 비밀 키를 설정해 주세요.',
  DIRECT_LINE_AUTH_FAILED: 'Copilot 인증에 실패했어요. 서버의 Direct Line 설정을 확인해 주세요.',
  DIRECT_LINE_NETWORK_ERROR: '배선 서버에서 Microsoft에 접속할 수 없어요.'
};

async function requestAt(config, route, { method = 'GET', body, signal } = {}) {
  const timeout = AbortSignal.timeout(route.startsWith('/chat/') ? 50000 : 25000);
  if (location.protocol === 'file:') {
    if (config.mode !== 'remote') throw new Error('HTML 직접 실행에서는 공유 서버를 선택하고 서버 주소와 배선 API 키를 입력해 주세요.');
    const transport = window.MirServerConnection.createTransport({
      read: () => config,
      fetcher: (url, options) => fetch(url, {
        ...options, signal: signal ? AbortSignal.any([signal, timeout]) : timeout
      })
    });
    try { return await transport(route, { method, body }); }
    catch (error) {
      if (error instanceof TypeError) throw new Error('서버에 접속할 수 없어요. 주소와 서버 실행 상태를 확인하고, 서버가 HTML 파일의 연결을 허용하는지 확인해 주세요.');
      throw error;
    }
  }
  const response = await fetch('/api/mir', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.mode === 'remote' ? { 'X-API-Key': config.key } : {})
    },
    body: JSON.stringify({ mode: config.mode, url: config.url, route, method, body }),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '미르 HTML 실행기를 확인해 주세요.');
  return result;
}

function requireResult(result, valid, message) {
  if (result.status < 200 || result.status >= 300 || !valid(result.body)) {
    const code = result.body?.detail?.code;
    throw new Error(serverErrors[code] || message);
  }
  return result.body;
}

async function verifyAI(candidate, signal) {
  const info = await requestAt(candidate, '/chat/config', { signal });
  requireResult(info, config => config?.mode === 'directline' && config.configured === true,
    '배선 서버에 Copilot Direct Line 비밀 키를 설정해 주세요.');
  const opened = await requestAt(candidate, '/chat/sessions', { method: 'POST', signal });
  const { session_id: id } = requireResult(opened,
    session => typeof session?.session_id === 'string' && /^[a-f0-9]{1,64}$/.test(session.session_id),
    'Copilot 대화를 열 수 없어요. 서버의 에이전트 설정을 확인해 주세요.');
  void requestAt(candidate, '/chat/sessions/' + id, { method: 'DELETE' }).catch(() => {});
}

async function requestCircuit(route, options) {
  const target = connection;
  const chat = route.startsWith('/chat/');
  const cleanup = chat && options?.method === 'DELETE';
  if (!availability.db && !cleanup) throw new Error('배선 DB 연결을 먼저 확인해 주세요.');
  if (chat && !availability.ai && !cleanup) throw new Error('Copilot AI 연결을 먼저 확인해 주세요.');
  function lost(all) {
    if (connection !== target || cleanup) return;
    setAvailability({ ...availability, db: all ? false : availability.db, ai: false });
  }
  try {
    const result = await requestAt(target, route, options);
    const authError = [401, 403].includes(result.status);
    if (authError || result.status >= 500) lost(authError || !chat);
    return result;
  } catch (error) {
    if (!options?.signal?.aborted) lost(!chat);
    throw error;
  }
}

const PART_STORAGE = 'mir-html-user-parts-v1';
const PIN_TYPES = ['power_out', 'power_in', 'gnd', 'gpio', 'input', 'output', 'passive', 'contact', 'nc'];
let userParts;
try {
  userParts = new Map(JSON.parse(localStorage.getItem(PART_STORAGE) || '[]'));
} catch {
  userParts = new Map();
}

function validatePart(part) {
  if (typeof part?.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(part.id)
    || typeof part.name !== 'string' || !part.name.trim() || !Array.isArray(part.pins) || !part.pins.length) {
    throw new Error('부품의 id, name, pins를 확인해 주세요.');
  }
  const ids = new Set();
  for (const pin of part.pins) {
    if (typeof pin?.id !== 'string' || !pin.id.trim() || ids.has(pin.id) || !PIN_TYPES.includes(pin.type)) {
      throw new Error('핀 id의 중복 여부와 type을 확인해 주세요.');
    }
    ids.add(pin.id);
  }
}

function savePart(part, imageData) {
  validatePart(part);
  const next = new Map(userParts);
  const { imageData: embedded, ...data } = part;
  const image = imageData || (/^data:image\/(?:svg\+xml|png);base64,[a-z0-9+/=]+$/i.test(embedded) ? embedded : undefined);
  next.set(part.id, { ...data, source: 'user', file: part.id + '.json', imageData: image });
  try {
    localStorage.setItem(PART_STORAGE, JSON.stringify([...next]));
  } catch {
    throw new Error('브라우저에 부품을 저장할 공간이 부족해요. 더 작은 그림으로 다시 시도해 주세요.');
  }
  userParts = next;
  return part.id;
}

function pickPartFiles() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.png,.svg';
    input.multiple = true;
    input.hidden = true;
    const done = (files) => { input.remove(); resolve(files); };
    input.addEventListener('change', () => done([...input.files]), { once: true });
    input.addEventListener('cancel', () => done([]), { once: true });
    document.body.append(input);
    input.click();
  });
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    if (file.size > 2 * 1024 * 1024) {
      reject(new Error('부품 그림은 2MB 이하로 선택해 주세요.'));
      return;
    }
    const type = /\.svg$/i.test(file.name) ? 'image/svg+xml' : 'image/png';
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('부품 그림을 읽을 수 없어요.'));
    reader.readAsDataURL(new Blob([file], { type }));
  });
}

async function importParts() {
  const files = await pickPartFiles();
  const pictures = new Map(files.filter((file) => /\.(?:svg|png)$/i.test(file.name)).map((file) => [file.name, file]));
  const jsonFiles = files.filter((file) => /\.json$/i.test(file.name));
  const added = [], errors = [];
  if (files.length && !jsonFiles.length) errors.push('부품 JSON도 함께 선택해 주세요.');
  for (const file of jsonFiles) {
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('부품 JSON은 2MB 이하로 선택해 주세요.');
      const part = JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
      const picture = pictures.get(part?.image);
      added.push(savePart(part, picture && await readImage(picture)));
    } catch (error) {
      errors.push(file.name + ' · ' + error.message);
    }
  }
  return { added, errors };
}

function openGuide(name) {
  const guides = {
    'Copilot-Studio-연결-안내.md': 'docs/연결 안내.html',
    '부품-JSON-양식.md': 'docs/부품 안내.html'
  };
  if (Object.hasOwn(guides, name)) window.open(guides[name], '_blank', 'noopener');
}

window.api = {
  browserMode: true,
  ...createBrowserProjects(),
  getSettings: async () => ({
    mode: 'server', serverSecretConfigured: availability.ai, apiKeyReady: availability.db
  }),
  setSettings: async ({ mode }) => {
    if (mode !== 'server') throw new Error('미르 HTML은 실제 AI와 DB 연결이 필요해요.');
  },
  getServerConnection: async () => ({
    mode: connection.mode, url: connection.url || DEFAULT_SERVER, hasKey: Boolean(connection.key)
  }),
  getAutoAuthStatus: async () => ({ ready: availability.db, editorWires: availability.editorWires, remote: connection.mode === 'remote' }),
  requestCircuit,
  resetAgent: async () => {},
  listParts: async () => {
    let parts = builtInParts, errors = [];
    if (location.protocol !== 'file:') {
      const response = await fetch('/api/parts');
      if (!response.ok) throw new Error('기본 부품 목록을 읽을 수 없어요.');
      ({ parts, errors } = await response.json());
    }
    const all = new Map(parts.map((part) => [part.id, part]));
    for (const [id, part] of userParts) all.set(id, part);
    return { parts: [...all.values()], errors };
  },
  savePart: async (part) => savePart(part),
  importParts,
  savePartTemplate: () => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([JSON.stringify(partTemplate, null, 2)], { type: 'application/json' }));
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    link.download = 'my-part.json';
    link.click();
  },
  openPartsFolder: () => openGuide('부품-JSON-양식.md'),
  openDoc: openGuide,
  getAppIcon: async () => 'assets/mir-icon.png'
};

export const runtimeApi = createServerChatApi(window.api);
runtimeApi.selectMode('server');
runtimeApi.getSettings = window.api.getSettings;

export async function connectRequired(input, { signal, progress = () => {} } = {}) {
  const candidate = window.MirServerConnection.updateConnection(connection, input);
  const sameServer = candidate.mode === connection.mode && candidate.url === connection.url && candidate.key === connection.key;
  progress('DB 부품 목록을 확인하고 있어요.');
  const db = await requestAt(candidate, '/components/search?limit=100', { signal });
  requireResult(db, Array.isArray, 'DB 부품 목록을 읽을 수 없어요. 서버 주소와 배선 API 키를 확인해 주세요.');

  progress('DB 확인 완료 · Copilot AI 연결을 확인하고 있어요.');
  const [capabilities, agent] = await Promise.allSettled([
    requestAt(candidate, '/circuits/capabilities', { signal }),
    verifyAI(candidate, signal)
  ]);
  signal?.throwIfAborted();
  const aiError = agent.status === 'rejected' ? agent.reason.message : '';
  const editorWires = capabilities.status === 'fulfilled' && capabilities.value.status === 200 &&
    capabilities.value.body?.editor_wires === true;
  void runtimeApi.resetAgent();
  connection = candidate;
  setAvailability({ db: true, ai: !aiError, editorWires });
  return { sameServer, aiError };
}
