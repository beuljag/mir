'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { updateConnection, createTransport } = require('./assets/server-connection.js');

const PORT = 8791;
const HOST = '127.0.0.1';
const ADDRESS = HOST + ':' + PORT;
const ORIGIN = 'http://' + ADDRESS;
const ROOT = __dirname;
const PARTS = path.join(ROOT, '서버', 'parts');
const MAX_BODY = 40 * 1024 * 1024;
const ENTRY = '미르 HTML.html';
const VERSION = 'V93';
const LAUNCHER_STATUS = '/api/mir-html-status';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};
const staticFiles = new Map([
  ['/', ENTRY],
  ['/' + ENTRY, ENTRY],
  ['/미르.js', '미르.js'],
  ['/미르.css', '미르.css']
]);
for (const directory of ['assets', 'docs']) {
  for (const item of fs.readdirSync(path.join(ROOT, directory), { withFileTypes: true })) {
    if (!item.isFile() || !Object.hasOwn(MIME, path.extname(item.name))) continue;
    const file = directory + '/' + item.name;
    staticFiles.set('/' + file, file);
  }
}

function builtInParts() {
  const parts = [], errors = [];
  for (const file of fs.readdirSync(PARTS).sort()) {
    if (!/^[a-z0-9][a-z0-9-]*\.json$/.test(file)) continue;
    try {
      const part = JSON.parse(fs.readFileSync(path.join(PARTS, file), 'utf8'));
      let imageData;
      if (part.image) {
        const image = path.join(PARTS, path.basename(part.image));
        const type = MIME[path.extname(image)];
        if (['image/svg+xml', 'image/png'].includes(type) && fs.existsSync(image)) {
          imageData = 'data:' + type + ';base64,' + fs.readFileSync(image).toString('base64');
        }
      }
      parts.push({ ...part, source: 'builtin', file, imageData });
    } catch {
      errors.push(file + ' · 기본 부품을 읽을 수 없어요.');
    }
  }
  return { parts, errors };
}

function send(res, status, body, type = 'application/json; charset=utf-8', head = false) {
  const data = Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': data.length,
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN'
  });
  res.end(head ? undefined : data);
}

async function readRequest(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('REQUEST_TOO_LARGE');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function forward(req, res) {
  if (req.headers.origin !== ORIGIN || !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) {
    send(res, 403, { error: '미르 HTML에서 시작한 연결 요청만 사용할 수 있어요.' });
    return;
  }
  if (Number(req.headers['content-length']) > MAX_BODY) {
    send(res, 413, { error: '보내려는 파일이 너무 커요.' });
    return;
  }
  let input, config;
  try {
    input = await readRequest(req);
    if (!['local', 'remote'].includes(input?.mode) || typeof input.route !== 'string'
      || !['GET', 'POST', 'PUT', 'DELETE'].includes(input.method)
      || (input.body !== undefined && typeof input.body !== 'string')) throw new Error();
    config = updateConnection({}, { mode: input.mode, url: input.url, key: req.headers['x-api-key'] });
  } catch {
    send(res, 400, { error: '서버 주소, API 키 또는 요청 형식을 확인해 주세요.' });
    return;
  }

  try {
    const requestCircuit = createTransport({ read: () => config });
    const result = await requestCircuit(input.route, { method: input.method, body: input.body });
    if (!Number.isInteger(result?.status)) throw new Error('INVALID_RESPONSE');
    send(res, 200, result);
  } catch (error) {
    const message = error.message === '허용되지 않은 API 요청입니다.'
      ? error.message
      : config.mode === 'local'
        ? '이 PC의 배선 서버에 접속할 수 없어요. 서버를 켠 뒤 다시 시도해 주세요.'
        : '공유 배선 서버에 접속할 수 없어요. 터널 주소와 서버 실행 상태를 확인해 주세요.';
    send(res, 502, { error: message });
  }
}

function createServer() {
  return http.createServer(async (req, res) => {
    if (req.headers.host !== ADDRESS) {
      send(res, 403, { error: '미르 HTML은 이 PC의 주소에서 열어 주세요.' });
      return;
    }
    try {
      const url = decodeURIComponent(new URL(req.url, ORIGIN).pathname);
      if (req.method === 'POST' && url === '/api/mir') {
        await forward(req, res);
        return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        send(res, 405, { error: '지원하지 않는 요청 방식이에요.' });
        return;
      }
      const head = req.method === 'HEAD';
      if (url === LAUNCHER_STATUS) {
        send(res, 200, { app: 'mir-html', version: VERSION }, undefined, head);
        return;
      }
      if (url === '/api/parts') {
        send(res, 200, builtInParts(), undefined, head);
        return;
      }
      if (url === '/api/part-template') {
        send(res, 200, fs.readFileSync(path.join(PARTS, '_template.json')), undefined, head);
        return;
      }
      const file = staticFiles.get(url);
      if (!file) {
        send(res, 404, { error: '파일을 찾을 수 없어요.' }, undefined, head);
        return;
      }
      send(res, 200, fs.readFileSync(path.join(ROOT, file)), MIME[path.extname(file)], head);
    } catch {
      if (!res.headersSent && !res.destroyed) send(res, 500, { error: '미르 HTML 파일을 읽을 수 없어요.' });
    }
  });
}

function openBrowser() {
  const windows = process.platform === 'win32';
  const command = windows ? 'cmd.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = windows ? ['/d', '/c', 'start', '""', ORIGIN + '/'] : [ORIGIN + '/'];
  const child = spawn(command, args, {
    detached: true, stdio: 'ignore', windowsHide: true, windowsVerbatimArguments: windows
  });
  child.on('error', () => console.log('브라우저 주소창에서 ' + ORIGIN + '/ 을 열어 주세요.'));
  child.unref();
}

if (require.main === module) {
  const server = createServer();
  server.on('error', async (error) => {
    if (error.code === 'EADDRINUSE') {
      try {
        const response = await fetch(ORIGIN + LAUNCHER_STATUS, {
          signal: AbortSignal.timeout(2000), redirect: 'error'
        });
        const status = response.ok ? await response.json() : null;
        if (status?.app === 'mir-html') {
          if (status.version === VERSION) {
            console.log('실행 중인 미르 HTML ' + VERSION + ' ' + ORIGIN + '/');
            if (process.argv.includes('--open')) openBrowser();
          } else {
            console.error('다른 버전의 미르 HTML이 실행 중이에요. 기존 실행 창을 닫고 ' + VERSION + '을 다시 열어 주세요.');
            process.exitCode = 1;
          }
          return;
        }
      } catch { /* 같은 포트에 있는 다른 프로그램은 건드리지 않는다. */ }
      console.error('다른 프로그램이 8791번 포트를 사용 중이에요.');
    } else {
      console.error('미르 HTML 실행기를 시작하지 못했어요. ' + error.code);
    }
    process.exitCode = 1;
  });
  server.listen(PORT, HOST, () => {
    console.log('미르 HTML ' + VERSION + ' ' + ORIGIN + '/');
    console.log('사용하는 동안 이 창을 열어 두세요.');
    if (process.argv.includes('--open')) openBrowser();
  });
}

module.exports = { createServer, HOST, PORT, ORIGIN };

