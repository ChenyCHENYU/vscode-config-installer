const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const os = require('os');

const {
  getEditorConfigDir,
  parseJsonc,
  deepMerge,
  isValidExtId,
  detectEditorPaths,
} = require('../lib/installer');

describe('getEditorConfigDir', () => {
  it('vscode 返回有效路径', () => {
    const dir = getEditorConfigDir('vscode');
    assert.ok(dir);
    assert.ok(dir.includes('User'));
  });

  it('windsurf 返回包含 Windsurf 的路径', () => {
    const dir = getEditorConfigDir('windsurf');
    assert.ok(dir.includes('Windsurf'));
  });

  it('kiro 返回包含 Kiro 的路径', () => {
    const dir = getEditorConfigDir('kiro');
    assert.ok(dir.includes('Kiro'));
  });

  it('未知编辑器抛出错误', () => {
    assert.throws(() => getEditorConfigDir('unknown'), /未知编辑器/);
  });

  it('路径以 User 结尾', () => {
    for (const key of ['vscode', 'cursor', 'windsurf', 'kiro']) {
      const dir = getEditorConfigDir(key);
      assert.ok(dir.endsWith(path.join('User')), `${key} 路径应以 User 结尾`);
    }
  });
});

describe('parseJsonc', () => {
  it('解析标准 JSON', () => {
    const result = parseJsonc('{"a": 1}');
    assert.equal(result.a, 1);
  });

  it('去除单行注释', () => {
    const result = parseJsonc('{\n  // comment\n  "a": 1\n}');
    assert.equal(result.a, 1);
  });

  it('去除多行注释', () => {
    const result = parseJsonc('{\n  /* block */\n  "a": 1\n}');
    assert.equal(result.a, 1);
  });

  it('不破坏字符串内的注释符号', () => {
    const result = parseJsonc('{"url": "https://example.com//path"}');
    assert.equal(result.url, 'https://example.com//path');
  });

  it('处理尾逗号', () => {
    const result = parseJsonc('{"a": 1, "b": 2,}');
    assert.equal(result.a, 1);
    assert.equal(result.b, 2);
  });
});

describe('deepMerge', () => {
  it('简单合并', () => {
    const result = deepMerge({ a: 1 }, { b: 2 });
    assert.equal(result.a, 1);
    assert.equal(result.b, 2);
  });

  it('覆盖同名 key', () => {
    const result = deepMerge({ a: 1 }, { a: 2 });
    assert.equal(result.a, 2);
  });

  it('深层嵌套合并', () => {
    const result = deepMerge(
      { editor: { fontSize: 14, theme: 'dark' } },
      { editor: { fontSize: 16 } },
    );
    assert.equal(result.editor.fontSize, 16);
    assert.equal(result.editor.theme, 'dark');
  });

  it('不修改原始对象', () => {
    const a = { x: 1 };
    const b = { y: 2 };
    deepMerge(a, b);
    assert.equal(Object.keys(a).length, 1);
  });
});

describe('isValidExtId', () => {
  it('合法扩展 ID', () => {
    assert.ok(isValidExtId('esbenp.prettier-vscode'));
    assert.ok(isValidExtId('dbaeumer.vscode-eslint'));
    assert.ok(isValidExtId('ms-python.python'));
  });

  it('拒绝空字符串', () => {
    assert.ok(!isValidExtId(''));
  });

  it('拒绝以点开头', () => {
    assert.ok(!isValidExtId('.hidden'));
  });

  it('拒绝特殊字符', () => {
    assert.ok(!isValidExtId('hack;rm -rf'));
    assert.ok(!isValidExtId('$(whoami)'));
  });
});

describe('detectEditorPaths', () => {
  it('未知编辑器返回 null', () => {
    assert.equal(detectEditorPaths('unknown'), null);
  });

  it('返回结果包含 editor 字段', () => {
    const result = detectEditorPaths('vscode');
    if (result) {
      assert.equal(result.editor, 'vscode');
      assert.ok(result.electron);
      assert.ok(result.cliScript);
    }
  });
});
