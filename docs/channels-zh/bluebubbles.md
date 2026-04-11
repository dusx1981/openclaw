---
summary: "iMessage via BlueBubbles macOS server (REST send/receive, typing, reactions, pairing, advanced actions)."
read_when:
  - Setting up BlueBubbles channel
  - Troubleshooting webhook pairing
  - Configuring iMessage on macOS
title: "BlueBubbles"
---

# BlueBubbles (macOS REST)

状态：内置插件，通过 HTTP 与 BlueBubbles macOS 服务器通信。**推荐用于 iMessage 集成**，因为其 API 更丰富，设置比旧版 imsg 频道更简单。

## 概述

- 通过 BlueBubbles 辅助应用在 macOS 上运行 ([bluebubbles.app](https://bluebubbles.app))。
- 推荐/测试：macOS Sequoia (15)。macOS Tahoe (26) 可正常工作；编辑功能在 Tahoe 上目前无法使用，群组图标更新可能报告成功但无法同步。
- OpenClaw 通过其 REST API 与其通信 (`GET /api/v1/ping`, `POST /message/text`, `POST /chat/:id/*`)。
- 收到的消息通过 webhooks 接收；发出的回复、正在输入指示、已读回执和 tapback 都是通过 REST 调用。
- 附件和贴纸作为入站媒体被处理（并在可能的情况下提供给 agent）。
- 配对/白名单的工作方式与其他频道相同 (`/channels/pairing` 等)，使用 `channels.bluebubbles.allowFrom` + 配对码。
- 表情反应作为系统事件呈现，就像 Slack/Telegram 一样，所以 agent 可以在回复前"提及"它们。
- 高级功能：编辑、撤回、回复线程、消息特效、群组管理。

## 快速开始

1. 在你的 Mac 上安装 BlueBubbles 服务器（按照 [bluebubbles.app/install](https://bluebubbles.app/install) 的说明操作）。
2. 在 BlueBubbles 配置中，启用 web API 并设置密码。
3. 运行 `openclaw onboard` 并选择 BlueBubbles，或手动配置：

   ```json5
   {
     channels: {
       bluebubbles: {
         enabled: true,
         serverUrl: "http://192.168.1.100:1234",
         password: "example-password",
         webhookPath: "/bluebubbles-webhook",
       },
     },
   }
   ```

4. 将 BlueBubbles webhooks 指向你的 gateway（例如：`https://your-gateway-host:3000/bluebubbles-webhook?password=<password>`）。
5. 启动 gateway；它会注册 webhook 处理器并开始配对。

安全提示：

- 始终设置 webhook 密码。
- Webhook 认证始终必需。除非请求包含与 `channels.bluebubbles.password` 匹配的密码/guid（例如 `?password=<password>` 或 `x-password`），OpenClaw 会拒绝 BlueBubbles webhook 请求，无论本地/代理拓扑如何。
- 密码认证在读取/解析完整 webhook 内容之前检查。

## 保持 Messages.app 活跃（VM / 无头设置）

某些 macOS VM / 常驻设置可能导致 Messages.app 进入"空闲"状态（收到的消息事件会停止，直到打开/前台显示应用）。一个简单的解决方法是**每 5 分钟唤醒 Messages**，使用 AppleScript + LaunchAgent。

### 1) 保存 AppleScript

保存为：

- `~/Scripts/poke-messages.scpt`

示例脚本（非交互式；不会抢占焦点）：

```applescript
try
  tell application "Messages"
    if not running then
      launch
    end if

    -- Touch the scripting interface to keep the process responsive.
    set _chatCount to (count of chats)
  end tell
on error
  -- Ignore transient failures (first-run prompts, locked session, etc).
end try
```

### 2) 安装 LaunchAgent

保存为：

- `~/Library/LaunchAgents/com.user.poke-messages.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.user.poke-messages</string>

    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>-lc</string>
      <string>/usr/bin/osascript &quot;$HOME/Scripts/poke-messages.scpt&quot;</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>StartInterval</key>
    <integer>300</integer>

    <key>StandardOutPath</key>
    <string>/tmp/poke-messages.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/poke-messages.err</string>
  </dict>
</plist>
```

注意事项：

- 这会**每 300 秒**运行一次，并在**登录时**运行。
- 第一次运行可能会触发 macOS **Automation** 提示（`osascript` → Messages）。在运行 LaunchAgent 的同一用户会话中批准它们。

加载它：

```bash
launchctl unload ~/Library/LaunchAgents/com.user.poke-messages.plist 2>/dev/null || true
launchctl load ~/Library/LaunchAgents/com.user.poke-messages.plist
```

## 入门引导

BlueBubbles 在交互式入门引导中可用：

```
openclaw onboard
```

向导会提示：

- **Server URL**（必填）：BlueBubbles 服务器地址（例如 `http://192.168.1.100:1234`）
- **Password**（必填）：来自 BlueBubbles Server 设置的 API 密码
- **Webhook path**（可选）：默认为 `/bluebubbles-webhook`
- **DM policy**：pairing、allowlist、open 或 disabled
- **Allow list**：电话号码、邮箱或聊天目标

你也可以通过 CLI 添加 BlueBubbles：

```
openclaw channels add bluebubbles --http-url http://192.168.1.100:1234 --password <password>
```

## 访问控制（私信 + 群组）

私信：

- 默认：`channels.bluebubbles.dmPolicy = "pairing"`。
- 未知发送者会收到配对码；消息在批准前被忽略（配对码 1 小时后过期）。
- 批准方式：
  - `openclaw pairing list bluebubbles`
  - `openclaw pairing approve bluebubbles <CODE>`
- 配对是默认的令牌交换。详情：[配对](/channels/pairing)

群组：

- `channels.bluebubbles.groupPolicy = open | allowlist | disabled`（默认：`allowlist`）。
- `channels.bluebubbles.groupAllowFrom` 控制当 `allowlist` 设置时谁可以在群组中触发消息。

### 联系人名称增强（macOS，可选）

BlueBubbles 群组 webhooks 通常只包含原始参与者地址。如果你想让 `GroupMembers` 上下文显示本地联系人名称而不是原始地址，可以在 macOS 上启用本地 Contacts 增强：

- `channels.bluebubbles.enrichGroupParticipantsFromContacts = true` 启用查找。默认：`false`。
- 查找仅在群组访问、命令授权和提及门控允许消息通过后运行。
- 仅增强未命名的电话参与者。
- 未找到本地匹配时，原始电话号码仍作为备用。

```json5
{
  channels: {
    bluebubbles: {
      enrichGroupParticipantsFromContacts: true,
    },
  },
}
```

### 提及门控（群组）

BlueBubbles 支持群组聊天的提及门控，与 iMessage/WhatsApp 行为匹配：

- 使用 `agents.list[].groupChat.mentionPatterns`（或 `messages.groupChat.mentionPatterns`）检测提及。
- 当群组启用 `requireMention` 时，agent 仅在被提及时响应。
- 来自授权发送者的控制命令可绕过提及门控。

按群组配置：

```json5
{
  channels: {
    bluebubbles: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["+15555550123"],
      groups: {
        "*": { requireMention: true }, // default for all groups
        "iMessage;-;chat123": { requireMention: false }, // override for specific group
      },
    },
  },
}
```

### 命令门控

- 控制命令（如 `/config`、`/model`）需要授权。
- 使用 `allowFrom` 和 `groupAllowFrom` 确定命令授权。
- 授权发送者可以在群组中运行控制命令，无需提及。

## ACP 对话绑定

BlueBubbles 聊天可以转换为持久的 ACP workspace，无需更改传输层。

快速操作流程：

- 在私信或允许的群组聊天中运行 `/acp spawn codex --bind here`。
- 该 BlueBubbles 对话中的后续消息会路由到生成的 ACP session。
- `/new` 和 `/reset` 会原地重置同一个绑定的 ACP session。
- `/acp close` 关闭 ACP session 并移除绑定。

通过顶层 `bindings[]` 条目配置持久绑定，使用 `type: "acp"` 和 `match.channel: "bluebubbles"`。

`match.peer.id` 可以使用任何支持的 BlueBubbles 目标格式：

- 规范化的私信 handle，如 `+15555550123` 或 `user@example.com`
- `chat_id:<id>`
- `chat_guid:<guid>`
- `chat_identifier:<identifier>`

对于稳定的群组绑定，建议使用 `chat_id:*` 或 `chat_identifier:*`。

示例：

```json5
{
  agents: {
    list: [
      {
        id: "codex",
        runtime: {
          type: "acp",
          acp: { agent: "codex", backend: "acpx", mode: "persistent" },
        },
      },
    ],
  },
  bindings: [
    {
      type: "acp",
      agentId: "codex",
      match: {
        channel: "bluebubbles",
        accountId: "default",
        peer: { kind: "dm", id: "+15555550123" },
      },
      acp: { label: "codex-imessage" },
    },
  ],
}
```

请参阅 [ACP Agents](/tools/acp-agents) 了解共享的 ACP 绑定行为。

## 正在输入 + 已读回执

- **正在输入指示**：在响应生成之前和期间自动发送。
- **已读回执**：由 `channels.bluebubbles.sendReadReceipts` 控制（默认：`true`）。
- **正在输入指示**：OpenClaw 发送正在输入开始事件；BlueBubbles 在发送或超时时自动清除正在输入状态（通过 DELETE 手动停止不可靠）。

```json5
{
  channels: {
    bluebubbles: {
      sendReadReceipts: false, // disable read receipts
    },
  },
}
```

## 高级操作

BlueBubbles 在配置中启用后支持高级消息操作：

```json5
{
  channels: {
    bluebubbles: {
      actions: {
        reactions: true, // tapbacks (default: true)
        edit: true, // edit sent messages (macOS 13+, broken on macOS 26 Tahoe)
        unsend: true, // unsend messages (macOS 13+)
        reply: true, // reply threading by message GUID
        sendWithEffect: true, // message effects (slam, loud, etc.)
        renameGroup: true, // rename group chats
        setGroupIcon: true, // set group chat icon/photo (flaky on macOS 26 Tahoe)
        addParticipant: true, // add participants to groups
        removeParticipant: true, // remove participants from groups
        leaveGroup: true, // leave group chats
        sendAttachment: true, // send attachments/media
      },
    },
  },
}
```

可用操作：

- **react**：添加/删除 tapback 表情反应（`messageId`、`emoji`、`remove`)
- **edit**：编辑已发送的消息（`messageId`、`text`)
- **unsend**：撤回消息（`messageId`)
- **reply**：回复特定消息（`messageId`、`text`、`to`)
- **sendWithEffect**：使用 iMessage 特效发送（`text`、`to`、`effectId`)
- **renameGroup**：重命名群组聊天（`chatGuid`、`displayName`)
- **setGroupIcon**：设置群组聊天的图标/照片（`chatGuid`、`media`) — 在 macOS 26 Tahoe 上不稳定（API 可能返回成功但图标无法同步）。
- **addParticipant**：将某人添加到群组（`chatGuid`、`address`)
- **removeParticipant**：从群组中移除某人（`chatGuid`、`address`)
- **leaveGroup**：离开群组聊天（`chatGuid`)
- **upload-file**：发送媒体/文件（`to`、`buffer`、`filename`、`asVoice`)
  - 语音备忘录：设置 `asVoice: true` 并使用 **MP3** 或 **CAF** 音频以 iMessage 语音消息形式发送。BlueBubbles 在发送语音备忘录时将 MP3 → CAF 转换。
- 旧别名：`sendAttachment` 仍可用，但 `upload-file` 是规范的 action 名称。

### 消息 ID（短 ID vs 完整 ID）

OpenClaw 可能向 agent 提供*短*消息 ID（如 `1`、`2`) 以节省 tokens。

- `MessageSid` / `ReplyToId` 可以是短 ID。
- `MessageSidFull` / `ReplyToIdFull` 包含提供者的完整 ID。
- 短 ID 是内存中的；重启或缓存清理后可能过期。
- 操作接受短或完整的 `messageId`，但如果短 ID 不再可用会报错。

对于持久自动化和存储，使用完整 ID：

- 模板：`{{MessageSidFull}}`、`{{ReplyToIdFull}}`
- 上下文：入站 payload 中的 `MessageSidFull` / `ReplyToIdFull`

请参阅 [配置](/gateway/configuration) 了解模板变量。

## 分块流式传输

控制响应是作为单条消息发送还是分块流式传输：

```json5
{
  channels: {
    bluebubbles: {
      blockStreaming: true, // enable block streaming (off by default)
    },
  },
}
```

## 媒体 + 限制

- 入站附件被下载并存储在媒体缓存中。
- 通过 `channels.bluebubbles.mediaMaxMb` 设置入站和出站媒体的媒体上限（默认：8 MB）。
- 出站文本按 `channels.bluebubbles.textChunkLimit` 分块（默认：4000 字符）。

## 配置参考

完整配置：[配置](/gateway/configuration)

提供者选项：

- `channels.bluebubbles.enabled`：启用/禁用频道。
- `channels.bluebubbles.serverUrl`：BlueBubbles REST API 基础 URL。
- `channels.bluebubbles.password`：API 密码。
- `channels.bluebubbles.webhookPath`：Webhook 端点路径（默认：`/bluebubbles-webhook`）。
- `channels.bluebubbles.dmPolicy`：`pairing | allowlist | open | disabled`（默认：`pairing`)。
- `channels.bluebubbles.allowFrom`：私信白名单（handles、邮箱、E.164 号码、`chat_id:*`、`chat_guid:*`）。
- `channels.bluebubbles.groupPolicy`：`open | allowlist | disabled`（默认：`allowlist`)。
- `channels.bluebubbles.groupAllowFrom`：群组发送者白名单。
- `channels.bluebubbles.enrichGroupParticipantsFromContacts`：在 macOS 上，可选地在门控通过后从本地 Contacts 增强未命名的群组参与者。默认：`false`。
- `channels.bluebubbles.groups`：按群组配置（`requireMention` 等）。
- `channels.bluebubbles.sendReadReceipts`：发送已读回执（默认：`true`)。
- `channels.bluebubbles.blockStreaming`：启用分块流式传输（默认：`false`；流式回复需要）。
- `channels.bluebubbles.textChunkLimit`：出站分块大小，以字符为单位（默认：4000)。
- `channels.bluebubbles.chunkMode`：`length`（默认）仅在超过 `textChunkLimit` 时分块；`newline` 在长度分块前按空行（段落边界）分块。
- `channels.bluebubbles.mediaMaxMb`：入站/出站媒体上限，以 MB 为单位（默认：8)。
- `channels.bluebubbles.mediaLocalRoots`：明确允许用于出站本地媒体路径的绝对本地目录白名单。默认情况下本地路径发送被拒绝，除非配置此项。按账号覆盖：`channels.bluebubbles.accounts.<accountId>.mediaLocalRoots`。
- `channels.bluebubbles.historyLimit`：群组消息上下文最大值（0 禁用）。
- `channels.bluebubbles.dmHistoryLimit`：私信历史记录限制。
- `channels.bluebubbles.actions`：启用/禁用特定操作。
- `channels.bluebubbles.accounts`：多账号配置。

相关全局选项：

- `agents.list[].groupChat.mentionPatterns`（或 `messages.groupChat.mentionPatterns`)。
- `messages.responsePrefix`。

## 寻址 / 发送目标

推荐使用 `chat_guid` 进行稳定路由：

- `chat_guid:iMessage;-;+15555550123`（群组推荐）
- `chat_id:123`
- `chat_identifier:...`
- 直接 handles：`+15555550123`、`user@example.com`
  - 如果直接 handle 没有现有的私信聊天，OpenClaw 会通过 `POST /api/v1/chat/new` 创建一个。这需要启用 BlueBubbles Private API。

## 安全

- Webhook 请求通过与 `channels.bluebubbles.password` 比较的 `guid`/`password` 查询参数或 headers 进行认证。来自 `localhost` 的请求也被接受。
- 保持 API 密码和 webhook 端点保密（像凭据一样对待）。
- 本地信任意味着同主机反向代理可能无意中绕过密码。如果你代理 gateway，在代理处要求认证并配置 `gateway.trustedProxies`。请参阅 [Gateway 安全](/gateway/security#reverse-proxy-configuration)。
- 如果在 LAN 外暴露 BlueBubbles 服务器，启用 HTTPS + 防火墙规则。

## 故障排除

- 如果正在输入/已读事件停止工作，检查 BlueBubbles webhook 日志并验证 gateway 路径与 `channels.bluebubbles.webhookPath` 匹配。
- 配对码一小时后过期；使用 `openclaw pairing list bluebubbles` 和 `openclaw pairing approve bluebubbles <code>`。
- 表情反应需要 BlueBubbles private API (`POST /api/v1/message/react`)；确保服务器版本暴露它。
- 编辑/撤回需要 macOS 13+ 和兼容的 BlueBubbles 服务器版本。在 macOS 26 (Tahoe) 上，编辑目前因 private API 变化而无法使用。
- 群组图标更新在 macOS 26 (Tahoe) 上可能不稳定：API 可能返回成功但新图标无法同步。
- OpenClaw 根据 BlueBubbles 服务器的 macOS 版本自动隐藏已知损坏的操作。如果编辑在 macOS 26 (Tahoe) 上仍然显示，手动禁用 `channels.bluebubbles.actions.edit=false`。
- 状态/健康信息：`openclaw status --all` 或 `openclaw status --deep`。

有关通用频道工作流程参考，请参阅 [频道](/channels) 和 [插件](/tools/plugin) 指南。

## 相关内容

- [频道概览](/channels) — 所有支持的频道
- [配对](/channels/pairing) — 私信认证和配对流程
- [群组](/channels/groups) — 群组聊天行为和提及门控
- [频道路由](/channels/channel-routing) — 消息的 session 路由
- [安全](/gateway/security) — 访问模型和加固
