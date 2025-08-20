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
    baseUrl: 'https://gitee.com/ycyplus163/vscode-config/raw/main',
    apiUrl: 'https://gitee.com/api/v5/repos/ycyplus163/vscode-config/contents',
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
  let currentSpinner;
  
  for (let i = 0; i < CONFIG_SOURCES.length; i++) {
    const source = CONFIG_SOURCES[i];
    const isFirstSource = i === 0;
    const isLastSource = i === CONFIG_SOURCES.length - 1;
    
    try {
      const url = `${source.baseUrl}/${path}`;
      
      // 只有第一个源才显示初始状态
      if (isFirstSource) {
        currentSpinner = ora(`获取 ${path}...`).start();
      } else {
        if (currentSpinner) currentSpinner.text = `GitHub 不可用，切换到 Gitee...`;
        // 短暂延迟让用户看到切换信息
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      const data = await httpRequest(url, { timeout: source.timeout });
      
      if (currentSpinner) {
        currentSpinner.succeed(`${path} 获取成功 ✓`);
      }
      
      return parser(data);
    } catch (error) {
      lastError = error;
      
      if (isLastSource) {
        // 最后一个源也失败了
        if (currentSpinner) {
          currentSpinner.fail(`${path} 获取失败`);
        }
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
    // 首先尝试 extensions.json
    let extensionsContent;
    let extensions;
    
    try {
      extensionsContent = await fetchFromSources('extensions.json');
      extensions = JSON.parse(extensionsContent);
      
      // 支持多种JSON格式
      if (Array.isArray(extensions)) {
        return extensions;
      } else if (extensions.recommendations && Array.isArray(extensions.recommendations)) {
        return extensions.recommendations;
      } else {
        throw new Error('无效的扩展配置格式');
      }
    } catch (jsonError) {
      // 如果extensions.json不存在，尝试extensions.list
      console.log(chalk.yellow('未找到 extensions.json，尝试 extensions.list...'));
      
      try {
        extensionsContent = await fetchFromSources('extensions.list');
        
        // 处理 .list 文件格式（每行一个扩展ID）
        const extensionLines = extensionsContent
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#') && !line.startsWith('//'));
        
        if (extensionLines.length === 0) {
          throw new Error('extensions.list 文件为空或无有效内容');
        }
        
        console.log(chalk.green('✓ extensions.list 读取成功'));
        return extensionLines;
      } catch (listError) {
        throw listError;
      }
    }
  } catch (error) {
    throw new Error(`获取扩展列表失败: ${error.message}`);
  }
}

/**
 * 安装单个扩展（带重试机制）
 */
async function installExtensionWithRetry(extensionId, timeout = 30000, maxRetries = 1) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const isRetry = attempt > 0;
    
    const result = await new Promise((resolve) => {
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
          resolve({ success: true, output, attempt });
        } else {
          resolve({ success: false, error: errorOutput || output, attempt });
        }
      });
      
      child.on('error', (error) => {
        resolve({ success: false, error: error.message, attempt });
      });
      
      child.on('timeout', () => {
        resolve({ success: false, error: '安装超时', attempt });
      });
    });
    
    if (result.success) {
      return result;
    }
    
    // 如果失败且还有重试次数
    if (attempt < maxRetries) {
      // 等待2秒后重试
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // 最后一次尝试，返回结果
    if (attempt === maxRetries) {
      return result;
    }
  }
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
 * 验证扩展是否真的安装成功
 */
function verifyExtensionInstalled(extensionId) {
  const installedExtensions = getInstalledExtensionsList();
  return installedExtensions.includes(extensionId);
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
  
  console.log('');
  console.log(chalk.blue(`📦 扩展安装分析:`));
  console.log(chalk.gray(`   配置包含: ${extensions.length} 个扩展`));
  console.log(chalk.gray(`   本地已有: ${alreadyInstalled.length} 个`));
  console.log(chalk.gray(`   需要安装: ${newExtensions.length} 个`));
  
  if (newExtensions.length === 0) {
    console.log('');
    console.log(chalk.green.bold('🎉 所有配置扩展都已存在，跳过扩展安装！'));
    return { installed: 0, failed: 0, failedExtensions: [], skipped: alreadyInstalled.length, total: extensions.length };
  }
  
  console.log('');
  console.log(chalk.blue(`🔄 开始安装 ${newExtensions.length} 个新扩展...`));
  
  // 显示需要安装的扩展列表
  if (newExtensions.length <= 10) {
    console.log(chalk.yellow('需要安装的扩展:'));
    newExtensions.forEach(ext => {
      console.log(chalk.gray(`   • ${ext}`));
    });
  } else {
    console.log(chalk.yellow('需要安装的扩展 (显示前10个):'));
    newExtensions.slice(0, 10).forEach(ext => {
      console.log(chalk.gray(`   • ${ext}`));
    });
    console.log(chalk.gray(`   ... 还有 ${newExtensions.length - 10} 个`));
  }
  console.log('');
  
  // 分批处理扩展安装 - 只安装新扩展，降低并发数提高稳定性
  const maxConcurrent = 2; // 降低并发数，提高稳定性
  
  for (let i = 0; i < newExtensions.length; i += maxConcurrent) {
    const batch = newExtensions.slice(i, i + maxConcurrent);
    const promises = batch.map(async (extensionId) => {
      const extensionInfo = parseExtensionId(extensionId);
      let spinner = ora(`安装 ${extensionInfo.displayName}...`).start();
      
      try {
        const result = await installExtensionWithRetry(extensionId, timeout, 1); // 重试1次
        
        if (result.success) {
          // 验证是否真的安装成功
          const isVerified = verifyExtensionInstalled(extensionId);
          if (isVerified) {
            const retryText = result.attempt > 0 ? ` (重试后成功)` : '';
            spinner.succeed(`${extensionInfo.displayName} ✓${retryText}`);
            installed++;
          } else {
            spinner.fail(`${extensionInfo.displayName} ✗ (安装未生效)`);
            failed++;
            failedExtensions.push({ 
              id: extensionId, 
              author: extensionInfo.author,
              name: extensionInfo.name,
              displayName: extensionInfo.displayName,
              error: '安装未生效，可能需要手动安装',
              attempts: result.attempt + 1
            });
          }
        } else {
          const retryText = result.attempt > 0 ? ` (重试 ${result.attempt + 1} 次后仍失败)` : '';
          spinner.fail(`${extensionInfo.displayName} ✗${retryText}`);
          failed++;
          failedExtensions.push({ 
            id: extensionId,
            author: extensionInfo.author,
            name: extensionInfo.name, 
            displayName: extensionInfo.displayName,
            error: result.error,
            attempts: result.attempt + 1
          });
        }
      } catch (error) {
        spinner.fail(`${extensionInfo.displayName} ✗`);
        failed++;
        failedExtensions.push({ 
          id: extensionId,
          author: extensionInfo.author,
          name: extensionInfo.name,
          displayName: extensionInfo.displayName,
          error: error.message,
          attempts: 1
        });
      }
    });
    
    await Promise.all(promises);
  }
  
  // 显示安装结果
  console.log('');
  if (installed > 0) {
    console.log(chalk.green(`✅ 成功安装: ${installed} 个扩展`));
  }
  if (failed > 0) {
    console.log(chalk.red(`❌ 安装失败: ${failed} 个扩展`));
    
    if (failedExtensions.length > 0) {
      console.log('');
      console.log(chalk.red.bold('🚫 安装失败的扩展:'));
      console.log(chalk.gray('━'.repeat(60)));
      
      failedExtensions.forEach(({ id, author, name, displayName, error, attempts }) => {
        console.log(chalk.red(`❌ ${displayName}`));
        console.log(chalk.gray(`   作者: ${author}`));
        console.log(chalk.gray(`   名称: ${name}`));
        console.log(chalk.gray(`   尝试次数: ${attempts}`));
        
        // 简化错误信息显示
        let errorMsg = error;
        if (errorMsg.length > 100) {
          errorMsg = errorMsg.substring(0, 97) + '...';
        }
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
    let extensionResults = { installed: 0, failed: 0, failedExtensions: [], skipped: 0, total: 0 };
    
    try {
      const extensions = await getExtensionList();
      extensionResults = await installExtensions(extensions, options);
    } catch (error) {
      console.log(chalk.yellow('⚠️ 扩展安装跳过 (extensions.json 不存在)'));
      console.log(chalk.gray(`   原因: ${error.message}`));
    }
    
    console.log('');
    console.log(chalk.green.bold('🎉 VSCode 配置安装完成！'));
    
    // 显示安装统计 - 只在有实际安装操作时显示详细统计
    if (extensionResults.installed > 0 || extensionResults.failed > 0) {
      console.log('');
      console.log(chalk.blue('📊 安装统计:'));
      console.log(chalk.gray(`  • 配置文件: 已更新`));
      console.log(chalk.gray(`  • 成功安装扩展: ${extensionResults.installed} 个`));
      if (extensionResults.failed > 0) {
        console.log(chalk.gray(`  • 安装失败扩展: ${extensionResults.failed} 个`));
      }
      console.log(chalk.gray(`  • 本地已有扩展: ${extensionResults.skipped} 个`));
      
      console.log('');
      console.log(chalk.green('💡 完成提示:'));
      console.log(chalk.gray('  • 🛡️  您现有的扩展都已保留'));
      if (extensionResults.installed > 0) {
        console.log(chalk.gray('  • 📦 新扩展已成功安装'));
      }
      if (extensionResults.failed > 0) {
        console.log(chalk.gray('  • ⚙️  失败的扩展可稍后手动安装'));
        console.log(chalk.gray('  • 💾 可从备份中恢复个人设置'));
      }
    } else {
      // 所有扩展都已存在的简化显示
      console.log('');
      console.log(chalk.blue('📊 安装统计:'));
      console.log(chalk.gray(`  • 配置文件: 已更新`));
      console.log(chalk.gray(`  • 扩展状态: 全部已存在，跳过安装`));
    }
    
  } catch (error) {
    throw error;
  }
}

module.exports = {
  installConfig,
  CONFIG_SOURCES
};