# OpenClaw 技术架构文档

## 1. 系统概述

OpenClaw 是一个开源的多平台消息网关 CLI 工具，支持多种即时通讯平台的集成，并提供 AI Agent 能力。项目使用 TypeScript 构建，采用模块化架构设计，支持插件扩展机制。

### 1.1 核心定位
- **多通道消息网关**：统一管理 Telegram、Discord、Slack、Signal、iMessage、WhatsApp 等消息平台
- **AI Agent 运行时**：基于 Pi Agent Protocol 的嵌入式 AI Agent 执行环境
- **跨平台桌面应用**：支持 macOS、iOS、Android 等多平台部署

### 1.2 技术栈
- **语言**：TypeScript (ESM 模块系统)
- **运行时**：Node.js 22+
- **包管理**：pnpm (monorepo 工作区)
- **构建工具**：TypeScript 编译器 + rolldown
- **测试框架**：Vitest (V8 覆盖率要求 70%)

---

## 2. 项目结构

### 2.1 根目录结构

```
openclaw/
├── src/                    # 核心源码
│   ├── agents/             # Agent 运行时模块
│   ├── channels/           # 消息通道模块
│   ├── commands/           # CLI 命令实现
│   ├── cli/                # CLI 入口和基础设施
│   ├── gateway/            # Gateway 服务器
│   ├── infra/              # 基础设施服务
│   ├── providers/          # AI 模型提供商
│   ├── plugin-sdk/         # 插件开发 SDK
│   ├── config/             # 配置管理
│   └── utils/              # 工具函数
├── extensions/             # 外部插件目录
├── apps/                   # 平台应用 (macOS/iOS/Android)
├── docs/                   # 文档
├── ui/                     # UI 组件
└── packages/               # 子包
```

### 2.2 源码目录详细结构

```
src/
├── index.ts                # 主入口，导出公共 API
├── entry.ts                # CLI 入口点
├── runtime.ts              # 运行时环境定义
│
├── agents/                 # Agent 运行时 (核心模块)
│   ├── pi-embedded/        # 嵌入式 Pi Agent
│   ├── bash-tools/         # Bash 工具集
│   ├── cli-runner/         # CLI 执行器
│   ├── pi-extensions/      # Agent 扩展
│   ├── sandbox/            # 沙箱管理
│   ├── skills/             # 技能系统
│   └── tools/              # 工具定义
│
├── channels/               # 消息通道
│   ├── plugins/            # 通道插件接口
│   ├── allowlists/         # 允许名单
│   ├── dock.ts             # 通道对接配置
│   └── registry.ts         # 通道注册表
│
├── commands/               # CLI 命令 (业务逻辑)
│   ├── agent/              # Agent 管理命令
│   ├── channels/           # 通道配置命令
│   ├── configure/          # 配置向导
│   ├── doctor/             # 诊断命令
│   ├── health/             # 健康检查
│   ├── message/            # 消息发送
│   ├── models/             # 模型配置
│   ├── onboard/            # 入职引导
│   ├── sandbox/            # 沙箱管理
│   ├── sessions/           # 会话管理
│   └── status/             # 状态查看
│
├── cli/                    # CLI 框架
│   ├── program/            # 命令程序构建
│   ├── gateway-cli/        # Gateway CLI
│   ├── nodes-cli/         # 节点 CLI
│   ├── daemon-cli/         # 守护进程 CLI
│   ├── cron-cli/           # 定时任务 CLI
│   ├── plugins-cli.ts      # 插件 CLI
│   └── deps.ts             # 依赖注入
│
├── gateway/                # Gateway 服务器
│   ├── server/             # 服务器实现
│   ├── protocol/           # 协议处理
│   ├── client.ts           # 客户端
│   ├── boot.ts             # 启动逻辑
│   ├── auth.ts             # 认证
│   └── call.ts             # 调用处理
│
├── infra/                  # 基础设施
│   ├── bonjour/            # 服务发现
│   ├── outbound/           # 出站消息
│   ├── net/                # 网络工具
│   ├── tls/                # TLS 工具
│   ├── heartbeat-runner.ts # 心跳运行器
│   ├── update-runner.ts    # 更新运行器
│   └── ...
│
├── providers/              # AI 模型提供商
│   ├── github-copilot-*.ts # GitHub Copilot
│   ├── google-shared.*     # Google 共享
│   └── qwen-portal-*       # 阿里千问
│
├── plugin-sdk/             # 插件开发 SDK
│   ├── index.ts            # SDK 入口
│   ├── types.ts            # 类型定义
│   └── ...
│
├── config/                 # 配置管理
│   ├── config.ts           # 主配置
│   ├── zod-schema.*        # Zod Schema
│   └── types.ts            # 类型
│
├── whatsapp/               # WhatsApp 集成
├── telegram/               # Telegram 集成
├── discord/                # Discord 集成
├── slack/                  # Slack 集成
├── signal/                 # Signal 集成
└── imessage/               # iMessage 集成
```

---

## 3. 模块详解

### 3.1 CLI 入口模块 (`src/entry.ts`, `src/index.ts`)

**职责**：
- 初始化环境（环境变量、路径、运行时检查）
- 构建命令程序 (`buildProgram`)
- 全局错误处理
- 导出公共 API

**关键流程**：
```
entry.ts → loadDotEnv → normalizeEnv → buildProgram → program.parseAsync
```

### 3.2 Agent 运行时模块 (`src/agents/`)

这是 OpenClaw 的核心智能模块，基于 Pi Agent Protocol 实现。

#### 3.2.1 核心组件

| 组件 | 路径 | 职责 |
|------|------|------|
| `pi-embedded-runner` | `agents/pi-embedded-runner.ts` | 嵌入式 Agent 执行器 |
| `bash-tools` | `agents/bash-tools.*` | Bash 工具集（exec, process, read） |
| `cli-runner` | `agents/cli-runner.*` | CLI 命令执行器 |
| `pi-tools` | `agents/pi-tools.*` | Agent 工具定义 |
| `sandbox` | `agents/sandbox/*` | Docker 沙箱管理 |
| `skills` | `agents/skills/*` | 技能系统 |

#### 3.2.2 Agent 执行流程

```
用户消息 → Routing → Agent 接收 → pi-embedded-runner.run()
  → 工具调用 (bash-tools, cli-runner)
  → Docker 沙箱执行 (sandbox)
  → 响应流式返回
```

#### 3.2.3 关键类型

```typescript
// Agent 配置
interface AgentConfig {
  id: string;
  model: string;
  provider: string;
  systemPrompt?: string;
  tools?: Tool[];
}

// 工具定义
interface Tool {
  name: string;
  description: string;
  parameters: Type;
  handler: (args: any) => Promise<any>;
}
```

### 3.3 消息通道模块 (`src/channels/`)

#### 3.3.1 内置通道

| 通道 | 协议 | 核心文件 |
|------|------|----------|
| Telegram | Bot API | `telegram/bot.ts` |
| WhatsApp | Baileys Web | `whatsapp/*` |
| Discord | Gateway API | `discord/*` |
| Slack | Socket Mode | `slack/*` |
| Signal | signal-cli REST | `signal/*` |
| iMessage | imsg | `imessage/*` |

#### 3.3.2 通道插件接口

```typescript
interface ChannelPlugin {
  id: string;
  meta: ChannelMeta;
  adapters: {
    messaging: ChannelMessagingAdapter;
    outbound: ChannelOutboundAdapter;
    heartbeat?: ChannelHeartbeatAdapter;
    thread?: ChannelThreadingAdapter;
  };
}
```

#### 3.3.3 通道注册表 (`channels/registry.ts`)

```typescript
const CHAT_CHANNEL_ORDER = [
  "telegram", "whatsapp", "discord",
  "googlechat", "slack", "signal", "imessage"
] as const;
```

### 3.4 Gateway 服务器模块 (`src/gateway/`)

Gateway 是 OpenClaw 的远程服务组件，提供 HTTP/WebSocket 接口。

#### 3.4.1 服务器架构

```
gateway/server/
├── server-http.ts          # HTTP 服务器
├── server-impl.ts          # 服务器实现
├── server-methods.ts        # RPC 方法
├── server-channels.ts       # 通道处理
├── server-chat.ts           # 聊天处理
├── server-sessions.ts       # 会话管理
├── server-plugins.ts        # 插件处理
└── protocol/                # 协议定义
```

#### 3.4.2 认证流程

```
请求 → HTTP/WebSocket → 认证中间件
  → Token 验证 → 会话解析 → 权限检查
  → 业务处理 → 响应
```

### 3.5 基础设施模块 (`src/infra/`)

提供系统级服务的核心模块。

#### 3.5.1 核心服务

| 服务 | 职责 |
|------|------|
| `bonjour-discovery` | mDNS 服务发现 |
| `heartbeat-runner` | 心跳保持服务 |
| `update-runner` | 自动更新检查 |
| `device-pairing` | 设备配对 |
| `exec-approvals` | 执行审批 |
| `tailscale` | Tailscale 隧道 |
| `ssh-tunnel` | SSH 隧道 |
| `provider-usage` | API 使用统计 |

### 3.6 配置管理 (`src/config/`)

#### 3.6.1 配置层次

```
全局配置 (~/.openclaw/config.json)
├── channels: { telegram, whatsapp, discord, ... }
├── models: { providers: {...} }
├── gateway: {...}
└── plugins: {...}
```

#### 3.6.2 Zod Schema 定义

```typescript
// 通道配置 Schema
const TelegramConfigSchema = z.object({
  token: z.string(),
  accountId: z.string(),
  allowFrom: AllowFromSchema,
  groupPolicy: GroupPolicySchema.optional(),
});

// 模型配置 Schema  
const ModelConfigSchema = z.object({
  provider: z.string(),
  modelId: z.string(),
  apiKey: z.string().optional(),
});
```

### 3.7 插件 SDK (`src/plugin-sdk/`)

提供插件开发所需的类型和工具。

#### 3.7.1 插件接口

```typescript
interface ChannelPlugin {
  id: string;
  version: string;
  meta: ChannelMeta;
  init: (ctx: PluginContext) => Promise<void>;
  adapters: ChannelAdapters;
}
```

#### 3.7.2 可用导出

- 通道适配器类型（Messaging, Outbound, Threading）
- 配置 Schema 构建工具
- 认证适配器
- 工具定义辅助函数

---

## 4. 模块协作方式

### 4.1 消息流转架构

```
┌─────────────────────────────────────────────────────────────┐
│                        用户/外部                              │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      CLI / Gateway                            │
│  src/cli/program.ts  →  src/gateway/server-http.ts          │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Commands Layer                             │
│  src/commands/message.ts  │  src/commands/agent.ts          │
└───────────┬───────────────┴───────────────┬─────────────────┘
            │                               │
            ▼                               ▼
┌─────────────────────────────┐   ┌─────────────────────────────┐
│      Channel Layer          │   │      Agent Layer            │
│  src/channels/outbound/     │   │  src/agents/               │
│  - telegram/outbound.ts     │   │  - pi-embedded-runner.ts   │
│  - whatsapp/outbound.ts     │   │  - bash-tools/             │
│  - discord/outbound.ts      │   │  - sandbox/                │
└───────────┬─────────────────┘   └───────────┬─────────────────┘
            │                               │
            ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   External APIs                              │
│  Telegram Bot API  │  Discord API  │  Baileys (WhatsApp)    │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 消息发送流程

```typescript
// 伪代码：消息发送流程
async function sendMessage(channel: ChannelId, target: string, content: string) {
  // 1. 通道路由 (src/routing/)
  const channelConfig = resolveChannelConfig(channel);
  
  // 2. 消息格式化 (src/commands/message-format.ts)
  const formatted = formatMessage(content, channelConfig);
  
  // 3. 出站发送 (src/channels/outbound/)
  await channelAdapters[channel].outbound.send({
    target,
    content: formatted,
    options: { markdown: true, mentions: [...] }
  });
}
```

### 4.3 Agent 执行流程

```typescript
// 伪代码：Agent 执行流程
async function runAgent(message: Message, session: Session) {
  // 1. 消息路由到 Agent
  const agent = resolveAgent(session);
  
  // 2. 构建上下文
  const context = buildAgentContext(message, session);
  
  // 3. 执行 Agent (src/agents/pi-embedded-runner.ts)
  const result = await piEmbeddedRunner.run({
    agent,
    context,
    tools: [
      ...bashTools,
      ...cliRunner,
      ...sandboxTools
    ]
  });
  
  // 4. 格式化响应
  const response = formatAgentResponse(result);
  
  // 5. 通过通道发送
  await sendMessage(session.channel, session.target, response);
}
```

### 4.4 Gateway 协作模式

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   CLI App    │────▶│   Gateway    │────▶│  Mobile App  │
│   (macOS)    │     │   Server     │     │   (iOS)      │
└──────────────┘     └──────┬───────┘     └──────────────┘
                             │
                    ┌────────▼────────┐
                    │   Channels      │
                    │ - WhatsApp      │
                    │ - Telegram      │
                    │ - Signal        │
                    └─────────────────┘
```

### 4.5 插件扩展机制

```typescript
// 插件注册流程
const pluginRegistry = {
  channels: [
    { id: "whatsapp", plugin: WhatsAppPlugin },
    { id: "telegram", plugin: TelegramPlugin },
  ],
  providers: [
    { id: "github-copilot", plugin: GitHubCopilotProvider },
  ]
};

// 插件加载
function loadPlugins() {
  // 1. 扫描 extensions/ 目录
  const plugins = scanExtensions();
  
  // 2. 加载插件入口
  plugins.forEach(plugin => {
    registerPlugin(plugin);
    initializePlugin(plugin);
  });
}
```

---

## 5. 配置文件

### 5.1 入口配置 (`openclaw.mjs`)

```javascript
#!/usr/bin/env node
// 入口脚本，处理 Node 选项和环境变量
spawn(process.execPath, [...process.execArgv, ...process.argv], {
  stdio: "inherit",
  env: process.env,
});
```

### 5.2 包配置 (`package.json`)

- **bin**: `openclaw` 命令入口
- **exports**: 模块导出路径
- **engines**: Node >= 22.12.0
- **scripts**: build, lint, test, dev 等脚本

### 5.3 构建配置 (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"]
}
```

---

## 6. 扩展机制

### 6.1 通道插件

在 `extensions/` 目录创建插件：

```
extensions/
├── my-channel/
│   ├── package.json
│   ├── src/
│   │   ├── index.ts      # 插件入口
│   │   └── plugin.ts     # 插件实现
│   └── openclaw.config.ts # 插件配置
```

### 6.2 模型提供商

实现 `Provider` 接口：

```typescript
interface Provider {
  id: string;
  name: string;
  authenticate(auth: AuthInput): Promise<AuthResult>;
  listModels(): Promise<Model[]>;
  invoke(request: InvokeRequest): Promise<InvokeResult>;
}
```

---

## 7. 关键依赖

| 依赖 | 用途 |
|------|------|
| `@whiskeysockets/baileys` | WhatsApp Web 连接 |
| `grammy` | Telegram Bot API |
| `@slack/bolt` | Slack Bot 框架 |
| `@mariozechner/pi-agent-core` | Pi Agent 核心 |
| `@mariozechner/pi-ai` | Pi AI 集成 |
| `ws` | WebSocket |
| `express` | HTTP 服务器 |

---

## 8. 测试策略

### 8.1 测试框架

- **单元测试**: Vitest (`*.test.ts`)
- **E2E 测试**: `vitest.e2e.config.ts`
- **Live 测试**: `vitest.live.config.ts`

### 8.2 覆盖率要求

```json
{
  "thresholds": {
    "lines": 70,
    "functions": 70,
    "branches": 70,
    "statements": 70
  }
}
```

---

## 9. 常见命令

```bash
# 开发
pnpm dev              # 开发模式运行
pnpm openclaw ...     # 直接运行 CLI

# 构建
pnpm build            # 编译 TypeScript
pnpm lint             # 代码检查
pnpm format           # 代码格式化

# 测试
pnpm test             # 运行测试
pnpm test:coverage    # 测试覆盖率
pnpm test:e2e         # E2E 测试
```

---

## 10. 架构模式总结

OpenClaw 采用**分层架构 + 插件化**设计：

1. **CLI 层**：命令解析和用户交互
2. **命令层**：业务逻辑编排
3. **Agent 层**：AI 智能处理
4. **通道层**：多平台消息适配
5. **基础设施层**：系统级服务

所有层之间通过**接口/适配器模式**解耦，支持灵活扩展。
