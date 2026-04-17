const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('child_process');

const CLI = 'node bin/cli.js';

describe('CLI 基础命令', () => {
  it('--help 正常输出', () => {
    const out = execSync(`${CLI} --help`, { encoding: 'utf8' });
    assert.ok(out.includes('install'));
    assert.ok(out.includes('status'));
    assert.ok(out.includes('restore'));
    assert.ok(out.includes('upload'));
  });

  it('--version 输出版本号', () => {
    const out = execSync(`${CLI} --version`, { encoding: 'utf8' });
    assert.ok(/^\d+\.\d+\.\d+/.test(out.trim()));
  });

  it('无参数显示快速开始', () => {
    const out = execSync(CLI, { encoding: 'utf8' });
    assert.ok(out.includes('快速开始'));
    assert.ok(out.includes('Windsurf'));
    assert.ok(out.includes('Kiro'));
  });
});

describe('CLI install 命令', () => {
  it('install --help 显示 --editor 选项', () => {
    const out = execSync(`${CLI} install --help`, { encoding: 'utf8' });
    assert.ok(out.includes('--editor'));
    assert.ok(out.includes('windsurf'));
    assert.ok(out.includes('kiro'));
  });

  it('install --dry-run --editor=vscode 正常运行', () => {
    const out = execSync(`${CLI} install --dry-run --editor=vscode`, {
      encoding: 'utf8',
      timeout: 30000,
    });
    assert.ok(out.includes('VS Code'));
  });
});

describe('CLI status 命令', () => {
  it('status --help 显示 --editor 选项', () => {
    const out = execSync(`${CLI} status --help`, { encoding: 'utf8' });
    assert.ok(out.includes('--editor'));
  });
});

describe('CLI upload 命令', () => {
  it('upload --help 显示 --editor 选项', () => {
    const out = execSync(`${CLI} upload --help`, { encoding: 'utf8' });
    assert.ok(out.includes('--editor'));
  });
});
