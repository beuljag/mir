const { validateProject } = require('./renderer/project-validation');
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
const disconnected = { ready: false, aiReady: false, editorWires: false };
let serverStatus = disconnected;
let connectionRevision = 0;

function setServerStatus(next) {
  const changed = serverStatus.ready !== next.ready || serverStatus.aiReady !== next.aiReady
    || serverStatus.editorWires !== next.editorWires;
  serverStatus = next;
  if (changed) for (const win of BrowserWindow.getAllWindows()) {
    if (!win.webContents.isDestroyed()) win.webContents.send('circuit:statusChanged');
  }
}

async function checkServer(config, { testAI = false } = {}) {
  const request = createTransport({ read: () => config });
  const db = await request('/components/search?limit=100');
  if (db.status !== 200 || !Array.isArray(db.body)) {
    throw new Error(db.status === 401 || db.status === 403
      ? '배선 API 키를 확인해 주세요.' : '배선 DB를 읽을 수 없어요. 서버 주소와 실행 상태를 확인해 주세요.');
  }
  async function checkAI() {
    const info = await request('/chat/config');
    if (info.status !== 200 || info.body?.mode !== 'directline' || info.body.configured !== true) {
      throw new Error('배선 서버의 Copilot Direct Line 설정을 확인해 주세요.');
    }
    if (!testAI) return;
    const result = await request('/chat/sessions', { method: 'POST' });
    const id = result.body?.session_id;
    if (result.status !== 201 || !/^[a-f0-9]{1,64}$/.test(id || '')) {
      throw new Error('Copilot 대화를 열 수 없어요. 서버 설정과 에이전트 권한을 확인해 주세요.');
    }
    void request('/chat/sessions/' + id, { method: 'DELETE' }).catch(() => {});
  }
  const [capabilities, agent] = await Promise.allSettled([request('/circuits/capabilities'), checkAI()]);
  return {
    ready: true,
    aiReady: agent.status === 'fulfilled',
    editorWires: capabilities.status === 'fulfilled' && capabilities.value.status === 200
      && capabilities.value.body?.editor_wires === true
  };
}

ipcMain.handle('circuit:getConnection', () => {
  const config = readConnection();
  return { mode: config.mode, url: config.url, hasKey: !!config.key };
});
ipcMain.handle('circuit:refreshConnection', async () => {
  const config = readConnection();
  if (config.mode === 'remote' && !config.key) return;
  const revision = ++connectionRevision;
  let status;
  try { status = await checkServer(config); }
  catch { status = disconnected; }
  if (revision === connectionRevision) setServerStatus(status);
});
ipcMain.handle('circuit:cancelConnection', () => { connectionRevision++; });
ipcMain.handle('circuit:setConnection', async (_event, input) => {
  const revision = ++connectionRevision;
  const previous = readConnection();
  const config = updateConnection(previous, input);
  if (config.key && !safeStorage.isEncryptionAvailable()) throw new Error('Windows 키 암호화를 사용할 수 없습니다. 이 PC의 로그인 상태를 확인하세요.');
  const next = await checkServer(config, { testAI: true });
  if (revision !== connectionRevision) return null;
  const stored = { mode: config.mode, url: config.url, ...(config.key ? { keyEnc: safeStorage.encryptString(config.key).toString('base64') } : {}) };
  fs.mkdirSync(path.dirname(connectionFile()), { recursive: true });
  fs.writeFileSync(connectionFile(), JSON.stringify(stored, null, 2));
  setServerStatus(next);
  return { ...next, sameServer: config.mode === previous.mode && config.url === previous.url && config.key === previous.key };
});
ipcMain.handle('circuit:autoStatus', () => serverStatus);
ipcMain.handle('circuit:request', async (_event, { path: route, options = {} }) => {
  const config = readConnection();
  const revision = connectionRevision;
  const request = createTransport({ read: () => config });
  const chat = route.startsWith('/chat/');
  const cleanup = chat && options.method === 'DELETE';
  function lost(all) {
    if (revision !== connectionRevision || cleanup) return;
    setServerStatus(all ? { ...serverStatus, ready: false, aiReady: false } : { ...serverStatus, aiReady: false });
  }
  try {
    const result = await request(route, options);
    const authError = [401, 403].includes(result.status);
    if (authError || result.status >= 500) lost(authError || !chat);
    return result;
  } catch (error) {
    lost(!chat);
    throw error;
  }
});

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
    titleBarStyle: 'hidden',
    titleBarOverlay: { color:'#edf2f7', symbolColor:'#202124', height:46 },
    backgroundColor: '#f4f6f9',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.setMenuBarVisibility(false);
  win.webContents.on('will-prevent-unload', () => {
    win.webContents.send('app:confirmClose');
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

ipcMain.handle('app:icon', () => {
  const file = path.join(__dirname, 'build', 'icon.png');
  return fs.existsSync(file) ? `data:image/png;base64,${fs.readFileSync(file).toString('base64')}` : null;
});

ipcMain.handle('settings:get', () => {
  const s = loadSettings();
  return { mode: s.mode, tokenEndpoint: s.tokenEndpoint, webChatUrl: s.webChatUrl, hasSecret: !!s.secret, modeExplicit: fs.existsSync(settingsFile()) };
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
let projectPathRevision = 0;
let pendingProjectPath = null;
const recentProjectsFile = () => path.join(app.getPath('userData'), 'recent-projects.json');
function recentProjects() {
  try {
    const list = JSON.parse(fs.readFileSync(recentProjectsFile(), 'utf8'));
    return Array.isArray(list) ? list.filter(item => typeof item?.path === 'string' && typeof item.title === 'string').slice(0, 10) : [];
  } catch { return []; }
}
function rememberProject(filePath, title) {
  const list = recentProjects();
  const sameFile = item => item.path.toLowerCase() === filePath.toLowerCase();
  const alias = list.find(sameFile)?.alias;
  const entry = { path: filePath, title: alias || title?.trim() || path.basename(filePath), alias };
  const previous = list.filter(item => !sameFile(item));
  try { fs.writeFileSync(recentProjectsFile(), JSON.stringify([entry, ...previous].slice(0, 10))); }
  catch (error) { console.warn('Could not update recent projects:', error.code); }
}
ipcMain.handle('project:recent', () => recentProjects());
ipcMain.handle('project:updateRecent', (_event, filePath, name) => {
  const list = recentProjects();
  const item = list.find(entry => entry.path === filePath);
  if (!item) throw new Error('최근 프로젝트를 찾을 수 없어요.');
  if (name === null) list.splice(list.indexOf(item), 1);
  else {
    if (typeof name !== 'string' || !name.trim() || name.length > 120) throw new Error('이름을 1~120자로 입력하세요.');
    item.alias = item.title = name.trim();
  }
  fs.writeFileSync(recentProjectsFile(), JSON.stringify(list));
});
ipcMain.handle('project:new', () => { projectPathRevision++; projectPath = null; pendingProjectPath = null; });
ipcMain.handle('project:acceptOpen', (_event, title) => {
  if (!pendingProjectPath) return;
  projectPathRevision++;
  projectPath = pendingProjectPath;
  pendingProjectPath = null;
  rememberProject(projectPath, title);
});
ipcMain.handle('project:save', async (_e, data, saveAs = false) => {
  const revision = projectPathRevision;
  let target = projectPath;
  if (saveAs || !target) {
    const r = await dialog.showSaveDialog({ title: saveAs ? '다른 이름으로 저장' : '배선 저장', defaultPath: target || 'wiring.mir.json', filters: [{ name: '미르 배선', extensions: ['json'] }] });
    if (r.canceled || revision !== projectPathRevision) return false;
    target = r.filePath;
  }
  await fs.promises.writeFile(target, JSON.stringify(data, null, 2));
  if (revision === projectPathRevision) projectPath = target;
  rememberProject(target, data.title);
  return true;
});
ipcMain.handle('project:open', async (_event, recentPath) => {
  pendingProjectPath = null;
  let target;
  if (recentPath !== undefined) {
    target = recentProjects().find(item => item.path === recentPath)?.path;
    if (!target) throw new Error('최근 프로젝트 목록에서 파일을 찾을 수 없어요.');
  } else {
    const result = await dialog.showOpenDialog({ title: '배선 열기', filters: [{ name: '미르 배선', extensions: ['json'] }], properties: ['openFile'] });
    if (result.canceled) return null;
    target = result.filePaths[0];
  }
  let data;
  try { data = JSON.parse(await fs.promises.readFile(target, 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') throw new Error('파일을 찾을 수 없어요. 이동했다면 파일 메뉴의 ‘외부에서 가져오기’에서 다시 선택하세요.');
    throw error;
  }
  validateProject(data);
  pendingProjectPath = target;
  return data;
});

ipcMain.handle('docs:open', (_e, name) => {
  const base = app.isPackaged ? path.join(app.getAppPath(), 'docs') : path.join(__dirname, 'docs');
  return shell.openPath(path.join(base, path.basename(name)));
});

app.whenReady().then(createWindow);
ipcMain.handle('agent:openWebsite', (_e, url) => shell.openExternal(validateWebChatUrl(url)));
app.on('window-all-closed', () => app.quit());

ipcMain.handle('app:closeConfirmed', event => { const win = BrowserWindow.fromWebContents(event.sender); if(win) win.destroy(); });

ipcMain.handle('app:titlebarColors', (event, colors) => {
 if(!/^#[0-9a-f]{6}$/i.test(colors?.color||'') || !/^#[0-9a-f]{6}$/i.test(colors?.symbolColor||''))return;
 BrowserWindow.fromWebContents(event.sender)?.setTitleBarOverlay({...colors,height:46});
});
