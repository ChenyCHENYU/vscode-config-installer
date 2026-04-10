const fs = require('fs');
const path = require('path');
const os = require('os');
const chalk = require('chalk');
const ora = require('ora');
const { detectVSCodePaths, runCli, getVSCodeConfigDir: getConfigDir } = require('./installer');
const ui = require('./ui');

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
  const pkg = require('../package.json');
  ui.banner(pkg.version);
  
  // 1. 检查VSCode安装状态
  const spinner1 = ora('检查 VSCode 安装状态...').start();
  const vscodeStatus = checkVSCodeInstalled();
  
  if (vscodeStatus.installed) {
    spinner1.succeed('VSCode 已安装');
    ui.kv('版本', vscodeStatus.version);
    ui.kv('架构', vscodeStatus.arch);
  } else {
    spinner1.fail('VSCode 未安装或不在 PATH 中');
    ui.warnBox('未检测到 VSCode', ['请先安装: https://code.visualstudio.com/']);
    return;
  }
  console.log('');
  
  // 2. 检查配置文件
  const spinner2 = ora('检查配置文件...').start();
  const configFiles = checkConfigFiles();
  spinner2.succeed('配置文件检查完成');

  ui.section('📁', '配置文件');
  const configDir = getVSCodeConfigDir();
  ui.kv('配置目录', configDir);
  const cfgTable = ui.createTable([chalk.white('文件'), chalk.white('大小'), chalk.white('修改时间'), chalk.white('状态')], [22, 10, 16, 10]);
  Object.entries(configFiles).forEach(([file, status]) => {
    if (status.exists) {
      const sizeStr = status.isDirectory ? '目录' : formatSize(status.size);
      const timeStr = formatDate(status.modified);
      cfgTable.push([file, sizeStr, timeStr, chalk.green('✓ 存在')]);
    } else {
      cfgTable.push([file, '-', '-', chalk.yellow('✗ 缺失')]);
    }
  });
  console.log(cfgTable.toString());
  console.log('');
  
  // 3. 检查已安装扩展
  const spinner3 = ora('检查已安装扩展...').start();
  const extensions = getInstalledExtensions(vscodeStatus.paths);
  spinner3.succeed(`已安装 ${extensions.length} 个扩展`);

  if (extensions.length > 0) {
    ui.section('🧩', `已安装扩展 (前 ${Math.min(extensions.length, 15)} 个)`);
    const extTable = ui.createTable([chalk.white('#'), chalk.white('扩展名'), chalk.white('版本')], [5, 40, 14]);
    extensions.slice(0, 15).forEach((ext, i) => {
      extTable.push([chalk.gray(String(i + 1)), ext.name, chalk.cyan(ext.version)]);
    });
    console.log(extTable.toString());
    if (extensions.length > 15) {
      console.log(chalk.gray(`  ... 还有 ${extensions.length - 15} 个扩展`));
    }
  } else {
    console.log(chalk.yellow('  未安装任何扩展'));
  }
  console.log('');
  
  // 4. 检查备份
  const spinner4 = ora('检查配置备份...').start();
  const backups = checkBackups();
  spinner4.succeed(`发现 ${backups.length} 个备份`);

  if (backups.length > 0) {
    ui.section('💾', '配置备份');
    const bkTable = ui.createTable([chalk.white('备份名'), chalk.white('大小'), chalk.white('时间')], [28, 10, 16]);
    backups.slice(0, 5).forEach(backup => {
      bkTable.push([backup.name, formatSize(backup.size), formatDate(backup.date)]);
    });
    console.log(bkTable.toString());
    if (backups.length > 5) {
      console.log(chalk.gray(`  ... 还有 ${backups.length - 5} 个备份 (vscode-config clean 清理)`));
    }
  } else {
    console.log(chalk.yellow('  无配置备份'));
  }
  console.log('');
  
  // 5. 系统信息
  ui.section('💻', '系统信息');
  ui.kv('操作系统', `${os.type()} ${os.release()}`);
  ui.kv('架构', os.arch());
  ui.kv('Node.js', process.version);
  console.log('');

  ui.successBox('状态检查完成', [
    `VSCode ${vscodeStatus.version}`,
    `${extensions.length} 个扩展已安装`,
    `${backups.length} 个备份可用`,
  ]);
}

module.exports = {
  checkStatus,
  getVSCodeConfigDir,
  checkVSCodeInstalled,
  getInstalledExtensions,
  checkConfigFiles,
  checkBackups
};