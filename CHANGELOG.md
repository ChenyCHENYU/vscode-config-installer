# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Conventional Commits](https://www.conventionalcommits.org/).

## [3.14.2] - 2025-04-18

### fix

- **ui**: 移除 `gradient-string` 依赖，修复 Node 18 下的 ESM/CommonJS 兼容问题
- **test**: `install --dry-run` 测试不再依赖 CI 机器预装 VS Code
- **test**: 新增跨平台 `test/run-tests.js`，修复 Windows 下 `npm test` 的 glob 展开问题

### chore

- **workflow**: GitHub Actions 精简为 Windows / macOS + Node 20，降低安装器项目的 CI 维护成本

## [3.14.1] - 2025-04-18

### fix

- **ui**: 移除 `gradient-string` 的 CommonJS 直连依赖，修复 Node 18 下 `ERR_REQUIRE_ESM`
- **ci**: GitHub Actions 的 Node 18/20/22 矩阵不再因 `ui.js` 加载失败导致测试中断

## [3.14.0] - 2025-04-18

### feat

- **status**: 新增「配置来源」区块 — 显示项目配置/用户配置路径、生效的配置源和仓库地址
- **config**: 新增 `.vscode-configrc.json` 配置文件支持 — 其他团队无需 fork 即可自定义配置源、仓库地址和编辑器
- **config**: 配置文件查找顺序 — 项目目录 > 用户 home > 内置默认值
- **config**: 优先级链 — 环境变量 > 项目配置文件 > home 配置文件 > 内置默认值
- **config**: 自定义编辑器注册 — 配置文件 `editors` 字段自动合并到编辑器注册表，必填字段校验
- **installer**: 配置源改用 `resolveSources()` 统一解析
- **uploader**: 仓库地址改用 `resolveRepos()` 统一解析
- **sync-defaults**: 同步脚本改用 `resolveSources()` 统一解析

### docs

- **README**: 多编辑器支持章节更新 — 自定义编辑器说明
- **README**: `--editor` 选项更新 — 支持自定义编辑器名称

### test

- **config**: 新增 15 个测试 — 常量/mergeConfigs/readConfigFile/resolveSources/resolveRepos/resolveCustomEditors

## [3.12.0] - 2025-04-17

### feat

- **installer**: 配置源支持环境变量覆盖 — `VSCODE_CONFIG_GITHUB_URL` / `VSCODE_CONFIG_GITEE_URL`，其他团队无需 fork 即可使用自建仓库
- **uploader**: 仓库地址支持环境变量覆盖 — `VSCODE_CONFIG_REPO_GITHUB` / `VSCODE_CONFIG_REPO_GITEE`
- **sync-defaults**: 同步脚本同步支持环境变量覆盖配置源

### test

- **backup**: 新增 12 个测试 — `backupConfig` 7 个 + `restoreFromBackup` 5 个，覆盖文件/目录/空目录/部分备份/内容一致性
- **installer**: 导出 `backupConfig` 供测试使用
- **backup**: 导出 `restoreFromBackup` 供测试使用

### docs

- **README**: 新增环境变量章节，说明 4 个可覆盖变量及使用示例

### refactor

- **installer**: 关键导出函数新增 JSDoc 类型标注（`detectEditorPaths`/`runCli`/`getEditorConfigDir`/`parseJsonc`/`deepMerge`/`backupConfig`/`isValidExtId`）
- **editors**: `resolveEditorKeys` 新增 JSDoc 类型标注
- **backup**: `restoreFromBackup`/`restoreBackup`/`cleanOldBackups` 新增 JSDoc 类型标注

## [3.11.1] - 2025-04-17

### feat

- **companion**: 伴侣包新增 `build.js` 自动构建 — `npm publish` 时自动拉取远程最新 `extensions.list`，下载 .vsix、排除 AI 扩展、清理废弃文件
- **companion**: 单一数据源架构 — 远程配置仓库为唯一真实来源，零手动维护

### docs

- **README**: 管理员维护流程简化为单条命令，补充自动同步机制说明

## [3.11.0] - 2025-04-17

### feat

- **download-extensions**: 默认覆盖模式 — 以 `extensions.list` 为准，自动删除目录中已废弃的 .vsix 文件
- **download-extensions**: 新增 `--merge` 选项 — 只增不删，保留目录中已有但不在列表中的 .vsix

### docs

- **README**: 更新 `download-extensions` 命令参考，补充 `--merge` 和覆盖模式说明

## [3.10.1] - 2025-04-17

### docs

- **README**: 完善内网/离线/云桌面章节，补充优先级链、三种场景对比表、伴侣包说明、管理员维护流程
- **README**: 常见场景新增云桌面示例，链接新增伴侣包 npm 地址

### chore

- 全量内测通过: ESLint 零警告 / 41 测试全通过 / 伴侣包自动检测 / 优先级链 / 主包 34KB 无泄漏

## [3.10.0] - 2025-04-17

### feat

- **installer**: 自动检测伴侣包 `@agile-team/vscode-config-extensions`，云桌面/内网通过 `npm install` 获取 .vsix，主工具自动发现并安装
- **packages**: 新增 `@agile-team/vscode-config-extensions` 离线扩展伴侣包

### docs

- **README**: 新增云桌面场景文档，三种环境（外网/内网/云桌面）完整覆盖

## [3.9.1] - 2025-04-17

### refactor

- **installer**: 移除扩展安装的交互式降级提示，改为清晰的操作指引（有网先装一次 / 离线 .vsix 目录）
- **installer**: 精简 `installExtensions` 逻辑，移除 `_resolveOfflineDir`

### docs

- **README**: 新增「内网 / 离线环境」章节，补充 `download-extensions` 命令和 `--extensions-dir` 文档

## [3.9.0] - 2025-04-17

### feat

- **installer**: 扩展安装自动降级 — 在线全部失败时按优先级尝试: `--extensions-dir` > `VSCODE_CONFIG_EXTENSIONS_DIR` 环境变量 > 交互提示输入路径
- **cli**: 新增 `download-extensions` 子命令，支持 `--output` 和 `--force` 参数

### refactor

- **installer**: 拆分 `installExtensions` 为 `_runExtInstall` / `_resolveOfflineDir` / `_verifyAndSummarize`，降低圈复杂度

## [3.8.0] - 2025-04-17

### feat

- **installer**: 新增 `--extensions-dir <path>` 离线扩展安装 — 从本地 .vsix 目录安装扩展，支持内网零外网环境
- **scripts**: 新增 `download-extensions.js` 批量下载 marketplace .vsix 文件，支持断点续传（已存在跳过）
- **scripts**: 新增 `npm run download-extensions` 脚本命令

## [3.7.0] - 2025-04-17

### feat

- **installer**: 新增本地离线兜底机制 — 远程配置源全部不可用时自动读取包内 `defaults/` 配置
- **scripts**: 新增 `sync-defaults.js` 同步脚本，自动从远程拉取最新配置到 `defaults/`
- **scripts**: `prepublishOnly` 自动调用同步脚本，npm 发版即捆绑最新配置
- **cli**: 修复单编辑器时跳过编辑器选择交互 — 始终显示编辑器菜单，未安装项置灰并显示下载链接

## [3.6.1] - 2025-04-17

### refactor

- **installer**: 移除废弃向后兼容函数（detectVSCodePaths / detectCursorPaths / getVSCodeConfigDir / getCursorConfigDir）
- **installer**: 移除无人使用的 CONFIG_SOURCES 导出
- **installer**: 更新文件头注释和 section 标题
- **core**: 清理所有残留迁移注释

### fix

- **cli**: 修复单编辑器时跳过编辑器选择交互的问题 — 现在始终显示编辑器选择菜单
- **cli**: 未安装的编辑器置灰并显示官网下载链接
- **cli**: 新增编辑器检测结果摘要，零检测时给出安装引导
- **cli**: 修复 prefer-destructuring lint 警告
- **eslint**: 调整 complexity 阈值至 30（适配核心编排函数）
- **backup**: `restoredFiles` 改为 `const`（never reassigned）
- **changelog**: 修复 3.5.0 与 3.6.0 重复的 chore 条目

### docs

- **README**: 专业重写，精简布局，新增 CI badge、details 折叠、命令参考表，适配在线站点展示

## [3.6.0] - 2025-04-17

### feat

- **ci**: 新增 GitHub Actions CI 工作流（lint + test，多 OS / Node 版本）
- **test**: 新增 41 个单元测试 + CLI 集成测试（editors / installer / cli）
- **standards**: 集成 @robot-admin/git-standards（ESLint / Prettier / Commitlint / Husky / lint-staged）
- **standards**: 新增 Commitizen + cz-customizable 交互式提交
- **changelog**: 新增 CHANGELOG.md 版本追溯

### fix

- **installer**: 修复原始 emoji 硬编码（✓/✗/🔍/🎉），统一使用 ui.icons 跨平台图标
- **installer**: 修复 \_activeSources 模块级可变状态污染，installConfig 入口重置
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
