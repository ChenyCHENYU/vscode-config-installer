const fs = require("fs");
const path = require("path");
const chalk = require("chalk");
const ora = require("ora");
const readline = require("readline");
const { getVSCodeConfigDir, checkBackups } = require("./status");

/**
 * 列出所有可用备份
 */
function listBackups() {
  const backups = checkBackups();

  if (backups.length === 0) {
    console.log(chalk.yellow("📁 未找到任何配置备份"));
    return [];
  }

  console.log(chalk.blue("📁 可用的配置备份:"));
  console.log("");

  backups.forEach((backup, index) => {
    const timeStr = formatDate(backup.date);
    const sizeStr = formatSize(backup.size);
    const isRecent = Date.now() - backup.date < 24 * 60 * 60 * 1000; // 24小时内

    const marker = isRecent ? chalk.green("●") : chalk.gray("○");
    console.log(`${marker} ${chalk.cyan(`[${index + 1}]`)} ${backup.name}`);
    console.log(`    时间: ${timeStr}`);
    console.log(`    大小: ${sizeStr}`);
    console.log(`    路径: ${chalk.gray(backup.path)}`);
    console.log("");
  });

  return backups;
}

/**
 * 格式化文件大小
 */
function formatSize(bytes) {
  const units = ["B", "KB", "MB", "GB"];
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
    return "昨天";
  } else if (days < 30) {
    return `${days} 天前`;
  } else {
    return date.toLocaleDateString("zh-CN");
  }
}

/**
 * 复制文件或目录
 */
function copyRecursive(source, destination) {
  const stats = fs.statSync(source);

  if (stats.isDirectory()) {
    // 创建目标目录
    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, { recursive: true });
    }

    // 复制目录内容
    const items = fs.readdirSync(source);
    for (const item of items) {
      const sourcePath = path.join(source, item);
      const destPath = path.join(destination, item);
      copyRecursive(sourcePath, destPath);
    }
  } else {
    // 复制文件
    const destDir = path.dirname(destination);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(source, destination);
  }
}

/**
 * 恢复指定备份
 */
function restoreFromBackup(backupPath) {
  const configDir = getVSCodeConfigDir();
  const filesToRestore = ["settings.json", "keybindings.json", "snippets"];

  let restoredFiles = [];

  for (const file of filesToRestore) {
    const backupFilePath = path.join(backupPath, file);
    const targetPath = path.join(configDir, file);

    if (fs.existsSync(backupFilePath)) {
      try {
        // 备份当前文件（如果存在）
        if (fs.existsSync(targetPath)) {
          const tempBackup = `${targetPath}.temp-backup-${Date.now()}`;
          copyRecursive(targetPath, tempBackup);
        }

        // 恢复文件
        copyRecursive(backupFilePath, targetPath);
        restoredFiles.push(file);
      } catch (error) {
        throw new Error(`恢复 ${file} 失败: ${error.message}`);
      }
    }
  }

  return restoredFiles;
}

/**
 * 恢复备份的主函数
 */
async function restoreBackup(options = {}) {
  console.log(chalk.cyan.bold("🔄 恢复 VSCode 配置备份"));
  console.log(chalk.gray("======================================="));
  console.log("");

  // 如果只是列出备份
  if (options.list) {
    listBackups();
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

    console.log(chalk.blue(`📁 使用指定备份: ${targetBackup.name}`));
  } else {
    // 列出备份让用户选择
    const backups = listBackups();

    if (backups.length === 0) {
      console.log(
        chalk.yellow("💡 提示: 运行 vscode-config install 来创建新的配置")
      );
      return;
    }

    // 默认使用最新备份
    targetBackup = backups[0];
    console.log(chalk.blue(`📁 自动选择最新备份: ${targetBackup.name}`));
    console.log(chalk.gray(`   时间: ${formatDate(targetBackup.date)}`));

    // 如果有多个备份，让用户交互式选择
    if (backups.length > 1) {
      console.log("");
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise((resolve) => {
        rl.question(
          chalk.green(
            `请输入要恢复的备份编号 (1-${backups.length}) [默认: 1]: `
          ),
          (ans) => {
            rl.close();
            resolve(ans.trim());
          }
        );
      });

      if (answer) {
        const idx = parseInt(answer, 10) - 1;
        if (idx >= 0 && idx < backups.length) {
          targetBackup = backups[idx];
          console.log(chalk.green(`✅ 已选择: ${targetBackup.name}`));
        } else {
          console.log(chalk.yellow("输入无效，使用最新备份"));
        }
      }
    }
  }

  console.log("");

  // 执行恢复
  const spinner = ora("恢复配置中...").start();

  try {
    const restoredFiles = restoreFromBackup(targetBackup.path);

    spinner.succeed("配置恢复完成 ✓");

    console.log("");
    console.log(chalk.green("✅ 恢复成功！"));
    console.log(chalk.blue("📁 已恢复的文件:"));

    restoredFiles.forEach((file) => {
      console.log(chalk.gray(`   • ${file}`));
    });

    if (restoredFiles.length === 0) {
      console.log(chalk.yellow("   (备份中没有找到可恢复的配置文件)"));
    }

    console.log("");
    console.log(chalk.blue("🔄 下一步操作:"));
    console.log(chalk.gray("   • 重启 VSCode 以应用恢复的配置"));
    console.log(chalk.gray("   • 检查配置是否符合预期"));
  } catch (error) {
    spinner.fail("恢复失败");
    throw error;
  }
}

/**
 * 清理旧备份
 */
async function cleanOldBackups(options = {}) {
  console.log(chalk.cyan.bold("🧹 清理旧的配置备份"));
  console.log(chalk.gray("======================================="));
  console.log("");

  const olderThanDays = parseInt(options.olderThan) || 30;
  const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  console.log(
    chalk.blue(
      `🗓️  清理 ${olderThanDays} 天前的备份 (${cutoffDate.toLocaleDateString(
        "zh-CN"
      )} 之前)`
    )
  );
  console.log("");

  const spinner = ora("扫描备份文件...").start();
  const backups = checkBackups();
  spinner.succeed(`找到 ${backups.length} 个备份 ✓`);

  if (backups.length === 0) {
    console.log(chalk.yellow("📁 未找到任何备份文件"));
    return;
  }

  // 筛选需要清理的备份
  const oldBackups = backups.filter((backup) => backup.date < cutoffDate);
  const keepBackups = backups.filter((backup) => backup.date >= cutoffDate);

  console.log("");
  console.log(chalk.blue("📊 备份分析:"));
  console.log(chalk.gray(`   总备份数: ${backups.length}`));
  console.log(chalk.gray(`   保留备份: ${keepBackups.length}`));
  console.log(chalk.red(`   待删除: ${oldBackups.length}`));

  if (oldBackups.length === 0) {
    console.log("");
    console.log(chalk.green("✅ 无需清理，所有备份都是最近的！"));
    return;
  }

  // 计算释放的空间
  const totalSize = oldBackups.reduce((sum, backup) => sum + backup.size, 0);

  console.log("");
  console.log(chalk.yellow("🗑️  待删除的备份:"));
  oldBackups.forEach((backup) => {
    const timeStr = formatDate(backup.date);
    const sizeStr = formatSize(backup.size);
    console.log(chalk.gray(`   • ${backup.name} (${sizeStr}, ${timeStr})`));
  });

  console.log("");
  console.log(chalk.blue(`💾 将释放空间: ${formatSize(totalSize)}`));

  // 执行清理
  const cleanSpinner = ora("删除旧备份...").start();
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
    cleanSpinner.succeed(`清理完成，删除 ${deletedCount} 个备份 ✓`);
  } else {
    cleanSpinner.warn(
      `清理完成，删除 ${deletedCount} 个，失败 ${failedCount} 个`
    );
  }

  console.log("");
  console.log(chalk.green(`✅ 清理完成！释放了 ${formatSize(totalSize)} 空间`));

  if (keepBackups.length > 0) {
    console.log(chalk.blue(`📁 保留了 ${keepBackups.length} 个最近的备份`));
  }
}

module.exports = {
  restoreBackup,
  cleanOldBackups,
  listBackups,
};
