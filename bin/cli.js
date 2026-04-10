#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const { installConfig, CONFIG_SOURCES } = require('../lib/installer');
const prompts = require('prompts');
const ui = require('../lib/ui');

const packageJson = require('../package.json');

async function selectInstallMode() {
  console.log('');
  const response = await prompts({
    type: 'select',
    name: 'mode',
    message: '选择安装模式',
    choices: [
      { title: `${chalk.cyan('覆盖模式')} ${chalk.gray('(override)')}  完全替换，确保团队一致`, value: 'override' },
      { title: `${chalk.yellow('合并模式')} ${chalk.gray('(merge)')}     保留个人设置，只同步团队配置`, value: 'merge' },
    ],
    initial: 0,
  });
  if (response.mode === undefined) {
    // 用户按 Ctrl+C 取消
    console.log(chalk.yellow('\n  已取消'));
    process.exit(0);
  }
  return response.mode;
}

program
  .name('vscode-config')
  .description('一键安装 VSCode 配置工具（支持覆盖模式和扩展模式）')
  .version(packageJson.version);

// install 命令
program
  .command('install')
  .description('安装最新的 VSCode 配置（支持覆盖模式和扩展模式）')
  .option('--force', '强制安装，跳过备份确认')
  .option('--timeout <seconds>', '扩展安装超时时间（秒）', '30')
  .option('--source <name>', '指定配置源 (github|gitee)', '')
  .option('--dry-run', '预览模式，不实际安装')
  .option('--mode <mode>', '安装模式 (override|merge)', 'override')
  .action(async (options) => {
    try {
      ui.banner(packageJson.version);

      if (options.dryRun) {
        console.log(chalk.yellow('  🔍 预览模式 — 不会实际安装'));
        console.log('');
      }
      
      if (!options.dryRun && !options.force && (!options.mode || options.mode === 'override')) {
        if (!process.argv.includes('--mode')) {
          options.mode = await selectInstallMode();
          console.log(`  ${ui.symbols.success} ${chalk.green(`已选择: ${options.mode === 'override' ? '覆盖模式' : '合并模式'}`)}`);
        }
      }
      
      await installConfig(options);
      
      if (options.dryRun) return;

      console.log('');
      ui.infoBox('下一步', [
        process.env.TERM_PROGRAM === 'vscode'
          ? chalk.white('按 Ctrl+Shift+P → "Reload Window" 重新加载')
          : chalk.white('重启 VSCode 以应用所有更改'),
        chalk.gray('运行 vscode-config status 查看状态'),
        chalk.gray('出问题? → vscode-config restore 恢复备份'),
      ]);
      
    } catch (error) {
      console.error('');
      const lines = [chalk.red(error.message)];
      if (error.message.includes('不可用') || error.message.includes('超时')) {
        lines.push('', chalk.yellow('网络问题:'), chalk.gray('  --source gitee  使用国内源'), chalk.gray('  --timeout 60    增加超时'));
      } else if (error.message.includes('VS Code') || error.message.includes('VSCode')) {
        lines.push('', chalk.yellow('VS Code 问题:'), chalk.gray('  确认已安装且 code 在 PATH 中'));
      } else if (error.message.includes('Git')) {
        lines.push('', chalk.yellow('Git 问题:'), chalk.gray('  确认 Git 已安装且在 PATH 中'));
      }
      ui.errorBox('安装失败', lines);
      process.exit(1);
    }
  });

// status 命令 - 检查当前配置状态
program
  .command('status')
  .description('检查当前 VSCode 配置状态')
  .action(async () => {
    const { checkStatus } = require('../lib/status');
    try {
      await checkStatus();
    } catch (error) {
      console.error(chalk.red(`状态检查失败: ${error.message}`));
      process.exit(1);
    }
  });

// restore 命令 - 恢复备份
program
  .command('restore')
  .description('恢复之前备份的配置')
  .option('--list', '列出可用的备份')
  .option('--backup <path>', '指定要恢复的备份路径')
  .action(async (options) => {
    const { restoreBackup } = require('../lib/backup');
    try {
      await restoreBackup(options);
    } catch (error) {
      console.error(chalk.red(`恢复失败: ${error.message}`));
      process.exit(1);
    }
  });

// clean 命令 - 清理旧备份
program
  .command('clean')
  .description('清理旧的配置备份')
  .option('--older-than <days>', '删除超过指定天数的备份', '30')
  .action(async (options) => {
    const { cleanOldBackups } = require('../lib/backup');
    try {
      await cleanOldBackups(options);
    } catch (error) {
      console.error(chalk.red(`清理失败: ${error.message}`));
      process.exit(1);
    }
  });

// upload 命令 - 上传本地配置到远程仓库
program
  .command('upload')
  .description('将本地 VS Code 配置上传到团队配置仓库')
  .option('--mode <mode>', '上传模式: override(覆盖) | merge(合并)', '')
  .option('--repo <path>', '本地配置仓库路径（默认自动 clone 到临时目录）')
  .option('--source <name>', '配置源 (github|gitee|all)', 'all')
  .action(async (options) => {
    const { uploadConfig } = require('../lib/uploader');
    try {
      ui.banner(packageJson.version);
      // 如果没指定模式，交互选择
      if (!options.mode) {
        const response = await prompts({
          type: 'select',
          name: 'mode',
          message: '选择上传模式',
          choices: [
            { title: `${chalk.cyan('覆盖模式')} ${chalk.gray('(override)')}  远程完全替换为我的配置`, value: 'override' },
            { title: `${chalk.yellow('合并模式')} ${chalk.gray('(merge)')}     保留远程已有，仅追加我新增的`, value: 'merge' },
          ],
          initial: 0,
        });
        if (response.mode === undefined) {
          console.log(chalk.yellow('\n  已取消'));
          process.exit(0);
        }
        options.mode = response.mode;
      }
      await uploadConfig(options);
    } catch (error) {
      console.error('');
      ui.errorBox('上传失败', [chalk.red(error.message)]);
      process.exit(1);
    }
  });

// 全局选项
program
  .option('-v, --verbose', '显示详细日志')
  .option('-q, --quiet', '静默模式')
  .hook('preAction', (thisCommand) => {
    // 设置全局日志级别
    if (thisCommand.opts().verbose) {
      process.env.LOG_LEVEL = 'verbose';
    } else if (thisCommand.opts().quiet) {
      process.env.LOG_LEVEL = 'quiet';
    }
  });

// 未知命令处理（commander v9+ 推荐用 addHelpCommand + exitOverride）
program.on('command:*', () => {
  const unknownCmd = program.args[0];
  console.log(chalk.yellow(`未知命令: ${unknownCmd}`));
  console.log(chalk.gray('使用 --help 查看可用命令。'));
  process.exit(1);
});

// 如果没有参数，显示帮助和快速开始
if (process.argv.length <= 2) {
  console.log(chalk.cyan.bold('🚀 VSCode 配置安装工具'));
  console.log(chalk.gray(`版本 ${packageJson.version} | 支持双源加速和双模式安装`));
  console.log('');
  console.log(chalk.blue('⚡ 快速开始:'));
  console.log(chalk.white('  vscode-config install               # 安装团队配置（箭头键选模式）'));
  console.log(chalk.white('  vscode-config install --mode merge   # 保留个人设置，合并团队配置'));
  console.log(chalk.white('  vscode-config upload                 # 上传本地配置到团队仓库'));
  console.log(chalk.white('  vscode-config status                 # 检查配置状态'));
  console.log(chalk.white('  vscode-config restore                # 一键恢复到安装前'));
  console.log('');
  console.log(chalk.gray('使用 --help 查看所有命令和选项'));
  console.log('');
  process.exit(0);
}

// 添加全局错误处理
process.on('uncaughtException', (error) => {
  console.error(chalk.red.bold('💥 未捕获的异常:'));
  console.error(chalk.red(error.stack));
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red.bold('💥 未处理的Promise拒绝:'));
  console.error(chalk.red(reason));
  process.exit(1);
});

program.parse();