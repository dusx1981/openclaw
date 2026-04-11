# OpenClaw 对接消息软件的认证机制技术文档

## 1. 概述

OpenClaw 对接飞书、Telegram、WhatsApp 等消息软件时，涉及**两端认证**：

1. **平台端认证**：证明 OpenClaw 有权接收该平台的事件和调用 API
2. **OpenClaw 端认证**：证明消息发送者有权使用该 OpenClaw 实例

本文档以飞书为例，详细说明两端认证的完整逻辑。

---

## 2. 为什么需要两端认证？

### 2.1 安全模型

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              安全边界                                        │
│                                                                             │
│   ┌─────────────┐                          ┌─────────────────────────────┐  │
│   │   用户 A    │                          │         用户 B              │  │
│   │  (授权)     │                          │        (未授权)             │  │
│   └──────┬──────┘                          └──────────────┬──────────────┘  │
│          │                                                 │                │
│          │ ✅ 允许                                         │ ❌ 拒绝        │
│          ▼                                                 ▼                │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        OpenClaw Gateway                              │   │
│   │  ┌─────────────────────────────────────────────────────────────┐   │   │
│   │  │              OpenClaw 端认证层                               │   │   │
│   │  │  - dmPolicy (私信策略)                                       │   │   │
│   │  │  - allowFrom (白名单)                                        │   │   │
│   │  │  - groupPolicy (群组策略)                                    │   │   │
│   │  │  - pairing (配对机制)                                        │   │   │
│   │  └─────────────────────────────────────────────────────────────┘   │   │
│   │                              │                                      │   │
│   │                              ▼                                      │   │
│   │  ┌─────────────────────────────────────────────────────────────┐   │   │
│   │  │              平台端认证层                                    │   │   │
│   │  │  - App ID + App Secret (应用身份)                            │   │   │
│   │  │  - encryptKey (加密密钥)                                     │   │   │
│   │  │  - verificationToken (验证令牌)                              │   │   │
│   │  └─────────────────────────────────────────────────────────────┘   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
                                     ▼
                        ┌─────────────────────────┐
                        │     飞书/Telegram/      │
                        │     WhatsApp 平台       │
                        └─────────────────────────┘
```

### 2.2 两端认证的职责

| 认证层              | 认证对象      | 认证目的                           | 认证失败后果               |
| ------------------- | ------------- | ---------------------------------- | -------------------------- |
| **平台端认证**      | OpenClaw 应用 | 证明 OpenClaw 是合法的平台应用     | 无法接收事件，无法调用 API |
| **OpenClaw 端认证** | 消息发送者    | 证明发送者有权使用此 OpenClaw 实例 | 消息被忽略，不触发 Agent   |

### 2.3 为什么不能只用一端认证？

**场景 1：只有平台端认证**

```
问题：任何能访问该平台 Bot 的人都能使用 OpenClaw
风险：
- 未授权用户消耗 API 配额
- 恶意用户发送敏感指令
- 无法区分不同用户的使用权限
```

**场景 2：只有 OpenClaw 端认证**

```
问题：无法证明消息确实来自该平台
风险：
- 消息伪造攻击
- 中间人攻击
- 无法信任消息来源
```

**结论：两端认证必须同时存在，互相补充。**

---

## 3. 平台端认证详解

### 3.1 认证要素

| 要素         | 用途              | 飞书              | Telegram     | WhatsApp      |
| ------------ | ----------------- | ----------------- | ------------ | ------------- |
| **应用标识** | 识别应用          | App ID            | Bot Token    | Session ID    |
| **应用密钥** | 验证应用身份      | App Secret        | (Token 自带) | (QR 登录凭证) |
| **事件验证** | 验证 Webhook 请求 | encryptKey        | -            | -             |
| **挑战验证** | URL 验证          | verificationToken | -            | -             |

### 3.2 飞书认证机制

#### 3.2.1 应用身份认证

```typescript
// 创建飞书客户端
const client = new Lark.Client({
  appId: "cli_xxxxxxxxx", // 应用 ID
  appSecret: "xxxxxxxxxxxx", // 应用密钥
  appType: Lark.AppType.SelfBuild,
  domain: Lark.Domain.Feishu, // 飞书 vs Lark (国际版)
});

// SDK 自动获取 tenant_access_token
// 后续 API 调用自动携带此 token
```

**认证流程**：

```
┌─────────────┐     POST /auth/v3/tenant_access_token/internal     ┌─────────────┐
│ OpenClaw    │ ─────────────────────────────────────────────────▶ │  飞书 API   │
│ (App ID +   │                                                   │             │
│  App Secret)│ ◀───────────────────────────────────────────────── │             │
└─────────────┐              tenant_access_token                   └─────────────┘
      │
      │  后续 API 调用携带: Authorization: Bearer {token}
      ▼
┌─────────────┐
│ 飞书 API    │ 验证 token 有效性，返回数据
└─────────────┘
```

#### 3.2.2 WebSocket 连接认证

```typescript
// 创建 WebSocket 客户端
const wsClient = new Lark.WSClient({
  appId: "cli_xxxxxxxxx",
  appSecret: "xxxxxxxxxxxx",
  domain: Lark.Domain.Feishu,
  loggerLevel: Lark.LoggerLevel.info,
});

// 启动连接
wsClient.start({ eventDispatcher });

// SDK 自动：
// 1. 使用 App ID + App Secret 获取连接凭证
// 2. 建立 WebSocket 长连接
// 3. 自动重连
```

**连接流程**：

```
┌─────────────┐     1. 获取 WebSocket 连接 URL      ┌─────────────┐
│ OpenClaw    │ ─────────────────────────────────▶ │  飞书 API   │
│             │     (App ID + App Secret)          │             │
│             │ ◀───────────────────────────────── │             │
│             │     WebSocket URL + ticket         │             │
│             │                                    └─────────────┘
│             │
│             │     2. 建立 WebSocket 连接
│             │ ─────────────────────────────────▶ ┌─────────────┐
│             │     wss://ws.feishu.cn/...         │ 飞书 WS     │
│             │ ◀───────────────────────────────── │ Gateway     │
│             │     事件推送                        │             │
└─────────────┘                                    └─────────────┘
```

#### 3.2.3 Webhook 请求签名验证

当使用 Webhook 模式时，飞书会向 OpenClaw 发送 HTTP 请求。为了验证请求确实来自飞书，需要验证签名。

**签名算法**：

```typescript
function verifyFeishuWebhookSignature(params: {
  headers: HttpHeaders;
  rawBody: string;
  encryptKey: string;
}): boolean {
  const timestamp = headers["x-lark-request-timestamp"];
  const nonce = headers["x-lark-request-nonce"];
  const signature = headers["x-lark-signature"];

  // 计算签名: SHA256(timestamp + nonce + encryptKey + rawBody)
  const computedSignature = crypto
    .createHash("sha256")
    .update(timestamp + nonce + encryptKey + rawBody)
    .digest("hex");

  // 安全比较（防止时序攻击）
  return safeEqualSecret(computedSignature, signature);
}
```

**验证流程**：

```
┌─────────────┐     POST /feishu/events            ┌─────────────┐
│   飞书      │ ─────────────────────────────────▶ │  OpenClaw   │
│  平台       │                                    │  Gateway    │
│             │ Headers:                           │             │
│             │   x-lark-request-timestamp: 12345  │             │
│             │   x-lark-request-nonce: abc        │             │
│             │   x-lark-signature: sha256...      │             │
│             │                                    │             │
│             │ Body:                              │  验证签名:  │
│             │   { "type": "...", ... }           │  1. 提取 headers
│             │                                    │  2. 读取 rawBody
│             │                                    │  3. 计算 SHA256
│             │                                    │  4. 对比签名
│             │ ◀───────────────────────────────── │             │
│             │     200 OK / 401 Unauthorized      │             │
└─────────────┘                                    └─────────────┘
```

#### 3.2.4 URL 验证（挑战响应）

配置 Webhook URL 时，飞书会发送一个挑战请求验证 URL 有效性：

```typescript
// 飞书发送:
{
  "type": "url_verification",
  "challenge": "aaaabbbbccccdddd",
  "token": "verification_token"
}

// OpenClaw 响应:
// 1. 验证 token 是否匹配 verificationToken
// 2. 返回 challenge 值
{
  "challenge": "aaaabbbbccccdddd"
}
```

### 3.3 Telegram 认证机制

Telegram 使用 Bot Token 进行认证，Token 包含了 Bot 的所有身份信息。

```typescript
// Bot Token 格式: {bot_id}:{token}
// 例如: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz

const bot = new Bot("123456789:ABCdefGHIjklMNOpqrsTUVwxyz");

// Token 包含:
// - Bot ID: 123456789
// - 认证密钥: ABCdefGHIjklMNOpqrsTUVwxyz

// 所有 API 调用自动携带此 Token
```

**认证流程**：

```
┌─────────────┐     GET https://api.telegram.org/bot{token}/getMe     ┌─────────────┐
│ OpenClaw    │ ────────────────────────────────────────────────────▶ │ Telegram    │
│             │                                                       │  API        │
│             │ ◀─────────────────────────────────────────────────── │             │
│             │     { "ok": true, "result": { "id": 123, ... } }     │             │
└─────────────┘                                                       └─────────────┘
```

### 3.4 WhatsApp 认证机制

WhatsApp 使用 Baileys 库进行 QR 码登录，建立端到端加密连接。

```typescript
// 扫码登录流程
const { state, saveCreds } = await useMultiFileAuthState("auth-dir");

const sock = makeWASocket({
  auth: state,
  // ...
});

// 监听 QR 码
sock.on("connection.update", (update) => {
  const { qr } = update;
  if (qr) {
    // 显示 QR 码，用户用 WhatsApp 扫码
    console.log("QR:", qr);
  }
});

// 登录成功后保存凭证
sock.on("creds.update", saveCreds);
```

---

## 4. OpenClaw 端认证详解

### 4.1 认证层级

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        OpenClaw 端认证层级                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  第 1 层：通道启用检查                                               │   │
│  │  - channels.feishu.enabled !== false                                │   │
│  │  - 应用凭据已配置 (appId + appSecret)                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  第 2 层：账户启用检查                                               │   │
│  │  - accounts[accountId].enabled !== false                            │   │
│  │  - 账户凭据已配置                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  第 3 层：消息类型检查                                               │   │
│  │  - 过滤机器人自己的消息                                             │   │
│  │  - 过滤系统消息                                                     │   │
│  │  - 只处理用户消息                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│              ┌─────────────────────┴─────────────────────┐                  │
│              │                                           │                  │
│              ▼                                           ▼                  │
│  ┌───────────────────────────┐           ┌───────────────────────────┐      │
│  │  第 4A 层：私信认证       │           │  第 4B 层：群组认证       │      │
│  │  - dmPolicy 检查          │           │  - groupPolicy 检查       │      │
│  │  - allowFrom 白名单       │           │  - groupAllowFrom 白名单  │      │
│  │  - pairing 配对机制       │           │  - requireMention 检查    │      │
│  └───────────────────────────┘           └───────────────────────────┘      │
│              │                                           │                  │
│              └─────────────────────┬─────────────────────┘                  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  第 5 层：Agent 路由解析                                             │   │
│  │  - bindings 匹配                                                    │   │
│  │  - 广播配置                                                         │   │
│  │  - 默认 Agent                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 私信认证 (dmPolicy)

#### 4.2.1 dmPolicy 类型

| 策略        | 说明                                    | 适用场景                 |
| ----------- | --------------------------------------- | ------------------------ |
| `open`      | 开放，任何人都可以私信                  | 公开 Bot，无需审批       |
| `allowlist` | 白名单，只有 allowFrom 中的用户可以私信 | 企业内部，已知的用户列表 |
| `pairing`   | 配对机制，用户需要获取配对码并等待批准  | 个人助理，需要手动批准   |
| `disabled`  | 禁用私信                                | 只响应群组消息           |

#### 4.2.2 配对机制详解

**配对流程**：

```
┌─────────────┐                                      ┌─────────────┐
│   用户      │                                      │  OpenClaw   │
│  (未授权)   │                                      │  Gateway    │
└──────┬──────┘                                      └──────┬──────┘
       │                                                    │
       │  1. 发送消息                                       │
       │ ─────────────────────────────────────────────────▶│
       │                                                    │
       │  2. 返回配对码                                     │
       │ ◀───────────────────────────────────────────────── │
       │    "配对码: XXXXXXXX (1小时有效)"                  │
       │                                                    │
       │                                                    │ 3. 管理员查看待处理请求
       │                                                    │    openclaw pairing list feishu
       │                                                    │
       │                                                    │ 4. 管理员批准
       │                                                    │    openclaw pairing approve feishu XXXXXXXX
       │                                                    │
       │  5. 配对成功通知                                   │
       │ ◀───────────────────────────────────────────────── │
       │    "配对成功！现在可以使用助手了"                  │
       │                                                    │
       │  6. 后续消息正常处理                               │
       │ ─────────────────────────────────────────────────▶│
       │                                                    │
```

**配对码特性**：

```typescript
// 配对码生成
function generatePairingCode(): string {
  // 8 字符，大写，排除易混淆字符 (0O1I)
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// 示例: "ABCD2345", "XYZK789M"
```

**配对状态存储**：

```
~/.openclaw/credentials/
├── feishu-pairing.json          # 待处理配对请求
│   {
│     "ABCD1234": {
│       "senderId": "ou_xxx",
│       "createdAt": 1699000000000,
│       "expiresAt": 1699003600000  // 1小时后过期
│     }
│   }
│
└── feishu-allowFrom.json        # 已批准白名单
    ["ou_user1", "ou_user2", "ou_user3"]
```

#### 4.2.3 allowFrom 白名单

```json5
// openclaw.json
{
  channels: {
    feishu: {
      dmPolicy: "allowlist",
      allowFrom: [
        "ou_user1", // 用户 Open ID
        "ou_user2",
        "*", // 通配符：允许所有人（不推荐）
      ],
    },
  },
}
```

**白名单匹配逻辑**：

```typescript
function isSenderAllowed(params: { allowFrom: string[]; senderId: string }): boolean {
  const { allowFrom, senderId } = params;

  // 空白名单 = 拒绝所有
  if (allowFrom.length === 0) {
    return false;
  }

  // 通配符 = 允许所有
  if (allowFrom.includes("*")) {
    return true;
  }

  // 精确匹配
  const normalizedSenderId = senderId.trim().toLowerCase();
  const normalizedAllowFrom = allowFrom.map((s) => s.trim().toLowerCase());

  return normalizedAllowFrom.includes(normalizedSenderId);
}
```

### 4.3 群组认证 (groupPolicy)

#### 4.3.1 groupPolicy 类型

| 策略        | 说明                                         | 适用场景   |
| ----------- | -------------------------------------------- | ---------- |
| `open`      | 开放，任何群组都可以使用                     | 公开服务   |
| `allowlist` | 白名单，只有 groupAllowFrom 中的群组可以使用 | 指定群组   |
| `disabled`  | 禁用群组                                     | 只响应私信 |

#### 4.3.2 群组认证流程

```typescript
async function checkGroupAccess(params: {
  groupId: string;
  groupPolicy: "open" | "allowlist" | "disabled";
  groupAllowFrom: string[];
  senderId: string;
  allowFrom: string[];
  requireMention: boolean;
  mentionedBot: boolean;
}): Promise<{ allowed: boolean; reason?: string }> {
  const {
    groupId,
    groupPolicy,
    groupAllowFrom,
    senderId,
    allowFrom,
    requireMention,
    mentionedBot,
  } = params;

  // 1. 检查群组策略
  if (groupPolicy === "disabled") {
    return { allowed: false, reason: "群组功能已禁用" };
  }

  if (groupPolicy === "allowlist") {
    // 检查群组白名单
    const groupAllowed = groupAllowFrom.includes(groupId) || groupAllowFrom.includes("*");
    if (!groupAllowed) {
      return { allowed: false, reason: "群组不在白名单中" };
    }

    // 检查发送者白名单
    const senderAllowed = allowFrom.includes(senderId) || allowFrom.includes("*");
    if (!senderAllowed) {
      return { allowed: false, reason: "发送者不在白名单中" };
    }
  }

  // 2. 检查是否需要提及 Bot
  if (requireMention && !mentionedBot) {
    // 消息不触发 Agent，但记录到历史
    return { allowed: false, reason: "需要 @Bot 才能触发" };
  }

  return { allowed: true };
}
```

#### 4.3.3 requireMention 机制

在群组中，如果 `requireMention: true`，用户必须 @ Bot 才能触发响应：

```json5
// 配置
{
  channels: {
    feishu: {
      groupPolicy: "open",
      requireMention: true, // 全局默认
      groups: {
        oc_xxx: {
          requireMention: false, // 特定群组覆盖
        },
      },
    },
  },
}
```

**提及检测**：

```typescript
function checkBotMentioned(event: FeishuMessageEvent, botOpenId?: string): boolean {
  // 1. 检查消息中的提及列表
  const mentions = event.message.mentions;
  if (mentions && botOpenId) {
    return mentions.some((m) => m.id === botOpenId || m.key === botOpenId);
  }

  // 2. 检查消息内容中的 @ 提及
  const content = event.message.content;
  if (content.includes(`<at user_id="${botOpenId}">`)) {
    return true;
  }

  return false;
}
```

### 4.4 多账户认证

当配置多个账户时，认证逻辑需要考虑账户隔离：

```json5
{
  channels: {
    feishu: {
      enabled: true,
      appId: "cli_default",
      appSecret: "xxx",
      dmPolicy: "pairing",

      accounts: {
        sales: {
          appId: "cli_sales",
          appSecret: "xxx",
          dmPolicy: "allowlist",
          allowFrom: ["ou_sales1", "ou_sales2"],
        },
        support: {
          appId: "cli_support",
          appSecret: "xxx",
          dmPolicy: "open",
          groupPolicy: "allowlist",
          groupAllowFrom: ["oc_support_group"],
        },
      },
    },
  },
}
```

**账户隔离规则**：

```typescript
// 不同账户的白名单存储在不同文件
~/.openclaw/credentials/
├── feishu-allowFrom.json           # 默认账户白名单
├── feishu-sales-allowFrom.json     # sales 账户白名单
└── feishu-support-allowFrom.json   # support 账户白名单
```

---

## 5. 完整认证流程示例

### 5.1 飞书私信消息处理

```
用户发送消息
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  飞书平台                                                                    │
│  1. 验证消息格式                                                             │
│  2. 添加平台签名                                                             │
│  3. 推送到 OpenClaw Webhook/WebSocket                                       │
└─────────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  平台端认证 (OpenClaw Gateway)                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  1. 验证 Webhook 签名 (SHA256(timestamp + nonce + encryptKey + body))│   │
│  │  2. 解析事件类型                                                     │   │
│  │  3. 提取消息内容                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
       │ ✅ 平台认证通过
       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  消息预处理                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  1. 消息去重 (messageId 检查)                                        │   │
│  │  2. 消息防抖 (同会话合并短消息)                                      │   │
│  │  3. 过滤机器人自己的消息                                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  OpenClaw 端认证                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  1. 判断消息类型 (私信 vs 群组)                                      │   │
│  │     - chatType: "p2p" → 私信                                        │   │
│  │     - chatType: "group" → 群组                                      │   │
│  │                                                                     │   │
│  │  2. 私信认证:                                                       │   │
│  │     a. 检查 dmPolicy                                                │   │
│  │        - "open" → 通过                                              │   │
│  │        - "allowlist" → 检查 allowFrom                               │   │
│  │        - "pairing" → 检查是否已配对                                 │   │
│  │        - "disabled" → 拒绝                                          │   │
│  │     b. 如果未授权且 dmPolicy="pairing"                               │   │
│  │        - 生成配对码                                                  │   │
│  │        - 返回配对提示消息                                            │   │
│  │        - 记录到 pairing.json                                        │   │
│  │                                                                     │   │
│  │  3. 群组认证:                                                       │   │
│  │     a. 检查 groupPolicy                                             │   │
│  │        - "open" → 继续                                              │   │
│  │        - "allowlist" → 检查 groupAllowFrom + allowFrom              │   │
│  │        - "disabled" → 拒绝                                          │   │
│  │     b. 检查 requireMention                                          │   │
│  │        - true + 未提及 → 记录历史但不处理                            │   │
│  │        - false 或已提及 → 通过                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
       │ ✅ 用户认证通过
       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Agent 处理                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  1. 解析 Agent 路由 (bindings 匹配)                                  │   │
│  │  2. 构建消息上下文 (历史、媒体、引用)                                │   │
│  │  3. 调用 LLM 生成回复                                               │   │
│  │  4. 发送回复消息                                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 配对机制代码示例

```typescript
// 处理私信配对请求
async function handleDirectMessagePairing(params: {
  senderId: string;
  senderName?: string;
  dmPolicy: string;
  allowFrom: string[];
  pairingStore: PairingStore;
  sendReply: (text: string) => Promise<void>;
}): Promise<{ processed: boolean }> {
  const { senderId, senderName, dmPolicy, allowFrom, pairingStore, sendReply } = params;

  // 1. 检查白名单
  if (allowFrom.includes(senderId) || allowFrom.includes("*")) {
    return { processed: true }; // 已授权，继续处理
  }

  // 2. 检查配对策略
  if (dmPolicy !== "pairing") {
    // 非配对策略且不在白名单，拒绝
    await sendReply("抱歉，您没有使用权限。");
    return { processed: false };
  }

  // 3. 检查是否已有待处理配对请求
  const existingRequest = pairingStore.findPendingBySender(senderId);
  if (existingRequest && !isExpired(existingRequest)) {
    // 已有有效配对码，提示用户
    await sendReply(
      `您已有一个待处理的配对请求。\n` + `配对码: ${existingRequest.code}\n` + `请联系管理员批准。`,
    );
    return { processed: false };
  }

  // 4. 生成新配对码
  const code = generatePairingCode();
  const expiresAt = Date.now() + 3600000; // 1小时后过期

  // 5. 存储配对请求
  pairingStore.addPending({
    code,
    senderId,
    senderName,
    createdAt: Date.now(),
    expiresAt,
  });

  // 6. 返回配对提示
  await sendReply(
    `欢迎使用 OpenClaw！\n\n` +
      `您的配对码是: ${code}\n\n` +
      `请将此配对码发送给管理员进行批准。\n` +
      `配对码 1 小时内有效。`,
  );

  return { processed: false };
}

// 管理员批准配对
async function approvePairing(params: {
  code: string;
  pairingStore: PairingStore;
  allowFromStore: AllowFromStore;
}): Promise<{ success: boolean; senderId?: string }> {
  const { code, pairingStore, allowFromStore } = params;

  // 1. 查找配对请求
  const request = pairingStore.findByCode(code);
  if (!request) {
    return { success: false };
  }

  // 2. 检查是否过期
  if (isExpired(request)) {
    pairingStore.remove(code);
    return { success: false };
  }

  // 3. 添加到白名单
  allowFromStore.add(request.senderId);

  // 4. 移除配对请求
  pairingStore.remove(code);

  // 5. 通知用户（可选，通过后续消息）

  return { success: true, senderId: request.senderId };
}
```

---

## 6. 各通道认证对比

### 6.1 平台端认证对比

| 通道         | 认证方式               | 凭证类型   | 连接模式               |
| ------------ | ---------------------- | ---------- | ---------------------- |
| **飞书**     | App ID + App Secret    | 应用凭据   | WebSocket / Webhook    |
| **Telegram** | Bot Token              | 机器人令牌 | Long Polling / Webhook |
| **WhatsApp** | QR 码登录              | 会话凭证   | WebSocket              |
| **Discord**  | Bot Token              | 机器人令牌 | Gateway (WebSocket)    |
| **Slack**    | App Token + Bot Token  | 应用令牌   | Socket Mode / Webhook  |
| **Signal**   | phone number + device  | 设备凭据   | signal-cli             |
| **QQ Bot**   | App ID + Client Secret | 应用凭据   | WebSocket              |

### 6.2 OpenClaw 端认证对比

| 通道         | 私信策略 | 群组策略 | 配对支持 | 白名单支持 |
| ------------ | -------- | -------- | -------- | ---------- |
| **飞书**     | ✅       | ✅       | ✅       | ✅         |
| **Telegram** | ✅       | ✅       | ✅       | ✅         |
| **WhatsApp** | ✅       | ✅       | ✅       | ✅         |
| **Discord**  | ✅       | ✅       | ✅       | ✅         |
| **Slack**    | ✅       | ✅       | ✅       | ✅         |
| **Signal**   | ✅       | ✅       | ✅       | ✅         |
| **QQ Bot**   | ✅       | ✅       | ❌       | ✅         |

---

## 7. 安全最佳实践

### 7.1 平台端凭证安全

```json5
// ✅ 推荐：使用 SecretRef 或环境变量
{
  channels: {
    feishu: {
      appId: { secretRef: "feishu-app-id" },
      appSecret: { secretRef: "feishu-app-secret" },
    },
  },
}

// 或使用环境变量
// FEISHU_APP_ID=cli_xxx
// FEISHU_APP_SECRET=xxx

// ❌ 不推荐：明文存储
{
  channels: {
    feishu: {
      appId: "cli_xxx",      // 明文，不安全
      appSecret: "xxx",       // 明文，不安全
    },
  },
}
```

### 7.2 白名单管理

```bash
# 定期审查白名单
openclaw pairing list feishu
cat ~/.openclaw/credentials/feishu-allowFrom.json

# 移除不需要的用户
openclaw pairing revoke feishu ou_xxx

# 使用群组策略限制访问范围
{
  channels: {
    feishu: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["oc_approved_group"],
    },
  },
}
```

### 7.3 配对码管理

```bash
# 查看待处理配对请求
openclaw pairing list feishu

# 清理过期请求（自动）
# 配对码 1 小时后自动过期

# 手动拒绝配对请求
openclaw pairing reject feishu XXXXXXXX
```

### 7.4 审计日志

```bash
# 查看 Gateway 日志
tail -f ~/.openclaw/logs/gateway.log | grep -E "(auth|pairing|allowFrom)"

# 检查安全状态
openclaw doctor
```

---

## 8. 故障排除

### 8.1 平台端认证失败

**症状**: 无法接收消息，API 调用返回 401

**排查步骤**:

```bash
# 1. 检查凭证配置
openclaw channels status --channel feishu --probe

# 2. 检查 App ID 和 Secret
cat openclaw.json | grep -A5 feishu

# 3. 查看 Gateway 日志
tail -f ~/.openclaw/logs/gateway.log | grep feishu

# 4. 验证 Webhook 签名（如果使用 Webhook 模式）
# 检查 encryptKey 是否正确配置
```

### 8.2 OpenClaw 端认证失败

**症状**: 消息被忽略，不触发 Agent

**排查步骤**:

```bash
# 1. 检查 dmPolicy 配置
cat openclaw.json | grep dmPolicy

# 2. 检查白名单
cat ~/.openclaw/credentials/feishu-allowFrom.json

# 3. 检查配对状态
openclaw pairing list feishu

# 4. 检查群组策略
cat openclaw.json | grep -A10 groups

# 5. 查看 Gateway 日志
tail -f ~/.openclaw/logs/gateway.log | grep -E "(allowFrom|pairing|policy)"
```

### 8.3 常见错误

| 错误                                | 原因                        | 解决方案                                    |
| ----------------------------------- | --------------------------- | ------------------------------------------- |
| `Feishu credentials not configured` | 未配置 App ID 或 App Secret | 配置 channels.feishu.appId 和 appSecret     |
| `Invalid webhook signature`         | Webhook 签名验证失败        | 检查 encryptKey 配置                        |
| `Sender not in allowlist`           | 发送者不在白名单中          | 添加到 allowFrom 或批准配对                 |
| `Group not in allowlist`            | 群组不在白名单中            | 添加到 groupAllowFrom                       |
| `Bot not mentioned`                 | 群组消息未 @ Bot            | 在消息中 @ Bot 或设置 requireMention: false |
| `Pairing code expired`              | 配对码已过期                | 让用户重新获取配对码                        |

---

## 9. 总结

### 9.1 两端认证的关系

```
平台端认证 ────▶ 确保 OpenClaw 是合法的平台应用
     │
     └───▶ 建立信任通道 ────▶ 可以接收平台事件
                                  │
                                  ▼
OpenClaw 端认证 ────▶ 确保发送者是授权用户
     │
     └───▶ 执行访问控制 ────▶ 决定是否处理消息
```

### 9.2 关键要点

1. **平台端认证**：
   - 验证 OpenClaw 应用的合法性
   - 建立与平台的安全通信通道
   - 使用应用凭据 (App ID + App Secret) 或 Bot Token

2. **OpenClaw 端认证**：
   - 验证消息发送者的授权状态
   - 实现多层级访问控制 (dmPolicy, allowFrom, groupPolicy)
   - 支持配对机制进行手动批准

3. **两者缺一不可**：
   - 平台端认证保护平台安全
   - OpenClaw 端认证保护 OpenClaw 实例安全
   - 双重认证确保整体安全性

### 9.3 快速配置参考

```json5
// 完整的飞书认证配置示例
{
  channels: {
    feishu: {
      // ===== 平台端认证 =====
      enabled: true,
      appId: { secretRef: "feishu-app-id" },
      appSecret: { secretRef: "feishu-app-secret" },
      domain: "feishu",
      connectionMode: "websocket",
      encryptKey: { secretRef: "feishu-encrypt-key" }, // Webhook 模式需要
      verificationToken: { secretRef: "feishu-verification-token" },

      // ===== OpenClaw 端认证 =====
      // 私信策略
      dmPolicy: "pairing",
      allowFrom: [],

      // 群组策略
      groupPolicy: "allowlist",
      groupAllowFrom: ["oc_approved_group"],
      requireMention: true,

      // 群组覆盖配置
      groups: {
        oc_special_group: {
          requireMention: false,
          allowFrom: ["ou_user1", "ou_user2"],
        },
      },
    },
  },
}
```
