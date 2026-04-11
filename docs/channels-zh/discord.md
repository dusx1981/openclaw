---
summary: "Discord bot support status, capabilities, and configuration"
read_when:
  - Working on Discord channel features
title: "Discord"
---

# Discord (Bot API)

状态：通过官方 Discord gateway 支持私信和 guild 频道。

<CardGroup cols={3}>
  <Card title="配对" icon="link" href="/channels/pairing">
    Discord 私信默认为配对模式。
  </Card>
  <Card title="斜杠命令" icon="terminal" href="/tools/slash-commands">
    原生命令行为和命令目录。
  </Card>
  <Card title="频道故障排除" icon="wrench" href="/channels/troubleshooting">
    跨频道诊断和修复流程。
  </Card>
</CardGroup>

## 快速设置

你需要创建一个带 bot 的新应用，将 bot 添加到你的服务器，并将其配对到 OpenClaw。我们建议将你的 bot 添加到你自己的私人服务器。如果你还没有，[先创建一个](https://support.discord.com/hc/en-us/articles/204849977-How-do-I-create-a-server)（选择 **Create My Own > For me and my friends**）。

<Steps>
  <Step title="创建 Discord 应用和 bot">
    前往 [Discord Developer Portal](https://discord.com/developers/applications) 并点击 **New Application**。命名为类似"OpenClaw"。

    点击侧边栏的 **Bot**。将 **Username** 设置为你称呼 OpenClaw agent 的名称。

  </Step>

  <Step title="启用特权 intents">
    在 **Bot** 页面，向下滚动到 **Privileged Gateway Intents** 并启用：

    - **Message Content Intent**（必需）
    - **Server Members Intent**（推荐；角色白名单和名称到 ID 匹配需要）
    - **Presence Intent**（可选；仅在需要 presence 更新时需要）

  </Step>

  <Step title="复制你的 bot token">
    在 **Bot** 页面向上滚动并点击 **Reset Token**。

    <Note>
    尽管名称如此，这会生成你的第一个 token — 没有"重置"任何东西。
    </Note>

    复制 token 并保存到某处。这是你的 **Bot Token**，你很快需要它。

  </Step>

  <Step title="生成邀请 URL 并将 bot 添加到你的服务器">
    点击侧边栏的 **OAuth2**。你将生成具有正确权限的邀请 URL 以将 bot 添加到你的服务器。

    向下滚动到 **OAuth2 URL Generator** 并启用：

    - `bot`
    - `applications.commands`

    下面会出现 **Bot Permissions** 部分。启用：

    - View Channels
    - Send Messages
    - Read Message History
    - Embed Links
    - Attach Files
    - Add Reactions（可选）

    复制底部生成的 URL，粘贴到浏览器，选择你的服务器，点击 **Continue** 连接。你应该能在 Discord 服务器中看到你的 bot。

  </Step>

  <Step title="启用 Developer Mode 并收集你的 ID">
    回到 Discord 应用，你需要启用 Developer Mode 以便复制内部 ID。

    1. 点击 **User Settings**（头像旁的齿轮图标）→ **Advanced** → 开启 **Developer Mode**
    2. 右键侧边栏的 **server icon** → **Copy Server ID**
    3. 右键你的 **own avatar** → **Copy User ID**

    将你的 **Server ID** 和 **User ID** 与 Bot Token 一起保存 — 你将在下一步将三者发送给 OpenClaw。

  </Step>

  <Step title="允许服务器成员发送私信">
    为使配对工作，Discord 需要允许你的 bot 向你发送私信。右键你的 **server icon** → **Privacy Settings** → 开启 **Direct Messages**。

    这让服务器成员（包括 bot）能向你发送私信。如果你想用 OpenClaw 使用 Discord 私信，请保持启用。如果你只打算使用 guild 频道，可以在配对后禁用私信。

  </Step>

  <Step title="安全设置你的 bot token（不要在聊天中发送）">
    你的 Discord bot token 是一个秘密（像密码）。在与 agent 消息交流前，在运行 OpenClaw 的机器上设置它。

```bash
export DISCORD_BOT_TOKEN="YOUR_BOT_TOKEN"
openclaw config set channels.discord.token --ref-provider default --ref-source env --ref-id DISCORD_BOT_TOKEN --dry-run
openclaw config set channels.discord.token --ref-provider default --ref-source env --ref-id DISCORD_BOT_TOKEN
openclaw config set channels.discord.enabled true --strict-json
openclaw gateway
```

    如果 OpenClaw 已作为后台服务运行，通过 OpenClaw Mac 应用或停止并重启 `openclaw gateway run` 进程来重启它。

  </Step>

  <Step title="配置 OpenClaw 并配对">

    <Tabs>
      <Tab title="询问你的 agent">
        在任何现有频道（如 Telegram）与你的 OpenClaw agent 聊天并告诉它。如果 Discord 是你的第一个频道，使用 CLI / config 标签页。

        > "我已经在配置中设置了 Discord bot token。请用 User ID `<user_id>` 和 Server ID `<server_id>` 完成 Discord 设置。"
      </Tab>
      <Tab title="CLI / config">
        如果你喜欢基于文件的配置，设置：

```json5
{
  channels: {
    discord: {
      enabled: true,
      token: {
        source: "env",
        provider: "default",
        id: "DISCORD_BOT_TOKEN",
      },
    },
  },
}
```

        默认账号的环境回退：

```bash
DISCORD_BOT_TOKEN=...
```

        明文 `token` 值也支持。`channels.discord.token` 也支持跨 env/file/exec 提供者的 SecretRef 值。请参阅 [Secrets 管理](/gateway/secrets)。

      </Tab>
    </Tabs>

  </Step>

  <Step title="批准首次私信配对">
    等待 gateway 运行，然后在 Discord 中私信你的 bot。它会回复一个配对码。

    <Tabs>
      <Tab title="询问你的 agent">
        在你现有频道上向 agent 发送配对码：

        > "批准此 Discord 配对码：`<CODE>`"
      </Tab>
      <Tab title="CLI">

```bash
openclaw pairing list discord
openclaw pairing approve discord <CODE>
```

      </Tab>
    </Tabs>

    配对码 1 小时后过期。

    你现在应该能在 Discord 通过私信与你的 agent 聊天。

  </Step>
</Steps>

<Note>
Token 解析是账号感知的。配置 token 值优先于环境回退。`DISCORD_BOT_TOKEN` 仅用于默认账号。
对于高级出站调用（消息工具/频道操作），每次调用使用明确的 `token`。这适用于发送和读取/探测式操作（如 read/search/fetch/thread/pins/permissions）。账号策略/重试设置仍来自活动运行时快照中的选定账号。
</Note>

## 推荐：设置 guild workspace

私信工作后，你可以将 Discord 服务器设置为完整 workspace，每个频道有自己的 agent session 和自己的上下文。这推荐用于私人服务器，只有你和你的 bot。

<Steps>
  <Step title="将你的服务器添加到 guild 白名单">
    这让你的 agent 能在服务器任何频道响应，不只是私信。

    <Tabs>
      <Tab title="询问你的 agent">
        > "将我的 Discord Server ID `<server_id>` 添加到 guild 白名单"
      </Tab>
      <Tab title="Config">

```json5
{
  channels: {
    discord: {
      groupPolicy: "allowlist",
      guilds: {
        YOUR_SERVER_ID: {
          requireMention: true,
          users: ["YOUR_USER_ID"],
        },
      },
    },
  },
}
```

      </Tab>
    </Tabs>

  </Step>

  <Step title="允许无 @mention 的响应">
    默认情况下，你的 agent 在 guild 频道仅在被 @mention 时响应。对于私人服务器，你可能希望它对每条消息响应。

    <Tabs>
      <Tab title="询问你的 agent">
        > "允许我的 agent 在此服务器无需 @mention 就能响应"
      </Tab>
      <Tab title="Config">
        在你的 guild 配置中设置 `requireMention: false`：

```json5
{
  channels: {
    discord: {
      guilds: {
        YOUR_SERVER_ID: {
          requireMention: false,
        },
      },
    },
  },
}
```

      </Tab>
    </Tabs>

  </Step>

  <Step title="规划 guild 频道的记忆">
    默认情况下，长期记忆（MEMORY.md）仅在私信 session 中加载。Guild 频道不自动加载 MEMORY.md。

    <Tabs>
      <Tab title="询问你的 agent">
        > "当我在 Discord 频道提问时，如果需要 MEMORY.md 的长期上下文，使用 memory_search 或 memory_get。"
      </Tab>
      <Tab title="手动">
        如果你需要在每个频道有共享上下文，将稳定指令放在 `AGENTS.md` 或 `USER.md`（它们为每个 session 注入）。将长期笔记放在 `MEMORY.md` 并用记忆工具按需访问。
      </Tab>
    </Tabs>

  </Step>
</Steps>

现在在你的 Discord 服务器创建一些频道并开始聊天。你的 agent 能看到频道名称，每个频道有自己的隔离 session — 所以你可以设置 `#coding`、`#home`、`#research` 或适合你工作流程的任何内容。

## 运行时模型

- Gateway 拥有 Discord 连接。
- 回复路由是确定性的：Discord 入站回复返回 Discord。
- 默认（`session.dmScope=main`)，私信共享 agent 主 session（`agent:main:main`)。
- Guild 频道是隔离的 session keys（`agent:<agentId>:discord:channel:<channelId>`）。
- 群组私信默认忽略（`channels.discord.dm.groupEnabled=false`)。
- 原生斜杠命令在隔离的命令 sessions（`agent:<agentId>:discord:slash:<userId>`）中运行，同时仍携带 `CommandTargetSessionKey` 到路由的对话 session。

## 论坛频道

Discord 论坛和媒体频道只接受线程帖子。OpenClaw 支持两种创建方式：

- 向论坛父级（`channel:<forumId>`）发送消息以自动创建线程。线程标题使用你消息的第一非空行。
- 使用 `openclaw message thread create` 直接创建线程。不要为论坛频道传递 `--message-id`。

示例：向论坛父级发送以创建线程

```bash
openclaw message send --channel discord --target channel:<forumId> \
  --message "主题标题\n帖子正文"
```

示例：显式创建论坛线程

```bash
openclaw message thread create --channel discord --target channel:<forumId> \
  --thread-name "主题标题" --message "帖子正文"
```

论坛父级不接受 Discord components。如果需要 components，发送到线程本身（`channel:<threadId>`）。

## 交互组件

OpenClaw 支持 agent 消息的 Discord components v2 容器。使用带 `components` payload 的消息工具。交互结果作为正常入站消息路由回 agent，并遵循现有 Discord `replyToMode` 设置。

支持的块：

- `text`、`section`、`separator`、`actions`、`media-gallery`、`file`
- Action rows 最多允许 5 个按钮或单个选择菜单
- Select 类型：`string`、`user`、`role`、`mentionable`、`channel`

默认情况下，components 是单次使用的。设置 `components.reusable=true` 以允许按钮、选择和表单多次使用直到过期。

要限制谁可以点击按钮，在该按钮上设置 `allowedUsers`（Discord user IDs、tags 或 `*`）。配置后，未匹配用户收到临时拒绝。

`/model` 和 `/models` 斜杠命令打开交互式模型选择器，带有提供者和模型下拉菜单以及提交步骤。选择器回复是临时的，仅调用用户可以使用。

文件附件：

- `file` 块必须指向附件引用（`attachment://<filename>`）
- 通过 `media`/`path`/`filePath` 提供附件（单文件）；对多个文件使用 `media-gallery`
- 使用 `filename` 在应匹配附件引用时覆盖上传名称

模态表单：

- 添加 `components.modal`，最多 5 个字段
- 字段类型：`text`、`checkbox`、`radio`、`select`、`role-select`、`user-select`
- OpenClaw 自动添加触发按钮

示例：

```json5
{
  channel: "discord",
  action: "send",
  to: "channel:123456789012345678",
  message: "可选备用文本",
  components: {
    reusable: true,
    text: "选择路径",
    blocks: [
      {
        type: "actions",
        buttons: [
          {
            label: "Approve",
            style: "success",
            allowedUsers: ["123456789012345678"],
          },
          { label: "Decline", style: "danger" },
        ],
      },
      {
        type: "actions",
        select: {
          type: "string",
          placeholder: "选择选项",
          options: [
            { label: "Option A", value: "a" },
            { label: "Option B", value: "b" },
          ],
        },
      },
    ],
    modal: {
      title: "详情",
      triggerLabel: "打开表单",
      fields: [
        { type: "text", label: "Requester" },
        {
          type: "select",
          label: "Priority",
          options: [
            { label: "Low", value: "low" },
            { label: "High", value: "high" },
          ],
        },
      ],
    },
  },
}
```

## 访问控制和路由

<Tabs>
  <Tab title="私信策略">
    `channels.discord.dmPolicy` 控制私信访问（旧版：`channels.discord.dm.policy`)：

    - `pairing`（默认）
    - `allowlist`
    - `open`（需要 `channels.discord.allowFrom` 包含 `"*"`；旧版：`channels.discord.dm.allowFrom`)
    - `disabled`

    如果私信策略不是 open，未知用户被阻止（或在 `pairing` 模式下提示配对）。

    多账号优先级：

    - `channels.discord.accounts.default.allowFrom` 仅适用于 `default` 账号。
    - 命名账号在其自己的 `allowFrom` 未设置时继承 `channels.discord.allowFrom`。
    - 命名账号不继承 `channels.discord.accounts.default.allowFrom`。

    发送私信目标格式：

    - `user:<id>`
    - `<@id>` mention

    裸数字 ID 是模糊的并被拒绝，除非提供明确的用户/频道目标类型。

  </Tab>

  <Tab title="Guild 策略">
    Guild 处理由 `channels.discord.groupPolicy` 控制：

    - `open`
    - `allowlist`
    - `disabled`

    当 `channels.discord` 存在时，安全基线是 `allowlist`。

    `allowlist` 行为：

    - guild 必须匹配 `channels.discord.guilds`（推荐 `id`，也接受 slug）
    - 可选发送者白名单：`users`（推荐稳定 IDs）和 `roles`（仅 role IDs）；如果任一配置，发送者在匹配 `users` 或 `roles` 时被允许
    - 直接名称/tag 匹配默认禁用；仅在紧急兼容模式下启用 `channels.discord.dangerouslyAllowNameMatching: true`
    - `users` 支持名称/tags，但 IDs 更安全；`openclaw security audit` 在使用名称/tag 条目时警告
    - 如果 guild 有 `channels` 配置，未列出的频道被拒绝
    - 如果 guild 没有 `channels` 块，该白名单 guild 中的所有频道被允许

    示例：

```json5
{
  channels: {
    discord: {
      groupPolicy: "allowlist",
      guilds: {
        "123456789012345678": {
          requireMention: true,
          ignoreOtherMentions: true,
          users: ["987654321098765432"],
          roles: ["123456789012345678"],
          channels: {
            general: { allow: true },
            help: { allow: true, requireMention: true },
          },
        },
      },
    },
  },
}
```

    如果仅设置 `DISCORD_BOT_TOKEN` 且不创建 `channels.discord` 块，运行时回退为 `groupPolicy="allowlist"`（日志中有警告），即使 `channels.defaults.groupPolicy` 为 `open`。

  </Tab>

  <Tab title="提及和群组私信">
    Guild 消息默认有提及门控。

    提及检测包括：

    - 显式 bot mention
    - 配置的提及模式（`agents.list[].groupChat.mentionPatterns`，回退 `messages.groupChat.mentionPatterns`)
    - 支持情况下的隐式回复-bot 行为

    `requireMention` 按 guild/频道配置（`channels.discord.guilds...`)。
    `ignoreOtherMentions` 可选丢弃提及其他用户/role 但不是 bot 的消息（排除 @everyone/@here)。

    群组私信：

    - 默认：忽略（`dm.groupEnabled=false`)
    - 通过 `dm.groupChannels`（频道 IDs 或 slugs）可选白名单

  </Tab>
</Tabs>

### 基于 Role 的 agent 路由

使用 `bindings[].match.roles` 按 role ID 将 Discord guild 成员路由到不同 agent。基于 role 的绑定仅接受 role IDs，在 peer 或父级-peer 绑定之后、仅 guild 绑定之前评估。如果绑定还设置其他匹配字段（例如 `peer` + `guildId` + `roles`），所有配置字段必须匹配。

```json5
{
  bindings: [
    {
      agentId: "opus",
      match: {
        channel: "discord",
        guildId: "123456789012345678",
        roles: ["111111111111111111"],
      },
    },
    {
      agentId: "sonnet",
      match: {
        channel: "discord",
        guildId: "123456789012345678",
      },
    },
  ],
}
```

## Developer Portal 设置

<AccordionGroup>
  <Accordion title="创建应用和 bot">

    1. Discord Developer Portal -> **Applications** -> **New Application**
    2. **Bot** -> **Add Bot**
    3. 复制 bot token

  </Accordion>

  <Accordion title="特权 intents">
    在 **Bot -> Privileged Gateway Intents**，启用：

    - Message Content Intent
    - Server Members Intent（推荐）

    Presence intent 是可选的，仅在需要接收 presence 更新时需要。设置 bot presence（`setPresence`) 不需要为成员启用 presence 更新。

  </Accordion>

  <Accordion title="OAuth scopes 和基线权限">
    OAuth URL 生成器：

    - scopes：`bot`、`applications.commands`

    典型基线权限：

    - View Channels
    - Send Messages
    - Read Message History
    - Embed Links
    - Attach Files
    - Add Reactions（可选）

    除非明确需要，避免 `Administrator`。

  </Accordion>

  <Accordion title="复制 IDs">
    启用 Discord Developer Mode，然后复制：

    - server ID
    - channel ID
    - user ID

    在 OpenClaw 配置中优先使用数字 IDs，以便可靠审计和探测。

  </Accordion>
</AccordionGroup>

## 原生命令和命令认证

- `commands.native` 默认为 `"auto"` 并为 Discord 启用。
- 按频道覆盖：`channels.discord.commands.native`。
- `commands.native=false` 显式清除之前注册的 Discord 原生命令。
- 原生命令认证使用与正常消息处理相同的 Discord 白名单/策略。
- 命令可能仍在 Discord UI 中对未授权用户可见；执行仍强制 OpenClaw 认证并返回"未授权"。

请参阅 [斜杠命令](/tools/slash-commands) 了解命令目录和行为。

默认斜杠命令设置：

- `ephemeral: true`

## 功能详情

<AccordionGroup>
  <Accordion title="回复标签和原生回复">
    Discord 支持 agent 输出中的回复标签：

    - `[[reply_to_current]]`
    - `[[reply_to:<id>]]`

    由 `channels.discord.replyToMode` 控制：

    - `off`（默认）
    - `first`
    - `all`

    注意：`off` 禁用隐式回复线程。显式 `[[reply_to_*]]` 标签仍被遵守。

    消息 IDs 在上下文/历史中提供，以便 agent 可以定位特定消息。

  </Accordion>

  <Accordion title="实时流预览">
    OpenClaw 可以通过发送临时消息并在文本到达时编辑来流式传输草稿回复。

    - `channels.discord.streaming` 控制预览流式传输（`off` | `partial` | `block` | `progress`，默认：`off`)。
    - 默认保持 `off`，因为 Discord 预览编辑可能很快触及速率限制，特别是当多个 bot 或 gateways 共享同一账号或 guild 流量时。
    - `progress` 为跨频道一致性被接受，在 Discord 上映射为 `partial`。
    - `channels.discord.streamMode` 是旧别名并自动迁移。
    - `partial` 在 tokens 到达时编辑单个预览消息。
    - `block` 发送草稿大小的块（使用 `draftChunk` 调整大小和断点）。

    示例：

```json5
{
  channels: {
    discord: {
      streaming: "partial",
    },
  },
}
```

    `block` 模式分块默认（钳制到 `channels.discord.textChunkLimit`)：

```json5
{
  channels: {
    discord: {
      streaming: "block",
      draftChunk: {
        minChars: 200,
        maxChars: 800,
        breakPreference: "paragraph",
      },
    },
  },
}
```

    预览流式传输仅文本；媒体回复回退到正常发送。

    注意：预览流式传输与分块流式传输分开。当为 Discord 显式启用分块流式传输时，OpenClaw 跳过预览流以避免双重流式传输。

  </Accordion>

  <Accordion title="历史、上下文和线程行为">
    Guild 历史上下文：

    - `channels.discord.historyLimit` 默认 `20`
    - 回退：`messages.groupChat.historyLimit`
    - `0` 禁用

    私信历史控制：

    - `channels.discord.dmHistoryLimit`
    - `channels.discord.dms["<user_id>"].historyLimit`

    线程行为：

    - Discord 线程作为频道 sessions 路由
    - 父线程元数据可用于父级-session 链接
    - 线程配置继承父频道配置，除非存在线程特定条目

    频道主题作为**不受信任**上下文注入（不是系统提示）。
    回复和引用消息上下文目前保持原样接收。
    Discord 白名单主要控制谁可以触发 agent，不是完整的补充上下文删除边界。

  </Accordion>

  <Accordion title="Subagent 的线程绑定 sessions">
    Discord 可以将线程绑定到 session 目标，以便该线程中的后续消息保持路由到同一 session（包括 subagent sessions）。

    命令：

    - `/focus <target>` 将当前/新线程绑定到 subagent/session 目标
    - `/unfocus` 移除当前线程绑定
    - `/agents` 显示活跃运行和绑定状态
    - `/session idle <duration|off>` 检查/更新聚焦绑定的不活动自动取消聚焦
    - `/session max-age <duration|off>` 检查/更新聚焦绑定的硬性最大年龄

    配置：

```json5
{
  session: {
    threadBindings: {
      enabled: true,
      idleHours: 24,
      maxAgeHours: 0,
    },
  },
  channels: {
    discord: {
      threadBindings: {
        enabled: true,
        idleHours: 24,
        maxAgeHours: 0,
        spawnSubagentSessions: false, // opt-in
      },
    },
  },
}
```

    注意：

    - `session.threadBindings.*` 设置全局默认。
    - `channels.discord.threadBindings.*` 覆盖 Discord 行为。
    - `spawnSubagentSessions` 必须为 true 以自动创建/绑定 `sessions_spawn({ thread: true })` 的线程。
    - `spawnAcpSessions` 必须为 true 以自动创建/绑定 ACP 的线程（`/acp spawn ... --thread ...` 或 `sessions_spawn({ runtime: "acp", thread: true })`)。
    - 如果账号禁用线程绑定，`/focus` 和相关线程绑定操作不可用。

    请参阅 [Sub-agents](/tools/subagents)、[ACP Agents](/tools/acp-agents) 和 [配置参考](/gateway/configuration-reference)。

  </Accordion>

  <Accordion title="持久 ACP 频道绑定">
    对于稳定的"常驻" ACP workspaces，配置顶层类型 ACP 绑定指向 Discord 对话。

    配置路径：

    - 带 `type: "acp"` 和 `match.channel: "discord"` 的 `bindings[]`

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
        channel: "discord",
        accountId: "default",
        peer: { kind: "channel", id: "222222222222222222" },
      },
      acp: { label: "codex-main" },
    },
  ],
  channels: {
    discord: {
      guilds: {
        "111111111111111111": {
          channels: {
            "222222222222222222": {
              requireMention: false,
            },
          },
        },
      },
    },
  },
}
```

    注意：

    - `/acp spawn codex --bind here` 原地绑定当前 Discord 频道或线程，并保持后续消息路由到同一 ACP session。
    - 这仍可能意味着"启动新的 Codex ACP session"，但它本身不创建新的 Discord 线程。现有频道保持为聊天界面。
    - Codex 可能仍在其自己的 `cwd` 或磁盘后端 workspace 中运行。那个 workspace 是运行时状态，不是 Discord 线程。
    - 线程消息可以继承父频道 ACP 绑定。
    - 在绑定频道或线程中，`/new` 和 `/reset` 原地重置同一 ACP session。
    - 临时线程绑定仍工作，可以在活跃时覆盖目标解析。
    - `spawnAcpSessions` 仅在 OpenClaw 需要通过 `--thread auto|here` 创建/绑定子线程时需要。它对于当前频道中的 `/acp spawn ... --bind here` 不需要。

    请参阅 [ACP Agents](/tools/acp-agents) 了解绑定行为详情。

  </Accordion>

  <Accordion title="表情反应通知">
    按 guild 的表情反应通知模式：

    - `off`
    - `own`（默认）
    - `all`
    - `allowlist`（使用 `guilds.<id>.users`)

    表情反应事件转换为系统事件并附加到路由的 Discord session。

  </Accordion>

  <Accordion title="确认表情反应">
    `ackReaction` 在 OpenClaw 处理入站消息时发送确认表情。

    解析顺序：

    - `channels.discord.accounts.<accountId>.ackReaction`
    - `channels.discord.ackReaction`
    - `messages.ackReaction`
    - agent 身份表情回退（`agents.list[].identity.emoji`，否则 "👀")

    注意：

    - Discord 接受 unicode 表情或自定义表情名称。
    - 使用 `""` 为频道或账号禁用表情反应。

  </Accordion>

  <Accordion title="配置写入">
    频道发起的配置写入默认启用。

    这影响 `/config set|unset` 流程（当命令功能启用时）。

    禁用：

```json5
{
  channels: {
    discord: {
      configWrites: false,
    },
  },
}
```

  </Accordion>

  <Accordion title="Gateway 代理">
    通过 `channels.discord.proxy` 将 Discord gateway WebSocket 流量和启动 REST 查找（应用 ID + 白名单解析）路由通过 HTTP(S) 代理。

```json5
{
  channels: {
    discord: {
      proxy: "http://proxy.example:8080",
    },
  },
}
```

    按账号覆盖：

```json5
{
  channels: {
    discord: {
      accounts: {
        primary: {
          proxy: "http://proxy.example:8080",
        },
      },
    },
  },
}
```

  </Accordion>

  <Accordion title="PluralKit 支持">
    启用 PluralKit 解析以将代理消息映射到系统成员身份：

```json5
{
  channels: {
    discord: {
      pluralkit: {
        enabled: true,
        token: "pk_live_...", // optional; needed for private systems
      },
    },
  },
}
```

    注意：

    - 白名单可以使用 `pk:<memberId>`
    - 成员显示名称仅在 `channels.discord.dangerouslyAllowNameMatching: true` 时按名称/slug 匹配
    - 查找使用原始消息 ID 并有时间窗口限制
    - 如果查找失败，代理消息被视为 bot 消息并被丢弃，除非 `allowBots=true`

  </Accordion>

  <Accordion title="Presence 配置">
    当你设置状态或活动字段，或启用自动 presence 时，Presence 更新被应用。

    仅状态示例：

```json5
{
  channels: {
    discord: {
      status: "idle",
    },
  },
}
```

    活动示例（自定义状态是默认活动类型）：

```json5
{
  channels: {
    discord: {
      activity: "Focus time",
      activityType: 4,
    },
  },
}
```

    流式传输示例：

```json5
{
  channels: {
    discord: {
      activity: "Live coding",
      activityType: 1,
      activityUrl: "https://twitch.tv/openclaw",
    },
  },
}
```

    活动类型映射：

    - 0：Playing
    - 1：Streaming（需要 `activityUrl`)
    - 2：Listening
    - 3：Watching
    - 4：Custom（使用活动文本作为状态；表情可选）
    - 5：Competing

    自动 presence 示例（运行时健康信号）：

```json5
{
  channels: {
    discord: {
      autoPresence: {
        enabled: true,
        intervalMs: 30000,
        minUpdateIntervalMs: 15000,
        exhaustedText: "token exhausted",
      },
    },
  },
}
```

    自动 presence 将运行时可用性映射到 Discord 状态：healthy => online，degraded 或 unknown => idle，exhausted 或 unavailable => dnd。可选文本覆盖：

    - `autoPresence.healthyText`
    - `autoPresence.degradedText`
    - `autoPresence.exhaustedText`（支持 `{reason}` 占位符）

  </Accordion>

  <Accordion title="Discord 中的 Exec 批准">
    Discord 支持私信中基于按钮的 exec 批准，并可可选地在原始频道中发布批准提示。

    配置路径：

    - `channels.discord.execApprovals.enabled`
    - `channels.discord.execApprovals.approvers`（可选；在可能时回退到从 `allowFrom` 和显式私信 `defaultTo` 推断的所有者 IDs）
    - `channels.discord.execApprovals.target`（`dm` | `channel` | `both`，默认：`dm`)
    - `agentFilter`、`sessionFilter`、`cleanupAfterResolve`

    当 `enabled` 未设置或 `"auto"` 且至少有一个批准者可解析（从 `execApprovals.approvers` 或账号现有所有者配置），Discord 自动启用原生 exec 批准。设置 `enabled: false` 以显式禁用 Discord 作为原生批准客户端。

    当 `target` 为 `channel` 或 `both` 时，批准提示在频道中可见。仅解析的批准者可以使用按钮；其他用户收到临时拒绝。批准提示包含命令文本，所以仅在信任频道中启用频道发送。如果频道 ID 无法从 session key 派生，OpenClaw 回退到私信发送。

    Discord 也渲染其他聊天频道使用的共享批准按钮。原生 Discord adapter 主要添加批准者私信路由和频道分发。

    此处理器的 Gateway 认证使用与其他 Gateway 客户端相同的共享凭据解析合约：

    - env-first 本地认证（`OPENCLAW_GATEWAY_TOKEN` / `OPENCLAW_GATEWAY_PASSWORD` 然后 `gateway.auth.*`)
    - 在本地模式，`gateway.remote.*` 仅在 `gateway.auth.*` 未设置时作为回退；配置但未解析的本地 SecretRefs 失败关闭
    - 适用时的远程模式支持通过 `gateway.remote.*`
    - URL 覆盖是覆盖安全的：CLI 覆盖不复用隐式凭据，环境覆盖仅使用环境凭据

    Exec 批准默认 30 分钟后过期。如果批准因未知批准 IDs 失败，验证批准者解析和功能启用。

    相关文档：[Exec 批准](/tools/exec-approvals)

  </Accordion>
</AccordionGroup>

## 工具和操作门控

Discord 消息操作包括消息发送、频道管理、审核、presence 和元数据操作。

核心示例：

- 消息发送：`sendMessage`、`readMessages`、`editMessage`、`deleteMessage`、`threadReply`
- 表情反应：`react`、`reactions`、`emojiList`
- 审核：`timeout`、`kick`、`ban`
- presence：`setPresence`

操作门控位于 `channels.discord.actions.*`。

默认门控行为：

| 操作组                                                                                                                                                                   | 默认 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| reactions、messages、threads、pins、polls、search、memberInfo、roleInfo、channelInfo、channels、voiceStatus、events、stickers、emojiUploads、stickerUploads、permissions | 启用 |
| roles                                                                                                                                                                    | 禁用 |
| moderation                                                                                                                                                               | 禁用 |
| presence                                                                                                                                                                 | 禁用 |

## Components v2 UI

OpenClaw 使用 Discord components v2 用于 exec 批准和跨上下文标记。Discord 消息操作也可以接受 `components` 用于自定义 UI（高级；需要通过 discord 工具构建 component payload），而旧版 `embeds` 仍可用但不推荐。

- `channels.discord.ui.components.accentColor` 设置 Discord component 容器使用的强调色（十六进制）。
- 按账号设置 `channels.discord.accounts.<id>.ui.components.accentColor`。
- 当 components v2 存在时，`embeds` 被忽略。

示例：

```json5
{
  channels: {
    discord: {
      ui: {
        components: {
          accentColor: "#5865F2",
        },
      },
    },
  },
}
```

## 语音频道

OpenClaw 可以加入 Discord 语音频道进行实时、连续对话。这与语音消息附件分开。

要求：

- 启用原生命令（`commands.native` 或 `channels.discord.commands.native`)。
- 配置 `channels.discord.voice`。
- Bot 需要在目标语音频道有 Connect + Speak 权限。

使用 Discord 专用原生命令 `/vc join|leave|status` 控制 sessions。命令使用账号默认 agent，并遵循与其他 Discord 命令相同的白名单和群组策略规则。

自动加入示例：

```json5
{
  channels: {
    discord: {
      voice: {
        enabled: true,
        autoJoin: [
          {
            guildId: "123456789012345678",
            channelId: "234567890123456789",
          },
        ],
        daveEncryption: true,
        decryptionFailureTolerance: 24,
        tts: {
          provider: "openai",
          openai: { voice: "alloy" },
        },
      },
    },
  },
}
```

注意：

- `voice.tts` 仅覆盖语音播放的 `messages.tts`。
- 语音转录轮次从 Discord `allowFrom`（或 `dm.allowFrom`) 派生所有者状态；非所有者说话者无法访问仅所有者工具（如 `gateway` 和 `cron`)。
- 语音默认启用；设置 `channels.discord.voice.enabled=false` 禁用。
- `voice.daveEncryption` 和 `voice.decryptionFailureTolerance` 传递给 `@discordjs/voice` 加入选项。
- 如未设置，`@discordjs/voice` 默认为 `daveEncryption=true` 和 `decryptionFailureTolerance=24`。
- OpenClaw 也监控接收解密失败并在短时间内重复失败后通过离开/重新加入语音频道自动恢复。
- 如果接收日志重复显示 `DecryptionFailed(UnencryptedWhenPassthroughDisabled)`，这可能是 [discord.js #11419](https://github.com/discordjs/discord.js/issues/11419) 中跟踪的上游 `@discordjs/voice` 接收 bug。

## 语音消息

Discord 语音消息显示波形预览，需要 OGG/Opus 音频加元数据。OpenClaw 自动生成波形，但需要 gateway 主机上可用 `ffmpeg` 和 `ffprobe` 以检查和转换音频文件。

要求和限制：

- 提供**本地文件路径**（URLs 被拒绝）。
- 禁止文本内容（Discord 不允许同一 payload 中有文本 + 语音消息）。
- 接受任何音频格式；OpenClaw 在需要时转换为 OGG/Opus。

示例：

```bash
message(action="send", channel="discord", target="channel:123", path="/path/to/audio.mp3", asVoice=true)
```

## 故障排除

<AccordionGroup>
  <Accordion title="使用了不允许的 intents 或 bot 看不到 guild 消息">

    - 启用 Message Content Intent
    - 当你依赖用户/成员解析时启用 Server Members Intent
    - 更改 intents 后重启 gateway

  </Accordion>

  <Accordion title="Guild 消息意外被阻止">

    - 验证 `groupPolicy`
    - 验证 `channels.discord.guilds` 下的 guild 白名单
    - 如果 guild `channels` 映射存在，仅列出的频道被允许
    - 验证 `requireMention` 行为和提及模式

    有用检查：

```bash
openclaw doctor
openclaw channels status --probe
openclaw logs --follow
```

  </Accordion>

  <Accordion title="Require mention false 但仍被阻止">
    常见原因：

    - `groupPolicy="allowlist"` 没有匹配的 guild/频道白名单
    - `requireMention` 配置在错误位置（必须在 `channels.discord.guilds` 或频道条目下）
    - 发送者被 guild/频道 `users` 白名单阻止

  </Accordion>

  <Accordion title="长时间运行的处理器超时或重复回复">

    典型日志：

    - `Listener DiscordMessageListener timed out after 30000ms for event MESSAGE_CREATE`
    - `Slow listener detected ...`
    - `discord inbound worker timed out after ...`

    Listener 预算旋钮：

    - 单账号：`channels.discord.eventQueue.listenerTimeout`
    - 多账号：`channels.discord.accounts.<accountId>.eventQueue.listenerTimeout`

    Worker 运行超时旋钮：

    - 单账号：`channels.discord.inboundWorker.runTimeoutMs`
    - 多账号：`channels.discord.accounts.<accountId>.inboundWorker.runTimeoutMs`
    - 默认：`1800000`（30 分钟）；设置 `0` 禁用

    推荐基线：

```json5
{
  channels: {
    discord: {
      accounts: {
        default: {
          eventQueue: {
            listenerTimeout: 120000,
          },
          inboundWorker: {
            runTimeoutMs: 1800000,
          },
        },
      },
    },
  },
}
```

    使用 `eventQueue.listenerTimeout` 处理慢 listener 设置，仅当你想要为排队的 agent 轮次设置单独安全阀时使用 `inboundWorker.runTimeoutMs`。

  </Accordion>

  <Accordion title="权限审计不匹配">
    `channels status --probe` 权限检查仅对数字频道 IDs 有效。

    如果你使用 slug 键，运行时匹配仍可工作，但探测无法完全验证权限。

  </Accordion>

  <Accordion title="私信和配对问题">

    - 私信禁用：`channels.discord.dm.enabled=false`
    - 私信策略禁用：`channels.discord.dmPolicy="disabled"`（旧版：`channels.discord.dm.policy`)
    - 在 `pairing` 模式下等待配对批准

  </Accordion>

  <Accordion title="Bot 到 bot 循环">
    默认情况下 bot 作者消息被忽略。

    如果你设置 `channels.discord.allowBots=true`，使用严格的提及和白名单规则以避免循环行为。
    优先使用 `channels.discord.allowBots="mentions"` 以仅接受提及 bot 的 bot 消息。

  </Accordion>

  <Accordion title="语音 STT 因 DecryptionFailed(...) 丢失">

    - 保持 OpenClaw 最新（`openclaw update`) 以便 Discord 语音接收恢复逻辑存在
    - 确认 `channels.discord.voice.daveEncryption=true`（默认）
    - 从 `channels.discord.voice.decryptionFailureTolerance=24`（上游默认）开始，仅在需要时调整
    - 观察日志：
      - `discord voice: DAVE decrypt failures detected`
      - `discord voice: repeated decrypt failures; attempting rejoin`
    - 如果自动重新加入后失败继续，收集日志并与 [discord.js #11419](https://github.com/discordjs/discord.js/issues/11419) 对比

  </Accordion>
</AccordionGroup>

## 配置参考指针

主要参考：

- [配置参考 - Discord](/gateway/configuration-reference#discord)

高信号 Discord 字段：

- 启动/认证：`enabled`、`token`、`accounts.*`、`allowBots`
- 策略：`groupPolicy`、`dm.*`、`guilds.*`、`guilds.*.channels.*`
- 命令：`commands.native`、`commands.useAccessGroups`、`configWrites`、`slashCommand.*`
- 事件队列：`eventQueue.listenerTimeout`（listener 预算）、`eventQueue.maxQueueSize`、`eventQueue.maxConcurrency`
- 入站 worker：`inboundWorker.runTimeoutMs`
- 回复/历史：`replyToMode`、`historyLimit`、`dmHistoryLimit`、`dms.*.historyLimit`
- 发送：`textChunkLimit`、`chunkMode`、`maxLinesPerMessage`
- 流式传输：`streaming`（旧别名：`streamMode`)、`draftChunk`、`blockStreaming`、`blockStreamingCoalesce`
- 媒体/重试：`mediaMaxMb`、`retry`
  - `mediaMaxMb` 限制出站 Discord 上传（默认：`8MB`)
- 操作：`actions.*`
- presence：`activity`、`status`、`activityType`、`activityUrl`
- UI：`ui.components.accentColor`
- 功能：`threadBindings`、顶层 `bindings[]`（`type: "acp"`）、`pluralkit`、`execApprovals`、`intents`、`agentComponents`、`heartbeat`、`responsePrefix`

## 安全和运维

- 将 bot tokens 视为秘密（监督环境中首选 `DISCORD_BOT_TOKEN`)。
- 授予最小权限 Discord 权限。
- 如果命令部署/状态过期，重启 gateway 并用 `openclaw channels status --probe` 重新检查。

## 相关内容

- [配对](/channels/pairing)
- [群组](/channels/groups)
- [频道路由](/channels/channel-routing)
- [安全](/gateway/security)
- [多 agent 路由](/concepts/multi-agent)
- [故障排除](/channels/troubleshooting)
- [斜杠命令](/tools/slash-commands)
