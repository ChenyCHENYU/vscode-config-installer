# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Conventional Commits](https://www.conventionalcommits.org/).

## [3.6.0] - 2025-04-17

### feat
- **ci**: 新增 GitHub Actions CI 工作流（lint + test，多 OS / Node 版本）
- **test**: 新增 41 个单元测试 + CLI 集成测试（editors / installer / cli）
- **standards**: 集成 @robot-admin/git-standards（ESLint / Prettier / Commitlint / Husky / lint-staged）
- **standards**: 新增 Commitizen + cz-customizable 交互式提交
- **changelog**: 新增 CHANGELOG.md 版本追溯

### fix
- **installer**: 修复原始 emoji 硬编码（✓/✗/🔍/🎉），统一使用 ui.icons 跨平台图标
- **installer**: 修复 _activeSources 模块级可变状态污染，installConfig 入口重置
- **installer**: 修复 User-Agent 硬编码版本号，改为动态读取 package.json
- **status**: 修复硬编码 URL（仅区分 cursor/vscode），改为从 EDITOR_REGISTRY.website 动态获取
- **status**: 修复配置文件状态表原始 emoji，改用 ui.icons
- **uploader**: 删除重复实现的 deepMerge / parseJsonSafe，统一从 installer.js 导入
- **uploader**: 修复 deepMerge 参数顺序不一致导致的合并逻辑错误
- **backup**: 删除重复实现的 copyRecursive，改用 fs.cpSync（Node 16.7+ 内置）
- **backup**: 修复恢复时创建 .temp-backup 临时文件但从不清理的泄漏
- **backup**: 删除重复实现的 formatSize / formatDate，统一从 ui.js 导入
- **status**: 删除重复实现的 formatSize / formatDate，统一从 ui.js 导入
- **editors**: resolveEditorKeys 未知值添加警告提示，不再静默回退
- **cli**: 移除未使用的 CONFIG_SOURCES 导入

### refactor
- **ui**: 提取 formatSize / formatDate 为共享工具函数
- **core**: 消除所有跨模块重复实现，统一单一来源

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
