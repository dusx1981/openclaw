---
summary: "Nextcloud Talk 支持状态、能力和配置"
read_when:
  - 正在开发 Nextcloud Talk 频道功能
title: "Nextcloud Talk"
---

# Nextcloud Talk (plugin)

状态：通过插件支持（webhook bot）。私信、房间、反应和 markdown 消息均受支持。

## 需要插件

Nextcloud Talk 作为插件提供，不随核心安装捆绑。

通过 CLI 安装（npm registry）：

```bash
openclaw plugins install @openclaw/nextcloud-talk
```

本地检出（从 git 仓库运行时）：

```bash
openclaw plugins install ./path/to/local/nextcloud-talk-plugin
```

如果你在设置期间选择 Nextcloud Talk 且检测到 git 检出，
OpenClaw 会自动提供本地安装路径。

详情：[Plugins](/tools/plugin)

## 快速设置（新手）

1. 安装 Nextcloud Talk 插件。
2. 在你的 Nextcloud 服务器上，创建 bot：

   ```bash
   ./occ talk:bot:install "OpenClaw" "<shared-secret>" "<webhook-url>" --feature reaction
   ```

3. 在目标房间设置中启用 bot。
4. 配置 OpenClaw：
   - 配置：`channels.nextcloud-talk.baseUrl` + `channels.nextcloud-talk.botSecret`
   - 或环境变量：`NEXTCLOUD_TALK_BOT_SECRET`（仅默认账户）
5. 重启 gateway（或完成设置）。

最小配置：

```json5
{
  channels: {
    "nextcloud-talk": {
      enabled: true,
      baseUrl: "https://cloud.example.com",
      botSecret: "shared-secret",
      dmPolicy: "pairing",
    },
  },
}
```

## 注意事项

- Bot 无法发起私信。用户必须先消息 bot。
- Webhook URL 必须对 Gateway 可达；如果在代理后设置 `webhookPublicUrl`。
- 媒体上传不受 bot API 支持；媒体作为 URL 发送。
- Webhook 载荷不区分私信 vs 房间；设置 `apiUser` + `apiPassword` 启用房间类型查找（否则私信被视为房间）。

## 访问控制（私信）

- 默认：`channels.nextcloud-talk.dmPolicy = "pairing"`。未知发送者获得配对码。
- 批准通过：
  - `openclaw pairing list nextcloud-talk`
  - `openclaw pairing approve nextcloud-talk <CODE>`
- 公开私信：`channels.nextcloud-talk.dmPolicy="open"` 加 `channels.nextcloud-talk.allowFrom=["*"]`。
- `allowFrom` 仅匹配 Nextcloud 用户 ID；display name 被忽略。

## 房间（群组）

- 默认：`channels.nextcloud-talk.groupPolicy = "allowlist"`（提及触发）。
- 用 `channels.nextcloud-talk.rooms` 白名单房间：

```json5
{
  channels: {
    "nextcloud-talk": {
      rooms: {
        "room-token": { requireMention: true },
      },
    },
  },
}
```

- 要允许无房间，保持白名单空或设置 `channels.nextcloud-talk.groupPolicy="disabled"`。

## 能力

| 功能     | 状态          |
| -------- | ------------- |
| 私信     | Supported     |
| 房间     | Supported     |
| 线程     | Not supported |
| 媒体     | URL-only      |
| 反应     | Supported     |
| 原生命令 | Not supported |

## 配置参考（Nextcloud Talk）

完整配置：[Configuration](/gateway/configuration)

Provider 选项：

- `channels.nextcloud-talk.enabled`：启用/禁用频道启动。
- `channels.nextcloud-talk.baseUrl`：Nextcloud 实例 URL。
- `channels.nextcloud-talk.botSecret`：bot 共享秘密。
- `channels.nextcloud-talk.botSecretFile`：常规文件秘密路径。符号链接被拒绝。
- `channels.nextcloud-talk.apiUser`：用于房间查找的 API 用户（私信检测）。
- `channels.nextcloud-talk.apiPassword`：用于房间查找的 API/app 密码。
- `channels.nextcloud-talk.apiPasswordFile`：API 密码文件路径。
- `channels.nextcloud-talk.webhookPort`：webhook 监听端口（默认：8788）。
- `channels.nextcloud-talk.webhookHost`：webhook 主机（默认：0.0.0.0）。
- `channels.nextcloud-talk.webhookPath`：webhook 路径（默认：/nextcloud-talk-webhook）。
- `channels.nextcloud-talk.webhookPublicUrl`：外部可达 webhook URL。
- `channels.nextcloud-talk.dmPolicy`：`pairing | allowlist | open | disabled`。
- `channels.nextcloud-talk.allowFrom`：私信白名单（用户 ID）。`open` 需要 `"*"`。
- `channels.nextcloud-talk.groupPolicy`：`allowlist | open | disabled`。
- `channels.nextcloud-talk.groupAllowFrom`：群组白名单（用户 ID）。
- `channels.nextcloud-talk.rooms`：每房间设置和白名单。
- `channels.nextcloud-talk.historyLimit`：群组历史限制（0 禁用）。
- `channels.nextcloud-talk.dmHistoryLimit`：私信历史限制（0 禁用）。
- `channels.nextcloud-talk.dms`：每私信覆盖（historyLimit）。
- `channels.nextcloud-talk.textChunkLimit`：出站文本分块大小（字符）。
- `channels.nextcloud-talk.chunkMode`：`length`（默认）或 `newline` 在长度分块前按空行（段落边界）分割。
- `channels.nextcloud-talk.blockStreaming`：禁用此频道的块流式。
- `channels.nextcloud-talk.blockStreamingCoalesce`：块流式合并调整。
- `channels.nextcloud-talk.mediaMaxMb`：入站媒体上限（MB）。

## 相关文档

- [频道概览](/channels) — 所有支持的频道
- [配对](/channels/pairing) — 私信认证和配对流程
- [群组](/channels/groups) — 群聊行为和提及触发
- [频道路由](/channels/channel-routing) — 消息的会话路由
- [安全](/gateway/security) — 访问模型和加固
