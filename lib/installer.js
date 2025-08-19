const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const chalk = require('chalk');
const ora = require('ora');

// 配置仓库URL - 替换为你的实际仓库地址
const CONFIG_REPO_URL = 'https://github.com/ChenyCHENYU/vscode-config.git';

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
  } catch (error) {
    throw error;
  }
}

/**
 * 创建临时目录
 */
function createTempDir() {
  const tempDir = path.join(os.tmpdir(), `vscode-config-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

/**
 * 清理临时目录
 */
function cleanupTempDir(tempDir) {
  try {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.warn(chalk.yellow(`警告: 清理临时目录失败: ${tempDir}`));
  }
}

/**
 * 克隆配置仓库
 */
function cloneConfigRepo(tempDir) {
  const spinner = ora('下载最新配置文件...').start();
  
  try {
    // 使用浅克隆，只获取最新提交
    execSync(`git clone --depth 1 --single-branch "${CONFIG_REPO_URL}" "${tempDir}"`, {
      stdio: 'pipe',
      timeout: 60000, // 60秒超时
      encoding: 'utf8'
    });
    
    // 验证关键文件是否存在
    const setupScript = path.join(tempDir, 'setup.sh');
    if (!fs.existsSync(setupScript)) {
      throw new Error('仓库无效: 未找到 setup.sh 文件');
    }
    
    spinner.succeed('配置文件下载完成 ✓');
  } catch (error) {
    spinner.fail('配置文件下载失败');
    
    if (error.signal === 'SIGTERM' || error.code === 'TIMEOUT') {
      throw new Error('下载超时，请检查网络连接后重试。');
    }
    
    if (error.message.includes('not found') || error.message.includes('404')) {
      throw new Error('配置仓库不存在，请检查仓库地址是否正确。');
    }
    
    if (error.message.includes('authentication') || error.message.includes('403')) {
      throw new Error('配置仓库访问被拒绝，请检查仓库权限设置。');
    }
    
    throw new Error(`配置文件下载失败: ${error.message}`);
  }
}

/**
 * 运行安装脚本
 */
function runInstallScript(tempDir, options) {
  return new Promise((resolve, reject) => {
    const spinner = ora('安装 VSCode 配置...').start();
    
    const scriptPath = path.join(tempDir, 'setup.sh');
    
    // 构建命令参数
    const args = ['--force', '--silent'];
    if (options.timeout) {
      args.push('--timeout', options.timeout);
    }
    
    // 确保脚本有执行权限
    try {
      fs.chmodSync(scriptPath, '755');
    } catch (error) {
      // 在Windows上可能会失败，忽略
    }
    
    // 在Windows上使用bash，其他系统直接执行
    const isWindows = process.platform === 'win32';
    const command = isWindows ? 'bash' : 'bash';
    const fullArgs = [scriptPath, ...args];
    
    // 执行脚本
    const child = spawn(command, fullArgs, {
      cwd: tempDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 300000, // 5分钟总超时
      env: { ...process.env, FORCE_COLOR: '0' } // 禁用颜色输出避免干扰
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
        spinner.succeed('VSCode 配置安装完成 ✓');
        
        // 显示重要的输出信息
        if (output.includes('备份') || output.includes('backup')) {
          const backupMatches = output.match(/备份位置: (.+)|Backup location: (.+)|已备份/g);
          if (backupMatches && backupMatches.length > 0) {
            console.log(chalk.blue('📁 原配置已自动备份'));
          }
        }
        
        // 显示扩展安装统计
        const extensionMatches = output.match(/成功 (\d+)\/(\d+)|安装完成.*成功 (\d+)/);
        if (extensionMatches) {
          const success = extensionMatches[1] || extensionMatches[3];
          const total = extensionMatches[2];
          if (total) {
            console.log(chalk.green(`📦 扩展安装: ${success}/${total}`));
          } else {
            console.log(chalk.green(`📦 扩展处理: ${success} 个`));
          }
        }
        
        resolve();
      } else {
        spinner.fail('安装脚本执行失败');
        
        // 提取有用的错误信息
        let errorMsg = `安装失败，退出代码: ${code}`;
        
        if (errorOutput.includes('VSCode未安装') || errorOutput.includes('VSCode not installed')) {
          errorMsg = 'VSCode 未安装或不在 PATH 中';
        } else if (errorOutput.includes('Git未安装') || errorOutput.includes('Git not installed')) {
          errorMsg = 'Git 未安装或不在 PATH 中';
        } else if (errorOutput.includes('权限') || errorOutput.includes('permission')) {
          errorMsg = '权限不足，请尝试以管理员身份运行或检查文件权限';
        } else if (errorOutput.trim()) {
          errorMsg = errorOutput.trim();
        }
        
        reject(new Error(errorMsg));
      }
    });
    
    child.on('error', (error) => {
      spinner.fail('安装脚本运行失败');
      
      if (error.code === 'ENOENT') {
        reject(new Error('Bash 不可用。在 Windows 上请安装 Git Bash 或 WSL'));
      } else {
        reject(new Error(`脚本执行错误: ${error.message}`));
      }
    });
    
    // 处理超时
    child.on('timeout', () => {
      spinner.fail('安装超时');
      reject(new Error('安装超时（5分钟）。请检查网络连接后重试'));
    });
  });
}

/**
 * 主安装函数
 */
async function installConfig(options = {}) {
  let tempDir = null;
  
  try {
    console.log(chalk.gray('开始安装流程...'));
    console.log('');
    
    // 1. 检查依赖
    checkDependencies();
    
    // 2. 创建临时目录
    tempDir = createTempDir();
    console.log(chalk.gray(`使用临时目录: ${tempDir}`));
    
    // 3. 克隆仓库
    cloneConfigRepo(tempDir);
    
    // 4. 运行安装脚本
    await runInstallScript(tempDir, options);
    
    console.log('');
    console.log(chalk.green('安装完成！'));
    
  } catch (error) {
    // 重新抛出错误，保持原有错误信息
    throw error;
  } finally {
    // 5. 清理临时文件
    if (tempDir) {
      const cleanupSpinner = ora('清理临时文件...').start();
      cleanupTempDir(tempDir);
      cleanupSpinner.succeed('清理完成 ✓');
    }
  }
}

module.exports = {
  installConfig
};