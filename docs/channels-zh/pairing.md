---
summary: "配对概览：批准谁可以私信你 + 哪些节点可以加入"
read_when:
  - 设置私信访问控制
  - 配对新的 iOS/Android 节点
  - 查看 OpenClaw 安全态势
title: "配对"
---

# 配对

"配对"是 OpenClaw 的显式**所有者批准**步骤。
它在两个地方使用：

1. **私信配对**（谁被允许与 bot 交流）
2. **节点配对**（哪些设备/节点被允许加入 gateway 网络）

安全上下文：[Security](/gateway/security)

## 1) 私信配对（入站聊天访问）

当频道配置私信策略为 `pairing` 时，未知发送者获得短码，其消息在你批准前**不被处理**。

默认私信策略见：[Security](/gateway/security)

配对码：

- 8 字符，大写，无歧义字符（`0O1I`）。
- **1 小时后过期**。Bot 仅在创建新请求时发送配对消息（约每小时每个发送者一次）。
- 待处理私信配对请求默认上限为**每频道 3 个**；额外请求在被忽略直到一个过期或批准。

### 批准发送者

```bash
openclaw pairing list telegram
openclaw pairing approve telegram <CODE>
```

支持的频道：`bluebubbles`、`discord`、`feishu`、`googlechat`、`imessage`、`irc`、`line`、`matrix`、`mattermost`、`msteams`、`nextcloud-talk`、`nostr`、`openclaw-weixin`、`signal`、`slack`、`synology-chat`、`telegram`、`twitch`、`whatsapp`、`zalo`、`zalouser`。

### 状态存储位置

存储在 `~/.openclaw/credentials/` 下：

- 待处理请求：`<channel>-pairing.json`
- 已批准白名单存储：
  - 默认账户：`<channel>-allowFrom.json`
  - 非默认账户：`<channel>-<accountId>-allowFrom.json`

账户范围行为：

- 非默认账户仅读写其范围白名单文件。
- 默认账户使用频道范围的无范围白名单文件。

将这些视为敏感（它们控制对你的 assistant 的访问）。

重要：此存储用于私信访问。群组授权是分开的。
批准私信配对码不会自动允许该发送者在群组中运行群组命令或控制 bot。对于群组访问，配置频道的显式群组白名单（例如 `groupAllowFrom`、`groups` 或每群组/每主题覆盖，取决于频道）。

## 2) 节点设备配对（iOS/Android/macOS/headless 节点）

节点作为带 `role: node` 的**设备**连接到 Gateway。Gateway 创建必须批准的设备配对请求。

### 通过 Telegram 配对（iOS 推荐）

如果你使用 `device-pair` 插件，可完全从 Telegram 进行首次设备配对：

1. 在 Telegram 中，向你的 bot 发送消息：`/pair`
2. Bot 回复两条消息：一条指导消息和一条单独的**设置码**消息（易于在 Telegram 中复制/粘贴）。
3. 在手机上，打开 OpenClaw iOS app → Settings → Gateway。
4. 粘贴设置码并连接。
5. 回到 Telegram：`/pair pending`（查看请求 ID、role 和 scopes），然后批准。

设置码是 base64 编码的 JSON 载荷，包含：

- `url`：Gateway WebSocket URL（`ws://...` 或 `wss://...`)
- `bootstrapToken`：用于初始配对握手的短期单设备 bootstrap 令牌

在有效期间将设置码视为密码。

### 批准节点设备

```bash
openclaw devices list
openclaw devices approve <requestId>
openclaw devices reject <requestId>
```

如果相同设备用不同认证详情重试（例如不同 role/scopes/公钥），之前待处理请求被取代，新 `requestId` 被创建。

### 节点配对状态存储

存储在 `~/.openclaw/devices/` 下：

- `pending.json`（短期；待处理请求过期）
- `paired.json`（已配对设备 + 令牌）

### 注意事项

- 遗留 `node.pair.*` API（CLI：`openclaw nodes pending|approve|reject|rename`) 是单独 gateway-owned 配对存储。WS 节点仍需要设备配对。
- 配对记录是已批准角色的持久真实来源。活动设备令牌保持限制在该已批准角色集；超出已批准角色的孤立令牌条目不创建新访问。

## 相关文档

- 安全模型 + 提示注入：[Security](/gateway/security)
- 安全更新（运行 doctor）：[Updating](/install/updating)
- 频道配置：
  - Telegram：[Telegram](/channels/telegram)
  - WhatsApp：[WhatsApp](/channels/whatsapp)
  - Signal：[Signal](/channels/signal)
  - BlueBubbles (iMessage)：[BlueBubbles](/channels/bluebubbles)
  - iMessage（遗留）：[iMessage](/channels/imessage)
  - Discord：[Discord](/channels/discord)
  - Slack：[Slack](/channels/slack)
