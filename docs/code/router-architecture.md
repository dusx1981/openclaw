# 路由器架构

路由器（Router）是 OpenClaw Gateway 的核心组件，负责将来自各种消息通道的入站消息路由到正确的智能体（Agent）进行处理。它通过灵活的绑定机制实现了基于上下文的路由决策。

## 概述

路由器作为 OpenClaw 消息流的**中央调度中心**，承担以下核心职责：

| 职责 | 描述 |
|------|------|
| **绑定解析** | 根据配置绑定规则解析消息应路由到哪个智能体 |
| **优先级匹配** | 按照优先级层次（peer → guild → team → account → channel）匹配绑定 |
| **会话管理** | 构建和管理会话密钥，维护对话状态 |
| **身份识别** | 识别发送者身份，处理跨平台身份关联 |
| **上下文构建** | 构建完整的对话上下文（channel、account、peer、guild等） |
| **默认回退** | 当没有匹配绑定时回退到默认智能体 |
| **线程继承** | 支持父子对话的绑定继承 |
| **群组策略** | 处理群组/频道中的提及（@mention）策略 |
| **DM 隔离** | 根据配置控制私信会话的隔离级别 |
| **路由追踪** | 记录路由决策过程用于调试和审计 |

## 架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        消息通道层                                   │
├──────────────┬──────────────┬──────────────┬────────────────────────┤
│  WhatsApp    │   Telegram   │   Discord    │   其他通道             │
│              │              │              │   (Slack/Signal等)     │
└──────┬───────┴──────┬───────┴──────┬───────┴───────────┬────────────┘
       │              │              │                   │
       └──────────────┴──────────────┴───────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     消息上下文提取                                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ • channel: "whatsapp"/"telegram"/"discord" 等               │   │
│  │ • accountId: 账户标识（如电话号码、Bot Token ID）            │   │
│  │ • peer: { kind: "dm"|"group"|"channel", id: string }        │   │
│  │ • parentPeer: 父级对话（用于线程）                          │   │
│  │ • guildId: Discord 服务器 ID                                │   │
│  │ • teamId: Slack 工作区 ID                                   │   │
│  │ • sender: 发送者身份标识                                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        路由器核心                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    绑定解析器 (bindings.ts)                 │   │
│  │                                                              │   │
│  │ • 加载所有绑定配置                                           │   │
│  │ • 按通道过滤绑定                                             │   │
│  │ • 构建绑定索引                                               │   │
│  │ • 列出已绑定的账户                                           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                           │                                         │
│                           ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                路由解析器 (resolve-route.ts)                │   │
│  │                                                              │   │
│  │  匹配优先级（从高到低）：                                    │   │
│  │                                                              │   │
│  │  1. peer binding        ← 最具体的匹配                       │   │
│  │  2. parent peer binding ← 线程继承                           │   │
│  │  3. guild binding       ← Discord 服务器级别                 │   │
│  │  4. team binding        ← Slack 工作区级别                   │   │
│  │  5. account binding     ← 特定账户                           │   │
│  │  6. channel binding     ← 通道默认                           │   │
│  │  7. default             ← 全局默认                           │   │
│  │                                                              │   │
│  │  输出: { agentId, sessionKey, matchedBy }                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                           │                                         │
│                           ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                会话密钥管理 (session-key.ts)                │   │
│  │                                                              │   │
│  │  构建会话密钥:                                               │   │
│  │  • mainKey: agent:{id}:main                                  │   │
│  │  • peerKey: agent:{id}:{channel}:{kind}:{peerId}            │   │
│  │  • threadKey: agent:{id}:{rest}:thread:{threadId}           │   │
│  │                                                              │   │
│  │  支持 DM Scope 模式:                                         │   │
│  │  • main: 所有私信共享会话                                    │   │
│  │  • per-peer: 每个发送者独立会话                              │   │
│  │  • per-channel-peer: 按通道+发送者隔离                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      智能体会话层                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   会话存储 (sessions/store.ts)              │   │
│  │                                                              │   │
│  │  loadSessionStore()     ← 加载会话（45秒缓存）               │   │
│  │  saveSessionStore()     ← 保存会话（带文件锁）               │   │
│  │  updateSessionStore()   ← 原子性更新                         │   │
│  │                                                              │   │
│  │  会话元数据:                                                 │   │
│  │  • chatType, model, tokens                                   │   │
│  │  • groupActivation (mention/always)                          │   │
│  │  • sendPolicy (allow/deny)                                   │   │
│  │  • queueMode (steer/followup/collect)                        │   │
│  │  • lastChannel, lastTo, lastAccountId                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                           │                                         │
│                           ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     智能体执行                              │   │
│  │                                                              │   │
│  │  • 加载智能体配置 (workspace, tools, sandbox)               │   │
│  │  • 处理消息                                                  │   │
│  │  • 生成回复                                                  │   │
│  │  • 通过原通道发送回复                                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 核心组件

### 1. 路由解析器 (`resolve-route.ts`)

路由解析是消息路由的核心逻辑：

```typescript
// 路由解析输入
interface ResolveAgentRouteParams {
  cfg: OpenClawConfig;           // 完整配置
  channel: string;               // 通道类型（whatsapp/telegram/discord等）
  accountId?: string;            // 账户ID（可选）
  peer?: RoutePeer;              // 对话对象
  parentPeer?: RoutePeer;        // 父级对话（用于线程）
  guildId?: string;              // Discord 服务器ID
  teamId?: string;               // Slack 工作区ID
}

// 路由解析输出
interface ResolvedAgentRoute {
  agentId: string;               // 匹配的智能体ID
  channel: string;               // 使用的通道
  accountId: string;             // 使用的账户
  sessionKey: string;            // 完整会话密钥
  mainSessionKey: string;        // 主会话密钥（折叠）
  matchedBy:                     // 匹配方式（用于调试）
    | "binding.peer"
    | "binding.peer.parent"
    | "binding.guild"
    | "binding.team"
    | "binding.account"
    | "binding.channel"
    | "default";
}

// 主解析函数
function resolveAgentRoute(params: ResolveAgentRouteParams): ResolvedAgentRoute {
  // 1. 获取通道相关的所有绑定
  // 2. 按优先级顺序尝试匹配
  // 3. 返回最佳匹配结果
}
```

### 2. 绑定配置

绑定是配置路由规则的核心机制：

```typescript
interface AgentBinding {
  agentId: string;              // 目标智能体
  match: {
    channel: string;            // 通道类型（必填）
    accountId?: string;         // 账户ID（"*"表示通配）
    peer?: {                    // 特定对话
      kind: "dm" | "group" | "channel";
      id: string;
    };
    guildId?: string;           // Discord 服务器
    teamId?: string;            // Slack 工作区
  };
}
```

**绑定配置示例：**

```yaml
# config.yml
agents:
  - id: "support"
    name: "客服助手"
    
  - id: "sales"
    name: "销售助手"
    
  - id: "personal"
    name: "个人助手"

bindings:
  # 1. Discord 服务器级别的支持智能体
  - agentId: "support"
    match:
      channel: "discord"
      guildId: "G123456789"
      
  # 2. 特定 WhatsApp 联系人的个人助手
  - agentId: "personal"
    match:
      channel: "whatsapp"
      peer:
        kind: "dm"
        id: "+15551234567"
        
  # 3. Telegram 所有账户的销售助手
  - agentId: "sales"
    match:
      channel: "telegram"
      accountId: "*"
      
  # 4. Slack 工作区级别的默认智能体
  - agentId: "default"
    match:
      channel: "slack"
      teamId: "T987654321"
```

### 3. 绑定管理器 (`bindings.ts`)

提供绑定查询和过滤工具：

```typescript
// 列出所有绑定
function listBindings(cfg: OpenClawConfig): AgentBinding[]

// 列出通道绑定的账户
function listBoundAccountIds(
  cfg: OpenClawConfig,
  channelId: string
): string[]

// 构建通道-账户-智能体映射
function buildChannelAccountBindings(
  cfg: OpenClawConfig
): Map<string, Map<string, string[]>>

// 解析默认智能体绑定的账户
function resolveDefaultAgentBoundAccountId(
  cfg: OpenClawConfig,
  channel: string
): string | undefined
```

### 4. 会话密钥管理 (`session-key.ts`)

管理会话标识的生成和解析：

```typescript
// 构建主会话密钥
function buildAgentMainSessionKey(agentId: string): string
// 结果: "agent:support:main"

// 构建对等会话密钥
function buildAgentPeerSessionKey(
  agentId: string,
  channel: string,
  peer: RoutePeer
): string
// 结果: "agent:support:discord:dm:123456"

// 构建完整会话密钥（支持 DM Scope）
function buildAgentSessionKey(params: {
  agentId: string;
  channel: string;
  accountId: string;
  peer: RoutePeer;
  dmScope: "main" | "per-peer" | "per-channel-peer" | "per-account-channel-peer";
}): string

// 从会话密钥解析智能体ID
function resolveAgentIdFromSessionKey(sessionKey: string): string | null

// 规范化智能体ID（路径安全、shell友好）
function normalizeAgentId(agentId: string): string
```

### 5. 会话存储 (`sessions/store.ts`)

持久化会话状态：

```typescript
// 会话存储位置（可配置）
// 默认: ~/.openclaw/sessions.json

// 加载会话存储（带45秒缓存）
function loadSessionStore(storePath?: string): SessionStore

// 保存会话存储（原子写入，带文件锁）
function saveSessionStore(storePath: string, store: SessionStore): void

// 原子性更新
function updateSessionStore(
  storePath: string,
  mutator: (store: SessionStore) => void
): void

// 从入站消息记录会话元数据
function recordSessionMetaFromInbound(
  store: SessionStore,
  sessionKey: string,
  meta: SessionMeta
): void

// 更新最后路由信息
function updateLastRoute(
  store: SessionStore,
  sessionKey: string,
  route: { channel: string; to: string; accountId: string }
): void
```

## 路由优先级详解

### 绑定匹配层次结构

```
┌─────────────────────────────────────────────────────────────┐
│                    绑定优先级（从高到低）                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 【最高】peer binding                                     │
│     match: {                                                │
│       channel: "whatsapp",                                  │
│       accountId: "acc-1",                                   │
│       peer: { kind: "dm", id: "+15551234567" }             │
│     }                                                       │
│     → 特定联系人的特定账户                                  │
│                                                             │
│  2. parent peer binding                                     │
│     用于线程继承父频道的绑定                                │
│     → 线程使用父频道的智能体配置                            │
│                                                             │
│  3. guild binding (Discord)                                 │
│     match: {                                                │
│       channel: "discord",                                   │
│       guildId: "G123456789"                                 │
│     }                                                       │
│     → 整个 Discord 服务器使用同一智能体                     │
│                                                             │
│  4. team binding (Slack)                                    │
│     match: {                                                │
│       channel: "slack",                                     │
│       teamId: "T987654321"                                  │
│     }                                                       │
│     → 整个 Slack 工作区使用同一智能体                       │
│                                                             │
│  5. account binding                                         │
│     match: {                                                │
│       channel: "telegram",                                  │
│       accountId: "bot-token-id"                             │
│     }                                                       │
│     → 特定 Bot 账户的所有对话                               │
│                                                             │
│  6. channel binding (wildcard)                              │
│     match: {                                                │
│       channel: "whatsapp",                                  │
│       accountId: "*"                                        │
│     }                                                       │
│     → 该通道所有账户的默认智能体                            │
│                                                             │
│  7. 【最低】default                                          │
│     未配置任何绑定时使用 defaultAgent                       │
│     → 全局默认智能体                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 匹配算法流程

```typescript
function resolveAgentRoute(params): ResolvedAgentRoute {
  const { cfg, channel, accountId, peer, parentPeer, guildId, teamId } = params;
  
  // 1. 获取通道相关的绑定
  const channelBindings = bindings.filter(b => b.match.channel === channel);
  
  // 2. 按优先级尝试匹配
  
  // 2.1 尝试 peer binding（最具体）
  if (peer) {
    const peerBinding = findBinding(channelBindings, {
      peer: { kind: peer.kind, id: peer.id },
      accountId
    });
    if (peerBinding) {
      return buildRoute(peerBinding, "binding.peer");
    }
  }
  
  // 2.2 尝试 parent peer binding（线程继承）
  if (parentPeer) {
    const parentBinding = findBinding(channelBindings, {
      peer: { kind: parentPeer.kind, id: parentPeer.id }
    });
    if (parentBinding) {
      return buildRoute(parentBinding, "binding.peer.parent");
    }
  }
  
  // 2.3 尝试 guild binding（Discord）
  if (guildId) {
    const guildBinding = findBinding(channelBindings, { guildId });
    if (guildBinding) {
      return buildRoute(guildBinding, "binding.guild");
    }
  }
  
  // 2.4 尝试 team binding（Slack）
  if (teamId) {
    const teamBinding = findBinding(channelBindings, { teamId });
    if (teamBinding) {
      return buildRoute(teamBinding, "binding.team");
    }
  }
  
  // 2.5 尝试 account binding
  if (accountId) {
    const accountBinding = findBinding(channelBindings, { accountId });
    if (accountBinding) {
      return buildRoute(accountBinding, "binding.account");
    }
  }
  
  // 2.6 尝试 channel binding（wildcard）
  const channelBinding = findBinding(channelBindings, { accountId: "*" });
  if (channelBinding) {
    return buildRoute(channelBinding, "binding.channel");
  }
  
  // 2.7 回退到 default
  return buildRoute({ agentId: cfg.defaultAgent }, "default");
}
```

## DM Scope 模式

DM Scope 控制私信会话的隔离级别：

### 四种隔离模式

| 模式 | 会话隔离 | 适用场景 |
|------|----------|----------|
| `main` | 所有私信共享同一 `agent:{id}:main` 会话 | 个人助手，需要跨联系人记忆 |
| `per-peer` | 每个发送者独立会话 `agent:{id}:dm:{senderId}` | 客服，需要区分不同客户 |
| `per-channel-peer` | 按通道+发送者 `agent:{id}:{channel}:dm:{senderId}` | 多平台客服，区分 WhatsApp/Telegram |
| `per-account-channel-peer` | 最细粒度，按账户+通道+发送者 | 多账户 Bot，精确隔离 |

### 配置示例

```yaml
session:
  # 私信会话隔离模式
  dmScope: "per-peer"
  
  # 身份关联（跨平台识别同一用户）
  identityLinks:
    alice:
      - "telegram:111111111"
      - "discord:222222222"
      - "whatsapp:+15551234567"
```

### 会话密钥构建逻辑

```typescript
function buildAgentSessionKey(params) {
  const { agentId, channel, accountId, peer, dmScope } = params;
  
  if (peer.kind === "dm") {
    switch (dmScope) {
      case "main":
        return `agent:${agentId}:main`;
        
      case "per-peer":
        return `agent:${agentId}:dm:${peer.id}`;
        
      case "per-channel-peer":
        return `agent:${agentId}:${channel}:dm:${peer.id}`;
        
      case "per-account-channel-peer":
        return `agent:${agentId}:${channel}:${accountId}:dm:${peer.id}`;
    }
  }
  
  // group/channel 使用标准格式
  return `agent:${agentId}:${channel}:${peer.kind}:${peer.id}`;
}
```

## 消息路由完整流程

### 入站消息处理流程

```
消息到达（如 Telegram Bot 收到消息）
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. 提取消息上下文                                            │
│    (bot-message-context.ts)                                  │
│                                                               │
│    channel: "telegram"                                        │
│    accountId: "bot123456"                                     │
│    peer: {                                                    │
│      kind: peer.chat.type === "private" ? "dm" : "group",   │
│      id: String(peer.id)                                      │
│    }                                                          │
│    sender: {                                                  │
│      id: String(from.id),                                     │
│      name: from.first_name                                    │
│    }                                                          │
│    text: message.text                                         │
└──────────┬────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. 构建路由参数                                              │
│                                                               │
│    const route = resolveAgentRoute({                          │
│      cfg,                                                     │
│      channel: "telegram",                                     │
│      accountId: "bot123456",                                  │
│      peer: { kind: "dm", id: "987654321" },                   │
│      // guildId, teamId 不适用于 Telegram                     │
│    });                                                        │
└──────────┬────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. 路由决策                                                  │
│                                                               │
│    尝试匹配绑定：                                             │
│    • peer binding? → 检查是否有 peer.id=987654321 的绑定   │
│    • account binding? → 检查 bot123456 的账户绑定          │
│    • channel binding? → 检查 telegram:* 的通配绑定         │
│    • default → 使用 defaultAgent                             │
│                                                               │
│    假设匹配到：                                               │
│    {                                                          │
│      agentId: "personal",                                     │
│      channel: "telegram",                                     │
│      accountId: "bot123456",                                  │
│      sessionKey: "agent:personal:telegram:dm:987654321",     │
│      matchedBy: "binding.peer"                                │
│    }                                                          │
└──────────┬────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. 加载/创建会话                                             │
│                                                               │
│    const session = await loadOrCreateSession({                │
│      sessionKey: "agent:personal:telegram:dm:987654321",     │
│      agentId: "personal"                                      │
│    });                                                        │
│                                                               │
│    更新会话元数据：                                           │
│    • lastChannel: "telegram"                                  │
│    • lastTo: "987654321"                                      │
│    • lastAccountId: "bot123456"                               │
└──────────┬────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. 群组提及检查（如果是群组）                                │
│                                                               │
│    if (peer.kind === "group") {                               │
│      const mentionRegex = /@botname|@username/i;              │
│      const isMentioned = mentionRegex.test(text);             │
│                                                               │
│      // 检查 groupActivation 策略                             │
│      if (session.groupActivation === "mention" && !isMentioned) {
│        return; // 忽略非提及消息                              │
│      }                                                        │
│    }                                                          │
└──────────┬────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. 智能体处理                                                │
│                                                               │
│    const agent = await loadAgent("personal");                 │
│    const response = await agent.process({                     │
│      message: text,                                           │
│      session,                                                 │
│      context: { channel, accountId, peer, sender }            │
│    });                                                        │
└──────────┬────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. 发送回复                                                  │
│                                                               │
│    await sendReply({                                          │
│      channel: "telegram",                                     │
│      accountId: "bot123456",                                  │
│      to: peer.id,                                             │
│      text: response.text                                      │
│    });                                                        │
└─────────────────────────────────────────────────────────────┘
```

## 群组激活策略

控制智能体在群组/频道中的响应行为：

### 两种激活模式

| 模式 | 行为 | 配置 |
|------|------|------|
| `mention` | 仅当被 @提及时响应 | `groupActivation: "mention"` |
| `always` | 响应所有消息 | `groupActivation: "always"` |

### 提及检测

```typescript
// 提及检测逻辑
function isMentioned(message: string, botUsername: string): boolean {
  const patterns = [
    `@${botUsername}`,                    // @botname
    `@${botUsername.toLowerCase()}`,     // @BotName
    new RegExp(`@${botUsername}`, 'i'),  // 不区分大小写
  ];
  
  return patterns.some(p => 
    typeof p === 'string' 
      ? message.includes(p)
      : p.test(message)
  );
}
```

## 会话队列模式

控制消息处理方式：

| 模式 | 行为 | 适用场景 |
|------|------|----------|
| `steer` | 主动引导对话方向 | 任务导向智能体 |
| `followup` | 跟进之前的对话 | 连续对话 |
| `collect` | 收集多条消息 | 批量处理 |
| `reply` | 简单回复模式 | 问答式 |
| `react` | 响应式 | 事件驱动 |

## 关键文件

| 文件 | 用途 |
|------|------|
| `src/routing/resolve-route.ts` | 路由解析核心逻辑 |
| `src/routing/bindings.ts` | 绑定管理工具函数 |
| `src/routing/session-key.ts` | 会话密钥构建和解析 |
| `src/routing/resolve-route.test.ts` | 路由解析测试用例 |
| `src/config/types.agents.ts` | AgentBinding 类型定义 |
| `src/sessions/store.ts` | 会话存储持久化 |
| `src/sessions/session-key-utils.ts` | 会话密钥解析工具 |
| `src/sessions/types.ts` | 会话类型定义 |
| `src/agents/agent-scope.ts` | 智能体解析逻辑 |
| `src/web/auto-reply/monitor/on-message.ts` | WhatsApp 路由调用示例 |
| `src/telegram/bot-message-context.ts` | Telegram 路由调用示例 |
| `src/discord/monitor/message-handler.preflight.ts` | Discord 路由调用示例 |

## 配置示例

### 完整路由配置

```yaml
# config.yml

# 默认智能体（当没有绑定匹配时使用）
defaultAgent: "general"

# 智能体定义
agents:
  - id: "general"
    name: "通用助手"
    model: "claude-sonnet-4-20250514"
    
  - id: "support"
    name: "客服助手"
    model: "claude-sonnet-4-20250514"
    systemPrompt: "You are a helpful customer support agent."
    
  - id: "sales"
    name: "销售助手"
    tools: ["crm-lookup", "product-catalog"]

# 绑定规则（按优先级排序）
bindings:
  # 高优先级：特定联系人
  - agentId: "support"
    match:
      channel: "whatsapp"
      peer:
        kind: "dm"
        id: "+15551234567"  # VIP 客户
        
  # Discord 服务器级别
  - agentId: "support"
    match:
      channel: "discord"
      guildId: "123456789012345678"
      
  # Slack 工作区级别
  - agentId: "sales"
    match:
      channel: "slack"
      teamId: "T123456789"
      
  # Telegram Bot 账户级别
  - agentId: "sales"
    match:
      channel: "telegram"
      accountId: "sales_bot_token"
      
  # 通道默认
  - agentId: "general"
    match:
      channel: "telegram"
      accountId: "*"

# 会话配置
session:
  # 私信会话隔离
  dmScope: "per-peer"
  
  # 身份关联
  identityLinks:
    alice:
      - "telegram:111111111"
      - "discord:222222222"
      - "whatsapp:+15551234567"
      
  # 存储路径
  store: "~/.openclaw/sessions.json"
```

## 相关文档

- [Gateway 架构](/code/gateway-architecture)
- [Protocol Handler 架构](/code/protocol-handler-architecture)
- [Channel Manager 架构](/code/channel-manager-architecture)
- [配置系统](/configuration)
- [智能体配置](/agents/configuration)
- [会话管理](/sessions/overview)