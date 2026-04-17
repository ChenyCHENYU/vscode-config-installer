const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const prompts = require('prompts');
const { getEditorConfigDir, checkBackups } = require('./status');
const { EDITOR_REGISTRY } = require('./editors');
const ui = require('./ui');

/**
 * 列出所有可用备份
 */
function listBackups(editorKey) {
  const backups = checkBackups(editorKey);

  if (backups.length === 0) {
    ui.warnBox('无备份', ['未找到任何配置备份']);
    return [];
  }

  ui.section(ui.icons.folder, `可用备份 (${backups.length} 个)`);
  const table = ui.createTable(
    [
      chalk.white('#'),
      chalk.white('备份名'),
      chalk.white('大小'),
      chalk.white('时间'),
    ],
    [5, 28, 10, 16]
  );
  backups.forEach((backup, index) => {
    const isRecent = Date.now() - backup.date < 24 * 60 * 60 * 1000;
    const marker = isRecent ? chalk.green('●') : chalk.gray('○');
    table.push([
      `${marker} ${index + 1}`,
      backup.name,
      ui.formatSize(backup.size),
      ui.formatDate(backup.date),
    ]);
  });
  console.log(table.toString());
  console.log('');

  return backups;
}

/**
 * 恢复指定备份到编辑器配置目录
 * @param {string} backupPath - 备份目录路径
 * @param {string} editorKey - 编辑器标识 (vscode|cursor|windsurf|kiro)
 * @returns {string[]} 已恢复的文件名列表
 * @throws {Error} 恢复失败时抛出
 */
function restoreFromBackup(backupPath, editorKey) {
  const configDir = getEditorConfigDir(editorKey);
  const filesToRestore = ['settings.json', 'keybindings.json', 'snippets'];

  const restoredFiles = [];

  for (const file of filesToRestore) {
    const backupFilePath = path.join(backupPath, file);
    const targetPath = path.join(configDir, file);

    if (fs.existsSync(backupFilePath)) {
      try {
        // 恢复文件
        fs.cpSync(backupFilePath, targetPath, { recursive: true, force: true });
        restoredFiles.push(file);
      } catch (error) {
        throw new Error(`恢复 ${file} 失败: ${error.message}`);
      }
    }
  }

  return restoredFiles;
}

/**
 * 恢复备份的主函数（交互式）
 * @param {object} [options]
 * @param {string} [options.editor='vscode'] - 编辑器标识
 * @param {boolean} [options.list] - 列出可用备份
 * @param {string} [options.backup] - 指定备份路径
 * @returns {Promise<void>}
 */
async function restoreBackup(options = {}) {
  const editorKey = options.editor || 'vscode';
  const editorLabel = EDITOR_REGISTRY[editorKey]?.label || editorKey;

  const pkg = require('../package.json');
  ui.banner(pkg.version);
  ui.section(ui.icons.refresh, `恢复 ${editorLabel} 配置备份`);

  if (options.list) {
    listBackups(editorKey);
    return;
  }

  let targetBackup;

  // 如果指定了备份路径
  if (options.backup) {
    const backupPath = path.resolve(options.backup);

    if (!fs.existsSync(backupPath)) {
      throw new Error(`指定的备份路径不存在: ${backupPath}`);
    }

    if (!fs.statSync(backupPath).isDirectory()) {
      throw new Error(`指定的路径不是目录: ${backupPath}`);
    }

    targetBackup = {
      name: path.basename(backupPath),
      path: backupPath,
      date: fs.statSync(backupPath).mtime,
    };

    console.log(
      `  ${ui.symbols.info} ${chalk.blue(`使用指定备份: ${targetBackup.name}`)}`
    );
  } else {
    const backups = listBackups(editorKey);

    if (backups.length === 0) {
      ui.infoBox('提示', ['运行 vscode-config install 来创建新的配置']);
      return;
    }

    targetBackup = backups[0];

    if (backups.length > 1) {
      const response = await prompts({
        type: 'select',
        name: 'idx',
        message: '选择要恢复的备份',
        choices: backups.map((b, i) => ({
          title: `${b.name}  ${chalk.gray(ui.formatDate(b.date))}  ${chalk.gray(ui.formatSize(b.size))}`,
          value: i,
        })),
        initial: 0,
      });
      if (response.idx === undefined) {
        console.log(chalk.yellow('\n  已取消'));
        return;
      }
      targetBackup = backups[response.idx];
    }
    console.log(
      `  ${ui.symbols.success} ${chalk.green(`已选择: ${targetBackup.name}`)}`
    );
  }

  console.log('');

  // 执行恢复
  const spinner = ora('恢复配置中...').start();

  try {
    const restoredFiles = restoreFromBackup(targetBackup.path, editorKey);

    spinner.succeed('配置恢复完成');

    console.log('');
    const lines = restoredFiles.map(f => `${ui.symbols.success} ${f}`);
    if (restoredFiles.length === 0) {
      lines.push(chalk.yellow('备份中没有找到可恢复的配置文件'));
    }
    lines.push('', chalk.gray(`重启 ${editorLabel} 以应用恢复的配置`));
    ui.successBox('恢复成功', lines);
  } catch (error) {
    spinner.fail('恢复失败');
    throw error;
  }
}

/**
 * 清理旧备份
 * @param {object} [options]
 * @param {string} [options.editor='vscode'] - 编辑器标识
 * @param {string} [options.olderThan='30'] - 清理多少天前的备份
 * @returns {Promise<void>}
 */
async function cleanOldBackups(options = {}) {
  const editorKey = options.editor || 'vscode';
  const editorLabel = EDITOR_REGISTRY[editorKey]?.label || editorKey;

  const pkg = require('../package.json');
  ui.banner(pkg.version);
  ui.section(ui.icons.broom, `清理 ${editorLabel} 旧备份`);

  const olderThanDays = parseInt(options.olderThan) || 30;
  const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  console.log(
    chalk.blue(
      `  ${ui.icons.calendar} 清理 ${olderThanDays} 天前的备份 (${cutoffDate.toLocaleDateString('zh-CN')} 之前)`
    )
  );
  console.log('');

  const spinner = ora('扫描备份文件...').start();
  const backups = checkBackups(editorKey);
  spinner.succeed(`找到 ${backups.length} 个备份`);

  if (backups.length === 0) {
    ui.infoBox('无备份', ['未找到任何备份文件']);
    return;
  }

  const oldBackups = backups.filter(backup => backup.date < cutoffDate);
  const keepBackups = backups.filter(backup => backup.date >= cutoffDate);

  ui.kv('总备份数', String(backups.length));
  ui.kv('保留', chalk.green(String(keepBackups.length)));
  ui.kv('待删除', chalk.red(String(oldBackups.length)));

  if (oldBackups.length === 0) {
    console.log('');
    ui.successBox('无需清理', ['所有备份都是最近的']);
    return;
  }

  const totalSize = oldBackups.reduce((sum, backup) => sum + backup.size, 0);

  console.log('');
  const delTable = ui.createTable(
    [chalk.white('备份名'), chalk.white('大小'), chalk.white('时间')],
    [28, 10, 16]
  );
  oldBackups.forEach(backup => {
    delTable.push([
      backup.name,
      ui.formatSize(backup.size),
      ui.formatDate(backup.date),
    ]);
  });
  console.log(delTable.toString());
  ui.kv('将释放空间', ui.formatSize(totalSize));

  // 执行清理
  const cleanSpinner = ora('删除旧备份...').start();
  let deletedCount = 0;
  let failedCount = 0;

  for (const backup of oldBackups) {
    try {
      fs.rmSync(backup.path, { recursive: true, force: true });
      deletedCount++;
    } catch (error) {
      failedCount++;
      console.warn(
        chalk.yellow(`警告: 删除 ${backup.name} 失败: ${error.message}`)
      );
    }
  }

  if (failedCount === 0) {
    cleanSpinner.succeed(`已删除 ${deletedCount} 个备份`);
  } else {
    cleanSpinner.warn(`删除 ${deletedCount} 个，失败 ${failedCount} 个`);
  }

  console.log('');
  ui.successBox(
    '清理完成',
    [
      `释放了 ${ui.formatSize(totalSize)} 空间`,
      keepBackups.length > 0 ? `保留了 ${keepBackups.length} 个最近的备份` : '',
    ].filter(Boolean)
  );
}

module.exports = {
  restoreBackup,
  cleanOldBackups,
  listBackups,
  restoreFromBackup,
};
