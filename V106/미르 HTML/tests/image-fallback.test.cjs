const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const circuitApi = import('data:text/javascript;base64,' + Buffer.from(read('assets/circuit-api.js')).toString('base64'));

test('그림은 optional=true로 요청하고 빈 값은 기본 그림을 유지한다', async () => {
  const { loadComponentImage } = await circuitApi;
  const part = { id: 'esp32 devkit', pins: [{ id: 'P', side: 'left' }] };
  const paths = [];
  for (const image_data of ['', '  ', null, undefined]) {
    const result = await loadComponentImage({ call: async (route) => { paths.push(route); return { image_data, layout: null }; } }, part);
    assert.equal(result, part);
  }
  assert.ok(paths.every((route) => route === '/components/esp32%20devkit/image?optional=true'));
});

test('그림 오류만 기본 그림으로 대신하고 인증·네트워크·서버 오류는 그대로 알린다', async () => {
  const { loadComponentImage, isRecoverableImageError } = await circuitApi;
  const part = { id: 'p', pins: [{ id: 'P', side: 'left' }] };
  for (const result of [{ image_data: 42 }, { image_data: 'data:image/png;base64,AAAA', layout: {} },
    { image_data: 'data:image/svg+xml;base64,AAA', layout: {} },
    { image_data: 'data:image/svg+xml;base64,AAA', layout: { pins: [] } }]) {
    const error = await loadComponentImage({ call: async () => result }, part).catch((e) => e);
    assert.ok(error instanceof Error && isRecoverableImageError(error), String(error));
  }
  assert.equal(isRecoverableImageError(Object.assign(new Error(), { status: 409 })), true);
  for (const error of [Object.assign(new Error(), { status: 401 }), Object.assign(new Error(), { status: 500 }),
    new Error('서버가 JSON을 반환하지 않았습니다.'), null]) {
    assert.equal(isRecoverableImageError(error), false);
  }
  const status404 = Object.assign(new Error(), { status: 404 });
  assert.equal(await loadComponentImage({ call: async () => { throw status404; } }, part), part);
});

// 허용 경로는 Python 로컬 연결, 브라우저 연결 코드, 빌드된 번들에 각각 있다. 하나만 고치면 실행 중에 요청이 막힌다.
test('모든 허용 경로 사본이 같고 optional 그림 요청을 허용한다', () => {
  const js = (file) => {
    const match = read(file).match(/const routes = \/(\^.*?\$)\/;/);
    assert.ok(match, `${file}에서 허용 경로를 찾지 못했습니다.`);
    return match[1].replaceAll(String.raw`\/`, '/');
  };
  const py = read('서버/app/local_connection.py').match(/ROUTES = re\.compile\(r'(\^.*?\$)'\)/);
  assert.ok(py, 'local_connection.py에서 허용 경로를 찾지 못했습니다.');
  for (const file of ['assets/server-connection.js', '미르.js']) assert.equal(js(file), py[1], `${file}의 허용 경로가 서버와 다릅니다.`);
  const routes = new RegExp(py[1]);
  assert.ok(routes.test('/components/esp32-devkitc/image?optional=true'));
  assert.ok(!routes.test('/components/esp32-devkitc/image?optional=false'));
});

test('번들에도 같은 그림 대체 처리가 들어 있다', () => {
  const bundle = read('미르.js');
  for (const name of ['function isRecoverableImageError', 'async function imageOrDefault', 'async function mapLimit']) {
    assert.ok(bundle.includes(name), `미르.js에 ${name}이 없습니다. npm run build로 다시 만드세요.`);
  }
  assert.ok(!/await loadComponentImage\(/.test(bundle.slice(bundle.indexOf('function initBackendPanel'))),
    '부품 패널이 그림 대체 없이 loadComponentImage를 직접 부릅니다.');
});
