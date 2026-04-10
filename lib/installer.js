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
 * 批量安装扩展
 * 使用 exec() 以命令字符串方式调用，避免 spawn+shell:true 的 DEP0190 警告和 Windows .cmd 兼容问题
 */
async function installExtensions(extensions, options = {}) {
  const config = { ...EXTENSION_INSTALL_CONFIG, ...options };
  
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
  
  console.log('');
  
  // 逐个安装，每个扩展用 exec(命令字符串) 确保 Windows .cmd 兼容
  let installed = 0;
  let failed = 0;
  const failedExtensions = [];
  
  for (let i = 0; i < validExtensions.length; i++) {
    const extensionId = validExtensions[i];
    const extensionInfo = parseExtensionId(extensionId);
    const progress = `[${i + 1}/${validExtensions.length}]`;
    const spinner = ora(`${progress} 安装 ${extensionInfo.displayName}...`).start();
    
    const cmd = `code --install-extension ${extensionId}`;
    const result = await execAsync(cmd, {
      timeout: config.installTimeout,
      windowsHide: true
    });
    
    const output = result.stdout + result.stderr;
    
    if (result.success && (output.includes('successfully installed') || output.includes('already installed'))) {
      spinner.succeed(`${progress} ${extensionInfo.displayName} ✓`);
      installed++;
    } else {
      // 提取真实错误信息
      let errorMsg = '安装未成功';
      if (output.includes('not found')) {
        errorMsg = '在扩展市场中未找到';
      } else if (output.includes('ETIMEDOUT') || output.includes('timeout')) {
        errorMsg = '下载超时';
      } else if (output.includes('connect ECONNREFUSED')) {
        errorMsg = '网络连接被拒绝';
      } else if (result.error && result.error.killed) {
        errorMsg = '安装超时被终止';
      } else if (output.trim()) {
        // 取输出最后一行非空内容作为错误提示
        const lines = output.trim().split('\n').filter(l => l.trim());
        errorMsg = lines[lines.length - 1].substring(0, 120);
      }
      
      spinner.fail(`${progress} ${extensionInfo.displayName} ✗`);
      failed++;
      failedExtensions.push({
        id: extensionId,
        author: extensionInfo.author,
        name: extensionInfo.name,
        displayName: extensionInfo.displayName,
        error: errorMsg,
        attempts: 1
      });
    }
  }
  
  // 显示安装结果
  console.log('');
  if (installed > 0) {
    console.log(chalk.green(`✅ 成功安装: ${installed} 个扩展`));
  }
  if (failed > 0) {
    console.log(chalk.red(`❌ 安装失败: ${failed} 个扩展`));
    displayFailedExtensions(failedExtensions);
  }
  
  return {
    installed,
    failed,
    failedExtensions,
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