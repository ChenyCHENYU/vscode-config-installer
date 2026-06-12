const { execSync } = require('child_process');
const GIT = 'D:/development/Git/bin/git.exe';
const CWD = 'd:/project/_npm-wrap/vscode-config-installer';
const g = a => execSync(`"${GIT}" ${a}`, { encoding: 'utf8', cwd: CWD, windowsHide: true });
try {
  g('add -A');
  console.log(g('commit -m "chore: 删除临时脚本文件"'));
  console.log(g('push'));
} catch (e) {
  console.log(e.stdout || e.stderr || e.message);
}
