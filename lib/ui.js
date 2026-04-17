/**
 * 共享 UI 工具 — gradient banner, boxen cards, table, symbols
 */

const chalk = require('chalk');
const boxen = require('boxen');
const gradient = require('gradient-string').default || require('gradient-string');
const Table = require('cli-table3');
const logSymbols = require('log-symbols');

// ─── 跨平台图标 ────────────────────────────────────────────────
// Windows 终端不支持 emoji 渲染，使用 ASCII 符号替代
// macOS / Linux 保留 emoji

const IS_WINDOWS = process.platform === 'win32';

const icons = IS_WINDOWS ? {
  search:    chalk.cyan('»'),
  desktop:   chalk.cyan('■'),
  gear:      chalk.cyan('※'),
  memo:      chalk.cyan('◎'),
  folder:    chalk.cyan('▸'),
  disk:      chalk.cyan('◇'),
  broom:     chalk.cyan('×'),
  refresh:   chalk.cyan('↻'),
  rocket:    chalk.cyan('▲'),
  antenna:   chalk.cyan('◇'),
  package:   chalk.cyan('□'),
  pencil:    chalk.cyan('✎'),
  computer:  chalk.cyan('▪'),
  puzzle:    chalk.cyan('◆'),
  calendar:  chalk.cyan('·'),
  warning:   chalk.yellow('⚠'),
  info:      chalk.blue('ℹ'),
  success:   chalk.green('✔'),
  error:     chalk.red('✖'),
} : {
  search:    '🔍',
  desktop:   '🖥️ ',
  gear:      '⚙️ ',
  memo:      '📝',
  folder:    '📁',
  disk:      '💾',
  broom:     '🧹',
  refresh:   '🔄',
  rocket:    '🚀',
  antenna:   '📡',
  package:   '📦',
  pencil:    '✏️ ',
  computer:  '💻',
  puzzle:    '🧩',
  calendar:  '📅',
  warning:   '⚠️ ',
  info:      'ℹ️ ',
  success:   '✔',
  error:     '✖',
};

// ─── 渐变主题 ──────────────────────────────────────────────────

const theme = gradient(['#36D1DC', '#5B86E5']); // 青 → 蓝
const successTheme = gradient(['#11998e', '#38ef7d']); // 绿色系
const warnTheme = gradient(['#F2994A', '#F2C94C']); // 橙黄

// ─── Banner ────────────────────────────────────────────────────

function banner(version) {
  const title = theme.multiline([
    '╔══════════════════════════════════════╗',
    '║      VSCode Config Installer         ║',
    '╚══════════════════════════════════════╝',
  ].join('\n'));

  console.log('');
  console.log(title);
  console.log(chalk.gray(`  v${version}  •  团队配置一键同步`));
  console.log('');
}

// ─── Section 标题 ──────────────────────────────────────────────

function section(icon, text) {
  console.log('');
  console.log(`  ${icon} ${chalk.bold.cyan(text)}`);
  console.log(chalk.gray(`  ${'─'.repeat(40)}`));
}

// ─── Info Box (boxen) ──────────────────────────────────────────

function infoBox(title, lines, color = 'cyan') {
  const content = lines.join('\n');
  console.log(boxen(content, {
    title,
    titleAlignment: 'left',
    padding: { left: 2, right: 2, top: 0, bottom: 0 },
    margin: { left: 2, top: 0, bottom: 0 },
    borderStyle: 'round',
    borderColor: color,
    dimBorder: false,
  }));
}

function successBox(title, lines) {
  infoBox(title, lines, 'green');
}

function warnBox(title, lines) {
  infoBox(title, lines, 'yellow');
}

function errorBox(title, lines) {
  infoBox(title, lines, 'red');
}

// ─── Key-Value 行 ─────────────────────────────────────────────

function kv(label, value, indent = 4) {
  const pad = ' '.repeat(indent);
  console.log(`${pad}${chalk.gray(label)}  ${chalk.white(value)}`);
}

// ─── Table ─────────────────────────────────────────────────────

function createTable(head, colWidths) {
  return new Table({
    head: head.map(h => chalk.cyan.bold(h)),
    colWidths,
    style: { head: [], border: ['gray'], 'padding-left': 1, 'padding-right': 1 },
    chars: {
      'top': '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
      'bottom': '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
      'left': '│', 'left-mid': '├', 'mid': '─', 'mid-mid': '┼',
      'right': '│', 'right-mid': '┤', 'middle': '│'
    }
  });
}

// ─── 进度条 ────────────────────────────────────────────────────

function progressBar(current, total, width = 25) {
  const pct = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  return `${bar} ${chalk.white.bold(`${pct}%`)} ${chalk.gray(`(${current}/${total})`)}`;
}

// ─── 扩展安装结果行 ───────────────────────────────────────────

function extSuccess(tag, name) {
  console.log(`    ${chalk.green('✔')} ${chalk.gray(tag)} ${chalk.white(name)}`);
}

function extFail(tag, name, reason) {
  console.log(`    ${chalk.red('✖')} ${chalk.gray(tag)} ${chalk.white(name)}`);
  if (reason) console.log(`      ${chalk.gray(reason)}`);
}

function extSkip(tag, name) {
  console.log(`    ${chalk.blue('◆')} ${chalk.gray(tag)} ${chalk.dim(name)}`);
}

// ─── 步骤指示器 ───────────────────────────────────────────────

function step(num, total, text) {
  const label = chalk.cyan.bold(`[${num}/${total}]`);
  console.log(`  ${label} ${text}`);
}

// ─── 分隔线 ───────────────────────────────────────────────────

function divider() {
  console.log(chalk.gray(`  ${'─'.repeat(50)}`));
}

// ─── 格式化工具 ────────────────────────────────────────────────

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

// ─── 导出 ─────────────────────────────────────────────────────

module.exports = {
  theme,
  successTheme,
  warnTheme,
  banner,
  section,
  divider,
  step,
  infoBox,
  successBox,
  warnBox,
  errorBox,
  kv,
  createTable,
  progressBar,
  extSuccess,
  extFail,
  extSkip,
  symbols: logSymbols,
  icons,
  formatSize,
  formatDate,
}
