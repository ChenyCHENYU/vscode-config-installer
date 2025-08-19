#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const { installConfig } = require('../lib/installer');

// 版本信息
const packageJson = require('../package.json');

program
  .name('vscode-config')
  .description('一键安装 VSCode 配置工具')
  .version(packageJson.version);

// install 命令
program
  .command('install')
  .description('安装最新的 VSCode 配置')
  .option('--force', '强制安装，跳过确认提示')
  .option('--timeout <seconds>', '扩展安装超时时间（秒）', '30')
  .action(async (options) => {
    try {
      console.log(chalk.cyan.bold('🚀 VSCode 配置安装工具'));
      console.log(chalk.gray('======================================='));
      console.log(chalk.gray(`版本: ${packageJson.version}`));
      console.log('');
      
      await installConfig(options);
      
      console.log('');
      console.log(chalk.green.bold('🎉 配置安装完成！'));
      console.log(chalk.gray('请重启 VSCode 以应用所有更改。'));
      console.log('');
      console.log(chalk.blue('💡 小贴士:'));
      console.log(chalk.gray('  • 随时运行此命令获取最新配置'));
      console.log(chalk.gray('  • 您的原配置已自动备份'));
      
    } catch (error) {
      console.error('');
      console.error(chalk.red.bold('❌ 安装失败:'));
      console.error(chalk.red(error.message));
      console.error('');
      console.error(chalk.yellow('💡 故障排除:'));
      console.error(chalk.gray('  • 检查网络连接是否正常'));
      console.error(chalk.gray('  • 确保已安装 Git 和 VSCode'));
      console.error(chalk.gray('  • 网络较慢时可尝试 --timeout 60'));
      process.exit(1);
    }
  });

// 默认显示帮助
program
  .command('*', { hidden: true })
  .action(() => {
    console.log(chalk.yellow('未知命令。使用 --help 查看可用命令。'));
    program.help();
  });

// 如果没有参数，显示帮助
if (process.argv.length <= 2) {
  console.log(chalk.cyan.bold('🚀 VSCode 配置安装工具'));
  console.log('');
  console.log(chalk.gray('快速开始:'));
  console.log(chalk.white('  vscode-config install'));
  console.log('');
  program.help();
}

program.parse();