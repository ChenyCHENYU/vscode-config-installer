const { execSync, spawn } = require('child_process');
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
    baseUrl: 'https://gitee.com/chenyyu/vscode-config/raw/main',
    apiUrl: 'https://gitee.com/api/v5/repos/chenyyu/vscode-config/contents',
    timeout: 10000
  }
];

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
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;
    const timeout = options.timeout || 15000;
    
    const req = protocol.get(url, {
      timeout,
      headers: {
        'User-Agent': 'VSCode-Config-Tool/1.0.0',
        'Accept': 'application/json, text/plain, */*',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      
      // 处理重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpRequest(res.headers.location, options)
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
 * 尝试从多个源获取数据
 */
async function fetchFromSources(path, parser = (data) => data) {
  let lastError;
  
  for (const source of CONFIG_SOURCES) {
    try {
      const url = `${source.baseUrl}/${path}`;
      const spinner = ora(`从 ${source.name} 获取配置...`).start();
      
      const data = await httpRequest(url, { timeout: source.timeout });
      spinner.succeed(`从 ${source.name} 获取成功 ✓`);
      
      return parser(data);
    } catch (error) {
      if (ora.isSpinning) ora().fail(`${source.name} 获取失败`);
      lastError = error;
      
      // 如果不是最后一个源，显示切换信息
      if (source !== CONFIG_SOURCES[CONFIG_SOURCES.length - 1]) {
        console.log(chalk.yellow(`⚠️  ${source.name} 不可用，尝试备用源...`));
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
  let backedUp = [];
  
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
 * 安装VSCode设置
 */
async function installSettings(configDir) {
  const spinner = ora('安装 VSCode 设置...').start();
  
  try {
    // 获取设置文件
    const settingsContent = await fetchFromSources('settings.json');
    
    // 写入设置文件
    const settingsPath = path.join(configDir, 'settings.json');
    fs.writeFileSync(settingsPath, settingsContent, 'utf8');
    
    spinner.succeed('VSCode 设置安装完成 ✓');
  } catch (error) {
    spinner.fail('设置安装失败');
    throw new Error(`设置安装失败: ${error.message}`);
  }
}

/**
 * 安装键盘快捷键
 */
async function installKeybindings(configDir) {
  const spinner = ora('安装键盘快捷键...').start();
  
  try {
    const keybindingsContent = await fetchFromSources('keybindings.json');
    
    const keybindingsPath = path.join(configDir, 'keybindings.json');
    fs.writeFileSync(keybindingsPath, keybindingsContent, 'utf8');
    
    spinner.succeed('键盘快捷键安装完成 ✓');
  } catch (error) {
    // 键盘快捷键不是必需的，失败时只显示警告
    spinner.warn('键盘快捷键安装失败（可选项）');
    console.log(chalk.yellow(`   原因: ${error.message}`));
  }
}

/**
 * 获取扩展列表
 */
async function getExtensionList() {
  try {
    const extensionsContent = await fetchFromSources('extensions.json');
    const extensions = JSON.parse(extensionsContent);
    
    // 支持多种格式
    if (Array.isArray(extensions)) {
      return extensions;
    } else if (extensions.recommendations && Array.isArray(extensions.recommendations)) {
      return extensions.recommendations;
    } else {
      throw new Error('无效的扩展配置格式');
    }
  } catch (error) {
    throw new Error(`获取扩展列表失败: ${error.message}`);
  }
}

/**
 * 安装单个扩展
 */
function installExtension(extensionId, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const child = spawn('code', ['--install-extension', extensionId], {
      stdio: 'pipe',
      timeout
    });
    
    let output = '';
    let errorOutput = '';
    
    child.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output });
      } else {
        resolve({ success: false, error: errorOutput || output });
      }
    });
    
    child.on('error', (error) => {
      resolve({ success: false, error: error.message });
    });
    
    child.on('timeout', () => {
      resolve({ success: false, error: '安装超时' });
    });
  });
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
 * 批量安装扩展
 */
async function installExtensions(extensions, options = {}) {
  const timeout = (options.timeout || 30) * 1000;
  const maxConcurrent = 3; // 限制并发数避免过载
  
  // 获取已安装的扩展
  const installedExtensions = getInstalledExtensionsList();
  const newExtensions = extensions.filter(ext => !installedExtensions.includes(ext));
  const alreadyInstalled = extensions.filter(ext => installedExtensions.includes(ext));
  
  let installed = 0;
  let failed = 0;
  const failedExtensions = [];
  
  console.log(chalk.blue(`📦 扩展安装分析:`));
  console.log(chalk.gray(`   总共: ${extensions.length} 个扩展`));
  console.log(chalk.green(`   已安装: ${alreadyInstalled.length} 个 (将保持不变)`));
  console.log(chalk.yellow(`   需要安装: ${newExtensions.length} 个`));
  console.log('');
  
  if (alreadyInstalled.length > 0) {
    console.log(chalk.green('✅ 已安装的扩展 (保持不变):'));
    alreadyInstalled.slice(0, 5).forEach(ext => {
      console.log(chalk.gray(`   • ${ext}`));
    });
    if (alreadyInstalled.length > 5) {
      console.log(chalk.gray(`   ... 还有 ${alreadyInstalled.length - 5} 个`));
    }
    console.log('');
  }
  
  if (newExtensions.length === 0) {
    console.log(chalk.green('🎉 所有扩展都已安装，无需额外操作！'));
    return { installed: alreadyInstalled.length, failed: 0, failedExtensions: [], skipped: alreadyInstalled.length };
  }
  
  console.log(chalk.blue(`🔄 开始安装 ${newExtensions.length} 个新扩展...`));
  
  // 分批处理扩展安装 - 只安装新扩展
  for (let i = 0; i < newExtensions.length; i += maxConcurrent) {
    const batch = newExtensions.slice(i, i + maxConcurrent);
    const promises = batch.map(async (extensionId) => {
      const spinner = ora(`安装 ${extensionId}...`).start();
      
      try {
        const result = await installExtension(extensionId, timeout);
        
        if (result.success) {
          spinner.succeed(`${extensionId} ✓`);
          installed++;
        } else {
          spinner.fail(`${extensionId} ✗`);
          failed++;
          failedExtensions.push({ id: extensionId, error: result.error });
        }
      } catch (error) {
        spinner.fail(`${extensionId} ✗`);
        failed++;
        failedExtensions.push({ id: extensionId, error: error.message });
      }
    });
    
    await Promise.all(promises);
  }
  
  // 显示安装结果
  console.log('');
  console.log(chalk.green(`✅ 新安装: ${installed} 个扩展`));
  console.log(chalk.blue(`📋 保持不变: ${alreadyInstalled.length} 个扩展`));
  
  if (failed > 0) {
    console.log(chalk.yellow(`⚠️  安装失败: ${failed} 个扩展`));
    
    if (failedExtensions.length > 0) {
      console.log(chalk.gray('失败的扩展:'));
      failedExtensions.forEach(({ id, error }) => {
        console.log(chalk.gray(`  • ${id}: ${error.split('\n')[0]}`));
      });
    }
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
 * 主安装函数
 */
async function installConfig(options = {}) {
  try {
    console.log(chalk.gray('🚀 开始 VSCode 配置安装流程...'));
    console.log('');
    
    // 1. 检查依赖
    checkDependencies();
    
    // 2. 获取配置目录
    const configDir = getVSCodeConfigDir();
    console.log(chalk.gray(`📁 VSCode 配置目录: ${configDir}`));
    
    // 确保配置目录存在
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    // 3. 备份现有配置
    if (!options.force) {
      backupExistingConfig(configDir);
    }
    
    // 4. 安装设置文件
    await installSettings(configDir);
    
    // 5. 安装键盘快捷键（可选）
    await installKeybindings(configDir);
    
    // 6. 获取并安装扩展
    console.log('');
    const extensions = await getExtensionList();
    const extensionResults = await installExtensions(extensions, options);
    
    console.log('');
    console.log(chalk.green.bold('🎉 VSCode 配置安装完成！'));
    
    // 显示安装统计
    console.log('');
    console.log(chalk.blue('📊 安装统计:'));
    console.log(chalk.gray(`  • 配置文件: 已安装`));
    console.log(chalk.gray(`  • 扩展总数: ${extensionResults.total} 个`));
    console.log(chalk.gray(`  • 新安装扩展: ${extensionResults.installed} 个`));
    console.log(chalk.gray(`  • 保持不变: ${extensionResults.skipped} 个`));
    
    if (extensionResults.failed > 0) {
      console.log('');
      console.log(chalk.yellow('💡 关于插件处理:'));
      console.log(chalk.gray('  • 🛡️  您现有的插件都会保留'));
      console.log(chalk.gray('  • 📦 只安装配置中新增的插件'));
      console.log(chalk.gray('  • ⚙️  插件个人设置可能需要重新配置'));
      console.log(chalk.gray('  • 💾 可从备份中恢复个人设置'));
    } else {
      console.log('');
      console.log(chalk.green('💡 插件处理完成:'));
      console.log(chalk.gray('  • 🛡️  您的所有现有插件都已保留'));
      console.log(chalk.gray('  • 📦 团队配置中的插件已确保安装'));
    }
    
  } catch (error) {
    throw error;
  }
}

module.exports = {
  installConfig,
  CONFIG_SOURCES
};