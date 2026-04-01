---
summary: "OpenClaw 插件系统完整技术文档"
title: "插件系统架构"
---

# 插件系统架构

本文档详细说明 OpenClaw 插件系统的设计、实现和使用方式。

## 概述

OpenClaw 的插件系统允许开发者扩展核心功能，包括：
- 消息通道（Channel）：Telegram、Discord、WhatsApp 等
- 模型提供商（Provider）：OpenAI、Ollama、VLLM 等
- AI 工具（Tool）：自定义工具供 Agent 调用
- 生命周期钩子（Hook）：拦截和修改核心流程
- 后台服务（Service）：长期运行的后台任务
- CLI 命令：扩展命令行界面

## 核心概念

### 术语说明

| 术语 | 说明 |
|------|------|
| **扩展 (Extension)** | `extensions/` 目录下的代码模块，是插件的实现形式 |
| **插件 (Plugin)** | 运行时概念，指已加载并注册的扩展模块 |
| **插件 SDK** | `src/plugin-sdk/` 提供的类型和工具函数 |
| **插件注册表** | 运行时维护的所有已注册功能的集合 |

**扩展和插件是同一概念的不同视角**：
- **扩展**强调代码位置和安装形式
- **插件**强调运行时状态和能力注册

### 插件来源

插件可从以下位置加载（按优先级排序）：

| 来源 | 路径 | 说明 |
|------|------|------|
| `config` | 配置中指定的路径 | 最高优先级，用于开发调试 |
| `workspace` | `<workspace>/plugins/` | 工作空间级插件 |
| `global` | `~/.openclaw/plugins/` | 全局安装的插件 |
| `bundled` | `extensions/` | 内置插件，随 OpenClaw 发布 |

## 目录结构

```
openclaw/
├── extensions/              # 内置插件实现
│   ├── bluebubbles/        # BlueBubbles 通道插件
│   │   ├── package.json    # npm 包配置 + openclaw 元数据
│   │   ├── index.ts        # 插件入口
│   │   └── src/
│   ├── discord/            # Discord 通道插件
│   ├── telegram/           # Telegram 通道插件
│   ├── ollama/             # Ollama 提供商插件
│   └── ...                 # 其他插件
├── src/
│   ├── plugins/            # 插件系统核心
│   │   ├── types.ts        # 类型定义
│   │   ├── loader.ts       # 插件加载器
│   │   ├── discovery.ts    # 插件发现
│   │   ├── registry.ts     # 插件注册表
│   │   ├── install.ts      # 插件安装
│   │   ├── config-state.ts # 配置状态管理
│   │   └── runtime/        # 运行时 API
│   └── plugin-sdk/         # 插件 SDK（导出给插件使用）
│       ├── index.ts        # 主入口
│       ├── core.ts         # 核心工具
│       └── ...             # 通道特定工具
```

## 插件生命周期

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Discover  │────▶│    Load     │────▶│   Register  │────▶│   Activate  │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │                   │
      ▼                   ▼                   ▼                   ▼
 扫描插件目录      动态导入模块       调用 register()      插件开始工作
 读取清单文件      验证配置           注册能力            响应事件/请求
```

### 1. 发现阶段 (Discovery)

**入口**: `src/plugins/discovery.ts`

扫描以下位置查找插件候选：

1. **内置插件** (`extensions/*`)
   - 读取 `package.json` 的 `openclaw.extensions` 字段
   - 解析入口文件路径

2. **全局插件** (`~/.openclaw/plugins/*`)
   - 检查已安装的插件记录

3. **工作空间插件** (`<workspace>/plugins/*`)
   - 项目本地插件

4. **配置路径** (`plugins.load.paths`)
   - 用户自定义加载路径

```typescript
// discovery.ts 核心逻辑
export type PluginCandidate = {
  idHint: string;           // 插件 ID 提示
  source: string;           // 入口文件绝对路径
  rootDir: string;          // 插件根目录
  origin: PluginOrigin;     // 来源：bundled | global | workspace | config
  packageName?: string;     // npm 包名
  packageVersion?: string;  // 版本
};
```

### 2. 加载阶段 (Loading)

**入口**: `src/plugins/loader.ts`

```typescript
export function loadOpenClawPlugins(options: PluginLoadOptions): PluginRegistry {
  // 1. 规范化配置
  const normalized = normalizePluginsConfig(cfg.plugins);
  
  // 2. 发现所有候选插件
  const discovery = discoverOpenClawPlugins({ workspaceDir, extraPaths, env });
  
  // 3. 加载清单并验证
  const manifestRegistry = loadPluginManifestRegistry({ config, candidates, ... });
  
  // 4. 按优先级排序（处理重复 ID）
  const orderedCandidates = [...discovery.candidates].toSorted(comparePriority);
  
  // 5. 逐个加载插件
  for (const candidate of orderedCandidates) {
    // 验证配置
    // 动态导入
    // 调用 register
  }
  
  return registry;
}
```

**安全检查**：
- 路径逃逸检测（防止符号链接攻击）
- 文件权限验证（非 bundled 插件检查 world-writable）
- 硬链接拒绝（非 bundled 插件）

### 3. 注册阶段 (Registration)

**入口**: `src/plugins/registry.ts`

插件通过 `api.registerXxx()` 方法注册能力：

```typescript
// 创建插件 API
const createApi = (record: PluginRecord, params): OpenClawPluginApi => ({
  id: record.id,
  name: record.name,
  version: record.version,
  config: params.config,
  pluginConfig: params.pluginConfig,
  runtime: registryParams.runtime,
  logger: normalizeLogger(registryParams.logger),
  
  // 注册方法
  registerTool: (tool, opts) => registerTool(record, tool, opts),
  registerHook: (events, handler, opts) => registerHook(record, events, handler, opts, params.config),
  registerChannel: (registration) => registerChannel(record, registration),
  registerProvider: (provider) => registerProvider(record, provider),
  registerHttpRoute: (params) => registerHttpRoute(record, params),
  registerCli: (registrar, opts) => registerCli(record, registrar, opts),
  registerService: (service) => registerService(record, service),
  registerCommand: (command) => registerCommand(record, command),
  registerContextEngine: (id, factory) => registerContextEngine(id, factory),
  
  // 生命周期钩子
  on: (hookName, handler, opts) => registerTypedHook(record, hookName, handler, opts, params.hookPolicy),
  
  resolvePath: (input) => resolveUserPath(input),
});
```

## 插件定义结构

### package.json 配置

```json
{
  "name": "@openclaw/bluebubbles",
  "version": "2026.3.14",
  "type": "module",
  "dependencies": {
    "zod": "^4.3.6"
  },
  "openclaw": {
    "extensions": ["./index.ts"],
    "channel": {
      "id": "bluebubbles",
      "label": "BlueBubbles",
      "docsPath": "/channels/bluebubbles",
      "aliases": ["bb"],
      "order": 75
    },
    "install": {
      "npmSpec": "@openclaw/bluebubbles",
      "localPath": "extensions/bluebubbles",
      "defaultChoice": "npm"
    }
  }
}
```

### openclaw.extensions 字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `extensions` | `string[]` | 是 | 入口文件路径列表 |
| `channel` | `object` | 否 | 通道元数据（通道插件必填） |
| `install` | `object` | 否 | 安装配置 |

### 入口文件

```typescript
// extensions/bluebubbles/index.ts
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/bluebubbles";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk/bluebubbles";
import { bluebubblesPlugin } from "./src/channel.js";

const plugin = {
  id: "bluebubbles",
  name: "BlueBubbles",
  description: "BlueBubbles channel plugin (macOS app)",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    api.registerChannel({ plugin: bluebubblesPlugin });
  },
};

export default plugin;
```

### OpenClawPluginDefinition 类型

```typescript
type OpenClawPluginDefinition = {
  id?: string;              // 插件 ID（通常从 package.json 读取）
  name?: string;            // 显示名称
  description?: string;     // 描述
  version?: string;         // 版本
  kind?: PluginKind;        // "memory" | "context-engine"
  configSchema?: OpenClawPluginConfigSchema;  // 配置 Schema
  register?: (api: OpenClawPluginApi) => void | Promise<void>;  // 注册函数
  activate?: (api: OpenClawPluginApi) => void | Promise<void>;  // 激活函数（已弃用，用 register）
};
```

## 插件 API

### OpenClawPluginApi

插件注册时接收的 API 对象：

```typescript
type OpenClawPluginApi = {
  // 插件元信息
  id: string;
  name: string;
  version?: string;
  description?: string;
  source: string;
  
  // 配置访问
  config: OpenClawConfig;           // 全局配置
  pluginConfig?: Record<string, unknown>;  // 插件专属配置
  
  // 运行时
  runtime: PluginRuntime;           // 运行时 API
  logger: PluginLogger;             // 日志器
  
  // 注册方法
  registerTool(tool, opts?): void;
  registerHook(events, handler, opts?): void;
  registerChannel(registration): void;
  registerProvider(provider): void;
  registerGatewayMethod(method, handler): void;
  registerHttpRoute(params): void;
  registerCli(registrar, opts?): void;
  registerService(service): void;
  registerCommand(command): void;
  registerContextEngine(id, factory): void;
  
  // 类型化钩子
  on<K extends PluginHookName>(hookName: K, handler, opts?): void;
  
  // 工具方法
  resolvePath(input: string): string;
};
```

### registerTool

注册 AI 工具供 Agent 调用：

```typescript
// 注册单个工具
api.registerTool(myTool);

// 注册工具工厂（按需创建）
api.registerTool((ctx: OpenClawPluginToolContext) => {
  return {
    name: "my_tool",
    description: "My custom tool",
    parameters: { ... },
    execute: async (params) => { ... },
  };
}, { name: "my_tool", optional: true });

// 批量注册
api.registerTool([tool1, tool2], { names: ["tool1", "tool2"] });
```

### registerHook

注册生命周期钩子：

```typescript
// 旧式钩子（基于事件字符串）
api.registerHook("agent:message:received", async (event) => {
  // 处理消息
}, { name: "my-hook" });

// 类型化钩子（推荐）
api.on("message_received", async (event, ctx) => {
  console.log(`Message from ${event.from}: ${event.content}`);
});

api.on("before_tool_call", async (event, ctx) => {
  if (event.toolName === "dangerous_tool") {
    return { block: true, blockReason: "Blocked by plugin" };
  }
});
```

### 可用钩子列表

| 钩子名称 | 触发时机 | 用途 |
|----------|----------|------|
| `before_model_resolve` | 解析模型前 | 覆盖模型/提供商选择 |
| `before_prompt_build` | 构建 prompt 前 | 修改系统提示 |
| `before_agent_start` | Agent 启动前 | 综合修改（兼容旧版） |
| `llm_input` | LLM 请求时 | 记录输入 |
| `llm_output` | LLM 响应时 | 记录输出 |
| `agent_end` | Agent 结束时 | 清理资源 |
| `before_compaction` | 会话压缩前 | 保存状态 |
| `after_compaction` | 会话压缩后 | 恢复状态 |
| `message_received` | 收到消息时 | 消息处理 |
| `message_sending` | 发送消息前 | 修改/阻止消息 |
| `message_sent` | 发送消息后 | 记录日志 |
| `before_tool_call` | 工具调用前 | 验证/阻止调用 |
| `after_tool_call` | 工具调用后 | 记录结果 |
| `session_start` | 会话开始时 | 初始化 |
| `session_end` | 会话结束时 | 清理 |
| `gateway_start` | Gateway 启动时 | 启动服务 |
| `gateway_stop` | Gateway 停止时 | 停止服务 |

### registerChannel

注册消息通道：

```typescript
api.registerChannel({
  plugin: {
    id: "my-channel",
    capabilities: {
      send: true,
      receive: true,
      edit: true,
      delete: true,
    },
    setup: async (input) => { ... },      // 配置向导
    status: async () => { ... },          // 状态检查
    send: async (ctx) => { ... },         // 发送消息
    resolve: async (params) => { ... },   // 解析目标
    // ... 更多适配器
  },
  dock: myChannelDock,  // 可选：自定义 dock
});
```

### registerProvider

注册模型提供商：

```typescript
api.registerProvider({
  id: "my-provider",
  label: "My Provider",
  docsPath: "/providers/my-provider",
  auth: [
    {
      id: "api_key",
      label: "API Key",
      kind: "api_key",
      run: async (ctx) => {
        // 执行认证流程
        return {
          profiles: [{ profileId: "default", credential: { ... } }],
          defaultModel: "my-model",
        };
      },
    },
  ],
  discovery: {
    order: "simple",
    run: async (ctx) => {
      // 自动发现配置
      return { provider: { ... } };
    },
  },
});
```

### registerService

注册后台服务：

```typescript
api.registerService({
  id: "my-background-service",
  start: async (ctx) => {
    // 启动服务
    ctx.logger.info("Service started");
  },
  stop: async (ctx) => {
    // 停止服务
    ctx.logger.info("Service stopped");
  },
});
```

### registerCommand

注册斜杠命令：

```typescript
api.registerCommand({
  name: "tts",
  description: "Text-to-speech command",
  acceptsArgs: true,
  requireAuth: true,
  handler: async (ctx) => {
    const text = ctx.args;
    // 执行命令
    return { text: "Speech synthesized", metadata: { ... } };
  },
});
```

### registerHttpRoute

注册 HTTP 路由：

```typescript
api.registerHttpRoute({
  path: "/my-plugin/webhook",
  auth: "gateway",  // 或 "plugin"
  match: "exact",   // 或 "prefix"
  handler: async (req, res) => {
    // 处理请求
    res.writeHead(200);
    res.end("OK");
    return true;
  },
});
```

## PluginRuntime

插件运行时提供的 API：

```typescript
type PluginRuntime = {
  version: string;
  
  // 配置管理
  config: {
    loadConfig: typeof loadConfig;
    writeConfigFile: typeof writeConfigFile;
  };
  
  // 系统功能
  system: {
    enqueueSystemEvent: typeof enqueueSystemEvent;
    requestHeartbeatNow: typeof requestHeartbeatNow;
    runCommandWithTimeout: typeof runCommandWithTimeout;
  };
  
  // 媒体处理
  media: {
    loadWebMedia: typeof loadWebMedia;
    detectMime: typeof detectMime;
    isVoiceCompatibleAudio: typeof isVoiceCompatibleAudio;
    getImageMetadata: typeof getImageMetadata;
    resizeToJpeg: typeof resizeToJpeg;
  };
  
  // 语音合成/识别
  tts: { textToSpeechTelephony: typeof textToSpeechTelephony; };
  stt: { transcribeAudioFile: typeof transcribeAudioFile; };
  
  // 工具创建
  tools: {
    createMemoryGetTool: typeof createMemoryGetTool;
    createMemorySearchTool: typeof createMemorySearchTool;
  };
  
  // 事件订阅
  events: {
    onAgentEvent: typeof onAgentEvent;
    onSessionTranscriptUpdate: typeof onSessionTranscriptUpdate;
  };
  
  // 日志
  logging: {
    shouldLogVerbose: typeof shouldLogVerbose;
    getChildLogger: (bindings?, opts?) => RuntimeLogger;
  };
  
  // 状态存储
  state: {
    resolveStateDir: typeof resolveStateDir;
  };
  
  // 模型认证
  modelAuth: {
    getApiKeyForModel: (params) => Promise<ResolvedProviderAuth>;
    resolveApiKeyForProvider: (params) => Promise<ResolvedProviderAuth>;
  };
  
  // 子 Agent
  subagent: {
    run: (params: SubagentRunParams) => Promise<SubagentRunResult>;
    waitForRun: (params: SubagentWaitParams) => Promise<SubagentWaitResult>;
    getSessionMessages: (params) => Promise<SubagentGetSessionMessagesResult>;
    deleteSession: (params: SubagentDeleteSessionParams) => Promise<void>;
  };
  
  // 通道运行时
  channel: PluginRuntimeChannel;
};
```

## 插件配置

### 配置结构

```yaml
plugins:
  enabled: true
  allow:                    # 允许加载的插件 ID（空 = 允许所有）
    - my-plugin
  deny:                     # 禁止加载的插件 ID
    - dangerous-plugin
  load:
    paths:                  # 额外的加载路径
      - ./local-plugins
  slots:                    # 插槽配置（同类插件只能激活一个）
    memory: memory-lancedb  # 内存插件选择
  entries:                  # 单个插件配置
    my-plugin:
      enabled: true
      hooks:
        allowPromptInjection: false  # 禁止修改 prompt
      config:               # 插件专属配置
        apiKey: "xxx"
```

### 插件配置 Schema

```typescript
// 使用 Zod 定义配置 Schema
import { z } from "zod";

const myPluginConfigSchema = z.object({
  apiKey: z.string().min(1),
  maxRetries: z.number().int().min(0).max(10).default(3),
  timeout: z.number().positive().default(30000),
});

// 在插件中定义
const plugin = {
  id: "my-plugin",
  configSchema: {
    jsonSchema: myPluginConfigSchema,
    uiHints: {
      apiKey: {
        label: "API Key",
        help: "Your API key from the provider",
        sensitive: true,
      },
      maxRetries: {
        label: "Max Retries",
        help: "Maximum number of retry attempts",
        advanced: true,
      },
    },
  },
  register(api) {
    const config = api.pluginConfig as z.infer<typeof myPluginConfigSchema>;
    // 使用配置
  },
};
```

## 插件安装

### 从 npm 安装

```bash
openclaw plugin install @openclaw/my-plugin
```

安装流程 (`src/plugins/install.ts`)：

1. 解析 npm spec
2. 下载并解压包
3. 验证 `openclaw.extensions` 字段
4. 安装依赖 (`npm install --omit=dev`)
5. 记录安装信息到配置

### 从本地路径安装

```bash
openclaw plugin install ./local-plugin
```

### 安装结果

安装信息存储在配置中：

```yaml
plugins:
  installs:
    my-plugin:
      installPath: ~/.openclaw/plugins/my-plugin
      sourcePath: /path/to/source
      version: 1.0.0
      installedAt: "2024-01-01T00:00:00Z"
```

## 插件开发指南

### 创建新插件

1. **创建目录结构**

```
my-plugin/
├── package.json
├── index.ts
├── openclaw.plugin.json  # 可选：独立清单文件
└── src/
    └── ...
```

2. **编写 package.json**

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "zod": "^4.3.6"
  },
  "openclaw": {
    "extensions": ["./index.ts"]
  }
}
```

3. **编写入口文件**

```typescript
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

const plugin = {
  id: "my-plugin",
  name: "My Plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    api.logger.info("My plugin loaded");
    
    api.registerTool({
      name: "my_tool",
      description: "My custom tool",
      parameters: { ... },
      execute: async (params) => {
        return { result: "done" };
      },
    });
  },
};

export default plugin;
```

### 调试插件

```bash
# 开发模式运行
OPENCLAW_PLUGIN_DEBUG=1 pnpm dev

# 指定插件路径
openclaw --plugin-path ./my-plugin
```

### 最佳实践

1. **类型安全**：使用 `openclaw/plugin-sdk` 导出的类型
2. **错误处理**：所有异步操作都要 try-catch
3. **日志规范**：使用 `api.logger` 而非 `console.log`
4. **配置验证**：定义 JSON Schema 验证用户配置
5. **资源清理**：在 `gateway_stop` 钩子中清理资源

## 内置插件示例

### 通道插件 (bluebubbles)

```typescript
// extensions/bluebubbles/index.ts
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/bluebubbles";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk/bluebubbles";
import { bluebubblesPlugin } from "./src/channel.js";
import { setBlueBubblesRuntime } from "./src/runtime.js";

const plugin = {
  id: "bluebubbles",
  name: "BlueBubbles",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setBlueBubblesRuntime(api.runtime);
    api.registerChannel({ plugin: bluebubblesPlugin });
  },
};

export default plugin;
```

### 提供商插件 (ollama)

```typescript
// extensions/ollama/index.ts
import type { OpenClawPluginApi, ProviderPlugin } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

const ollamaProvider: ProviderPlugin = {
  id: "ollama",
  label: "Ollama",
  docsPath: "/providers/ollama",
  auth: [
    {
      id: "local",
      label: "Local Ollama",
      kind: "custom",
      run: async (ctx) => {
        // 本地无需认证
        return { profiles: [] };
      },
    },
  ],
  discovery: {
    order: "simple",
    run: async (ctx) => {
      // 自动发现本地 Ollama
      const baseUrl = ctx.env.OLLAMA_BASE_URL || "http://localhost:11434";
      return {
        provider: {
          id: "ollama",
          baseUrl,
        },
      };
    },
  },
};

const plugin = {
  id: "ollama",
  name: "Ollama",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    api.registerProvider(ollamaProvider);
  },
};

export default plugin;
```

## 安全考量

### 路径安全

- 所有插件路径都经过 `isPathInside` 检查
- 防止符号链接逃逸
- 非 bundled 插件拒绝硬链接

### 权限隔离

- `modelAuth` API 不暴露敏感参数（agentDir, store, profileId）
- 插件配置中的敏感字段标记为 `sensitive: true`
- `allowPromptInjection` 默认为 `false`

### 加载验证

- 非 bundled 插件检查 world-writable 权限
- 配置中的 `allow`/`deny` 列表控制加载
- 每个插件加载都有诊断记录

## 故障排查

### 插件未加载

1. 检查 `plugins.enabled` 是否为 `true`
2. 检查插件 ID 是否在 `deny` 列表中
3. 检查入口文件路径是否正确
4. 查看诊断输出：`openclaw doctor`

### 插件加载错误

```
[plugins] my-plugin failed to load: ...
```

常见原因：
- `package.json` 缺少 `openclaw.extensions` 字段
- 入口文件语法错误
- 依赖未安装（运行 `npm install`）

### 钩子未触发

检查配置：
```yaml
plugins:
  entries:
    my-plugin:
      hooks:
        allowPromptInjection: true  # 如需修改 prompt
```

## 相关文档

- [配置示例](/dev/configuration-examples)
- [通道开发指南](/channels/overview)
- [提供商开发指南](/providers/overview)