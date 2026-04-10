const fs = require('fs');
const path = require('path');
const os = require('os');
const chalk = require('chalk');
const ora = require('ora');
const { detectVSCodePaths, runCli, getVSCodeConfigDir: getConfigDir } = require('./installer');

function getVSCodeConfigDir() {
  return getConfigDir();
}

function checkVSCodeInstalled() {
  const paths = detectVSCodePaths();
  if (!paths) return { installed: false };
  const result = runCli(paths, '--version', 10000);
  if (!result.ok && !result.stdout) return { installed: false };
  const lines = (result.stdout || '').trim().split('\n');
  return { installed: true, version: lines[0], commit: lines[1], arch: lines[2], paths };
}

function getInstalledExtensions(vscodePaths) {
  if (!vscodePaths) return [];
  const result = runCli(vscodePaths, '--list-extensions --show-versions', 15000);
  if (!result.ok && !result.stdout) return [];
  return (result.stdout || '').trim().split('\n')
    .filter(line => line.trim())
    .map(line => {
      const [name, version] = line.split('@');
      return { name, version: version || 'unknown' };
    });
}

/**
 * 检查配置文件状态
 */
function checkConfigFiles() {
  const configDir = getVSCodeConfigDir();
  const configFiles = [
    'settings.json',
    'keybindings.json',
    'snippets'
  ];
  
  const status = {};
  
  for (const file of configFiles) {
    const filePath = path.join(configDir, file);
    
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      status[file] = {
        exists: true,
        size: stats.size,
        modified: stats.mtime,
        isDirectory: stats.isDirectory()
      };
    } else {
      status[file] = { exists: false };
    }
  }
  
  return status;
}

/**
 * 检查备份文件
 */
function checkBackups() {
  const configDir = getVSCodeConfigDir();
  const backups = [];
  
  if (!fs.existsSync(configDir)) {
    return backups;
  }
  
  try {
    const items = fs.readdirSync(configDir);
    
    for (const item of items) {
      if (item.startsWith('backup-')) {
        const backupPath = path.join(configDir, item);
        const stats = fs.statSync(backupPath);
        
        if (stats.isDirectory()) {
          const timestamp = item.replace('backup-', '');
          const date = new Date(parseInt(timestamp));
          
          backups.push({
            name: item,
            path: backupPath,
            date: date,
            size: getDirSize(backupPath)
          });
        }
      }
    }
  } catch (error) {
    // 忽略权限错误等
  }
  
  return backups.sort((a, b) => b.date - a.date);
}

/**
 * 计算目录大小
 */
function getDirSize(dirPath) {
  let totalSize = 0;
  
  try {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        totalSize += getDirSize(itemPath);
      } else {
        totalSize += stats.size;
      }
    }
  } catch (error) {
    // 忽略错误
  }
  
  return totalSize;
}

/**
 * 格式化文件大小
 */
function formatSize(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * 格式化时间
 */
function formatDate(date) {
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes} 分钟前`;
    }
    return `${hours} 小时前`;
  } else if (days === 1) {
    return '昨天';
  } else if (days < 30) {
    return `${days} 天前`;
  } else {
    return date.toLocaleDateString('zh-CN');
  }
}

/**
 * 主状态检查函数
 */
async function checkStatus() {
  console.log(chalk.cyan.bold('📊 VSCode 配置状态检查'));
  console.log(chalk.gray('======================================='));
  console.log('');
  
  // 1. 检查VSCode安装状态
  const spinner1 = ora('检查 VSCode 安装状态...').start();
  const vscodeStatus = checkVSCodeInstalled();
  
  if (vscodeStatus.installed) {
    spinner1.succeed('VSCode 已安装 ✓');
    console.log(chalk.gray(`   版本: ${vscodeStatus.version}`));
    console.log(chalk.gray(`   架构: ${vscodeStatus.arch}`));
  } else {
    spinner1.fail('VSCode 未安装或不在 PATH 中');
    console.log(chalk.yellow('   请先安装 VSCode: https://code.visualstudio.com/'));
    return;
  }
  
  console.log('');
  
  // 2. 检查配置文件
  const spinner2 = ora('检查配置文件...').start();
  const configFiles = checkConfigFiles();
  spinner2.succeed('配置文件检查完成 ✓');
  
  console.log(chalk.blue('📁 配置文件状态:'));
  const configDir = getVSCodeConfigDir();
  console.log(chalk.gray(`   配置目录: ${configDir}`));
  
  Object.entries(configFiles).forEach(([file, status]) => {
    if (status.exists) {
      const sizeStr = status.isDirectory ? '目录' : formatSize(status.size);
      const timeStr = formatDate(status.modified);
      console.log(chalk.green(`   ✓ ${file} (${sizeStr}, 修改于 ${timeStr})`));
    } else {
      console.log(chalk.yellow(`   ✗ ${file} (不存在)`));
    }
  });
  
  console.log('');
  
  // 3. 检查已安装扩展
  const spinner3 = ora('检查已安装扩展...').start();
  const extensions = getInstalledExtensions(vscodeStatus.paths);
  spinner3.succeed(`扩展检查完成 (${extensions.length} 个已安装) ✓`);
  
  if (extensions.length > 0) {
    console.log(chalk.blue('🧩 已安装扩展 (显示前10个):'));
    extensions.slice(0, 10).forEach(ext => {
      console.log(chalk.gray(`   • ${ext.name}@${ext.version}`));
    });
    
    if (extensions.length > 10) {
      console.log(chalk.gray(`   ... 还有 ${extensions.length - 10} 个扩展`));
    }
  } else {
    console.log(chalk.yellow('🧩 未安装任何扩展'));
  }
  
  console.log('');
  
  // 4. 检查备份
  const spinner4 = ora('检查配置备份...').start();
  const backups = checkBackups();
  spinner4.succeed(`备份检查完成 (${backups.length} 个备份) ✓`);
  
  if (backups.length > 0) {
    console.log(chalk.blue('💾 配置备份:'));
    backups.slice(0, 5).forEach(backup => {
      const timeStr = formatDate(backup.date);
      const sizeStr = formatSize(backup.size);
      console.log(chalk.gray(`   • ${backup.name} (${sizeStr}, ${timeStr})`));
    });
    
    if (backups.length > 5) {
      console.log(chalk.gray(`   ... 还有 ${backups.length - 5} 个备份`));
      console.log(chalk.gray(`   使用 'vscode-config clean' 清理旧备份`));
    }
  } else {
    console.log(chalk.yellow('💾 无配置备份'));
  }
  
  console.log('');
  
  // 5. 系统信息
  console.log(chalk.blue('💻 系统信息:'));
  console.log(chalk.gray(`   操作系统: ${os.type()} ${os.release()}`));
  console.log(chalk.gray(`   架构: ${os.arch()}`));
  console.log(chalk.gray(`   Node.js: ${process.version}`));
  
  console.log('');
  console.log(chalk.green('✅ 状态检查完成！'));
}

module.exports = {
  checkStatus,
  getVSCodeConfigDir,
  checkVSCodeInstalled,
  getInstalledExtensions,
  checkConfigFiles,
  checkBackups
};