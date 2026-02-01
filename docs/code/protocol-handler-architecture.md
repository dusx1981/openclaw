# Protocol Handler 架构

Protocol Handler 是 OpenClaw Gateway 的核心组件，负责处理所有 WebSocket 连接的协议帧、认证授权、方法调度和连接生命周期管理。

## 概述

Protocol Handler 位于 Gateway 的协议层，承担以下关键职责：

| 职责 | 描述 |
|------|------|
| **帧解析** | 解析 WebSocket 帧（req/res/event），提取类型、ID、方法 |
| **握手管理** | 处理连接握手，验证协议版本，协商能力 |
| **设备认证** | 验证设备身份（Ed25519 签名） |
| **网关认证** | 验证网关访问权限（Token/密码/Tailscale） |
| **设备配对** | 处理设备配对流程，管理设备信任关系 |
| **方法调度** | 将请求路由到对应的方法处理器 |
| **授权检查** | 基于角色和作用域验证方法访问权限 |
| **连接管理** | 维护连接状态，处理断开连接清理 |
| **心跳检测** | 发送 tick 事件，检测连接健康状态 |
| **状态广播** | 向所有客户端广播系统状态变化 |

## 架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      Protocol Handler                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │  帧解析器   │    │  握手管理器 │    │    认证模块         │  │
│  │             │    │             │    ├─────────┬───────────┤  │
│  │ - JSON 解析 │    │ - 协议版本  │    │ 设备认证 │ 网关认证  │  │
│  │ - 类型提取  │    │ - 挑战响应  │    │(Ed25519) │(Token/   │  │
│  │ - 验证检查  │    │ - 能力协商  │    │          │ 密码/TS)  │  │
│  └──────┬──────┘    └──────┬──────┘    └────┬────┴─────┬─────┘  │
│         │                  │                │          │         │
│         └──────────────────┴────────────────┴──────────┘         │
│                            │                                      │
│                            ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    请求处理器                               │ │
│  │  ┌─────────────────┐    ┌────────────────────────────────┐ │ │
│  │  │   授权检查器    │───▶│         方法调度器             │ │ │
│  │  │                 │    │                                │ │ │
│  │  │ - 角色验证      │    │ - 查找处理器 (core/extra)      │ │ │
│  │  │ - 作用域验证    │    │ - 执行方法处理器               │ │ │
│  │  │ - 方法分类检查  │    │ - 错误处理                     │ │ │
│  │  └─────────────────┘    └────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                            │                                      │
│                            ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                  连接生命周期管理                           │ │
│  │                                                             │ │
│  │  状态机: pending → connected → active ←────┐                │ │
│  │                                         disconnect          │ │
│  │                                                             │ │
│  │  - 注册/注销节点 (NodeRegistry)                             │ │
│  │  - 管理在线状态 (Presence)                                  │ │
│  │  - 广播连接/断开事件                                        │ │
│  │  - 清理资源                                                 │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 核心组件

### 1. 协议帧架构

定义三种帧类型（位于 `src/gateway/protocol/schema/frames.ts`）：

```typescript
// 请求帧：客户端 → 服务器
interface RequestFrame {
  type: "req";
  id: string;           // 请求唯一标识
  method: string;       // 方法名（如 "message.send"）
  params?: unknown;     // 方法参数
}

// 响应帧：服务器 → 客户端
interface ResponseFrame {
  type: "res";
  id: string;           // 匹配的请求 ID
  ok: boolean;          // 成功/失败
  payload?: unknown;    // 响应数据
  error?: ErrorShape;   // 错误信息
}

// 事件帧：服务器 → 客户端（广播）
interface EventFrame {
  type: "event";
  event: string;        // 事件名
  payload?: unknown;    // 事件数据
  seq?: number;         // 序列号（用于排序）
  stateVersion?: StateVersion;  // 状态版本
}
```

### 2. 连接管理器 (`ws-connection.ts`)

管理 WebSocket 连接的生命周期：

```typescript
class WsConnectionManager {
  // 处理新连接
  onConnection(socket: WebSocket, ipInfo: string): void
  
  // 处理断开连接
  onDisconnect(connId: string, reason: string): void
  
  // 发送帧到特定客户端
  send(connId: string, frame: GatewayFrame): void
  
  // 广播事件到所有客户端
  broadcast(event: EventFrame, exclude?: string[]): void
  
  // 更新在线状态
  updatePresence(key: string, presence: PresenceEntry): void
}
```

**连接状态：**
- `pending` - 等待握手完成
- `connected` - 握手成功，等待请求
- `active` - 正在处理请求
- `failed` - 握手失败或认证失败

### 3. 消息处理器 (`message-handler.ts`)

核心帧处理逻辑：

```typescript
class MessageHandler {
  // 处理原始消息
  handleMessage(connId: string, data: RawData): void
  
  // 处理握手阶段（第一个帧必须是 connect）
  handleHandshake(connId: string, frame: RequestFrame): void
  
  // 处理 post-handshake 请求
  handleRequest(connId: string, frame: RequestFrame): void
  
  // 构建并发送响应
  respond(connId: string, id: string, ok: boolean, payload?: unknown, error?: ErrorShape): void
}
```

**处理流程：**

```
收到原始数据
    │
    ▼
rawDataToString() - 转换为字符串
    │
    ▼
JSON.parse() - 解析 JSON
    │
    ▼
提取帧类型 (type/method/id)
    │
    ▼
┌─────────────────────┐
│ 首次连接？          │
└─────────────────────┘
    │
    ├──是──▶ 处理握手流程（见下文）
    │
    └──否──▶ 验证 RequestFrame
                │
                ▼
         handleGatewayRequest()
                │
                ▼
         发送响应帧
```

### 4. 方法调度器 (`server-methods.ts`)

注册和调度方法处理器：

```typescript
// 核心处理器注册表
const coreGatewayHandlers: GatewayRequestHandlers = {
  ...connectHandlers,      // connect (握手验证)
  ...healthHandlers,       // health, status
  ...agentHandlers,        // agent, agent.wait, wake
  ...agentsHandlers,       // agents.list, models.list, skills.*
  ...channelsHandlers,     // channels.status, channels.logout, talk.mode
  ...chatHandlers,         // chat.send, chat.abort, chat.history
  ...configHandlers,       // config.get, config.set, config.apply
  ...cronHandlers,         // cron.list, cron.add, cron.update
  ...devicesHandlers,      // device.pair.*, device.token.*
  ...nodesHandlers,        // node.list, node.describe, node.invoke
  ...sessionsHandlers,     // sessions.list, sessions.preview
  ...sendHandlers,         // send
  // ... 更多处理器
};

// 方法调度入口
async function handleGatewayRequest(opts: {
  req: RequestFrame;
  client: GatewayClient;
  extraHandlers?: GatewayRequestHandlers;  // 扩展处理器（覆盖核心）
  context: GatewayRequestContext;
}): Promise<void>
```

### 5. 授权检查器

基于角色和作用域的访问控制：

```typescript
// 角色定义
type GatewayRole = "operator" | "node";

// 作用域定义
type GatewayScope = 
  | "operator.admin"      // 完全访问
  | "operator.read"       // 只读方法
  | "operator.write"      // 写入方法
  | "operator.approvals"  // 审批相关
  | "operator.pairing";   // 配对相关

// 方法分类
const READ_METHODS = ["health", "status", "logs", "config.get", ...];
const WRITE_METHODS = ["send", "agent", "chat.send", "config.set", ...];
const PAIRING_METHODS = ["device.pair", "node.pair", ...];
const APPROVAL_METHODS = ["exec.approval", ...];
const NODE_ROLE_METHODS = ["node.invoke", "node.event", ...];

// 授权函数
function authorizeGatewayMethod(
  method: string, 
  client: GatewayClient
): ErrorShape | null {
  // 1. 检查角色权限
  // 2. 检查作用域权限
  // 3. 返回错误（如果未授权）
}
```

## 握手流程

### 完整握手序列

```
客户端                                    服务器
  │                                          │
  │ ──────── WebSocket 连接建立 ───────────▶ │
  │                                          │
  │ ◀────────── "connect.challenge" ──────── │
  │     { nonce: "随机字符串" }               │
  │                                          │
  │ ────── "connect" 请求（带签名） ───────▶ │
  │     {                                   │
  │       deviceId,                         │
  │       clientId,                         │
  │       clientMode,                       │
  │       role,                             │
  │       scopes,                           │
  │       signedAtMs,                       │
  │       token,                            │
  │       nonce,                            │
  │       signature  ← Ed25519 签名         │
  │     }                                   │
  │                                          │
  │     服务器验证：                         │
  │     1. 协议版本兼容性                   │
  │     2. 设备身份（验证签名）              │
  │     3. 网关认证（Token/密码/Tailscale）  │
  │     4. 设备配对状态                      │
  │     5. 时间戳偏差（±10 分钟）            │
  │                                          │
  │ ◀────────── "hello-ok" 响应 ─────────── │
  │     {                                   │
  │       snapshot: 系统状态快照,            │
  │       features: 支持的功能列表,          │
  │       protocolVersion: 3                 │
  │     }                                   │
  │                                          │
  │ ◀────────── 后续可以发送普通请求 ─────── │
  │                                          │
```

### 设备认证（Ed25519 签名）

```typescript
// 签名数据结构
interface DeviceAuthPayload {
  deviceId: string;       // 设备唯一 ID
  clientId: string;       // 客户端类型（cli/desktop/mobile）
  clientMode: string;     // 客户端模式
  role: GatewayRole;      // 角色
  scopes: GatewayScope[]; // 授权作用域
  signedAtMs: number;     // 签名时间戳
  token?: string;         // 网关令牌（可选）
  nonce: string;          // 服务器提供的随机数
}

// 签名流程
const payload = JSON.stringify(deviceAuthPayload);
const signature = ed25519.sign(payload, devicePrivateKey);

// 服务器验证
const isValid = ed25519.verify(signature, payload, devicePublicKey);
const isRecent = Math.abs(Date.now() - signedAtMs) < 10 * 60 * 1000; // 10 分钟
const nonceMatches = nonce === serverProvidedNonce;
```

### 网关认证模式

| 模式 | 机制 | 配置方式 |
|------|------|----------|
| **Token** | `OPENCLAW_GATEWAY_TOKEN` 环境变量或配置文件 | `gateway.token` |
| **Password** | `OPENCLAW_GATEWAY_PASSWORD` 环境变量或配置文件 | `gateway.password` |
| **Tailscale** | 通过 `tailscale whois` 验证 | 自动检测 serve 代理 |

## 方法调度流程

```
收到 RequestFrame
       │
       ▼
┌────────────────────────────┐
│ 1. 授权检查                 │
│    authorizeGatewayMethod() │
└────────────────────────────┘
       │
       ├── 未授权 ──▶ 返回错误响应 (INVALID_REQUEST)
       │
       └── 已授权
              │
              ▼
┌────────────────────────────┐
│ 2. 查找处理器               │
│    优先级：extraHandlers    │
│            > coreHandlers   │
└────────────────────────────┘
       │
       ├── 未找到 ──▶ 返回错误响应 (UNAVAILABLE)
       │
       └── 找到处理器
              │
              ▼
┌────────────────────────────┐
│ 3. 执行处理器               │
│    handler({ req, params,  │
│            client,         │
│            respond,        │
│            context })      │
└────────────────────────────┘
       │
       ▼
处理器调用 respond() 发送响应
       │
       ▼
构建 ResponseFrame
       │
       ▼
通过 WebSocket 发送
```

## 连接生命周期

### 完整生命周期

```
                    ┌───────────────┐
       ┌───────────▶│   pending     │◀──────────┐
       │            │  (等待握手)    │           │
       │            └───────┬───────┘           │
       │                    │                   │
       │  握手失败           │  握手成功         │
       │                    ▼                   │
       │            ┌───────────────┐           │
       └────────────│    failed     │           │
                    │  (握手失败)    │           │
                    └───────────────┘           │
                                                │
                    ┌───────────────┐           │
                    │   connected   │───────────┘
                    │  (已连接)      │ 断开重连
                    └───────┬───────┘
                            │
                            │ 收到第一个请求
                            ▼
                    ┌───────────────┐
       ┌───────────▶│    active     │◀──────────┐
       │            │  (活跃状态)    │           │
       │            └───────┬───────┘           │
       │                    │                   │
       │  处理完成          │  处理请求         │
       │                    │                   │
       │  空闲              │                   │
       └────────────────────┘                   │
                                                │
                           断开连接             │
                    ┌───────────────┐           │
                    │ disconnected  │───────────┘
                    │  (已断开)      │
                    └───────┬───────┘
                            │
                            ▼
                    清理资源：
                    - 从 NodeRegistry 注销
                    - 从 Presence 移除
                    - 广播断开事件
                    - 清理关联资源
```

### 关键生命周期事件

| 事件 | 触发条件 | 处理操作 |
|------|----------|----------|
| **connect** | WebSocket 连接建立 | 发送 challenge，启动握手超时（30s） |
| **authenticate** | 收到 connect 请求 | 验证设备签名 + 网关认证 |
| **pair** | 设备认证通过 | 检查/自动批准配对（本地连接自动批准） |
| **register** | 配对完成，role=node | 注册到 NodeRegistry，声明能力 |
| **activate** | 收到第一个业务请求 | 标记为活跃，更新在线状态 |
| **tick** | 每 30 秒（可配置） | 发送心跳事件，检测连接健康 |
| **disconnect** | WebSocket 关闭 | 清理资源，广播离线事件 |

## 错误处理

### 错误码定义

```typescript
// src/gateway/protocol/schema/error-codes.ts
export const ErrorCodes = {
  NOT_LINKED: "NOT_LINKED",           // 账户/通道未链接
  NOT_PAIRED: "NOT_PAIRED",           // 设备未与网关配对
  AGENT_TIMEOUT: "AGENT_TIMEOUT",     // 智能体执行超时
  INVALID_REQUEST: "INVALID_REQUEST", // 验证或授权失败
  UNAVAILABLE: "UNAVAILABLE",         // 服务暂时不可用
} as const;
```

### 错误响应格式

```typescript
interface ErrorShape {
  code: string;              // 错误码
  message: string;           // 人类可读的错误信息
  details?: unknown;         // 额外详情
  retryable?: boolean;       // 是否可重试
  retryAfterMs?: number;     // 建议重试等待时间（毫秒）
}

// 示例错误响应
{
  "type": "res",
  "id": "req-123",
  "ok": false,
  "error": {
    "code": "NOT_PAIRED",
    "message": "Device not paired with gateway",
    "retryable": false
  }
}
```

### 验证错误处理

使用 AJV 验证 TypeBox 模式，格式化验证错误：

```typescript
import { validateRequestFrame } from './protocol';

const result = validateRequestFrame(frame);
if (!result.valid) {
  const error = formatValidationErrors(result.errors);
  // error: "Invalid request: params.message must be string"
}
```

## 关键文件

| 文件 | 用途 |
|------|------|
| `src/gateway/protocol/schema/frames.ts` | 核心帧类型定义（RequestFrame, ResponseFrame, EventFrame） |
| `src/gateway/protocol/schema/types.ts` | TypeScript 类型导出 |
| `src/gateway/protocol/schema/error-codes.ts` | 错误码常量定义 |
| `src/gateway/protocol/index.ts` | 协议层主入口，AJV 验证器 |
| `src/gateway/server/ws-connection.ts` | WebSocket 连接管理 |
| `src/gateway/server/ws-connection/message-handler.ts` | 消息/帧处理核心逻辑 |
| `src/gateway/server/ws-types.ts` | WebSocket 客户端类型定义 |
| `src/gateway/server-methods.ts` | 方法调度器，授权逻辑 |
| `src/gateway/server-methods/types.ts` | 处理器类型定义 |
| `src/gateway/auth.ts` | 认证逻辑（设备 + 网关） |
| `src/gateway/client.ts` | 客户端 GatewayClient 实现 |
| `src/gateway/protocol/client-info.ts` | 客户端 ID 和模式常量 |

## 方法处理器分类

| 分类 | 方法示例 | 所需作用域 |
|------|----------|-----------|
| **连接** | `connect` | 无（握手阶段） |
| **健康** | `health`, `status` | `operator.read` |
| **消息** | `send`, `chat.send` | `operator.write` |
| **智能体** | `agent`, `agent.wait` | `operator.write` |
| **配置** | `config.get`, `config.set` | `operator.read`/`operator.write` |
| **设备** | `device.pair`, `device.token` | `operator.pairing` |
| **节点** | `node.invoke`, `node.event` | `operator.write` 或 `node` 角色 |
| **审批** | `exec.approval` | `operator.approvals` |
| **定时任务** | `cron.list`, `cron.add` | `operator.admin` |

## 运行时上下文

```typescript
interface GatewayRequestContext {
  // CLI 依赖注入
  deps: CLIDeps;
  
  // 向所有客户端广播事件
  broadcast: (event: EventFrame, exclude?: string[]) => void;
  
  // 远程节点管理
  nodeRegistry: NodeRegistry;
  
  // 聊天会话中止控制器
  chatAbortControllers: Map<string, AbortController>;
  
  // 活跃的向导会话
  wizardSessions: Map<string, WizardSession>;
  
  // 获取当前系统状态快照
  getRuntimeSnapshot: () => Snapshot;
}
```

## 相关文档

- [Gateway 架构](/code/gateway-architecture)
- [路由系统](/routing/overview)
- [WebSocket 协议](/protocol/overview)
- [认证与安全](/security/overview)
- [配置管理](/configuration)