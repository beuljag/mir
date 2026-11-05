const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { initializeDistribution, distributionId } = require('../src/distribution');

test('다른 빌드 PC처럼 .env 없이 전달받은 설정 파일만으로 배포 설정을 생성한다', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mir-team-build-'));
  for (const dir of ['scripts', 'renderer', 'config']) fs.mkdirSync(path.join(root, dir));
  for (const name of ['scripts/electron-builder.shared.cjs', 'renderer/server-connection.js', 'renderer/server-defaults.json', 'package.json']) {
    fs.copyFileSync(path.join(__dirname, '..', name), path.join(root, name));
  }
  const key = 'test-team-build-api-key-12345';
  const profile = path.join(root, 'config', 'distribution-connection.local.json');
  fs.writeFileSync(profile, JSON.stringify({ url: 'https://example.com', key }));
  const script = "require('./scripts/electron-builder.shared.cjs').beforePack()";
  const options = { cwd: root, encoding: 'utf8', env: { ...process.env,
    CIRCUIT_API_KEY: '', MIR_DISTRIBUTION_API_KEY: '', MIR_DISTRIBUTION_SERVER_URL: '',
    MIR_DISTRIBUTION_ENV_FILE: path.join(root, 'absent.env') } };
  const result = spawnSync(process.execPath, ['-e', script], options);
  assert.equal(result.status, 0, result.stderr);
  const generated = JSON.parse(fs.readFileSync(path.join(root, 'work', 'distribution-connection.json')));
  assert.equal(generated.key, key);
  assert.equal(generated.url, 'https://example.com');
  assert.equal(generated.mode, 'remote');
  assert.equal(require('../package.json').scripts.dist, 'npm run dist:shared');
  const staleLocalKey = spawnSync(process.execPath, ['-e', script], {
    ...options, env: { ...options.env, CIRCUIT_API_KEY: 'old-local-server-api-key-12345' }
  });
  assert.equal(staleLocalKey.status, 0, staleLocalKey.stderr);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'work', 'distribution-connection.json'))).key, key);
  fs.unlinkSync(profile);
  const missing = spawnSync(process.execPath, ['-e', script], options);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /distribution-connection.local.json/);
});

test('배포 설정으로 최초 자동 연결하고 이후 사용자 선택을 유지하며 키 교체 시 갱신한다', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mir-distribution-'));
  const resourcesPath = path.join(root, 'resources');
  const userDataPath = path.join(root, 'profile');
  fs.mkdirSync(resourcesPath);
  fs.mkdirSync(userDataPath);
  const settingsPath = path.join(userDataPath, 'settings.json');
  const connectionPath = path.join(userDataPath, 'server-connection.json');
  const configPath = path.join(resourcesPath, 'distribution-connection.json');
  const key = 'test-distribution-api-key-12345';
  fs.writeFileSync(settingsPath, JSON.stringify({ mode: 'web', webChatUrl: 'existing' }));
  fs.writeFileSync(configPath, JSON.stringify({
    id: 'first', mode: 'remote', url: 'https://example.com', key
  }));
  const options = { resourcesPath, userDataPath, encryptKey: (value) => Buffer.from('encrypted:' + value) };
  initializeDistribution(options);
  const connection = JSON.parse(fs.readFileSync(connectionPath));
  const settings = JSON.parse(fs.readFileSync(settingsPath));
  assert.equal(connection.url, 'https://example.com');
  assert.equal(connection.key, undefined);
  assert.equal(Buffer.from(connection.keyEnc, 'base64').toString(), 'encrypted:' + key);
  assert.equal(settings.mode, 'server');
  assert.equal(settings.webChatUrl, 'existing');
  assert.equal(distributionId(settingsPath), 'first');
  fs.writeFileSync(settingsPath, JSON.stringify({ ...settings, mode: 'demo' }));
  initializeDistribution(options);
  assert.equal(JSON.parse(fs.readFileSync(settingsPath)).mode, 'demo');
  fs.writeFileSync(configPath, JSON.stringify({
    id: 'second', mode: 'remote', url: 'https://example.com', key: key + '-rotated'
  }));
  initializeDistribution(options);
  assert.equal(JSON.parse(fs.readFileSync(settingsPath)).mode, 'server');
  assert.equal(distributionId(settingsPath), 'second');
});

test('암호화 실패 시 적용 완료로 기록하지 않고 다시 실행하면 복구한다', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mir-distribution-retry-'));
  const userDataPath = path.join(root, 'profile');
  const config = { id: 'one', mode: 'remote', url: 'https://example.com', key: 'test-distribution-api-key-12345' };
  fs.writeFileSync(path.join(root, 'distribution-connection.json'), JSON.stringify(config));
  assert.throws(() => initializeDistribution({
    resourcesPath: root, userDataPath, encryptKey() { throw new Error('unavailable'); }
  }), /unavailable/);
  assert.equal(distributionId(path.join(userDataPath, 'settings.json')), undefined);
  initializeDistribution({ resourcesPath: root, userDataPath, encryptKey: Buffer.from });
  assert.equal(distributionId(path.join(userDataPath, 'settings.json')), 'one');
});
