#!/usr/bin/env node

/**
 * 同步远程配置仓库的最新文件到 defaults/ 目录
 *
 * 用途：
 *   1. prepublishOnly 自动调用 — 每次 npm publish 前保证 defaults/ 是最新的
 *   2. 维护者手动调用: npm run sync-defaults
 *
 * 如果远程拉取失败，保留 defaults/ 中的现有文件不做修改
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const { resolveSources } = require('../lib/config');

const DEFAULTS_DIR = path.join(__dirname, '..', 'defaults');

const SOURCES = resolveSources();

const FILES = ['settings.json', 'keybindings.json', 'extensions.list'];

function httpGet(url, timeout = 15000, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('重定向次数过多'));
    const mod = url.startsWith('https:') ? https : http;
    const req = mod.get(url, { timeout }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGet(res.headers.location, timeout, redirects + 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('超时')); });
  });
}

async function fetchFromSources(file) {
  for (const src of SOURCES) {
    try {
      const data = await httpGet(`${src.baseUrl}/${file}`);
      return { data, source: src.name };
    } catch (_) {
      // 继续尝试下一个源
    }
  }
  return null;
}

async function main() {
  console.log('[sync-defaults] 开始同步远程配置到 defaults/ ...\n');

  if (!fs.existsSync(DEFAULTS_DIR)) {
    fs.mkdirSync(DEFAULTS_DIR, { recursive: true });
  }

  let success = 0;
  let failed = 0;

  for (const file of FILES) {
    const result = await fetchFromSources(file);
    if (result) {
      fs.writeFileSync(path.join(DEFAULTS_DIR, file), result.data, 'utf8');
      console.log(`  ✔ ${file} (${result.source})`);
      success++;
    } else {
      const existing = path.join(DEFAULTS_DIR, file);
      if (fs.existsSync(existing)) {
        console.log(`  ⚠ ${file} — 远程不可用，保留现有本地文件`);
      } else {
        console.log(`  ✗ ${file} — 远程不可用，且无本地文件`);
        failed++;
      }
    }
  }

  console.log(`\n[sync-defaults] 完成: ${success} 成功, ${failed} 失败`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('[sync-defaults] 错误:', err.message);
  process.exit(1);
});
