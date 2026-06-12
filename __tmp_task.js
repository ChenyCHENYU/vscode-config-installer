const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const CWD = 'd:/project/_npm-wrap/vscode-config-installer';
const GIT = 'D:/development/Git/bin/git.exe';

function run(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', cwd: CWD, windowsHide: true, ...opts });
}

function git(args) {
  return run(`"${GIT}" ${args}`);
}

try {
  // 修复 safe.directory
  git('config --global --add safe.directory D:/project/_npm-wrap/vscode-config-installer');
  console.log('safe.directory added');

  console.log(git('status'));

  git('add -A');
  console.log('staged');

  try {
    console.log(git('commit -m "feat(editors): 新增 Qoder 编辑器支持，升级版本至 3.14.3"'));
  } catch (e) {
    console.log('commit:', e.stdout || e.message);
  }

  try {
    console.log(git('push'));
  } catch (e) {
    console.log('push:', e.stdout || e.stderr || e.message);
  }
} catch (e) {
  console.log('error:', e.message);
}
