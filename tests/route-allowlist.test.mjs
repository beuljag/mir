import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

// 허용 경로 목록은 Python 로컬 연결과 JS 연결 코드에 각각 있다. 하나만 고치면 실행 중에 요청이 막힌다.
const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const jsRoutes = (source, path) => {
  const match = source.match(/const routes = \/(\^.*?\$)\/;/);
  assert.ok(match, `${path}에서 허용 경로를 찾지 못했습니다.`);
  return match[1].replaceAll(String.raw`\/`, '/');
};
const pyRoutes = (source, path) => {
  const match = source.match(/ROUTES = re\.compile\(r'(\^.*?\$)'\)/);
  assert.ok(match, `${path}에서 허용 경로를 찾지 못했습니다.`);
  return match[1];
};

const copies = [
  ['app/local_connection.py', pyRoutes],
  ['V95/미르 HTML/서버/app/local_connection.py', pyRoutes],
  ['renderer/server-connection.js', jsRoutes],
  ['V95/미르 HTML/assets/server-connection.js', jsRoutes],
  ['V95/미르 HTML/미르.js', jsRoutes]
];

test('모든 허용 경로 사본이 같고 optional 그림 요청을 허용', () => {
  const [[firstPath, firstRead], ...rest] = copies;
  const expected = firstRead(read(firstPath), firstPath);
  for (const [path, extract] of rest) assert.equal(extract(read(path), path), expected, `${path}의 허용 경로가 ${firstPath}와 다릅니다.`);
  const routes = new RegExp(expected);
  assert.ok(routes.test('/components/esp32-devkitc/image?optional=true'));
  assert.ok(!routes.test('/components/esp32-devkitc/image?optional=false'));
});
