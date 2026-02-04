# OpenClaw Skills 与 Tools 架构文档

## 1. 概述

OpenClaw 的 Skills 和 Tools 是其 Agent 运行时系统的两大核心组件：

- **Skills（技能）**：预置的 prompt 模板，包含角色定义、操作指南和可选的依赖安装规范
- **Tools（工具）**：Agent 可调用的外部能力，包括文件操作、Bash 执行、网络请求、消息发送等

两者协同工作，使 Agent 能够理解任务、执行操作并完成任务。

---

## 2. Skills 架构

### 2.1 核心概念

Skills 基于 `@mariozechner/pi-coding-agent` 包实现，提供结构化的 Agent 行为定义。

```typescript
interface Skill {
  name: string;           // 技能名称
  description: string;     // 描述
  prompt: string;         // 核心 prompt 模板
  filePath: string;        // 文件路径
  baseDir: string;         // 基础目录
  source: string;          // 来源标识
}
```

### 2.2 技能来源与优先级

OpenClaw 支持多来源 Skills，优先级从低到高：

| 来源 | 目录 | 标识 |
|------|------|------|
| Extra | `config.skills.load.extraDirs` | `openclaw-extra` |
| Bundled | `resources/skills` | `openclaw-bundled` |
| Managed | `~/.openclaw/skills` | `openclaw-managed` |
| Workspace | `<workspace>/skills` | `openclaw-workspace` |

**优先级规则**：同名技能时，高优先级覆盖低优先级。

### 2.3 技能目录结构

```
skills/
├── skill-name/
│   ├── skill.md           # 技能定义（含 frontmatter）
│   ├── README.md          # 可选文档
│   └── [其他资源文件]
```

### 2.4 技能元数据 (Frontmatter)

Skills 支持 YAML frontmatter 定义扩展属性：

```yaml
---
description: Expert web developer with focus on accessibility
user-invocable: true
disable-model-invocation: false
metadata:
  always: false
  emoji: "🌐"
  primaryEnv: ""
  os: []
  requires:
    bins: []
    anyBins: []
    env: []
    config: []
  install:
    - kind: brew|node|go|uv|download
      formula: ""
      package: ""
      bins: []
---
```

**关键属性**：

| 属性 | 作用 |
|------|------|
| `user-invocable` | 是否允许用户直接调用 |
| `disable-model-invocation` | 是否禁用模型自动调用 |
| `always` | 强制包含该技能 |
| `requires.bins` | 必需的系统二进制 |
| `requires.env` | 必需的环境变量 |
| `install` | 依赖安装规格 |

### 2.5 技能配置管理

**文件**：`src/agents/skills/config.ts`

```typescript
// 技能过滤逻辑
function shouldIncludeSkill(params: {
  entry: SkillEntry;
  config?: OpenClawConfig;
  eligibility?: SkillEligibilityContext;
}): boolean {
  // 1. 检查是否被禁用
  if (skillConfig?.enabled === false) return false;
  
  // 2. 检查 bundled allowlist
  if (!isBundledSkillAllowed(entry, allowlist)) return false;
  
  // 3. 检查操作系统
  if (osList.length > 0 && !osList.includes(runtimePlatform)) return false;
  
  // 4. 检查必需二进制
  for (const bin of requiredBins) {
    if (!hasBinary(bin)) return false;
  }
  
  // 5. 检查必需环境变量
  for (const envName of requiredEnv) {
    if (!process.env[envName]) return false;
  }
  
  return true;
}
```

### 2.6 技能快照与热加载

**文件**：`src/agents/skills/refresh.ts`

```typescript
// 技能变化监听
function ensureSkillsWatcher(params: { workspaceDir: string; config?: OpenClawConfig }) {
  const watcher = chokidar.watch(watchPaths, {
    ignored: DEFAULT_SKILLS_WATCH_IGNORED,
    awaitWriteFinish: { stabilityThreshold: debounceMs },
  });
  
  watcher.on("add", () => bumpSkillsSnapshotVersion());
  watcher.on("change", () => bumpSkillsSnapshotVersion());
  watcher.on("unlink", () => bumpSkillsSnapshotVersion());
}
```

**监听路径**：
- `<workspace>/skills`
- `~/.openclaw/skills`
- `config.skills.load.extraDirs`
- 插件技能目录

### 2.7 技能命令注册

**文件**：`src/agents/skills/workspace.ts`

```typescript
function buildWorkspaceSkillCommandSpecs(workspaceDir: string): SkillCommandSpec[] {
  // 过滤合格技能
  const eligible = filterSkillEntries(entries, config, skillFilter);
  
  // 清理命令名称
  const base = sanitizeSkillCommandName(rawName); // a-z0-9_
  
  // 去重
  const unique = resolveUniqueSkillCommandName(base, used);
  
  // 生成命令规范
  return {
    name: unique,           // /skill-name
    skillName: rawName,     // Original name
    description,
    dispatch?: { kind: "tool", toolName: "..." }
  };
}
```

### 2.8 技能同步

```typescript
async function syncSkillsToWorkspace(source, target) {
  const entries = loadSkillEntries(source);
  
  for (const entry of entries) {
    const dest = path.join(target, "skills", entry.skill.name);
    await fsp.cp(entry.skill.baseDir, dest, { recursive: true });
  }
}
```

---

## 3. Tools 架构

### 3.1 工具类型体系

```
AnyAgentTool (AgentTool)
├── Coding Tools (pi-coding-agent)
│   ├── read
│   ├── write
│   ├── edit
│   └── bash/exec
├── Web Tools
│   ├── web_fetch
│   ├── web_search
│   └── browser
├── Channel Tools
│   ├── message_send
│   ├── message_edit
│   ├── message_react
│   └── thread_reply
├── System Tools
│   ├── process
│   ├── cron
│   └── tts
├── Agent Tools
│   ├── sessions_spawn
│   ├── sessions_list
│   └── sessions_history
└── Image/Canvas Tools
    ├── image_analysis
    └── canvas
```

### 3.2 工具创建工厂

**核心入口**：`src/agents/pi-tools.ts`

```typescript
function createOpenClawCodingTools(options?: {
  exec?: ExecToolDefaults;
  sandbox?: SandboxContext;
  config?: OpenClawConfig;
  modelProvider?: string;
  modelId?: string;
  groupId?: string;
  senderId?: string;
  // ...更多上下文
}): AnyAgentTool[]
```

### 3.3 工具分类详解

#### 3.3.1 Coding Tools (编码工具)

```typescript
// 基于 pi-coding-agent 的核心工具
const base = codingTools.flatMap((tool) => {
  if (tool.name === readTool.name) {
    return sandboxRoot 
      ? [createSandboxedReadTool(sandboxRoot)]
      : [createOpenClawReadTool(createReadTool(workspaceRoot))];
  }
  if (tool.name === "write") {
    return [wrapToolParamNormalization(createWriteTool(workspaceRoot), ...)];
  }
  if (tool.name === "edit") {
    return [wrapToolParamNormalization(createEditTool(workspaceRoot), ...)];
  }
  return [tool];
});
```

#### 3.3.2 Exec Tool (执行工具)

```typescript
// 文件：src/agents/bash-tools/exec.ts
const execTool = createExecTool({
  host: execConfig.host,
  security: execConfig.security,
  ask: execConfig.ask,
  node: execConfig.node,
  pathPrepend: execConfig.pathPrepend,
  safeBins: execConfig.safeBins,
  agentId,
  cwd: workspaceDir,
  allowBackground,
  scopeKey,
  sessionKey,
  backgroundMs,
  timeoutSec,
  sandbox: sandbox ? { containerName, workspaceDir, env } : undefined,
});
```

#### 3.3.3 Web Tools (网络工具)

```typescript
// 文件：src/agents/tools/web-tools.ts
export const createWebFetchTool = (options?: {
  browserEnabled?: boolean;
  evaluateEnabled?: boolean;
  readabilityEnabled?: boolean;
}) => ({
  name: "web_fetch",
  description: "Fetch URL content",
  parameters: Type.Object({
    url: Type.String(),
    query: Type.Optional(Type.String()),
    // ...
  }),
  async execute(params) {
    // 实现
  }
});

export const createWebSearchTool = () => ({
  name: "web_search",
  description: "Search the web",
  parameters: Type.Object({ query: Type.String() }),
  async execute(params) {
    // 实现
  }
});
```

#### 3.3.4 Channel Tools (消息通道工具)

```typescript
// 文件：src/agents/tools/message-tool.ts
export const createMessageTool = (options: {
  provider: string;
  accountId: string;
  threadId?: string;
}) => ({
  name: "message_send",
  parameters: Type.Object({
    text: Type.String(),
    mentions: Type.Optional(Type.Array(Type.String())),
    // ...
  }),
  async execute(params) {
    const target = resolveMessagingTarget(options.provider, params.target);
    return await sendChannelMessage(options.provider, {
      ...params,
      accountId: options.accountId,
      threadId: options.threadId,
    });
  }
});
```

#### 3.3.5 Session Tools (会话工具)

```typescript
// sessions-send-tool.ts
export const createSessionsSendTool = () => ({
  name: "sessions_send",
  parameters: Type.Object({
    sessionKey: Type.String(),
    text: Type.String(),
    // ...
  }),
  async execute(params) {
    // 跨会话发送消息
  }
});

// sessions-spawn-tool.ts
export const createSessionsSpawnTool = () => ({
  name: "sessions_spawn",
  parameters: Type.Object({
    agentId: Type.String(),
    model: Type.Optional(Type.String()),
    message: Type.String(),
    // ...
  }),
  async execute(params) {
    // 创建子会话
    const childKey = await spawnSubagentSession(params);
  }
});
```

#### 3.3.6 Browser Tool (浏览器工具)

```typescript
// 文件：src/agents/tools/browser-tool.ts
export const createBrowserTool = (options: {
  bridgeUrl?: string;
  allowControl?: boolean;
}) => ({
  name: "browser",
  parameters: Type.Object({
    action: Type.Union([
      Type.Literal("navigate"),
      Type.Literal("click"),
      Type.Literal("type"),
      Type.Literal("screenshot"),
      // ...
    ]),
    selector: Type.Optional(Type.String()),
    url: Type.Optional(Type.String()),
    // ...
  }),
  async execute(params) {
    // 通过 CDP 协议控制浏览器
  }
});
```

### 3.4 工具参数处理

**文件**：`src/agents/tools/common.ts`

```typescript
// 参数读取工具函数
export function readStringParam(
  params: Record<string, unknown>,
  key: string,
  options?: { required?: boolean; trim?: boolean; label?: string }
): string | undefined

export function readNumberParam(
  params: Record<string, unknown>,
  key: string,
  options?: { required?: boolean; integer?: boolean }
): number | undefined

export function readStringArrayParam(
  params: Record<string, unknown>,
  key: string,
  options?: StringParamOptions
): string[] | undefined

export function jsonResult(payload: unknown): AgentToolResult<unknown>
export async function imageResult(params: {...}): AgentToolResult<unknown>
```

### 3.5 工具策略过滤

**文件**：`src/agents/pi-tools/policy.ts`

```typescript
function filterToolsByPolicy(tools: AnyAgentTool[], policy: ToolPolicy): AnyAgentTool[] {
  if (!policy?.allow?.length) return tools;
  
  const allowedSet = new Set(policy.allow.map(normalizeToolName));
  return tools.filter((tool) => allowedSet.has(normalizeToolName(tool.name)));
}

// 策略层级
const policies = [
  profilePolicy,           // CLI profile 级别
  providerProfilePolicy,   // provider profile 级别
  globalPolicy,            // 全局级别
  globalProviderPolicy,
  agentPolicy,             // agent 配置级别
  agentProviderPolicy,
  groupPolicy,             // 群组级别
  sandboxPolicy,           // 沙箱配置级别
  subagentPolicy,          // 子 agent 级别
];
```

### 3.6 工具钩子

```typescript
// 执行前钩子
wrapToolWithBeforeToolCallHook(tool, {
  agentId,
  sessionKey,
});

// 中止信号包装
wrapToolWithAbortSignal(tool, abortSignal);
```

---

## 4. Skills 与 Tools 协作流程

### 4.1 Agent 初始化流程

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent 初始化                              │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. 加载 Skills                                                 │
│    loadSkillEntries() → 解析 frontmatter → 过滤合格技能      │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. 构建 Skills Prompt                                         │
│    buildWorkspaceSkillsPrompt() → 组合所有技能 prompt          │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. 创建 Tools                                                 │
│    createOpenClawCodingTools() → 注入上下文 → 策略过滤        │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. 启动 Agent                                                 │
│    piEmbeddedRunner.run({ prompt, tools })                   │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Skills Prompt 构建

```typescript
function buildWorkspaceSkillsPrompt(workspaceDir: string): string {
  const entries = loadSkillEntries(workspaceDir);
  const eligible = filterSkillEntries(entries, config);
  
  // 过滤禁用的模型调用技能
  const promptEntries = eligible.filter(
    (entry) => entry.invocation?.disableModelInvocation !== true
  );
  
  return formatSkillsForPrompt(promptEntries.map((e) => e.skill));
}
```

### 4.3 Skills 到 Tools 的桥接

Skill 可以通过 `command-dispatch` frontmatter 映射到工具：

```yaml
---
command-dispatch: tool
command-tool: sessions_spawn
command-arg-mode: raw
---
```

这使得：
1. 用户可通过 `/skill-name` 命令直接调用
2. 命令被转发到指定工具执行
3. 保留参数原始格式

### 4.4 完整执行流程图

```
用户输入
    │
    ▼
┌────────────────┐
│  命令路由       │ → /skill-name → 执行 skill command dispatch
└───────┬────────┘
        │
        ▼
┌────────────────┐
│  Agent 接收     │ → piEmbeddedRunner.run()
└───────┬────────┘
        │
        ▼
┌────────────────┐
│  工具选择       │ → 根据 prompt 和上下文选择工具
└───────┬────────┘
        │
        ▼
┌────────────────┐
│  工具执行       │ → read/write/exec/message_send/sessions_spawn/...
└───────┬────────┘
        │
        ▼
┌────────────────┐
│  结果处理       │ → 格式化响应 → 流式返回
└───────┬────────┘
        │
        ▼
┌────────────────┐
│  消息发送       │ → 通过通道发送结果
└────────────────┘
```

---

## 5. Sandbox 集成

### 5.1 沙箱上下文

```typescript
interface SandboxContext {
  enabled: boolean;
  containerName: string;
  workspaceDir: string;
  containerWorkdir: string;
  docker: {
    image: string;
    env: Record<string, string>;
  };
  browser?: {
    bridgeUrl: string;
  };
  tools: ToolPolicy;
  workspaceAccess: "ro" | "rw";
}
```

### 5.2 沙箱工具适配

```typescript
// 沙箱化工具创建
if (sandboxRoot) {
  // 使用沙箱 read
  tools.push(createSandboxedReadTool(sandboxRoot));
  
  // 沙箱化 write/edit（仅 rw 模式）
  if (allowWorkspaceWrites) {
    tools.push(
      createSandboxedWriteTool(sandboxRoot),
      createSandboxedEditTool(sandboxRoot)
    );
  }
}
```

### 5.3 技能同步到沙箱

```typescript
async function syncSkillsToSandbox(sandboxRoot: string) {
  const entries = loadSkillEntries(workspaceDir);
  
  for (const entry of entries) {
    const dest = path.join(sandboxRoot, "skills", entry.skill.name);
    await fsp.cp(entry.skill.baseDir, dest, { recursive: true });
  }
}
```

---

## 6. 配置文件

### 6.1 Skills 配置

```json
{
  "skills": {
    "enabled": true,
    "allowBundled": ["*"],
    "entries": {
      "skill-name": {
        "enabled": true,
        "env": { "API_KEY": "..." }
      }
    },
    "load": {
      "extraDirs": ["/path/to/extra-skills"],
      "watch": true,
      "watchDebounceMs": 250
    }
  }
}
```

### 6.2 Tools 配置

```json
{
  "tools": {
    "allow": ["read", "write", "exec"],
    "byProvider": {
      "anthropic": {
        "allow": ["read", "exec"]
      }
    },
    "exec": {
      "security": "ask",
      "timeoutSec": 600,
      "safeBins": ["git", "node", "pnpm"],
      "applyPatch": {
        "enabled": true,
        "allowModels": ["sonnet-4"]
      }
    }
  }
}
```

---

## 7. 关键文件索引

| 功能 | 文件路径 |
|------|----------|
| 技能类型定义 | `src/agents/skills/types.ts` |
| 技能加载与过滤 | `src/agents/skills/workspace.ts` |
| 技能配置解析 | `src/agents/skills/config.ts` |
| Frontmatter 解析 | `src/agents/skills/frontmatter.ts` |
| 技能热加载 | `src/agents/skills/refresh.ts` |
| 工具创建工厂 | `src/agents/pi-tools.ts` |
| 工具公共函数 | `src/agents/tools/common.ts` |
| Web 工具 | `src/agents/tools/web-tools.ts` |
| 工具策略 | `src/agents/pi-tools/policy.ts` |
| 沙箱管理 | `src/agents/sandbox/*.ts` |

---

## 8. 扩展机制

### 8.1 自定义 Skills

在 `skills/` 目录创建 `.md` 文件：

```markdown
---
description: My Custom Skill
user-invocable: true
metadata:
  emoji: "🔧"
  requires:
    bins: ["jq"]
---
You are a helpful assistant specialized in JSON processing.
You can use jq to transform and filter JSON data.
```

### 8.2 插件工具注册

```typescript
// 在插件中注册工具
export function registerTools(): ChannelAgentToolFactory {
  return (ctx) => ({
    name: "my_custom_tool",
    description: "A custom tool",
    parameters: Type.Object({ ... }),
    async execute(params) { ... }
  });
}
```

---

## 9. 最佳实践

1. **技能命名**：使用 kebab-case，如 `web-developer`
2. **工具过滤**：通过 `tools.allow` 最小化可用工具
3. **安全执行**：`exec.security` 设置为 `ask` 或 `safe`
4. **技能同步**：沙箱中只同步必要技能
5. **参数验证**：使用 `readStringParam` 等工具函数
