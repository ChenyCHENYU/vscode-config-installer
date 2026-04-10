/**
 * @agile-team/vscode-config - installer v3.0
 *
 * 核心改动: 绕过 code/code.cmd 脚本，直接调用 Code.exe + cli.js
 * 设置 ELECTRON_RUN_AS_NODE=1，让 VS Code 以 Node 方式运行 CLI
 * → 不弹窗、stdout 可靠、跨平台
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
    const req = mod.get(url, {
      timeout,
      headers: { 'User-Agent': 'vscode-config/3.0' }
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGet(res.headers.location, timeout, redirects + 1).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => resolve(data));
    });
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
      spinner.succeed(`${filePath} 获取成功 ✓`);
      return data;
    } catch (e) {
      lastErr = e;
    }
  }
  if (spinner) spinner.fail(`${filePath} 获取失败`);
  throw new Error(`所有配置源都不可用: ${lastErr.message}`);
}

// ─── VS Code 路径检测 ──────────────────────────────────────────

/**
 * 检测 VS Code 的可执行文件和 cli.js 路径
 * 返回 { electron, cliScript } 或 null
 */
function detectVSCodePaths() {
  const platform = process.platform;
  if (platform === 'win32') return detectWindows();
  if (platform === 'darwin') return detectMacOS();
  return detectLinux();
}

function detectWindows() {
  // 方法1: where code.cmd
  try {
    const lines = execSync('where code.cmd', {
      encoding: 'utf8', stdio: 'pipe', timeout: 5000, windowsHide: true
    }).trim().split(/\r?\n/);
    for (const line of lines) {
      const binDir = path.dirname(line.trim());
      const result = resolveFromVSCodeDir(path.dirname(binDir), 'Code.exe');
      if (result) return result;
    }
  } catch (_) {}

  // 方法2: 常见安装路径
  const candidates = [
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code'),
    'C:\\Program Files\\Microsoft VS Code',
    'C:\\Program Files (x86)\\Microsoft VS Code',
  ];
  const pathDirs = (process.env.PATH || '').split(';');
  for (const dir of pathDirs) {
    if (/vscode|vs\scode/i.test(dir)) {
      const parent = path.dirname(dir);
      if (!candidates.includes(parent)) candidates.push(parent);
    }
  }
  for (const dir of candidates) {
    const result = resolveFromVSCodeDir(dir, 'Code.exe');
    if (result) return result;
  }
  return null;
}

function detectMacOS() {
  const appPaths = [
    '/Applications/Visual Studio Code.app',
    path.join(os.homedir(), 'Applications', 'Visual Studio Code.app'),
  ];
  for (const appPath of appPaths) {
    const electron = path.join(appPath, 'Contents', 'MacOS', 'Electron');
    const cliScript = path.join(appPath, 'Contents', 'Resources', 'app', 'out', 'cli.js');
    if (fs.existsSync(electron) && fs.existsSync(cliScript)) {
      return { electron, cliScript };
    }
  }
  try {
    let codePath = execSync('which code', { encoding: 'utf8', stdio: 'pipe', timeout: 5000 }).trim();
    codePath = fs.realpathSync(codePath);
    const parts = codePath.split(path.sep);
    const appIdx = parts.findIndex(p => p.endsWith('.app'));
    if (appIdx >= 0) {
      const appDir = parts.slice(0, appIdx + 1).join(path.sep);
      const electron = path.join(appDir, 'Contents', 'MacOS', 'Electron');
      const cliScript = path.join(appDir, 'Contents', 'Resources', 'app', 'out', 'cli.js');
      if (fs.existsSync(electron) && fs.existsSync(cliScript)) return { electron, cliScript };
    }
  } catch (_) {}
  return null;
}

function detectLinux() {
  const candidates = ['/usr/share/code', '/usr/lib/code', '/opt/visual-studio-code', '/snap/code/current/usr/share/code'];
  for (const dir of candidates) {
    const electron = path.join(dir, 'code');
    const cliScript = path.join(dir, 'resources', 'app', 'out', 'cli.js');
    if (fs.existsSync(electron) && fs.existsSync(cliScript)) return { electron, cliScript };
  }
  try {
    let codePath = execSync('which code', { encoding: 'utf8', stdio: 'pipe', timeout: 5000 }).trim();
    codePath = fs.realpathSync(codePath);
    const dir = path.dirname(codePath);
    const cliScript = path.join(dir, 'resources', 'app', 'out', 'cli.js');
    if (fs.existsSync(cliScript)) return { electron: codePath, cliScript };
  } catch (_) {}
  return null;
}

function resolveFromVSCodeDir(vscodeDir, exeName) {
  const electron = path.join(vscodeDir, exeName);
  if (!fs.existsSync(electron)) return null;
  try {
    const items = fs.readdirSync(vscodeDir);
    for (const item of items) {
      if (/^[0-9a-f]{10,}$/i.test(item)) {
        const cliScript = path.join(vscodeDir, item, 'resources', 'app', 'out', 'cli.js');
        if (fs.existsSync(cliScript)) return { electron, cliScript };
      }
    }
  } catch (_) {}
  const altCli = path.join(vscodeDir, 'resources', 'app', 'out', 'cli.js');
  if (fs.existsSync(altCli)) return { electron, cliScript: altCli };
  return null;
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

function getVSCodeConfigDir() {
  switch (process.platform) {
    case 'win32': return path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User');
    case 'darwin': return path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User');
    default: return path.join(os.homedir(), '.config', 'Code', 'User');
  }
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

async function installSettings(configDir, mode) {
  const content = await fetchFile('settings.json');
  const fp = path.join(configDir, 'settings.json');
  if (mode === 'merge' && fs.existsSync(fp)) {
    const local = parseJsonc(fs.readFileSync(fp, 'utf8'));
    const remote = parseJsonc(content);
    fs.writeFileSync(fp, JSON.stringify(deepMerge(local, remote), null, 2), 'utf8');
    console.log(chalk.green('✓ VSCode 设置合并完成（保留个人配置）'));
  } else {
    fs.writeFileSync(fp, content, 'utf8');
    console.log(chalk.green('✓ VSCode 设置安装完成'));
  }
}

async function installKeybindings(configDir) {
  try {
    const content = await fetchFile('keybindings.json');
    fs.writeFileSync(path.join(configDir, 'keybindings.json'), content, 'utf8');
    console.log(chalk.green('✓ 键盘快捷键安装完成'));
  } catch (e) {
    console.log(chalk.yellow(`⚠️ 键盘快捷键安装失败（可选项）: ${e.message}`));
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
  console.log(chalk.blue('��� 扩展安装分析:'));
  console.log(chalk.gray(`   配置包含: ${extensions.length} 个扩展`));
  console.log(chalk.gray(`   本地已有: ${alreadyCount} 个`));
  console.log(chalk.gray(`   需要安装: ${toInstall.length} 个`));

  if (toInstall.length === 0) {
    console.log('');
    console.log(chalk.green.bold('��� 所有配置扩展都已存在，跳过安装！'));
    return { installed: 0, failed: 0, skipped: alreadyCount, total: extensions.length, failedList: [] };
  }

  const valid = toInstall.filter(ext => {
    if (!isValidExtId(ext)) { console.log(chalk.yellow(`   ⚠️ 跳过无效扩展 ID: ${ext}`)); return false; }
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
      sp.succeed(`${tag} ${ext} ✓`);
    } else if (result.ok && output.trim()) {
      sp.succeed(`${tag} ${ext} (待验证)`);
    } else {
      sp.fail(`${tag} ${ext} ✗`);
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

  if (verified > 0) console.log(chalk.green(`✅ 验证通过: ${verified} 个扩展已安装`));
  if (verifyFailed > 0) {
    console.log(chalk.red(`❌ 安装失败: ${verifyFailed} 个扩展`));
    if (verifyFailed === valid.length) {
      console.log('');
      console.log(chalk.yellow.bold('⚠️ 所有扩展均失败，诊断信息:'));
      const ver = runCli(vscodePaths, '--version', 10000);
      console.log(chalk.gray(`   VS Code: ${(ver.stdout || '').trim().split('\n')[0]}`));
      console.log(chalk.gray(`   Node.js: ${process.version}`));
      console.log(chalk.gray(`   系统: ${process.platform} ${os.release()}`));
      console.log(chalk.gray(`   Electron: ${vscodePaths.electron}`));
      console.log(chalk.gray(`   CLI: ${vscodePaths.cliScript}`));
    }
    console.log('');
    console.log(chalk.yellow('��� 手动安装:'));
    for (const f of verifyFailedList) console.log(chalk.cyan(`   code --install-extension ${f.id}`));
  }

  return { installed: verified, failed: verifyFailed, skipped: alreadyCount, total: extensions.length, failedList: verifyFailedList };
}

// ─── 主函数 ────────────────────────────────────────────────────

async function installConfig(options = {}) {


  // 配置源
  if (options.source) {
    const lower = options.source.toLowerCase();
    const matched = CONFIG_SOURCES.filter(s => s.name.toLowerCase() === lower);
    if (matched.length > 0) {
      _activeSources = [...matched, ...CONFIG_SOURCES.filter(s => !matched.includes(s))];
    } else {
      console.log(chalk.yellow(`⚠️ 未知配置源 "${options.source}"，使用默认顺序`));
    }
  }

  // 检测 VS Code（核心: 找到 Code.exe + cli.js）
  ui.section('🔍', '环境检测');
  const detectSp = ora({ text: '检测 VS Code 安装...', indent: 4 }).start();
  const vscodePaths = detectVSCodePaths();
  if (!vscodePaths) {
    detectSp.fail('VS Code 未找到');
    throw new Error('VS Code 未检测到。请确认已安装且 code 命令在 PATH 中。\n下载: https://code.visualstudio.com/');
  }
  const verResult = runCli(vscodePaths, '--version', 10000);
  if (!verResult.ok && !verResult.stdout) {
    detectSp.fail('VS Code CLI 验证失败');
    throw new Error(`VS Code CLI 无法执行: ${verResult.error}`);
  }
  const vsVer = (verResult.stdout || '').trim().split('\n')[0];
  detectSp.succeed(`VS Code ${vsVer}`);
  if (process.env.LOG_LEVEL === 'verbose') {
    ui.kv('Electron:', vscodePaths.electron);
    ui.kv('CLI:', vscodePaths.cliScript);
  }

  // Git
  try {
    const gitVer = execSync('git --version', { encoding: 'utf8', stdio: 'pipe', timeout: 5000 }).trim();
    console.log(`    ${ui.symbols.success} ${gitVer}`);
  } catch (_) { throw new Error('Git 未安装。下载: https://git-scm.com/'); }

  const configDir = getVSCodeConfigDir();
  if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });

  // 预览
  if (options.dryRun) {
    ui.section('📝', '预览模式（不会做任何更改）');
    ui.kv('settings.json:', options.mode === 'merge' ? '合并模式' : '覆盖模式');
    ui.kv('keybindings.json:', '覆盖');
    try {
      const exts = await getExtensionList();
      const installed = getInstalledExtensions(vscodePaths);
      const set = new Set(installed.map(e => e.toLowerCase()));
      const newE = exts.filter(e => !set.has(e.toLowerCase()));
      console.log('');
      ui.kv('扩展总数:', `${exts.length} 个`);
      ui.kv('已安装:', `${exts.length - newE.length} 个`);
      ui.kv('待安装:', newE.length > 0 ? chalk.yellow(`${newE.length} 个`) : chalk.green('0 个'));
      if (newE.length > 0) {
        console.log('');
        newE.forEach(e => console.log(chalk.gray(`      • ${e}`)));
      }
    } catch (e) { console.log(chalk.yellow(`    ⚠ 获取失败: ${e.message}`)); }
    console.log('');
    ui.warnBox('预览完成', [chalk.white('未做任何更改，加 --force 执行安装')]);
    return;
  }

  // 备份
  if (!options.force) { backupConfig(configDir); }
  else { console.log(`    ${ui.symbols.warning} ${chalk.yellow('强制模式：跳过备份')}`); }

  // 安装配置文件
  ui.section('⚙️ ', '配置文件');
  await installSettings(configDir, options.mode);
  await installKeybindings(configDir);

  // 安装扩展
  let extResult = { installed: 0, failed: 0, skipped: 0, total: 0, failedList: [] };
  try {
    const exts = await getExtensionList();
    extResult = await installExtensions(vscodePaths, exts, { timeout: parseInt(options.timeout || '30', 10) });
  } catch (e) { console.log(chalk.yellow(`⚠️ 扩展安装跳过: ${e.message}`)); }

  // 统计
  const summaryLines = [
    `${chalk.white('配置文件')}    ${chalk.green('已更新')}`,
    `${chalk.white('新装扩展')}    ${extResult.installed > 0 ? chalk.green(extResult.installed + ' 个') : chalk.gray('0')}`,
  ];
  if (extResult.failed > 0) summaryLines.push(`${chalk.white('安装失败')}    ${chalk.red(extResult.failed + ' 个')}`);
  summaryLines.push(`${chalk.white('已有扩展')}    ${chalk.gray(extResult.skipped + ' 个')}`);
  console.log('');
  ui.successBox('安装完成', summaryLines);
}

module.exports = { installConfig, CONFIG_SOURCES, detectVSCodePaths, getVSCodeConfigDir, getInstalledExtensions, runCli };
