const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { EDITOR_REGISTRY, resolveEditorKeys } = require('../lib/editors');

describe('EDITOR_REGISTRY', () => {
  it('包含 4 个编辑器', () => {
    const keys = Object.keys(EDITOR_REGISTRY);
    assert.deepEqual(keys, ['vscode', 'cursor', 'windsurf', 'kiro']);
  });

  it('每个编辑器都有必需字段', () => {
    const requiredFields = [
      'label', 'winExeName', 'winCmdScript', 'winDirs',
      'winPathPattern', 'macAppNames', 'macExeName',
      'linuxDirs', 'linuxExeName', 'configDirName',
      'cliName', 'website',
    ];
    for (const [key, reg] of Object.entries(EDITOR_REGISTRY)) {
      for (const field of requiredFields) {
        assert.ok(reg[field] !== undefined, `${key} 缺少字段 ${field}`);
      }
    }
  });

  it('winDirs 都是函数（延迟求值）', () => {
    for (const [key, reg] of Object.entries(EDITOR_REGISTRY)) {
      for (const dir of reg.winDirs) {
        assert.equal(typeof dir, 'function', `${key}.winDirs 应为函数数组`);
      }
    }
  });

  it('configDirName 非空且唯一', () => {
    const names = Object.values(EDITOR_REGISTRY).map(r => r.configDirName);
    assert.equal(new Set(names).size, names.length, 'configDirName 应唯一');
  });

  it('cliName 非空且唯一', () => {
    const names = Object.values(EDITOR_REGISTRY).map(r => r.cliName);
    assert.equal(new Set(names).size, names.length, 'cliName 应唯一');
  });
});

describe('resolveEditorKeys', () => {
  it('默认返回 vscode', () => {
    assert.deepEqual(resolveEditorKeys(), ['vscode']);
  });

  it('空字符串返回 vscode', () => {
    assert.deepEqual(resolveEditorKeys(''), ['vscode']);
  });

  it('vscode 返回 [vscode]', () => {
    assert.deepEqual(resolveEditorKeys('vscode'), ['vscode']);
  });

  it('cursor 返回 [cursor]', () => {
    assert.deepEqual(resolveEditorKeys('cursor'), ['cursor']);
  });

  it('windsurf 返回 [windsurf]', () => {
    assert.deepEqual(resolveEditorKeys('windsurf'), ['windsurf']);
  });

  it('kiro 返回 [kiro]', () => {
    assert.deepEqual(resolveEditorKeys('kiro'), ['kiro']);
  });

  it('all 返回所有编辑器', () => {
    const result = resolveEditorKeys('all');
    assert.deepEqual(result, ['vscode', 'cursor', 'windsurf', 'kiro']);
  });

  it('大小写不敏感', () => {
    assert.deepEqual(resolveEditorKeys('VSCode'), ['vscode']);
    assert.deepEqual(resolveEditorKeys('CURSOR'), ['cursor']);
    assert.deepEqual(resolveEditorKeys('ALL'), ['vscode', 'cursor', 'windsurf', 'kiro']);
  });

  it('未知值回退 vscode', () => {
    assert.deepEqual(resolveEditorKeys('unknown'), ['vscode']);
  });
});
