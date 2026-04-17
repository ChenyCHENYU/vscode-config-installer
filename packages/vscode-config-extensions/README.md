# @agile-team/vscode-config-extensions

**离线扩展包** — 配合 [@agile-team/vscode-config](https://www.npmjs.com/package/@agile-team/vscode-config) 在云桌面 / 内网环境下安装 VS Code 扩展。

## 使用方式

```bash
# 一起安装（云桌面/内网推荐）
npm i -g @agile-team/vscode-config @agile-team/vscode-config-extensions

# 正常执行，自动检测离线扩展包
vscode-config install
```

主工具会自动检测本包内的 `.vsix` 文件，无需任何额外配置。

> **注意**: 本包不含 AI 类扩展（tongyi-lingma / copilot-chat / roo-cline / cline 等），因为这些扩展在内网环境下无法连接 AI 服务，安装后也无法使用。

## 适用场景

- 云桌面环境（可访问 npm，不可访问 VS Code marketplace）
- 企业内网环境（通过内部 npm 镜像分发）

## 自动同步机制

本包的 `.vsix` 文件**自动从远程配置仓库同步**，无需手动维护：

```
远程 extensions.list (GitHub / Gitee)  ← 唯一数据源
        │
        ▼  npm publish 时自动拉取
  build.js (prepublishOnly)
        │
        ▼  下载 .vsix + 排除 AI 扩展 + 清理废弃
  extensions/  ← 始终与远程 list 同步
```

管理员发布新版只需一条命令：

```bash
cd packages/vscode-config-extensions
npm version patch && npm publish --access public
# prepublishOnly 自动: 拉远程 list → 下载 .vsix → 清理废弃
```

全量重建：

```bash
npm run build    # --force 强制重新下载所有 .vsix
```

## 相关链接

- [主工具](https://www.npmjs.com/package/@agile-team/vscode-config)
- [配置仓库](https://github.com/ChenyCHENYU/vscode-config)
