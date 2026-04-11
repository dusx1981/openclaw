---
summary: "Slack setup and runtime behavior (Socket Mode + HTTP Events API)"
read_when:
  - Setting up Slack or debugging Slack socket/HTTP mode
title: "Slack"
---

# Slack

状态：通过 Slack app 集成的 DM + channels 生产就绪。默认模式是 Socket Mode；也支持 HTTP Events API 模式。

<CardGroup cols={3}>
  <Card title="配对" icon="link" href="/channels/pairing">
    Slack DM 默认为配对模式。
  </Card>
  <Card title="斜杠命令" icon="terminal" href="/tools/slash-commands">
    原生命令行为和命令目录。
  </Card>
  <Card title="Channel 故障排除" icon="wrench" href="/channels/troubleshooting">
    跨 channel 诊断和修复手册。
  </Card>
</CardGroup>

## 快速设置

<Tabs>
  <Tab title="Socket Mode（默认）">
    <Steps>
      <Step title="创建 Slack app 和 tokens">
        在 Slack app 设置中：

        - 启用 **Socket Mode**
        - 创建带有 `connections:write` 的 **App Token** (`xapp-...`)
        - 安装 app 并复制 **Bot Token** (`xoxb-...`)
      </Step>

      <Step title="配置 OpenClaw">

```json5
{
  channels: {
    slack: {
      enabled: true,
      mode: "socket",
      appToken: "xapp-...",
      botToken: "xoxb-...",
    },
  },
}
```

        环境变量回退（仅默认账号）：

```bash
SLACK_APP_TOKEN=xapp-...
SLACK_BOT_TOKEN=xoxb-...
```

      </Step>

      <Step title="订阅 app 事件">
        订阅 bot 事件：

        - `app_mention`
        - `message.channels`、`message.groups`、`message.im`、`message.mpim`
        - `reaction_added`、`reaction_removed`
        - `member_joined_channel`、`member_left_channel`
        - `channel_rename`
        - `pin_added`、`pin_removed`

        同时启用 App Home **Messages Tab** 用于 DM。
      </Step>

      <Step title="启动 Gateway">

```bash
openclaw gateway
```

      </Step>
    </Steps>

  </Tab>

  <Tab title="HTTP Events API 模式">
    <Steps>
      <Step title="为 HTTP 配置 Slack app">

        - 设置模式为 HTTP (`channels.slack.mode="http"`)
        - 复制 Slack **Signing Secret**
        - 将 Event Subscriptions + Interactivity + Slash command Request URL 设置为相同的 webhook 路径（默认 `/slack/events`）

      </Step>

      <Step title="配置 OpenClaw HTTP 模式">

```json5
{
  channels: {
    slack: {
      enabled: true,
      mode: "http",
      botToken: "xoxb-...",
      signingSecret: "your-signing-secret",
      webhookPath: "/slack/events",
    },
  },
}
```

      </Step>

      <Step title="多账号 HTTP 使用唯一 webhook 路径">
        支持账号级别 HTTP 模式。

        为每个账号设置不同的 `webhookPath` 以避免注册冲突。
      </Step>
    </Steps>

  </Tab>
</Tabs>

## Token 模型

- Socket Mode 需要 `botToken` + `appToken`。
- HTTP 模式需要 `botToken` + `signingSecret`。
- 配置 token 覆盖环境变量回退。
- `SLACK_BOT_TOKEN` / `SLACK_APP_TOKEN` 环境变量回退仅适用于默认账号。
- `userToken` (`xoxp-...`) 仅通过配置设置（无环境变量回退）且默认为只读行为 (`userTokenReadOnly: true`）。
- 可选：如果你想让出站消息使用活跃 agent 身份（自定义 `username` 和图标），添加 `chat:write.customize`。`icon_emoji` 使用 `:emoji_name:` 语法。

<Tip>
对于动作/目录读取，配置时可以优先使用 user token。对于写入，bot token 仍然是首选；只有当 `userTokenReadOnly: false` 且 bot token 不可用时才允许 user-token 写入。
</Tip>

## 访问控制和路由

<Tabs>
  <Tab title="DM 策略">
    `channels.slack.dmPolicy` 控制 DM 访问（旧版：`channels.slack.dm.policy`）：

    - `pairing`（默认）
    - `allowlist`
    - `open`（需要 `channels.slack.allowFrom` 包含 `"*"`；旧版：`channels.slack.dm.allowFrom`）
    - `disabled`

    DM 标志：

    - `dm.enabled`（默认 true）
    - `channels.slack.allowFrom`（推荐）
    - `dm.allowFrom`（旧版）
    - `dm.groupEnabled`（群组 DM 默认 false）
    - `dm.groupChannels`（可选 MPIM 白名单）

    多账号优先级：

    - `channels.slack.accounts.default.allowFrom` 仅适用于 `default` 账号。
    - 命名账号在自身 `allowFrom` 未设置时继承 `channels.slack.allowFrom`。
    - 命名账号不继承 `channels.slack.accounts.default.allowFrom`。

    DM 配对使用 `openclaw pairing approve slack <code>`。

  </Tab>

  <Tab title="Channel 策略">
    `channels.slack.groupPolicy` 控制 channel 处理：

    - `open`
    - `allowlist`
    - `disabled`

    Channel 白名单在 `channels.slack.channels` 下，应使用稳定的 channel ID。

    运行时注意：如果 `channels.slack` 完全缺失（仅环境变量设置），运行时回退到 `groupPolicy="allowlist"` 并记录警告（即使设置了 `channels.defaults.groupPolicy`）。

    名称/ID 解析：

    - channel 白名单条目和 DM 白名单条目在 token 访问允许时在启动时解析
    - 未解析的 channel-name 条目保留配置但默认被路由忽略
    - 入站授权和 channel 路由默认 ID 优先；直接 username/slug 匹配需要 `channels.slack.dangerouslyAllowNameMatching: true`

  </Tab>

  <Tab title="提及和 channel 用户">
    Channel 消息默认需要提及门控。

    提及来源：

    - 显式 app 提及 (`<@botId>`)
    - 提及正则模式（`agents.list[].groupChat.mentionPatterns`，回退 `messages.groupChat.mentionPatterns`）
    - 隐式回复 bot thread 行为

    Channel 级别控制（`channels.slack.channels.<id>`；名称仅通过启动解析或 `dangerouslyAllowNameMatching`）：

    - `requireMention`
    - `users`（白名单）
    - `allowBots`
    - `skills`
    - `systemPrompt`
    - `tools`、`toolsBySender`
    - `toolsBySender` 键格式：`id:`、`e164:`、`username:`、`name:` 或 `"*"` 通配符
      （旧版无前缀键仍然映射到 `id:`）

  </Tab>
</Tabs>

## 命令和斜杠行为

- 原生命令自动模式对 Slack **关闭**（`commands.native: "auto"` 不启用 Slack 原生命令）。
- 用 `channels.slack.commands.native: true`（或全局 `commands.native: true`）启用原生 Slack 命令处理器。
- 当启用原生命令时，在 Slack 注册匹配的斜杠命令（`/<command>` 名称），一个例外：
  - 为状态命令注册 `/agentstatus`（Slack 保留 `/status`）
- 如果未启用原生命令，可以通过 `channels.slack.slashCommand` 运行单个配置的斜杠命令。
- 原生参数菜单现在适应其渲染策略：
  - 最多 5 个选项：按钮块
  - 6-100 个选项：静态选择菜单
  - 超过 100 个选项：当有交互性选项处理器时使用带异步选项过滤的外部选择
  - 如果编码的选项值超过 Slack 限制，流程回退到按钮
- 对于长选项 payload，斜杠命令参数菜单在分发选定值前使用确认对话框。

默认斜杠命令设置：

- `enabled: false`
- `name: "openclaw"`
- `sessionPrefix: "slack:slash"`
- `ephemeral: true`

斜杠 session 使用隔离键：

- `agent:<agentId>:slack:slash:<userId>`

且仍然针对目标对话 session 路由命令执行（`CommandTargetSessionKey`）。

## 交互式回复

Slack 可以渲染 agent 编写的交互式回复控件，但此功能默认禁用。

全局启用：

```json5
{
  channels: {
    slack: {
      capabilities: {
        interactiveReplies: true,
      },
    },
  },
}
```

或仅为一个 Slack 账号启用：

```json5
{
  channels: {
    slack: {
      accounts: {
        ops: {
          capabilities: {
            interactiveReplies: true,
          },
        },
      },
    },
  },
}
```

启用后，agents 可以发送 Slack 专属回复指令：

- `[[slack_buttons: Approve:approve, Reject:reject]]`
- `[[slack_select: Choose a target | Canary:canary, Production:production]]`

这些指令编译为 Slack Block Kit，并通过现有 Slack 交互事件路径路由点击或选择。

注意：

- 这是 Slack 专属 UI。其他 channels 不将 Slack Block Kit 指令翻译为自己的按钮系统。
- 交互回调值是 OpenClaw 生成的 opaque token，不是原始 agent 编写的值。
- 如果生成的交互块超过 Slack Block Kit 限制，OpenClaw 回退到原始文本回复而不是发送无效 blocks payload。

## Thread、session 和回复标签

- DM 路由为 `direct`；channels 为 `channel`；MPIM 为 `group`。
- 使用默认 `session.dmScope=main`，Slack DM 折叠为 agent 主 session。
- Channel session：`agent:<agentId>:slack:channel:<channelId>`。
- Thread 回复可以创建 thread session 后缀（`:thread:<threadTs>`）当适用时。
- `channels.slack.thread.historyScope` 默认为 `thread`；`thread.inheritParent` 默认为 `false`。
- `channels.slack.thread.initialHistoryLimit` 控制新 thread session 启动时获取多少现有 thread 消息（默认 `20`；设为 `0` 禁用）。

回复 thread 控制：

- `channels.slack.replyToMode`: `off|first|all`（默认 `off`）
- `channels.slack.replyToModeByChatType`: 按 `direct|group|channel`
- 直接聊天旧版回退：`channels.slack.dm.replyToMode`

支持手动回复标签：

- `[[reply_to_current]]`
- `[[reply_to:<id>]]`

注意：`replyToMode="off"` 禁用 Slack 中**所有**回复 threading，包括显式 `[[reply_to_*]]` 标签。这与 Telegram 不同，后者显式标签在 `"off"` 模式下仍然被遵守。差异反映平台 threading 模型：Slack thread 隐藏消息于 channel，而 Telegram 回复在主聊天流中保持可见。

## 媒体、分块和投递

<AccordionGroup>
  <Accordion title="入站附件">
    Slack 文件附件从 Slack 托管的私有 URL 下载（token 认证请求流程），当获取成功且大小限制允许时写入媒体存储。

    运行时入站大小上限默认为 `20MB`，除非被 `channels.slack.mediaMaxMb` 覆盖。

  </Accordion>

  <Accordion title="出站文本和文件">
    - 文本分块使用 `channels.slack.textChunkLimit`（默认 4000）
    - `channels.slack.chunkMode="newline"` 启用段落优先分割
    - 文件发送使用 Slack 上传 API 且可包含 thread 回复（`thread_ts`）
    - 出站媒体上限遵循配置时的 `channels.slack.mediaMaxMb`；否则 channel 发送使用媒体管道的 MIME-kind 默认值
  </Accordion>

  <Accordion title="投递目标">
    推荐显式目标：

    - `user:<id>` 用于 DM
    - `channel:<id>` 用于 channels

    发送到用户目标时通过 Slack conversation API 打开 Slack DM。

  </Accordion>
</AccordionGroup>

## 动作和门控

Slack 动作由 `channels.slack.actions.*` 控制。

当前 Slack 工具中的可用动作组：

| 组         | 默认    |
| ---------- | ------- |
| messages   | enabled |
| reactions  | enabled |
| pins       | enabled |
| memberInfo | enabled |
| emojiList  | enabled |

当前 Slack 消息动作包括 `send`、`upload-file`、`download-file`、`read`、`edit`、`delete`、`pin`、`unpin`、`list-pins`、`member-info` 和 `emoji-list`。

## 事件和操作行为

- 消息编辑/删除/thread 广播映射为系统事件。
- 反应添加/删除事件映射为系统事件。
- 成员加入/离开、channel 创建/重命名和 pin 添加/删除事件映射为系统事件。
- Assistant thread 状态更新（用于 thread 中"is typing..."指示器）使用 `assistant.threads.setStatus` 且需要 bot scope `assistant:write`。
- `channel_id_changed` 可以在启用 `configWrites` 时迁移 channel 配置键。
- Channel topic/purpose 元数据被视为不可信上下文，可注入路由上下文。
- Thread starter 和初始 thread-history 上下文种子在适用时按配置的发送者白名单过滤。
- Block 动作和 modal 交互发出结构化 `Slack interaction: ...` 系统事件，带有丰富的 payload 字段：
  - block 动作：选定值、标签、picker 值和 `workflow_*` 元数据
  - modal `view_submission` 和 `view_closed` 事件，带有路由 channel 元数据和表单输入

## Ack 反应

`ackReaction` 在 OpenClaw 处理入站消息时发送确认 emoji。

解析顺序：

- `channels.slack.accounts.<accountId>.ackReaction`
- `channels.slack.ackReaction`
- `messages.ackReaction`
- agent 身份 emoji 回退（`agents.list[].identity.emoji`，否则 "👀"）

注意：

- Slack 期望 shortcode（例如 `"eyes"`）。
- 使用 `""` 为 Slack 账号或全局禁用该反应。

## 输入反应回退

`typingReaction` 在 OpenClaw 处理回复时向入站 Slack 消息添加临时反应，然后在运行完成时移除。当 Slack 原生 assistant typing 不可用时，这是有用的回退，特别是在 DM 中。

解析顺序：

- `channels.slack.accounts.<accountId>.typingReaction`
- `channels.slack.typingReaction`

注意：

- Slack 期望 shortcode（例如 `"hourglass_flowing_sand"`）。
- 反应是尽力而为，清理在回复或失败路径完成后自动尝试。

## Manifest 和 scope 检查清单

<AccordionGroup>
  <Accordion title="Slack app manifest 示例" defaultOpen>

```json
{
  "display_information": {
    "name": "OpenClaw",
    "description": "Slack connector for OpenClaw"
  },
  "features": {
    "bot_user": {
      "display_name": "OpenClaw",
      "always_online": true
    },
    "app_home": {
      "messages_tab_enabled": true,
      "messages_tab_read_only_enabled": false
    },
    "slash_commands": [
      {
        "command": "/openclaw",
        "description": "Send a message to OpenClaw",
        "should_escape": false
      }
    ]
  },
  "oauth_config": {
    "scopes": {
      "bot": [
        "app_mentions:read",
        "assistant:write",
        "channels:history",
        "channels:read",
        "chat:write",
        "commands",
        "emoji:read",
        "files:read",
        "files:write",
        "groups:history",
        "groups:read",
        "im:history",
        "im:read",
        "im:write",
        "mpim:history",
        "mpim:read",
        "mpim:write",
        "pins:read",
        "pins:write",
        "reactions:read",
        "reactions:write",
        "users:read"
      ]
    }
  },
  "settings": {
    "socket_mode_enabled": true,
    "event_subscriptions": {
      "bot_events": [
        "app_mention",
        "channel_rename",
        "member_joined_channel",
        "member_left_channel",
        "message.channels",
        "message.groups",
        "message.im",
        "message.mpim",
        "pin_added",
        "pin_removed",
        "reaction_added",
        "reaction_removed"
      ]
    }
  }
}
```

  </Accordion>

  <Accordion title="可选 user-token scopes（读取操作）">
    如果配置 `channels.slack.userToken`，典型读取 scopes：

    - `channels:history`、`groups:history`、`im:history`、`mpim:history`
    - `channels:read`、`groups:read`、`im:read`、`mpim:read`
    - `users:read`
    - `reactions:read`
    - `pins:read`
    - `emoji:read`
    - `search:read`（如果你依赖 Slack 搜索读取）

  </Accordion>
</AccordionGroup>

## Slack 中的 Exec 批准

Exec 批准提示可以通过交互按钮和交互原生路由到 Slack，而不是回退到 Web UI 或终端。批准者授权被强制执行：只有被识别为批准者的用户可以通过 Slack 批准或拒绝请求。

这使用与其他 channels 相同的共享批准按钮界面。当 Slack app 设置中启用 `interactivity` 时，批准提示直接在对话中渲染为 Block Kit 按钮。

配置路径：

- `channels.slack.execApprovals.enabled`
- `channels.slack.execApprovals.approvers`（可选；当可能时回退到 `commands.ownerAllowFrom`）
- `channels.slack.execApprovals.target`（`dm` | `channel` | `both`，默认：`dm`）
- `agentFilter`、`sessionFilter`

当 `enabled` 未设置或 `"auto"` 且至少一个批准者解析时，Slack 自动启用原生 exec 批准。设为 `enabled: false` 显式禁用 Slack 作为原生批准客户端。设为 `enabled: true` 强制在批准者解析时启用原生批准。

无显式 Slack exec 批准配置的默认行为：

```json5
{
  commands: {
    ownerAllowFrom: ["slack:U12345678"],
  },
}
```

只有当你想覆盖批准者、添加过滤器或选择 origin-chat 投递时才需要显式 Slack 原生配置：

```json5
{
  channels: {
    slack: {
      execApprovals: {
        enabled: true,
        approvers: ["U12345678"],
        target: "both",
      },
    },
  },
}
```

共享 `approvals.exec` 转发是独立的。只有当批准提示必须路由到其他聊天或显式 out-of-band 目标时才使用它。

同聊天 `/approve` 在已支持命令的 Slack channels 和 DM 中也有效。参见 [Exec approvals](/tools/exec-approvals) 获取完整批准转发模型。

## 故障排除

<AccordionGroup>
  <Accordion title="Channel 中无回复">
    按顺序检查：

    - `groupPolicy`
    - channel 白名单（`channels.slack.channels`）
    - `requireMention`
    - channel 级别 `users` 白名单

    有用命令：

```bash
openclaw channels status --probe
openclaw logs --follow
openclaw doctor
```

  </Accordion>

  <Accordion title="DM 消息被忽略">
    检查：

    - `channels.slack.dm.enabled`
    - `channels.slack.dmPolicy`（或旧版 `channels.slack.dm.policy`）
    - 配对批准 / 白名单条目

```bash
openclaw pairing list slack
```

  </Accordion>

  <Accordion title="Socket mode 未连接">
    验证 bot + app tokens 和 Slack app 设置中的 Socket Mode 启用。
  </Accordion>

  <Accordion title="HTTP mode 未接收事件">
    验证：

    - signing secret
    - webhook 路径
    - Slack Request URLs（Events + Interactivity + Slash Commands）
    - 每个 HTTP 账号唯一的 `webhookPath`

  </Accordion>

  <Accordion title="原生/斜杠命令未触发">
    验证你的意图：

    - 原生命令模式（`channels.slack.commands.native: true`）且在 Slack 注册匹配的斜杠命令
    - 或单个斜杠命令模式（`channels.slack.slashCommand.enabled: true`）

    同时检查 `commands.useAccessGroups` 和 channel/user 白名单。

  </Accordion>
</AccordionGroup>

## 文本流式传输

OpenClaw 通过 Agents and AI Apps API 支持 Slack 原生文本流式传输。

`channels.slack.streaming` 控制实时预览行为：

- `off`: 禁用实时预览流式传输。
- `partial`（默认）：用最新部分输出替换预览文本。
- `block`: 追加分块预览更新。
- `progress`: 生成时显示进度状态文本，然后发送最终文本。

当 `streaming` 为 `partial` 时 `channels.slack.nativeStreaming` 控制 Slack 原生流式 API（`chat.startStream` / `chat.appendStream` / `chat.stopStream`）（默认：`true`）。

禁用原生 Slack 流式传输（保持草稿预览行为）：

```yaml
channels:
  slack:
    streaming: partial
    nativeStreaming: false
```

旧版键：

- `channels.slack.streamMode`（`replace | status_final | append`）自动迁移到 `channels.slack.streaming`。
- boolean `channels.slack.streaming` 自动迁移到 `channels.slack.nativeStreaming`。

### 要求

1. 在 Slack app 设置中启用 **Agents and AI Apps**。
2. 确保 app 有 `assistant:write` scope。
3. 该消息必须有可用的回复 thread。Thread 选择仍然遵循 `replyToMode`。

### 行为

- 第一个文本块启动流（`chat.startStream`）。
- 后续文本块追加到同一流（`chat.appendStream`）。
- 回复结束时终结流（`chat.stopStream`）。
- 媒体和非文本 payload 回退到正常投递。
- 如果流式传输在回复中途失败，OpenClaw 为剩余 payload 回退到正常投递。

## 配置参考指针

主要参考：

- [Configuration reference - Slack](/gateway/configuration-reference#slack)

  高信号 Slack 字段：
  - 模式/auth：`mode`、`botToken`、`appToken`、`signingSecret`、`webhookPath`、`accounts.*`
  - DM 访问：`dm.enabled`、`dmPolicy`、`allowFrom`（旧版：`dm.policy`、`dm.allowFrom`）、`dm.groupEnabled`、`dm.groupChannels`
  - 兼容性开关：`dangerouslyAllowNameMatching`（break-glass；除非需要保持关闭）
  - channel 访问：`groupPolicy`、`channels.*`、`channels.*.users`、`channels.*.requireMention`
  - threading/history：`replyToMode`、`replyToModeByChatType`、`thread.*`、`historyLimit`、`dmHistoryLimit`、`dms.*.historyLimit`
  - 投递：`textChunkLimit`、`chunkMode`、`mediaMaxMb`、`streaming`、`nativeStreaming`
  - ops/features：`configWrites`、`commands.native`、`slashCommand.*`、`actions.*`、`userToken`、`userTokenReadOnly`

## 相关

- [Pairing](/channels/pairing)
- [Groups](/channels/groups)
- [Security](/gateway/security)
- [Channel routing](/channels/channel-routing)
- [Troubleshooting](/channels/troubleshooting)
- [Configuration](/gateway/configuration)
- [Slash commands](/tools/slash-commands)
