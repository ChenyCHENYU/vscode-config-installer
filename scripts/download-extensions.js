#!/usr/bin/env node

/**
 * 批量下载 extensions.list 中所有扩展的 .vsix 文件
 *
 * 用法:
 *   node scripts/download-extensions.js [--output <dir>]
 *
 * 默认输出到项目根目录的 vsix-cache/
 * .vsix 文件命名: publisher.name-latest.vsix
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const DEFAULT_OUTPUT = path.join(__dirname, '..', 'vsix-cache');
const EXT_LIST = path.join(__dirname, '..', 'defaults', 'extensions.list');

// 解析命令行 --output
const args = process.argv.slice(2);
const outIdx = args.indexOf('--output');
const OUTPUT_DIR = outIdx >= 0 && args[outIdx + 1] ? path.resolve(args[outIdx + 1]) : DEFAULT_OUTPUT;

/**
 * 从 VS Code Marketplace 下载 .vsix
 * URL: https://{publisher}.gallery.vsassets.io/_apis/public/gallery/publisher/{publisher}/extension/{name}/latest/assetbyname/Microsoft.VisualStudio.Services.VSIXPackage
 */
function downloadVsix(extId, destPath, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const dotIdx = extId.indexOf('.');
    if (dotIdx <= 0) return reject(new Error(`无效扩展 ID: ${extId}`));
    const publisher = extId.substring(0, dotIdx);
    const name = extId.substring(dotIdx + 1);

    const url = `https://${publisher}.gallery.vsassets.io/_apis/public/gallery/publisher/${publisher}/extension/${name}/latest/assetbyname/Microsoft.VisualStudio.Services.VSIXPackage`;

    _download(url, destPath, timeout, 0).then(resolve, reject);
  });
}

function _download(url, destPath, timeout, redirects) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('重定向次数过多'));
    const mod = url.startsWith('https:') ? https : require('http');
    const req = mod.get(url, { timeout }, (res) => {
      // 跟随重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return _download(res.headers.location, destPath, timeout, redirects + 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', (err) => { fs.unlinkSync(destPath); reject(err); });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('超时')); });
  });
}

async function main() {
  console.log(`[download-extensions] 输出目录: ${OUTPUT_DIR}\n`);

  if (!fs.existsSync(EXT_LIST)) {
    console.error(`[error] 找不到 ${EXT_LIST}，请先运行 npm run sync-defaults`);
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const content = fs.readFileSync(EXT_LIST, 'utf8');
  const extensions = content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('//'));

  console.log(`共 ${extensions.length} 个扩展\n`);

  let success = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < extensions.length; i++) {
    const ext = extensions[i];
    const fileName = `${ext}.vsix`;
    const destPath = path.join(OUTPUT_DIR, fileName);
    const tag = `[${i + 1}/${extensions.length}]`;

    // 已存在则跳过
    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 1000) {
      const sizeKB = (fs.statSync(destPath).size / 1024).toFixed(0);
      console.log(`  ${tag} ${ext} — 已存在 (${sizeKB} KB), 跳过`);
      success++;
      continue;
    }

    process.stdout.write(`  ${tag} ${ext} — 下载中...`);
    try {
      await downloadVsix(ext, destPath);
      const sizeKB = (fs.statSync(destPath).size / 1024).toFixed(0);
      console.log(` ✔ (${sizeKB} KB)`);
      success++;
    } catch (err) {
      console.log(` ✗ ${err.message}`);
      errors.push({ ext, error: err.message });
      failed++;
      // 清理不完整的文件
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
    }
  }

  console.log(`\n[download-extensions] 完成: ${success} 成功, ${failed} 失败`);
  if (errors.length > 0) {
    console.log('\n失败列表:');
    for (const e of errors) {
      console.log(`  - ${e.ext}: ${e.error}`);
    }
  }
  console.log(`\n.vsix 文件位于: ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error('[download-extensions] 错误:', err.message);
  process.exit(1);
});
