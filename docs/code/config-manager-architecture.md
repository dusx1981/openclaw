# 配置管理器架构

OpenClaw 配置管理器是一个分层、Schema 驱动的配置系统，负责管理整个生态系统的配置加载、验证、持久化和热重载。

## 概述

配置管理器作为 OpenClaw 的**配置中枢**，具有以下主要职责：

| 职责 | 描述 |
|------|-------------|
| **配置加载** | 从 `~/.openclaw/openclaw.json` 加载 JSON5 格式的配置 |
| **文件包含** | 支持 `$include` 指令拆分配置文件 |
| **变量替换** | 支持 `${ENV_VAR}` 语法的环境变量替换 |
| **Schema 验证** | 使用 Zod 进行严格的类型验证 |
| **插件验证** | 验证插件配置和通道配置 |
| **配置持久化** | 原子写入配置，支持备份轮换 |
| **热重载** | 监听文件变化并智能决定重启或热加载 |
| **RPC 服务** | 通过 Gateway 暴露配置操作 API |
| **UI 集成** | 为控制界面提供 Schema 和表单渲染支持 |

## 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        配置源层                                  │
├─────────────┬─────────────┬─────────────┬───────────────────────┤
│ 主配置文件   │ 包含文件     │ 环境变量     │ 运行时覆盖            │
│ openclaw.json│ $include    │ ${VAR}      │ --flag 覆盖           │
└──────┬──────┴──────┬──────┴──────┬──────┴───────────┬───────────┘
       │             │             │                  │
       └─────────────┴─────────────┴──────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      配置加载管道                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  JSON5 解析  │  │ 包含文件解析 │  │    环境变量替换          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   Schema    │  │   默认值     │  │    运行时覆盖            │  │
│  │   验证      │  │   应用       │  │    应用                  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     配置运行时 (Config Runtime)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  内存缓存   │  │  文件监听   │  │    热重载决策            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   RPC API   │  │   UI 接口   │  │    配置快照              │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 核心组件

### 1. 配置 IO 层 (`src/config/io.ts`)

负责配置文件的读写操作：

```typescript
// 配置加载管道
function loadConfig(): OpenClawConfig {
  // 1. 读取文件
  const raw = fs.readFileSync(configPath, "utf-8");
  
  // 2. JSON5 解析
  const parsed = JSON5.parse(raw);
  
  // 3. 解析 $include 指令
  const resolved = resolveConfigIncludes(parsed, configPath);
  
  // 4. 应用 config.env 到 process.env
  applyConfigEnv(resolved, process.env);
  
  // 5. 环境变量替换 ${VAR}
  const substituted = resolveConfigEnvVars(resolved, process.env);
  
  // 6. Schema 验证
  const validated = validateConfigObjectWithPlugins(substituted);
  
  // 7. 应用默认值
  return applyDefaults(validated.config);
}

// 原子写入配置
async function writeConfigFile(cfg: OpenClawConfig) {
  // 1. 验证配置
  const validated = validateConfigObjectWithPlugins(cfg);
  
  // 2. 创建临时文件
  const tmp = `${configPath}.${pid}.${uuid}.tmp`;
  await fs.writeFile(tmp, json, { mode: 0o600 });
  
  // 3. 备份轮转
  await rotateConfigBackups(configPath);
  
  // 4. 原子重命名
  await fs.rename(tmp, configPath);
}
```

**关键特性：**
- **JSON5 支持**：允许注释和尾随逗号
- **文件包含**：通过 `$include` 支持配置拆分
- **环境变量替换**：支持 `${ENV_VAR}` 语法
- **原子写入**：临时文件 + 重命名确保配置完整性
- **备份轮换**：保留最近 5 个配置备份

### 2. Schema 定义 (`src/config/zod-schema.ts`)

使用 Zod 定义完整的配置结构：

```typescript
export const OpenClawSchema = z.object({
  meta: MetaSchema,           // 配置元数据
  env: EnvSchema,             // 环境变量配置
  agents: AgentsSchema,       // 智能体配置
  channels: ChannelsSchema,   // 消息通道配置
  models: ModelsConfigSchema, // 模型配置
  gateway: GatewaySchema,     // 网关配置
  plugins: PluginsSchema,     // 插件配置
  skills: SkillsSchema,       // 技能配置
  // ... 其他配置项
}).strict();  // 严格模式：禁止未知键
```

**Schema 子模块：**

| 文件 | 描述 |
|------|------|
| `zod-schema.ts` | 顶层配置 Schema |
| `zod-schema.agents.ts` | 智能体配置 Schema |
| `zod-schema.providers.ts` | 通道提供商 Schema |
| `zod-schema.session.ts` | 会话和消息 Schema |
| `zod-schema.hooks.ts` | 钩子配置 Schema |
| `zod-schema.core.ts` | 核心类型和工具 Schema |

### 3. 配置验证 (`src/config/validation.ts`)

分层验证系统：

```typescript
// 基础验证（Zod Schema）
export function validateConfigObject(raw: unknown):
  | { ok: true; config: OpenClawConfig }
  | { ok: false; issues: ConfigValidationIssue[] } {
  // 1. 检查遗留配置问题
  const legacyIssues = findLegacyConfigIssues(raw);
  
  // 2. Zod Schema 验证
  const validated = OpenClawSchema.safeParse(raw);
  
  // 3. 检查重复 Agent 目录
  const duplicates = findDuplicateAgentDirs(validated.data);
  
  // 4. 验证 Identity Avatar 路径
  const avatarIssues = validateIdentityAvatar(validated.data);
  
  return { ok: true, config: applyDefaults(validated.data) };
}

// 带插件验证
export function validateConfigObjectWithPlugins(raw: unknown):
  | { ok: true; config: OpenClawConfig; warnings: ConfigValidationIssue[] }
  | { ok: false; issues: ConfigValidationIssue[]; warnings: ConfigValidationIssue[] } {
  // 1. 基础验证
  const base = validateConfigObject(raw);
  
  // 2. 插件存在性验证
  for (const pluginId of config.plugins.allow) {
    if (!knownIds.has(pluginId)) {
      issues.push({ path: "plugins.allow", message: `plugin not found: ${pluginId}` });
    }
  }
  
  // 3. 通道有效性验证
  for (const key of Object.keys(config.channels)) {
    if (!allowedChannels.has(key)) {
      issues.push({ path: `channels.${key}`, message: `unknown channel id: ${key}` });
    }
  }
  
  // 4. 插件 Schema 验证
  for (const record of registry.plugins) {
    const res = validateJsonSchemaValue({
      schema: record.configSchema,
      value: entry?.config ?? {},
    });
  }
  
  return { ok: true, config, warnings };
}
```

### 4. 配置路径操作 (`src/config/config-paths.ts`)

支持点符号路径操作：

```typescript
// 解析路径
export function parseConfigPath(raw: string): {
  ok: boolean;
  path?: string[];
  error?: string;
} {
  const parts = raw.split(".").map(part => part.trim());
  return { ok: true, path: parts };
}

// 设置值
export function setConfigValueAtPath(root: PathNode, path: string[], value: unknown): void {
  let cursor: PathNode = root;
  for (let idx = 0; idx < path.length - 1; idx += 1) {
    const key = path[idx];
    if (!isPlainObject(cursor[key])) {
      cursor[key] = {};
    }
    cursor = cursor[key] as PathNode;
  }
  cursor[path[path.length - 1]] = value;
}

// 获取值
export function getConfigValueAtPath(root: PathNode, path: string[]): unknown {
  let cursor: unknown = root;
  for (const key of path) {
    if (!isPlainObject(cursor)) return undefined;
    cursor = cursor[key];
  }
  return cursor;
}

// 删除值
export function unsetConfigValueAtPath(root: PathNode, path: string[]): boolean {
  // 递归删除并清理空父对象
}
```

### 5. 热重载管理器 (`src/gateway/config-reload.ts`)

智能配置热重载系统：

```typescript
// 重载规则定义
const BASE_RELOAD_RULES: ReloadRule[] = [
  { prefix: "hooks.gmail", kind: "hot", actions: ["restart-gmail-watcher"] },
  { prefix: "hooks", kind: "hot", actions: ["reload-hooks"] },
  { prefix: "agents.defaults.heartbeat", kind: "hot", actions: ["restart-heartbeat"] },
  { prefix: "cron", kind: "hot", actions: ["restart-cron"] },
  { prefix: "browser", kind: "hot", actions: ["restart-browser-control"] },
  { prefix: "plugins", kind: "restart" },
  { prefix: "gateway", kind: "restart" },
  { prefix: "identity", kind: "none" },  // 无需重启
];

// 配置差异检测
export function diffConfigPaths(prev: unknown, next: unknown, prefix = ""): string[] {
  if (prev === next) return [];
  // 深度比较对象，返回变化的路径列表
}

// 构建重载计划
export function buildGatewayReloadPlan(changedPaths: string[]): GatewayReloadPlan {
  const plan: GatewayReloadPlan = {
    changedPaths,
    restartGateway: false,
    hotReasons: [],
    reloadHooks: false,
    restartChannels: new Set(),
    // ...
  };
  
  for (const path of changedPaths) {
    const rule = matchRule(path);
    if (rule?.kind === "restart") {
      plan.restartGateway = true;
    } else if (rule?.kind === "hot") {
      applyAction(rule.actions);
    }
  }
  
  return plan;
}

// 启动文件监听
export function startGatewayConfigReloader(opts: {
  initialConfig: OpenClawConfig;
  readSnapshot: () => Promise<ConfigFileSnapshot>;
  onHotReload: (plan: GatewayReloadPlan, nextConfig: OpenClawConfig) => Promise<void>;
  onRestart: (plan: GatewayReloadPlan, nextConfig: OpenClawConfig) => void;
  watchPath: string;
}): GatewayConfigReloader {
  const watcher = chokidar.watch(watchPath, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200 },
  });
  
  watcher.on("change", scheduleReload);
  
  return { stop: async () => { await watcher.close(); } };
}
```

**重载模式：**

| 模式 | 描述 |
|------|------|
| `off` | 禁用热重载 |
| `hot` | 仅热重载支持的配置，忽略需要重启的更改 |
| `restart` | 任何配置更改都触发网关重启 |
| `hybrid` | 热重载支持的配置，重启网关处理其他更改（默认） |

### 6. Gateway RPC 方法 (`src/gateway/server-methods/config.ts`)

通过 Gateway 暴露配置操作 API：

```typescript
export const configHandlers: GatewayRequestHandlers = {
  // 获取配置快照
  "config.get": async ({ params, respond }) => {
    const snapshot = await readConfigFileSnapshot();
    respond(true, snapshot, undefined);
  },
  
  // 获取 JSON Schema（用于 UI 表单渲染）
  "config.schema": ({ params, respond }) => {
    const schema = buildConfigSchema({ plugins, channels });
    respond(true, schema, undefined);
  },
  
  // 设置完整配置（需要 baseHash 防冲突）
  "config.set": async ({ params, respond }) => {
    const snapshot = await readConfigFileSnapshot();
    if (!requireConfigBaseHash(params, snapshot, respond)) return;
    
    const parsed = parseConfigJson5(params.raw);
    const validated = validateConfigObjectWithPlugins(parsed);
    await writeConfigFile(validated.config);
    respond(true, { ok: true, path: CONFIG_PATH }, undefined);
  },
  
  // 部分更新配置（JSON Merge Patch）
  "config.patch": async ({ params, respond }) => {
    const snapshot = await readConfigFileSnapshot();
    const merged = applyMergePatch(snapshot.config, parsed);
    const validated = validateConfigObjectWithPlugins(merged);
    await writeConfigFile(validated.config);
    scheduleGatewaySigusr1Restart();
    respond(true, { ok: true, restart }, undefined);
  },
  
  // 应用完整配置并重启
  "config.apply": async ({ params, respond }) => {
    const snapshot = await readConfigFileSnapshot();
    const validated = validateConfigObjectWithPlugins(parsed);
    await writeConfigFile(validated.config);
    scheduleGatewaySigusr1Restart();
    respond(true, { ok: true, restart }, undefined);
  },
};
```

**方法对比：**

| 方法 | 用途 | 重启 | 并发保护 |
|------|------|------|----------|
| `config.get` | 读取当前配置 | 否 | 无 |
| `config.schema` | 获取配置 Schema | 否 | 无 |
| `config.set` | 写入完整配置 | 否 | baseHash |
| `config.patch` | 部分更新配置 | 是 | baseHash |
| `config.apply` | 应用并重启 | 是 | baseHash |

### 7. UI 配置控制器 (`ui/src/ui/controllers/config.ts`)

前端配置状态管理：

```typescript
export type ConfigState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
  configLoading: boolean;
  configRaw: string;           // 原始 JSON5
  configValid: boolean | null;
  configIssues: unknown[];
  configSaving: boolean;
  configApplying: boolean;
  configSnapshot: ConfigSnapshot | null;
  configSchema: unknown | null;    // JSON Schema
  configUiHints: ConfigUiHints;    // UI 提示
  configForm: Record<string, unknown> | null;  // 表单数据
  configFormDirty: boolean;
  configFormMode: "form" | "raw";  // 表单/原始编辑模式
};

// 加载配置
export async function loadConfig(state: ConfigState) {
  const res = await state.client.request("config.get", {});
  applyConfigSnapshot(state, res);
}

// 保存配置
export async function saveConfig(state: ConfigState) {
  const raw = state.configFormMode === "form" 
    ? serializeConfigForm(state.configForm)
    : state.configRaw;
  await state.client.request("config.set", { raw, baseHash });
}

// 应用配置
export async function applyConfig(state: ConfigState) {
  await state.client.request("config.apply", { raw, baseHash, sessionKey });
}
```

## 配置层级

### 配置加载优先级（从高到低）

```
1. 运行时覆盖（命令行参数）
2. 环境变量（process.env）
3. 配置文件中定义的环境变量（config.env.vars）
4. 配置文件本身（openclaw.json）
5. 包含的文件（$include）
6. 默认值（代码中定义）
```

### 配置文件结构

```json5
{
  // 元数据（自动维护）
  meta: {
    lastTouchedVersion: "2026.1.4",
    lastTouchedAt: "2026-01-15T10:30:00.000Z",
  },
  
  // 环境变量配置
  env: {
    shellEnv: { enabled: true, timeoutMs: 15000 },
    vars: {
      CUSTOM_API_KEY: "sk-xxx",
    },
  },
  
  // 智能体配置
  agents: {
    defaults: {
      workspace: "~/.openclaw/workspace",
      model: "anthropic/claude-3-5-sonnet",
    },
    list: [
      { id: "main", identity: { name: "Assistant", emoji: "🦞" } },
    ],
  },
  
  // 通道配置
  channels: {
    telegram: {
      enabled: true,
      botToken: "${TELEGRAM_BOT_TOKEN}",  // 环境变量替换
      allowFrom: ["tg:123456789"],
    },
    whatsapp: {
      enabled: true,
      dmPolicy: "pairing",
    },
  },
  
  // 插件配置
  plugins: {
    entries: {
      "memory-lancedb": {
        enabled: true,
        config: { dimension: 1536 },
      },
    },
  },
  
  // 使用 $include 拆分配置
  broadcast: {
    $include: "./broadcast.json5",
  },
}
```

## 关键文件位置

| 文件路径 | 描述 |
|----------|------|
| `src/config/io.ts` | 配置读写核心 |
| `src/config/config-paths.ts` | 配置路径操作 |
| `src/config/zod-schema.ts` | Zod Schema 定义 |
| `src/config/validation.ts` | 配置验证逻辑 |
| `src/config/types.ts` | 类型定义入口 |
| `src/config/defaults.ts` | 默认值应用 |
| `src/config/includes.ts` | `$include` 指令处理 |
| `src/config/env-substitution.ts` | 环境变量替换 |
| `src/gateway/config-reload.ts` | 热重载管理器 |
| `src/gateway/server-methods/config.ts` | RPC 配置方法 |
| `ui/src/ui/controllers/config.ts` | UI 配置控制器 |
| `ui/src/ui/views/config-form.ts` | 配置表单视图 |

## 相关文档

- [配置参考](/gateway/configuration) - 完整配置选项和示例
- [Gateway 架构](./gateway-architecture.md) - Gateway 整体设计
- [协议处理器架构](./protocol-handler-architecture.md) - RPC 方法处理
