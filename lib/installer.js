const { execSync, exec: execCb } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const chalk = require('chalk');
const ora = require('ora');
const https = require('https');
const http = require('http');

// 双源配置 - GitHub主源，Gitee备用源
const CONFIG_SOURCES = [
  {
    name: 'GitHub',
    baseUrl: 'https://raw.githubusercontent.com/ChenyCHENYU/vscode-config/main',
    apiUrl: 'https://api.github.com/repos/ChenyCHENYU/vscode-config/contents',
    timeout: 15000
  },
  {
    name: 'Gitee',
    baseUrl: 'https://gitee.com/ycyplus163/vscode-config/raw/main',
    apiUrl: 'https://gitee.com/api/v5/repos/ycyplus163/vscode-config/contents',
    timeout: 10000
  }
];

// 配置常量
const EXTENSION_INSTALL_CONFIG = {
  installTimeout: 30000       // 单个扩展安装超时(ms)，批量时按扩展数量倍增
};

/**
 * 检查系统依赖
 */
function checkDependencies() {
  const spinner = ora('检查系统依赖...').start();
  
  try {
    // 检查 Git
    try {
      execSync('git --version', { stdio: 'ignore' });
    } catch (error) {
      spinner.fail('Git 检查失败');
      throw new Error('Git 未安装或不在 PATH 中。请先安装 Git。\n下载地址: https://git-scm.com/');
    }
    
    // 检查 VSCode
    try {
      execSync('code --version', { stdio: 'ignore' });
    } catch (error) {
      spinner.fail('VSCode 检查失败');
      throw new Error('VSCode 未安装或不在 PATH 中。请先安装 VSCode。\n下载地址: https://code.visualstudio.com/');
    }
    
    spinner.succeed('系统依赖检查通过 ✓');
    return true;
  } catch (error) {
    throw error;
  }
}

/**
 * 发送HTTP请求的通用函数
 */
function httpRequest(url, options = {}, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;
    const timeout = options.timeout || 15000;
    
    const req = protocol.get(url, {
      timeout,
      headers: {
        'User-Agent': 'VSCode-Config-Tool/2.0.0',
        'Accept': 'application/json, text/plain, */*',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      
      // 处理重定向（最多5次，防止无限循环）
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (redirectCount >= 5) {
          return reject(new Error('重定向次数过多'));
        }
        return httpRequest(res.headers.location, options, redirectCount + 1)
          .then(resolve)
          .catch(reject);
      }
      
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('请求超时'));
    });
    
    req.setTimeout(timeout);
  });
}

/**
 * 根据用户指定的 --source 选项获取有效源列表
 */
function getActiveSources(sourceName) {
  if (!sourceName) return CONFIG_SOURCES;
  const lower = sourceName.toLowerCase();
  const matched = CONFIG_SOURCES.filter(s => s.name.toLowerCase() === lower);
  if (matched.length === 0) {
    console.log(chalk.yellow(`⚠️ 未知配置源 "${sourceName}"，使用默认源顺序`));
    return CONFIG_SOURCES;
  }
  // 指定源放第一位，其余作为 fallback
  return [...matched, ...CONFIG_SOURCES.filter(s => !matched.includes(s))];
}

// 模块级变量，installConfig 中设置
let _activeSources = CONFIG_SOURCES;

/**
 * 尝试从多个源获取数据
 */
async function fetchFromSources(filePath, parser = (data) => data) {
  const sources = _activeSources;
  let lastError;
  let currentSpinner;
  
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    const isFirstSource = i === 0;
    const isLastSource = i === sources.length - 1;
    
    try {
      const url = `${source.baseUrl}/${filePath}`;
      
      // 显示获取进度
      if (isFirstSource) {
        currentSpinner = ora(`获取 ${filePath}...`).start();
      } else {
        if (currentSpinner) {
          currentSpinner.text = `GitHub 不可用，切换到 Gitee...`;
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      const data = await httpRequest(url, { timeout: source.timeout });
      
      if (currentSpinner) {
        currentSpinner.succeed(`${filePath} 获取成功 ✓`);
      }
      
      return parser(data);
    } catch (error) {
      lastError = error;
      
      if (isLastSource && currentSpinner) {
        currentSpinner.fail(`${filePath} 获取失败`);
      }
    }
  }
  
  throw new Error(`所有配置源都不可用。最后错误: ${lastError.message}`);
}

/**
 * 获取VSCode配置目录
 */
function getVSCodeConfigDir() {
  const platform = process.platform;
  const homeDir = os.homedir();
  
  switch (platform) {
    case 'win32':
      return path.join(homeDir, 'AppData', 'Roaming', 'Code', 'User');
    case 'darwin':
      return path.join(homeDir, 'Library', 'Application Support', 'Code', 'User');
    default: // linux
      return path.join(homeDir, '.config', 'Code', 'User');
  }
}

/**
 * 备份现有配置
 */
function backupExistingConfig(configDir) {
  const backupDir = path.join(configDir, `backup-${Date.now()}`);
  const filesToBackup = ['settings.json', 'keybindings.json', 'snippets'];
  const backedUp = [];
  
  for (const file of filesToBackup) {
    const sourcePath = path.join(configDir, file);
    if (fs.existsSync(sourcePath)) {
      const backupPath = path.join(backupDir, file);
      
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      if (fs.statSync(sourcePath).isDirectory()) {
        fs.cpSync(sourcePath, backupPath, { recursive: true });
      } else {
        fs.copyFileSync(sourcePath, backupPath);
      }
      backedUp.push(file);
    }
  }
  
  if (backedUp.length > 0) {
    console.log(chalk.blue(`📁 已备份配置: ${backedUp.join(', ')}`));
    console.log(chalk.gray(`   备份位置: ${backupDir}`));
  }
  
  return backupDir;
}

/**
 * 解析带注释的JSON（兼容 VS Code settings.json 的 // 注释和尾逗号）
 */
function parseJsonWithComments(text) {
  let result = '';
  let i = 0;
  let inString = false;

  while (i < text.length) {
    if (inString) {
      if (text[i] === '\\') {
        result += text[i] + (text[i + 1] || '');
        i += 2;
        continue;
      }
      if (text[i] === '"') inString = false;
      result += text[i++];
    } else if (text[i] === '"') {
      inString = true;
      result += text[i++];
    } else if (text[i] === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
    } else if (text[i] === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i += 2;
    } else {
      result += text[i++];
    }
  }
  // 去除尾逗号
  result = result.replace(/,\s*([\]}])/g, '$1');
  return JSON.parse(result);
}

/**
 * 深度合并两个对象（remote 覆盖 local 的同名键，嵌套对象递归合并）
 */
function deepMerge(local, remote) {
  const result = { ...local };
  for (const key of Object.keys(remote)) {
    if (
      result[key] !== null &&
      typeof result[key] === 'object' && !Array.isArray(result[key]) &&
      remote[key] !== null &&
      typeof remote[key] === 'object' && !Array.isArray(remote[key])
    ) {
      result[key] = deepMerge(result[key], remote[key]);
    } else {
      result[key] = remote[key];
    }
  }
  return result;
}

/**
 * 安装VSCode设置
 */
async function installSettings(configDir, options = {}) {
  try {
    const remoteContent = await fetchFromSources('settings.json');
    const settingsPath = path.join(configDir, 'settings.json');
    
    if (options.mode === 'merge' && fs.existsSync(settingsPath)) {
      // 合并模式：以本地设置为底，用团队设置覆盖同名键，保留个人独有配置
      const localContent = fs.readFileSync(settingsPath, 'utf8');
      const local = parseJsonWithComments(localContent);
      const remote = parseJsonWithComments(remoteContent);
      const merged = deepMerge(local, remote);
      fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2), 'utf8');
      console.log(chalk.green('✓ VSCode 设置合并完成（保留个人配置，应用团队设置）'));
    } else {
      fs.writeFileSync(settingsPath, remoteContent, 'utf8');
      console.log(chalk.green('✓ VSCode 设置安装完成'));
    }
  } catch (error) {
    throw new Error(`设置安装失败: ${error.message}`);
  }
}

/**
 * 安装键盘快捷键
 */
async function installKeybindings(configDir) {
  try {
    const keybindingsContent = await fetchFromSources('keybindings.json');
    const keybindingsPath = path.join(configDir, 'keybindings.json');
    fs.writeFileSync(keybindingsPath, keybindingsContent, 'utf8');
    console.log(chalk.green('✓ 键盘快捷键安装完成'));
  } catch (error) {
    console.log(chalk.yellow('⚠️ 键盘快捷键安装失败（可选项）'));
    console.log(chalk.gray(`   原因: ${error.message}`));
  }
}

/**
 * 获取扩展列表
 */
async function getExtensionList() {
  try {
    const extensionsContent = await fetchFromSources('extensions.list');
    const extensionLines = extensionsContent
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && !line.startsWith('//'));
    
    if (extensionLines.length === 0) {
      throw new Error('extensions.list 文件为空或无有效内容');
    }
    
    return extensionLines;
  } catch (error) {
    throw new Error(`获取扩展列表失败: ${error.message}`);
  }
}

/**
 * 解析扩展ID，提取作者和名称
 */
function parseExtensionId(extensionId) {
  const parts = extensionId.split('.');
  if (parts.length >= 2) {
    return {
      author: parts[0],
      name: parts.slice(1).join('.'),
      displayName: extensionId
    };
  }
  return {
    author: '未知',
    name: extensionId,
    displayName: extensionId
  };
}

/**
 * 获取已安装的扩展列表
 */
function getInstalledExtensionsList() {
  try {
    const output = execSync('code --list-extensions', { 
      encoding: 'utf8', 
      stdio: 'pipe' 
    });
    return output.trim().split('\n').filter(ext => ext.trim());
  } catch (error) {
    return [];
  }
}

/**
 * 显示安装失败的扩展信息
 */
function displayFailedExtensions(failedExtensions) {
  if (failedExtensions.length === 0) return;
  
  console.log('');
  console.log(chalk.red.bold('🚫 安装失败的扩展:'));
  console.log(chalk.gray('━'.repeat(60)));
  
  failedExtensions.forEach(({ id, author, name, displayName, error, attempts }) => {
    console.log(chalk.red(`❌ ${displayName}`));
    console.log(chalk.gray(`   作者: ${author}`));
    console.log(chalk.gray(`   名称: ${name}`));
    console.log(chalk.gray(`   尝试次数: ${attempts}`));
    
    // 简化错误信息
    const errorMsg = error.length > 100 ? error.substring(0, 97) + '...' : error;
    console.log(chalk.gray(`   错误: ${errorMsg}`));
    console.log('');
  });
  
  console.log(chalk.yellow.bold('💡 手动安装建议:'));
  console.log(chalk.gray('可以尝试以下命令手动安装失败的扩展:'));
  console.log('');
  
  failedExtensions.forEach(({ id, displayName }) => {
    console.log(chalk.cyan(`code --install-extension ${id}`));
    console.log(chalk.gray(`# 安装 ${displayName}`));
    console.log('');
  });
  
  console.log(chalk.blue('📝 其他安装方式:'));
  console.log(chalk.gray('1. 打开 VSCode'));
  console.log(chalk.gray('2. 按 Ctrl+Shift+X (或 Cmd+Shift+X) 打开扩展面板'));
  console.log(chalk.gray('3. 在搜索框中输入扩展名称'));
  console.log(chalk.gray('4. 点击安装按钮'));
}

/**
 * 执行 shell 命令（Promise 封装）
 */
function execAsync(cmd, options = {}) {
  return new Promise((resolve) => {
    execCb(cmd, options, (error, stdout, stderr) => {
      resolve({
        success: !error,
        stdout: stdout || '',
        stderr: stderr || '',
        error
      });
    });
  });
}

/**
 * 校验扩展 ID 格式（防注入）
 */
function isValidExtensionId(id) {
  return /^[\w][\w.-]*$/.test(id);
}

/**
 * 将扩展列表分成多批（Windows cmd 行长度限制 ~8192 字符）
 */
function splitIntoBatches(extensions, maxCmdLength = 7000) {
  const batches = [];
  let currentBatch = [];
  let currentLength = 'code'.length;

  for (const ext of extensions) {
    const argLength = ' --install-extension '.length + ext.length;
    if (currentLength + argLength > maxCmdLength && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [];
      currentLength = 'code'.length;
    }
    currentBatch.push(ext);
    currentLength += argLength;
  }
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }
  return batches;
}

/**
 * 从 code CLI 的输出中解析每个扩展的安装结果
 * stdout 包含成功信息，stderr 包含失败信息
 */
function parseInstallOutput(stdout, stderr, extensions) {
  const results = new Map(); // extensionId (lowercase) -> { success: boolean, message: string }
  const allOutput = (stdout || '') + '\n' + (stderr || '');
  const lines = allOutput.split('\n');

  for (const ext of extensions) {
    const extLower = ext.toLowerCase();
    // 在输出中查找包含该扩展 ID 的行（大小写不敏感）
    let found = false;
    for (const line of lines) {
      const lineLower = line.toLowerCase();
      if (lineLower.includes(extLower) || lineLower.includes(`'${extLower}'`)) {
        if (line.includes('successfully installed') || line.includes('already installed')) {
          results.set(extLower, { success: true, message: line.trim() });
          found = true;
          break;
        } else if (line.includes('not found') || line.includes('Failed')) {
          results.set(extLower, { success: false, message: line.trim() });
          found = true;
          break;
        }
      }
    }
    if (!found) {
      // 没有在输出中找到该扩展的结果
      results.set(extLower, { success: false, message: '未在输出中找到安装结果' });
    }
  }
  return results;
}

/**
 * 预检: 验证 code CLI 是否能正常执行扩展安装命令
 * 返回 { ok: boolean, output: string }
 */
async function preflightCheck() {
  // 用 --help 来检测 CLI 是否可用（不实际安装任何东西）
  const result = await execAsync('code --install-extension --help', {
    timeout: 15000,
    windowsHide: true,
    encoding: 'utf8'
  });
  const output = result.stdout + result.stderr;
  // 只要 exec 没有报 ENOENT/EPERM 之类的系统错误就算通过
  if (result.error && result.error.code === 'ENOENT') {
    return { ok: false, output: 'code 命令未找到（ENOENT）' };
  }
  return { ok: true, output: output.substring(0, 200) };
}

/**
 * 使用 execSync 逐个安装（批量模式的 fallback）
 * 这是最可靠的方式，使用同步执行，避免任何异步/缓冲问题
 */
function installExtensionSync(extensionId, timeout) {
  try {
    const output = execSync(`code --install-extension ${extensionId}`, {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout,
      windowsHide: true
    });
    return { success: true, output };
  } catch (error) {
    return {
      success: false,
      output: (error.stdout || '') + (error.stderr || ''),
      error: error.message
    };
  }
}

/**
 * 批量安装扩展
 * 策略: 单次 code CLI 调用安装所有扩展（减少窗口弹出），失败则回退逐个 execSync
 * 命令格式: code --install-extension ext1 --install-extension ext2 ...
 */
async function installExtensions(extensions, options = {}) {
  const config = { ...EXTENSION_INSTALL_CONFIG, ...options };
  const verbose = process.env.LOG_LEVEL === 'verbose';
  
  // 分析扩展安装情况（大小写归一，避免重复安装）
  const installedExtensions = getInstalledExtensionsList();
  const installedLower = installedExtensions.map(e => e.toLowerCase());
  const newExtensions = extensions.filter(ext => !installedLower.includes(ext.toLowerCase()));
  const alreadyInstalled = extensions.filter(ext => installedLower.includes(ext.toLowerCase()));
  
  console.log('');
  console.log(chalk.blue('📦 扩展安装分析:'));
  console.log(chalk.gray(`   配置包含: ${extensions.length} 个扩展`));
  console.log(chalk.gray(`   本地已有: ${alreadyInstalled.length} 个`));
  console.log(chalk.gray(`   需要安装: ${newExtensions.length} 个`));
  
  if (newExtensions.length === 0) {
    console.log('');
    console.log(chalk.green.bold('🎉 所有配置扩展都已存在，跳过扩展安装！'));
    return { 
      installed: 0, 
      failed: 0, 
      failedExtensions: [], 
      skipped: alreadyInstalled.length, 
      total: extensions.length 
    };
  }
  
  // 过滤无效的扩展 ID
  const validExtensions = newExtensions.filter(ext => {
    if (!isValidExtensionId(ext)) {
      console.log(chalk.yellow(`   ⚠️ 跳过无效扩展 ID: ${ext}`));
      return false;
    }
    return true;
  });
  
  if (validExtensions.length === 0) {
    console.log(chalk.yellow('⚠️ 没有有效的扩展需要安装'));
    return { installed: 0, failed: 0, failedExtensions: [], skipped: alreadyInstalled.length, total: extensions.length };
  }
  
  // 预检: 验证 code CLI 可用
  const preflight = await preflightCheck();
  if (!preflight.ok) {
    console.log(chalk.red(`❌ code CLI 预检失败: ${preflight.output}`));
    console.log(chalk.yellow('💡 请确认 VS Code 已正确安装且 code 命令在 PATH 中'));
    return { installed: 0, failed: validExtensions.length, failedExtensions: [], skipped: alreadyInstalled.length, total: extensions.length };
  }
  
  // 按 Windows cmd 行长度限制分批
  const batches = splitIntoBatches(validExtensions);
  
  console.log('');
  console.log(chalk.gray(`   安装策略: 批量模式（单次 CLI 调度，减少窗口弹出）`));
  if (batches.length > 1) {
    console.log(chalk.gray(`   分 ${batches.length} 批执行（命令行长度限制）`));
  }
  
  const spinner = ora(`正在安装 ${validExtensions.length} 个扩展（请耐心等待）...`).start();
  
  let batchAllFailed = false;  // 标记批量模式是否完全失败
  let installed = 0;
  let failed = 0;
  const failedExtensions = [];
  
  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    
    if (batches.length > 1) {
      spinner.text = `安装第 ${batchIdx + 1}/${batches.length} 批 (${batch.length} 个扩展)...`;
    }
    
    // 构建批量安装命令
    const args = batch.map(ext => `--install-extension ${ext}`).join(' ');
    const cmd = `code ${args}`;
    
    // 超时 = 每个扩展 120s（网络慢时需要更长），至少 120s
    const batchTimeout = Math.max(120000, 120000 * batch.length);
    
    if (verbose) {
      spinner.stop();
      console.log(chalk.gray(`   [verbose] 执行命令: ${cmd}`));
      console.log(chalk.gray(`   [verbose] 超时设置: ${(batchTimeout / 1000).toFixed(0)}s`));
      spinner.start();
    }
    
    const result = await execAsync(cmd, {
      timeout: batchTimeout,
      windowsHide: true,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });
    
    if (verbose) {
      spinner.stop();
      console.log(chalk.gray(`   [verbose] exit code: ${result.error ? (result.error.killed ? 'KILLED' : result.error.code) : 0}`));
      console.log(chalk.gray(`   [verbose] stdout: ${result.stdout.substring(0, 800)}`));
      if (result.stderr) {
        console.log(chalk.gray(`   [verbose] stderr: ${result.stderr.substring(0, 800)}`));
      }
      spinner.start();
    }
    
    // 如果进程被 kill（超时），标记整个批次失败
    if (result.error && result.error.killed) {
      spinner.stop();
      console.log(chalk.yellow(`\n   ⚠️ 批量安装超时（${(batchTimeout / 1000).toFixed(0)}s），将回退到逐个安装模式`));
      batchAllFailed = true;
      break;
    }
    
    // 如果 stdout+stderr 都为空，说明 exec 出了根本性问题
    if (!result.stdout.trim() && !result.stderr.trim()) {
      spinner.stop();
      console.log(chalk.yellow('\n   ⚠️ 批量安装无输出，将回退到逐个安装模式'));
      if (result.error) {
        console.log(chalk.gray(`   错误: ${result.error.message.substring(0, 200)}`));
      }
      batchAllFailed = true;
      break;
    }
    
    // 解析每个扩展的安装结果（基于 stdout/stderr 输出，不依赖 exit code）
    const results = parseInstallOutput(result.stdout, result.stderr, batch);
    
    for (const ext of batch) {
      const extResult = results.get(ext.toLowerCase());
      const extInfo = parseExtensionId(ext);
      
      if (extResult && extResult.success) {
        installed++;
      } else {
        failed++;
        failedExtensions.push({
          id: ext,
          author: extInfo.author,
          name: extInfo.name,
          displayName: extInfo.displayName,
          error: extResult ? extResult.message : '未知错误',
          attempts: 1
        });
      }
    }
  }
  
  spinner.stop();
  
  // ===== Fallback: 批量模式完全失败时，回退到逐个 execSync 安装 =====
  if (batchAllFailed) {
    console.log(chalk.blue('\n🔄 回退模式: 逐个安装扩展（execSync）'));
    installed = 0;
    failed = 0;
    failedExtensions.length = 0;
    
    const perExtTimeout = Math.max(120000, config.installTimeout);
    
    for (let i = 0; i < validExtensions.length; i++) {
      const ext = validExtensions[i];
      const extInfo = parseExtensionId(ext);
      const progress = `[${i + 1}/${validExtensions.length}]`;
      const extSpinner = ora(`${progress} 安装 ${extInfo.displayName}...`).start();
      
      const result = installExtensionSync(ext, perExtTimeout);
      const output = result.output || '';
      
      if (output.includes('successfully installed') || output.includes('already installed')) {
        extSpinner.succeed(`${progress} ${extInfo.displayName} ✓`);
        installed++;
      } else {
        extSpinner.fail(`${progress} ${extInfo.displayName} ✗`);
        console.log(chalk.gray(`      输出: ${output.trim().substring(0, 200) || '(无输出)'}`));
        if (result.error) {
          console.log(chalk.gray(`      错误: ${result.error.substring(0, 200)}`));
        }
        failed++;
        failedExtensions.push({
          id: ext,
          author: extInfo.author,
          name: extInfo.name,
          displayName: extInfo.displayName,
          error: output.trim().substring(0, 120) || result.error || '未知错误',
          attempts: 1
        });
      }
    }
  } else {
    // 批量模式成功时，显示每个扩展的结果
    for (const ext of validExtensions) {
      const extInfo = parseExtensionId(ext);
      const isFailed = failedExtensions.some(f => f.id === ext);
      if (isFailed) {
        const failInfo = failedExtensions.find(f => f.id === ext);
        console.log(chalk.red(`  ✗ ${extInfo.displayName}`));
        console.log(chalk.gray(`    原因: ${failInfo.error}`));
      } else {
        console.log(chalk.green(`  ✓ ${extInfo.displayName}`));
      }
    }
  }
  
  // 安装后验证：再次获取已安装列表，核实真实安装情况
  console.log('');
  const verifySpinner = ora('验证安装结果...').start();
  const postInstallList = getInstalledExtensionsList();
  const postInstalledLower = postInstallList.map(e => e.toLowerCase());
  verifySpinner.stop();
  
  let verifiedInstalled = 0;
  let verifiedFailed = 0;
  const verifiedFailedExtensions = [];
  
  for (const ext of validExtensions) {
    if (postInstalledLower.includes(ext.toLowerCase())) {
      verifiedInstalled++;
    } else {
      verifiedFailed++;
      const extInfo = parseExtensionId(ext);
      const existingFail = failedExtensions.find(f => f.id === ext);
      verifiedFailedExtensions.push({
        id: ext,
        author: extInfo.author,
        name: extInfo.name,
        displayName: extInfo.displayName,
        error: existingFail ? existingFail.error : '安装后验证未通过（code --list-extensions 中未找到）',
        attempts: 1
      });
    }
  }
  
  // 显示最终验证结果
  if (verifiedInstalled > 0) {
    console.log(chalk.green(`✅ 验证安装成功: ${verifiedInstalled} 个扩展`));
  }
  if (verifiedFailed > 0) {
    console.log(chalk.red(`❌ 安装失败: ${verifiedFailed} 个扩展`));
    
    // 如果全部失败，输出诊断信息帮助排查
    if (verifiedFailed === validExtensions.length) {
      console.log('');
      console.log(chalk.yellow.bold('⚠️ 所有扩展安装均失败，诊断信息:'));
      try {
        const codeVer = execSync('code --version', { encoding: 'utf8', stdio: 'pipe' }).trim().split('\n')[0];
        console.log(chalk.gray(`   VS Code 版本: ${codeVer}`));
      } catch (e) {
        console.log(chalk.red(`   VS Code CLI 不可用: ${e.message}`));
      }
      console.log(chalk.gray(`   Node.js 版本: ${process.version}`));
      console.log(chalk.gray(`   操作系统: ${process.platform} ${os.release()}`));
      console.log(chalk.gray(`   运行环境: ${process.env.TERM_PROGRAM === 'vscode' ? 'VS Code 终端' : '外部终端'}`));
      console.log('');
      console.log(chalk.yellow('💡 排查建议:'));
      console.log(chalk.gray('  1. 尝试手动执行: code --install-extension editorconfig.editorconfig'));
      console.log(chalk.gray('  2. 检查网络是否能访问 VS Code 扩展市场'));
      console.log(chalk.gray('  3. 若使用代理，确认 VS Code 代理设置正确'));
      console.log(chalk.gray('  4. 尝试从外部终端（PowerShell/CMD）运行本工具'));
      console.log(chalk.gray('  5. 增加超时: vscode-config install --timeout 120'));
    }
    
    displayFailedExtensions(verifiedFailedExtensions);
  }
  
  return {
    installed: verifiedInstalled,
    failed: verifiedFailed,
    failedExtensions: verifiedFailedExtensions,
    skipped: alreadyInstalled.length,
    total: extensions.length
  };
}

/**
 * 显示安装统计
 */
function displayInstallationSummary(extensionResults) {
  const { installed, failed, skipped } = extensionResults;
  
  if (installed > 0 || failed > 0) {
    console.log('');
    console.log(chalk.blue('📊 安装统计:'));
    console.log(chalk.gray('  • 配置文件: 已更新'));
    console.log(chalk.gray(`  • 成功安装扩展: ${installed} 个`));
    if (failed > 0) {
      console.log(chalk.gray(`  • 安装失败扩展: ${failed} 个`));
    }
    console.log(chalk.gray(`  • 本地已有扩展: ${skipped} 个`));
    
    console.log('');
    console.log(chalk.green('💡 完成提示:'));
    console.log(chalk.gray('  • 🛡️  您现有的扩展都已保留'));
    if (installed > 0) {
      console.log(chalk.gray('  • 📦 新扩展已成功安装'));
    }
    if (failed > 0) {
      console.log(chalk.gray('  • ⚙️  失败的扩展可稍后手动安装'));
      console.log(chalk.gray('  • 💾 可从备份中恢复个人设置'));
    }
  } else {
    console.log('');
    console.log(chalk.blue('📊 安装统计:'));
    console.log(chalk.gray('  • 配置文件: 已更新'));
    console.log(chalk.gray('  • 扩展状态: 全部已存在，跳过安装'));
  }
}

/**
 * 主安装函数
 */
async function installConfig(options = {}) {
  try {
    console.log(chalk.gray('🚀 开始 VSCode 配置安装流程...'));
    console.log('');
    
    // 1. 设置配置源
    _activeSources = getActiveSources(options.source);
    
    // 2. 检查系统依赖
    checkDependencies();
    
    // 3. 获取并确保配置目录存在
    const configDir = getVSCodeConfigDir();
    console.log(chalk.gray(`📁 VSCode 配置目录: ${configDir}`));
    
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // 4. 预览模式：只显示计划，不实际执行
    if (options.dryRun) {
      console.log('');
      console.log(chalk.blue('📝 将更新的配置文件:'));
      console.log(chalk.gray(`   • settings.json (${options.mode === 'merge' ? '合并模式' : '覆盖模式'})`));
      console.log(chalk.gray('   • keybindings.json'));
      
      try {
        const extensions = await getExtensionList();
        const installedExtensions = getInstalledExtensionsList();
        const installedLower = installedExtensions.map(e => e.toLowerCase());
        const newExts = extensions.filter(ext => !installedLower.includes(ext.toLowerCase()));
        
        console.log('');
        console.log(chalk.blue('📦 扩展安装计划:'));
        console.log(chalk.gray(`   配置包含: ${extensions.length} 个扩展`));
        console.log(chalk.gray(`   本地已有: ${extensions.length - newExts.length} 个`));
        console.log(chalk.gray(`   需要安装: ${newExts.length} 个`));
        
        if (newExts.length > 0) {
          console.log('');
          newExts.forEach(ext => console.log(chalk.gray(`   • ${ext}`)));
        }
      } catch (error) {
        console.log(chalk.yellow(`   ⚠️ 扩展列表获取失败: ${error.message}`));
      }
      
      console.log('');
      console.log(chalk.yellow('🔍 预览完成，未做任何更改'));
      return;
    }
    
    // 5. 备份现有配置（--force 跳过备份）
    if (options.force) {
      console.log(chalk.yellow('⚡ 强制模式：跳过备份'));
    } else {
      backupExistingConfig(configDir);
    }
    
    // 6. 安装配置文件
    await installSettings(configDir, options);
    await installKeybindings(configDir);
    
    // 7. 安装扩展
    const timeoutMs = parseInt(options.timeout || '30', 10) * 1000;
    let extensionResults = { 
      installed: 0, 
      failed: 0, 
      failedExtensions: [], 
      skipped: 0, 
      total: 0 
    };
    
    try {
      const extensions = await getExtensionList();
      extensionResults = await installExtensions(extensions, { installTimeout: timeoutMs });
    } catch (error) {
      console.log(chalk.yellow('⚠️ 扩展安装跳过 (扩展列表获取失败)'));
      console.log(chalk.gray(`   原因: ${error.message}`));
    }
    
    // 8. 显示完成信息
    console.log('');
    console.log(chalk.green.bold('🎉 VSCode 配置安装完成！'));
    
    displayInstallationSummary(extensionResults);
    
  } catch (error) {
    throw error;
  }
}

module.exports = {
  installConfig,
  CONFIG_SOURCES
};