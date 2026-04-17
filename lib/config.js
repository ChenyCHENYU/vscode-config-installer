/**
 * 配置文件管理 — 查找、解析、合并 .vscode-configrc.json
 *
 * 优先级链: 环境变量 > 项目配置文件 > 用户 home 配置文件 > 内置默认值
 *
 * 配置文件查找顺序:
 *   1. 当前工作目录 (cwd) 下的 .vscode-configrc.json
 *   2. 用户 home 目录下的 .vscode-configrc.json
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_FILENAME = '.vscode-configrc.json';

// ─── 内置默认值 ────────────────────────────────────────────────

const DEFAULT_SOURCES = [
  {
    name: 'GitHub',
    baseUrl: 'https://raw.githubusercontent.com/ChenyCHENYU/vscode-config/main',
    timeout: 15000,
  },
  {
    name: 'Gitee',
    baseUrl: 'https://gitee.com/ycyplus163/vscode-config/raw/main',
    timeout: 10000,
  },
];

const DEFAULT_REPOS = {
  github: 'git@github.com:ChenyCHENYU/vscode-config.git',
  gitee: 'git@gitee.com:ycyplus163/vscode-config.git',
};

// ─── 自定义编辑器必填字段 ──────────────────────────────────────

const EDITOR_REQUIRED_FIELDS = [
  'label',
  'configDirName',
  'cliName',
  'winExeName',
  'macAppNames',
  'linuxExeName',
  'website',
];

// ─── 配置文件查找与解析 ────────────────────────────────────────

/**
 * 查找配置文件路径
 * @returns {{ project: string | null, home: string | null }}
 */
function findConfigFiles() {
  const result = { project: null, home: null };

  const projectPath = path.join(process.cwd(), CONFIG_FILENAME);
  if (fs.existsSync(projectPath)) {
    result.project = projectPath;
  }

  const homePath = path.join(os.homedir(), CONFIG_FILENAME);
  if (fs.existsSync(homePath)) {
    result.home = homePath;
  }

  return result;
}

/**
 * 读取并解析单个配置文件
 * @param {string} filePath
 * @returns {Record<string, any> | null}
 */
function readConfigFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.warn(
      `[vscode-config] 配置文件解析失败: ${filePath} — ${err.message}`
    );
    return null;
  }
}

/**
 * 合并项目配置和 home 配置（项目配置优先）
 * @param {Record<string, any>} base - home 配置
 * @param {Record<string, any>} override - 项目配置
 * @returns {Record<string, any>}
 */
function mergeConfigs(base, override) {
  const result = { ...base };
  for (const key of Object.keys(override)) {
    if (
      result[key] &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key]) &&
      override[key] &&
      typeof override[key] === 'object' &&
      !Array.isArray(override[key])
    ) {
      result[key] = { ...result[key], ...override[key] };
    } else {
      result[key] = override[key];
    }
  }
  return result;
}

/**
 * 加载合并后的配置（项目 > home）
 * @returns {Record<string, any>}
 */
function loadConfig() {
  const { project, home } = findConfigFiles();
  let config = {};

  if (home) {
    const homeConfig = readConfigFile(home);
    if (homeConfig) config = homeConfig;
  }

  if (project) {
    const projectConfig = readConfigFile(project);
    if (projectConfig) config = mergeConfigs(config, projectConfig);
  }

  return config;
}

// ─── 配置解析（带优先级链）──────────────────────────────────────

/**
 * 解析配置源列表
 * 优先级: 环境变量 > 配置文件 sources > 内置默认值
 * @returns {Array<{ name: string, baseUrl: string, timeout?: number }>}
 */
function resolveSources() {
  // 环境变量覆盖
  const envGithub = process.env.VSCODE_CONFIG_GITHUB_URL;
  const envGitee = process.env.VSCODE_CONFIG_GITEE_URL;

  if (envGithub || envGitee) {
    return DEFAULT_SOURCES.map(src => {
      if (src.name === 'GitHub' && envGithub) {
        return { ...src, baseUrl: envGithub };
      }
      if (src.name === 'Gitee' && envGitee) {
        return { ...src, baseUrl: envGitee };
      }
      return src;
    });
  }

  const config = loadConfig();
  if (Array.isArray(config.sources) && config.sources.length > 0) {
    return config.sources.map(src => ({
      name: src.name || 'Unknown',
      baseUrl: src.baseUrl,
      timeout: src.timeout || 15000,
    }));
  }

  return DEFAULT_SOURCES;
}

/**
 * 解析仓库地址
 * 优先级: 环境变量 > 配置文件 repos > 内置默认值
 * @returns {{ github?: string, gitee?: string, primary?: string, fallback?: string }}
 */
function resolveRepos() {
  const envGithub = process.env.VSCODE_CONFIG_REPO_GITHUB;
  const envGitee = process.env.VSCODE_CONFIG_REPO_GITEE;

  if (envGithub || envGitee) {
    const repos = { ...DEFAULT_REPOS };
    if (envGithub) repos.github = envGithub;
    if (envGitee) repos.gitee = envGitee;
    return repos;
  }

  const config = loadConfig();
  if (config.repos && typeof config.repos === 'object') {
    return { ...DEFAULT_REPOS, ...config.repos };
  }

  return DEFAULT_REPOS;
}

/**
 * 解析自定义编辑器注册表
 * @returns {Record<string, object> | null}
 */
function resolveCustomEditors() {
  const config = loadConfig();
  if (!config.editors || typeof config.editors !== 'object') return null;

  const validated = {};
  for (const [key, entry] of Object.entries(config.editors)) {
    const missing = EDITOR_REQUIRED_FIELDS.filter(f => !entry[f]);
    if (missing.length > 0) {
      console.warn(
        `[vscode-config] 自定义编辑器 "${key}" 缺少必填字段: ${missing.join(', ')}，已跳过`
      );
      continue;
    }
    // winDirs 默认为空数组（函数形式，延迟求值）
    if (!entry.winDirs) entry.winDirs = [];
    if (!entry.winCmdScript) entry.winCmdScript = `${entry.cliName}.cmd`;
    if (!entry.winPathPattern)
      entry.winPathPattern = new RegExp(entry.cliName, 'i');
    if (!entry.macExeName) entry.macExeName = entry.cliName;
    if (!entry.linuxDirs) entry.linuxDirs = [];
    if (!entry.linuxWhichCmd) entry.linuxWhichCmd = `which ${entry.cliName}`;
    validated[key] = entry;
  }

  return Object.keys(validated).length > 0 ? validated : null;
}

/**
 * 获取配置文件路径信息（供 status 命令显示）
 * @returns {{ project: string | null, home: string | null }}
 */
function getConfigPaths() {
  return findConfigFiles();
}

module.exports = {
  CONFIG_FILENAME,
  DEFAULT_SOURCES,
  DEFAULT_REPOS,
  EDITOR_REQUIRED_FIELDS,
  loadConfig,
  resolveSources,
  resolveRepos,
  resolveCustomEditors,
  getConfigPaths,
  findConfigFiles,
  readConfigFile,
  mergeConfigs,
};
