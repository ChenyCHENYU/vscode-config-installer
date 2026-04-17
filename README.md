<div align="center">

# @agile-team/vscode-config

**团队编辑器配置一键同步工具**

一条命令同步 VS Code / Cursor / Windsurf / Kiro 的 settings、keybindings、extensions。
作者维护配置仓库，团队成员一键拉取，支持备份恢复与增量合并。

[![npm version](https://img.shields.io/npm/v/%40agile-team%2Fvscode-config)](https://www.npmjs.com/package/@agile-team/vscode-config)
[![CI](https://github.com/ChenyCHENYU/vscode-config-installer/actions/workflows/ci.yml/badge.svg)](https://github.com/ChenyCHENYU/vscode-config-installer/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.7.0-brightgreen)](https://nodejs.org/)

</div>

---

## 快速开始

```bash
npm i -g @agile-team/vscode-config

vscode-config install              # 交互式选择编辑器和安装模式
```

<details>
<summary>更多示例</summary>

```bash
vscode-config install --editor cursor     # 安装到 Cursor
vscode-config install --editor windsurf   # 安装到 Windsurf
vscode-config install --editor kiro       # 安装到 Kiro
vscode-config install --editor all        # 同时安装到所有编辑器
vscode-config install --mode merge        # 保留个人设置，仅同步团队新增
vscode-config install --dry-run           # 预览，不做任何写入
vscode-config status                      # 检查配置状态
vscode-config restore                     # 一键恢复到安装前
```

</details>

---

## 工作流程

```
配置仓库 (GitHub / Gitee)           团队成员
┌─────────────────────┐            ┌────────────────────┐
│ settings.json       │  ──拉取──▶ │ vscode-config      │
│ keybindings.json    │  双源加速   │ install             │
│ extensions.list     │            │                    │
└─────────────────────┘            │ 1. 下载远程配置     │
         ▲                         │ 2. 写入编辑器目录   │
         │                         │ 3. 安装扩展         │
    作者 push 更新                  │ 4. 验证安装结果     │
    vscode-config upload           └────────────────────┘
```

---

## 命令参考

### install — 安装/同步配置

| 选项 | 说明 |
|------|------|
| `--editor <name>` | 目标编辑器：`vscode` / `cursor` / `windsurf` / `kiro` / `all` |
| `--mode <mode>` | `override`（覆盖，默认）或 `merge`（合并） |
| `--force` | 跳过备份和交互确认 |
| `--dry-run` | 预览模式，不做任何写入 |
| `--source <name>` | 配置源：`github` / `gitee` |
| `--timeout <sec>` | 扩展安装超时（默认 30 秒） |
| `--extensions-dir <path>` | 离线 .vsix 目录（内网环境） |
| `-v` | 显示详细诊断日志 |

### upload — 上传本地配置到团队仓库

| 选项 | 说明 |
|------|------|
| `--mode <mode>` | `override`（覆盖）或 `merge`（合并） |
| `--source <name>` | `github` / `gitee` / `all`（默认） |
| `--editor <name>` | 读取哪个编辑器的本地配置 |
| `--repo <path>` | 指定本地已 clone 的配置仓库路径 |

### download-extensions — 批量下载 .vsix（管理员用）

| 选项 | 说明 |
|------|------|
| `--output <dir>` | 输出目录（默认 `vsix-cache`） |
| `--force` | 强制重新下载所有扩展（覆盖已有文件） |
| `--merge` | 只增不删 — 保留目录中不在列表里的 .vsix |

> 默认**覆盖模式**: 以 `extensions.list` 为准，自动删除目录中已废弃的 .vsix。

### status / restore / clean

| 命令 | 说明 |
|------|------|
| `vscode-config status` | 检查编辑器版本、配置文件、已装扩展、备份 |
| `vscode-config restore` | 恢复备份（多个可交互选择） |
| `vscode-config restore --list` | 列出所有可用备份 |
| `vscode-config restore --backup <path>` | 恢复指定路径的备份 |
| `vscode-config clean` | 清理 30 天前的旧备份 |
| `vscode-config clean --older-than <days>` | 指定清理天数 |

> 以上命令均支持 `--editor <name>` 指定编辑器。

---

## 安装模式

| 模式 | 行为 | 场景 |
|------|------|------|
| **覆盖**（默认） | 完全替换 settings / keybindings，保证团队一致 | 新机器初始化、重置为团队标准 |
| **合并** `--mode merge` | 深度合并，同名 key 覆盖，独有 key 保留 | 已有个人配置，只同步团队新增 |

两种模式都会**自动备份**当前配置，可随时 `restore` 回滚。

---

## 多编辑器支持

支持 **VS Code**、**Cursor**、**Windsurf**、**Kiro** 四种 Electron 系编辑器。

- 不带 `--editor` 参数时**交互式选择**，自动检测已安装的编辑器
- `--editor all` 同时安装到所有已检测编辑器
- 未检测到的编辑器会置灰不可选

> **为什么不用编辑器自带的「导入配置」？**
> 因为那是一次性操作。本工具支持**持续同步** — 团队配置更新后再跑一次 `install` 即可。

---

## 扩展安装机制

**核心原理**：绕过 `code.cmd` 脚本，直接调用 `Electron + cli.js`：

```
ELECTRON_RUN_AS_NODE=1  Code.exe  cli.js  --install-extension <ext-id>
```

- **零弹窗** — `ELECTRON_RUN_AS_NODE=1` 以 Node 模式运行 CLI
- **输出可靠** — stdout 直接返回安装结果
- **逐个安装 + 最终验证** — 每个扩展独立安装后用 `--list-extensions` 核实
- **跨平台** — 自动检测 Windows / macOS / Linux 安装路径
- **安全** — 扩展 ID 格式校验，防止命令注入
- **只增不减** — 绝不会卸载已有扩展

---

## 备份与恢复

每次安装前自动备份 `settings.json`、`keybindings.json`、`snippets`。

```bash
vscode-config restore             # 恢复最新备份
vscode-config restore --list      # 列出所有备份
vscode-config clean --older-than 7 # 清理 7 天前的旧备份
```

<details>
<summary>备份存储位置</summary>

| 编辑器 | Windows | macOS | Linux |
|--------|---------|-------|-------|
| VS Code | `%APPDATA%\Code\User\backup-*\` | `~/Library/Application Support/Code/User/backup-*/` | `~/.config/Code/User/backup-*/` |
| Cursor | `%APPDATA%\Cursor\User\backup-*\` | `~/Library/Application Support/Cursor/User/backup-*/` | `~/.config/Cursor/User/backup-*/` |
| Windsurf | `%APPDATA%\Windsurf\User\backup-*\` | `~/Library/Application Support/Windsurf/User/backup-*/` | `~/.config/Windsurf/User/backup-*/` |
| Kiro | `%APPDATA%\Kiro\User\backup-*\` | `~/Library/Application Support/Kiro/User/backup-*/` | `~/.config/Kiro/User/backup-*/` |

</details>

---

## 网络与配置源

双源自动切换：GitHub → Gitee，国内用户无需配置。

```bash
vscode-config install --source gitee --timeout 120  # 强制国内源 + 慢网超时
```

---

## 安全测试指南

担心覆盖现有配置？按照以下流程零风险试用：

```
1. vscode-config install --dry-run     # 预览，不写入任何文件
2. vscode-config install               # 安装（自动备份）
3. vscode-config restore               # 不满意？一键恢复
```

> 扩展只增不减，不会卸载已有扩展。如需手动卸载请在编辑器扩展面板操作。

---

## 常见场景

```bash
# 新人入职
npm i -g @agile-team/vscode-config && vscode-config install

# 团队配置更新后同步
vscode-config install --force

# 保留个人偏好只同步团队新增
vscode-config install --mode merge

# 网络差
vscode-config install --source gitee --timeout 120

# 云桌面 / 内网
npm i -g @agile-team/vscode-config @agile-team/vscode-config-extensions
vscode-config install
```

---

## 内网 / 离线 / 云桌面

配置文件内置离线兜底（`defaults/`），远程不可用时自动读取包内配置。

扩展安装依赖编辑器 marketplace，不可用时工具会自动降级：

```
扩展安装优先级：
  1. --extensions-dir 参数          ← 显式指定 .vsix 目录
  2. VSCODE_CONFIG_EXTENSIONS_DIR   ← 环境变量
  3. @agile-team/vscode-config-extensions ← 伴侣 npm 包（自动检测）
  4. 在线 marketplace              ← 默认
```

### 三种场景

| 场景 | npm | marketplace | 方案 |
|------|:---:|:-----------:|------|
| **外网本地** | ✅ | ✅ | 直接 `vscode-config install` |
| **内网本地** | ✅ | ❌ | 在有网时先执行一次 install，扩展本地持久保留 |
| **云桌面内网** | ✅ | ❌ | 安装伴侣包，主工具自动检测 |

### 云桌面一键安装（推荐）

```bash
# 一条命令搞定，无需额外配置
npm i -g @agile-team/vscode-config @agile-team/vscode-config-extensions
vscode-config install
```

主工具自动发现伴侣包中的 `.vsix` 文件，无需 `--extensions-dir` 参数。

> **注意**: 伴侣包不含 AI 类扩展（tongyi-lingma / copilot-chat / roo-cline / cline 等），因为它们在内网无法连接 AI 服务。

### 管理员维护

```bash
# 下载 .vsix（有网机器）
vscode-config download-extensions --output ./vsix-cache

# 全量更新最新版
vscode-config download-extensions --output ./vsix-cache --force

# 更新伴侣包（拷贝到伴侣包目录后重新发布）
vscode-config download-extensions --output packages/vscode-config-extensions/extensions --force
cd packages/vscode-config-extensions
npm publish --access public
```

---

## 故障排除

| 症状 | 解决方案 |
|------|----------|
| `XXX 未检测到` | 安装对应编辑器并确保 CLI 命令在 PATH 中 |
| 扩展安装超时 | `--timeout 120` 或 `--source gitee` |
| 所有扩展均失败 | 可能处于内网，参考「内网 / 离线 / 云桌面」章节 |
| 部分扩展失败 | 工具会输出手动安装命令，复制执行即可 |
| 需要回滚 | `vscode-config restore` |
| 想看详细日志 | `vscode-config install --force -v` |

---

## 系统要求

| 依赖 | 版本 |
|------|------|
| Node.js | >= 16.7 |
| Git | 已安装 |
| 编辑器 | VS Code / Cursor / Windsurf / Kiro 至少一个 |

```bash
vscode-config status  # 一键检查环境
```

---

## 配置仓库维护

团队配置存放在独立仓库，结构如下：

```
vscode-config/
├── settings.json       # 编辑器设置
├── keybindings.json    # 快捷键
└── extensions.list     # 扩展列表（每行一个 ID，# 开头为注释）
```

作者修改后 `push` 到 GitHub / Gitee，团队成员 `vscode-config install` 即可同步。

也可以用 CLI 直接上传：

```bash
vscode-config upload                      # 推送到 GitHub + Gitee
vscode-config upload --editor windsurf    # 上传 Windsurf 的配置
```

---

## 链接

- [配置仓库](https://github.com/ChenyCHENYU/vscode-config) — 团队共享配置
- [问题反馈](https://github.com/ChenyCHENYU/vscode-config-installer/issues) — Bug & 建议
- [npm 主包](https://www.npmjs.com/package/@agile-team/vscode-config) — 安装
- [npm 伴侣包](https://www.npmjs.com/package/@agile-team/vscode-config-extensions) — 离线扩展
- [CHANGELOG](./CHANGELOG.md) — 版本记录

---

<div align="center">

MIT License · Made by [CHENY](https://github.com/ChenyCHENYU)

</div>
