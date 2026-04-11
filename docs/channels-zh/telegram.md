---
summary: "Telegram bot support status, capabilities, and configuration"
read_when:
  - Working on Telegram features or webhooks
title: "Telegram"
---

# Telegram（Bot API）

状态：通过 grammY 的 bot DM + 群组生产就绪。长轮询是默认模式；webhook 模式可选。

<CardGroup cols={3}>
  <Card title="配对" icon="link" href="/channels/pairing">
    Telegram 默认 DM 策略是配对。
  </Card>
  <Card title="Channel 故障排除" icon="wrench" href="/channels/troubleshooting">
    跨 channel 诊断和修复手册。
  </Card>
  <Card title="Gateway 配置" icon="settings" href="/gateway/configuration">
    完整 channel 配置模式和示例。
  </Card>
</CardGroup>

## 快速设置

<Steps>
  <Step title="在 BotFather 创建 bot token">
    打开 Telegram 与 **@BotFather** 聊天（确认 handle 精确为 `@BotFather`）。

    运行 `/newbot`，按提示操作，保存 token。

  </Step>

  <Step title="配置 token 和 DM 策略">

```json5
{
  channels: {
    telegram: {
      enabled: true,
      botToken: "123:abc",
      dmPolicy: "pairing",
      groups: { "*": { requireMention: true } },
    },
  },
}
```

    环境变量回退：`TELEGRAM_BOT_TOKEN=...`（仅默认账号）。
    Telegram **不使用** `openclaw channels login telegram`；在配置/env 中配置 token，然后启动 Gateway。

  </Step>

  <Step title="启动 Gateway 并批准第一条 DM">

```bash
openclaw gateway
openclaw pairing list telegram
openclaw pairing approve telegram <CODE>
```

    配对代码 1 小时后过期。

  </Step>

  <Step title="将 bot 添加到群组">
    将 bot 添加到你的群组，然后设置 `channels.telegram.groups` 和 `groupPolicy` 匹配你的访问模型。
  </Step>
</Steps>

<Note>
Token 解析顺序是账号感知的。实践中，配置值胜过环境变量回退，`TELEGRAM_BOT_TOKEN` 仅适用于默认账号。
</Note>

## Telegram 侧设置

<AccordionGroup>
  <Accordion title="隐私模式和群组可见性">
    Telegram bots 默认为 **Privacy Mode**，限制它们接收的群组消息。

    如果 bot 必须看到所有群组消息，要么：

    - 通过 `/setprivacy` 禁用隐私模式，或
    - 让 bot 成为群组管理员。

    切换隐私模式时，在每个群组中删除 + 重新添加 bot 以使 Telegram 应用更改。

  </Accordion>

  <Accordion title="群组权限">
    管理员状态在 Telegram 群组设置中控制。

    管理员 bot 接收所有群组消息，对于常开群组行为很有用。

  </Accordion>

  <Accordion title="有用的 BotFather 开关">

    - `/setjoingroups` 允许/拒绝群组添加
    - `/setprivacy` 用于群组可见性行为

  </Accordion>
</AccordionGroup>

## 访问控制和激活

<Tabs>
  <Tab title="DM 策略">
    `channels.telegram.dmPolicy` 控制直接消息访问：

    - `pairing`（默认）
    - `allowlist`（需要 `allowFrom` 中至少一个发送者 ID）
    - `open`（需要 `allowFrom` 包含 `"*"`）
    - `disabled`

    `channels.telegram.allowFrom` 接受数字 Telegram 用户 ID。`telegram:` / `tg:` 前缀被接受并规范化。
    `dmPolicy: "allowlist"` 且空 `allowFrom` 阻止所有 DM 且被配置验证拒绝。
    Onboarding 接受 `@username` 输入并解析为数字 ID。
    如果你升级且配置包含 `@username` 白名单条目，运行 `openclaw doctor --fix` 解析它们（尽力而为；需要 Telegram bot token）。
    如果你之前依赖 pairing-store 白名单文件，`openclaw doctor --fix` 可以在白名单流程中将条目恢复到 `channels.telegram.allowFrom`（例如当 `dmPolicy: "allowlist"` 尚无显式 ID）。

    对于单 owner bot，推荐 `dmPolicy: "allowlist"` 配合显式数字 `allowFrom` ID，以保持访问策略在配置中持久（而不是依赖之前的配对批准）。

    常见混淆：DM 配对批准不意味着"此发送者在各处已授权"。
    配对仅授予 DM 访问。群组发送者授权仍然来自显式配置白名单。
    如果你想要"我一次授权，DM 和群组命令都有效"，将你的数字 Telegram 用户 ID 放入 `channels.telegram.allowFrom`。

    ### 查找你的 Telegram 用户 ID

    更安全（无第三方 bot）：

    1. DM 你的 bot。
    2. 运行 `openclaw logs --follow`。
    3. 读取 `from.id`。

    官方 Bot API 方法：

```bash
curl "https://api.telegram.org/bot<bot_token>/getUpdates"
```

    第三方方法（较少隐私）：`@userinfobot` 或 `@getidsbot`。

  </Tab>

  <Tab title="群组策略和白名单">
    两个控制一起应用：

    1. **哪些群组被允许**（`channels.telegram.groups`）
       - 无 `groups` 配置：
         - `groupPolicy: "open"`：任何群组可通过群组 ID 检查
         - `groupPolicy: "allowlist"`（默认）：群组被阻止直到你添加 `groups` 条目（或 `"*"`）
       - 配置了 `groups`：作为白名单（显式 ID 或 `"*"`）

    2. **哪些发送者在群组中被允许**（`channels.telegram.groupPolicy`）
       - `open`
       - `allowlist`（默认）
       - `disabled`

    `groupAllowFrom` 用于群组发送者过滤。如果未设置，Telegram 回退到 `allowFrom`。
    `groupAllowFrom` 条目应为数字 Telegram 用户 ID（`telegram:` / `tg:` 前缀被规范化）。
    不要将 Telegram 群组或 supergroup chat ID 放入 `groupAllowFrom`。负 chat ID 属于 `channels.telegram.groups`。
    非数字条目在发送者授权时被忽略。
    安全边界（`2026.2.25+`）：群组发送者 auth **不**继承 DM pairing-store 批准。
    配对保持 DM 专属。对于群组，设置 `groupAllowFrom` 或群组/话题级别 `allowFrom`。
    如果 `groupAllowFrom` 未设置，Telegram 回退到配置 `allowFrom`，不是 pairing store。
    单 owner bot 实用模式：在 `channels.telegram.allowFrom` 设置你的用户 ID，保持 `groupAllowFrom` 未设置，并在 `channels.telegram.groups` 下允许目标群组。
    运行时注意：如果 `channels.telegram` 完全缺失，运行时默认为失败关闭的 `groupPolicy="allowlist"`，除非显式设置了 `channels.defaults.groupPolicy`。

    示例：允许一个特定群组中的任何成员：

```json5
{
  channels: {
    telegram: {
      groups: {
        "-1001234567890": {
          groupPolicy: "open",
          requireMention: false,
        },
      },
    },
  },
}
```

    示例：只允许一个特定群组内的特定用户：

```json5
{
  channels: {
    telegram: {
      groups: {
        "-1001234567890": {
          requireMention: true,
          allowFrom: ["8734062810", "745123456"],
        },
      },
    },
  },
}
```

    <Warning>
      常见错误：`groupAllowFrom` 不是 Telegram 群组白名单。

      - 将负 Telegram 群组或 supergroup chat ID 如 `-1001234567890` 放入 `channels.telegram.groups`。
      - 当你想限制允许群组内哪些人可以触发 bot 时，将 Telegram 用户 ID 如 `8734062810` 放入 `groupAllowFrom`。
      - 只在你想让允许群组的任何成员都能与 bot 交谈时使用 `groupAllowFrom: ["*"]`。
    </Warning>

  </Tab>

  <Tab title="提及行为">
    群组回复默认需要提及。

    提及可来自：

    - 原生 `@botusername` 提及，或
    - 提及模式：
      - `agents.list[].groupChat.mentionPatterns`
      - `messages.groupChat.mentionPatterns`

    Session 级别命令开关：

    - `/activation always`
    - `/activation mention`

    这些只更新 session 状态。使用配置实现持久化。

    持久配置示例：

```json5
{
  channels: {
    telegram: {
      groups: {
        "*": { requireMention: false },
      },
    },
  },
}
```

    获取群组 chat ID：

    - 转发群组消息到 `@userinfobot` / `@getidsbot`
    - 或从 `openclaw logs --follow` 读取 `chat.id`
    - 或检查 Bot API `getUpdates`

  </Tab>
</Tabs>

## 运行时行为

- Telegram 由 Gateway 进程拥有。
- 路由是确定性的：Telegram 入站回复回 Telegram（模型不选择 channels）。
- 入站消息规范化为共享 channel envelope，带有回复元数据和媒体占位符。
- 群组 session 按群组 ID 隔离。Forum topics 追加 `:topic:<threadId>` 保持 topics 隔离。
- DM 消息可携带 `message_thread_id`；OpenClaw 用 thread 感知的 session 键路由它们，并为回复保留 thread ID。
- 长轮询使用 grammY runner，带每 chat/每 thread 序列化。整体 runner sink 并发使用 `agents.defaults.maxConcurrent`。
- Telegram Bot API 无已读回执支持（`sendReadReceipts` 不适用）。

## 功能参考

<AccordionGroup>
  <Accordion title="实时流式预览（消息编辑）">
    OpenClaw 可以实时流式传输部分回复：

    - 直接聊天：预览消息 + `editMessageText`
    - 群组/topics：预览消息 + `editMessageText`

    要求：

    - `channels.telegram.streaming` 为 `off | partial | block | progress`（默认：`partial`）
    - `progress` 映射到 Telegram 上的 `partial`（跨 channel 命名兼容）
    - 旧版 `channels.telegram.streamMode` 和 boolean `streaming` 值自动映射

    对于纯文本回复：

    - DM：OpenClaw 保持同一预览消息并在原地执行最终编辑（无第二条消息）
    - 群组/topic：OpenClaw 保持同一预览消息并在原地执行最终编辑（无第二条消息）

    对于复杂回复（例如媒体 payload），OpenClaw 回退到正常最终投递，然后清理预览消息。

    预览流式传输与 block 流式传输分开。当为 Telegram 显式启用 block 流式传输时，OpenClaw 跳过预览流以避免双流。

    如果原生草稿传输不可用/被拒绝，OpenClaw 自动回退到 `sendMessage` + `editMessageText`。

    Telegram 专属 reasoning 流：

    - `/reasoning stream` 在生成时将 reasoning 发送到实时预览
    - 最终答案不带 reasoning 文本发送

  </Accordion>

  <Accordion title="格式化和 HTML 回退">
    出站文本使用 Telegram `parse_mode: "HTML"`。

    - Markdown-ish 文本渲染为 Telegram 安全 HTML。
    - 原始模型 HTML 被转义以减少 Telegram 解析失败。
    - 如果 Telegram 拒绝解析的 HTML，OpenClaw 作为纯文本重试。

    链接预览默认启用，可通过 `channels.telegram.linkPreview: false` 禁用。

  </Accordion>

  <Accordion title="原生命令和自定义命令">
    Telegram 命令菜单注册在启动时通过 `setMyCommands` 处理。

    原生命令默认：

    - `commands.native: "auto"` 为 Telegram 启用原生命令

    添加自定义命令菜单条目：

```json5
{
  channels: {
    telegram: {
      customCommands: [
        { command: "backup", description: "Git backup" },
        { command: "generate", description: "Create an image" },
      ],
    },
  },
}
```

    规则：

    - 名称被规范化（去除前导 `/`，小写）
    - 有效模式：`a-z`、`0-9`、`_`，长度 `1..32`
    - 自定义命令不能覆盖原生命令
    - 冲突/重复被跳过并记录

    注意：

    - 自定义命令只是菜单条目；它们不自动实现行为
    - 插件/skill 命令即使不在 Telegram 菜单中显示，输入时仍然有效

    如果原生命令被禁用，内置命令被移除。自定义/插件命令如果配置仍可注册。

    常见设置失败：

    - `setMyCommands failed` 带 `BOT_COMMANDS_TOO_MUCH` 表示 Telegram 菜单在修剪后仍然溢出；减少插件/skill/自定义命令或禁用 `channels.telegram.commands.native`。
    - `setMyCommands failed` 带网络/fetch 错误通常意味着到 `api.telegram.org` 的出站 DNS/HTTPS 被阻止。

    ### 设备配对命令（`device-pair` 插件）

    安装 `device-pair` 插件后：

    1. `/pair` 生成设置代码
    2. 在 iOS app 中粘贴代码
    3. `/pair pending` 列出待处理请求（包括 role/scopes）
    4. 批准请求：
       - `/pair approve <requestId>` 用于显式批准
       - 当只有一个待处理请求时 `/pair approve`
       - `/pair approve latest` 用于最近的

    如果设备用改变的 auth 详情重试（例如 role/scopes/public key），之前的待处理请求被取代，新请求使用不同的 `requestId`。批准前重新运行 `/pair pending`。

    更多详情：[Pairing](/channels/pairing#pair-via-telegram-recommended-for-ios)。

  </Accordion>

  <Accordion title="内联按钮">
    配置内联键盘范围：

```json5
{
  channels: {
    telegram: {
      capabilities: {
        inlineButtons: "allowlist",
      },
    },
  },
}
```

    账号级别覆盖：

```json5
{
  channels: {
    telegram: {
      accounts: {
        main: {
          capabilities: {
            inlineButtons: "allowlist",
          },
        },
      },
    },
  },
}
```

    范围：

    - `off`
    - `dm`
    - `group`
    - `all`
    - `allowlist`（默认）

    旧版 `capabilities: ["inlineButtons"]` 映射到 `inlineButtons: "all"`。

    消息动作示例：

```json5
{
  action: "send",
  channel: "telegram",
  to: "123456789",
  message: "Choose an option:",
  buttons: [
    [
      { text: "Yes", callback_data: "yes" },
      { text: "No", callback_data: "no" },
    ],
    [{ text: "Cancel", callback_data: "cancel" }],
  ],
}
```

    回调点击作为文本传递给 agent：
    `callback_data: <value>`

  </Accordion>

  <Accordion title="Telegram 消息动作（用于 agents 和自动化）">
    Telegram 工具动作包括：

    - `sendMessage`（`to`、`content`、可选 `mediaUrl`、`replyToMessageId`、`messageThreadId`）
    - `react`（`chatId`、`messageId`、`emoji`）
    - `deleteMessage`（`chatId`、`messageId`）
    - `editMessage`（`chatId`、`messageId`、`content`）
    - `createForumTopic`（`chatId`、`name`、可选 `iconColor`、`iconCustomEmojiId`）

    Channel 消息动作暴露友好别名（`send`、`react`、`delete`、`edit`、`sticker`、`sticker-search`、`topic-create`）。

    门控控制：

    - `channels.telegram.actions.sendMessage`
    - `channels.telegram.actions.deleteMessage`
    - `channels.telegram.actions.reactions`
    - `channels.telegram.actions.sticker`（默认：禁用）

    注意：`edit` 和 `topic-create` 目前默认启用，没有单独的 `channels.telegram.actions.*` 开关。
    运行时发送使用活跃配置/secrets 快照（启动/重载），因此动作路径不按发送执行 ad-hoc SecretRef 重解析。

    反应移除语义：[/tools/reactions](/tools/reactions)

  </Accordion>

  <Accordion title="回复 threading 标签">
    Telegram 支持生成输出中的显式回复 threading 标签：

    - `[[reply_to_current]]` 回复触发消息
    - `[[reply_to:<id>]]` 回复特定 Telegram 消息 ID

    `channels.telegram.replyToMode` 控制处理：

    - `off`（默认）
    - `first`
    - `all`

    注意：`off` 禁用隐式回复 threading。显式 `[[reply_to_*]]` 标签仍然被遵守。

  </Accordion>

  <Accordion title="Forum topics 和 thread 行为">
    Forum supergroups：

    - topic session 键追加 `:topic:<threadId>`
    - 回复和输入目标 topic thread
    - topic 配置路径：
      `channels.telegram.groups.<chatId>.topics.<threadId>`

    General topic（`threadId=1`）特殊情况：

    - 消息发送省略 `message_thread_id`（Telegram 拒绝 `sendMessage(...thread_id=1)`）
    - 输入动作仍包含 `message_thread_id`

    Topic 继承：topic 条目继承群组设置，除非被覆盖（`requireMention`、`allowFrom`、`skills`、`systemPrompt`、`enabled`、`groupPolicy`）。
    `agentId` 是 topic 专属，不继承群组默认。

    **每 topic agent 路由**：每个 topic 可以通过在 topic 配置中设置 `agentId` 路由到不同的 agent。这给每个 topic 自己的隔离 workspace、memory 和 session。示例：

    ```json5
    {
      channels: {
        telegram: {
          groups: {
            "-1001234567890": {
              topics: {
                "1": { agentId: "main" },      // General topic → main agent
                "3": { agentId: "zu" },        // Dev topic → zu agent
                "5": { agentId: "coder" }      // Code review → coder agent
              }
            }
          }
        }
      }
    }
    ```

    每个 topic 然后有自己的 session 键：`agent:zu:telegram:group:-1001234567890:topic:3`

    **持久 ACP topic 绑定**：Forum topics 可以通过顶层类型化 ACP bindings pin ACP harness session：

    - 带有 `type: "acp"` 和 `match.channel: "telegram"` 的 `bindings[]`

    示例：

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
            channel: "telegram",
            accountId: "default",
            peer: { kind: "group", id: "-1001234567890:topic:42" },
          },
        },
      ],
      channels: {
        telegram: {
          groups: {
            "-1001234567890": {
              topics: {
                "42": {
                  requireMention: false,
                },
              },
            },
          },
        },
      },
    }
    ```

    这目前范围限于群组和 supergroups 中的 forum topics。

    **Thread-bound ACP spawn from chat**：

    - `/acp spawn <agent> --thread here|auto` 可以将当前 Telegram topic 绑定到新 ACP session。
    - 后续 topic 消息直接路由到绑定的 ACP session（无需 `/acp steer`）。
    - 成功绑定后 OpenClaw 在 topic 中 pin spawn 确认消息。
    - 需要 `channels.telegram.threadBindings.spawnAcpSessions=true`。

    Template 上下文包括：

    - `MessageThreadId`
    - `IsForum`

    DM thread 行为：

    - 带 `message_thread_id` 的私聊保持 DM 路由但使用 thread 感知的 session 键/回复目标。

  </Accordion>

  <Accordion title="音频、视频和 stickers">
    ### 音频消息

    Telegram 区分 voice notes 和音频文件。

    - 默认：音频文件行为
    - 在 agent 回复中标记 `[[audio_as_voice]]` 强制 voice-note 发送

    消息动作示例：

```json5
{
  action: "send",
  channel: "telegram",
  to: "123456789",
  media: "https://example.com/voice.ogg",
  asVoice: true,
}
```

    ### 视频消息

    Telegram 区分视频文件和 video notes。

    消息动作示例：

```json5
{
  action: "send",
  channel: "telegram",
  to: "123456789",
  media: "https://example.com/video.mp4",
  asVideoNote: true,
}
```

    Video notes 不支持 captions；提供的消息文本单独发送。

    ### Stickers

    入站 sticker 处理：

    - 静态 WEBP：下载并处理（占位符 `<media:sticker>`）
    - 动画 TGS：跳过
    - 视频 WEBM：跳过

    Sticker 上下文字段：

    - `Sticker.emoji`
    - `Sticker.setName`
    - `Sticker.fileId`
    - `Sticker.fileUniqueId`
    - `Sticker.cachedDescription`

    Sticker 缓存文件：

    - `~/.openclaw/telegram/sticker-cache.json`

    Stickers 被描述一次（当可能时）并缓存以减少重复视觉调用。

    启用 sticker 动作：

```json5
{
  channels: {
    telegram: {
      actions: {
        sticker: true,
      },
    },
  },
}
```

    发送 sticker 动作：

```json5
{
  action: "sticker",
  channel: "telegram",
  to: "123456789",
  fileId: "CAACAgIAAxkBAAI...",
}
```

    搜索缓存的 stickers：

```json5
{
  action: "sticker-search",
  channel: "telegram",
  query: "cat waving",
  limit: 5,
}
```

  </Accordion>

  <Accordion title="反应通知">
    Telegram 反应以 `message_reaction` updates 到达（与消息 payload 分开）。

    启用时，OpenClaw 排队系统事件如：

    - `Telegram reaction added: 👍 by Alice (@alice) on msg 42`

    配置：

    - `channels.telegram.reactionNotifications`: `off | own | all`（默认：`own`）
    - `channels.telegram.reactionLevel`: `off | ack | minimal | extensive`（默认：`minimal`）

    注意：

    - `own` 表示仅用户对 bot 发送消息的反应（尽力而为通过发送消息缓存）。
    - 反应事件仍然遵守 Telegram 访问控制（`dmPolicy`、`allowFrom`、`groupPolicy`、`groupAllowFrom`）；未授权发送者被丢弃。
    - Telegram 不在反应 updates 中提供 thread ID。
      - 非 forum 群组路由到群组聊天 session
      - forum 群组路由到群组 general-topic session（`:topic:1`），不是精确的原始 topic

    polling/webhook 的 `allowed_updates` 自动包含 `message_reaction`。

  </Accordion>

  <Accordion title="Ack 反应">
    `ackReaction` 在 OpenClaw 处理入站消息时发送确认 emoji。

    解析顺序：

    - `channels.telegram.accounts.<accountId>.ackReaction`
    - `channels.telegram.ackReaction`
    - `messages.ackReaction`
    - agent 身份 emoji 回退（`agents.list[].identity.emoji`，否则 "👀"）

    注意：

    - Telegram 期望 unicode emoji（例如 "👀"）。
    - 使用 `""` 为 channel 或账号禁用该反应。

  </Accordion>

  <Accordion title="从 Telegram 事件和命令的配置写入">
    Channel 配置写入默认启用（`configWrites !== false`）。

    Telegram 触发的写入包括：

    - 群组迁移事件（`migrate_to_chat_id`）更新 `channels.telegram.groups`
    - `/config set` 和 `/config unset`（需要命令启用）

    禁用：

```json5
{
  channels: {
    telegram: {
      configWrites: false,
    },
  },
}
```

  </Accordion>

  <Accordion title="长轮询 vs webhook">
    默认：长轮询。

    Webhook 模式：

    - 设置 `channels.telegram.webhookUrl`
    - 设置 `channels.telegram.webhookSecret`（设置 webhook URL 时必需）
    - 可选 `channels.telegram.webhookPath`（默认 `/telegram-webhook`）
    - 可选 `channels.telegram.webhookHost`（默认 `127.0.0.1`）
    - 可选 `channels.telegram.webhookPort`（默认 `8787`）

    Webhook 模式的默认本地监听器绑定到 `127.0.0.1:8787`。

    如果你的公共端点不同，放置反向代理在前，并将 `webhookUrl` 指向公共 URL。
    当你有意需要外部入站时设置 `webhookHost`（例如 `0.0.0.0`）。

  </Accordion>

  <Accordion title="限制、重试和 CLI 目标">
    - `channels.telegram.textChunkLimit` 默认为 4000。
    - `channels.telegram.chunkMode="newline"` 在长度分割前优先段落边界（空行）。
    - `channels.telegram.mediaMaxMb`（默认 100）限制入站和出站 Telegram 媒体大小。
    - `channels.telegram.timeoutSeconds` 覆盖 Telegram API 客户端超时（如果未设置，grammY 默认应用）。
    - 群组上下文历史使用 `channels.telegram.historyLimit` 或 `messages.groupChat.historyLimit`（默认 50）；`0` 禁用。
    - 回复/引用/转发补充上下文目前按接收传递。
    - Telegram 白名单主要限制谁可以触发 agent，不是完整补充上下文删减边界。
    - DM 历史控制：
      - `channels.telegram.dmHistoryLimit`
      - `channels.telegram.dms["<user_id>"].historyLimit`
    - `channels.telegram.retry` 配置应用于 Telegram 发送助手（CLI/tools/actions）用于可恢复的出站 API 错误。

    CLI 发送目标可以是数字 chat ID 或 username：

```bash
openclaw message send --channel telegram --target 123456789 --message "hi"
openclaw message send --channel telegram --target @name --message "hi"
```

    Telegram polls 使用 `openclaw message poll` 并支持 forum topics：

```bash
openclaw message poll --channel telegram --target 123456789 \
  --poll-question "Ship it?" --poll-option "Yes" --poll-option "No"
openclaw message poll --channel telegram --target -1001234567890:topic:42 \
  --poll-question "Pick a time" --poll-option "10am" --poll-option "2pm" \
  --poll-duration-seconds 300 --poll-public
```

    Telegram 专属 poll 标志：

    - `--poll-duration-seconds`（5-600）
    - `--poll-anonymous`
    - `--poll-public`
    - `--thread-id` 用于 forum topics（或使用 `:topic:` 目标）

    Telegram 发送也支持：

    - `--buttons` 用于内联键盘，当 `channels.telegram.capabilities.inlineButtons` 允许时
    - `--force-document` 将出站图片和 GIF 作为文档发送，而不是压缩照片或动画媒体上传

    动作门控：

    - `channels.telegram.actions.sendMessage=false` 禁用出站 Telegram 消息，包括 polls
    - `channels.telegram.actions.poll=false` 禁用 Telegram poll 创建，同时保持常规发送启用

  </Accordion>

  <Accordion title="Telegram 中的 Exec 批准">
    Telegram 支持在批准者 DM 中进行 exec 批准，并可可选地在原始聊天或 topic 中发布批准提示。

    配置路径：

    - `channels.telegram.execApprovals.enabled`
    - `channels.telegram.execApprovals.approvers`（可选；当可能时从 `allowFrom` 和直接 `defaultTo` 推断的数字 owner ID 回退）
    - `channels.telegram.execApprovals.target`（`dm` | `channel` | `both`，默认：`dm`）
    - `agentFilter`、`sessionFilter`

    批准者必须是数字 Telegram 用户 ID。当 `enabled` 未设置或 `"auto"` 且至少一个批准者可解析，无论是从 `execApprovals.approvers` 还是账号的数字 owner 配置（`allowFrom` 和直接消息 `defaultTo`），Telegram 自动启用原生 exec 批准。设为 `enabled: false` 显式禁用 Telegram 作为原生批准客户端。批准请求否则回退到其他配置的批准路由或 exec 批准回退策略。

    Telegram 也渲染其他聊天 channels 使用的共享批准按钮。原生 Telegram adapter 主要添加批准者 DM 路由、channel/topic fanout 和投递前的输入提示。

    投递规则：

    - `target: "dm"` 仅将批准提示发送到解析的批准者 DM
    - `target: "channel"` 将提示发回原始 Telegram chat/topic
    - `target: "both"` 发送到批准者 DM 和原始 chat/topic

    只有解析的批准者可以批准或拒绝。非批准者不能使用 `/approve` 且不能使用 Telegram 批准按钮。

    Channel 投递在聊天中显示命令文本，因此只在信任的群组/topics 中启用 `channel` 或 `both`。当提示落在 forum topic 中时，OpenClaw 为批准提示和批准后跟进保留 topic。Exec 批准默认 30 分钟后过期。

    内联批准按钮也依赖 `channels.telegram.capabilities.inlineButtons` 允许目标界面（`dm`、`group` 或 `all`）。

    相关文档：[Exec approvals](/tools/exec-approvals)

  </Accordion>
</AccordionGroup>

## 错误回复控制

当 agent 遇到投递或 provider 错误时，Telegram 可以回复错误文本或抑制它。两个配置键控制此行为：

| 键                                  | 值                | 默认    | 描述                                                        |
| ----------------------------------- | ----------------- | ------- | ----------------------------------------------------------- |
| `channels.telegram.errorPolicy`     | `reply`、`silent` | `reply` | `reply` 向聊天发送友好错误消息。`silent` 完全抑制错误回复。 |
| `channels.telegram.errorCooldownMs` | 数字（ms）        | `60000` | 同一聊天错误回复之间的最小时间。防止停机期间错误刷屏。      |

支持账号级别、群组级别和 topic 级别覆盖（与其他 Telegram 配置键相同继承）。

```json5
{
  channels: {
    telegram: {
      errorPolicy: "reply",
      errorCooldownMs: 120000,
      groups: {
        "-1001234567890": {
          errorPolicy: "silent", // suppress errors in this group
        },
      },
    },
  },
}
```

## 故障排除

<AccordionGroup>
  <Accordion title="Bot 不响应非提及群组消息">

    - 如果 `requireMention=false`，Telegram 隐私模式必须允许完整可见性。
      - BotFather: `/setprivacy` -> Disable
      - 然后删除 + 重新添加 bot 到群组
    - `openclaw channels status` 当配置期望非提及群组消息时警告。
    - `openclaw channels status --probe` 可检查显式数字群组 ID；通配符 `"*"` 无法成员探测。
    - 快速 session 测试：`/activation always`。

  </Accordion>

  <Accordion title="Bot 完全看不到群组消息">

    - 当 `channels.telegram.groups` 存在时，群组必须被列出（或包含 `"*"`）
    - 验证 bot 在群组中的成员身份
    - 检查日志：`openclaw logs --follow` 查看跳过原因

  </Accordion>

  <Accordion title="命令部分有效或完全无效">

    - 授权你的发送者身份（配对和/或数字 `allowFrom`）
    - 即使群组策略为 `open`，命令授权仍然适用
    - `setMyCommands failed` 带 `BOT_COMMANDS_TOO_MUCH` 表示原生菜单条目过多；减少插件/skill/自定义命令或禁用原生菜单
    - `setMyCommands failed` 带网络/fetch 错误通常表示到 `api.telegram.org` 的 DNS/HTTPS 可达性问题

  </Accordion>

  <Accordion title="轮询或网络不稳定">

    - Node 22+ + 自定义 fetch/proxy 如果 AbortSignal 类型不匹配可能触发立即中止行为。
    - 一些主机首先将 `api.telegram.org` 解析为 IPv6；损坏的 IPv6 出站可能导致间歇性 Telegram API 失败。
    - 如果日志包含 `TypeError: fetch failed` 或 `Network request for 'getUpdates' failed!`，OpenClaw 现在将这些作为可恢复网络错误重试。
    - 在具有不稳定直接出站/TLS 的 VPS 主机上，通过 `channels.telegram.proxy` 路由 Telegram API 调用：

```yaml
channels:
  telegram:
    proxy: socks5://<user>:<password>@proxy-host:1080
```

    - Node 22+ 默认 `autoSelectFamily=true`（WSL2 除外）和 `dnsResultOrder=ipv4first`。
    - 如果你的主机是 WSL2 或显式更适合 IPv4-only 行为，强制 family 选择：

```yaml
channels:
  telegram:
    network:
      autoSelectFamily: false
```

    - RFC 2544 benchmark-range answers（`198.18.0.0/15`）已默认允许 Telegram 媒体下载。如果可信 fake-IP 或透明代理在媒体下载期间将 `api.telegram.org` 重写为某些其他私有/内部/特殊用途地址，你可以选择 Telegram 专属绕过：

```yaml
channels:
  telegram:
    network:
      dangerouslyAllowPrivateNetwork: true
```

    - 同样 opt-in 在账号级别可用：
      `channels.telegram.accounts.<accountId>.network.dangerouslyAllowPrivateNetwork`。
    - 如果你的代理将 Telegram 媒体主机解析到 `198.18.x.x`，首先保持危险标志关闭。Telegram 媒体已默认允许 RFC 2544 benchmark 范围。

    <Warning>
      `channels.telegram.network.dangerouslyAllowPrivateNetwork` 削弱 Telegram 媒体 SSRF 保护。只在可信 operator 控制的代理环境（如 Clash、Mihomo 或 Surge fake-IP 路由）中使用，当它们合成 RFC 2544 benchmark 范围之外的私有或特殊用途答案时。对于正常公共互联网 Telegram 访问保持关闭。
    </Warning>

    - 环境覆盖（临时）：
      - `OPENCLAW_TELEGRAM_DISABLE_AUTO_SELECT_FAMILY=1`
      - `OPENCLAW_TELEGRAM_ENABLE_AUTO_SELECT_FAMILY=1`
      - `OPENCLAW_TELEGRAM_DNS_RESULT_ORDER=ipv4first`
    - 验证 DNS answers：

```bash
dig +short api.telegram.org A
dig +short api.telegram.org AAAA
```

  </Accordion>
</AccordionGroup>

更多帮助：[Channel troubleshooting](/channels/troubleshooting)。

## Telegram 配置参考指针

主要参考：

- `channels.telegram.enabled`: 启用/禁用 channel 启动。
- `channels.telegram.botToken`: bot token（BotFather）。
- `channels.telegram.tokenFile`: 从常规文件路径读取 token。拒绝 symlinks。
- `channels.telegram.dmPolicy`: `pairing | allowlist | open | disabled`（默认：pairing）。
- `channels.telegram.allowFrom`: DM 白名单（数字 Telegram 用户 ID）。`allowlist` 需要至少一个发送者 ID。`open` 需要 `"*"`。`openclaw doctor --fix` 可以将旧版 `@username` 条目解析为 ID，并可在白名单迁移流程中从 pairing-store 文件恢复白名单条目。
- `channels.telegram.actions.poll`: 启用或禁用 Telegram poll 创建（默认：启用；仍需要 `sendMessage`）。
- `channels.telegram.defaultTo`: CLI `--deliver` 在无显式 `--reply-to` 时使用的默认 Telegram 目标。
- `channels.telegram.groupPolicy`: `open | allowlist | disabled`（默认：allowlist）。
- `channels.telegram.groupAllowFrom`: 群组发送者白名单（数字 Telegram 用户 ID）。`openclaw doctor --fix` 可将旧版 `@username` 条目解析为 ID。非数字条目在 auth 时被忽略。群组 auth 不使用 DM pairing-store 回退（`2026.2.25+`）。
- 多账号优先级：
  - 配置两个或更多账号 ID 时，设置 `channels.telegram.defaultAccount`（或包含 `channels.telegram.accounts.default`）使默认路由显式。
  - 如果都未设置，OpenClaw 回退到第一个规范化账号 ID，`openclaw doctor` 发出警告。
  - `channels.telegram.accounts.default.allowFrom` 和 `channels.telegram.accounts.default.groupAllowFrom` 仅适用于 `default` 账号。
  - 命名账号在账号级别值未设置时继承 `channels.telegram.allowFrom` 和 `channels.telegram.groupAllowFrom`。
  - 命名账号不继承 `channels.telegram.accounts.default.allowFrom` / `groupAllowFrom`。
- `channels.telegram.groups`: 按群组默认 + 白名单（使用 `"*"` 作为全局默认）。
  - `channels.telegram.groups.<id>.groupPolicy`: groupPolicy 群组级别覆盖（`open | allowlist | disabled`）。
  - `channels.telegram.groups.<id>.requireMention`: 提及门控默认。
  - `channels.telegram.groups.<id>.skills`: skill 过滤（省略 = 所有 skills，空 = 无）。
  - `channels.telegram.groups.<id>.allowFrom`: 群组级别发送者白名单覆盖。
  - `channels.telegram.groups.<id>.systemPrompt`: 群组的额外 system prompt。
  - `channels.telegram.groups.<id>.enabled`: 当 `false` 时禁用群组。
  - `channels.telegram.groups.<id>.topics.<threadId>.*`: topic 级别覆盖（群组字段 + topic 专属 `agentId`）。
  - `channels.telegram.groups.<id>.topics.<threadId>.agentId`: 将此 topic 路由到特定 agent（覆盖群组级别和 binding 路由）。
- `channels.telegram.groups.<id>.topics.<threadId>.groupPolicy`: groupPolicy topic 级别覆盖（`open | allowlist | disabled`）。
- `channels.telegram.groups.<id>.topics.<threadId>.requireMention`: topic 级别提及门控覆盖。
- 顶层带 `type: "acp"` 和规范 topic id `chatId:topic:topicId` 在 `match.peer.id` 的 `bindings[]`：持久 ACP topic 绑定字段（参见 [ACP Agents](/tools/acp-agents#channel-specific-settings)）。
- `channels.telegram.direct.<id>.topics.<threadId>.agentId`: 将 DM topics 路由到特定 agent（与 forum topics 相同行为）。
- `channels.telegram.execApprovals.enabled`: 为此账号启用 Telegram 作为聊天基础 exec 批准客户端。
- `channels.telegram.execApprovals.approvers`: 允许批准或拒绝 exec 请求的 Telegram 用户 ID。当 `channels.telegram.allowFrom` 或直接 `channels.telegram.defaultTo` 已识别 owner 时可选。
- `channels.telegram.execApprovals.target`: `dm | channel | both`（默认：`dm`）。`channel` 和 `both` 在存在时保留原始 Telegram topic。
- `channels.telegram.execApprovals.agentFilter`: 转发批准提示的可选 agent ID 过滤。
- `channels.telegram.execApprovals.sessionFilter`: 转发批准提示的可选 session 键过滤（substring 或 regex）。
- `channels.telegram.accounts.<account>.execApprovals`: Telegram exec 批准路由和批准者授权的账号级别覆盖。
- `channels.telegram.capabilities.inlineButtons`: `off | dm | group | all | allowlist`（默认：allowlist）。
- `channels.telegram.accounts.<account>.capabilities.inlineButtons`: 账号级别覆盖。
- `channels.telegram.commands.nativeSkills`: 启用/禁用 Telegram 原生 skills 命令。
- `channels.telegram.replyToMode`: `off | first | all`（默认：`off`）。
- `channels.telegram.textChunkLimit`: 出站分块大小（字符）。
- `channels.telegram.chunkMode`: `length`（默认）或 `newline` 在长度分块前按空行（段落边界）分割。
- `channels.telegram.linkPreview`: 出站消息的链接预览开关（默认：true）。
- `channels.telegram.streaming`: `off | partial | block | progress`（实时流式预览；默认：`partial`；`progress` 映射到 `partial`；`block` 是旧版预览模式兼容）。Telegram 预览流式传输使用原地编辑的单个预览消息。
- `channels.telegram.mediaMaxMb`: 入站/出站 Telegram 媒体上限（MB，默认：100）。
- `channels.telegram.retry`: Telegram 发送助手在可恢复出站 API 错误上的重试策略（attempts、minDelayMs、maxDelayMs、jitter）。
- `channels.telegram.network.autoSelectFamily`: 覆盖 Node autoSelectFamily（true=启用，false=禁用）。Node 22+ 默认启用，WSL2 默认禁用。
- `channels.telegram.network.dnsResultOrder`: 覆盖 DNS 结果顺序（`ipv4first` 或 `verbatim`）。Node 22+ 默认 `ipv4first`。
- `channels.telegram.network.dangerouslyAllowPrivateNetwork`: 用于可信 fake-IP 或透明代理环境的危险 opt-in，其中 Telegram 媒体下载将 `api.telegram.org` 解析为默认 RFC 2544 benchmark-range 许可之外的私有/内部/特殊用途地址。
- `channels.telegram.proxy`: Bot API 调用的代理 URL（SOCKS/HTTP）。
- `channels.telegram.webhookUrl`: 启用 webhook 模式（需要 `channels.telegram.webhookSecret`）。
- `channels.telegram.webhookSecret`: webhook secret（设置 webhookUrl 时必需）。
- `channels.telegram.webhookPath`: 本地 webhook 路径（默认 `/telegram-webhook`）。
- `channels.telegram.webhookHost`: 本地 webhook 绑定 host（默认 `127.0.0.1`）。
- `channels.telegram.webhookPort`: 本地 webhook 绑定端口（默认 `8787`）。
- `channels.telegram.actions.reactions`: 门控 Telegram 工具反应。
- `channels.telegram.actions.sendMessage`: 门控 Telegram 工具消息发送。
- `channels.telegram.actions.deleteMessage`: 门控 Telegram 工具消息删除。
- `channels.telegram.actions.sticker`: 门控 Telegram sticker 动作 — 发送和搜索（默认：false）。
- `channels.telegram.reactionNotifications`: `off | own | all` — 控制哪些反应触发系统事件（未设置时默认：`own`）。
- `channels.telegram.reactionLevel`: `off | ack | minimal | extensive` — 控制 agent 的反应能力（未设置时默认：`minimal`）。
- `channels.telegram.errorPolicy`: `reply | silent` — 控制错误回复行为（默认：`reply`）。支持账号/群组/topic 覆盖。
- `channels.telegram.errorCooldownMs`: 同一聊天错误回复之间的最小 ms（默认：`60000`）。防止停机期间错误刷屏。

- [Configuration reference - Telegram](/gateway/configuration-reference#telegram)

Telegram 专属高信号字段：

- 启动/auth：`enabled`、`botToken`、`tokenFile`、`accounts.*`（`tokenFile` 必须指向常规文件；拒绝 symlinks）
- 访问控制：`dmPolicy`、`allowFrom`、`groupPolicy`、`groupAllowFrom`、`groups`、`groups.*.topics.*`、顶层 `bindings[]`（`type: "acp"`）
- exec 批准：`execApprovals`、`accounts.*.execApprovals`
- 命令/菜单：`commands.native`、`commands.nativeSkills`、`customCommands`
- threading/回复：`replyToMode`
- 流式传输：`streaming`（预览）、`blockStreaming`
- 格式化/投递：`textChunkLimit`、`chunkMode`、`linkPreview`、`responsePrefix`
- 媒体/网络：`mediaMaxMb`、`timeoutSeconds`、`retry`、`network.autoSelectFamily`、`network.dangerouslyAllowPrivateNetwork`、`proxy`
- webhook：`webhookUrl`、`webhookSecret`、`webhookPath`、`webhookHost`
- 动作/capabilities：`capabilities.inlineButtons`、`actions.sendMessage|editMessage|deleteMessage|reactions|sticker`
- 反应：`reactionNotifications`、`reactionLevel`
- 错误：`errorPolicy`、`errorCooldownMs`
- 写入/历史：`configWrites`、`historyLimit`、`dmHistoryLimit`、`dms.*.historyLimit`

## 相关

- [Pairing](/channels/pairing)
- [Groups](/channels/groups)
- [Security](/gateway/security)
- [Channel routing](/channels/channel-routing)
- [Multi-agent routing](/concepts/multi-agent)
- [Troubleshooting](/channels/troubleshooting)
