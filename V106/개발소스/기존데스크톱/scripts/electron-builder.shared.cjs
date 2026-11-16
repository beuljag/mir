const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');
const { createHash } = require('node:crypto');
const { updateConnection } = require('../renderer/server-connection');
const { build } = require('../package.json');

const root = path.resolve(__dirname, '..');
const generated = path.join(root, 'work', 'distribution-connection.json');

function prepareDistribution() {
  const envPath = process.env.MIR_DISTRIBUTION_ENV_FILE || path.join(root, '.env');
  const values = fs.existsSync(envPath) ? parseEnv(fs.readFileSync(envPath, 'utf8')) : {};
  const env = { ...values, ...process.env };
  const profilePath = path.join(root, 'config', 'distribution-connection.local.json');
  let profile = {};
  if (fs.existsSync(profilePath)) {
    try { profile = JSON.parse(fs.readFileSync(profilePath, 'utf8').replace(/^\uFEFF/, '')); }
    catch { throw new Error('config/distribution-connection.local.json의 JSON 형식을 확인하세요.'); }
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
      throw new Error('자동 연결 빌드 설정 파일의 형식이 올바르지 않습니다.');
    }
  }
  const defaults = JSON.parse(fs.readFileSync(path.join(root, 'renderer', 'server-defaults.json'), 'utf8'));
  const url = env.MIR_DISTRIBUTION_SERVER_URL || profile.url || defaults.sharedServerUrl;
  if (typeof url !== 'string') throw new Error('배포 서버 주소는 문자열이어야 합니다.');
  const { mode, url: normalized } = updateConnection({}, { mode: 'remote', url });
  const connection = { mode, url: normalized };
  if (!connection.url.startsWith('https://')) throw new Error('배포용 공유 서버는 HTTPS 주소여야 합니다.');
  const id = createHash('sha256').update(JSON.stringify(connection)).digest('hex');
  fs.mkdirSync(path.dirname(generated), { recursive: true });
  fs.writeFileSync(generated, JSON.stringify({ ...connection, id }, null, 2));
}

module.exports = {
  ...build,
  extends: null,
  artifactName: 'mir-shared.exe',
  directories: { ...build.directories, output: 'release-shared-auto' },
  beforePack: prepareDistribution,
  extraResources: [...build.extraResources, { from: generated, to: 'distribution-connection.json' }]
};
