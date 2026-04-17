#!/usr/bin/env node

/**
 * 伴侣包自动构建脚本
 *
 * 从远程配置仓库拉取最新 extensions.list → 下载 .vsix → 清理废弃文件
 * 单一数据源: 远程 extensions.list 为准，零手动维护
 *
 * 用法: node build.js [--force]
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const EXTENSIONS_DIR = path.join(__dirname, 'extensions');
const FORCE = process.argv.includes('--force');

// 远程配置源（与主工具一致）
const SOURCES = [
  {
    name: 'GitHub',
    url: 'https://raw.githubusercontent.com/ChenyCHENYU/vscode-config/main/extensions.list',
    timeout: 15000,
  },
  {
    name: 'Gitee',
    url: 'https://gitee.com/ycyplus163/vscode-config/raw/main/extensions.list',
    timeout: 10000,
  },
];

// 内网无法使用的 AI 扩展（需要外网 AI 服务）
const AI_EXCLUDES = [
  'alibaba-cloud.tongyi-lingma',
  'github.copilot-chat',
  'rooveterinaryinc.roo-cline',
  'hybridtalentcomputing.cline-chinese',
  'shengsuan-cloud.cline-shengsuan',
];

// ─── HTTP 工具 ──────────────────────────────────────────────

function httpGet(url, timeout = 15000, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('重定向次数过多'));
    const mod = url.startsWith('https:') ? https : http;
    const req = mod.get(url, { timeout }, res => {
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        return httpGet(res.headers.location, timeout, redirects + 1).then(
          resolve,
          reject
        );
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('超时'));
    });
  });
}

function downloadFile(url, destPath, timeout = 120000, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('重定向次数过多'));
    const mod = url.startsWith('https:') ? https : http;
    const req = mod.get(url, { timeout }, res => {
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        return downloadFile(
          res.headers.location,
          destPath,
          timeout,
          redirects + 1
        ).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
      file.on('error', err => {
        try {
          fs.unlinkSync(destPath);
        } catch (_) {}
        reject(err);
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('超时'));
    });
  });
}

// ─── 主逻辑 ─────────────────────────────────────────────────

async function main() {
  console.log('[build] 伴侣包自动构建 — 从远程配置同步\n');

  // 1. 拉取远程 extensions.list
  let content = null;
  for (const src of SOURCES) {
    try {
      process.stdout.write(`  拉取 extensions.list (${src.name})...`);
      content = await httpGet(src.url, src.timeout);
      console.log(' ✔');
      break;
    } catch (err) {
      console.log(` ✗ ${err.message}`);
    }
  }
  if (!content) {
    console.error('\n[error] 无法获取远程 extensions.list，请检查网络');
    process.exit(1);
  }

  // 2. 解析列表 + 排除 AI 扩展
  const excludeSet = new Set(AI_EXCLUDES.map(e => e.toLowerCase()));
  const allExtensions = content
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#') && !l.startsWith('//'));
  const extensions = allExtensions.filter(
    e => !excludeSet.has(e.toLowerCase())
  );
  const excluded = allExtensions.filter(e => excludeSet.has(e.toLowerCase()));

  console.log(`\n  远程总数: ${allExtensions.length} 个`);
  console.log(`  排除 AI: ${excluded.length} 个 (${excluded.join(', ')})`);
  console.log(`  待下载:  ${extensions.length} 个\n`);

  // 3. 确保目录存在
  if (!fs.existsSync(EXTENSIONS_DIR))
    fs.mkdirSync(EXTENSIONS_DIR, { recursive: true });

  // 4. 下载 .vsix
  let success = 0,
    failed = 0;
  const errors = [];

  for (let i = 0; i < extensions.length; i++) {
    const ext = extensions[i];
    const fileName = `${ext}.vsix`;
    const destPath = path.join(EXTENSIONS_DIR, fileName);
    const tag = `[${i + 1}/${extensions.length}]`;

    // 已存在则跳过（--force 时强制重下）
    if (
      !FORCE &&
      fs.existsSync(destPath) &&
      fs.statSync(destPath).size > 1000
    ) {
      const sizeKB = (fs.statSync(destPath).size / 1024).toFixed(0);
      console.log(`  ${tag} ${ext} — 已存在 (${sizeKB} KB), 跳过`);
      success++;
      continue;
    }

    const dotIdx = ext.indexOf('.');
    if (dotIdx <= 0) {
      errors.push({ ext, error: '无效 ID' });
      failed++;
      continue;
    }
    const publisher = ext.substring(0, dotIdx);
    const name = ext.substring(dotIdx + 1);
    const url = `https://${publisher}.gallery.vsassets.io/_apis/public/gallery/publisher/${publisher}/extension/${name}/latest/assetbyname/Microsoft.VisualStudio.Services.VSIXPackage`;

    process.stdout.write(`  ${tag} ${ext} — 下载中...`);
    try {
      await downloadFile(url, destPath);
      const sizeKB = (fs.statSync(destPath).size / 1024).toFixed(0);
      console.log(` ✔ (${sizeKB} KB)`);
      success++;
    } catch (err) {
      console.log(` ✗ ${err.message}`);
      errors.push({ ext, error: err.message });
      failed++;
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
    }
  }

  // 5. 覆盖模式: 清理不在列表中的 .vsix（包括被排除的 AI 扩展）
  const expectedFiles = new Set(extensions.map(e => `${e}.vsix`.toLowerCase()));
  const existing = fs
    .readdirSync(EXTENSIONS_DIR)
    .filter(f => f.endsWith('.vsix'));
  let cleaned = 0;
  for (const file of existing) {
    if (!expectedFiles.has(file.toLowerCase())) {
      fs.unlinkSync(path.join(EXTENSIONS_DIR, file));
      console.log(`  🗑️  ${file} — 不在列表中，已删除`);
      cleaned++;
    }
  }

  // 6. 摘要
  console.log(
    `\n[build] 完成: ${success} 成功, ${failed} 失败${cleaned > 0 ? `, ${cleaned} 清理` : ''}`
  );
  if (errors.length > 0) {
    console.log('\n失败列表:');
    for (const e of errors) console.log(`  - ${e.ext}: ${e.error}`);
  }

  const totalSize = fs
    .readdirSync(EXTENSIONS_DIR)
    .filter(f => f.endsWith('.vsix'))
    .reduce(
      (sum, f) => sum + fs.statSync(path.join(EXTENSIONS_DIR, f)).size,
      0
    );
  const fileCount = fs
    .readdirSync(EXTENSIONS_DIR)
    .filter(f => f.endsWith('.vsix')).length;
  console.log(
    `\n  📦 ${fileCount} 个 .vsix, 共 ${(totalSize / 1024 / 1024).toFixed(1)} MB`
  );
}

main().catch(err => {
  console.error('[build] 错误:', err.message);
  process.exit(1);
});
