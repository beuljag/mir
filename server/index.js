// 미르 토큰 서버
// Direct Line 비밀 키는 이 서버에만 두고, 앱(.exe)에는 짧게 쓰는 토큰만 내준다.
//   GET /token  → { token, expires_in, domain }
//   GET /health → { ok: true }
// 외부 패키지 없이 Node 18 이상에서 실행된다.

const http = require('http');
const fs = require('fs');
const path = require('path');

// server/.env 가 있으면 읽는다 (KEY=값, 큰따옴표 없이). 이미 있는 환경 변수는 덮어쓰지 않는다.
try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
  }
} catch {}

const SECRET = process.env.COPILOT_DIRECT_LINE_SECRET || '';
const PORT = Number(process.env.PORT) || 3000;
const DOMAIN = (process.env.DIRECT_LINE_DOMAIN || 'https://directline.botframework.com').replace(/\/$/, '');
const LIMIT = Number(process.env.RATE_LIMIT_PER_MIN) || 10;

if (!SECRET) {
  console.error('COPILOT_DIRECT_LINE_SECRET 환경 변수가 없습니다. server/.env 또는 호스팅의 환경 변수에 넣어 주세요.');
  process.exit(1);
}

// ---------- 요청 수 제한 (IP마다 1분에 LIMIT번) ----------
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 60000);
  list.push(now);
  hits.set(ip, list);
  return list.length > LIMIT;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, list] of hits) if (!list.some((t) => now - t < 60000)) hits.delete(ip);
}, 60000).unref();

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

// ---------- 토큰 발급 ----------
async function generateToken() {
  const r = await fetch(`${DOMAIN}/v3/directline/tokens/generate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }
  });
  if (!r.ok) throw new Error(`Direct Line 토큰 발급 실패 (${r.status})`);
  const data = await r.json();
  return { token: data.token, expires_in: data.expires_in, domain: DOMAIN };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method !== 'GET') return send(res, 405, { error: 'GET만 됩니다.' });
  if (url.pathname === '/health') return send(res, 200, { ok: true });
  if (url.pathname !== '/token') return send(res, 404, { error: '없는 주소입니다.' });

  const ip = clientIp(req);
  if (limited(ip)) return send(res, 429, { error: '요청이 너무 많습니다. 잠시 뒤 다시 시도하세요.' });
  try {
    send(res, 200, await generateToken());
  } catch (e) {
    console.error(`[${new Date().toISOString()}] ${ip} ${e.message}`);
    send(res, 502, { error: '토큰을 받지 못했습니다. 서버 관리자에게 알려 주세요.' });
  }
});

server.listen(PORT, () => console.log(`미르 토큰 서버 실행 중: http://localhost:${PORT}/token`));
