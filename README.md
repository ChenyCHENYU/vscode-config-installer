# VSCode Configuration Installer

🚀 一键安装团队标准的 VSCode 配置，支持双源加速和智能备份管理。

[![npm version](https://img.shields.io/npm/v/%40agile-team%2Fvscode-config)](https://www.npmjs.com/package/@agile-team/vscode-config)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen)](https://nodejs.org/)

## ✨ 特性

- 🌐 **双源加速**: GitHub 主源 + Gitee 备用源，智能切换确保下载成功
- 💾 **智能备份**: 自动备份现有配置，支持一键恢复
- 🔄 **状态检查**: 全面的配置状态监控和诊断
- ⚡ **轻量安装**: 按需下载，不再克隆整个仓库
- 🛡️ **容错设计**: 部分失败不影响整体安装
- 🌍 **跨平台**: 支持 Windows、macOS 和 Linux
- 🎨 **美化输出**: 清晰的进度提示和彩色状态显示
- 🧹 **备份管理**: 自动清理旧备份，释放磁盘空间
- 🔄 **双模式安装**: 支持覆盖模式和扩展模式，满足不同需求

## 🚀 快速开始

### 安装

```bash
npm install -g @agile-team/vscode-config
```

### 基础使用

```bash
# 安装最新配置（交互式选择安装模式）
vscode-config install

# 使用扩展模式，保留个人设置
vscode-config install --mode merge

# 使用国内镜像源
vscode-config install --source gitee

# 网络较慢时增加超时时间
vscode-config install --timeout 60

# 强制安装，跳过备份和交互确认
vscode-config install --force
```

就这么简单！🎉

### 交互式安装

当您运行 `vscode-config install` 而不指定 `--mode` 参数时，工具会以交互式方式让您选择安装模式：

```
🔧 请选择安装模式：
  1) 覆盖模式 (override) - 完全替换现有配置，确保团队配置一致性
  2) 扩展模式 (merge) - 保留个人设置，只添加或更新团队配置

请输入选择 (1/2) [默认: 1]:
```

只需输入 `1` 或 `2`，或者直接按回车键使用默认的覆盖模式。

## 📖 完整命令参考

### 主要命令

| 命令 | 功能 | 示例 |
|------|------|------|
| `install` | 安装/更新 VSCode 配置 | `vscode-config install` |
| `status` | 检查配置状态 | `vscode-config status` |
| `restore` | 恢复备份配置 | `vscode-config restore` |
| `clean` | 清理旧备份 | `vscode-config clean` |

### 安装选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--source <name>` | 指定配置源 (github/gitee) | 自动选择 |
| `--timeout <seconds>` | 扩展安装超时时间 | 30 |
| `--force` | 强制安装，跳过备份和交互确认 | false |
| `--dry-run` | 预览模式，不实际安装 | false |
| `--mode <mode>` | 安装模式 (override/merge) | override |

### 备份管理选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `--list` | 列出所有可用备份 | - |
| `--backup <path>` | 指定备份路径恢复 | 最新备份 |
| `--older-than <days>` | 清理指定天数前的备份 | 30 |

## 🔧 安装模式详解

本工具支持两种安装模式，可根据不同需求选择使用：

### 覆盖模式 (override)
**默认模式**，完全替换现有配置，确保团队配置一致性。

**特点**：
- 🔁 完全替换现有配置文件
- 🛡️ 确保团队配置完全一致
- 💾 自动备份现有配置，可随时恢复
- ⚡ 简单直接，无冲突风险

**适用场景**：
- 新设备首次配置
- 团队标准化要求严格
- 需要重置为标准配置

**使用示例**：
```bash
# 交互式选择安装模式（推荐）
vscode-config install

# 显式指定覆盖模式
vscode-config install --mode override
```

### 扩展模式 (merge)
**可选模式**，保留个人设置，只添加或更新团队配置。

**特点**：
- 🔄 保留现有个人配置
- ➕ 添加团队标准配置
- 🎯 智能深度合并，递归合并嵌套配置
- 🛠️ 更灵活，适应个人习惯

**适用场景**：
- 已有个人自定义配置
- 只想获取部分团队配置
- 渐进式采用团队标准

**使用示例**：
```bash
# 交互式选择扩展模式（推荐）
vscode-config install

# 直接指定扩展模式
vscode-config install --mode merge
```

### 模式对比

| 特性 | 覆盖模式 | 扩展模式 |
|------|---------|---------|
| 个人设置保留 | ❌ 完全替换 | ✅ 智能保留 |
| 团队一致性 | ✅ 完全一致 | ⚠️ 部分一致 |
| 配置冲突 | ❌ 无冲突 | ⚠️ 可能需要解决 |
| 适用场景 | 新设备、重置 | 已有配置、渐进式 |
| 恢复难度 | ✅ 简单（一键恢复） | ⚠️ 较复杂（需手动调整） |

## 🎯 使用场景

### 场景一：新机器快速配置
```bash
# 全新安装
npm install -g @agile-team/vscode-config
vscode-config install  # 交互式选择安装模式

# 检查安装结果
vscode-config status
```

### 场景二：团队配置同步
```bash
# 获取最新团队配置（交互式选择安装模式）
vscode-config install

# 获取团队配置但保留个人设置（扩展模式）
vscode-config install --mode merge

# 查看已安装扩展
vscode-config status
```

### 场景三：网络环境差
```bash
# 使用国内源 + 延长超时
vscode-config install --source gitee --timeout 120
```

### 场景四：配置回滚
```bash
# 查看所有备份
vscode-config restore --list

# 恢复最新备份（多个备份时可交互式选择）
vscode-config restore

# 恢复指定备份
vscode-config restore --backup ~/path/to/backup
```

### 场景五：安装前预览
```bash
# 预览模式：查看将安装的内容，不做任何更改
vscode-config install --dry-run
```

### 场景六：维护清理
```bash
# 清理 30 天前的备份
vscode-config clean

# 清理 7 天前的备份
vscode-config clean --older-than 7
```

## 🔧 系统要求

### 必需软件
- **Node.js**: >= 22.0.0
- **Git**: 用于验证系统环境
- **VSCode**: 已安装并添加到 PATH

### 验证环境
```bash
# 一键检查所有依赖
vscode-config status

# 手动验证
node --version    # >= 22.0.0
git --version     # 任意版本
code --version    # 任意版本
```

## 📦 安装内容

### 配置文件
- **settings.json**: 编辑器设置和首选项
- **keybindings.json**: 自定义快捷键绑定
- **snippets/**: 各种语言的代码片段

### 扩展管理
- 从 `extensions.list` 读取扩展列表
- 通过 `exec()` 命令字符串方式调用，兼容 Windows `.cmd` 和新版 Node.js
- 带 `[n/N]` 进度显示，解析 CLI 真实输出判断成功/失败
- 自动跳过已安装扩展（大小写不敏感匹配）

## 💾 备份系统

### 自动备份策略
```
配置目录/
├── settings.json
├── keybindings.json
├── snippets/
├── backup-1635648000000/    # 自动备份
│   ├── settings.json
│   ├── keybindings.json
│   └── snippets/
└── backup-1635734400000/    # 更早备份
```

### 备份位置
- **macOS**: `~/Library/Application Support/Code/User/`
- **Linux**: `~/.config/Code/User/`
- **Windows**: `%APPDATA%\Code\User\`

### 备份管理
```bash
# 查看备份状态
vscode-config status

# 列出所有备份
vscode-config restore --list

# 清理旧备份
vscode-config clean --older-than 30
```

## 🌐 双源加速

### 配置源
| 源 | 用途 | 速度 |
|---|------|------|
| GitHub | 主源，最新更新 | 国外快 |
| Gitee | 备用源，国内镜像 | 国内快 |

### 智能切换
```bash
# 自动选择最佳源（交互式选择安装模式）
vscode-config install

# 手动指定源
vscode-config install --source github  # 使用 GitHub
vscode-config install --source gitee   # 使用 Gitee
```

### 故障转移
```
尝试 GitHub → 超时/失败 → 自动切换到 Gitee → 成功
```

## 🆘 故障排除

### 网络问题
```bash
# 症状：下载超时或失败
# 解决方案：
vscode-config install --source gitee --timeout 120  # 指定国内源和超时时间
```

### VSCode 未找到
```bash
# 症状：code command not found
# 解决方案：
# 1. 重新安装 VSCode
# 2. 添加到 PATH：
#    - macOS: Command Palette → "Shell Command: Install 'code' command in PATH"
#    - Windows: 安装时勾选 "Add to PATH"
```

### 扩展安装失败
```bash
# 症状：部分扩展安装失败
# 这是正常的！可能原因：
# - 网络问题
# - 扩展需要登录
# - 扩展已下架

# 解决方案：
# 1. 重新运行安装（交互式选择安装模式）
vscode-config install

# 2. 手动安装特定扩展
code --install-extension ms-python.python
```

### 权限问题
```bash
# Linux/macOS 权限错误
sudo chown -R $(whoami) ~/.config/Code/User/
sudo chown -R $(whoami) ~/.vscode/

# Windows 管理员权限
# 以管理员身份运行命令提示符
```

## 📊 状态检查详解

```bash
vscode-config status
```

输出示例：
```
📊 VSCode 配置状态检查
=======================================

✓ VSCode 已安装
   版本: 1.84.2
   架构: x64

📁 配置文件状态:
   配置目录: /Users/username/.config/Code/User
   ✓ settings.json (2.1 KB, 修改于 2 小时前)
   ✓ keybindings.json (0.5 KB, 修改于 2 小时前)
   ✓ snippets (目录, 修改于 2 小时前)

🧩 已安装扩展 (显示前10个):
   • ms-python.python@2023.20.0
   • esbenp.prettier-vscode@10.1.0
   • bradlc.vscode-tailwindcss@0.10.5
   ... 还有 47 个扩展

💾 配置备份:
   • backup-1698765432000 (156.2 KB, 2 小时前)
   • backup-1698679032000 (154.8 KB, 1 天前)
   ... 还有 3 个备份

💻 系统信息:
   操作系统: Darwin 23.1.0
   架构: arm64
   Node.js: v18.18.0
```

## 🔄 更新流程

### 获取最新配置
```bash
# 交互式更新（推荐）
vscode-config install

# 强制更新（跳过确认）
vscode-config install --force
```

### 更新过程
1. 📥 下载最新配置文件
2. 💾 自动备份当前配置
3. ⚙️ 应用新配置
4. 📦 安装新增扩展
5. 📊 显示更新统计

## 🔗 相关链接

- [配置源代码](https://github.com/ChenyCHENYU/vscode-config) - 查看完整的配置内容
- [问题反馈](https://github.com/ChenyCHENYU/vscode-config-installer/issues) - 报告 bug 或提出建议
- [更新日志](https://github.com/ChenyCHENYU/vscode-config-installer/releases) - 查看版本更新
- [VSCode 官网](https://code.visualstudio.com/) - 下载 VSCode

## 🤝 贡献

我们欢迎各种形式的贡献！

### 如何贡献
1. 🍴 Fork 项目
2. 🌿 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 💾 提交更改 (`git commit -m 'Add amazing feature'`)
4. 📤 推送分支 (`git push origin feature/amazing-feature`)
5. 🔀 创建 Pull Request

### 开发设置
```bash
# 克隆仓库
git clone https://github.com/ChenyCHENYU/vscode-config-installer.git
cd vscode-config-installer

# 安装依赖
npm install

# 本地测试
npm link
vscode-config --help

# 运行测试
npm test

# 代码检查
npm run lint
```

## 📄 开源协议

[MIT License](LICENSE) - 可自由使用、修改和分发。

## 🙏 致谢

感谢所有贡献者和使用者的支持！

特别感谢：
- [chalk](https://github.com/chalk/chalk) - 终端字符串样式
- [commander](https://github.com/tj/commander.js) - 命令行接口
- [ora](https://github.com/sindresorhus/ora) - 优雅的终端加载器

---

<div align="center">

**🎉 享受统一高效的 VSCode 开发体验！**

如果这个工具对你有帮助，请给我们一个 ⭐ 

[![GitHub stars](https://img.shields.io/github/stars/ChenyCHENYU/vscode-config-installer?style=social)](https://github.com/ChenyCHENYU/vscode-config-installer)

</div>