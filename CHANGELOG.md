# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Conventional Commits](https://www.conventionalcommits.org/).

## [3.5.0] - 2025-04-17

### feat
- **editors**: 抽取编辑器注册表到独立模块 `lib/editors.js`
- **editors**: 新增 Windsurf 编辑器支持（安装、状态、备份、上传）
- **editors**: 新增 Kiro 编辑器支持（安装、状态、备份、上传）
- **cli**: 交互式编辑器选择支持 4+ 编辑器，未检测到的置灰不可选
- **cli**: upload 命令新增 `--editor` 选项
- **cli**: 所有命令 `--editor` 选项统一支持 `(vscode|cursor|windsurf|kiro|all)`

### fix
- **ui**: 跨平台图标系统，Windows 使用 ASCII 替代 emoji 避免显示 `?`
- **installer**: 修复 macOS 编辑器检测中 no-op replace("which","which") 问题
- **installer**: 修复 `cmdName` 硬编码为 "code" 的问题，改为动态从 EDITOR_REGISTRY 获取
- **status**: 修复未知编辑器错误提示硬编码 "可用: vscode, cursor" 的问题

### refactor
- **installer**: 移除内联 EDITOR_REGISTRY 和 resolveEditorKeys，从 editors.js 导入
- **uploader**: 改用 `getEditorConfigDir` / `detectEditorPaths` 新 API，支持 `--editor` 参数
- **installer**: 移除重复的 EDITOR_REGISTRY / resolveEditorKeys 导出

### docs
- **README**: 更新为 v3.5.0，补充 Windsurf / Kiro 文档
- **README**: 命令表新增 upload --editor 条目
- **README**: 备份路径表新增 Windsurf / Kiro 行
- **README**: 故障排除表新增 Windsurf / Kiro 条目

### chore
- **deps**: 集成 `@robot-admin/git-standards`（ESLint + Prettier + Commitlint + Husky）
- **ci**: 新增 GitHub Actions CI（3 OS × 3 Node 版本 + commitlint）
- **test**: 新增 41 个单元测试和 CLI 集成测试
- **test**: 导出 `parseJsonc` / `deepMerge` / `isValidExtId` 以便测试

## [3.4.0] - 2025-04-15

### feat
- **installer**: 支持 Cursor 编辑器 (`--editor cursor` / `--editor all`)
- **cli**: 新增 `--editor` 选项

### fix
- **cli**: 修复 `--editor=` 参数解析问题
- **cli**: 修复 "下一步" 提示中编辑器名称不正确的问题

## [3.0.0] - 2025-04-10

### feat
- **installer**: 绕过 code.cmd 脚本，直接调用 Code.exe + cli.js
- **installer**: 设置 ELECTRON_RUN_AS_NODE=1，零弹窗安装扩展
- **installer**: 逐个安装扩展 + 最终验证
- **installer**: 双源自动切换（GitHub + Gitee）
- **cli**: 新增 `--mode merge` 合并模式
- **cli**: 新增 `--dry-run` 预览模式
- **cli**: 新增 `--source` 配置源选择
- **cli**: 新增 `upload` 命令
- **cli**: 新增 `status` / `restore` / `clean` 命令
