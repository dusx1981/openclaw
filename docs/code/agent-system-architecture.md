# Agent 系统架构

OpenClaw Agent 系统是一个多智能体、可扩展的 AI 执行框架，支持多模型、多工作区和沙箱隔离。它通过配置驱动的架构实现灵活的 Agent 定义、路由和执行。

## 概述

Agent 系统作为 OpenClaw 的**智能执行层**，具有以下主要职责：

| 职责 | 描述 |
|------|-------------|
| **Agent 定义** | 通过配置定义多个独立的 Agent，每个 Agent 有自己的工作区和配置 |
| **消息路由** | 根据绑定规则将入站消息路由到正确的 Agent |
| **会话管理** | 管理会话生命周期，支持多会话类型（DM、群组、线程） |
| **模型选择** | 支持多模型配置和自动降级 |
| **工具系统** | 为 Agent 提供文件操作、消息发送、浏览器控制等工具 |
| **沙箱隔离** | 支持 Docker 沙箱隔离，保护主机安全 |
| **系统提示** | 动态构建系统提示，注入上下文和约束 |
| **记忆集成** | 集成记忆系统，支持语义搜索 |

## 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                      配置与定义层                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ AgentConfig │  │ AgentBinding│  │  AgentDefaultsConfig    │  │
│  │ (多Agent)   │  │ (路由绑定)  │  │  (默认值)               │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      路由解析层                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ resolveRoute│  │ SessionKey  │  │  Bindings 匹配          │  │
│  │ (确定Agent) │  │ (会话标识)  │  │  peer/guild/team        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Agent 执行层                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  Agent Scope (作用域)                    │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐   │    │
│  │  │ workspace│  │ agentDir │  │ model    │  │ tools  │   │    │
│  │  │ 工作区   │  │ 配置目录 │  │ 模型配置 │  │ 工具集 │   │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  Pi Embedded Runner                      │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐   │    │
│  │  │ 系统提示 │  │ 工具执行 │  │ 模型调用 │  │ 沙箱   │   │    │
│  │  │ 构建     │  │ 循环     │  │ 流式响应 │  │ 隔离   │   │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      输出与状态层                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ 消息投递    │  │ 会话状态    │  │    事件流               │  │
│  │ (多通道)    │  │ (持久化)    │    (AgentEvent)           │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 核心组件

### 1. Agent 配置 (`src/config/types.agents.ts`)

Agent 配置采用分层设计，支持多 Agent 和默认配置覆盖：

```typescript
// 单个 Agent 配置
type AgentConfig = {
  id: string;                    // Agent 唯一标识（如 "main", "work", "personal"）
  default?: boolean;             // 是否为默认 Agent
  name?: string;                 // 显示名称
  workspace?: string;            // 工作区目录（覆盖默认值）
  agentDir?: string;             // Agent 配置目录
  model?: AgentModelConfig;      // 模型配置（可覆盖）
  memorySearch?: MemorySearchConfig;  // 记忆搜索配置
  identity?: IdentityConfig;     // 身份配置（名称、主题、emoji）
  groupChat?: GroupChatConfig;   // 群聊提及模式配置
  subagents?: {                  // 子 Agent 配置
    allowAgents?: string[];      // 允许派生的 Agent ID 列表
    model?: string | { primary?: string; fallbacks?: string[] };
  };
  sandbox?: {                    // 沙箱配置（覆盖）
    mode?: "off" | "non-main" | "all";
    workspaceAccess?: "none" | "ro" | "rw";
    sessionToolsVisibility?: "spawned" | "all";
    scope?: "session" | "agent" | "shared";
    docker?: SandboxDockerSettings;
    browser?: SandboxBrowserSettings;
  };
  tools?: AgentToolsConfig;      // 工具策略配置
};

// Agent 列表配置
type AgentsConfig = {
  defaults?: AgentDefaultsConfig;  // 所有 Agent 的默认值
  list?: AgentConfig[];            // Agent 定义列表
};

// 绑定规则（路由）
type AgentBinding = {
  agentId: string;               // 目标 Agent ID
  match: {
    channel: string;             // 通道类型（whatsapp, telegram 等）
    accountId?: string;          // 账号 ID（多账号时）
    peer?: { kind: "dm" | "group" | "channel"; id: string };  // 对等方
    guildId?: string;            // Discord 服务器
    teamId?: string;             // Slack 团队
  };
};
```

#### 1.1 配置层级与覆盖

```
agents.defaults                    # 全局默认值
├── model                          # 默认模型
├── workspace                      # 默认工作区
├── memorySearch                   # 默认记忆配置
├── sandbox                        # 默认沙箱配置
└── ...

agents.list[]                      # 每个 Agent 的覆盖
├── id = "main"                    # Agent 标识
├── workspace (覆盖)               # 特定工作区
├── model (覆盖)                   # 特定模型
├── sandbox (覆盖)                 # 特定沙箱
└── ...
```

**路径解析优先级：**

| 配置项 | 默认值 | Agent 覆盖值 | 最终值 |
|--------|--------|--------------|--------|
| `workspace` | `~/.openclaw/workspace` | `~/workspaces/work` | `~/workspaces/work` |
| `agentDir` | `~/.openclaw/agents/{id}/agent` | `/custom/agent` | `/custom/agent` |
| `model` | `anthropic/claude-3-5-sonnet` | `openai/gpt-4o` | `openai/gpt-4o` |

### 2. Agent 作用域 (`src/agents/agent-scope.ts`)

Agent 作用域负责解析 Agent 的配置和路径：

```typescript
// 解析 Agent 配置（支持层级覆盖）
export function resolveAgentConfig(
  cfg: OpenClawConfig,
  agentId: string,
): ResolvedAgentConfig | undefined {
  const entry = resolveAgentEntry(cfg, id);
  return {
    name: entry.name,
    workspace: entry.workspace,
    agentDir: entry.agentDir,
    model: entry.model,
    memorySearch: entry.memorySearch,
    sandbox: entry.sandbox,
    tools: entry.tools,
    // ...
  };
}

// 解析工作区目录
export function resolveAgentWorkspaceDir(cfg: OpenClawConfig, agentId: string): string {
  // 1. 检查 Agent 特定配置
  const configured = resolveAgentConfig(cfg, id)?.workspace?.trim();
  if (configured) return resolveUserPath(configured);
  
  // 2. 默认 Agent 使用全局默认值
  if (id === defaultAgentId) {
    const fallback = cfg.agents?.defaults?.workspace?.trim();
    if (fallback) return resolveUserPath(fallback);
    return DEFAULT_AGENT_WORKSPACE_DIR;  // ~/.openclaw/workspace
  }
  
  // 3. 其他 Agent 使用命名工作区
  return path.join(os.homedir(), ".openclaw", `workspace-${id}`);
}

// 解析 Agent 配置目录
export function resolveAgentDir(cfg: OpenClawConfig, agentId: string): string {
  const configured = resolveAgentConfig(cfg, id)?.agentDir?.trim();
  if (configured) return resolveUserPath(configured);
  return path.join(stateDir, "agents", id, "agent");  // ~/.openclaw/agents/{id}/agent
}

// 解析会话关联的 Agent ID
export function resolveSessionAgentId(params: {
  sessionKey?: string;
  config?: OpenClawConfig;
}): string {
  const parsed = sessionKey ? parseAgentSessionKey(sessionKey) : null;
  return parsed?.agentId ? normalizeAgentId(parsed.agentId) : defaultAgentId;
}
```

### 3. 路由解析 (`src/routing/resolve-route.ts`)

消息路由系统根据绑定规则确定消息应该由哪个 Agent 处理：

```typescript
// 路由输入参数
type ResolveAgentRouteInput = {
  cfg: OpenClawConfig;
  channel: string;               // 通道（whatsapp, telegram, discord...）
  accountId?: string | null;     // 账号 ID
  peer?: RoutePeer | null;       // 对等方（DM/群组/频道）
  parentPeer?: RoutePeer | null; // 父对等方（线程）
  guildId?: string | null;       // Discord 服务器
  teamId?: string | null;        // Slack 团队
};

// 路由结果
type ResolvedAgentRoute = {
  agentId: string;               // 选中的 Agent ID
  channel: string;               // 通道
  accountId: string;             // 账号
  sessionKey: string;            // 会话标识（用于持久化）
  mainSessionKey: string;        // 主会话标识
  matchedBy:                     // 匹配方式（用于调试）
    | "binding.peer"
    | "binding.peer.parent"
    | "binding.guild"
    | "binding.team"
    | "binding.account"
    | "binding.channel"
    | "default";
};

// 路由解析算法
export function resolveAgentRoute(input: ResolveAgentRouteInput): ResolvedAgentRoute {
  // 1. 过滤匹配的绑定规则
  const bindings = listBindings(input.cfg).filter((binding) => {
    return matchesChannel(binding.match, channel) &&
           matchesAccountId(binding.match?.accountId, accountId);
  });
  
  // 2. 优先级匹配（从高到低）
  // peer 匹配（特定对话）
  if (peer) {
    const peerMatch = bindings.find((b) => matchesPeer(b.match, peer));
    if (peerMatch) return choose(peerMatch.agentId, "binding.peer");
  }
  
  // 父 peer 匹配（线程继承）
  if (parentPeer) {
    const parentMatch = bindings.find((b) => matchesPeer(b.match, parentPeer));
    if (parentMatch) return choose(parentMatch.agentId, "binding.peer.parent");
  }
  
  // guild/team 匹配
  if (guildId) {
    const guildMatch = bindings.find((b) => matchesGuild(b.match, guildId));
    if (guildMatch) return choose(guildMatch.agentId, "binding.guild");
  }
  
  // account 匹配
  const accountMatch = bindings.find((b) => 
    b.match?.accountId?.trim() !== "*" && 
    !b.match?.peer && 
    !b.match?.guildId && 
    !b.match?.teamId
  );
  if (accountMatch) return choose(accountMatch.agentId, "binding.account");
  
  // 通配符匹配
  const anyMatch = bindings.find((b) => 
    b.match?.accountId?.trim() === "*" && 
    !b.match?.peer && 
    !b.match?.guildId && 
    !b.match?.teamId
  );
  if (anyMatch) return choose(anyMatch.agentId, "binding.channel");
  
  // 默认 Agent
  return choose(resolveDefaultAgentId(input.cfg), "default");
}
```

**绑定匹配优先级：**

```
1. binding.peer          # 特定对话（DM/群组/频道）
2. binding.peer.parent   # 父对话（线程继承）
3. binding.guild         # Discord 服务器
4. binding.team          # Slack 团队
5. binding.account       # 特定账号
6. binding.channel       # 通道通配符（accountId="*"）
7. default               # 默认 Agent
```

### 4. 会话标识 (`src/routing/session-key.ts`)

会话标识符（Session Key）是 Agent 会话的唯一标识，用于状态持久化：

```typescript
// 会话 Key 结构：
// agent:{agentId}:{mainKey}                                    # 主会话
// agent:{agentId}:{channel}:{accountId}:dm:{peerId}           # DM 会话（完整）
// agent:{agentId}:{channel}:dm:{peerId}                       # DM 会话（简化）
// agent:{agentId}:dm:{peerId}                                 # DM 会话（最简单）
// agent:{agentId}:{channel}:{kind}:{peerId}                   # 群组/频道会话
// agent:{agentId}:{channel}:{kind}:{peerId}:thread:{id}       # 线程会话

// 构建主会话 Key
export function buildAgentMainSessionKey(params: {
  agentId: string;
  mainKey?: string;
}): string {
  return `agent:${normalizeAgentId(params.agentId)}:${mainKey ?? "main"}`;
}

// 构建对等方会话 Key
export function buildAgentPeerSessionKey(params: {
  agentId: string;
  channel: string;
  accountId?: string | null;
  peerKind?: "dm" | "group" | "channel" | null;
  peerId?: string | null;
  dmScope?: "main" | "per-peer" | "per-channel-peer" | "per-account-channel-peer";
}): string {
  // DM 会话有不同作用域级别
  if (peerKind === "dm") {
    switch (dmScope) {
      case "per-account-channel-peer":
        return `agent:${agentId}:${channel}:${accountId}:dm:${peerId}`;
      case "per-channel-peer":
        return `agent:${agentId}:${channel}:dm:${peerId}`;
      case "per-peer":
        return `agent:${agentId}:dm:${peerId}`;
      case "main":
      default:
        return buildAgentMainSessionKey({ agentId, mainKey: "main" });
    }
  }
  // 群组/频道会话
  return `agent:${agentId}:${channel}:${peerKind}:${peerId}`;
}

// 从会话 Key 解析 Agent ID
export function resolveAgentIdFromSessionKey(sessionKey: string): string {
  const parsed = parseAgentSessionKey(sessionKey);
  return normalizeAgentId(parsed?.agentId ?? "main");
}
```

**DM 作用域配置：**

```typescript
// session.dmScope 控制 DM 会话的隔离级别
{
  session: {
    dmScope: "main"                        // 所有 DM 共享一个会话
    // dmScope: "per-peer"                 // 每个联系人一个会话
    // dmScope: "per-channel-peer"         // 每个通道+联系人一个会话
    // dmScope: "per-account-channel-peer" // 最细粒度（账号+通道+联系人）
  }
}
```

### 5. Agent 默认值配置 (`src/config/types.agent-defaults.ts`)

全局默认值配置，影响所有 Agent：

```typescript
type AgentDefaultsConfig = {
  // 模型配置
  model?: AgentModelListConfig;           // 主模型和降级
  imageModel?: AgentModelListConfig;      // 图像模型
  models?: Record<string, AgentModelEntryConfig>;  // 模型目录
  
  // 工作区配置
  workspace?: string;                     // 默认工作区
  repoRoot?: string;                      // 仓库根目录
  skipBootstrap?: boolean;                // 跳过引导文件创建
  bootstrapMaxChars?: number;             // 引导文件最大字符数
  
  // 时间和时区
  userTimezone?: string;                  // 用户时区
  timeFormat?: "auto" | "12" | "24";     // 时间格式
  
  // 行为和交互
  thinkingDefault?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  verboseDefault?: "off" | "on" | "full";
  elevatedDefault?: "off" | "on" | "ask" | "full";
  humanDelay?: HumanDelayConfig;          // 类人延迟
  
  // 流式回复
  blockStreamingDefault?: "off" | "on";
  blockStreamingChunk?: BlockStreamingChunkConfig;
  
  // 上下文管理
  contextPruning?: AgentContextPruningConfig;  // 上下文剪枝
  compaction?: AgentCompactionConfig;          // 压缩配置
  
  // 记忆搜索
  memorySearch?: MemorySearchConfig;
  
  // 心跳任务
  heartbeat?: {
    every?: string;                       // 间隔（如 "30m"）
    activeHours?: { start?: string; end?: string; timezone?: string };
    model?: string;                       // 心跳专用模型
    session?: string;                     // 目标会话
    target?: "last" | "none" | ChannelId; // 投递目标
    prompt?: string;                      // 心跳提示词
  };
  
  // 并发控制
  maxConcurrent?: number;                 // 最大并发运行数
  subagents?: {
    maxConcurrent?: number;               // 子 Agent 并发
    archiveAfterMinutes?: number;         // 自动归档时间
    model?: string | { primary?: string; fallbacks?: string[] };
  };
  
  // 沙箱配置
  sandbox?: {
    mode?: "off" | "non-main" | "all";   // 沙箱模式
    workspaceAccess?: "none" | "ro" | "rw";  // 工作区访问
    sessionToolsVisibility?: "spawned" | "all";  // 会话工具可见性
    scope?: "session" | "agent" | "shared";    // 隔离范围
    docker?: SandboxDockerSettings;       // Docker 配置
    browser?: SandboxBrowserSettings;     // 浏览器配置
  };
};
```

### 6. 系统提示构建 (`src/agents/system-prompt.ts`)

动态构建 Agent 的系统提示，根据模式和可用工具注入不同内容：

```typescript
export type PromptMode = "full" | "minimal" | "none";

export function buildAgentSystemPrompt(params: {
  workspaceDir: string;
  promptMode?: PromptMode;              // "full" | "minimal" | "none"
  availableTools: Set<string>;          // 可用工具集合
  skillsPrompt?: string;                // 技能提示
  ownerNumbers?: string[];              // 拥有者号码
  userTimezone?: string;                // 用户时区
  runtimeInfo?: {
    agentId?: string;
    host?: string;
    os?: string;
    arch?: string;
    model?: string;
    channel?: string;
  };
  sandboxInfo?: {
    enabled: boolean;
    workspaceDir?: string;
    workspaceAccess?: "none" | "ro" | "rw";
  };
  // ...
}): string {
  const sections: string[] = [];
  
  // 根据模式添加不同部分
  if (mode !== "none") {
    sections.push(...buildRuntimeSection({...}));      // 运行时信息
    sections.push(...buildSkillsSection({...}));       // 技能（仅 full）
    sections.push(...buildMemorySection({...}));       // 记忆（仅 full）
    sections.push(...buildSafetySection());            // 安全（所有）
    sections.push(...buildWorkspaceSection({...}));    // 工作区（所有）
    sections.push(...buildSandboxSection({...}));      // 沙箱（所有）
    sections.push(...buildToolingSection({...}));      // 工具说明
    sections.push(...buildMessagingSection({...}));    // 消息（仅 full）
  }
  
  return sections.join("\n");
}
```

**提示模式：**

| 模式 | 用途 | 包含内容 |
|------|------|----------|
| `full` | 主 Agent | 所有部分（技能、记忆、消息、安全、工具） |
| `minimal` | 子 Agent | 精简部分（工具、安全、工作区、沙箱） |
| `none` | 特殊场景 | 仅运行时信息 |

### 7. 工具系统 (`src/agents/tools/`)

Agent 通过工具与外部世界交互，工具系统高度可配置：

```typescript
// 工具配置
type AgentToolsConfig = {
  profile?: ToolProfileId;              // 工具配置文件（minimal/coding/messaging/full）
  allow?: string[];                     // 允许的工具白名单
  alsoAllow?: string[];                 // 额外允许的工具
  deny?: string[];                      // 拒绝的工具黑名单
  elevated?: {                          // 高权限工具配置
    enabled?: boolean;
    default?: "on" | "off" | "ask" | "full";
    allowFrom?: AgentElevatedAllowFromConfig;
  };
  agentToAgent?: {                      // Agent 间通信
    enabled?: boolean;
    allow?: string[];                   // 允许通信的 Agent 列表
  };
  webFetch?: WebFetchToolsConfig;       // 网页获取配置
  webSearch?: WebSearchToolsConfig;     // 网页搜索配置
  bash?: BashToolsConfig;               // Bash 执行配置
  read?: ReadToolConfig;                // 文件读取配置
  // ...
};
```

**工具配置文件：**

| 配置文件 | 描述 | 适用场景 |
|----------|------|----------|
| `minimal` | 最小工具集 | 受限环境 |
| `coding` | 代码开发工具 | 编程任务 |
| `messaging` | 消息通信工具 | 聊天机器人 |
| `full` | 完整工具集 | 无限制 |

**核心工具：**

| 工具 | 功能 | 沙箱支持 |
|------|------|----------|
| `read` | 读取文件 | 是 |
| `write` | 写入文件 | 是 |
| `edit` | 编辑文件 | 是 |
| `apply_patch` | 应用补丁 | 是 |
| `exec` | 执行命令 | 是 |
| `bash` | Bash 执行 | 是 |
| `browser` | 浏览器控制 | 是 |
| `whatsapp` | WhatsApp 操作 | 否（通道工具） |
| `telegram` | Telegram 操作 | 否（通道工具） |
| `sessions_send` | 跨会话消息 | 受 sandbox.sessionToolsVisibility 限制 |
| `sessions_spawn` | 派生子 Agent | 受 subagents.allowAgents 限制 |
| `memory_search` | 记忆搜索 | 否 |
| `memory_get` | 记忆读取 | 否 |

### 8. 沙箱系统 (`src/config/types.sandbox.ts`)

Docker 沙箱为 Agent 提供隔离执行环境：

```typescript
type SandboxDockerSettings = {
  image?: string;                       // Docker 镜像
  containerPrefix?: string;             // 容器名前缀
  workdir?: string;                     // 容器内工作目录（默认 /workspace）
  readOnlyRoot?: boolean;               // 只读根文件系统
  network?: string;                     // 网络模式（bridge/none/custom）
  user?: string;                        // 运行用户（uid:gid）
  capDrop?: string[];                   // 丢弃的 Linux capabilities
  env?: Record<string, string>;         // 环境变量
  memory?: string | number;             // 内存限制
  cpus?: number;                        // CPU 限制
  seccompProfile?: string;              // Seccomp 配置
  apparmorProfile?: string;             // AppArmor 配置
  binds?: string[];                     // 额外挂载
};

type SandboxBrowserSettings = {
  enabled?: boolean;
  image?: string;                       // 浏览器镜像
  cdpPort?: number;                     // Chrome DevTools 端口
  vncPort?: number;                     // VNC 端口
  headless?: boolean;                   // 无头模式
  allowHostControl?: boolean;           // 允许控制主机浏览器
};
```

**沙箱模式：**

| 模式 | 描述 | 适用场景 |
|------|------|----------|
| `off` | 禁用沙箱 | 可信环境 |
| `non-main` | 仅非主会话使用沙箱 | 默认（保护主会话性能） |
| `all` | 所有会话使用沙箱 | 最高安全性 |

**隔离范围：**

| 范围 | 描述 |
|------|------|
| `session` | 每个会话独立容器/工作区 |
| `agent` | 每个 Agent 共享容器/工作区 |
| `shared` | 所有 Agent 共享容器/工作区 |

### 9. Pi Embedded Runner (`src/agents/pi-embedded-runner/`)

核心的 Agent 执行引擎，负责运行 LLM 会话：

```typescript
// Agent 运行参数
type RunEmbeddedPiAgentParams = {
  sessionId: string;                    // 会话 ID
  sessionKey?: string;                  // 会话标识
  workspaceDir: string;                 // 工作区目录
  agentDir?: string;                    // Agent 配置目录
  provider?: string;                    // 模型提供商
  model?: string;                       // 模型 ID
  tools?: AnyAgentTool[];               // 可用工具
  systemPrompt?: string;                // 系统提示
  messages?: AgentMessage[];            // 消息历史
  messageChannel?: string;              // 消息通道
  thinkingLevel?: ThinkLevel;           // 思考级别
  sandboxInfo?: EmbeddedSandboxInfo;    // 沙箱信息
  // ...
};

// Agent 运行结果
type EmbeddedPiRunResult = {
  payloads?: Array<{                    // 输出载荷
    text?: string;
    mediaUrl?: string;
    replyToId?: string;
    isError?: boolean;
  }>;
  meta: EmbeddedPiRunMeta;              // 运行元数据
  didSendViaMessagingTool?: boolean;    // 是否通过消息工具发送
};

// 核心运行函数
export async function runEmbeddedPiAgent(
  params: RunEmbeddedPiAgentParams,
): Promise<EmbeddedPiRunResult> {
  // 1. 解析模型和认证
  const { model, authStorage } = resolveModel(provider, modelId, agentDir, config);
  
  // 2. 检查上下文窗口
  const ctxGuard = evaluateContextWindowGuard({...});
  if (ctxGuard.shouldBlock) throw new FailoverError(...);
  
  // 3. 执行 LLM 调用
  const result = await runEmbeddedAttempt({...});
  
  // 4. 处理工具调用
  if (result.toolCalls) {
    for (const toolCall of result.toolCalls) {
      const toolResult = await executeTool(toolCall, params.tools);
      // 将工具结果添加到消息历史
    }
  }
  
  // 5. 构建输出载荷
  const payloads = buildEmbeddedRunPayloads(result, resolvedToolResultFormat);
  
  return { payloads, meta, didSendViaMessagingTool };
}
```

**执行流程：**

```
用户消息
    │
    ▼
┌─────────────┐
│ 消息路由    │ ◄── resolveAgentRoute() → 确定 Agent
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 会话标识    │ ◄── buildAgentSessionKey() → 生成 sessionKey
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 系统提示    │ ◄── buildAgentSystemPrompt() → 构建提示
│ 构建        │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 模型调用    │ ◄── runEmbeddedAttempt() → 调用 LLM API
└──────┬──────┘
       │
       ├──────────┐
       │          │
       ▼          ▼
┌─────────┐ ┌─────────┐
│ 文本响应│ │ 工具调用│
└────┬────┘ └────┬────┘
     │            │
     │            ▼
     │     ┌─────────────┐
     │     │ 工具执行    │ ◄── 在沙箱中执行（如启用）
     │     │ (sandbox)   │
     │     └──────┬──────┘
     │            │
     └────────────┤
                  ▼
         ┌─────────────┐
         │ 结果处理    │ ◄── 格式化并添加到上下文
         └──────┬──────┘
                │
                ▼
         ┌─────────────┐
         │ 输出投递    │ ◄── 通过消息通道发送给用户
         └─────────────┘
```

### 10. 工作区管理 (`src/agents/workspace.ts`)

每个 Agent 拥有独立的工作区，包含引导文件：

```typescript
// 引导文件列表
const DEFAULT_AGENTS_FILENAME = "AGENTS.md";       // Agent 行为定义
const DEFAULT_SOUL_FILENAME = "SOUL.md";           // Agent 个性
const DEFAULT_TOOLS_FILENAME = "TOOLS.md";         // 工具说明
const DEFAULT_IDENTITY_FILENAME = "IDENTITY.md";   // 身份信息
const DEFAULT_USER_FILENAME = "USER.md";           // 用户信息
const DEFAULT_HEARTBEAT_FILENAME = "HEARTBEAT.md"; // 心跳任务
const DEFAULT_BOOTSTRAP_FILENAME = "BOOTSTRAP.md"; // 启动说明
const DEFAULT_MEMORY_FILENAME = "MEMORY.md";       // 记忆文件

// 确保工作区存在
export async function ensureAgentWorkspace(params?: {
  dir?: string;
  ensureBootstrapFiles?: boolean;
}): Promise<{ dir: string; agentsPath?: string; ... }> {
  const dir = resolveUserPath(params?.dir ?? DEFAULT_AGENT_WORKSPACE_DIR);
  await fs.mkdir(dir, { recursive: true });
  
  if (params?.ensureBootstrapFiles) {
    // 创建引导文件（如果不存在）
    await writeFileIfMissing(agentsPath, agentsTemplate);
    await writeFileIfMissing(soulPath, soulTemplate);
    await writeFileIfMissing(toolsPath, toolsTemplate);
    await writeFileIfMissing(identityPath, identityTemplate);
    await writeFileIfMissing(userPath, userTemplate);
    await writeFileIfMissing(heartbeatPath, heartbeatTemplate);
    await writeFileIfMissing(bootstrapPath, bootstrapTemplate);
    
    // 初始化 Git 仓库
    await ensureGitRepo(dir, isBrandNewWorkspace);
  }
  
  return { dir, agentsPath, soulPath, ... };
}
```

**引导文件用途：**

| 文件 | 用途 | 是否注入系统提示 |
|------|------|------------------|
| `AGENTS.md` | Agent 行为定义和约束 | 是 |
| `SOUL.md` | Agent 个性和语气 | 是 |
| `TOOLS.md` | 自定义工具说明 | 是 |
| `IDENTITY.md` | Agent 身份信息 | 是 |
| `USER.md` | 用户偏好和历史 | 是 |
| `BOOTSTRAP.md` | 启动上下文 | 是 |
| `HEARTBEAT.md` | 心跳任务指令 | 否（心跳时读取） |
| `MEMORY.md` | 结构化记忆 | 否（通过 memory_search 访问） |

## 关键文件位置

| 文件路径 | 描述 |
|----------|------|
| `src/config/types.agents.ts` | Agent 配置类型定义 |
| `src/config/types.agent-defaults.ts` | Agent 默认值配置 |
| `src/config/types.tools.ts` | 工具配置类型 |
| `src/config/types.sandbox.ts` | 沙箱配置类型 |
| `src/agents/agent-scope.ts` | Agent 作用域解析 |
| `src/agents/agent-paths.ts` | Agent 路径解析 |
| `src/routing/resolve-route.ts` | 消息路由解析 |
| `src/routing/session-key.ts` | 会话标识管理 |
| `src/routing/bindings.ts` | 绑定规则管理 |
| `src/agents/system-prompt.ts` | 系统提示构建 |
| `src/agents/workspace.ts` | 工作区管理 |
| `src/agents/pi-embedded-runner/run.ts` | Agent 核心运行器 |
| `src/agents/pi-embedded-runner/types.ts` | Agent 运行类型 |
| `src/agents/tools/common.ts` | 工具基础类型和工具函数 |
| `src/agents/tools/memory-tool.ts` | 记忆工具 |
| `src/agents/tools/sessions-send-tool.ts` | 会话发送工具 |

## 设计思想

### 1. 多 Agent 架构

- **隔离性**：每个 Agent 有独立的工作区、配置和会话
- **灵活性**：支持多模型、多工具策略、不同沙箱配置
- **可扩展**：通过绑定规则灵活路由消息到不同 Agent

### 2. 配置驱动

- **声明式**：通过 JSON5 配置定义 Agent 行为
- **层级覆盖**：defaults → list[] 的层级覆盖机制
- **动态重载**：配置变更可热重载（部分配置）

### 3. 安全优先

- **沙箱隔离**：Docker 容器隔离不可信代码执行
- **工具白名单**：精细化控制可用工具
- **会话隔离**：不同会话间的访问控制

### 4. 上下文管理

- **系统提示注入**：动态构建系统提示，注入环境信息
- **上下文剪枝**：自动管理长会话的上下文窗口
- **记忆集成**：语义搜索补充上下文

### 5. 降级与容错

- **模型降级**：主模型失败时自动切换到备用模型
- **认证轮换**：多个认证配置自动轮换
- **错误分类**：智能识别错误类型，决定重试或降级策略

## 实现细节

### Agent ID 规范化

```typescript
// Agent ID 规则：小写字母、数字、下划线、连字符
// 长度：1-64 字符
// 必须以字母或数字开头
const VALID_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

export function normalizeAgentId(value: string): string {
  if (VALID_ID_RE.test(value)) {
    return value.toLowerCase();
  }
  // 非法字符转为连字符
  return value
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .slice(0, 64) || "main";
}
```

### 并发控制

```typescript
// 全局并发车道
const GLOBAL_LANE = "global";

// 会话级别并发车道
function resolveSessionLane(sessionKey: string): string {
  return `session:${sessionKey}`;
}

// 子 Agent 专用车道
const SUBAGENT_LANE = "subagent";

// 使用队列控制并发
await enqueueCommandInLane(lane, async () => {
  // 执行 Agent 运行
  return await runEmbeddedPiAgent(params);
}, { concurrency: maxConcurrent });
```

### 沙箱工作区挂载

```typescript
// 根据 workspaceAccess 配置决定挂载方式
switch (sandbox.workspaceAccess) {
  case "none":
    // 不挂载工作区，使用沙箱内独立目录
    mounts = [];
    break;
  case "ro":
    // 只读挂载（禁用 write/edit 工具）
    mounts = [`${workspaceDir}:/workspace:ro`];
    break;
  case "rw":
    // 读写挂载
    mounts = [`${workspaceDir}:/workspace:rw`];
    break;
}
```

### Agent 间通信

```typescript
// A2A（Agent-to-Agent）通信策略
type AgentToAgentPolicy = {
  enabled: boolean;
  allow: string[];  // 允许通信的 Agent 列表
};

// 检查是否允许通信
function isA2AAllowed(from: string, to: string, policy: AgentToAgentPolicy): boolean {
  if (!policy.enabled) return false;
  if (policy.allow.includes("*")) return true;
  return policy.allow.includes(to);
}

// 沙箱内 Agent 的可见性控制
if (sandboxed && sessionToolsVisibility === "spawned") {
  // 只能看到由当前会话派生的子会话
  if (!isDescendantSession(targetSession, currentSession)) {
    throw new Error("Session not visible from this sandboxed session");
  }
}
```

## 相关文档

- [配置参考](/gateway/configuration) - 完整配置选项
- [多 Agent 和沙箱工具](/multi-agent-sandbox-tools) - 多 Agent 配置指南
- [工具参考](/concepts/tools) - 工具系统说明
- [会话管理](/concepts/sessions) - 会话和子 Agent
- [记忆系统架构](./memory-system-architecture.md) - 记忆集成
- [沙箱架构](./sandbox-architecture.md) - 沙箱详细设计
