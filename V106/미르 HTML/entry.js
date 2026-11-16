import { initWorkspace } from './assets/app.js';
import './assets/workspace-frame.js';
import './assets/titlebar.js';
async function startWorkspace() {
  const dialog = document.getElementById('mirStart');
  const status = document.getElementById('startStatus');
  document.getElementById('mirFileStart').hidden = true;
  status.textContent = '제작대를 열고 있어요.';
  try {
    await initWorkspace();
    dialog.close();
    document.body.classList.remove('mir-connecting');
    document.getElementById('btnMenu').focus({ preventScroll: true });
  } catch (error) {
    status.textContent = '제작대를 열 수 없어요. 미르 HTML 폴더 전체가 함께 있는지 확인해 주세요. ' + error.message;
    status.classList.add('bad');
  }
}
void startWorkspace();
