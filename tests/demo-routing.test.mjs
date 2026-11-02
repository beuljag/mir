import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../renderer/agent.js', import.meta.url), 'utf8');
const { demoReply, parseReply, buildRecommendRequest, buildChatRequest } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('신고 문장은 ESP32 밸브 회로로 대체하지 않으며 전압을 가정하지 않음', () => {
  const reply = demoReply(buildRecommendRequest('라즈베리파이로 펌프를 키고 끄고싶어. 펌프 전류는 파워서플라이 써서 외부 전원을 끌어올꺼야'));
  assert.equal(parseReply(reply).wiring, undefined);
  assert.match(reply, /라즈베리파이로/);
  assert.match(reply, /정격 전압/);
  assert.doesNotMatch(reply, /12V|GPIO23|"solenoid-valve-12v"/);
});

test('현재 배선에 ESP32 밸브가 있어도 새 펌프 요청을 덮어쓰지 않음', () => {
  const message = buildChatRequest('라즈베리파이로 펌프를 제어해줘', {
    type: 'wiring', parts: [{ ref: 'U1', part: 'esp32-devkitc' }], title: '12V 밸브'
  });
  const reply = demoReply(message);
  assert.match(reply, /라즈베리파이로/);
  assert.equal(parseReply(reply).wiring, undefined);
});

test('라즈베리파이 LED 요청은 라즈베리파이, ESP32 LED는 ESP32로 표시', () => {
  for (const [goal, part] of [['라즈베리파이 LED 깜빡이기', 'raspberry-pi-4'], ['ESP32 LED 깜빡이기', 'esp32-devkitc']]) {
    const reply = parseReply(demoReply(buildRecommendRequest(goal)));
    assert.equal(reply.wiring.parts[0].part, part);
  }
});

test('라즈베리파이 밸브·온도 요청에 ESP32 또는 LED 회로를 대신 보내지 않음', () => {
  for (const goal of ['라즈베리파이로 외부 전원 밸브 제어', '라즈베리파이 온도센서 연결']) {
    assert.equal(parseReply(demoReply(buildRecommendRequest(goal))).wiring, undefined);
  }
});

test('외부 전원만 언급해도 밸브 예시를 자동 선택하지 않음', () => {
  assert.equal(parseReply(demoReply(buildRecommendRequest('파워서플라이로 외부 전원을 쓸 거야'))).wiring, undefined);
});

test('응답 양식의 파이썬이라는 단어로 라즈베리파이를 선택하지 않음', () => {
  assert.equal(parseReply(demoReply(buildRecommendRequest('새 프로젝트를 만들고 싶어'))).wiring, undefined);
});

test('기존 지원 예시는 유지하고 다른 보드를 요청하면 ESP32로 바꾸지 않음', () => {
  assert.equal(parseReply(demoReply(buildRecommendRequest('ESP32로 외부 전원 밸브 제어'))).wiring.parts[0].part, 'esp32-devkitc');
  assert.equal(parseReply(demoReply(buildRecommendRequest('온습도를 읽어서 화면에 띄우기'))).wiring.parts[0].part, 'esp32-devkitc');
  assert.equal(parseReply(demoReply(buildRecommendRequest('아두이노 LED'))).wiring, undefined);
});
