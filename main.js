const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const { DirectLineClient } = require('./src/directline');
const { validateWebChatUrl, readWebChatDefaults } = require('./renderer/web-chat');

const builtinPartsDir = app.isPackaged
  ? path.join(process.resourcesPath, 'parts')
  : path.join(__dirname, 'parts');
const userPartsDir = () => path.join(app.getPath('userData'), 'parts');
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

let client = null;
let catalogSentFor = null;

const { updateConnection, createTransport } = require('./renderer/server-connection');
const connectionFile = () => path.join(app.getPath('userData'), 'server-connection.json');
function readConnection() {
  try {
    const raw = JSON.parse(fs.readFileSync(connectionFile(), 'utf8'));
    return { mode: raw.mode, url: raw.url, key: raw.keyEnc && safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(Buffer.from(raw.keyEnc, 'base64')) : '' };
  } catch {
    try {
      const defaults = JSON.parse(fs.readFileSync(path.join(__dirname, 'renderer', 'server-defaults.json'), 'utf8'));
      return { mode: 'remote', url: defaults.sharedServerUrl, key: '' };
    } catch { return { mode: 'local', url: '', key: '' }; }
  }
}
const requestCircuit = createTransport({ read: readConnection });
ipcMain.handle('circuit:getConnection', () => {
  const config = readConnection();
  return { mode: config.mode, url: config.url, hasKey: !!config.key };
});
ipcMain.handle('circuit:setConnection', (_e, input) => {
  const config = updateConnection(readConnection(), input);
  if (config.key && !safeStorage.isEncryptionAvailable()) throw new Error('Windows 키 암호화를 사용할 수 없습니다. 이 PC의 로그인 상태를 확인하세요.');
  const stored = { mode: config.mode, url: config.url, ...(config.key ? { keyEnc: safeStorage.encryptString(config.key).toString('base64') } : {}) };
  fs.mkdirSync(path.dirname(connectionFile()), { recursive: true });
  fs.writeFileSync(connectionFile(), JSON.stringify(stored, null, 2));
  return true;
});
ipcMain.handle('circuit:autoStatus', async () => {
  try {
    if (readConnection().mode === 'remote') {
      const response = await requestCircuit('/chat/config');
      return { ready: response.status === 200, remote: true };
    }
    const response = await fetch('http://127.0.0.1:8002/local-connection/status', { signal: AbortSignal.timeout(4000) });
    return response.ok ? response.json() : { ready: false };
  } catch { return { ready: false }; }
});
ipcMain.handle('circuit:request', (_e, { path: route, options = {} }) => requestCircuit(route, options));

// ---------- 설정 (비밀 키는 Windows 자격 증명으로 암호화해 저장) ----------
function readEnvSecret() {
  const dir = app.isPackaged
    ? process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath)
    : __dirname;
  try {
    for (const line of fs.readFileSync(path.join(dir, '.env'), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*COPILOT_DIRECT_LINE_SECRET\s*=(.*)$/);
      if (m) return m[1].trim();
    }
  } catch {}
  return '';
}

// ---------- 배포용 서버 주소 (app-config.json의 serverUrl, 예: https://내서버 — /token 은 자동으로 붙음) ----------
function readServerUrl() {
  try {
    return String(JSON.parse(fs.readFileSync(path.join(__dirname, 'app-config.json'), 'utf8')).serverUrl || '').trim();
  } catch {
    return '';
  }
}

// ---------- 설정 (비밀 키는 Windows 자격 증명으로 암호화해 저장) ----------
// ⚙에서 저장한 키가 없으면 .env의 키를 쓴다.
// 설정을 한 번도 저장하지 않았으면 .env 키 → app-config.json 서버 → 데모 모드 순서로 고른다.
function loadSettings(withEnv = true) {
  const envSecret = withEnv ? readEnvSecret() : "";
  try {
    const raw = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
    if (raw.secretEnc && safeStorage.isEncryptionAvailable()) {
      raw.secret = safeStorage.decryptString(Buffer.from(raw.secretEnc, 'base64'));
    }
    delete raw.secretEnc;
    raw.secret = raw.secret || envSecret;
    raw.tokenEndpoint = raw.tokenEndpoint || readServerUrl();
    return raw;
  } catch {
    if (envSecret) return { mode: 'secret', secret: envSecret, tokenEndpoint: '' };
    const legacyServer = readServerUrl();
    if (legacyServer) return { mode: 'token', secret: '', tokenEndpoint: legacyServer };
    try { return readWebChatDefaults(JSON.parse(fs.readFileSync(path.join(__dirname, 'renderer', 'agent-config.json'), 'utf8'))); }
    catch { return { mode: 'demo', secret: '', tokenEndpoint: '' }; }
  }
}

function saveSettings(s) {
  const out = { mode: s.mode, tokenEndpoint: s.tokenEndpoint || '' };
  if (s.mode === 'web') out.webChatUrl = validateWebChatUrl(s.webChatUrl);
  if (s.secret) {
    if (safeStorage.isEncryptionAvailable()) {
      out.secretEnc = safeStorage.encryptString(s.secret).toString('base64');
    } else {
      out.secret = s.secret;
    }
  }
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(out, null, 2));
  client = null;
  catalogSentFor = null;
}

// ---------- 부품 ----------
function readPartsFrom(dir, source) {
  if (!fs.existsSync(dir)) return [];
  const parts = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json') || f.startsWith('_')) continue;
    try {
      const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const err = validatePart(p);
      if (err) {
        parts.push({ id: f, _error: `${f}: ${err}`, source });
        continue;
      }
      parts.push({ ...p, source, file: f, imageData: readPartImage(dir, p.image) });
    } catch (e) {
      parts.push({ id: f, _error: `${f}: JSON 형식 오류 (${e.message})`, source });
    }
  }
  return parts;
}

// 부품 그림(SVG/PNG)을 data URL로 읽는다. 부품 JSON과 같은 폴더에 있어야 한다.
const IMAGE_TYPES = { '.svg': 'image/svg+xml', '.png': 'image/png' };
function readPartImage(dir, name) {
  if (!name) return undefined;
  const file = path.join(dir, path.basename(name));
  const type = IMAGE_TYPES[path.extname(file).toLowerCase()];
  if (!type || !fs.existsSync(file)) return undefined;
  return `data:${type};base64,${fs.readFileSync(file).toString('base64')}`;
}

const PIN_TYPES = ['power_out', 'power_in', 'gnd', 'gpio', 'input', 'output', 'passive', 'contact', 'nc'];

function validatePart(p) {
  if (!p || typeof p !== 'object') return '객체가 아닙니다';
  if (!p.id || !/^[a-z0-9][a-z0-9-]*$/.test(p.id)) return 'id는 영문 소문자·숫자·하이픈만 씁니다';
  if (!p.name) return 'name이 없습니다';
  if (!Array.isArray(p.pins) || !p.pins.length) return 'pins 배열이 없습니다';
  const seen = new Set();
  for (const pin of p.pins) {
    if (!pin.id) return '핀에 id가 없습니다';
    if (seen.has(pin.id)) return `핀 id 중복: ${pin.id}`;
    seen.add(pin.id);
    if (!PIN_TYPES.includes(pin.type)) return `핀 ${pin.id}의 type이 올바르지 않습니다 (${PIN_TYPES.join(', ')})`;
  }
  return null;
}

function listParts() {
  const map = new Map();
  const errors = [];
  for (const p of [...readPartsFrom(builtinPartsDir, 'builtin'), ...readPartsFrom(userPartsDir(), 'user')]) {
    if (p._error) errors.push(p._error);
    else map.set(p.id, p);
  }
  return { parts: [...map.values()], errors };
}

function installPart(part, fromDir) {
  const err = validatePart(part);
  if (err) throw new Error(err);
  fs.mkdirSync(userPartsDir(), { recursive: true });
  // 부품 그림 파일도 함께 복사한다
  if (part.image && fromDir) {
    const src = path.join(fromDir, path.basename(part.image));
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(userPartsDir(), path.basename(part.image)));
  }
  const file = path.join(userPartsDir(), `${part.id}.json`);
  fs.writeFileSync(file, JSON.stringify(part, null, 2));
  return part.id;
}

// ---------- 창 ----------
// build/icon.png(또는 .ico)가 있으면 창·작업 표시줄 아이콘으로 쓴다
function appIcon() {
  for (const name of ['icon.ico', 'icon.png']) {
    const file = path.join(__dirname, 'build', name);
    if (fs.existsSync(file)) return file;
  }
  return undefined;
}

function createWindow() {
  const win = new BrowserWindow({
    icon: appIcon(),
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: '미르',
    backgroundColor: '#f4f6f9',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.setMenuBarVisibility(false);
  win.webContents.on('will-prevent-unload', (event) => {
    const choice = dialog.showMessageBoxSync(win, {
      type: 'question', title: '미르 종료',
      message: '저장하지 않은 작업이 있어요. 종료할까요?',
      detail: '계속 편집을 선택하면 돌아가서 작업을 저장할 수 있어요.',
      buttons: ['계속 편집', '저장하지 않고 종료'], defaultId: 0, cancelId: 0
    });
    if (choice === 1) event.preventDefault();
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

ipcMain.handle('app:icon', () => {
  const file = path.join(__dirname, 'build', 'icon.png');
  return fs.existsSync(file) ? `data:image/png;base64,${fs.readFileSync(file).toString('base64')}` : null;
});

ipcMain.handle('settings:get', () => {
  const s = loadSettings();
  return { mode: s.mode, tokenEndpoint: s.tokenEndpoint, webChatUrl: s.webChatUrl, hasSecret: !!s.secret };
});

ipcMain.handle('settings:set', (_e, s) => {
  const prev = loadSettings(false);
  saveSettings({ ...s, secret: s.secret || (s.mode === 'secret' ? prev.secret : '') });
  return true;
});

ipcMain.handle('agent:send', async (_e, { text, catalog }) => {
  const s = loadSettings();
  if (s.mode === 'demo') return { demo: true };
  if (s.mode === 'web') throw new Error('Microsoft 웹 채팅에서 메시지를 보내세요.');
  if (!client) client = new DirectLineClient(s);
  if (!client.conversationId) await client.start();
  let message = text;
  if (catalogSentFor !== client.conversationId && catalog) {
    message = `${catalog}\n\n${text}`;
    catalogSentFor = client.conversationId;
  }
  const reply = await client.send(message);
  return { reply };
});

ipcMain.handle('agent:reset', () => {
  if (client) client.reset();
  catalogSentFor = null;
  return true;
});

ipcMain.handle('agent:test', async () => {
  const s = loadSettings();
  if (s.mode === 'demo') return '데모 모드입니다.';
  if (s.mode === 'web') {
    validateWebChatUrl(s.webChatUrl);
    return '웹 채팅 URL 형식을 확인했습니다. 실제 대화 권한과 응답은 채팅 화면에서 확인하세요.';
  }
  const c = new DirectLineClient(s);
  await c.start();
  return '연결 성공! 에이전트와 대화를 열었습니다.';
});

ipcMain.handle('parts:list', () => listParts());

ipcMain.handle('parts:import', async () => {
  const r = await dialog.showOpenDialog({
    title: '부품 JSON 파일 추가',
    filters: [{ name: '부품 JSON', extensions: ['json'] }],
    properties: ['openFile', 'multiSelections']
  });
  if (r.canceled) return { added: [], errors: [] };
  const added = [];
  const errors = [];
  for (const f of r.filePaths) {
    try {
      added.push(installPart(JSON.parse(fs.readFileSync(f, 'utf8')), path.dirname(f)));
    } catch (e) {
      errors.push(`${path.basename(f)}: ${e.message}`);
    }
  }
  return { added, errors };
});

ipcMain.handle('parts:save', (_e, part) => installPart(part));

ipcMain.handle('parts:openFolder', () => {
  fs.mkdirSync(userPartsDir(), { recursive: true });
  return shell.openPath(userPartsDir());
});

ipcMain.handle('parts:template', async () => {
  const r = await dialog.showSaveDialog({
    title: '부품 양식 저장',
    defaultPath: 'my-part.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (r.canceled) return false;
  fs.copyFileSync(path.join(builtinPartsDir, '_template.json'), r.filePath);
  return true;
});

let projectPath = null;
ipcMain.handle('project:new', () => { projectPath = null; });
ipcMain.handle('project:save', async (_e, data, saveAs = false) => {
  let target = projectPath;
  if (saveAs || !target) {
    const r = await dialog.showSaveDialog({ title: saveAs ? '다른 이름으로 저장' : '배선 저장', defaultPath: target || 'wiring.mir.json', filters: [{ name: '미르 배선', extensions: ['json'] }] });
    if (r.canceled) return false;
    target = r.filePath;
  }
  await fs.promises.writeFile(target, JSON.stringify(data, null, 2));
  projectPath = target;
  return true;
});
ipcMain.handle('project:open', async () => {
  const r = await dialog.showOpenDialog({ title: '배선 열기', filters: [{ name: '미르 배선', extensions: ['json'] }], properties: ['openFile'] });
  if (r.canceled) return null;
  const data = JSON.parse(await fs.promises.readFile(r.filePaths[0], 'utf8'));
  if (!data || data.format !== 'mir-wiring/1' || !Array.isArray(data.instances) || !Array.isArray(data.wires)) throw new Error('미르 배선 파일을 선택해 주세요.');
  projectPath = r.filePaths[0];
  return data;
});

ipcMain.handle('docs:open', (_e, name) => {
  const base = app.isPackaged ? path.join(app.getAppPath(), 'docs') : path.join(__dirname, 'docs');
  return shell.openPath(path.join(base, path.basename(name)));
});

app.whenReady().then(createWindow);
ipcMain.handle('agent:openWebsite', (_e, url) => shell.openExternal(validateWebChatUrl(url)));
app.on('window-all-closed', () => app.quit());
