/**
 * @agile-team/vscode-config - installer v3.0
 *
 * 核心改动: 绕过 code/code.cmd 脚本，直接调用 Code.exe + cli.js
 * 设置 ELECTRON_RUN_AS_NODE=1，让 VS Code 以 Node 方式运行 CLI
 * → 不弹窗、stdout 可靠、跨平台
 *
 * v3.5: 支持 VS Code / Cursor / Windsurf / Kiro 多编辑器
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const chalk = require('chalk');
const ora = require('ora');
const https = require('https');
const http = require('http');
const ui = require('./ui');
const { EDITOR_REGISTRY, resolveEditorKeys } = require("./editors");
const { version: PKG_VERSION } = require('../package.json')

// ─── 配置源 ────────────────────────────────────────────────────

const CONFIG_SOURCES = [
  {
    name: 'GitHub',
    baseUrl: 'https://raw.githubusercontent.com/ChenyCHENYU/vscode-config/main',
    timeout: 15000
  },
  {
    name: 'Gitee',
    baseUrl: 'https://gitee.com/ycyplus163/vscode-config/raw/main',
    timeout: 10000
  }
];

let _activeSources = CONFIG_SOURCES;

// ─── HTTP ──────────────────────────────────────────────────────

function httpGet(url, timeout = 15000, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('重定向次数过多'));
    const mod = url.startsWith('https:') ? https : http;
    const req = mod.get(
      url,
      {
        timeout,
        headers: { 'User-Agent': `vscode-config/${PKG_VERSION}` },
      },
      res => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          return httpGet(res.headers.location, timeout, redirects + 1).then(
            resolve,
            reject
          )
        }
        if (res.statusCode !== 200)
          return reject(new Error(`HTTP ${res.statusCode}`))
        let data = ''
        res.on('data', c => (data += c))
        res.on('end', () => resolve(data))
      }
    )
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
  });
}

async function fetchFile(filePath) {
  let lastErr;
  let spinner;
  for (let i = 0; i < _activeSources.length; i++) {
    const src = _activeSources[i];
    try {
      if (i === 0) {
        spinner = ora(`获取 ${filePath}...`).start();
      } else {
        spinner.text = `${_activeSources[i - 1].name} 不可用，切换到 ${src.name}...`;
      }
      const data = await httpGet(`${src.baseUrl}/${filePath}`, src.timeout);
      spinner.succeed(`${filePath} 获取成功`)
      return data;
    } catch (e) {
      lastErr = e;
    }
  }
  if (spinner) spinner.fail(`${filePath} 获取失败`);
  throw new Error(`所有配置源都不可用: ${lastErr.message}`);
}

// ─── 编辑器注册表 (从 editors.js 导入) ──────────────────────────

/**
 * 检测指定编辑器的可执行文件和 cli.js 路径
 * 返回 { electron, cliScript, editor } 或 null
 */
function detectEditorPaths(editorKey) {
  const reg = EDITOR_REGISTRY[editorKey];
  if (!reg) return null;
  const platform = process.platform;
  let result = null;
  if (platform === "win32") result = detectEditorWindows(reg);
  else if (platform === "darwin") result = detectEditorMacOS(reg);
  else result = detectEditorLinux(reg);
  if (result) result.editor = editorKey;
  return result;
}

function detectEditorWindows(reg) {
  // 方法1: where <cmd>.cmd
  try {
    const lines = execSync(`where ${reg.winCmdScript}`, {
      encoding: "utf8",
      stdio: "pipe",
      timeout: 5000,
      windowsHide: true,
    })
      .trim()
      .split(/\r?\n/);
    for (const line of lines) {
      const binDir = path.dirname(line.trim());
      const result = resolveFromEditorDir(path.dirname(binDir), reg.winExeName);
      if (result) return result;
    }
  } catch (_) {}

  // 方法2: 常见安装路径
  const candidates = reg.winDirs.map((fn) => fn());
  const pathDirs = (process.env.PATH || "").split(";");
  for (const dir of pathDirs) {
    if (reg.winPathPattern.test(dir)) {
      const parent = path.dirname(dir);
      if (!candidates.includes(parent)) candidates.push(parent);
    }
  }
  for (const dir of candidates) {
    const result = resolveFromEditorDir(dir, reg.winExeName);
    if (result) return result;
  }
  return null;
}

function detectEditorMacOS(reg) {
  const appPaths = reg.macAppNames.map((name) =>
    path.join("/Applications", name),
  );
  // 也检查用户 Applications 目录
  reg.macAppNames.forEach((name) =>
    appPaths.push(path.join(os.homedir(), "Applications", name)),
  );
  for (const appPath of appPaths) {
    const electron = path.join(appPath, "Contents", "MacOS", reg.macExeName);
    const cliScript = path.join(
      appPath,
      "Contents",
      "Resources",
      "app",
      "out",
      "cli.js",
    );
    if (fs.existsSync(electron) && fs.existsSync(cliScript)) {
      return { electron, cliScript };
    }
  }
  // 方法2: which 命令
  try {
    let editorPath = execSync(reg.linuxWhichCmd, {
      encoding: "utf8",
      stdio: "pipe",
      timeout: 5000,
    }).trim();
    editorPath = fs.realpathSync(editorPath);
    const parts = editorPath.split(path.sep);
    const appIdx = parts.findIndex((p) => p.endsWith(".app"));
    if (appIdx >= 0) {
      const appDir = parts.slice(0, appIdx + 1).join(path.sep);
      const electron = path.join(appDir, "Contents", "MacOS", reg.macExeName);
      const cliScript = path.join(
        appDir,
        "Contents",
        "Resources",
        "app",
        "out",
        "cli.js",
      );
      if (fs.existsSync(electron) && fs.existsSync(cliScript))
        return { electron, cliScript };
    }
  } catch (_) {}
  return null;
}

function detectEditorLinux(reg) {
  for (const dir of reg.linuxDirs) {
    const electron = path.join(dir, reg.linuxExeName);
    const cliScript = path.join(dir, "resources", "app", "out", "cli.js");
    if (fs.existsSync(electron) && fs.existsSync(cliScript))
      return { electron, cliScript };
  }
  try {
    let editorPath = execSync(reg.linuxWhichCmd, {
      encoding: "utf8",
      stdio: "pipe",
      timeout: 5000,
    }).trim();
    editorPath = fs.realpathSync(editorPath);
    const dir = path.dirname(editorPath);
    const cliScript = path.join(dir, "resources", "app", "out", "cli.js");
    if (fs.existsSync(cliScript)) return { electron: editorPath, cliScript };
  } catch (_) {}
  return null;
}

function resolveFromEditorDir(editorDir, exeName) {
  const electron = path.join(editorDir, exeName);
  if (!fs.existsSync(electron)) return null;
  try {
    const items = fs.readdirSync(editorDir);
    for (const item of items) {
      if (/^[0-9a-f]{10,}$/i.test(item)) {
        const cliScript = path.join(
          editorDir,
          item,
          "resources",
          "app",
          "out",
          "cli.js",
        );
        if (fs.existsSync(cliScript)) return { electron, cliScript };
      }
    }
  } catch (_) {}
  const altCli = path.join(editorDir, "resources", "app", "out", "cli.js");
  if (fs.existsSync(altCli)) return { electron, cliScript: altCli };
  return null;
}

// ─── 向后兼容的旧 API ──────────────────────────────────────────

function detectVSCodePaths() {
  return detectEditorPaths('vscode');
}

function detectCursorPaths() {
  return detectEditorPaths('cursor');
}

// ─── CLI 执行 ──────────────────────────────────────────────────

function runCli(vscodePaths, args, timeout = 30000) {
  const cmd = `"${vscodePaths.electron}" "${vscodePaths.cliScript}" ${args}`;
  const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1', VSCODE_DEV: '' };
  try {
    const stdout = execSync(cmd, {
      encoding: 'utf8', stdio: 'pipe', timeout,
      windowsHide: true, env, maxBuffer: 10 * 1024 * 1024
    });
    return { ok: true, stdout, stderr: '' };
  } catch (err) {
    return { ok: false, stdout: err.stdout || '', stderr: err.stderr || '', error: err.message };
  }
}

// ─── 配置目录 / JSON 工具 ─────────────────────────────────────

function getEditorConfigDir(editorKey) {
  const reg = EDITOR_REGISTRY[editorKey];
  if (!reg) throw new Error(`未知编辑器: ${editorKey}`);
  const dirName = reg.configDirName;
  switch (process.platform) {
    case "win32":
      return path.join(os.homedir(), "AppData", "Roaming", dirName, "User");
    case "darwin":
      return path.join(
        os.homedir(),
        "Library",
        "Application Support",
        dirName,
        "User",
      );
    default:
      return path.join(os.homedir(), ".config", dirName, "User");
  }
}

function getVSCodeConfigDir() {
  return getEditorConfigDir("vscode");
}

function getCursorConfigDir() {
  return getEditorConfigDir("cursor");
}

function parseJsonc(text) {
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

function deepMerge(local, remote) {
  const r = { ...local };
  for (const k of Object.keys(remote)) {
    if (r[k] && typeof r[k] === 'object' && !Array.isArray(r[k]) && remote[k] && typeof remote[k] === 'object' && !Array.isArray(remote[k])) {
      r[k] = deepMerge(r[k], remote[k]);
    } else { r[k] = remote[k]; }
  }
  return r;
}

// ─── 备份 ──────────────────────────────────────────────────────

function backupConfig(configDir) {
  const backupDir = path.join(configDir, `backup-${Date.now()}`);
  const targets = ['settings.json', 'keybindings.json', 'snippets'];
  const backed = [];
  for (const file of targets) {
    const src = path.join(configDir, file);
    if (!fs.existsSync(src)) continue;
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const dest = path.join(backupDir, file);
    if (fs.statSync(src).isDirectory()) { fs.cpSync(src, dest, { recursive: true }); }
    else { fs.copyFileSync(src, dest); }
    backed.push(file);
  }
  if (backed.length > 0) {
    ui.infoBox('备份完成', [
      chalk.white(backed.join(', ')),
      chalk.gray(backupDir),
    ], 'blue');
  }
  return backupDir;
}

// ─── 配置文件安装 ──────────────────────────────────────────────

async function installSettings(configDir, mode, editorLabel = "VS Code") {
  const content = await fetchFile("settings.json");
  const fp = path.join(configDir, "settings.json");
  if (mode === "merge" && fs.existsSync(fp)) {
    const local = parseJsonc(fs.readFileSync(fp, "utf8"));
    const remote = parseJsonc(content);
    fs.writeFileSync(
      fp,
      JSON.stringify(deepMerge(local, remote), null, 2),
      "utf8",
    );
    console.log(
      chalk.green(
        `${ui.icons.success} ${editorLabel} 设置合并完成（保留个人配置）`
      )
    )
  } else {
    fs.writeFileSync(fp, content, "utf8");
    console.log(chalk.green(`${ui.icons.success} ${editorLabel} 设置安装完成`))
  }
}

async function installKeybindings(configDir) {
  try {
    const content = await fetchFile('keybindings.json');
    fs.writeFileSync(path.join(configDir, 'keybindings.json'), content, 'utf8');
    console.log(chalk.green(`${ui.icons.success} 键盘快捷键安装完成`))
  } catch (e) {
    console.log(
      chalk.yellow(
        `${ui.icons.warning} 键盘快捷键安装失败（可选项）: ${e.message}`,
      ),
    );
  }
}

async function getExtensionList() {
  const content = await fetchFile('extensions.list');
  const list = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#') && !l.startsWith('//'));
  if (list.length === 0) throw new Error('extensions.list 为空');
  return list;
}

// ─── 扩展安装（核心） ──────────────────────────────────────────

function isValidExtId(id) { return /^[\w][\w.-]*$/.test(id); }

function getInstalledExtensions(vscodePaths) {
  const r = runCli(vscodePaths, '--list-extensions', 15000);
  if (!r.ok && !r.stdout) return [];
  return (r.stdout || '').trim().split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

async function installExtensions(vscodePaths, extensions, options = {}) {
  const verbose = process.env.LOG_LEVEL === 'verbose';
  const timeoutSec = options.timeout || 30;

  const beforeList = getInstalledExtensions(vscodePaths);
  const beforeSet = new Set(beforeList.map(e => e.toLowerCase()));
  const toInstall = extensions.filter(ext => !beforeSet.has(ext.toLowerCase()));
  const alreadyCount = extensions.length - toInstall.length;

  console.log('');
  console.log(chalk.blue(`${ui.icons.search} 扩展安装分析:`))
  console.log(chalk.gray(`   配置包含: ${extensions.length} 个扩展`));
  console.log(chalk.gray(`   本地已有: ${alreadyCount} 个`));
  console.log(chalk.gray(`   需要安装: ${toInstall.length} 个`));

  if (toInstall.length === 0) {
    console.log('');
    console.log(
      chalk.green.bold(`${ui.icons.success} 所有配置扩展都已存在，跳过安装！`)
    )
    return { installed: 0, failed: 0, skipped: alreadyCount, total: extensions.length, failedList: [] };
  }

  const valid = toInstall.filter(ext => {
    if (!isValidExtId(ext)) {
      console.log(
        chalk.yellow(`   ${ui.icons.warning} 跳过无效扩展 ID: ${ext}`),
      );
      return false;
    }
    return true;
  });
  if (valid.length === 0) {
    return { installed: 0, failed: 0, skipped: alreadyCount, total: extensions.length, failedList: [] };
  }

  console.log('');
  const perExtTimeout = Math.max(timeoutSec * 1000, 120000);
  const failedList = [];

  for (let i = 0; i < valid.length; i++) {
    const ext = valid[i];
    const tag = `[${i + 1}/${valid.length}]`;
    const sp = ora(`${tag} 安装 ${ext}...`).start();
    const result = runCli(vscodePaths, `--install-extension ${ext} --force`, perExtTimeout);
    const output = result.stdout + result.stderr;

    if (verbose) {
      sp.stop();
      console.log(chalk.gray(`   [verbose] ${ext}: ok=${result.ok}, output=${output.substring(0, 200)}`));
      sp.start();
    }

    if (output.includes('successfully installed') || output.includes('already installed')) {
      sp.succeed(`${tag} ${ext}`)
    } else if (result.ok && output.trim()) {
      sp.succeed(`${tag} ${ext} (待验证)`);
    } else {
      sp.fail(`${tag} ${ext}`)
      const errMsg = output.trim().substring(0, 150) || result.error || '未知错误';
      console.log(chalk.gray(`      原因: ${errMsg}`));
      failedList.push({ id: ext, error: errMsg });
    }
  }

  // 安装后验证
  console.log('');
  const vSp = ora('验证安装结果...').start();
  const afterList = getInstalledExtensions(vscodePaths);
  const afterSet = new Set(afterList.map(e => e.toLowerCase()));
  vSp.stop();

  let verified = 0, verifyFailed = 0;
  const verifyFailedList = [];
  for (const ext of valid) {
    if (afterSet.has(ext.toLowerCase())) { verified++; }
    else {
      verifyFailed++;
      const prev = failedList.find(f => f.id === ext);
      verifyFailedList.push({ id: ext, error: prev ? prev.error : '验证未通过' });
    }
  }

  if (verified > 0)
    console.log(
      chalk.green(`${ui.icons.success} 验证通过: ${verified} 个扩展已安装`),
    );
  if (verifyFailed > 0) {
    console.log(
      chalk.red(`${ui.icons.error} 安装失败: ${verifyFailed} 个扩展`),
    );
    if (verifyFailed === valid.length) {
      console.log('');
      console.log(
        chalk.yellow.bold(`${ui.icons.warning} 所有扩展均失败，诊断信息:`),
      );
      const editorLabel = vscodePaths.editor
        ? EDITOR_REGISTRY[vscodePaths.editor].label
        : "VS Code";
      const ver = runCli(vscodePaths, '--version', 10000);
      console.log(
        chalk.gray(
          `   ${editorLabel}: ${(ver.stdout || "").trim().split("\n")[0]}`,
        ),
      );
      console.log(chalk.gray(`   Node.js: ${process.version}`));
      console.log(chalk.gray(`   系统: ${process.platform} ${os.release()}`));
      console.log(chalk.gray(`   Electron: ${vscodePaths.electron}`));
      console.log(chalk.gray(`   CLI: ${vscodePaths.cliScript}`));
    }
    console.log('');
    console.log(chalk.yellow(`${ui.icons.memo} 手动安装:`));
    const cmdName = EDITOR_REGISTRY[vscodePaths.editor]?.cliName || "code";
    for (const f of verifyFailedList)
      console.log(chalk.cyan(`   ${cmdName} --install-extension ${f.id}`));
  }

  return { installed: verified, failed: verifyFailed, skipped: alreadyCount, total: extensions.length, failedList: verifyFailedList };
}

// ─── 主函数 ────────────────────────────────────────────────────

async function installConfig(options = {}) {
  // 重置配置源（防止多次调用时污染）
  _activeSources = CONFIG_SOURCES

  // 配置源
  if (options.source) {
    const lower = options.source.toLowerCase()
    const matched = CONFIG_SOURCES.filter(s => s.name.toLowerCase() === lower)
    if (matched.length > 0) {
      _activeSources = [
        ...matched,
        ...CONFIG_SOURCES.filter(s => !matched.includes(s)),
      ]
    } else {
      console.log(
        chalk.yellow(
          `${ui.icons.warning} 未知配置源 "${options.source}"，使用默认顺序`
        )
      )
    }
  }

  // 解析目标编辑器
  const editorKeys = resolveEditorKeys(options.editor)

  // Git（只需检测一次）
  try {
    const gitVer = execSync('git --version', {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 5000,
    }).trim()
    ui.section(ui.icons.search, '环境检测')
    console.log(`    ${ui.symbols.success} ${gitVer}`)
  } catch (_) {
    throw new Error('Git 未安装。下载: https://git-scm.com/')
  }

  for (const editorKey of editorKeys) {
    const reg = EDITOR_REGISTRY[editorKey]
    const editorLabel = reg.label

    if (editorKeys.length > 1) {
      console.log('')
      ui.section(ui.icons.desktop, `正在为 ${editorLabel} 安装配置`)
    }

    // 检测编辑器
    const detectSp = ora({
      text: `检测 ${editorLabel} 安装...`,
      indent: 4,
    }).start()
    const editorPaths = detectEditorPaths(editorKey)
    if (!editorPaths) {
      detectSp.fail(`${editorLabel} 未找到`)
      if (editorKeys.length > 1) {
        console.log(
          chalk.yellow(`    ${ui.icons.warning} ${editorLabel} 未检测到，跳过`)
        )
        continue
      }
      const editorHints = Object.entries(EDITOR_REGISTRY)
        .map(([, v]) => `${v.label}: ${v.website}`)
        .join('\n')
      throw new Error(
        `${editorLabel} 未检测到。请确认已安装且命令在 PATH 中。\n${editorHints}`
      )
    }
    const verResult = runCli(editorPaths, '--version', 10000)
    if (!verResult.ok && !verResult.stdout) {
      detectSp.fail(`${editorLabel} CLI 验证失败`)
      if (editorKeys.length > 1) {
        console.log(
          chalk.yellow(
            `    ${ui.icons.warning} ${editorLabel} CLI 无法执行，跳过`
          )
        )
        continue
      }
      throw new Error(`${editorLabel} CLI 无法执行: ${verResult.error}`)
    }
    const editorVer = (verResult.stdout || '').trim().split('\n')[0]
    detectSp.succeed(`${editorLabel} ${editorVer}`)
    if (process.env.LOG_LEVEL === 'verbose') {
      ui.kv('Electron:', editorPaths.electron)
      ui.kv('CLI:', editorPaths.cliScript)
    }

    const configDir = getEditorConfigDir(editorKey)
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true })

    // 预览
    if (options.dryRun) {
      ui.section(ui.icons.memo, '预览模式（不会做任何更改）')
      ui.kv('目标编辑器:', editorLabel)
      ui.kv(
        'settings.json:',
        options.mode === 'merge' ? '合并模式' : '覆盖模式'
      )
      ui.kv('keybindings.json:', '覆盖')
      try {
        const exts = await getExtensionList()
        const installed = getInstalledExtensions(editorPaths)
        const set = new Set(installed.map(e => e.toLowerCase()))
        const newE = exts.filter(e => !set.has(e.toLowerCase()))
        console.log('')
        ui.kv('扩展总数:', `${exts.length} 个`)
        ui.kv('已安装:', `${exts.length - newE.length} 个`)
        ui.kv(
          '待安装:',
          newE.length > 0
            ? chalk.yellow(`${newE.length} 个`)
            : chalk.green('0 个')
        )
        if (newE.length > 0) {
          console.log('')
          newE.forEach(e => console.log(chalk.gray(`      • ${e}`)))
        }
      } catch (e) {
        console.log(
          chalk.yellow(`    ${ui.icons.warning} 获取失败: ${e.message}`)
        )
      }
      console.log('')
      ui.warnBox('预览完成', [chalk.white('未做任何更改，加 --force 执行安装')])
      continue
    }

    // 备份
    if (!options.force) {
      backupConfig(configDir)
    } else {
      console.log(
        `    ${ui.symbols.warning} ${chalk.yellow('强制模式：跳过备份')}`
      )
    }

    // 安装配置文件
    ui.section(ui.icons.gear, '配置文件')
    await installSettings(configDir, options.mode, editorLabel)
    await installKeybindings(configDir)

    // 安装扩展
    let extResult = {
      installed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      failedList: [],
    }
    try {
      const exts = await getExtensionList()
      extResult = await installExtensions(editorPaths, exts, {
        timeout: parseInt(options.timeout || '30', 10),
      })
    } catch (e) {
      console.log(
        chalk.yellow(`${ui.icons.warning} 扩展安装跳过: ${e.message}`)
      )
    }

    // 统计
    const summaryLines = [
      `${chalk.white('编辑器')}      ${chalk.cyan(editorLabel)}`,
      `${chalk.white('配置文件')}    ${chalk.green('已更新')}`,
      `${chalk.white('新装扩展')}    ${extResult.installed > 0 ? chalk.green(extResult.installed + ' 个') : chalk.gray('0')}`,
    ]
    if (extResult.failed > 0)
      summaryLines.push(
        `${chalk.white('安装失败')}    ${chalk.red(extResult.failed + ' 个')}`
      )
    summaryLines.push(
      `${chalk.white('已有扩展')}    ${chalk.gray(extResult.skipped + ' 个')}`
    )
    console.log('')
    ui.successBox(`${editorLabel} 安装完成`, summaryLines)
  }
}

module.exports = {
  installConfig,
  CONFIG_SOURCES,
  detectVSCodePaths,
  detectCursorPaths,
  detectEditorPaths,
  getVSCodeConfigDir,
  getCursorConfigDir,
  getEditorConfigDir,
  getInstalledExtensions,
  runCli,
  parseJsonc,
  deepMerge,
  isValidExtId,
}
