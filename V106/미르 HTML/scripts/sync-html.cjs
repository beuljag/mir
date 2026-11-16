'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const input = process.argv[2];
if (!input) throw new Error('사용법: npm run sync:html -- <MIR 버전의 HTML 원본 폴더>');
const source = path.resolve(input);
if (source === root) throw new Error('별도의 MIR HTML 원본 폴더를 지정하세요.');
for (const file of ['entry.js', '미르 HTML.html', '미르.css', 'assets/app.js']) {
  if (!fs.existsSync(path.join(source, file))) throw new Error(`HTML 원본에 ${file} 파일이 없습니다.`);
}
const metadataPath = path.join(source, 'mir-version.json');
const declared = fs.existsSync(metadataPath) ? JSON.parse(fs.readFileSync(metadataPath, 'utf8')).version : null;
const version = declared && /^V\d+$/.test(declared) ? [declared, declared] : fs.readFileSync(path.join(source, 'serve.cjs'), 'utf8').match(/const VERSION = ['"](V\d+)['"]/);
if (!version) throw new Error('HTML 원본의 버전을 확인할 수 없어 동기화를 중단했습니다.');
const app = fs.readFileSync(path.join(source, 'assets/app.js'), 'utf8');
if (!/export\s+(?:async\s+)?function\s+initWorkspace/.test(app)) throw new Error('브라우저 앱의 initWorkspace 계약을 확인하세요.');
if (fs.existsSync(path.join(root,'assets','led-tutorial.js')) && !app.includes('initLedTutorial')) {
  throw new Error('원본에 LED 튜토리얼 통합이 없습니다. 기존 튜토리얼을 누락시키지 않도록 통합 후 다시 실행하세요.');
}
// 배포 중계·인증 어댑터는 이 저장소가 관리한다. 일반 UI·회로 엔진만 원본에서 갱신한다.
const preserved = new Set(['web-api.js', 'server-connection.js']);
for (const directory of ['assets', 'docs']) {
  for (const file of fs.readdirSync(path.join(source, directory), { withFileTypes:true })) {
    if (!file.isFile() || !/\.(?:js|css|html|png|svg)$/i.test(file.name)) continue;
    if (directory === 'assets' && preserved.has(file.name)) continue;
    fs.copyFileSync(path.join(source, directory, file.name), path.join(root, directory, file.name));
  }
}
for (const file of ['entry.js', '미르 HTML.html', '미르.css']) fs.copyFileSync(path.join(source,file), path.join(root,file));
fs.writeFileSync(path.join(root,'mir-version.json'), JSON.stringify({version:version[1],sourceRepository:'beuljag/mir',sourcePath:path.basename(source)},null,2)+'\n');
const result = spawnSync(process.execPath, [path.join(__dirname,'build-web.cjs')], {stdio:'inherit'});
if (result.status !== 0) throw new Error('HTML 빌드에 실패했습니다. 커밋·업로드하지 말고 차이를 확인하세요.');
console.log('HTML 원본 동기화 완료. 서버·Railway·인증 어댑터는 유지했습니다. npm test로 검사하세요.');
