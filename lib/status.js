const fs = require('fs');
const path = require('path');
const os = require('os');
const chalk = require('chalk');
const ora = require('ora');
const {
  detectEditorPaths,
  runCli,
  getEditorConfigDir,
} = require('./installer');
const { EDITOR_REGISTRY } = require('./editors');
const { getConfigPaths, resolveSources, resolveRepos } = require('./config');
const ui = require('./ui');

function checkEditorInstalled(editorKey) {
  const paths = detectEditorPaths(editorKey);
  if (!paths) return { installed: false };
  const result = runCli(paths, '--version', 10000);
  if (!result.ok && !result.stdout) return { installed: false };
  const lines = (result.stdout || '').trim().split('\n');
  return {
    installed: true,
    version: lines[0],
    commit: lines[1],
    arch: lines[2],
    paths,
    editorKey,
  };
}

function getInstalledExtensions(editorPaths) {
  if (!editorPaths) return [];
  const result = runCli(
    editorPaths,
    '--list-extensions --show-versions',
    15000
  );
  if (!result.ok && !result.stdout) return [];
  return (result.stdout || '')
    .trim()
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      const [name, version] = line.split('@');
      return { name, version: version || 'unknown' };
    });
}

/**
 * 检查配置文件状态
 */
function checkConfigFiles(editorKey) {
  const configDir = getEditorConfigDir(editorKey);
  const configFiles = ['settings.json', 'keybindings.json', 'snippets'];

  const status = {};

  for (const file of configFiles) {
    const filePath = path.join(configDir, file);

    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      status[file] = {
        exists: true,
        size: stats.size,
        modified: stats.mtime,
        isDirectory: stats.isDirectory(),
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
function checkBackups(editorKey) {
  const configDir = getEditorConfigDir(editorKey);
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
            size: getDirSize(backupPath),
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
 * 主状态检查函数
 */
async function checkStatus(editorKey = 'vscode') {
  const reg = EDITOR_REGISTRY[editorKey];
  if (!reg) {
    console.log(
      chalk.red(
        `未知编辑器: ${editorKey}。可用: ${Object.keys(EDITOR_REGISTRY).join(', ')}`
      )
    );
    return;
  }
  const editorLabel = reg.label;

  const pkg = require('../package.json');
  ui.banner(pkg.version);

  // 1. 检查编辑器安装状态
  const spinner1 = ora(`检查 ${editorLabel} 安装状态...`).start();
  const editorStatus = checkEditorInstalled(editorKey);

  if (editorStatus.installed) {
    spinner1.succeed(`${editorLabel} 已安装`);
    ui.kv('版本', editorStatus.version);
    ui.kv('架构', editorStatus.arch);
  } else {
    spinner1.fail(`${editorLabel} 未安装或不在 PATH 中`);
    ui.warnBox(`未检测到 ${editorLabel}`, [`请先安装: ${reg.website}`]);
    return;
  }
  console.log('');

  // 2. 检查配置文件
  const spinner2 = ora('检查配置文件...').start();
  const configFiles = checkConfigFiles(editorKey);
  spinner2.succeed('配置文件检查完成');

  ui.section(ui.icons.folder, '配置文件');
  const configDir = getEditorConfigDir(editorKey);
  ui.kv('配置目录', configDir);
  const cfgTable = ui.createTable(
    [
      chalk.white('文件'),
      chalk.white('大小'),
      chalk.white('修改时间'),
      chalk.white('状态'),
    ],
    [22, 10, 16, 10]
  );
  Object.entries(configFiles).forEach(([file, status]) => {
    if (status.exists) {
      const sizeStr = status.isDirectory ? '目录' : ui.formatSize(status.size);
      const timeStr = ui.formatDate(status.modified);
      cfgTable.push([
        file,
        sizeStr,
        timeStr,
        chalk.green(`${ui.icons.success} 存在`),
      ]);
    } else {
      cfgTable.push([file, '-', '-', chalk.yellow(`${ui.icons.error} 缺失`)]);
    }
  });
  console.log(cfgTable.toString());
  console.log('');

  // 3. 检查已安装扩展
  const spinner3 = ora('检查已安装扩展...').start();
  const extensions = getInstalledExtensions(editorStatus.paths);
  spinner3.succeed(`已安装 ${extensions.length} 个扩展`);

  if (extensions.length > 0) {
    ui.section(
      ui.icons.puzzle,
      `已安装扩展 (前 ${Math.min(extensions.length, 15)} 个)`
    );
    const extTable = ui.createTable(
      [chalk.white('#'), chalk.white('扩展名'), chalk.white('版本')],
      [5, 40, 14]
    );
    extensions.slice(0, 15).forEach((ext, i) => {
      extTable.push([
        chalk.gray(String(i + 1)),
        ext.name,
        chalk.cyan(ext.version),
      ]);
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
  const backups = checkBackups(editorKey);
  spinner4.succeed(`发现 ${backups.length} 个备份`);

  if (backups.length > 0) {
    ui.section(ui.icons.disk, '配置备份');
    const bkTable = ui.createTable(
      [chalk.white('备份名'), chalk.white('大小'), chalk.white('时间')],
      [28, 10, 16]
    );
    backups.slice(0, 5).forEach(backup => {
      bkTable.push([
        backup.name,
        ui.formatSize(backup.size),
        ui.formatDate(backup.date),
      ]);
    });
    console.log(bkTable.toString());
    if (backups.length > 5) {
      console.log(
        chalk.gray(
          `  ... 还有 ${backups.length - 5} 个备份 (vscode-config clean 清理)`
        )
      );
    }
  } else {
    console.log(chalk.yellow('  无配置备份'));
  }
  console.log('');

  // 5. 配置来源
  ui.section(ui.icons.gear, '配置来源');
  const configPaths = getConfigPaths();
  if (configPaths.project) {
    ui.kv('项目配置', configPaths.project);
  } else {
    ui.kv('项目配置', chalk.gray('未找到'));
  }
  if (configPaths.home) {
    ui.kv('用户配置', configPaths.home);
  } else {
    ui.kv('用户配置', chalk.gray('未找到'));
  }
  const activeSources = resolveSources();
  ui.kv(
    '配置源',
    activeSources.map(s => `${s.name} (${s.baseUrl})`).join(', ')
  );
  const activeRepos = resolveRepos();
  const repoEntries = Object.entries(activeRepos).filter(
    ([k]) => k !== 'primary' && k !== 'fallback'
  );
  ui.kv('仓库地址', repoEntries.map(([k, v]) => `${k}: ${v}`).join(', '));
  console.log('');

  // 6. 系统信息
  ui.section(ui.icons.computer, '系统信息');
  ui.kv('操作系统', `${os.type()} ${os.release()}`);
  ui.kv('架构', os.arch());
  ui.kv('Node.js', process.version);
  console.log('');

  ui.successBox('状态检查完成', [
    `${editorLabel} ${editorStatus.version}`,
    `${extensions.length} 个扩展已安装`,
    `${backups.length} 个备份可用`,
  ]);
}

module.exports = {
  checkStatus,
  getEditorConfigDir,
  checkEditorInstalled,
  getInstalledExtensions,
  checkConfigFiles,
  checkBackups,
};
