/**
 * 编辑器注册表 — 所有支持的编辑器配置集中管理
 *
 * 新增编辑器只需在此文件添加一个 entry，无需修改其他文件。
 *
 * 字段说明:
 *   label         - 显示名称
 *   winExeName    - Windows 可执行文件名
 *   winCmdScript  - Windows CLI 脚本名 (where 检测用)
 *   winDirs       - Windows 常见安装路径 (函数，延迟求值)
 *   winPathPattern- PATH 中匹配安装目录的正则
 *   macAppNames   - macOS .app 名称列表
 *   macExeName    - macOS Electron 可执行文件名
 *   linuxDirs     - Linux 常见安装路径
 *   linuxExeName  - Linux 可执行文件名
 *   linuxWhichCmd - Linux which 命令
 *   configDirName - Electron userData 目录名 (决定配置路径)
 *   cliName       - CLI 命令名 (用于 --install-extension 等)
 *   website       - 官网 (用于错误提示)
 */

const path = require('path');

const EDITOR_REGISTRY = {
  vscode: {
    label: 'VS Code',
    winExeName: 'Code.exe',
    winCmdScript: 'code.cmd',
    winDirs: [
      () => path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Microsoft VS Code'),
      () => 'C:\\Program Files\\Microsoft VS Code',
      () => 'C:\\Program Files (x86)\\Microsoft VS Code',
    ],
    winPathPattern: /vscode|vs\scode/i,
    macAppNames: ['Visual Studio Code.app'],
    macExeName: 'Electron',
    linuxDirs: ['/usr/share/code', '/usr/lib/code', '/opt/visual-studio-code', '/snap/code/current/usr/share/code'],
    linuxExeName: 'code',
    linuxWhichCmd: 'which code',
    configDirName: 'Code',
    cliName: 'code',
    website: 'https://code.visualstudio.com/',
  },
  cursor: {
    label: 'Cursor',
    winExeName: 'Cursor.exe',
    winCmdScript: 'cursor.cmd',
    winDirs: [
      () => path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Cursor'),
      () => path.join(process.env.LOCALAPPDATA || '', 'Programs', 'cursor'),
    ],
    winPathPattern: /cursor/i,
    macAppNames: ['Cursor.app'],
    macExeName: 'Cursor',
    linuxDirs: ['/usr/share/cursor', '/opt/cursor', '/snap/cursor/current/usr/share/cursor'],
    linuxExeName: 'cursor',
    linuxWhichCmd: 'which cursor',
    configDirName: 'Cursor',
    cliName: 'cursor',
    website: 'https://cursor.sh/',
  },
  windsurf: {
    label: 'Windsurf',
    winExeName: 'Windsurf.exe',
    winCmdScript: 'windsurf.cmd',
    winDirs: [
      () => path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Windsurf'),
    ],
    winPathPattern: /windsurf/i,
    macAppNames: ['Windsurf.app'],
    macExeName: 'Electron',
    linuxDirs: ['/usr/share/windsurf', '/opt/windsurf'],
    linuxExeName: 'windsurf',
    linuxWhichCmd: 'which windsurf',
    configDirName: 'Windsurf',
    cliName: 'windsurf',
    website: 'https://windsurf.com/',
  },
  kiro: {
    label: 'Kiro',
    winExeName: 'Kiro.exe',
    winCmdScript: 'kiro.cmd',
    winDirs: [
      () => path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Kiro'),
    ],
    winPathPattern: /kiro/i,
    macAppNames: ['Kiro.app'],
    macExeName: 'Electron',
    linuxDirs: ['/usr/share/kiro', '/opt/kiro'],
    linuxExeName: 'kiro',
    linuxWhichCmd: 'which kiro',
    configDirName: 'Kiro',
    cliName: 'kiro',
    website: 'https://kiro.dev/',
  },
};

/**
 * 解析 --editor 选项为编辑器 key 列表
 * 支持: vscode, cursor, windsurf, kiro, all
 */
function resolveEditorKeys(editorOpt) {
  const val = (editorOpt || 'vscode').toLowerCase()
  if (val === 'all') return Object.keys(EDITOR_REGISTRY)
  if (EDITOR_REGISTRY[val]) return [val]
  // 未知值 → 默认 vscode + 警告
  console.warn(
    `[vscode-config] 未知编辑器 "${editorOpt}"，回退到 vscode。可用: ${Object.keys(EDITOR_REGISTRY).join(', ')}, all`
  )
  return ['vscode']
}

module.exports = { EDITOR_REGISTRY, resolveEditorKeys };
