const fs = require('node:fs');
const path = require('node:path');
const { updateConnection } = require('../renderer/server-connection');

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new Error('배포 연결 설정 파일을 읽지 못했습니다.');
  }
}

function initializeDistribution({ resourcesPath, userDataPath, encryptKey }) {
  const config = readJson(path.join(resourcesPath, 'distribution-connection.json'));
  if (!config) return;
  const settingsPath = path.join(userDataPath, 'settings.json');
  const settings = readJson(settingsPath) || {};
  if (settings.distributionId === config.id) return;
  if (typeof config.id !== 'string' || !config.id) throw new Error('배포 연결 버전이 없습니다.');
  const connection = updateConnection({}, config);
  if (connection.mode !== 'remote') throw new Error('배포 서버 주소가 없습니다.');
  const keyEnc = encryptKey(connection.key).toString('base64');
  fs.mkdirSync(userDataPath, { recursive: true });
  fs.writeFileSync(path.join(userDataPath, 'server-connection.json'),
    JSON.stringify({ mode: 'remote', url: connection.url, keyEnc }, null, 2));
  fs.writeFileSync(settingsPath,
    JSON.stringify({ ...settings, mode: 'server', distributionId: config.id }, null, 2));
}

function distributionId(settingsPath) {
  try { return readJson(settingsPath)?.distributionId; }
  catch { return undefined; }
}

module.exports = { initializeDistribution, distributionId };
