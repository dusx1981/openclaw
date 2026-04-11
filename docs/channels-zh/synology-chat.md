---
summary: "Synology Chat webhook setup and OpenClaw config"
read_when:
  - Setting up Synology Chat with OpenClaw
  - Debugging Synology Chat webhook routing
title: "Synology Chat"
---

# Synology Chat（插件）

状态：通过插件支持，作为使用 Synology Chat webhook 的直接消息 channel。插件接受来自 Synology Chat outgoing webhook 的入站消息，并通过 Synology Chat incoming webhook 发送回复。

## 需要插件

Synology Chat 是基于插件的，不包含在默认核心 channel 安装中。

从本地检出安装：

```bash
openclaw plugins install ./path/to/local/synology-chat-plugin
```

详情：[Plugins](/tools/plugin)

## 快速设置

1. 安装并启用 Synology Chat 插件。
   - `openclaw onboard` 现在与 `openclaw channels add` 在同一 channel 设置列表中显示 Synology Chat。
   - 非交互式设置：`openclaw channels add --channel synology-chat --token <token> --url <incoming-webhook-url>`
2. 在 Synology Chat 集成中：
   - 创建 incoming webhook 并复制其 URL。
   - 用你的 secret token 创建 outgoing webhook。
3. 将 outgoing webhook URL 指向你的 OpenClaw Gateway：
   - 默认 `https://gateway-host/webhook/synology`。
   - 或你自定义的 `channels.synology-chat.webhookPath`。
4. 在 OpenClaw 中完成设置。
   - 指导式：`openclaw onboard`
   - 直接：`openclaw channels add --channel synology-chat --token <token> --url <incoming-webhook-url>`
5. 重启 Gateway 并向 Synology Chat bot 发送 DM。

Webhook auth 详情：

- OpenClaw 从 `body.token` 接受 outgoing webhook token，然后是 `?token=...`，然后是 headers。
- 接受的 header 格式：
  - `x-synology-token`
  - `x-webhook-token`
  - `x-openclaw-token`
  - `Authorization: Bearer <token>`
- 空或缺失 token 失败关闭。

最小配置：

```json5
{
  channels: {
    "synology-chat": {
      enabled: true,
      token: "synology-outgoing-token",
      incomingUrl: "https://nas.example.com/webapi/entry.cgi?api=SYNO.Chat.External&method=incoming&version=2&token=...",
      webhookPath: "/webhook/synology",
      dmPolicy: "allowlist",
      allowedUserIds: ["123456"],
      rateLimitPerMinute: 30,
      allowInsecureSsl: false,
    },
  },
}
```

## 环境变量

对于默认账号，可以使用环境变量：

- `SYNOLOGY_CHAT_TOKEN`
- `SYNOLOGY_CHAT_INCOMING_URL`
- `SYNOLOGY_NAS_HOST`
- `SYNOLOGY_ALLOWED_USER_IDS`（逗号分隔）
- `SYNOLOGY_RATE_LIMIT`
- `OPENCLAW_BOT_NAME`

配置值覆盖环境变量。

## DM 策略和访问控制

- `dmPolicy: "allowlist"` 是推荐的默认值。
- `allowedUserIds` 接受 Synology 用户 ID 列表（或逗号分隔字符串）。
- 在 `allowlist` 模式下，空 `allowedUserIds` 列表被视为配置错误，webhook 路径不会启动（使用 `dmPolicy: "open"` 表示允许所有）。
- `dmPolicy: "open"` 允许任何发送者。
- `dmPolicy: "disabled"` 阻止 DM。
- 回复接收者绑定默认使用稳定的数字 `user_id`。`channels.synology-chat.dangerouslyAllowNameMatching: true` 是 break-glass 兼容模式，重新启用可变 username/nickname 查找用于回复投递。
- 配对批准配合使用：
  - `openclaw pairing list synology-chat`
  - `openclaw pairing approve synology-chat <CODE>`

## 出站投递

使用数字 Synology Chat 用户 ID 作为目标。

示例：

```bash
openclaw message send --channel synology-chat --target 123456 --text "Hello from OpenClaw"
openclaw message send --channel synology-chat --target synology-chat:123456 --text "Hello again"
```

媒体发送支持 URL 基础文件投递。

## 多账号

`channels.synology-chat.accounts` 下支持多个 Synology Chat 账号。每个账号可以覆盖 token、incoming URL、webhook 路径、DM 策略和限制。直接消息 session 按账号和用户隔离，因此两个不同 Synology 账号上的相同数字 `user_id` 不共享 transcript 状态。为每个启用的账号设置不同的 `webhookPath`。OpenClaw 现在拒绝重复的精确路径，并拒绝在多账号设置中只继承共享 webhook 路径的命名账号。如果你有意需要命名账号的旧版继承，在该账号或 `channels.synology-chat` 设置 `dangerouslyAllowInheritedWebhookPath: true`，但重复的精确路径仍然失败关闭。推荐显式账号级别路径。

```json5
{
  channels: {
    "synology-chat": {
      enabled: true,
      accounts: {
        default: {
          token: "token-a",
          incomingUrl: "https://nas-a.example.com/...token=...",
        },
        alerts: {
          token: "token-b",
          incomingUrl: "https://nas-b.example.com/...token=...",
          webhookPath: "/webhook/synology-alerts",
          dmPolicy: "allowlist",
          allowedUserIds: ["987654"],
        },
      },
    },
  },
}
```

## 安全说明

- 保持 `token` 保密，泄露时轮换它。
- 保持 `allowInsecureSsl: false`，除非你明确信任自签名的本地 NAS 证书。
- 入站 webhook 请求经过 token 验证和按发送者速率限制。
- 无效 token 检查使用恒定时间 secret 比较且失败关闭。
- 生产环境推荐 `dmPolicy: "allowlist"`。
- 保持 `dangerouslyAllowNameMatching` 关闭，除非你明确需要旧版 username 基础回复投递。
- 保持 `dangerouslyAllowInheritedWebhookPath` 关闭，除非你在多账号设置中明确接受共享路径路由风险。

## 故障排除

- `Missing required fields (token, user_id, text)`:
  - outgoing webhook payload 缺失一个必需字段
  - 如果 Synology 在 headers 中发送 token，确保 gateway/proxy 保留这些 headers
- `Invalid token`:
  - outgoing webhook secret 不匹配 `channels.synology-chat.token`
  - 请求到达错误的账号/webhook 路径
  - 反向代理在请求到达 OpenClaw 前剥离了 token header
- `Rate limit exceeded`:
  - 来自同一源的太多无效 token 尝试可以暂时锁定该源
  - 认证发送者也有单独的每用户消息速率限制
- `Allowlist is empty. Configure allowedUserIds or use dmPolicy=open.`:
  - 启用了 `dmPolicy="allowlist"` 但未配置用户
- `User not authorized`:
  - 发送者的数字 `user_id` 不在 `allowedUserIds`

## 相关

- [Channels Overview](/channels) — 所有支持的 channels
- [Pairing](/channels/pairing) — DM 认证和配对流程
- [Groups](/channels/groups) — 群聊行为和提及门控
- [Channel Routing](/channels/channel-routing) — 消息的 session 路由
- [Security](/gateway/security) — 访问模型和安全加固
