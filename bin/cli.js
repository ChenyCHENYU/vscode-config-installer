#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const { installConfig, CONFIG_SOURCES } = require('../lib/installer');

// 版本信息
const packageJson = require('../package.json');

program
  .name('vscode-config')
  .description('一键安装 VSCode 配置工具（支持国内镜像加速）')
  .version(packageJson.version);

// install 命令
program
  .command('install')
  .description('安装最新的 VSCode 配置')
  .option('--force', '强制安装，跳过备份确认')
  .option('--timeout <seconds>', '扩展安装超时时间（秒）', '30')
  .option('--source <name>', '指定配置源 (github|gitee)', '')
  .option('--dry-run', '预览模式，不实际安装')
  .action(async (options) => {
    try {
      console.log(chalk.cyan.bold('🚀 VSCode 配置安装工具'));
      console.log(chalk.gray('======================================='));
      console.log(chalk.gray(`版本: ${packageJson.version}`));
      console.log(chalk.gray(`配置源: ${CONFIG_SOURCES.map(s => s.name).join(' → ')}`));
      console.log('');
      
      // 预览模式
      if (options.dryRun) {
        console.log(chalk.yellow('🔍 预览模式 - 不会实际安装'));
        console.log('');
      }
      
      await installConfig(options);
      
      console.log('');
      console.log(chalk.green.bold('🎉 配置安装完成！'));
      console.log('');
      console.log(chalk.blue('🔄 下一步操作:'));
      console.log(chalk.gray('  1. 重启 VSCode 以应用所有更改'));
      console.log(chalk.gray('  2. 检查扩展是否正常工作'));
      console.log(chalk.gray('  3. 如有问题可查看备份文件'));
      console.log('');
      console.log(chalk.blue('💡 使用技巧:'));
      console.log(chalk.gray('  • 运行 vscode-config status 查看安装状态'));
      console.log(chalk.gray('  • 网络慢时使用 --timeout 60 增加超时时间'));
      console.log(chalk.gray('  • 使用 --source gitee 指定国内源'));
      
    } catch (error) {
      console.error('');
      console.error(chalk.red.bold('❌ 安装失败:'));
      console.error(chalk.red(error.message));
      console.error('');
      
      // 智能错误提示
      if (error.message.includes('不可用') || error.message.includes('超时')) {
        console.error(chalk.yellow('🌐 网络问题排查:'));
        console.error(chalk.gray('  • 检查网络连接是否正常'));
        console.error(chalk.gray('  • 尝试使用国内源: --source gitee'));
        console.error(chalk.gray('  • 增加超时时间: --timeout 60'));
      } else if (error.message.includes('VSCode')) {
        console.error(chalk.yellow('📝 VSCode 问题排查:'));
        console.error(chalk.gray('  • 确认 VSCode 已正确安装'));
        console.error(chalk.gray('  • 确认 code 命令在 PATH 中'));
        console.error(chalk.gray('  • 尝试重新安装 VSCode'));
      } else if (error.message.includes('Git')) {
        console.error(chalk.yellow('🔧 Git 问题排查:'));
        console.error(chalk.gray('  • 确认 Git 已正确安装'));
        console.error(chalk.gray('  • 确认 git 命令在 PATH 中'));
      } else {
        console.error(chalk.yellow('💡 通用故障排查:'));
        console.error(chalk.gray('  • 检查磁盘空间是否充足'));
        console.error(chalk.gray('  • 尝试以管理员身份运行'));
        console.error(chalk.gray('  • 关闭杀毒软件后重试'));
      }
      
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

// 默认显示帮助
program
  .command('*', { hidden: true })
  .action((cmd) => {
    console.log(chalk.yellow(`未知命令: ${cmd}`));
    console.log(chalk.gray('使用 --help 查看可用命令。'));
    program.help();
  });

// 如果没有参数，显示帮助和快速开始
if (process.argv.length <= 2) {
  console.log(chalk.cyan.bold('🚀 VSCode 配置安装工具'));
  console.log(chalk.gray(`版本 ${packageJson.version} | 支持双源加速`));
  console.log('');
  console.log(chalk.blue('⚡ 快速开始:'));
  console.log(chalk.white('  vscode-config install          # 安装最新配置'));
  console.log(chalk.white('  vscode-config install --source gitee  # 使用国内源'));
  console.log(chalk.white('  vscode-config status            # 检查配置状态'));
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