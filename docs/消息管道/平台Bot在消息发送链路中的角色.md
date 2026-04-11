# 平台 Bot 在消息发送链路中的角色

## 1. 概述

平台 Bot（如飞书 Bot、Telegram Bot）在消息发送链路中扮演**多重角色**。本文档以飞书为例，详细说明 Bot 在入站消息接收、消息处理、出站消息发送等各环节中的作用。

---

## 2. Bot 的身份标识

### 2.1 Bot 身份信息

```typescript
// Bot 身份信息
type BotIdentity = {
  botOpenId: string; // Bot 在平台上的唯一标识
  botName: string; // Bot 的显示名称
  appId: string; // 应用的 App ID
  appSecret: string; // 应用的密钥
};
```

**飞书示例**：

```
botOpenId: "ou_xxxxxxxxxxxxxxxx"   // Bot 的 Open ID
botName: "OpenClaw 助手"            // Bot 名称
appId: "cli_xxxxxxxxxxxxx"          // 应用 ID
```

### 2.2 Bot 身份获取

```typescript
// 启动时获取 Bot 身份
async function fetchBotIdentity(account: ResolvedFeishuAccount): Promise<BotIdentity> {
  const client = createFeishuClient(account);

  // 调用 API 获取 Bot 信息
  const response = await client.im.chat.getBotInfo();

  return {
    botOpenId: response.bot_open_id,
    botName: response.bot_name,
    appId: account.appId,
    appSecret: account.appSecret,
  };
}
```

---

## 3. Bot 在消息链路中的角色

### 3.1 角色总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         消息发送链路                                         │
│                                                                             │
│   用户消息 ──▶ [Bot 作为接收者] ──▶ [Bot 作为过滤器] ──▶ Agent 处理          │
│       │            │                     │                       │          │
│       │            ▼                     ▼                       ▼          │
│       │     接收入站消息           过滤自己的消息            生成回复       │
│       │     检查提及状态           避免消息循环                             │
│       │                                                                     │
│       └─────────────────────────────────────────────────────────────────▶  │
│                                                                             │
│   Agent 回复 ──▶ [Bot 作为发送者] ──▶ 平台 ──▶ 用户                         │
│                       │                                                     │
│                       ▼                                                     │
│                 以 Bot 身份发送                                             │
│                 显示 Bot 名称                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 角色详解

| 角色           | 阶段 | 职责                     | 代码示例                                      |
| -------------- | ---- | ------------------------ | --------------------------------------------- |
| **消息接收者** | 入站 | 接收平台推送的消息事件   | `eventDispatcher.on("im.message.receive_v1")` |
| **身份标识**   | 入站 | 用于检测消息是否 @Bot    | `checkBotMentioned(event, botOpenId)`         |
| **消息过滤器** | 入站 | 过滤 Bot 自己发送的消息  | `if (senderId === botOpenId) return`          |
| **提及目标**   | 入站 | 判断是否需要响应群组消息 | `if (requireMention && !mentionedBot) return` |
| **消息发送者** | 出站 | 以 Bot 身份发送回复      | `sendMessageFeishu({ ... })`                  |
| **权限载体**   | 全程 | Bot 的权限决定能做什么   | API 调用权限、消息发送权限                    |

---

## 4. Bot 在入站消息处理中的角色

### 4.1 角色一：消息接收者

Bot 作为平台应用的入口点，接收平台推送的所有事件。

```
┌─────────────┐                                      ┌─────────────┐
│   飞书      │                                      │  OpenClaw   │
│   平台      │                                      │  Bot 应用   │
└──────┬──────┘                                      └──────┬──────┘
       │                                                    │
       │  用户发送消息到群组/私聊                           │
       │  平台检测到 Bot 在消息范围内                       │
       │                                                    │
       │  POST /feishu/events                              │
       │  {                                                 │
       │    "type": "im.message.receive_v1",                │
       │    "event": {                                      │
       │      "sender": { "open_id": "ou_user" },          │
       │      "message": {                                  │
       │        "chat_id": "oc_xxx",                        │
       │        "content": "你好",                          │
       │        "mentions": [...]                           │
       │      }                                              │
       │    }                                                 │
       │  }                                                   │
       │ ─────────────────────────────────────────────────▶│
       │                                                    │
       │                                           Bot 接收事件
       │                                           并开始处理
       │                                                    │
```

**平台推送消息给 Bot 的条件**：

| 场景     | 推送条件                             | Bot 角色   |
| -------- | ------------------------------------ | ---------- |
| **私聊** | 用户直接向 Bot 发送消息              | 唯一接收者 |
| **群聊** | 消息中 @Bot 或群组开启了接收所有消息 | 接收者之一 |
| **话题** | 同群聊，但基于话题级别配置           | 接收者之一 |

### 4.2 角色二：消息过滤器

Bot 需要过滤自己发送的消息，避免无限循环。

```typescript
// 过滤 Bot 自己发送的消息
function shouldProcessMessage(params: { event: FeishuMessageEvent; botOpenId?: string }): boolean {
  const { event, botOpenId } = params;

  // 1. 检查发送者类型
  if (event.sender.sender_type === "app") {
    // 应用发送的消息（Bot 消息），过滤掉
    return false;
  }

  // 2. 检查发送者 ID 是否是 Bot
  const senderId = event.sender.sender_id.open_id;
  if (botOpenId && senderId === botOpenId) {
    // Bot 自己发送的消息，过滤掉
    return false;
  }

  return true;
}
```

**为什么需要过滤自己的消息**：

```
场景：如果不过滤 Bot 自己的消息

用户: "你好"
Bot: "你好！有什么可以帮助你的？" ──▶ 触发消息事件
Bot 收到自己的消息 ──▶ 再次处理 ──▶ 再次回复
Bot: "你好！有什么可以帮助你的？" ──▶ 触发消息事件
... 无限循环 ...
```

### 4.3 角色三：提及检测对象

在群组中，Bot 需要检测是否被 @提及，以决定是否响应。

```typescript
// 检测 Bot 是否被提及
function checkBotMentioned(event: FeishuMessageEvent, botOpenId?: string): boolean {
  const mentions = event.message.mentions;
  if (!mentions || !botOpenId) {
    return false;
  }

  // 检查 mentions 列表中是否包含 Bot
  return mentions.some((m) => m.id.open_id === botOpenId || m.key === botOpenId);
}

// 根据提及状态决定是否响应
function shouldRespondInGroup(params: { mentionedBot: boolean; requireMention: boolean }): boolean {
  const { mentionedBot, requireMention } = params;

  // 如果不需要提及，直接响应
  if (!requireMention) {
    return true;
  }

  // 需要提及且已提及，响应
  if (mentionedBot) {
    return true;
  }

  // 需要提及但未提及，不响应（记录到历史但不处理）
  return false;
}
```

**提及检测流程**：

```
群组消息到达
     │
     ▼
┌─────────────────────────────────────────┐
│  解析消息内容                            │
│  event.message.mentions: [               │
│    { id: { open_id: "ou_user1" } },      │
│    { id: { open_id: "ou_bot_xxx" } },    │ ◀── Bot 被提及
│  ]                                        │
└─────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│  检查提及列表                            │
│  botOpenId in mentions?                  │
│  ✅ 是 → mentionedBot = true             │
│  ❌ 否 → mentionedBot = false            │
└─────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│  检查配置                                │
│  requireMention = true?                  │
│  ✅ 是且 mentionedBot = true → 处理      │
│  ✅ 是且 mentionedBot = false → 忽略     │
│  ❌ 否 → 直接处理                        │
└─────────────────────────────────────────┘
```

### 4.4 角色四：消息规范化

Bot 需要处理消息中的 @Bot 提及，规范化消息内容。

```typescript
// 规范化提及标签
function normalizeMentions(
  content: string,
  mentions: FeishuMention[] | undefined,
  botOpenId?: string,
): string {
  if (!mentions) {
    return content;
  }

  let result = content;

  for (const mention of mentions) {
    const isBot = mention.id.open_id === botOpenId;

    if (isBot) {
      // 移除 @Bot 提及（已通过 mentionedBot 标志记录）
      // 这样 "@Bot /help" 变成 "/help"
      result = result.replace(new RegExp(escapeRegExp(mention.key), "g"), "");
    } else {
      // 保留其他用户提及，转换为标准格式
      // "@user" → "<at user_id="ou_xxx">user</at>"
      result = result.replace(
        new RegExp(escapeRegExp(mention.key), "g"),
        `<at user_id="${mention.id.open_id}">${mention.name}</at>`,
      );
    }
  }

  return result.trim();
}
```

**示例**：

```
原始消息: "@OpenClaw助手 请帮我总结一下 @张三 的报告"

处理后:
- mentionedBot = true
- content = "请帮我总结一下 <at user_id="ou_zhangsan">张三</at> 的报告"
```

---

## 5. Bot 在出站消息发送中的角色

### 5.1 角色一：消息发送者

Bot 以自己的身份发送消息，消息会显示 Bot 的名称和头像。

```typescript
// 发送消息（以 Bot 身份）
async function sendMessageFeishu(params: {
  cfg: ClawdbotConfig;
  to: string;
  text: string;
  accountId?: string;
}): Promise<FeishuSendResult> {
  const account = resolveFeishuAccount({ cfg, accountId });
  const client = createFeishuClient(account);

  // Bot 获取访问令牌
  // 后续请求会自动携带 Authorization: Bearer {token}

  const response = await client.im.message.create({
    params: { receive_id_type: "chat_id" },
    data: {
      receive_id: params.to,
      content: JSON.stringify({ text: params.text }),
      msg_type: "text",
    },
  });

  return {
    messageId: response.data?.message_id,
    chatId: params.to,
  };
}
```

**发送流程**：

```
Agent 生成回复
     │
     ▼
┌─────────────────────────────────────────┐
│  构建消息内容                            │
│  - 文本 / 卡片 / 媒体                    │
│  - 提及目标用户                          │
└─────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│  Bot 认证                                │
│  - 使用 App ID + App Secret             │
│  - 获取 tenant_access_token             │
└─────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│  调用飞书 API                            │
│  POST /im/v1/messages                    │
│  Authorization: Bearer {token}           │
│  { "receive_id": "...", "content": "..." }│
└─────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────┐
│  飞书平台处理                            │
│  - 验证 Bot 身份                         │
│  - 验证 Bot 权限                         │
│  - 发送消息                              │
│  - 消息显示 Bot 名称和头像               │
└─────────────────────────────────────────┘
     │
     ▼
用户收到 Bot 消息
```

### 5.2 角色二：回复身份标识

Bot 可以配置显示的身份标识，让用户知道是哪个 Agent 在回复。

```typescript
// 配置 Bot 回复身份
type OutboundIdentity = {
  name?: string; // Agent 名称
  emoji?: string; // 显示 emoji
  theme?: string; // 卡片主题色
};

// 构建卡片标题
function resolveCardHeader(agentId: string, identity?: OutboundIdentity): CardHeaderConfig {
  const name = identity?.name?.trim() || agentId;
  const emoji = identity?.emoji?.trim();

  return {
    title: emoji ? `${emoji} ${name}` : name,
    template: identity?.theme ?? "blue",
  };
}
```

**示例效果**：

```
配置:
{
  agents: {
    list: [{
      id: "sales",
      name: "销售助手",
      identity: { emoji: "💼", name: "销售助手", theme: "blue" }
    }]
  }
}

用户看到的卡片:
┌─────────────────────────────────────┐
│ 💼 销售助手                          │
├─────────────────────────────────────┤
│ 您好！关于您咨询的产品问题...        │
│                                     │
│ 请问还有什么可以帮助您的？           │
└─────────────────────────────────────┘
│ Agent: 销售助手 | Model: gpt-4      │
└─────────────────────────────────────┘
```

### 5.3 角色三：提及转发

Bot 可以在回复中提及其他用户，实现"提及转发"功能。

```typescript
// 检测是否是提及转发请求
function isMentionForwardRequest(event: FeishuMessageEvent, botOpenId?: string): boolean {
  const mentions = event.message.mentions ?? [];
  if (mentions.length === 0) {
    return false;
  }

  const isDirectMessage = event.message.chat_type !== "group";
  const hasOtherMention = mentions.some((m) => m.id.open_id !== botOpenId);

  if (isDirectMessage) {
    // 私聊：提及任何用户就触发
    return hasOtherMention;
  } else {
    // 群聊：需要同时提及 Bot 和其他用户
    const hasBotMention = mentions.some((m) => m.id.open_id === botOpenId);
    return hasBotMention && hasOtherMention;
  }
}

// 提取提及目标
function extractMentionTargets(event: FeishuMessageEvent, botOpenId?: string): MentionTarget[] {
  const mentions = event.message.mentions ?? [];

  return mentions
    .filter((m) => {
      // 排除 Bot 自己
      if (botOpenId && m.id.open_id === botOpenId) {
        return false;
      }
      return !!m.id.open_id;
    })
    .map((m) => ({
      openId: m.id.open_id!,
      name: m.name,
      key: m.key,
    }));
}

// 在回复中提及用户
function buildMentionedCardContent(targets: MentionTarget[], text: string): string {
  const mentions = targets.map((t) => `<at user_id="${t.openId}">${t.name}</at>`).join(" ");

  return `${mentions}\n\n${text}`;
}
```

**提及转发场景**：

```
用户 A 在群组: "@OpenClaw助手 请 @张三 确认一下这个方案"
                              │
                              ▼
Bot 检测到:
- mentionedBot = true (Bot 被提及)
- mentionTargets = [{ openId: "ou_zhangsan", name: "张三" }]
                              │
                              ▼
Agent 处理并生成回复:
"张三，请确认一下这个方案"
                              │
                              ▼
Bot 发送回复（提及张三）:
"@张三 请确认一下这个方案"
                              │
                              ▼
张三收到通知（因为他被提及）
```

---

## 6. Bot 的权限与限制

### 6.1 Bot 权限范围

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Bot 权限边界                                        │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ✅ Bot 可以做的事情                                                 │   │
│  │  - 接收发给它的私聊消息                                              │   │
│  │  - 接收群聊中 @它的消息                                              │   │
│  │  - 发送消息到有权限的群组/用户                                       │   │
│  │  - 读取消息内容                                                      │   │
│  │  - 发送卡片、图片、文件等富媒体                                      │   │
│  │  - 添加/移除表情反应                                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ❌ Bot 不能做的事情                                                 │   │
│  │  - 以其他用户身份发送消息                                            │   │
│  │  - 读取未提及它的群聊消息（隐私模式）                                │   │
│  │  - 访问用户的私人数据                                                │   │
│  │  - 模拟其他用户的行为                                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 隐私模式

飞书 Bot 默认处于**隐私模式**，只能接收：

1. 直接发送给 Bot 的私聊消息
2. 群聊中 @Bot 的消息
3. Bot 被添加到群组/话题时的事件

**关闭隐私模式**：

```
在飞书开放平台设置：
1. 进入应用 → 机器人配置
2. 关闭"仅接收特定消息"
3. 或将 Bot 设为群管理员

关闭后 Bot 可以接收群聊中的所有消息。
```

### 6.3 权限配置

```json5
// 飞书应用权限配置
{
  permissions: [
    "im:message", // 获取与发送消息
    "im:message:send_as_bot", // 以 Bot 身份发送消息
    "im:chat", // 获取群组信息
    "im:chat:readonly", // 读取群组信息
    "im:resource", // 获取资源（图片、文件等）
    "contact:user.base:readonly", // 获取用户基本信息
  ],
}
```

---

## 7. 完整消息流程示例

### 7.1 用户发送消息到 Bot 响应

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  用户在群组发送: "@OpenClaw助手 帮我分析一下这个报告 @李四"                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  飞书平台处理                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  1. 检测消息提及了 Bot (open_id: ou_bot_xxx)                        │   │
│  │  2. 检测消息提及了李四 (open_id: ou_lisi)                           │   │
│  │  3. Bot 在隐私模式下，仅推送提及 Bot 的消息                         │   │
│  │  4. 推送消息到 Bot 的 Webhook/WebSocket                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Bot（OpenClaw）接收消息                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  1. 验证平台签名（平台端认证）                                       │   │
│  │  2. 解析消息内容:                                                   │   │
│  │     - chat_id: oc_xxx (群组 ID)                                     │   │
│  │     - sender_id: ou_user (发送者 ID)                               │   │
│  │     - content: "@OpenClaw助手 帮我分析一下这个报告 @李四"           │   │
│  │     - mentions: [                                                   │   │
│  │         { id: { open_id: "ou_bot_xxx" }, name: "OpenClaw助手" },   │   │
│  │         { id: { open_id: "ou_lisi" }, name: "李四" }               │   │
│  │       ]                                                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Bot 过滤与预处理                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  1. 检查发送者是否是 Bot 自己                                       │   │
│  │     - sender_id (ou_user) ≠ botOpenId (ou_bot_xxx)                 │   │
│  │     - ✅ 不是 Bot 自己，继续处理                                    │   │
│  │                                                                     │   │
│  │  2. 检测 Bot 是否被提及                                             │   │
│  │     - mentions[0].open_id === botOpenId                            │   │
│  │     - ✅ mentionedBot = true                                        │   │
│  │                                                                     │   │
│  │  3. 提取其他提及目标                                                │   │
│  │     - mentionTargets = [{ openId: "ou_lisi", name: "李四" }]       │   │
│  │                                                                     │   │
│  │  4. 规范化消息内容                                                  │   │
│  │     - 移除 @Bot 提及                                                │   │
│  │     - 保留 @李四 提及                                               │   │
│  │     - content = "帮我分析一下这个报告 <at>李四</at>"                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Bot 执行 OpenClaw 端认证                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  1. 群组权限检查                                                    │   │
│  │     - groupPolicy = "allowlist"                                     │   │
│  │     - groupAllowFrom.includes("oc_xxx") = true                     │   │
│  │     - ✅ 群组已授权                                                 │   │
│  │                                                                     │   │
│  │  2. 发送者权限检查                                                  │   │
│  │     - allowFrom.includes("ou_user") = true                         │   │
│  │     - ✅ 发送者已授权                                               │   │
│  │                                                                     │   │
│  │  3. 提及要求检查                                                    │   │
│  │     - requireMention = true                                         │   │
│  │     - mentionedBot = true                                           │   │
│  │     - ✅ 已提及 Bot                                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Agent 处理                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  1. 路由到合适的 Agent                                              │   │
│  │     - agentId = "analyst"                                           │   │
│  │                                                                     │   │
│  │  2. 构建消息上下文                                                  │   │
│  │     - 用户消息                                                      │   │
│  │     - 提及目标（李四）                                              │   │
│  │     - 历史对话                                                      │   │
│  │                                                                     │   │
│  │  3. LLM 生成回复                                                    │   │
│  │     - "好的，我已经分析了这个报告..."                               │   │
│  │     - "@李四 请注意第三点..."                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Bot 发送回复                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  1. 以 Bot 身份获取访问令牌                                         │   │
│  │     - 使用 App ID + App Secret                                      │   │
│  │     - 获取 tenant_access_token                                      │   │
│  │                                                                     │   │
│  │  2. 构建回复消息                                                    │   │
│  │     - 提及李四: <at user_id="ou_lisi">李四</at>                     │   │
│  │     - 消息内容: "好的，我已经分析了这个报告..."                     │   │
│  │                                                                     │   │
│  │  3. 调用飞书 API 发送消息                                           │   │
│  │     - POST /im/v1/messages                                          │   │
│  │     - receive_id: oc_xxx (群组 ID)                                  │   │
│  │     - 显示 Bot 名称和头像                                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  用户在群组看到回复                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │  🤖 OpenClaw助手                                              │   │   │
│  │  ├─────────────────────────────────────────────────────────────┤   │   │
│  │  │  @李四                                                       │   │   │
│  │  │                                                             │   │   │
│  │  │  好的，我已经分析了这个报告...                               │   │   │
│  │  │                                                             │   │   │
│  │  │  主要发现：                                                  │   │   │
│  │  │  1. 销售额增长 15%                                          │   │   │
│  │  │  2. 客户满意度提升                                          │   │   │
│  │  │  3. @李四 请注意第三点：成本控制                             │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  李四收到通知（因为他被 @提及）                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. 不同平台的 Bot 角色对比

### 8.1 入站消息接收

| 平台         | Bot 接收消息条件                          | 隐私模式 |
| ------------ | ----------------------------------------- | -------- |
| **飞书**     | 私聊 / 群聊@提及 / 关闭隐私模式           | 默认开启 |
| **Telegram** | 所有消息（需配置 privacy mode）           | 可关闭   |
| **WhatsApp** | 所有私聊 / 群聊（需是管理员或被提及）     | 默认开启 |
| **Discord**  | 所有消息（需 Privileged Gateway Intents） | 需申请   |
| **Slack**    | 所有消息 / App Mention 事件               | 可配置   |

### 8.2 出站消息发送

| 平台         | Bot 发送方式    | 身份显示        |
| ------------ | --------------- | --------------- |
| **飞书**     | 以 Bot 身份发送 | Bot 名称 + 头像 |
| **Telegram** | 以 Bot 身份发送 | Bot 名称 + 头像 |
| **WhatsApp** | 以登录账号发送  | 账号名称 + 头像 |
| **Discord**  | 以 Bot 身份发送 | Bot 名称 + 头像 |
| **Slack**    | 以 Bot 身份发送 | Bot 名称 + 头像 |

### 8.3 特殊功能

| 平台         | 提及用户                | 卡片消息                | 流式更新    |
| ------------ | ----------------------- | ----------------------- | ----------- |
| **飞书**     | ✅ `<at user_id="...">` | ✅ Interactive Card     | ✅ 消息更新 |
| **Telegram** | ✅ HTML/Markdown        | ❌ Inline Keyboard      | ❌          |
| **WhatsApp** | ✅ `@mentioned_id`      | ✅ List/Button Template | ❌          |
| **Discord**  | ✅ `<@user_id>`         | ✅ Embed/Components     | ✅ 消息编辑 |
| **Slack**    | ✅ `<@user_id>`         | ✅ Block Kit            | ✅ 消息更新 |

---

## 9. 总结

### 9.1 Bot 的核心角色

| 阶段     | 角色         | 作用                     |
| -------- | ------------ | ------------------------ |
| **入站** | 消息接收者   | 接收平台推送的事件       |
| **入站** | 消息过滤器   | 过滤自己的消息，避免循环 |
| **入站** | 提及检测对象 | 判断是否需要响应         |
| **入站** | 消息规范化   | 处理 @提及标签           |
| **出站** | 消息发送者   | 以 Bot 身份发送回复      |
| **出站** | 身份标识     | 显示 Agent 名称          |
| **出站** | 提及转发     | 在回复中提及其他用户     |

### 9.2 Bot 不是什么

```
❌ Bot 不是真实用户
   - Bot 没有独立的账号体系
   - Bot 无法以其他用户身份发送消息
   - Bot 的权限由应用配置决定

❌ Bot 不是消息通道
   - Bot 不负责消息传输
   - 消息传输由平台基础设施完成
   - Bot 只是消息的接收者和发送者

❌ Bot 不是权限管理器
   - Bot 不决定谁能发送消息
   - 权限管理由 OpenClaw 的认证层完成
   - Bot 只提供身份标识
```

### 9.3 Bot 本质

```
Bot = 平台应用的身份代理

┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   用户 ◀───▶ 平台 ◀───▶ Bot (OpenClaw 应用身份) ◀───▶ OpenClaw Gateway     │
│                     │                      │                                │
│                     │                      ▼                                │
│                     │               平台端认证                              │
│                     │              (App ID + Secret)                        │
│                     │                                                      │
│                     └──────────────────────┘                               │
│                                                                            │
│   Bot 是 OpenClaw 在平台上的"身份证"和"收发室"                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```
