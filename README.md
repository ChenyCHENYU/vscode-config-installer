# @agile-team/vscode-config

一键同步团队 VS Code / Cursor / Windsurf / Kiro 配置（settings、keybindings、extensions）。

作者维护远程配置仓库 → 团队成员一条命令同步 → 支持备份恢复 → 支持四种 VS Code 系编辑器。

[![npm version](https://img.shields.io/npm/v/%40agile-team%2Fvscode-config)](https://www.npmjs.com/package/@agile-team/vscode-config)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.7.0-brightgreen)](https://nodejs.org/)

## 工作原理

```
┌──────────────────────────────────────────────┐
│  配置仓库（作者维护）                          │
│  github.com/ChenyCHENYU/vscode-config        │
│  ├── settings.json     编辑器设置              │
│  ├── keybindings.json  快捷键                  │
│  └── extensions.list   扩展列表                │
└───────────────┬──────────────────────────────┘
                │  双源（GitHub + Gitee 自动切换）
                ▼
┌──────────────────────────────────────────────┐
│  本工具：@agile-team/vscode-config           │
│  npm i -g → vscode-config install            │
│                                              │
│  1. 下载远程配置文件                           │
│  2. 写入本地编辑器配置目录（VS Code / Cursor / Windsurf / Kiro） │
│  3. 直接调用编辑器 + cli.js 安装扩展            │
│  4. 通过 --list-extensions 验证结果            │
└──────────────────────────────────────────────┘
```

**作者更新配置仓库后，团队成员只需重新执行 `vscode-config install` 即可同步最新配置。**

## 快速开始

```bash
# 安装
npm i -g @agile-team/vscode-config

# 安装团队配置（交互式选择编辑器和模式）
vscode-config install

# 安装到指定编辑器
vscode-config install --editor cursor
vscode-config install --editor windsurf
vscode-config install --editor kiro

# 同时安装到所有编辑器
vscode-config install --editor all

# 查看配置状态
vscode-config status
vscode-config status --editor windsurf
```

## 命令一览

| 命令 | 作用 |
|------|------|
| `vscode-config install` | 安装/同步团队配置（交互式选择编辑器和模式） |
| `vscode-config install --editor cursor` | 安装/同步团队配置到 Cursor |
| `vscode-config install --editor windsurf` | 安装/同步团队配置到 Windsurf |
| `vscode-config install --editor kiro` | 安装/同步团队配置到 Kiro |
| `vscode-config install --editor all` | 同时安装到所有已安装的编辑器 |
| `vscode-config install --force` | 跳过备份和交互确认，直接安装 |
| `vscode-config install --mode merge` | 合并模式，保留个人设置 |
| `vscode-config install --source gitee` | 使用 Gitee 国内源 |
| `vscode-config install --timeout 120` | 设置扩展安装超时（秒） |
| `vscode-config install --dry-run` | 预览将要安装的内容，不实际操作 |
| `vscode-config install --force -v` | 安装并输出详细诊断日志 |
| `vscode-config upload` | 同时推送到 GitHub + Gitee（默认 all） |
| `vscode-config upload --mode override` | 覆盖远程，完全以本地为准 |
| `vscode-config upload --mode merge` | 合并到远程，保留远程已有内容 |
| `vscode-config upload --source github` | 只推送到 GitHub |
| `vscode-config upload --source gitee` | 只推送到 Gitee |
| `vscode-config upload --editor windsurf` | 上传 Windsurf 的本地配置 |
| `vscode-config upload --repo <path>` | 指定本地已 clone 的配置仓库路径 |
| `vscode-config status` | 检查编辑器版本、配置文件、已装扩展、备份 |
| `vscode-config status --editor cursor` | 检查 Cursor 版本、配置文件、已装扩展、备份 |
| `vscode-config status --editor windsurf` | 检查 Windsurf 版本、配置文件、已装扩展、备份 |
| `vscode-config restore` | 一键恢复到安装前的备份（多备份可交互选择） |
| `vscode-config restore --editor cursor` | 恢复 Cursor 的配置备份 |
| `vscode-config restore --list` | 列出所有可用备份 |
| `vscode-config restore --backup <path>` | 恢复指定路径的备份 |
| `vscode-config clean` | 清理 30 天前的旧备份 |
| `vscode-config clean --editor cursor` | 清理 Cursor 的旧备份 |
| `vscode-config clean --older-than 7` | 清理 7 天前的旧备份 |

## 安装模式

### 覆盖模式（默认）

完全替换本地 settings.json / keybindings.json，保证和团队配置完全一致。自动备份旧配置，可随时 `restore` 回去。

适合：新机器初始化、重置为团队标准。

### 合并模式 (`--mode merge`)

智能深度合并：团队配置覆盖同名 key，你独有的 key 原样保留。

适合：已有个人配置，只想同步团队新增项。

## 多编辑器支持

v3.5 起支持 **VS Code**、**Cursor**、**Windsurf**、**Kiro** 四种编辑器，通过 `--editor` 参数指定目标：

| 参数 | 说明 |
|------|------|
| `--editor vscode` | 安装到 VS Code（默认） |
| `--editor cursor` | 安装到 Cursor |
| `--editor windsurf` | 安装到 Windsurf |
| `--editor kiro` | 安装到 Kiro |
| `--editor all` | 同时安装到所有已安装的编辑器 |

所有编辑器均基于 VS Code / Electron，使用相同的配置格式和扩展机制。工具会自动检测每个编辑器的安装路径和配置目录。

**交互式选择**：不带 `--editor` 参数运行时，工具会自动检测已安装的编辑器并提供交互选择。未检测到的编辑器会置灰不可选。

> **为什么不使用编辑器自带的「导入 VS Code 配置」功能？** 因为那只是一次性导入，后续团队配置更新不会自动同步。使用 `--editor <name>` 可以直接、持续地同步团队配置。

## 扩展安装机制

v3.0 彻底解决了 Windows 下安装扩展弹窗和失败问题：

**核心改进**：不再调用 `code` / `code.cmd` 脚本，而是**直接调用编辑器可执行文件 + cli.js**。

```
# VS Code 实际执行的命令（用户无需关心）：
ELECTRON_RUN_AS_NODE=1  Code.exe  cli.js  --install-extension xxx

# Cursor / Windsurf / Kiro 同理：
ELECTRON_RUN_AS_NODE=1  Cursor.exe  cli.js  --install-extension xxx
```

- **零弹窗**：`ELECTRON_RUN_AS_NODE=1` 让编辑器以 Node.js 模式运行 CLI 脚本，不启动 GUI
- **输出可靠**：stdout 直接返回 `successfully installed` / `already installed`，不经过 `.cmd` 脚本中转
- **逐个安装 + 最终验证**：每个扩展独立安装，最后用 `--list-extensions` 核实所有结果
- **跨平台**：自动检测 Windows、macOS、Linux 的编辑器安装路径
- **安全**：扩展 ID 格式校验，防止命令注入

## 上传配置（作者/管理员）

将你本地的编辑器配置上传到团队配置仓库，供其他成员同步。

```bash
# 同时推送到 GitHub + Gitee（默认）
vscode-config upload
vscode-config upload --mode override

# 上传指定编辑器的配置
vscode-config upload --editor windsurf
vscode-config upload --editor kiro

# 只推送单个源
vscode-config upload --source github
vscode-config upload --source gitee
```

**覆盖 vs 合并**：
- **覆盖**：远程 settings.json / keybindings.json / extensions.list 全部替换为你本地最新的。适合全面更新。
- **合并**：远程已有的配置项和扩展保留不动，只追加你新增的 key 和扩展。适合增量更新。

> 需要仓库写入权限（Git push 权限）。上传后团队成员运行 `vscode-config install` 即可同步。

## 备份与恢复

**每次安装前自动备份**当前 settings.json、keybindings.json、snippets，确保你随时可以回滚。

```bash
# 列出所有备份
vscode-config restore --list

# 恢复最新备份（多个备份时交互选择）
vscode-config restore

# 恢复指定备份
vscode-config restore --backup C:\Users\xxx\AppData\Roaming\Code\User\backup-xxxxx

# 清理旧备份
vscode-config clean --older-than 7
```

备份位置：

| 编辑器 | Windows | macOS | Linux |
|--------|---------|-------|-------|
| VS Code | `%APPDATA%\Code\User\backup-<ts>\` | `~/Library/Application Support/Code/User/backup-<ts>/` | `~/.config/Code/User/backup-<ts>/` |
| Cursor | `%APPDATA%\Cursor\User\backup-<ts>\` | `~/Library/Application Support/Cursor/User/backup-<ts>/` | `~/.config/Cursor/User/backup-<ts>/` |
| Windsurf | `%APPDATA%\Windsurf\User\backup-<ts>\` | `~/Library/Application Support/Windsurf/User/backup-<ts>/` | `~/.config/Windsurf/User/backup-<ts>/` |
| Kiro | `%APPDATA%\Kiro\User\backup-<ts>\` | `~/Library/Application Support/Kiro/User/backup-<ts>/` | `~/.config/Kiro/User/backup-<ts>/` |

> `--force` 模式跳过备份。

## 网络与配置源

自动双源切换：优先 GitHub → 失败自动切到 Gitee。

```bash
# 强制使用国内源 + 慢网超时
vscode-config install --source gitee --timeout 120
```

## 系统要求

- **Node.js** >= 16.7
- **VS Code** / **Cursor** / **Windsurf** / **Kiro** 至少安装一个且命令在 PATH 中
- **Git** 已安装

```bash
# 一键检查环境
vscode-config status
```

## 安全测试指南

已经有自己的 VS Code 配置，想无损试用？按以下流程操作：

### 1. 先预览，不改任何文件

```bash
vscode-config install --dry-run
```

会显示将要同步的 settings、keybindings 和扩展列表，**不做任何写入**。

### 2. 正式安装（自动备份）

```bash
vscode-config install          # 交互式选择覆盖/合并模式
# 或
vscode-config install --mode merge   # 只添加团队配置，保留你的个人设置
```

安装前会自动备份你当前的 `settings.json`、`keybindings.json`、`snippets` 到 `backup-<timestamp>` 目录。

> **扩展只增不减**：工具只会安装团队列表中的扩展，**绝不会卸载你已有的扩展**。

### 3. 随时回滚

```bash
vscode-config restore          # 恢复最新备份（settings + keybindings + snippets）
```

多个备份时支持交互式选择。回滚后重启 VS Code 即可恢复原状。

> 唯一不会自动回滚的是**已安装的扩展**（因为只增不减）。如需卸载某个扩展，在 VS Code 扩展面板手动操作即可。

### 完整流程一览

```
预览 → 安装(自动备份) → 不满意? → restore 回滚
  ↓
满意 → 继续使用，团队更新后再跑一次 install
```

## 常见场景

### 新人入职

```bash
npm i -g @agile-team/vscode-config
vscode-config install
```

### 团队配置更新后同步

```bash
vscode-config install --force
```

### 保留个人偏好只同步团队新增

```bash
vscode-config install --mode merge
```

### 安装出问题，回滚

```bash
vscode-config restore
```

### 网络差

```bash
vscode-config install --source gitee --timeout 120
```

### 安装前先看看会改什么

```bash
vscode-config install --dry-run
```

## 故障排除

| 症状 | 解决方案 |
|------|----------|
| `VS Code 未检测到` | 安装 VS Code 并确保 `code` 在 PATH 中 |
| `Cursor 未检测到` | 安装 Cursor 并确保 `cursor` 在 PATH 中，或用 `--editor vscode` |
| `Windsurf 未检测到` | 安装 Windsurf 并确保 `windsurf` 在 PATH 中，或用 `--editor vscode` |
| `Kiro 未检测到` | 安装 Kiro 并确保 `kiro` 在 PATH 中，或用 `--editor vscode` |
| 扩展安装超时 | `--timeout 120` 增加超时，或 `--source gitee` 用国内源 |
| 部分扩展安装失败 | 工具会给出手动安装命令，复制执行即可 |
| 想看详细日志 | 加 `-v` 参数：`vscode-config install --force -v` |
| 需要回滚 | `vscode-config restore` |

## 配置仓库维护（作者）

团队配置存放在独立 Git 仓库，结构如下：

```
vscode-config/
├── settings.json       # 编辑器设置
├── keybindings.json    # 快捷键
└── extensions.list     # 扩展列表（每行一个扩展 ID）
```

extensions.list 格式：
```
# 代码质量
dbaeumer.vscode-eslint
esbenp.prettier-vscode

# Git 工具
donjayamanne.githistory
eamodio.gitlens
```

作者修改后 push 到 GitHub/Gitee，团队成员 `vscode-config install` 即可同步。

## 链接

- [配置仓库](https://github.com/ChenyCHENYU/vscode-config)
- [问题反馈](https://github.com/ChenyCHENYU/vscode-config-installer/issues)
- [npm 包](https://www.npmjs.com/package/@agile-team/vscode-config)
