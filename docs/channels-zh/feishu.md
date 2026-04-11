---
summary: "Feishu bot overview, features, and configuration"
read_when:
  - You want to connect a Feishu/Lark bot
  - You are configuring the Feishu channel
title: Feishu
---

# 飞书机器人

飞书（Lark）是企业用于消息和协作的团队聊天平台。此插件使用平台的 WebSocket 事件订阅将 OpenClaw 连接到飞书/Lark 机器人，因此无需暴露公共 webhook URL 即可接收消息。

---

## 内置插件

飞书随当前 OpenClaw 版本内置，无需单独安装插件。

如果你使用的是不包含内置飞书的旧版本或自定义安装，手动安装：

```bash
openclaw plugins install @openclaw/feishu
```

---

## 快速开始

有两种方式添加飞书频道：

### 方法 1：入门引导（推荐）

如果你刚安装 OpenClaw，运行入门引导：

```bash
openclaw onboard
```

向导会引导你：

1. 创建飞书应用并收集凭据
2. 在 OpenClaw 中配置应用凭据
3. 启动 gateway

✅ **配置完成后**，检查 gateway 状态：

- `openclaw gateway status`
- `openclaw logs --follow`

### 方法 2：CLI 设置

如果你已完成初始安装，通过 CLI 添加频道：

```bash
openclaw channels add
```

选择 **Feishu**，然后输入 App ID 和 App Secret。

✅ **配置完成后**，管理 gateway：

- `openclaw gateway status`
- `openclaw gateway restart`
- `openclaw logs --follow`

---

## 步骤 1：创建飞书应用

### 1. 打开飞书开放平台

访问 [飞书开放平台](https://open.feishu.cn/app) 并登录。

Lark（国际）租户应使用 [https://open.larksuite.com/app](https://open.larksuite.com/app) 并在飞书配置中设置 `domain: "lark"`。

### 2. 创建应用

1. 点击 **创建企业自建应用**
2. 填写应用名称 + 描述
3. 选择应用图标

![创建企业自建应用](/images/feishu-step2-create-app.png)

### 3. 复制凭据

从 **凭证与基础信息**，复制：

- **App ID**（格式：`cli_xxx`)
- **App Secret**

❗ **重要：** 保持 App Secret 私密。

![获取凭据](/images/feishu-step3-credentials.png)

### 4. 配置权限

在 **权限管理**，点击 **批量添加** 并粘贴：

```json
{
  "scopes": {
    "tenant": [
      "aily:file:read",
      "aily:file:write",
      "application:application.app_message_stats.overview:readonly",
      "application:application:self_manage",
      "application:bot.menu:write",
      "cardkit:card:read",
      "cardkit:card:write",
      "contact:user.employee_id:readonly",
      "corehr:file:download",
      "event:ip_list",
      "im:chat.access_event.bot_p2p_chat:read",
      "im:chat.members:bot_access",
      "im:message",
      "im:message.group_at_msg:readonly",
      "im:message.p2p_msg:readonly",
      "im:message:readonly",
      "im:message:send_as_bot",
      "im:resource"
    ],
    "user": ["aily:file:read", "aily:file:write", "im:chat.access_event.bot_p2p_chat:read"]
  }
}
```

![配置权限](/images/feishu-step4-permissions.png)

### 5. 启用机器人能力

在 **应用能力** > **机器人**：

1. 启用机器人能力
2. 设置机器人名称

![启用机器人能力](/images/feishu-step5-bot-capability.png)

### 6. 配置事件订阅

⚠️ **重要：** 设置事件订阅前，确保：

1. 你已为飞书运行 `openclaw channels add`
2. Gateway 正在运行（`openclaw gateway status`）

在 **事件订阅**：

1. 选择 **使用长连接接收事件**（WebSocket)
2. 添加事件：`im.message.receive_v1`
3. （可选）对于云文档评论工作流，也添加：`drive.notice.comment_add_v1`

⚠️ 如果 gateway 未运行，长连接设置可能无法保存。

![配置事件订阅](/images/feishu-step6-event-subscription.png)

### 7. 发布应用

1. 在 **版本管理与发布** 创建版本
2. 提交审核并发布
3. 等待管理员批准（企业应用通常自动批准）

---

## 步骤 2：配置 OpenClaw

### 使用向导配置（推荐）

```bash
openclaw channels add
```

选择 **Feishu** 并粘贴你的 App ID + App Secret。

### 通过配置文件配置

编辑 `~/.openclaw/openclaw.json`：

```json5
{
  channels: {
    feishu: {
      enabled: true,
      dmPolicy: "pairing",
      accounts: {
        main: {
          appId: "cli_xxx",
          appSecret: "xxx",
          name: "My AI assistant",
        },
      },
    },
  },
}
```

如果使用 `connectionMode: "webhook"`，设置 `verificationToken` 和 `encryptKey`。飞书 webhook 服务器默认绑定到 `127.0.0.1`；仅在你有意需要不同绑定地址时设置 `webhookHost`。

#### Verification Token 和 Encrypt Key（webhook 模式）

使用 webhook 模式时，在配置中设置 `channels.feishu.verificationToken` 和 `channels.feishu.encryptKey`。获取值：

1. 在飞书开放平台，打开你的应用
2. 前往 **开发配置** → **事件与回调**（Events & Callbacks）
3. 打开 **加密策略**（Encryption）标签页
4. 复制 **Verification Token** 和 **Encrypt Key**

下图显示 **Verification Token** 的位置。**Encrypt Key** 在同一 **加密策略** 部分列出。

![Verification Token 位置](/images/feishu-verification-token.png)

### 通过环境变量配置

```bash
export FEISHU_APP_ID="cli_xxx"
export FEISHU_APP_SECRET="xxx"
```

### Lark（国际）域名

如果你的租户在 Lark（国际），设置域名为 `lark`（或完整域名字符串）。可在 `channels.feishu.domain` 或按账号（`channels.feishu.accounts.<id>.domain`) 设置。

```json5
{
  channels: {
    feishu: {
      domain: "lark",
      accounts: {
        main: {
          appId: "cli_xxx",
          appSecret: "xxx",
        },
      },
    },
  },
}
```

### 配额优化标志

你可以用两个可选标志减少飞书 API 使用：

- `typingIndicator`（默认 `true`)：`false` 时跳过正在输入反应调用。
- `resolveSenderNames`（默认 `true`)：`false` 时跳过发送者资料查找调用。

在顶层或按账号设置：

```json5
{
  channels: {
    feishu: {
      typingIndicator: false,
      resolveSenderNames: false,
      accounts: {
        main: {
          appId: "cli_xxx",
          appSecret: "xxx",
          typingIndicator: true,
          resolveSenderNames: false,
        },
      },
    },
  },
}
```

---

## 步骤 3：启动 + 测试

### 1. 启动 gateway

```bash
openclaw gateway
```

### 2. 发送测试消息

在飞书中，找到你的机器人并发送消息。

### 3. 批准配对

默认情况下，机器人回复一个配对码。批准它：

```bash
openclaw pairing approve feishu <CODE>
```

批准后，你可以正常聊天。

---

## 概述

- **飞书机器人频道**：由 gateway 管理的飞书机器人
- **确定性路由**：回复总是返回飞书
- **Session 隔离**：私信共享主 session；群组隔离
- **WebSocket 连接**：通过飞书 SDK 长连接，无需公共 URL

---

## 访问控制

### 私信

- **默认**：`dmPolicy: "pairing"`（未知用户收到配对码）
- **批准配对**：

  ```bash
  openclaw pairing list feishu
  openclaw pairing approve feishu <CODE>
  ```

- **白名单模式**：设置 `channels.feishu.allowFrom` 为允许的 Open IDs

### 群组聊天

**1. 群组策略**（`channels.feishu.groupPolicy`)：

- `"open"` = 群组中允许所有人
- `"allowlist"` = 仅允许 `groupAllowFrom`
- `"disabled"` = 禁用群组消息

默认：`allowlist`

**2. 提及要求**（`channels.feishu.requireMention`，可通过 `channels.feishu.groups.<chat_id>.requireMention` 覆盖）：

- 显式 `true` = 需要 @mention
- 显式 `false` = 无需提及即可响应
- 未设置且 `groupPolicy: "open"` = 默认 `false`
- 未设置且 `groupPolicy` 不是 `"open"` = 默认 `true`

---

## 群组配置示例

### 允许所有群组，无需 @mention（开放群组默认）

```json5
{
  channels: {
    feishu: {
      groupPolicy: "open",
    },
  },
}
```

### 允许所有群组，但需要 @mention

```json5
{
  channels: {
    feishu: {
      groupPolicy: "open",
      requireMention: true,
    },
  },
}
```

### 仅允许特定群组

```json5
{
  channels: {
    feishu: {
      groupPolicy: "allowlist",
      // 飞书群组 IDs (chat_id) 格式如：oc_xxx
      groupAllowFrom: ["oc_xxx", "oc_yyy"],
    },
  },
}
```

### 限制群组中哪些发送者可以发消息（发送者白名单）

除允许群组本身外，该群组中的**所有消息**受发送者 open_id 门控：仅 `groups.<chat_id>.allowFrom` 中列出的用户消息被处理；其他成员消息被忽略（这是完整发送者级门控，不限于控制命令如 /reset 或 /new）。

```json5
{
  channels: {
    feishu: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["oc_xxx"],
      groups: {
        oc_xxx: {
          // 飞书用户 IDs (open_id) 格式如：ou_xxx
          allowFrom: ["ou_user1", "ou_user2"],
        },
      },
    },
  },
}
```

---

<a id="get-groupuser-ids"></a>

## 获取群组/用户 ID

### 群组 IDs (chat_id)

群组 IDs 格式如 `oc_xxx`。

**方法 1（推荐）**

1. 启动 gateway 并在群组中 @mention 机器人
2. 运行 `openclaw logs --follow` 并查找 `chat_id`

**方法 2**

使用飞书 API 调试器列出群组聊天。

### 用户 IDs (open_id)

用户 IDs 格式如 `ou_xxx`。

**方法 1（推荐）**

1. 启动 gateway 并私信机器人
2. 运行 `openclaw logs --follow` 并查找 `open_id`

**方法 2**

检查配对请求以获取用户 Open IDs：

```bash
openclaw pairing list feishu
```

---

## 常用命令

| 命令      | 描述           |
| --------- | -------------- |
| `/status` | 显示机器人状态 |
| `/reset`  | 重置 session   |
| `/model`  | 显示/切换模型  |

> 注意：飞书尚不支持原生命令菜单，命令必须以文本形式发送。

## Gateway 管理命令

| 令名                       | 描述                   |
| -------------------------- | ---------------------- |
| `openclaw gateway status`  | 显示 gateway 状态      |
| `openclaw gateway install` | 安装/启动 gateway 服务 |
| `openclaw gateway stop`    | 停止 gateway 服务      |
| `openclaw gateway restart` | 重启 gateway 服务      |
| `openclaw logs --follow`   | 跟踪 gateway 日志      |

---

## 故障排除

### 机器人在群组聊天中不响应

1. 确保机器人已添加到群组
2. 确保你 @mention 机器人（默认行为）
3. 检查 `groupPolicy` 未设置为 `"disabled"`
4. 检查日志：`openclaw logs --follow`

### 机器人不接收消息

1. 确保应用已发布并批准
2. 确保事件订阅包含 `im.message.receive_v1`
3. 确保**长连接**已启用
4. 确保应用权限完整
5. 确保 gateway 正在运行：`openclaw gateway status`
6. 检查日志：`openclaw logs --follow`

### App Secret 泄露

1. 在飞书开放平台重置 App Secret
2. 在配置中更新 App Secret
3. 重启 gateway

### 消息发送失败

1. 确保应用有 `im:message:send_as_bot` 权限
2. 确保应用已发布
3. 检查日志以获取详细错误

---

## 高级配置

### 多账号

```json5
{
  channels: {
    feishu: {
      defaultAccount: "main",
      accounts: {
        main: {
          appId: "cli_xxx",
          appSecret: "xxx",
          name: "Primary bot",
        },
        backup: {
          appId: "cli_yyy",
          appSecret: "yyy",
          name: "Backup bot",
          enabled: false,
        },
      },
    },
  },
}
```

`defaultAccount` 控制出站 API 未显式指定 `accountId` 时使用的飞书账号。

### 消息限制

- `textChunkLimit`：出站文本分块大小（默认：2000 字符）
- `mediaMaxMb`：媒体上传/下载限制（默认：30MB)

### 流式传输

飞书通过交互卡片支持流式回复。启用时，机器人生成文本时更新卡片。

```json5
{
  channels: {
    feishu: {
      streaming: true, // 启用流式卡片输出（默认 true)
      blockStreaming: true, // 启用分块级流式传输（默认 true)
    },
  },
}
```

设置 `streaming: false` 以等待完整回复后再发送。

### ACP sessions

飞书支持 ACP 用于：

- 私信
- 群组主题对话

飞书 ACP 是文本命令驱动的。没有原生斜杠命令菜单，所以直接在对话中使用 `/acp ...` 消息。

#### 持久 ACP 绑定

使用顶层类型 ACP 绑定将飞书私信或主题对话固定到持久 ACP session。

```json5
{
  agents: {
    list: [
      {
        id: "codex",
        runtime: {
          type: "acp",
          acp: {
            agent: "codex",
            backend: "acpx",
            mode: "persistent",
            cwd: "/workspace/openclaw",
          },
        },
      },
    ],
  },
  bindings: [
    {
      type: "acp",
      agentId: "codex",
      match: {
        channel: "feishu",
        accountId: "default",
        peer: { kind: "direct", id: "ou_1234567890" },
      },
    },
    {
      type: "acp",
      agentId: "codex",
      match: {
        channel: "feishu",
        accountId: "default",
        peer: { kind: "group", id: "oc_group_chat:topic:om_topic_root" },
      },
      acp: { label: "codex-feishu-topic" },
    },
  ],
}
```

#### 从聊天线程绑定 ACP spawn

在飞书私信或主题对话中，你可以原地生成并绑定 ACP session：

```text
/acp spawn codex --thread here
```

注意：

- `--thread here` 用于私信和飞书主题。
- 绑定私信/主题中的后续消息直接路由到该 ACP session。
- v1 不针对通用非主题群组聊天。

### 多 agent 路由

使用 `bindings` 将飞书私信或群组路由到不同 agent。

```json5
{
  agents: {
    list: [
      { id: "main" },
      {
        id: "clawd-fan",
        workspace: "/home/user/clawd-fan",
        agentDir: "/home/user/.openclaw/agents/clawd-fan/agent",
      },
      {
        id: "clawd-xi",
        workspace: "/home/user/clawd-xi",
        agentDir: "/home/user/.openclaw/agents/clawd-xi/agent",
      },
    ],
  },
  bindings: [
    {
      agentId: "main",
      match: {
        channel: "feishu",
        peer: { kind: "direct", id: "ou_xxx" },
      },
    },
    {
      agentId: "clawd-fan",
      match: {
        channel: "feishu",
        peer: { kind: "direct", id: "ou_yyy" },
      },
    },
    {
      agentId: "clawd-xi",
      match: {
        channel: "feishu",
        peer: { kind: "group", id: "oc_zzz" },
      },
    },
  ],
}
```

路由字段：

- `match.channel`：`"feishu"`
- `match.peer.kind`：`"direct"` 或 `"group"`
- `match.peer.id`：用户 Open ID（`ou_xxx`) 或群组 ID（`oc_xxx`)

请参阅 [获取群组/用户 IDs](#get-groupuser-ids) 了解查找技巧。

---

## 配置参考

完整配置：[Gateway 配置](/gateway/configuration)

关键选项：

| 设置                                              | 描述                          | 默认             |
| ------------------------------------------------- | ----------------------------- | ---------------- |
| `channels.feishu.enabled`                         | 启用/禁用频道                 | `true`           |
| `channels.feishu.domain`                          | API 域名（`feishu` 或 `lark`) | `feishu`         |
| `channels.feishu.connectionMode`                  | 事件传输模式                  | `websocket`      |
| `channels.feishu.defaultAccount`                  | 出站路由默认账号 ID           | `default`        |
| `channels.feishu.verificationToken`               | webhook 模式必需              | -                |
| `channels.feishu.encryptKey`                      | webhook 模式必需              | -                |
| `channels.feishu.webhookPath`                     | Webhook 路由路径              | `/feishu/events` |
| `channels.feishu.webhookHost`                     | Webhook 绑定主机              | `127.0.0.1`      |
| `channels.feishu.webhookPort`                     | Webhook 绑定端口              | `3000`           |
| `channels.feishu.accounts.<id>.appId`             | App ID                        | -                |
| `channels.feishu.accounts.<id>.appSecret`         | App Secret                    | -                |
| `channels.feishu.accounts.<id>.domain`            | 按账号 API 域名覆盖           | `feishu`         |
| `channels.feishu.dmPolicy`                        | 私信策略                      | `pairing`        |
| `channels.feishu.allowFrom`                       | 私信白名单（open_id 列表）    | -                |
| `channels.feishu.groupPolicy`                     | 群组策略                      | `allowlist`      |
| `channels.feishu.groupAllowFrom`                  | 群组白名单                    | -                |
| `channels.feishu.requireMention`                  | 默认需要 @mention             | 条件性           |
| `channels.feishu.groups.<chat_id>.requireMention` | 按群组需要 @mention 覆盖      | 继承             |
| `channels.feishu.groups.<chat_id>.enabled`        | 启用群组                      | `true`           |
| `channels.feishu.textChunkLimit`                  | 消息分块大小                  | `2000`           |
| `channels.feishu.mediaMaxMb`                      | 媒体大小限制                  | `30`             |
| `channels.feishu.streaming`                       | 启用流式卡片输出              | `true`           |
| `channels.feishu.blockStreaming`                  | 启用分块流式传输              | `true`           |

---

## dmPolicy 参考

| 值            | 行为                                      |
| ------------- | ----------------------------------------- |
| `"pairing"`   | **默认。** 未知用户收到配对码；必须批准   |
| `"allowlist"` | 仅 `allowFrom` 中用户可聊天               |
| `"open"`      | 允许所有用户（需要 allowFrom 中有 `"*"`） |
| `"disabled"`  | 禁用私信                                  |

---

## 支持的消息类型

### 接收

- ✅ 文本
- ✅ 富文本（post)
- ✅ 图片
- ✅ 文件
- ✅ 音频
- ✅ 视频/媒体
- ✅ 贴纸

### 发送

- ✅ 文本
- ✅ 图片
- ✅ 文件
- ✅ 音频
- ✅ 视频/媒体
- ✅ 交互卡片
- ⚠️ 富文本（post 格式和卡片，不是任意飞书创作功能）

### 线程和回复

- ✅ 内联回复
- ✅ 飞书暴露 `reply_in_thread` 的主题线程回复
- ✅ 回复线程/主题消息时媒体回复保持线程感知

## 云文档评论

飞书可以在有人在飞书云文档（文档、表格等）上添加评论时触发 agent。Agent 接收评论文本、文档上下文和评论线程，以便它可以在线程内回复或编辑文档。

要求：

- 在飞书应用事件订阅设置中订阅 `drive.notice.comment_add_v1`
  （与现有 `im.message.receive_v1` 并列）
- Drive 工具默认启用；用 `channels.feishu.tools.drive: false` 禁用

`feishu_drive` 工具暴露这些评论操作：

| 操作                   | 描述                 |
| ---------------------- | -------------------- |
| `list_comments`        | 列出文档上的评论     |
| `list_comment_replies` | 列出评论线程中的回复 |
| `add_comment`          | 添加新顶层评论       |
| `reply_comment`        | 回复现有评论线程     |

当 agent 处理云文档评论事件时，它接收：

- 评论文本和发送者
- 文档元数据（标题、类型、URL)
- 评论线程上下文用于线程内回复

编辑文档后，agent 被引导使用 `feishu_drive.reply_comment` 通知评论者，然后输出 `NO_REPLY` 以避免重复发送。

## 运行时操作面

飞书目前暴露这些运行时操作：

- `send`
- `read`
- `edit`
- `thread-reply`
- `pin`
- `list-pins`
- `unpin`
- `member-info`
- `channel-info`
- `channel-list`
- 配置中启用表情反应时的 `react` 和 `reactions`
- `feishu_drive` 评论操作：`list_comments`、`list_comment_replies`、`add_comment`、`reply_comment`

## 相关内容

- [频道概览](/channels) — 所有支持的频道
- [配对](/channels/pairing) — 私信认证和配对流程
- [群组](/channels/groups) — 群组聊天行为和提及门控
- [频道路由](/channels/channel-routing) — 消息的 session 路由
- [安全](/gateway/security) — 访问模型和加固
