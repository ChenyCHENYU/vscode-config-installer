# VSCode Configuration Installer

🚀 一键安装团队标准的 VSCode 配置，包括设置、快捷键、代码片段和扩展。

[![npm version](https://badge.fury.io/js/%40ChenyCHENYU%2Fvscode-config.svg)](https://badge.fury.io/js/%40ChenyCHENYU%2Fvscode-config)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ 特性

- 🔄 **始终最新**: 每次安装都获取最新的团队配置
- 💾 **自动备份**: 安装前自动备份现有配置
- 🌍 **跨平台**: 支持 Windows、macOS 和 Linux
- ⚡ **快速安装**: 一条命令完成所有配置
- 🛡️ **安全可靠**: 只读安装，不会污染配置源
- 🎨 **美化输出**: 清晰的进度提示和状态显示

## 🚀 快速开始

### 安装

```bash
npm install -g @agile-team/vscode-config
```

### 使用

```bash
# 安装最新的 VSCode 配置
vscode-config install
```

就这么简单！🎉

## 📖 详细用法

### 用户体验（极简）

```bash
# 一次性全局安装
npm install -g @agile-team/vscode-config

# 随时使用（获取最新配置）
vscode-config install

# 就这么简单！
```

### 命令选项

| 选项                  | 说明                           |
| --------------------- | ------------------------------ |
| `--force`             | 强制安装，跳过交互确认         |
| `--timeout <seconds>` | 扩展安装超时时间（默认 30 秒） |
| `--help`              | 显示帮助信息                   |
| `--version`           | 显示版本信息                   |

## 🔧 系统要求

- **Node.js**: >= 14.0.0
- **Git**: 用于下载配置文件
- **VSCode**: 已安装并添加到 PATH

### 验证环境

```bash
# 检查 Node.js
node --version

# 检查 Git
git --version

# 检查 VSCode
code --version
```

## 📦 安装内容

此工具会安装以下 VSCode 配置：

- **settings.json**: 编辑器设置和首选项
- **keybindings.json**: 自定义快捷键绑定
- **代码片段**: 各种语言的代码片段
- **扩展列表**: 团队标准的 VSCode 扩展

## 💾 备份与恢复

### 自动备份

安装时会自动备份现有配置到带时间戳的目录：

- **macOS**: `~/Library/Application Support/Code/User/backup_YYYYMMDDHHMMSS/`
- **Linux**: `~/.config/Code/User/backup_YYYYMMDDHHMMSS/`
- **Windows**: `%APPDATA%/Code/User/backup_YYYYMMDDHHMMSS/`

### 手动恢复

如果需要恢复之前的配置：

```bash
# 查看备份目录
# macOS/Linux
ls ~/.config/Code/User/backup_*

# Windows (PowerShell)
dir "$env:APPDATA/Code/User/backup_*"

# 恢复指定备份 (示例: backup_20231030143052)
# macOS/Linux
cp -r ~/.config/Code/User/backup_20231030143052/* ~/.config/Code/User/

# Windows (PowerShell)
Copy-Item "$env:APPDATA/Code/User/backup_20231030143052/*" "$env:APPDATA/Code/User/" -Recurse -Force
```

## 🔄 更新配置

想要获取最新的团队配置？只需重新运行安装命令：

```bash
vscode-config install
```

每次运行都会：

1. 下载最新的配置文件
2. 备份当前配置
3. 应用新配置
4. 安装新增的扩展

## 🆘 常见问题

### Q: 安装失败怎么办？

**A**: 请按以下步骤排查：

1. **检查网络连接**

   ```bash
   # 测试是否能访问 GitHub
   ping github.com
   ```

2. **验证系统依赖**

   ```bash
   git --version
   code --version
   ```

3. **尝试增加超时时间**

   ```bash
   vscode-config install --timeout 60
   ```

4. **查看详细错误信息** - 工具会显示具体的失败原因

### Q: 扩展安装失败？

**A**: 部分扩展安装失败是正常的，可能原因：

- 网络问题
- 扩展已下架
- 需要登录的扩展

解决方案：

1. 重新运行安装命令
2. 手动安装失败的扩展：`code --install-extension extension-name`

### Q: 在公司网络环境下使用？

**A**: 如果公司有网络限制：

1. 确保可以访问 `github.com`
2. 配置 Git 代理（如果需要）：
   ```bash
   git config --global http.proxy http://proxy-server:port
   ```
3. 使用更长的超时时间：`--timeout 120`

### Q: 配置没有生效？

**A**:

1. 重启 VSCode
2. 检查 VSCode 是否有权限问题
3. 查看 VSCode 输出面板的错误信息

## 🔗 相关链接

- [配置源代码](https://github.com/yourname/vscode-config) - 查看完整的配置内容
- [问题反馈](https://github.com/yourname/vscode-config-npm/issues) - 报告 bug 或提出建议
- [VSCode 官网](https://code.visualstudio.com/) - 下载 VSCode

## 📄 开源协议

[MIT License](LICENSE) - 可自由使用、修改和分发。

## 🤝 贡献

欢迎提出建议和改进！请查看我们的[贡献指南](CONTRIBUTING.md)。

---

<div align="center">

**🎉 享受统一的 VSCode 开发体验！**

如果这个工具对你有帮助，请给我们一个 ⭐

</div>
