/**
 * 上传本地 VS Code 配置到团队配置仓库
 *
 * 两种模式:
 *   override — 远程完全替换为本地配置
 *   merge    — 保留远程已有内容，只追加本地新增
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const chalk = require('chalk');
const ora = require('ora');
const ui = require('./ui');
const { getVSCodeConfigDir, detectVSCodePaths, getInstalledExtensions } = require('./installer');

// 配置仓库 SSH/HTTPS 地址（对应 CONFIG_SOURCES 的 raw 地址）
const REPO_URLS = {
  github: 'git@github.com:ChenyCHENYU/vscode-config.git',
  gitee: 'git@gitee.com:ycyplus163/vscode-config.git',
};

/**
 * 安全执行 Git 命令
 */
function git(cmd, cwd, timeout = 30000) {
  return execSync(`git ${cmd}`, {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
    timeout,
    windowsHide: true,
  }).trim();
}

/**
 * 执行 Git 命令，允许用户交互（用于 push 等需要凭据的操作）
 */
function gitInteractive(cmd, cwd, timeout = 120000) {
  execSync(`git ${cmd}`, {
    cwd,
    stdio: 'inherit',
    timeout,
    windowsHide: true,
  });
}

/**
 * 深度合并 JSON（local 优先，但远程独有的 key 保留）
 */
function deepMerge(remote, local) {
  const r = { ...remote };
  for (const k of Object.keys(local)) {
    if (
      r[k] && typeof r[k] === 'object' && !Array.isArray(r[k]) &&
      local[k] && typeof local[k] === 'object' && !Array.isArray(local[k])
    ) {
      r[k] = deepMerge(r[k], local[k]);
    } else {
      r[k] = local[k];
    }
  }
  return r;
}

function parseJsonSafe(text) {
  // 去掉 JSONC 注释
  let result = '', i = 0, inStr = false;
  while (i < text.length) {
    if (inStr) {
      if (text[i] === '\\') { result += text[i] + (text[i + 1] || ''); i += 2; continue; }
      if (text[i] === '"') inStr = false;
      result += text[i++];
    } else if (text[i] === '"') { inStr = true; result += text[i++]; }
    else if (text[i] === '/' && text[i + 1] === '/') { while (i < text.length && text[i] !== '\n') i++; }
    else if (text[i] === '/' && text[i + 1] === '*') { i += 2; while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++; i += 2; }
    else { result += text[i++]; }
  }
  return JSON.parse(result.replace(/,\s*([\]}])/g, '$1'));
}

/**
 * 主上传函数
 */
async function uploadConfig(options = {}) {
  const mode = options.mode || 'override';
  const sourceName = (options.source || 'all').toLowerCase();

  // --source all: 依次推送到每个源
  if (sourceName === 'all') {
    // 先读取一次本地配置，避免重复读
    const localData = await _readLocalConfig();

    const sources = Object.keys(REPO_URLS);
    const results = [];
    for (let i = 0; i < sources.length; i++) {
      const src = sources[i];
      ui.section(`📡 [${i + 1}/${sources.length}]`, `推送到 ${src.toUpperCase()}`);
      try {
        await _uploadToSource({ ...options, source: src }, localData);
        results.push({ src, ok: true });
      } catch (e) {
        results.push({ src, ok: false, msg: e.message });
        ui.warnBox(`${src.toUpperCase()} 推送失败`, [chalk.red(e.message), chalk.gray('继续推送其余源...')]);
      }
    }
    console.log('');
    const summaryLines = results.map(r =>
      r.ok ? `${ui.symbols.success} ${r.src.toUpperCase()}` : `${ui.symbols.error} ${r.src.toUpperCase()}  ${chalk.gray(r.msg.split('\n')[0])}`
    );
    summaryLines.push('', chalk.gray('团队成员运行 vscode-config install 即可同步'));
    const allOk = results.every(r => r.ok);
    if (allOk) {
      ui.successBox('全部推送完成', summaryLines);
    } else {
      ui.warnBox('推送完成（部分失败）', summaryLines);
    }
    return;
  }

  // 单源：先读取再上传
  const localData = await _readLocalConfig();
  await _uploadToSource(options, localData);
}

/**
 * 读取本地 VS Code 配置（抽出复用）
 */
async function _readLocalConfig() {
  ui.section('🔍', '读取本地配置');

  const configDir = getVSCodeConfigDir();
  const settingsPath = path.join(configDir, 'settings.json');
  const keybindingsPath = path.join(configDir, 'keybindings.json');

  if (!fs.existsSync(settingsPath)) throw new Error(`本地 settings.json 不存在: ${settingsPath}`);

  const localSettings = fs.readFileSync(settingsPath, 'utf8');
  ui.kv('settings.json', `${(Buffer.byteLength(localSettings) / 1024).toFixed(1)} KB`);

  let localKeybindings = null;
  if (fs.existsSync(keybindingsPath)) {
    localKeybindings = fs.readFileSync(keybindingsPath, 'utf8');
    ui.kv('keybindings.json', `${(Buffer.byteLength(localKeybindings) / 1024).toFixed(1)} KB`);
  } else {
    ui.kv('keybindings.json', chalk.yellow('不存在，跳过'));
  }

  const vsPaths = detectVSCodePaths();
  let extList = [];
  if (vsPaths) {
    const sp = ora({ text: '读取已安装扩展...', indent: 4 }).start();
    extList = getInstalledExtensions(vsPaths);
    sp.succeed(`已安装 ${extList.length} 个扩展`);
  } else {
    console.log(chalk.yellow('    ⚠ VS Code 未检测到，跳过扩展列表'));
  }
  return { localSettings, localKeybindings, extList };
}

/**
 * 上传到单个源（内部实现）
 */
async function _uploadToSource(options = {}, localData) {
  const mode = options.mode || 'override';
  const sourceName = (options.source || 'github').toLowerCase();
  const repoUrl = REPO_URLS[sourceName];
  if (!repoUrl) throw new Error(`不支持的源: ${sourceName}。可用: ${Object.keys(REPO_URLS).join(', ')}, all`);

  const { localSettings, localKeybindings, extList } = localData;

  // Clone 配置仓库
  ui.section('📦', `同步 ${sourceName.toUpperCase()} 仓库`);

  let repoDir = options.repo;
  let isTemp = false;

  if (!repoDir) {
    repoDir = path.join(os.tmpdir(), `vscode-config-upload-${Date.now()}`);
    isTemp = true;
    const cloneSp = ora({ text: `克隆 ${sourceName} 仓库...`, indent: 4 }).start();
    try {
      cloneSp.stop();
      git(`clone --depth 1 ${repoUrl} "${repoDir}"`, undefined, 120000);
      cloneSp.succeed(`仓库克隆完成`);
    } catch (e) {
      cloneSp.fail('克隆失败');
      throw new Error(`克隆配置仓库失败: ${e.message}\n请确认你有仓库写入权限，且 Git 凭据已配置。`);
    }
  } else {
    repoDir = path.resolve(repoDir);
    if (!fs.existsSync(path.join(repoDir, '.git'))) throw new Error(`指定路径不是 Git 仓库: ${repoDir}`);
    const pullSp = ora({ text: '拉取最新...', indent: 4 }).start();
    try { git('pull --rebase', repoDir); pullSp.succeed('已拉取最新'); } catch (_) { pullSp.warn('pull 失败，继续使用当前版本'); }
  }

  // 写入配置
  ui.section('📝', mode === 'override' ? '覆盖远程配置' : '合并远程配置');

  // settings.json
  const remoteSettingsPath = path.join(repoDir, 'settings.json');
  if (mode === 'merge' && fs.existsSync(remoteSettingsPath)) {
    try {
      const remoteObj = parseJsonSafe(fs.readFileSync(remoteSettingsPath, 'utf8'));
      const localObj = parseJsonSafe(localSettings);
      const merged = deepMerge(remoteObj, localObj);
      fs.writeFileSync(remoteSettingsPath, JSON.stringify(merged, null, 2), 'utf8');
      console.log(`    ${ui.symbols.success} ${chalk.green('settings.json 合并完成（远程已有 key 保留，本地新增已追加）')}`);
    } catch (e) {
      // JSON 解析失败时回退到覆盖
      fs.writeFileSync(remoteSettingsPath, localSettings, 'utf8');
      console.log(`    ${ui.symbols.warning} ${chalk.yellow('settings.json 解析失败，已替换为本地版本')}`);
    }
  } else {
    fs.writeFileSync(remoteSettingsPath, localSettings, 'utf8');
    console.log(`    ${ui.symbols.success} ${chalk.green('settings.json 已覆盖')}`);
  }

  // keybindings.json
  if (localKeybindings) {
    fs.writeFileSync(path.join(repoDir, 'keybindings.json'), localKeybindings, 'utf8');
    console.log(`    ${ui.symbols.success} ${chalk.green('keybindings.json 已写入')}`);
  }

  // extensions.list
  if (extList.length > 0) {
    const remoteExtPath = path.join(repoDir, 'extensions.list');
    if (mode === 'merge' && fs.existsSync(remoteExtPath)) {
      const remoteExts = fs.readFileSync(remoteExtPath, 'utf8')
        .split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#') && !l.startsWith('//'));
      const remoteSet = new Set(remoteExts.map(e => e.toLowerCase()));
      // 保留远程已有，追加本地新增
      const newExts = extList.filter(e => !remoteSet.has(e.toLowerCase()));
      let finalContent = fs.readFileSync(remoteExtPath, 'utf8').trimEnd();
      if (newExts.length > 0) {
        finalContent += '\n\n# 新增扩展 (' + new Date().toLocaleDateString('zh-CN') + ')\n';
        finalContent += newExts.join('\n') + '\n';
      }
      fs.writeFileSync(remoteExtPath, finalContent, 'utf8');
      console.log(`    ${ui.symbols.success} ${chalk.green(`extensions.list 合并完成 (远程 ${remoteExts.length} + 新增 ${newExts.length})`)}`);
    } else {
      // 覆盖模式：按类别生成新文件
      const header = `# VS Code Extensions\n# 由 vscode-config upload 生成 (${new Date().toLocaleDateString('zh-CN')})\n# 共 ${extList.length} 个扩展\n\n`;
      const content = header + extList.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())).join('\n') + '\n';
      fs.writeFileSync(path.join(repoDir, 'extensions.list'), content, 'utf8');
      console.log(`    ${ui.symbols.success} ${chalk.green(`extensions.list 已覆盖 (${extList.length} 个扩展)`)}`);
    }
  }

  // Commit & Push
  ui.section('🚀', '提交并推送');

  try {
    git('add -A', repoDir);
    const status = git('status --porcelain', repoDir);
    if (!status) {
      console.log(`    ${ui.symbols.info} ${chalk.blue('无变更，远程已是最新')}`);
    } else {
      const msg = mode === 'override'
        ? `chore: 覆盖更新配置 (${new Date().toLocaleDateString('zh-CN')})`
        : `chore: 合并更新配置 (${new Date().toLocaleDateString('zh-CN')})`;
      git(`commit -m "${msg}"`, repoDir);
      const pushSp = ora({ text: '推送到远程...', indent: 4 }).start();
      pushSp.stop(); // 停止 spinner 以便 git 可以交互
      console.log(chalk.gray('    推送中（如弹出凭据窗口请完成认证）...'));
      gitInteractive('push', repoDir, 120000);
      console.log(`    ${ui.symbols.success} ${chalk.green('推送成功')}`);
    }
  } catch (e) {
    const msg = e.message || '';
    if (msg.includes('cancelled') || msg.includes('denied') || msg.includes('Authentication')) {
      throw new Error('Git 认证失败。请确认:\n  1. 你有仓库写入权限\n  2. Git 凭据已配置 (git credential-manager)\n  3. 如用 SSH，确认 SSH key 已添加');
    }
    throw new Error(`Git 操作失败: ${msg}\n请确认你有仓库写入权限。`);
  }

  // 清理临时目录
  if (isTemp) {
    try { fs.rmSync(repoDir, { recursive: true, force: true }); } catch (_) {}
  }

  // 完成
  console.log('');
  ui.successBox(`${sourceName.toUpperCase()} 上传完成`, [
    `${chalk.white('模式')}    ${mode === 'override' ? chalk.cyan('覆盖 — 远程已完全替换') : chalk.yellow('合并 — 远程已有内容保留')}`,
    `${chalk.white('目标')}    ${sourceName} 配置仓库`,
    '',
    chalk.gray('团队成员运行 vscode-config install 即可同步'),
  ]);
}

module.exports = { uploadConfig };
