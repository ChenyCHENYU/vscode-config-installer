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

## 更新

管理员在有网环境下重新生成 .vsix 并发布新版本：

```bash
vscode-config download-extensions --output packages/vscode-config-extensions/extensions
cd packages/vscode-config-extensions
npm publish --access public
```

## 相关链接

- [主工具](https://www.npmjs.com/package/@agile-team/vscode-config)
- [配置仓库](https://github.com/ChenyCHENYU/vscode-config)
