# Gateway 架构

OpenClaw Gateway 是一个基于 WebSocket 的中央服务器，负责管理整个 OpenClaw 生态系统。它将 CLI、移动应用、Web UI 和外部消息通道连接成一个统一的系统。

## 概述

Gateway 作为 OpenClaw 的**中枢神经系统**，具有以下主要职责：

| 职责 | 描述 |
|----------------|-------------|
| **连接中心** | 维护与 CLI、移动应用和 Web UI 的 WebSocket 连接 |
| **通道路由** | 在设备与外部消息平台之间路由消息 |
| **状态同步** | 保持所有客户端与最新的对话状态同步 |
| **节点注册** | 管理 RPC 注册，使命令能够到达移动设备 |
| **Webhook 接收器** | 接收来自消息平台和其他服务的 Webhook |
| **HTTP API** | 提供与 OpenAI 兼容的端点，用于程序化访问 |
| **任务队列** | 在网络中协调任务和后台作业 |
| **安全层** | 处理认证、授权和配对流程 |
| **配置管理** | 无需重启即可热重载配置更改 |
| **通道插件** | 管理与外部服务连接的插件 |

## 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         客户端层                                │
├─────────────┬─────────────┬─────────────┬───────────────────────┤
│   CLI       │ 移动应用    │   Web UI    │   外部通道            │
│ (WebSocket) │ (WebSocket) │ (WebSocket) │ (Telegram, WhatsApp…) │
└──────┬──────┴──────┬──────┴──────┬──────┴───────────┬───────────┘
       │             │             │                  │
       └─────────────┴─────────────┴──────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Gateway 核心                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  协议       │  │  通道       │  │     节点注册表          │  │
│  │  处理器     │  │  管理器     │  │  (设备 RPC 查找)        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   路由器    │  │  任务队列   │  │    配置管理器           │  │
│  │ (绑定规则)  │  │             │  │    (热重载)             │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WebSocket & HTTP API                         │
│      WebSocket (端口 18789)  │  HTTP API (OpenAI 兼容)          │
└─────────────────────────────────────────────────────────────────┘
```

## 核心组件

### 1. 协议层 (`src/gateway/protocol/`)

Gateway 使用自定义 WebSocket 协议进行双向通信：

**帧类型：**

| 类型 | 方向 | 用途 |
|------|-----------|---------|
| `req` | 客户端 → 服务器 | 带 ID 的请求，等待响应 |
| `res` | 服务器 → 客户端 | 匹配请求 ID 的响应 |
| `event` | 双向 | 单向通知，无需响应 |

**帧示例：**
```typescript
// 请求
{
  "type": "req",
  "id": "req-123",
  "method": "message.send",
  "data": { "channel": "telegram", "recipient": "@user", "text": "Hello" }
}

// 响应
{
  "type": "res",
  "id": "req-123",
  "data": { "messageId": "msg-456" },
  "error": null
}

// 事件
{
  "type": "event",
  "event": "channel.message.received",
  "data": { "channel": "telegram", "message": {...} }
}
```

### 2. 通道管理器 (`src/gateway/server-channels.ts`)

管理所有消息通道及其连接：

```typescript
class ChannelManager {
  // 注册通道插件
  registerChannel(name: string, handler: ChannelHandler): void
  
  // 通过特定通道发送消息
  send(channel: string, recipient: string, content: MessageContent): Promise<MessageId>
  
  // 向通道中的所有成员广播
  broadcast(channel: string, content: MessageContent): Promise<void>
  
  // 处理来自外部平台的传入 Webhook
  handleWebhook(channel: string, payload: unknown): Promise<void>
}
```

**通道类型：**

| 类型 | 示例 | 实现方式 |
|------|----------|----------------|
| 内置 | CLI, Web UI | 直接 WebSocket 处理器 |
| 扩展 | Telegram, WhatsApp, Discord | 基于插件，通过 `extensions/*` |
| HTTP 基础 | Webhooks, APIs | 自定义接收器 |

### 3. 节点注册表 (`src/gateway/node-registry.ts`)

跟踪哪些设备在线以及它们可以处理哪些命令：

```typescript
class NodeRegistry {
  // 设备/节点连接时注册
  register(nodeId: string, socket: WebSocket, capabilities: string[]): void
  
  // 标记节点离线
  unregister(nodeId: string): void
  
  // 查找处理命令的最佳节点
  resolve(target: string, command: string): NodeInfo | null
  
  // 在特定节点上调用 RPC
  invoke(nodeId: string, method: string, data: unknown): Promise<unknown>
}
```

**用例：** 当 CLI 发送需要在移动设备上执行的 `agent.run` 请求时，Gateway 使用 NodeRegistry 将其路由到正确的设备。

### 4. 路由器与绑定规则 (`src/routing/`)

决定出站消息应由哪个通道接收：

**绑定规则解析层次结构：**
```
1. 对等绑定 (特定用户/通道对)
2. 公会/团队绑定 (组织默认)
3. 账户绑定 (用户首选通道)
4. 通道默认 (平台回退)
5. 系统默认 (全局回退)
```

```typescript
class Router {
  // 添加绑定规则
  bind(binding: Binding): void
  
  // 解析接收方应使用的通道
  resolve(recipient: Recipient, context: RoutingContext): ChannelRoute
  
  // 获取用户的所有绑定规则
  getBindings(userId: string): Binding[]
}
```

### 5. 任务队列 (`src/gateway/server-methods/task-queue.ts`)

管理后台作业和定时任务：

```typescript
class TaskQueue {
  // 调度任务执行
  schedule(task: Task, options?: ScheduleOptions): TaskId
  
  // 立即执行
  execute(task: Task): Promise<TaskResult>
  
  // 取消已调度任务
  cancel(taskId: TaskId): boolean
  
  // 列出待处理任务
  list(filters?: TaskFilters): Task[]
}
```

### 6. 配置管理器 (`src/gateway/config-reload.ts`)

支持无需重启即可热重载配置：

```typescript
class ConfigManager {
  // 从磁盘加载配置
  load(): Promise<Config>
  
  // 监视更改并自动重载
  watch(): void
  
  // 获取当前生效的配置
  get(): Config
  
  // 验证配置更改
  validate(config: Config): ValidationResult
}
```

**可热重载组件：**
- Webhook 端点
- 通道设置
- Cron 作业
- 心跳间隔
- 安全策略

## 消息流

### 场景 1：CLI 向 Telegram 发送消息

```
CLI (WebSocket)
     │
     │ 1. WebSocket: {type:"req", method:"message.send", ...}
     ▼
┌─────────────┐
│   Gateway   │
│  协议       │
│  处理器     │
└──────┬──────┘
       │
       │ 2. Router.resolve(recipient)
       ▼
┌─────────────┐
│    路由器   │
│  (绑定规则  │
│  解析)      │
└──────┬──────┘
       │ 3. 返回: channel="telegram"
       ▼
┌─────────────┐
│   通道      │
│   管理器    │
└──────┬──────┘
       │ 4. channel.send("telegram", ...)
       ▼
┌─────────────┐     5. HTTP/Webhook    ┌─────────────┐
│  Telegram   │ ─────────────────────► │  Telegram   │
│   插件      │                        │    API      │
└─────────────┘                        └─────────────┘
       │ 6. 响应
       ▼
┌─────────────┐
│   Gateway   │
│  协议       │
│  处理器     │
└──────┬──────┘
       │ 7. WebSocket: {type:"res", id:"...", data:{...}}
       ▼
CLI (WebSocket)
```

### 场景 2：接收 Telegram 消息

```
Telegram API
     │
     │ 1. Webhook POST /webhook/telegram
     ▼
┌─────────────┐
│   Gateway   │
│   Webhook   │
│   处理器    │
└──────┬──────┘
       │
       │ 2. channel.handleWebhook("telegram", payload)
       ▼
┌─────────────┐
│   通道      │
│   管理器    │
└──────┬──────┘
       │ 3. 事件: "channel.message.received"
       ▼
┌─────────────┐
│   Gateway   │
│  协议       │
│  处理器     │
└──────┬──────┘
       │ 4. 广播到所有连接的客户端
       ├────────────────────────┬────────────────────────┐
       ▼                        ▼                        ▼
    CLI (WebSocket)      Mobile App (WebSocket)     Web UI
```

### 场景 3：移动设备 RPC 调用

```
CLI
     │
     │ 1. "在我的手机上运行此命令"
     │    {type:"req", method:"agent.run", target:"mobile-device-1"}
     ▼
┌─────────────┐
│   Gateway   │
│  协议       │
│  处理器     │
└──────┬──────┘
       │
       │ 2. nodeRegistry.resolve("mobile-device-1", "agent.run")
       ▼
┌─────────────┐
│   节点      │
│  注册表     │
└──────┬──────┘
       │ 3. 返回: mobile-device-1 的 socket
       ▼
┌─────────────┐
│   Gateway   │
│  协议       │
│  处理器     │
└──────┬──────┘
       │ 4. 通过 WebSocket 转发
       ▼
移动设备 (WebSocket)
       │
       │ 5. 本地执行，返回结果
       ▼
┌─────────────┐
│   Gateway   │
│  协议       │
│  处理器     │
└──────┬──────┘
       │ 6. 返回给 CLI
       ▼
CLI
```

## HTTP API 层

除了 WebSocket，Gateway 还在 `/v1/chat/completions` 暴露了一个**与 OpenAI 兼容的 HTTP API**：

```typescript
// POST /v1/chat/completions
{
  "model": "claude-sonnet-4-20250514",
  "messages": [
    {"role": "user", "content": "Hello, OpenClaw!"}
  ],
  "stream": true
}
```

这允许外部工具（如 Cursor、Claude Desktop 或自定义脚本）使用标准 HTTP 请求与 OpenClaw 智能体交互。

## 安全架构

### 认证层

| 层 | 机制 | 用途 |
|-------|-----------|---------|
| **1. 连接** | WebSocket 令牌验证 | 验证客户端身份 |
| **2. 通道** | 平台特定 (Bot 令牌, OAuth) | 与外部服务认证 |
| **3. 消息** | 签名验证 | 确保消息完整性 |
| **4. 管理员** | 管理员令牌 | 保护敏感操作 |

### 配对流程

```
1. 移动应用生成配对码
2. 用户在 CLI 或 Web UI 中输入代码
3. Gateway 验证并建立信任
4. 移动设备注册到 NodeRegistry
5. 启用双向通信
```

## 扩展机制

Gateway 通过 `extensions/` 目录支持**通道插件**：

```typescript
// 扩展接口
interface ChannelPlugin {
  name: string;
  
  // 初始化与外部服务的连接
  initialize(config: Config): Promise<void>;
  
  // 向外部平台发送消息
  send(recipient: string, content: MessageContent): Promise<void>;
  
  // 处理传入的 Webhook
  handleWebhook(payload: unknown): Promise<void>;
  
  // 关闭时清理
  destroy(): Promise<void>;
}
```

**扩展：**
- `extensions/telegram` - Telegram Bot 集成
- `extensions/whatsapp` - WhatsApp (Baileys)
- `extensions/discord` - Discord Bot
- `extensions/slack` - Slack 应用
- `extensions/signal` - Signal 集成
- `extensions/matrix` - Matrix 协议
- `extensions/msteams` - Microsoft Teams

## 关键文件

| 文件 | 用途 |
|------|---------|
| `src/gateway/server.impl.ts` | 服务器主实现 |
| `src/gateway/server-channels.ts` | 通道管理 |
| `src/gateway/node-registry.ts` | 设备 RPC 注册表 |
| `src/gateway/protocol/*.ts` | WebSocket 协议处理 |
| `src/gateway/server-methods/*.ts` | RPC 方法实现 |
| `src/routing/*.ts` | 消息路由与绑定规则 |
| `src/gateway/config-reload.ts` | 配置热重载 |
| `src/gateway/server-http.ts` | HTTP API 端点 |
| `src/gateway/task-queue.ts` | 后台任务管理 |

## 运行时状态

Gateway 维护最小的持久状态：

```typescript
interface GatewayState {
  // 活动的 WebSocket 连接
  connections: Map<string, WebSocket>;
  
  // 已注册节点及其能力
  nodes: Map<string, NodeInfo>;
  
  // 通道插件实例
  channels: Map<string, ChannelPlugin>;
  
  // 路由绑定规则
  bindings: Binding[];
  
  // 已调度任务
  tasks: Task[];
  
  // 当前配置
  config: Config;
}
```

## 相关文档

- [CLI 架构](/architecture/cli)
- [路由系统](/routing/overview)
- [通道插件](/channels/overview)
- [WebSocket 协议](/protocol/overview)
- [配置](/configuration)
- [安全](/security/overview)