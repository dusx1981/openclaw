# OpenClaw 支持的应用类型与消息发送场景技术报告

## 1. 概述

OpenClaw 是一个多通道 AI 网关，支持连接超过 25 种主流即时通讯平台，实现统一的智能助手体验。本报告梳理了 OpenClaw 支持的应用类型、通道能力、消息发送场景及技术实现架构。

## 2. 支持的应用类型

### 2.1 通道分类

OpenClaw 将支持的应用分为以下几类：

| 分类             | 说明                                     | 通道示例                                                       |
| ---------------- | ---------------------------------------- | -------------------------------------------------------------- |
| **企业协作平台** | 企业级团队协作工具，支持频道、群组、私信 | Slack, Discord, Microsoft Teams, 飞书, Google Chat, Mattermost |
| **即时通讯应用** | 个人级聊天应用，支持好友、群聊           | WhatsApp, Telegram, Signal, QQ Bot, LINE, WeChat, Zalo         |
| **社交平台**     | 社交媒体平台的私信/聊天功能              | Twitch, Discord                                                |
| **去中心化平台** | 基于分布式协议的通讯平台                 | Matrix, Nostr, Tlon (Urbit)                                    |
| **传统协议**     | 基于经典互联网协议的通讯方式             | IRC                                                            |
| **自托管方案**   | 可私有化部署的通讯平台                   | Nextcloud Talk, Synology Chat                                  |
| **Apple 生态**   | Apple 设备专用通讯方案                   | iMessage (BlueBubbles), iMessage (legacy)                      |
| **语音通话**     | 电话语音通道                             | Voice Call (Twilio/Plivo)                                      |
| **Web 界面**     | OpenClaw 内置 Web 聊天界面               | WebChat                                                        |

### 2.2 完整通道列表

#### 2.2.1 内置核心通道

| 通道                  | 状态     | 连接方式                      | 文档路径               |
| --------------------- | -------- | ----------------------------- | ---------------------- |
| **Discord**           | 生产就绪 | WebSocket (Gateway)           | `/channels/discord`    |
| **Google Chat**       | 生产就绪 | HTTP Webhook                  | `/channels/googlechat` |
| **Signal**            | 生产就绪 | signal-cli                    | `/channels/signal`     |
| **Slack**             | 生产就绪 | Socket Mode / HTTP Events API | `/channels/slack`      |
| **Telegram**          | 生产就绪 | Long Polling / Webhook        | `/channels/telegram`   |
| **WhatsApp**          | 生产就绪 | Baileys (QR 登录)             | `/channels/whatsapp`   |
| **WebChat**           | 生产就绪 | WebSocket                     | `/web/webchat`         |
| **iMessage (legacy)** | 已弃用   | imsg CLI                      | `/channels/imessage`   |

#### 2.2.2 插件扩展通道

| 通道                   | 状态              | 连接方式            | 文档路径                   |
| ---------------------- | ----------------- | ------------------- | -------------------------- |
| **飞书 (Feishu/Lark)** | 生产就绪          | WebSocket / Webhook | `/channels/feishu`         |
| **QQ Bot**             | 生产就绪          | WebSocket Gateway   | `/channels/qqbot`          |
| **BlueBubbles**        | 推荐用于 iMessage | REST API            | `/channels/bluebubbles`    |
| **Matrix**             | 生产就绪          | Client-Server API   | `/channels/matrix`         |
| **Microsoft Teams**    | 生产就绪          | Bot Framework       | `/channels/msteams`        |
| **Mattermost**         | 生产就绪          | Bot API + WebSocket | `/channels/mattermost`     |
| **LINE**               | 生产就绪          | Messaging API       | `/channels/line`           |
| **IRC**                | 生产就绪          | IRC Protocol        | `/channels/irc`            |
| **Nostr**              | 实验性            | NIP-04 DM           | `/channels/nostr`          |
| **Tlon (Urbit)**       | 实验性            | Urbit Protocol      | `/channels/tlon`           |
| **Twitch**             | 生产就绪          | IRC                 | `/channels/twitch`         |
| **Nextcloud Talk**     | 生产就绪          | Webhook Bot         | `/channels/nextcloud-talk` |
| **Synology Chat**      | 生产就绪          | Webhook             | `/channels/synology-chat`  |
| **Zalo Bot**           | 生产就绪          | Zalo Bot API        | `/channels/zalo`           |
| **Zalo Personal**      | 实验性            | QR 登录             | `/channels/zalouser`       |
| **Voice Call**         | 生产就绪          | Twilio / Plivo      | `/plugins/voice-call`      |

#### 2.2.3 第三方插件通道

| 通道       | 状态     | 来源                                                  |
| ---------- | -------- | ----------------------------------------------------- |
| **WeChat** | 生产就绪 | 腾讯 iLink Bot (npm: @tencent-weixin/openclaw-weixin) |

## 3. 通道能力矩阵

### 3.1 核心能力定义

```typescript
type ChannelCapabilities = {
  chatTypes: Array<"direct" | "group" | "channel" | "thread">;
  polls?: boolean; // 投票
  reactions?: boolean; // 表情反应
  edit?: boolean; // 编辑消息
  unsend?: boolean; // 撤回消息
  reply?: boolean; // 回复消息
  effects?: boolean; // 消息特效
  groupManagement?: boolean; // 群组管理
  threads?: boolean; // 话题/线程
  media?: boolean; // 媒体附件
  nativeCommands?: boolean; // 原生命令
  blockStreaming?: boolean; // 流式输出
};
```

### 3.2 通道能力对照表

| 通道                | 私信 | 群聊 | 频道 | 话题 | 媒体 | 反应 | 编辑 | 回复 | 线程 |
| ------------------- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| **Telegram**        | ✅   | ✅   | ✅   | ✅   | ✅   | ✅   | ✅   | ✅   | ✅   |
| **WhatsApp**        | ✅   | ✅   | -    | -    | ✅   | ✅   | ✅   | ✅   | -    |
| **Discord**         | ✅   | ✅   | ✅   | ✅   | ✅   | ✅   | ✅   | ✅   | ✅   |
| **Slack**           | ✅   | ✅   | ✅   | ✅   | ✅   | ✅   | ✅   | ✅   | ✅   |
| **飞书**            | ✅   | ✅   | ✅   | ✅   | ✅   | ✅   | ✅   | ✅   | ✅   |
| **QQ Bot**          | ✅   | ✅   | ✅   | -    | ✅   | ❌   | -    | -    | ❌   |
| **BlueBubbles**     | ✅   | ✅   | -    | -    | ✅   | ✅   | ✅   | ✅   | -    |
| **Signal**          | ✅   | ✅   | -    | -    | ✅   | ✅   | ✅   | ✅   | -    |
| **Matrix**          | ✅   | ✅   | ✅   | ✅   | ✅   | ✅   | ✅   | ✅   | -    |
| **Microsoft Teams** | ✅   | ✅   | ✅   | ✅   | ✅   | ✅   | -    | ✅   | ✅   |
| **Mattermost**      | ✅   | ✅   | ✅   | ✅   | ✅   | ✅   | ✅   | ✅   | ✅   |
| **LINE**            | ✅   | ✅   | -    | -    | ✅   | -    | -    | -    | -    |
| **IRC**             | ✅   | ✅   | -    | -    | ❌   | ❌   | ❌   | -    | -    |
| **Nostr**           | ✅   | ❌   | -    | -    | ❌   | ❌   | ❌   | ❌   | -    |
| **Twitch**          | -    | ✅   | -    | -    | ❌   | ✅   | ❌   | -    | -    |
| **Google Chat**     | ✅   | ✅   | ✅   | ✅   | ✅   | ✅   | -    | ✅   | ✅   |

## 4. 消息发送场景

### 4.1 消息操作类型

OpenClaw 支持以下消息操作 (`ChannelMessageActionName`):

#### 4.1.1 基础消息操作

| 操作           | 说明       | 参数示例                                 |
| -------------- | ---------- | ---------------------------------------- |
| `send`         | 发送消息   | `{ message, channel, target }`           |
| `reply`        | 回复消息   | `{ message, replyTo, channel, target }`  |
| `thread-reply` | 话题内回复 | `{ message, threadId, channel, target }` |
| `edit`         | 编辑消息   | `{ messageId, message }`                 |
| `unsend`       | 撤回消息   | `{ messageId }`                          |
| `delete`       | 删除消息   | `{ messageId }`                          |
| `read`         | 读取消息   | `{ messageId }`                          |

#### 4.1.2 媒体操作

| 操作             | 说明     | 参数示例                       |
| ---------------- | -------- | ------------------------------ |
| `sendAttachment` | 发送附件 | `{ media, filename, caption }` |
| `upload-file`    | 上传文件 | `{ path, filePath }`           |
| `download-file`  | 下载文件 | `{ messageId }`                |
| `sticker`        | 发送贴纸 | `{ sticker }`                  |
| `sticker-search` | 搜索贴纸 | `{ query }`                    |

#### 4.1.3 互动操作

| 操作             | 说明       | 参数示例                |
| ---------------- | ---------- | ----------------------- |
| `react`          | 添加反应   | `{ messageId, emoji }`  |
| `reactions`      | 列出反应   | `{ messageId }`         |
| `poll`           | 创建投票   | `{ question, options }` |
| `poll-vote`      | 投票       | `{ pollId, option }`    |
| `broadcast`      | 广播消息   | `{ message, targets }`  |
| `sendWithEffect` | 带特效发送 | `{ message, effectId }` |

#### 4.1.4 群组管理操作

| 操作                | 说明       | 参数示例                   |
| ------------------- | ---------- | -------------------------- |
| `renameGroup`       | 重命名群组 | `{ groupId, name }`        |
| `setGroupIcon`      | 设置群图标 | `{ groupId, icon }`        |
| `addParticipant`    | 添加成员   | `{ groupId, userId }`      |
| `removeParticipant` | 移除成员   | `{ groupId, userId }`      |
| `leaveGroup`        | 退出群组   | `{ groupId }`              |
| `permissions`       | 权限管理   | `{ groupId, permissions }` |

#### 4.1.5 频道管理操作

| 操作              | 说明         | 参数示例                    |
| ----------------- | ------------ | --------------------------- |
| `channel-info`    | 获取频道信息 | `{ channelId }`             |
| `channel-list`    | 列出频道     | `{ query }`                 |
| `channel-create`  | 创建频道     | `{ name, type }`            |
| `channel-edit`    | 编辑频道     | `{ channelId, name }`       |
| `channel-delete`  | 删除频道     | `{ channelId }`             |
| `channel-move`    | 移动频道     | `{ channelId, categoryId }` |
| `category-create` | 创建分类     | `{ name }`                  |
| `category-edit`   | 编辑分类     | `{ categoryId, name }`      |
| `category-delete` | 删除分类     | `{ categoryId }`            |

#### 4.1.6 话题操作

| 操作            | 说明     | 参数示例              |
| --------------- | -------- | --------------------- |
| `thread-create` | 创建话题 | `{ channelId, name }` |
| `thread-list`   | 列出话题 | `{ channelId }`       |
| `topic-create`  | 创建主题 | `{ channelId, name }` |
| `topic-edit`    | 编辑主题 | `{ topicId, name }`   |

#### 4.1.7 其他操作

| 操作             | 说明     | 参数示例                  |
| ---------------- | -------- | ------------------------- |
| `pin`            | 置顶消息 | `{ messageId }`           |
| `unpin`          | 取消置顶 | `{ messageId }`           |
| `list-pins`      | 列出置顶 | `{ channelId }`           |
| `member-info`    | 成员信息 | `{ memberId, channelId }` |
| `role-info`      | 角色信息 | `{ roleId }`              |
| `role-add`       | 添加角色 | `{ userId, roleId }`      |
| `role-remove`    | 移除角色 | `{ userId, roleId }`      |
| `emoji-list`     | 表情列表 | -                         |
| `emoji-upload`   | 上传表情 | `{ emoji }`               |
| `sticker-upload` | 上传贴纸 | `{ sticker }`             |
| `search`         | 搜索消息 | `{ query }`               |
| `voice-status`   | 语音状态 | `{ status }`              |
| `event-list`     | 事件列表 | `{ channelId }`           |
| `event-create`   | 创建事件 | `{ title, time }`         |
| `timeout`        | 禁言用户 | `{ userId, duration }`    |
| `kick`           | 踢出用户 | `{ userId }`              |
| `ban`            | 封禁用户 | `{ userId }`              |
| `set-profile`    | 设置资料 | `{ name, avatar }`        |
| `set-presence`   | 设置状态 | `{ status }`              |

### 4.2 消息发送场景分类

#### 4.2.1 入站消息处理

```
用户消息 → Gateway → 权限校验 → Agent 路由 → Agent 处理 → 回复分发
```

**场景说明**:

1. 用户在任意通道发送消息
2. Gateway 接收事件 (WebSocket/Webhook/Long Polling)
3. 执行权限校验 (allowFrom, groupPolicy, dmPolicy)
4. 解析 Agent 路由 (bindings, peer matching)
5. 构建 Agent 上下文 (消息内容、媒体、历史)
6. Agent 生成回复
7. 通过回复分发器发送到原通道

#### 4.2.2 出站消息发送

**Agent 主动发送**:

```typescript
// 通过 message 工具
{
  action: "send",
  channel: "telegram",
  target: "user:123456",
  message: "Hello!"
}
```

**CLI 命令发送**:

```bash
openclaw agent --message "Hello" --deliver --reply-channel telegram --reply-to "user:123456"
```

**子 Agent 发送**:

```typescript
// 通过 sessions_send 工具
{
  message: "Sub-agent response",
  channel: "slack",
  target: "channel:C123456"
}
```

#### 4.2.3 跨通道发送

```typescript
// 从飞书接收，发送到 QQ
{
  action: "send",
  channel: "qqbot",
  target: "group:12345",
  message: "Cross-channel message from Feishu"
}
```

#### 4.2.4 广播发送

```typescript
// 发送到多个目标
{
  action: "broadcast",
  targets: [
    { channel: "telegram", target: "user:123" },
    { channel: "slack", target: "channel:C123" },
    { channel: "discord", target: "channel:789" }
  ],
  message: "Broadcast message"
}
```

#### 4.2.5 定时消息

```typescript
// 通过 cron 工具
{
  kind: "agentTurn",
  message: "Scheduled reminder",
  channel: "whatsapp",
  target: "+15555550123",
  cron: "0 9 * * 1-5"  // 工作日早9点
}
```

#### 4.2.6 条件触发发送

**Hook 触发**:

```typescript
// 在 message:received hook 中转发
api.on("message:received", async (event, ctx) => {
  if (event.context.channelId === "feishu") {
    await sendMessageToQQ(event.context.content);
  }
});
```

**Webhook 触发**:

```bash
# 外部系统调用 Webhook
curl -X POST http://localhost:18789/webhook/send \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"channel":"telegram","target":"user:123","message":"Alert!"}'
```

### 4.3 特殊发送场景

#### 4.3.1 流式输出

部分通道支持流式卡片/消息更新：

```typescript
// Discord, Slack, 飞书等支持流式输出
{
  channel: "discord",
  streaming: true,  // 启用流式
  target: "channel:123",
  onPartial: (text) => updateMessage(text),
  onFinal: (text) => finalizeMessage(text)
}
```

#### 4.3.2 交互组件

```typescript
// 发送带按钮的消息
{
  action: "send",
  channel: "slack",
  target: "channel:C123",
  message: "Choose an option:",
  interactive: {
    blocks: [
      { type: "buttons", buttons: [
        { label: "Yes", value: "yes" },
        { label: "No", value: "no" }
      ]}
    ]
  }
}
```

#### 4.3.3 投票创建

```typescript
{
  action: "poll",
  channel: "telegram",
  target: "group:-100123",
  question: "What's for lunch?",
  options: ["Pizza", "Sushi", "Tacos"],
  anonymous: true
}
```

#### 4.3.4 媒体发送

```typescript
// 发送图片
{
  action: "sendAttachment",
  channel: "whatsapp",
  target: "+15555550123",
  media: "https://example.com/image.jpg",
  caption: "Check this out!"
}

// 发送本地文件
{
  action: "sendAttachment",
  channel: "telegram",
  target: "user:123",
  path: "/tmp/report.pdf"
}

// 发送语音消息
{
  action: "sendAttachment",
  channel: "telegram",
  target: "user:123",
  media: "/tmp/voice.ogg",
  asVoice: true
}
```

## 5. 技术架构

### 5.1 消息流转架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          外部通讯平台                                        │
│  Telegram | WhatsApp | Discord | Slack | 飞书 | QQ | ...                    │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
                    ▼           ▼           ▼
              ┌─────────┐ ┌─────────┐ ┌─────────┐
              │WebSocket│ │ Webhook │ │LongPoll │
              └────┬────┘ └────┬────┘ └────┬────┘
                   │           │           │
                   └───────────┼───────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Channel Plugin Layer                                │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐               │
│  │Telegram │ │WhatsApp │ │ Discord │ │  Slack  │ │ Feishu  │ ...           │
│  │ Plugin  │ │ Plugin  │ │ Plugin  │ │ Plugin  │ │ Plugin  │               │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘               │
│       │           │           │           │           │                     │
│       └───────────┴───────────┴─────┬─────┴───────────┘                     │
│                                     │                                       │
│                                     ▼                                       │
│                          Channel Contract Layer                             │
│  - normalizeTarget()                                                       │
│  - resolveAgentRoute()                                                     │
│  - createReplyDispatcher()                                                 │
│  - sendText() / sendMedia()                                                │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Gateway Core                                        │
│  - 事件接收与分发                                                            │
│  - 权限校验 (allowFrom, groupPolicy, pairing)                                │
│  - Agent 路由解析                                                            │
│  - 会话管理 (session key)                                                    │
│  - 消息去重与防抖                                                            │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Agent Runtime                                       │
│  - 模型调用 (LLM Provider)                                                  │
│  - 工具调用 (message, exec, browser, ...)                                    │
│  - 上下文构建 (history, media, quote)                                        │
│  - 回复生成与流式输出                                                        │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Reply Dispatcher                                    │
│  - 打字指示器                                                                │
│  - 消息分块                                                                  │
│  - 流式卡片                                                                  │
│  - 媒体上传                                                                  │
│  - 渲染模式选择 (text/card/interactive)                                       │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Outbound Adapter                                    │
│  - sendMessageXXX()                                                         │
│  - sendCardXXX()                                                            │
│  - sendMediaXXX()                                                           │
│  - API 调用与错误处理                                                        │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
                          返回外部通讯平台
```

### 5.2 插件扩展架构

```typescript
// 通道插件定义示例
const channelPlugin: ChannelPlugin = {
  id: "example",
  meta: { id: "example", label: "Example", ... },

  // 能力声明
  capabilities: {
    chatTypes: ["direct", "group"],
    media: true,
    reactions: true,
    threads: true,
  },

  // 配置模式
  configSchema: zodSchema,

  // 账户管理
  config: {
    listAccountIds,
    resolveAccount,
    setAccountEnabled,
    deleteAccount,
    isConfigured,
  },

  // 网关启动
  gateway: {
    startAccount: async (ctx) => {
      // 启动事件监听
      await monitorProvider(ctx);
    },
  },

  // 出站消息
  outbound: {
    deliveryMode: "direct",
    sendText: async ({ to, text }) => { ... },
    sendMedia: async ({ to, mediaUrl }) => { ... },
  },

  // 权限控制
  allowlist: { ... },

  // 设置向导
  setupWizard: SetupWizardComponent,
};
```

## 6. 配置示例

### 6.1 多通道配置

```json5
{
  channels: {
    // Telegram 配置
    telegram: {
      enabled: true,
      botToken: "123:abc",
      dmPolicy: "pairing",
      groupPolicy: "open",
      groupAllowFrom: ["-100123456"],
    },

    // WhatsApp 配置
    whatsapp: {
      enabled: true,
      authDir: "~/.openclaw/whatsapp-auth",
      dmPolicy: "pairing",
      groupPolicy: "allowlist",
    },

    // 飞书配置
    feishu: {
      enabled: true,
      appId: "cli_xxx",
      appSecret: "xxx",
      domain: "feishu",
      connectionMode: "websocket",
    },

    // QQ Bot 配置
    qqbot: {
      enabled: true,
      appId: "123456",
      clientSecret: "xxx",
    },

    // Discord 配置
    discord: {
      enabled: true,
      token: "Bot xxx",
      groupPolicy: "open",
    },

    // Slack 配置
    slack: {
      enabled: true,
      mode: "socket",
      appToken: "xapp-xxx",
      botToken: "xoxb-xxx",
    },
  },
}
```

### 6.2 Agent 绑定配置

```json5
{
  agents: {
    list: [
      { id: "assistant", name: "Assistant" },
      { id: "support", name: "Support" },
    ],
  },

  bindings: [
    // Telegram 私信绑定
    {
      match: { channel: "telegram", peer: { kind: "direct", id: "123456" } },
      agentId: "assistant",
    },

    // 飞书群组绑定
    {
      match: { channel: "feishu", peer: { kind: "group", id: "oc_xxx" } },
      agentId: "support",
    },

    // Discord 频道绑定
    {
      match: { channel: "discord", peer: { kind: "channel", id: "123456" } },
      agentId: "assistant",
    },
  ],
}
```

### 6.3 广播配置

```json5
{
  broadcast: {
    strategy: "parallel",
    // 群组广播到多个 Agent
    oc_feishu_group: ["assistant", "support"],
    // WhatsApp 群组广播
    "120363xxx@g.us": ["assistant", "logger"],
  },
}
```

## 7. 最佳实践

### 7.1 通道选择建议

| 场景           | 推荐通道               | 原因                     |
| -------------- | ---------------------- | ------------------------ |
| **快速测试**   | Telegram               | 配置简单，只需 bot token |
| **个人使用**   | WhatsApp / Signal      | 用户基数大，隐私保护好   |
| **团队协作**   | Slack / Discord / 飞书 | 企业级功能，频道管理完善 |
| **中国用户**   | 飞书 / QQ Bot          | 本地化支持，合规性好     |
| **Apple 生态** | BlueBubbles            | iMessage 最佳方案        |
| **高隐私需求** | Signal                 | 端到端加密               |
| **去中心化**   | Matrix / Nostr         | 无中心服务器             |
| **语音通话**   | Voice Call             | 电话通道                 |

### 7.2 安全配置建议

1. **私信策略**: 使用 `dmPolicy: "pairing"` 进行配对验证
2. **群组策略**: 使用 `groupPolicy: "allowlist"` 限制群组
3. **发送者白名单**: 配置 `allowFrom` / `groupAllowFrom`
4. **提及要求**: 在群组中设置 `requireMention: true`
5. **命令授权**: 配置 `useAccessGroups` 限制命令执行

### 7.3 性能优化建议

1. **连接模式选择**: WebSocket 优先于 Webhook (减少延迟)
2. **消息分块**: 对长消息启用自动分块
3. **流式输出**: 在支持的通道启用流式卡片
4. **历史限制**: 合理设置 `historyLimit` 避免上下文过长
5. **多账户**: 使用独立账户隔离不同用途

## 8. 常见问题

### Q1: 如何选择合适的通道？

**A**: 根据目标用户和使用场景：

- 国际用户 → Telegram, Discord, WhatsApp
- 中国用户 → 飞书, QQ Bot, WeChat
- 企业团队 → Slack, Microsoft Teams, 飞书
- 开发者 → Discord, Telegram, IRC

### Q2: 是否支持多通道同时运行？

**A**: 是的，OpenClaw 支持同时配置和运行多个通道，每个通道独立管理账户和会话。

### Q3: 如何实现跨通道消息转发？

**A**: 有三种方式：

1. 使用 Hook 在 `message:received` 事件中转发
2. Agent 在处理时调用 `message` 工具发送到其他通道
3. 配置 Broadcast 广播到多个目标

### Q4: 通道能力不足怎么办？

**A**: OpenClaw 的通道能力受限于平台 API。如果某通道不支持某功能（如 IRC 不支持媒体），这是平台限制。可考虑：

1. 切换到支持该功能的通道
2. 使用替代方案（如发送链接代替媒体）

### Q5: 如何调试通道问题？

**A**:

1. 查看日志: `tail -f ~/.openclaw/logs/gateway.log`
2. 检查状态: `openclaw channels status --probe`
3. 运行诊断: `openclaw doctor`
4. 参考文档: `/channels/troubleshooting`

## 9. 相关文档

- [通道配置参考](/gateway/configuration-reference)
- [通道故障排除](/channels/troubleshooting)
- [配对机制](/channels/pairing)
- [群组消息](/channels/groups)
- [消息工具](/tools/agent-send)
- [Webhook 配置](/automation/cron-jobs#webhooks)
- [插件开发](/plugins/building-plugins)
