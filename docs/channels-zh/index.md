---
summary: "Messaging platforms OpenClaw can connect to"
read_when:
  - You want to choose a chat channel for OpenClaw
  - You need a quick overview of supported messaging platforms
title: "Chat Channels"
---

# 聊天频道

OpenClaw 可以在你已使用的任何聊天应用中与你对话。每个频道都通过 Gateway 连接。
文本在所有平台都受支持；媒体和表情反应因频道而异。

## 支持的频道

- [BlueBubbles](/channels/bluebubbles) — **iMessage 推荐**；使用 BlueBubbles macOS 服务器 REST API，功能完整支持（编辑、撤回、特效、表情反应、群组管理 — 编辑功能在 macOS 26 Tahoe 上目前无法使用）。
- [Discord](/channels/discord) — Discord Bot API + Gateway；支持服务器、频道和私信。
- [Feishu](/channels/feishu) — 飞书/Lark 机器人，通过 WebSocket（插件，需单独安装）。
- [Google Chat](/channels/googlechat) — Google Chat API 应用，通过 HTTP webhook。
- [iMessage (legacy)](/channels/imessage) — 旧版 macOS 集成，通过 imsg CLI（已弃用，新安装请使用 BlueBubbles）。
- [IRC](/channels/irc) — 经典 IRC 服务器；频道 + 私信，支持配对/白名单控制。
- [LINE](/channels/line) — LINE Messaging API 机器人（插件，需单独安装）。
- [Matrix](/channels/matrix) — Matrix 协议（插件，需单独安装）。
- [Mattermost](/channels/mattermost) — Bot API + WebSocket；频道、群组、私信（插件，需单独安装）。
- [Microsoft Teams](/channels/msteams) — Bot Framework；企业支持（插件，需单独安装）。
- [Nextcloud Talk](/channels/nextcloud-talk) — 通过 Nextcloud Talk 的自托管聊天（插件，需单独安装）。
- [Nostr](/channels/nostr) — 通过 NIP-04 的去中心化私信（插件，需单独安装）。
- [QQ Bot](/channels/qqbot) — QQ Bot API；私聊、群聊和富媒体。
- [Signal](/channels/signal) — signal-cli；注重隐私。
- [Slack](/channels/slack) — Bolt SDK；工作区应用。
- [Synology Chat](/channels/synology-chat) — Synology NAS Chat，通过 outgoing+incoming webhooks（插件，需单独安装）。
- [Telegram](/channels/telegram) — Bot API，通过 grammY；支持群组。
- [Tlon](/channels/tlon) — 基于 Urbit 的 messenger（插件，需单独安装）。
- [Twitch](/channels/twitch) — Twitch 聊天，通过 IRC 连接（插件，需单独安装）。
- [Voice Call](/plugins/voice-call) — 通过 Plivo 或 Twilio 的电话功能（插件，需单独安装）。
- [WebChat](/web/webchat) — Gateway WebChat UI，通过 WebSocket。
- [WeChat](https://www.npmjs.com/package/@tencent-weixin/openclaw-weixin) — 腾讯 iLink Bot 插件，通过扫码登录；仅支持私聊。
- [WhatsApp](/channels/whatsapp) — 最受欢迎；使用 Baileys，需要扫码配对。
- [Zalo](/channels/zalo) — Zalo Bot API；越南流行的 messenger（插件，需单独安装）。
- [Zalo Personal](/channels/zalouser) — Zalo 个人账号，通过扫码登录（插件，需单独安装）。

## 注意事项

- 多个频道可同时运行；配置多个频道后，OpenClaw 会根据聊天内容自动路由。
- 最快的安装方式通常是 **Telegram**（只需简单的 bot token）。WhatsApp 需要扫码配对，并在磁盘上存储更多状态。
- 群组行为因频道而异；请参阅 [群组](/channels/groups)。
- 私信配对和白名单为确保安全而强制执行；请参阅 [安全](/gateway/security)。
- 故障排除：[频道故障排除](/channels/troubleshooting)。
- 模型提供者单独记录；请参阅 [模型提供者](/providers/models)。
