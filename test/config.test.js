const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  CONFIG_FILENAME,
  DEFAULT_SOURCES,
  DEFAULT_REPOS,
  EDITOR_REQUIRED_FIELDS,
  mergeConfigs,
  readConfigFile,
  resolveSources,
  resolveRepos,
  resolveCustomEditors,
} = require('../lib/config');

// ─── 常量测试 ────────────────────────────────────────────────

describe('常量', () => {
  it('CONFIG_FILENAME 为 .vscode-configrc.json', () => {
    assert.equal(CONFIG_FILENAME, '.vscode-configrc.json');
  });

  it('DEFAULT_SOURCES 包含 GitHub 和 Gitee', () => {
    assert.equal(DEFAULT_SOURCES.length, 2);
    assert.equal(DEFAULT_SOURCES[0].name, 'GitHub');
    assert.equal(DEFAULT_SOURCES[1].name, 'Gitee');
  });

  it('DEFAULT_REPOS 包含 github 和 gitee', () => {
    assert.ok(DEFAULT_REPOS.github);
    assert.ok(DEFAULT_REPOS.gitee);
  });

  it('EDITOR_REQUIRED_FIELDS 包含必填字段', () => {
    assert.ok(EDITOR_REQUIRED_FIELDS.includes('label'));
    assert.ok(EDITOR_REQUIRED_FIELDS.includes('configDirName'));
    assert.ok(EDITOR_REQUIRED_FIELDS.includes('cliName'));
  });
});

// ─── mergeConfigs 测试 ────────────────────────────────────────

describe('mergeConfigs', () => {
  it('空对象合并', () => {
    const result = mergeConfigs({}, {});
    assert.deepEqual(result, {});
  });

  it('基础合并', () => {
    const base = { sources: [{ name: 'GitHub' }] };
    const override = { repos: { github: 'git@x.com' } };
    const result = mergeConfigs(base, override);
    assert.ok(result.sources);
    assert.ok(result.repos);
  });

  it('override 覆盖同名 key', () => {
    const base = { sources: [{ name: 'GitHub' }] };
    const override = { sources: [{ name: 'Internal' }] };
    const result = mergeConfigs(base, override);
    assert.equal(result.sources[0].name, 'Internal');
  });

  it('深层对象合并', () => {
    const base = { repos: { github: 'a', gitee: 'b' } };
    const override = { repos: { github: 'c' } };
    const result = mergeConfigs(base, override);
    assert.equal(result.repos.github, 'c');
    assert.equal(result.repos.gitee, 'b');
  });
});

// ─── readConfigFile 测试 ──────────────────────────────────────

describe('readConfigFile', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-config-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('读取有效 JSON 文件', () => {
    const filePath = path.join(tmpDir, CONFIG_FILENAME);
    fs.writeFileSync(filePath, '{"sources":[{"name":"Test"}]}', 'utf8');
    const config = readConfigFile(filePath);
    assert.equal(config.sources[0].name, 'Test');
  });

  it('无效 JSON 返回 null', () => {
    const filePath = path.join(tmpDir, CONFIG_FILENAME);
    fs.writeFileSync(filePath, '{invalid json}', 'utf8');
    const config = readConfigFile(filePath);
    assert.equal(config, null);
  });

  it('不存在的文件返回 null', () => {
    const config = readConfigFile(path.join(tmpDir, 'nonexistent.json'));
    assert.equal(config, null);
  });
});

// ─── resolveSources 测试 ──────────────────────────────────────

describe('resolveSources', () => {
  it('无配置文件时返回默认源', () => {
    // 清除缓存，确保在无配置文件环境下测试
    const sources = resolveSources();
    assert.ok(sources.length >= 2);
    assert.ok(sources.some(s => s.name === 'GitHub'));
    assert.ok(sources.some(s => s.name === 'Gitee'));
  });

  it('每个源都有 name 和 baseUrl', () => {
    const sources = resolveSources();
    for (const src of sources) {
      assert.ok(src.name, '源缺少 name');
      assert.ok(src.baseUrl, '源缺少 baseUrl');
    }
  });
});

// ─── resolveRepos 测试 ────────────────────────────────────────

describe('resolveRepos', () => {
  it('无配置文件时返回默认仓库', () => {
    const repos = resolveRepos();
    assert.ok(repos.github);
    assert.ok(repos.gitee);
  });
});

// ─── resolveCustomEditors 测试 ────────────────────────────────

describe('resolveCustomEditors', () => {
  it('无配置文件时返回 null', () => {
    const editors = resolveCustomEditors();
    assert.equal(editors, null);
  });
});
