# 通道管理器架构

通道管理器（Channel Manager）是 OpenClaw Gateway 的核心组件，负责管理所有消息通道的生命周期、路由消息、处理 Webhook 以及协调内置通道和扩展插件。

## 概述

通道管理器作为消息流的**交通枢纽**，承担以下核心职责：

| 职责 | 描述 |
|------|------|
| **通道生命周期** | 启动/停止通道账户，管理运行时状态 |
| **插件注册** | 注册和管理内置通道与扩展通道插件 |
| **消息路由** | 将入站消息路由到正确的智能体会话 |
| **Webhook 处理** | 接收并分发外部平台的 Webhook 事件 |
| **账户管理** | 管理多账户配置和账户状态 |
| **状态监控** | 监控通道健康状态，提供运行时快照 |
| **安全策略** | 实施访问控制（allowFrom、mention-gating） |
| **出站消息** | 协调通过不同通道发送消息 |
| **群组管理** | 处理群组/团队策略和成员管理 |
| **配置热重载** | 支持配置更改时无需重启 |

## 架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         客户端层                                    │
├─────────────┬─────────────┬─────────────┬───────────────────────────┤
│   CLI       │ 移动应用    │   Web UI    │   外部消息平台            │
└──────┬──────┴──────┬──────┴──────┬──────┴───────────┬───────────────┘
       │             │             │                  │
       └─────────────┴─────────────┴──────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       消息路由层                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │   绑定解析器 (routing/)                                      │   │
│  │   peer → guild/team → account → channel → default           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                           │                                         │
│                           ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │   会话管理器 (server-chat.ts)                                │   │
│  │   - 构建会话密钥: agent:{id}:{key}:{channel}:{account}:{peer}│   │
│  │   - 加载/创建会话                                           │   │
│  │   - 调度到智能体                                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      通道管理层 (Channel Manager)                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  插件注册表  │  │  通道运行时  │  │    账户管理器            │  │
│  │              │  │              │  │                          │  │
│  │ - 内置通道   │  │ - AbortCont. │  │ - listAccountIds()       │  │
│  │ - 扩展插件   │  │ - 任务追踪   │  │ - resolveAccount()       │  │
│  │ - 元数据     │  │ - 状态快照   │  │ - 状态监控               │  │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘  │
│         │                 │                       │                │
│         └─────────────────┴───────────────────────┘                │
│                           │                                         │
│                           ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   通道插件接口                               │   │
│  │                                                              │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │   │
│  │  │   config    │ │   gateway   │ │  outbound   │            │   │
│  │  │   (配置)    │ │  (生命周期) │ │  (出站消息) │            │   │
│  │  ├─────────────┤ ├─────────────┤ ├─────────────┤            │   │
│  │  │ security    │ │   status    │ │  threading  │            │   │
│  │  │ (安全策略)  │ │  (状态监控) │ │  (线程回复) │            │   │
│  │  ├─────────────┤ ├─────────────┤ ├─────────────┤            │   │
│  │  │  directory  │ │   groups    │ │  mentions   │            │   │
│  │  │ (联系人/群) │ │  (群组管理) │ │  (提及处理) │            │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
┌─────────────────┐ ┌───────────────┐ ┌─────────────────┐
│   内置通道      │ │  扩展插件     │ │   Webhook       │
│                 │ │               │ │   处理器        │
│ • Telegram      │ │ extensions/   │ │                 │
│ • WhatsApp      │ │ • Matrix      │ │ • Telegram      │
│ • Discord       │ │ • Teams       │ │ • LINE          │
│ • Slack         │ │ • Mattermost  │ │ • Slack         │
│ • Signal        │ │ • Nextcloud   │ │ • Google Chat   │
│ • iMessage      │ │ • Nostr       │ │                 │
│ • Google Chat   │ │ • Tlon        │ │                 │
└─────────────────┘ │ • Twitch      │ └─────────────────┘
                    │ • LINE        │
                    │ • Zalo        │
                    └───────────────┘
```

## 核心组件

### 1. 通道管理器 (`server-channels.ts`)

通道管理器是协调所有通道操作的中央控制器：

```typescript
interface ChannelManager {
  // 启动所有已配置的通道
  startChannels(): Promise<void>
  
  // 启动特定通道的特定账户
  startChannel(channelId: ChannelId, accountId?: string): Promise<void>
  
  // 停止通道
  stopChannel(channelId: ChannelId, accountId?: string): Promise<void>
  
  // 获取通道运行时快照
  getRuntimeSnapshot(): ChannelRuntimeSnapshot
  
  // 获取通道状态
  getChannelStatus(channelId: ChannelId, accountId: string): ChannelAccountStatus
}

// 运行时存储
interface ChannelRuntimeStore {
  aborts: Map<string, AbortController>    // 取消控制器
  tasks: Map<string, Promise<void>>       // 运行中任务
  runtimes: Map<string, ChannelRuntime>   // 运行时状态
}
```

### 2. 插件注册表

#### 内置通道注册表 (`src/channels/registry.ts`)

```typescript
// 核心聊天通道（内置）
export const CHAT_CHANNEL_ORDER = [
  "telegram",    // Telegram Bot API
  "whatsapp",    // WhatsApp Web (Baileys)
  "discord",     // Discord Bot API
  "googlechat",  // Google Chat API
  "slack",       // Slack Socket Mode
  "signal",      // Signal (signal-cli)
  "imessage",    // iMessage (imsg/BlueBubbles)
] as const;

// 通道元数据
export const CHAT_CHANNEL_DEFS: Record<ChatChannel, ChannelDef> = {
  telegram: {
    label: "Telegram",
    color: "#0088cc",
    aliases: ["tg"],
    docsPath: "/channels/telegram",
    allowMultiple: true,  // 支持多账户
  },
  whatsapp: {
    label: "WhatsApp",
    color: "#25D366",
    aliases: ["wa"],
    allowMultiple: false,
  },
  // ... 其他通道
};
```

#### 扩展通道注册表 (`src/channels/plugins/`)

```typescript
// 插件通道注册表
interface ChannelPluginRegistry {
  // 获取通道插件
  getChannelPlugin(id: ChannelId): ChannelPlugin | undefined
  
  // 列出所有已注册通道
  listChannelPlugins(): ChannelPlugin[]
  
  // 规范化通道 ID（处理别名）
  normalizeChannelId(id: string): ChannelId
}

// 插件目录发现
class ChannelPluginCatalog {
  // 从多个来源发现插件
  discover(): PluginCandidate[] {
    // 1. 工作区扩展 (extensions/*)
    // 2. 配置目录
    // 3. 外部包
    // 4. 捆绑通道
  }
  
  // 基于优先级解析
  resolve(candidates: PluginCandidate[]): ChannelPlugin[]
}
```

### 3. 通道插件接口

```typescript
type ChannelPlugin<ResolvedAccount = any> = {
  // 基础信息
  id: ChannelId;                       // 唯一标识符
  meta: ChannelMeta;                   // 标签、文档路径等
  capabilities: ChannelCapabilities;   // 功能标志
  
  // 配置适配器
  config: ChannelConfigAdapter<ResolvedAccount>;
  configSchema?: ChannelConfigSchema;
  setup?: ChannelSetupAdapter;
  reload?: { configPrefixes: string[] };
  
  // 安全与访问控制
  security?: ChannelSecurityAdapter<ResolvedAccount>;
  pairing?: ChannelPairingAdapter;
  groups?: ChannelGroupAdapter;
  
  // 消息处理
  outbound: ChannelOutboundAdapter;    // 发送消息
  messaging?: ChannelMessagingAdapter; // 目标规范化
  threading?: ChannelThreadingAdapter; // 回复线程
  mentions?: ChannelMentionAdapter;    // 提及处理
  streaming?: ChannelStreamingAdapter; // 流式响应
  
  // 网关生命周期
  gateway?: ChannelGatewayAdapter<ResolvedAccount>;
  
  // 状态与目录
  status?: ChannelStatusAdapter<ResolvedAccount>;
  directory?: ChannelDirectoryAdapter;
  
  // 交互
  actions?: ChannelMessageActionAdapter;
  
  // 智能体工具
  agentTools?: ChannelAgentToolFactory | ChannelAgentTool[];
};
```

### 4. 适配器详解

#### 配置适配器

```typescript
interface ChannelConfigAdapter<ResolvedAccount> {
  // 列出所有账户 ID
  listAccountIds(): string[] | Promise<string[]>
  
  // 解析账户配置
  resolveAccount(accountId: string): ResolvedAccount | Promise<ResolvedAccount>
  
  // 检查账户是否启用
  isAccountEnabled(accountId: string): boolean
  
  // 获取账户凭证
  getCredentials(accountId: string): Credentials
}
```

#### 网关适配器（生命周期）

```typescript
interface ChannelGatewayAdapter<ResolvedAccount> {
  // 启动账户连接
  startAccount(ctx: GatewayContext<ResolvedAccount>): Promise<void>
  
  // 停止账户连接
  stopAccount(ctx: GatewayContext<ResolvedAccount>): Promise<void>
}

interface GatewayContext<Account> {
  cfg: Config                    // 全局配置
  accountId: string              // 账户 ID
  account: Account               // 解析后的账户
  runtime: ChannelRuntime        // 运行时状态
  abortSignal: AbortSignal       // 取消信号
  log: Logger                    // 通道专属日志
  getStatus(): ChannelStatus     // 获取状态
  setStatus(status: ChannelStatus): void  // 更新状态
}
```

#### 出站适配器

```typescript
interface ChannelOutboundAdapter {
  // 发送文本消息
  sendText(params: SendTextParams): Promise<MessageId>
  
  // 发送媒体
  sendMedia(params: SendMediaParams): Promise<MessageId>
  
  // 发送投票
  sendPoll(params: SendPollParams): Promise<MessageId>
  
  // 发送位置
  sendLocation(params: SendLocationParams): Promise<MessageId>
  
  // 发送卡片/模板
  sendCard?(params: SendCardParams): Promise<MessageId>
}

interface SendTextParams {
  channel: ChannelId
  accountId: string
  to: MessageTarget           // 目标（用户/群组）
  text: string
  replyToId?: string          // 回复消息 ID
  metadata?: MessageMetadata
}
```

#### 安全适配器

```typescript
interface ChannelSecurityAdapter<ResolvedAccount> {
  // 检查是否允许来自某对等方的消息
  allowFrom(params: { 
    account: ResolvedAccount
    peerId: string
    chatType: ChatType
  }): boolean | Promise<boolean>
  
  // 获取群组策略
  getGroupPolicy(params: {
    account: ResolvedAccount
    groupId: string
  }): GroupPolicy
  
  // 检查是否需要提及才能响应
  requireMention(params: {
    account: ResolvedAccount
    chatType: ChatType
    isReplyToBot: boolean
  }): boolean
}
```

## 消息流

### 入站消息流程

```
外部消息平台
      │
      │ 1. 消息到达
      ▼
┌─────────────────────────┐
│   通道监控器            │
│   (WhatsApp/Telegram等) │
│                         │
│ • 连接实时 API          │
│ • 监听消息              │
│ • 接收 Webhook          │
└───────────┬─────────────┘
            │
            │ 2. 提取原始数据
            ▼
┌─────────────────────────┐
│   消息规范化            │
│                         │
│ • 提取文本/媒体/位置    │
│ • 构建发送者信息        │
│ • 解析回复关系          │
│ • 处理提及/命令         │
└───────────┬─────────────┘
            │
            │ 3. 创建 MsgContext
            ▼
┌─────────────────────────┐
│   安全检查              │
│                         │
│ • allowFrom()           │
│ • requireMention()      │
│ • groupPolicy 检查      │
└───────────┬─────────────┘
            │
            │ 通过检查
            ▼
┌─────────────────────────┐
│   路由解析              │
│   (routing/)            │
│                         │
│ 绑定解析层次：          │
│ 1. peer 绑定            │
│ 2. guild/team 绑定      │
│ 3. account 绑定         │
│ 4. channel 默认         │
│ 5. system 默认          │
└───────────┬─────────────┘
            │
            │ 4. 解析出 agentId
            ▼
┌─────────────────────────┐
│   会话管理              │
│   (server-chat.ts)      │
│                         │
│ 构建会话密钥：          │
│ agent:{id}:{key}:{chan} │
│ :{account}:{peerKind}   │
│ :{peerId}               │
│                         │
│ 加载或创建会话          │
└───────────┬─────────────┘
            │
            │ 5. 调度到智能体
            ▼
┌─────────────────────────┐
│   智能体处理            │
│   (Agent Runtime)       │
│                         │
│ • 加载上下文            │
│ • 执行技能              │
│ • 生成回复              │
└─────────────────────────┘
```

### 出站消息流程

```
智能体生成回复
      │
      │ 1. 调用 sendText/sendMedia
      ▼
┌─────────────────────────┐
│   通道管理器            │
│   路由到目标通道        │
└───────────┬─────────────┘
            │
            │ 2. 获取通道插件
            ▼
┌─────────────────────────┐
│   Outbound Adapter      │
│                         │
│ • 规范化目标            │
│ • 处理线程/回复         │
│ • 构建平台特定载荷      │
└───────────┬─────────────┘
            │
            │ 3. 调用平台 API
            ▼
┌─────────────────────────┐
│   平台 SDK/API          │
│   (Telegram/Discord等)  │
│                         │
│ • HTTP API              │
│ • WebSocket             │
│ • 专用 SDK              │
└───────────┬─────────────┘
            │
            │ 4. 发送消息
            ▼
      外部消息平台
```

## Webhook 架构

### Webhook 接收模式

```
外部平台 Webhook
      │
      │ POST /webhook/{channel}
      ▼
┌─────────────────────────┐
│   HTTP 服务器           │
│   (server-http.ts)      │
│                         │
│ 路由表：                │
│ /webhook/telegram       │
│ /webhook/line           │
│ /webhook/slack          │
│ ...                     │
└───────────┬─────────────┘
            │
            │ 2. 签名验证
            ▼
┌─────────────────────────┐
│   通道 Webhook 处理器   │
│                         │
│ • 验证签名/令牌         │
│ • 解析载荷              │
│ • 过滤无效请求          │
└───────────┬─────────────┘
            │
            │ 3. 转换为内部事件
            ▼
┌─────────────────────────┐
│   onMessage() 回调      │
│   进入入站消息流程      │
└─────────────────────────┘
```

### 各通道 Webhook 实现

| 通道 | 实现文件 | 签名验证 | 路径 |
|------|----------|----------|------|
| **Telegram** | `src/telegram/webhook.ts` | Secret Token | `/webhook/telegram` |
| **LINE** | `src/line/webhook.ts` | X-Line-Signature | `/webhook/line` |
| **Slack** | `src/slack/http/` | Slack 签名 | `/webhook/slack` |
| **Google Chat** | 内置 | Bearer Token | `/webhook/googlechat` |
| **自定义** | 扩展插件 | 自定义 | 插件注册 |

### 自定义 Webhook 注册

```typescript
// 在通道插件中注册 Webhook
api.registerHttpRoute({
  path: "/webhook/my-channel",
  method: "POST",
  handler: async (req, res) => {
    // 1. 验证签名
    const signature = req.headers['x-signature'];
    if (!verifySignature(signature, req.body, secret)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // 2. 解析消息
    const message = parseWebhookPayload(req.body);
    
    // 3. 调用 onMessage 回调
    await onMessage({
      text: message.text,
      from: { id: message.userId },
      to: { id: message.chatId },
      // ...
    });
    
    res.status(200).json({ ok: true });
  }
});
```

## 内置通道 vs 扩展通道

### 对比表

| 特性 | 内置通道 | 扩展通道 |
|------|----------|----------|
| **位置** | `src/telegram/`, `src/discord/` 等 | `extensions/matrix/`, `extensions/teams/` 等 |
| **加载时机** | 启动时立即加载 | 按需动态加载 |
| **注册方式** | 硬编码注册 | `api.registerChannel()` 调用 |
| **依赖** | 核心依赖 | 独立 package.json |
| **更新** | 随核心版本更新 | 独立版本管理 |
| **隔离性** | 共享核心依赖 | 沙箱化，独立依赖 |
| **示例** | Telegram, WhatsApp, Discord | Matrix, Teams, Mattermost |

### 内置通道清单

```typescript
// src/channels/registry.ts
const BUILT_IN_CHANNELS = {
  telegram: {
    impl: "src/telegram/",
    features: ["bots", "groups", "media", "polls", "reactions"],
    sdk: "grammy",
  },
  whatsapp: {
    impl: "src/whatsapp/",
    features: ["individual", "groups", "media", "status"],
    sdk: "baileys",
  },
  discord: {
    impl: "src/discord/",
    features: ["bots", "guilds", "threads", "reactions", "slash-commands"],
    sdk: "discord.js",
  },
  slack: {
    impl: "src/slack/",
    features: ["socket-mode", "bots", "channels", "threads"],
    sdk: "@slack/bolt",
  },
  signal: {
    impl: "src/signal/",
    features: ["individual", "groups", "reactions"],
    sdk: "signal-cli",
  },
  imessage: {
    impl: "src/imessage/",
    features: ["individual", "groups", "taps", "effects"],
    platform: "macOS only",
  },
  googlechat: {
    impl: "src/googlechat/",
    features: ["bots", "spaces", "cards"],
    sdk: "Google Chat API",
  },
};
```

### 扩展通道清单

```
extensions/
├── matrix/          # Matrix 协议
├── msteams/         # Microsoft Teams
├── mattermost/      # Mattermost
├── nextcloud-talk/  # Nextcloud Talk
├── nostr/           # Nostr 协议
├── tlon/            # Tlon/Urbit
├── twitch/          # Twitch 聊天
├── line/            # LINE
├── zalo/            # Zalo 官方
├── zalouser/        # Zalo 用户模式
├── bluebubbles/     # BlueBubbles (iMessage)
├── googlechat/      # Google Chat 扩展
├── slack/           # Slack 扩展
├── telegram/        # Telegram 扩展
├── signal/          # Signal 扩展
├── discord/         # Discord 扩展
├── imessage/        # iMessage 扩展
└── whatsapp/        # WhatsApp 扩展
```

## 通道生命周期

### 完整生命周期流程

```
┌───────────────┐
│   未启动      │
│  (idle)       │
└───────┬───────┘
        │
        │ 1. startChannel() 调用
        ▼
┌───────────────┐
│   启动中      │
│  (starting)   │
│               │
│ • 获取插件    │
│ • 列出账户    │
│ • 创建运行时  │
└───────┬───────┘
        │
        │ 2. plugin.gateway.startAccount()
        ▼
┌───────────────┐     ┌───────────────┐
│   运行中      │◀───│   已连接      │
│  (running)    │     │  (connected)  │
│               │     │               │
│ • 监控消息    │     │ • 连接建立    │
│ • 处理请求    │     │ • 认证完成    │
│ • 维护状态    │     │ • 准备就绪    │
└───────┬───────┘     └───────────────┘
        │
        │ 错误/断开
        ▼
┌───────────────┐
│   错误        │
│  (error)      │
│               │
│ • 记录错误    │
│ • 尝试重连    │
│ • 指数退避    │
└───────┬───────┘
        │
        │ 3. stopChannel() 调用
        ▼
┌───────────────┐
│   停止中      │
│  (stopping)   │
│               │
│ • 发送中止    │
│ • 等待清理    │
│ • 移除运行时  │
└───────┬───────┘
        │
        ▼
┌───────────────┐
│   已停止      │
│  (stopped)    │
└───────────────┘
```

### 状态转换触发器

| 当前状态 | 触发事件 | 下一状态 | 操作 |
|----------|----------|----------|------|
| idle | startChannel() | starting | 初始化运行时 |
| starting | 连接成功 | connected | 建立连接 |
| starting | 连接失败 | error | 记录错误 |
| connected | 就绪完成 | running | 开始处理消息 |
| running | 连接断开 | error | 进入重连逻辑 |
| error | 重连成功 | connected | 恢复连接 |
| error | 达到最大重试 | stopped | 停止尝试 |
| running | stopChannel() | stopping | 发送中止信号 |
| stopping | 清理完成 | stopped | 移除运行时 |

## 配置热重载

### 热重载机制

```typescript
// 通道配置热重载
interface ChannelReloadConfig {
  // 监听配置前缀
  configPrefixes: string[];
  
  // 配置变更回调
  onConfigChange?: (changes: ConfigChange[]) => Promise<void>;
}

// 示例：Telegram 通道热重载
const telegramPlugin: ChannelPlugin = {
  id: "telegram",
  // ...
  reload: {
    configPrefixes: ["channels.telegram", "hooks.telegram"],
  },
  // ...
};
```

### 热重载流程

```
配置变更
    │
    ▼
┌─────────────────────┐
│  Config Watcher     │
│  (config-reload.ts) │
└──────────┬──────────┘
           │
           │ 检测变更
           ▼
┌─────────────────────┐
│  匹配通道插件       │
│  检查 configPrefixes│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  评估影响           │
│                     │
│ • 仅需刷新配置？    │
│ • 需要重启连接？    │
│ • 需要重启通道？    │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
┌─────────┐ ┌─────────┐
│ 刷新配置 │ │ 重启连接│
│ (热)     │ │ (温)    │
└─────────┘ └─────────┘
```

## 关键文件

| 文件 | 用途 |
|------|------|
| `src/gateway/server-channels.ts` | 通道管理器主实现 |
| `src/channels/registry.ts` | 内置通道注册表和元数据 |
| `src/channels/dock.ts` | 轻量级通道坞（共享代码路径） |
| `src/channels/plugins/index.ts` | 插件通道注册表运行时 |
| `src/channels/plugins/catalog.ts` | 通道插件目录发现 |
| `src/channels/plugins/types.plugin.ts` | ChannelPlugin 接口定义 |
| `src/channels/plugins/types.core.ts` | 核心类型定义 |
| `src/channels/plugins/types.adapters.ts` | 适配器类型定义 |
| `src/plugins/registry.ts` | 插件注册表（含通道注册） |
| `src/plugins/loader.ts` | 插件加载器 |
| `src/routing/resolve-route.ts` | 消息路由解析 |
| `src/gateway/server-chat.ts` | 聊天会话管理 |
| `src/plugin-sdk/index.ts` | 插件 SDK 导出 |

## 运行时状态

```typescript
interface ChannelManagerState {
  // 已注册通道插件
  plugins: Map<ChannelId, ChannelPlugin>;
  
  // 运行时存储（按通道-账户）
  runtimes: Map<string, ChannelRuntimeStore>;
  
  // 账户状态快照
  snapshots: Map<string, ChannelAccountSnapshot>;
  
  // 配置引用
  config: Config;
  
  // 通道专属日志
  logs: Map<ChannelId, Logger>;
}

interface ChannelRuntimeStore {
  // 取消控制器（用于停止）
  aborts: Map<string, AbortController>;
  
  // 运行中任务
  tasks: Map<string, Promise<void>>;
  
  // 运行时状态
  runtimes: Map<string, {
    status: ChannelStatus;
    connectedAt?: Date;
    lastError?: Error;
    reconnectCount: number;
  }>;
}
```

## 相关文档

- [Gateway 架构](/code/gateway-architecture)
- [Protocol Handler 架构](/code/protocol-handler-architecture)
- [路由系统](/routing/overview)
- [通道插件开发](/channels/plugin-development)
- [Telegram 通道](/channels/telegram)
- [WhatsApp 通道](/channels/whatsapp)
- [Discord 通道](/channels/discord)
- [Slack 通道](/channels/slack)
- [配置管理](/configuration)