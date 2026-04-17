const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { backupConfig, getEditorConfigDir } = require('../lib/installer');
const { restoreFromBackup } = require('../lib/backup');

let tmpDir;

describe('backupConfig', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-config-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('备份存在的 settings.json', () => {
    fs.writeFileSync(path.join(tmpDir, 'settings.json'), '{"editor.fontSize": 14}', 'utf8');

    const backupDir = backupConfig(tmpDir);

    assert.ok(fs.existsSync(path.join(backupDir, 'settings.json')));
    assert.equal(
      fs.readFileSync(path.join(backupDir, 'settings.json'), 'utf8'),
      '{"editor.fontSize": 14}'
    );
  });

  it('备份存在的 keybindings.json', () => {
    fs.writeFileSync(path.join(tmpDir, 'keybindings.json'), '[]', 'utf8');

    const backupDir = backupConfig(tmpDir);

    assert.ok(fs.existsSync(path.join(backupDir, 'keybindings.json')));
  });

  it('备份存在的 snippets 目录', () => {
    const snippetsDir = path.join(tmpDir, 'snippets');
    fs.mkdirSync(snippetsDir, { recursive: true });
    fs.writeFileSync(path.join(snippetsDir, 'test.code-snippets'), '{}', 'utf8');

    const backupDir = backupConfig(tmpDir);

    assert.ok(fs.existsSync(path.join(backupDir, 'snippets')));
    assert.ok(fs.existsSync(path.join(backupDir, 'snippets', 'test.code-snippets')));
  });

  it('不存在的文件跳过，不报错', () => {
    const backupDir = backupConfig(tmpDir);

    // 没有文件需要备份，backupDir 不应被创建
    assert.ok(!fs.existsSync(backupDir));
  });

  it('只备份存在的文件，跳过不存在的', () => {
    fs.writeFileSync(path.join(tmpDir, 'settings.json'), '{}', 'utf8');

    const backupDir = backupConfig(tmpDir);

    assert.ok(fs.existsSync(path.join(backupDir, 'settings.json')));
    assert.ok(!fs.existsSync(path.join(backupDir, 'keybindings.json')));
    assert.ok(!fs.existsSync(path.join(backupDir, 'snippets')));
  });

  it('备份目录名以 backup- 开头', () => {
    fs.writeFileSync(path.join(tmpDir, 'settings.json'), '{}', 'utf8');

    const backupDir = backupConfig(tmpDir);
    const dirName = path.basename(backupDir);

    assert.ok(dirName.startsWith('backup-'));
  });

  it('备份内容与原文件一致', () => {
    const original = JSON.stringify({
      'editor.fontSize': 16,
      'editor.tabSize': 2,
      'workbench.colorTheme': 'One Dark Pro',
    }, null, 2);
    fs.writeFileSync(path.join(tmpDir, 'settings.json'), original, 'utf8');

    const backupDir = backupConfig(tmpDir);
    const backed = fs.readFileSync(path.join(backupDir, 'settings.json'), 'utf8');

    assert.equal(backed, original);
  });
});

describe('restoreFromBackup', () => {
  // 使用临时目录模拟 backup + config 目录
  // 避免 restoreFromBackup 写入真实编辑器配置目录
  let mockConfigDir;
  let backupDir;

  beforeEach(() => {
    mockConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-config-restore-'));
    backupDir = path.join(mockConfigDir, `backup-${Date.now()}`);
    fs.mkdirSync(backupDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(mockConfigDir, { recursive: true, force: true });
  });

  it('恢复 settings.json 到编辑器配置目录', () => {
    const content = '{"editor.fontSize": 12}';
    fs.writeFileSync(path.join(backupDir, 'settings.json'), content, 'utf8');

    const restored = restoreFromBackup(backupDir, 'vscode');

    assert.ok(restored.includes('settings.json'));
    // 验证文件实际写入到编辑器配置目录
    const configDir = getEditorConfigDir('vscode');
    assert.ok(fs.existsSync(path.join(configDir, 'settings.json')));
    assert.equal(
      fs.readFileSync(path.join(configDir, 'settings.json'), 'utf8'),
      content
    );
  });

  it('恢复 keybindings.json', () => {
    fs.writeFileSync(path.join(backupDir, 'keybindings.json'), '[]', 'utf8');

    const restored = restoreFromBackup(backupDir, 'vscode');

    assert.ok(restored.includes('keybindings.json'));
  });

  it('恢复 snippets 目录', () => {
    const snippetsDir = path.join(backupDir, 'snippets');
    fs.mkdirSync(snippetsDir, { recursive: true });
    fs.writeFileSync(path.join(snippetsDir, 'test.code-snippets'), '{}', 'utf8');

    const restored = restoreFromBackup(backupDir, 'vscode');

    assert.ok(restored.includes('snippets'));
  });

  it('空备份目录返回空数组', () => {
    const restored = restoreFromBackup(backupDir, 'vscode');
    assert.deepEqual(restored, []);
  });

  it('只恢复存在的文件', () => {
    fs.writeFileSync(path.join(backupDir, 'settings.json'), '{}', 'utf8');

    const restored = restoreFromBackup(backupDir, 'vscode');
    assert.deepEqual(restored, ['settings.json']);
  });
});
