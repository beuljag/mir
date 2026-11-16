'use strict';

// 로컬·클라우드 실행 조건을 한 곳에서 검사한다. 입력한 값이나 비밀값은 오류에 넣지 않는다.
function httpsOrigin(name, value) {
  if (!value) throw new Error(`${name} 환경 변수가 필요합니다. 공개 HTTPS 원점을 설정하세요.`);
  let url;
  try { url = new URL(value); } catch { throw new Error(`${name} 환경 변수에 올바른 HTTPS 원점이 필요합니다.`); }
  if (url.protocol !== 'https:' || url.origin !== value || url.username || url.password) {
    throw new Error(`${name} 환경 변수는 경로·계정 정보·끝 슬래시 없는 HTTPS 원점이어야 합니다.`);
  }
  return url.origin;
}

function readRuntimeConfig(env = process.env) {
  const mode = env.MIR_DEPLOYMENT || '';
  if (mode && mode !== 'railway') throw new Error('MIR_DEPLOYMENT는 미설정 또는 railway만 지원합니다.');
  const cloud = mode === 'railway';
  const rawPort = env.PORT || '8791';
  if (!/^\d+$/.test(rawPort) || Number(rawPort) < 1 || Number(rawPort) > 65535) {
    throw new Error('PORT 환경 변수는 1~65535의 정수여야 합니다.');
  }
  const port = Number(rawPort);
  // Railway의 기존/자동 주입 HOST 값과 무관하게 외부 요청을 받는 인터페이스에 바인딩한다.
  const host = cloud ? '0.0.0.0' : (env.HOST || '127.0.0.1');
  if (!host || /[\s/@?#]/.test(host)) throw new Error('HOST 환경 변수에 올바른 바인딩 주소가 필요합니다.');
  const address = `${host.includes(':') ? '[' + host + ']' : host}:${port}`;
  const origin = 'http://' + address;
  return {
    cloud, port, host, address, origin,
    publicOrigin: cloud ? httpsOrigin('MIR_WEB_ORIGIN', env.MIR_WEB_ORIGIN) : origin,
    backendOrigin: cloud ? httpsOrigin('MIR_BACKEND_URL', env.MIR_BACKEND_URL) : undefined
  };
}

function shouldOpenBrowser(argv, config) { return !config.cloud && argv.includes('--open'); }
module.exports = { readRuntimeConfig, shouldOpenBrowser };
