# 节点注册表架构

节点注册表（Node Registry）是 OpenClaw Gateway 的核心组件，负责管理分布式网络中的节点（Node）设备（主要是移动应用和远程 CLI 实例），实现跨设备的 RPC 调用和远程命令执行。

## 概述

节点注册表作为 OpenClaw 分布式架构的**设备目录服务中心**，承担以下核心职责：

| 职责 | 描述 |
|------|------|
| **节点注册** | 当节点设备（移动应用、远程 CLI）连接时注册到注册表 |
| **节点发现** | 提供已连接节点的查询和发现能力 |
| **RPC 路由** | 将命令路由到特定的节点设备执行 |
| **能力管理** | 跟踪每个节点支持的能力和命令列表 |
| **状态维护** | 维护节点的连接状态和元数据（平台、版本、IP等） |
| **调用超时** | 管理挂起的 RPC 调用，处理超时和响应 |
| **断开清理** | 节点断开时自动清理资源和未完成调用 |
| **权限控制** | 基于命令白名单控制节点可执行的操作 |
| **事件转发** | 向特定节点或订阅者发送事件 |
| **配对集成** | 与设备配对系统集成，验证节点身份 |

## 架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        节点生态系统                                 │
├─────────────────┬─────────────────┬─────────────────────────────────┤
│   移动应用      │   远程 CLI      │   其他节点设备                  │
│ (iOS/Android)   │ (desktop/ssh)   │ (嵌入式设备等)                  │
└────────┬────────┴────────┬────────┴────────┬────────────────────────┘
         │                 │                 │
         │  WebSocket 连接 │                 │
         │  role="node"    │                 │
         └─────────────────┴─────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Gateway Protocol Handler                       │
│                         (消息处理器)                                │
├─────────────────────────────────────────────────────────────────────┤
│                         │                                           │
│                         ▼                                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  节点注册表 (NodeRegistry)                  │   │
│  │                                                             │   │
│  │  ┌─────────────────┐  ┌─────────────────┐                   │   │
│  │  │  nodesById      │  │  nodesByConn    │                   │   │
│  │  │  Map<nodeId,    │  │  Map<connId,    │                   │   │
│  │  │      NodeSession│  │      nodeId>    │                   │   │
│  │  └─────────────────┘  └─────────────────┘                   │   │
│  │                                                             │   │
│  │  ┌─────────────────────────────────────────────────────────┐│   │
│  │  │           pendingInvokes                               ││   │
│  │  │  Map<requestId, PendingInvoke>                         ││   │
│  │  │  ├─ nodeId: string                                     ││   │
│  │  │  ├─ command: string                                    ││   │
│  │  │  ├─ resolve/reject: Promise callbacks                  ││   │
│  │  │  └─ timer: setTimeout                                  ││   │
│  │  └─────────────────────────────────────────────────────────┘│   │
│  └─────────────────────────────────────────────────────────────┘   │
│                           │                                         │
│           ┌───────────────┼───────────────┐                        │
│           │               │               │                        │
│           ▼               ▼               ▼                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐          │
│  │ node.list   │ │node.describe│ │   node.invoke       │          │
│  │   列表查询  │ │  详情查询   │ │   (RPC 调用)        │          │
│  └─────────────┘ └─────────────┘ └─────────────────────┘          │
│                           │                                         │
│                           ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              节点方法处理器 (nodes.ts)                      │   │
│  │                                                             │   │
│  │  配对管理:        RPC 调用:        事件处理:                │   │
│  │  • pair.request   • node.invoke   • node.event              │   │
│  │  • pair.approve   • invoke.result                           │   │
│  │  • pair.reject                                              │   │
│  │  • pair.list                                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐
│   技能远程执行  │ │  CLI 工具   │ │   UI 控制器     │
│                 │ │             │ │                 │
│ skills-remote.ts│ │  nodes-cli  │ │  nodes.ts       │
│                 │ │             │ │                 │
│ • 远程技能发现  │ │ • status    │ │ • 列出节点      │
│ • 远程命令执行  │ │ • invoke    │ │ • 调用命令      │
└─────────────────┘ │ • describe  │ │ • 查看详情      │
                    └─────────────┘ └─────────────────┘
```

## 核心组件

### 1. NodeRegistry 类

节点注册表的核心实现，管理所有已连接节点的状态和 RPC 调用：

```typescript
class NodeRegistry {
  // 存储结构
  private nodesById = new Map<string, NodeSession>();     // nodeId -> 会话
  private nodesByConn = new Map<string, string>();        // connId -> nodeId
  private pendingInvokes = new Map<string, PendingInvoke>(); // requestId -> 调用状态

  // 注册新节点
  register(client: GatewayWsClient, opts: { remoteIp?: string }): NodeSession
  
  // 注销节点（断开连接时）
  unregister(connId: string): string | null
  
  // 列出所有已连接节点
  listConnected(): NodeSession[]
  
  // 获取特定节点
  get(nodeId: string): NodeSession | undefined
  
  // RPC 调用：向节点发送命令
  invoke(params: {
    nodeId: string;
    command: string;
    params?: unknown;
    timeoutMs?: number;
    idempotencyKey?: string;
  }): Promise<NodeInvokeResult>
  
  // 处理 RPC 响应
  handleInvokeResult(params: NodeInvokeResult): boolean
  
  // 向节点发送事件
  sendEvent(nodeId: string, event: string, payload?: unknown): boolean
}
```

### 2. 节点会话结构

```typescript
interface NodeSession {
  nodeId: string;              // 节点唯一标识（设备ID或客户端ID）
  connId: string;              // WebSocket 连接ID
  client: GatewayWsClient;     // WebSocket 客户端引用
  
  // 设备信息
  displayName?: string;        // 显示名称
  platform?: string;           // 平台（iOS/Android/desktop）
  version?: string;            // 应用版本
  coreVersion?: string;        // 核心版本
  uiVersion?: string;          // UI 版本
  deviceFamily?: string;       // 设备系列（iPhone/iPad等）
  modelIdentifier?: string;    // 设备型号
  
  // 连接信息
  remoteIp?: string;           // 远程IP地址
  connectedAtMs: number;       // 连接时间戳
  
  // 能力和权限
  caps: string[];              // 能力列表（camera, microphone等）
  commands: string[];          // 支持的命令列表
  permissions?: Record<string, boolean>;  // 权限映射
  pathEnv?: string;            // PATH 环境变量
}
```

### 3. 挂起调用结构

```typescript
interface PendingInvoke {
  nodeId: string;              // 目标节点
  command: string;             // 命令名称
  resolve: (value: NodeInvokeResult) => void;  // 成功回调
  reject: (err: Error) => void;                // 失败回调
  timer: ReturnType<typeof setTimeout>;        // 超时定时器
}

interface NodeInvokeResult {
  ok: boolean;                 // 是否成功
  payload?: unknown;           // 响应数据
  payloadJSON?: string | null; // JSON 字符串形式的数据
  error?: {                    // 错误信息
    code?: string;
    message?: string;
  } | null;
}
```

## 节点注册流程

### 连接与注册流程

```
节点设备（移动应用/远程 CLI）
           │
           │ 1. WebSocket 连接
           │    携带 role="node"
           ▼
┌──────────────────────────────┐
│   Protocol Handler           │
│   (message-handler.ts)       │
│                              │
│ • 握手验证                   │
│ • 协议版本协商               │
│ • 设备认证                   │
│ • 配对状态检查               │
└──────────┬───────────────────┘
           │
           │ 2. 握手成功
           │    role === "node"
           ▼
┌──────────────────────────────┐
│   NodeRegistry.register()    │
│                              │
│ • 提取 device.id 作为 nodeId │
│ • 收集 caps（能力）          │
│ • 收集 commands（命令）      │
│ • 记录设备元数据             │
│ • 存储到 nodesById           │
│ • 建立 connId -> nodeId 映射 │
└──────────┬───────────────────┘
           │
           │ 3. 注册完成
           ▼
    节点已连接并可用
           │
           │ 4. 广播节点上线
           ▼
    通知所有客户端
```

### 断开与注销流程

```
节点断开连接
    │
    ▼
┌──────────────────────────────┐
│   onDisconnect()             │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│   NodeRegistry.unregister()  │
│                              │
│ • 查找 connId 对应的 nodeId  │
│ • 从 nodesByConn 删除        │
│ • 从 nodesById 删除          │
│ • 遍历 pendingInvokes        │
│ • 取消相关调用（reject）     │
│ • 清理定时器                 │
└──────────┬───────────────────┘
           │
           ▼
    广播节点离线事件
```

## RPC 调用机制

### node.invoke 完整流程

```
调用方（CLI/智能体）
    │
    │ 1. node.invoke 请求
    │    {
    │      nodeId: "device-123",
    │      command: "camera.capture",
    │      params: { quality: "high" },
    │      timeoutMs: 30000,
    │      idempotencyKey: "unique-key"
    │    }
    ▼
┌──────────────────────────────┐
│   节点方法处理器             │
│   (nodes.ts)                 │
│                              │
│ 2. 参数验证                  │
│ 3. 查找节点会话              │
│ 4. 检查节点是否在线          │
│ 5. 命令白名单验证            │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│   NodeRegistry.invoke()      │
│                              │
│ 6. 生成 requestId (UUID)     │
│ 7. 构建调用载荷              │
│ 8. 通过 WebSocket 发送       │
│    "node.invoke.request" 事件│
│ 9. 创建 Promise              │
│ 10. 设置超时定时器           │
│ 11. 存储到 pendingInvokes    │
└──────────┬───────────────────┘
           │
           ▼
    等待响应（异步）
           │
           ├──────────────┐
           │              │
      收到响应         超时触发
           │              │
           ▼              ▼
┌──────────────┐  ┌──────────────┐
│ handleInvoke │  │  超时处理    │
│ Result()     │  │              │
│              │  │ • 删除挂起   │
│ • 清理定时器 │  │ • 返回超时   │
│ • resolve()  │  │   错误       │
│   Promise    │  │              │
└──────────────┘  └──────────────┘
           │
           ▼
    返回 NodeInvokeResult
    给调用方
```

### 节点端处理流程

```
节点设备（移动应用）
    │
    │ 收到 "node.invoke.request" 事件
    │ {
    │   id: "uuid",
    │   nodeId: "device-123",
    │   command: "camera.capture",
    │   paramsJSON: "{...}",
    │   timeoutMs: 30000
    │ }
    ▼
┌──────────────────────────────┐
│   节点命令处理器             │
│   (node-host/runner.ts)      │
│                              │
│ 1. 解析命令                  │
│ 2. 检查命令是否支持          │
│ 3. 执行本地操作              │
│    • 调用相机 API            │
│    • 读取传感器              │
│    • 执行 shell 命令         │
│    • ...                     │
│ 4. 获取结果                  │
└──────────┬───────────────────┘
           │
           ▼
┌──────────────────────────────┐
│   发送响应                   │
│   "node.invoke.result"       │
│                              │
│ {
│   id: "uuid",                │
│   nodeId: "device-123",      │
│   ok: true,                  │
│   payload: {...},            │
│   error: null                │
│ }                            │
└──────────────────────────────┘
```

## 节点方法 API

### 核心方法列表

| 方法 | 权限 | 描述 |
|------|------|------|
| `node.list` | `operator.read` | 列出所有已配对和已连接的节点 |
| `node.describe` | `operator.read` | 获取特定节点的详细信息 |
| `node.invoke` | `operator.write` | 向节点发送 RPC 命令 |
| `node.invoke.result` | `node` 角色 | 节点返回 RPC 调用结果 |
| `node.event` | `node` 角色 | 节点发送事件到 Gateway |
| `node.pair.request` | `operator.pairing` | 请求节点配对 |
| `node.pair.approve` | `operator.pairing` | 批准节点配对请求 |
| `node.pair.reject` | `operator.pairing` | 拒绝节点配对请求 |
| `node.pair.list` | `operator.read` | 列出所有配对请求 |
| `node.pair.verify` | `operator.read` | 验证节点令牌 |
| `node.rename` | `operator.write` | 重命名节点 |

### node.list 响应示例

```typescript
{
  ts: 1234567890,  // 时间戳
  nodes: [
    {
      nodeId: "iphone-abc123",
      displayName: "Peter's iPhone",
      platform: "ios",
      version: "1.2.3",
      coreVersion: "2.1.0",
      uiVersion: "1.5.0",
      deviceFamily: "iPhone",
      modelIdentifier: "iPhone15,2",
      remoteIp: "192.168.1.100",
      caps: ["camera", "microphone", "location"],
      commands: ["camera.capture", "location.get", "notify.send"],
      pathEnv: "/usr/bin:/bin",
      permissions: { "camera": true, "location": true },
      connectedAtMs: 1234567800,
      paired: true,
      connected: true
    },
    // ... 更多节点
  ]
}
```

### node.invoke 调用示例

```typescript
// 请求
{
  nodeId: "iphone-abc123",
  command: "camera.capture",
  params: {
    quality: "high",
    flash: "auto"
  },
  timeoutMs: 30000,
  idempotencyKey: "capture-2025-001"
}

// 响应
{
  ok: true,
  nodeId: "iphone-abc123",
  command: "camera.capture",
  payload: {
    imageData: "base64-encoded-image...",
    width: 3024,
    height: 4032,
    timestamp: 1234567890
  },
  payloadJSON: null
}
```

## 命令白名单机制

### 安全控制

```typescript
// 检查命令是否允许执行
function isNodeCommandAllowed({
  command,              // 要执行的命令
  declaredCommands,     // 节点声明的命令列表
  allowlist,            // 网关配置的白名单
}): { ok: boolean; reason?: string }

// 允许的命令源
const ALLOWED_COMMAND_SOURCES = {
  1. "node_declared": 命令在节点的 commands 列表中
  2. "config_allowlist": 命令在网关配置的额外白名单中
  3. "default_allowlist": 命令在默认允许列表中
}
```

### 配置示例

```yaml
# gateway.yml
gateway:
  # 额外允许的节点命令（超出默认列表）
  extraNodeCommands:
    - "custom.command1"
    - "custom.command2"
```

## 节点配对系统

### 配对流程

```
新节点（移动应用）
    │
    │ 1. 首次连接
    │    发送 pair.request
    ▼
┌──────────────────────────────┐
│   配对系统                   │
│   (node-pairing.ts)          │
│                              │
│ • 创建配对请求               │
│ • 生成验证令牌               │
│ • 存储请求状态               │
└──────────┬───────────────────┘
           │
           │ 2. 广播配对请求
           │    "node.pair.requested"
           ▼
    等待管理员批准
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
┌────────┐   ┌────────┐
│ 批准   │   │ 拒绝   │
│(approve)│   │(reject)│
└────┬───┘   └────┬───┘
     │            │
     ▼            ▼
  已配对       被拒绝
  节点可       断开连接
  正常通信
```

### 配对状态

| 状态 | 描述 |
|------|------|
| `pending` | 等待管理员批准 |
| `approved` | 已批准，节点已配对 |
| `rejected` | 已拒绝，连接将被断开 |

## 事件系统

### 节点相关事件

| 事件 | 方向 | 描述 |
|------|------|------|
| `node.pair.requested` | Gateway → 客户端 | 新的配对请求 |
| `node.pair.resolved` | Gateway → 客户端 | 配对请求已处理（批准/拒绝） |
| `node.invoke.request` | Gateway → 节点 | RPC 调用请求 |
| `node.event` | 节点 → Gateway | 节点发送的事件 |

### 事件发送示例

```typescript
// Gateway 向节点发送事件
nodeRegistry.sendEvent("iphone-abc123", "config.updated", {
  key: "gateway.host",
  value: "192.168.1.50"
});

// 节点向 Gateway 发送事件
// （通过 node.event 方法）
{
  event: "sensor.motion.detected",
  payload: { location: "living-room" }
}
```

## 与技能系统的集成

### 远程技能发现

```typescript
// skills-remote.ts
function setSkillsRemoteRegistry(registry: NodeRegistry) {
  remoteRegistry = registry;
}

// 发现远程节点上的技能
async function discoverRemoteSkills(nodeId: string): Promise<Skill[]> {
  const result = await nodeRegistry.invoke({
    nodeId,
    command: "skills.discover",
    timeoutMs: 5000
  });
  return result.payload?.skills ?? [];
}
```

### 远程技能执行

```typescript
// 通过节点执行远程命令
async function executeRemoteSkill(
  nodeId: string,
  skillId: string,
  input: unknown
): Promise<unknown> {
  const result = await nodeRegistry.invoke({
    nodeId,
    command: "skill.execute",
    params: { skillId, input },
    timeoutMs: 60000
  });
  return result.payload;
}
```

## 关键文件

| 文件 | 用途 |
|------|------|
| `src/gateway/node-registry.ts` | NodeRegistry 类实现 |
| `src/gateway/server-methods/nodes.ts` | 节点方法处理器（list/describe/invoke/pair等） |
| `src/gateway/server-methods.ts` | 节点方法注册到 Gateway 处理器 |
| `src/infra/node-pairing.ts` | 节点配对逻辑 |
| `src/infra/skills-remote.ts` | 远程技能执行（使用 NodeRegistry） |
| `src/node-host/runner.ts` | 节点端实现（接收 invoke 请求） |
| `src/cli/nodes-cli/` | CLI 节点管理工具 |
| `src/agents/tools/nodes-tool.ts` | 智能体节点工具 |

## 运行时状态

```typescript
interface NodeRegistryState {
  // 已连接节点（内存存储）
  nodesById: Map<string, NodeSession>;
  
  // 连接映射（用于快速查找）
  nodesByConn: Map<string, string>;
  
  // 挂起的 RPC 调用
  pendingInvokes: Map<string, PendingInvoke>;
  
  // 统计信息
  stats: {
    totalRegistered: number;
    totalInvoked: number;
    totalFailed: number;
    averageResponseTime: number;
  };
}
```

## 最佳实践

### 1. 命令设计原则

```typescript
// 好的命令设计
{
  command: "camera.capture",
  params: {
    quality: "high",      // 明确的参数
    flash: "auto",        // 合理的默认值
    timeoutMs: 30000      // 可配置的超时
  }
}

// 避免的命令设计
{
  command: "doSomething",  // 命名不清晰
  params: undefined        // 缺少参数说明
}
```

### 2. 错误处理

```typescript
// 节点端错误响应
{
  ok: false,
  error: {
    code: "CAMERA_NOT_AVAILABLE",
    message: "Camera is being used by another app",
    retryable: true,           // 可重试
    retryAfterMs: 5000         // 建议5秒后重试
  }
}
```

### 3. 幂等性设计

```typescript
// 使用 idempotencyKey 防止重复执行
const result = await nodeRegistry.invoke({
  nodeId: "device-123",
  command: "payment.charge",
  params: { amount: 100 },
  idempotencyKey: "charge-2025-01-001"  // 唯一标识
});
```

## 相关文档

- [Gateway 架构](/code/gateway-architecture)
- [Protocol Handler 架构](/code/protocol-handler-architecture)
- [设备配对系统](/security/device-pairing)
- [远程技能执行](/skills/remote-execution)
- [节点 CLI 工具](/cli/nodes)