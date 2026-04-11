---
summary: "Legacy iMessage support via imsg (JSON-RPC over stdio). New setups should use BlueBubbles."
read_when:
  - Setting up iMessage support
  - Debugging iMessage send/receive
title: "iMessage"
---

# iMessage（旧版：imsg）

<Warning>
对于新的 iMessage 部署，请使用 <a href="/channels/bluebubbles">BlueBubbles</a>。

`imsg` 集成是旧版，可能在未来版本中移除。
</Warning>

状态：旧版外部 CLI 集成。Gateway 启动 `imsg rpc`并通过 stdio 上的 JSON-RPC 通信（无单独守护进程/端口）。

<CardGroup cols={3}>
  <Card title="BlueBubbles（推荐）" icon="message-circle" href="/channels/bluebubbles">
    新安装首选 iMessage 路径。
  </Card>
  <Card title="配对" icon="link" href="/channels/pairing">
    iMessage 私信默认为配对模式。
  </Card>
  <Card title="配置参考" icon="settings" href="/gateway/configuration-reference#imessage">
    完整 iMessage 字段参考。
  </Card>
</CardGroup>

## 快速设置

<Tabs>
  <Tab title="本地 Mac（快速路径）">
    <Steps>
      <Step title="安装并验证 imsg">

```bash
brew install steipete/tap/imsg
imsg rpc --help
```

      </Step>

      <Step title="配置 OpenClaw">

```json5
{
  channels: {
    imessage: {
      enabled: true,
      cliPath: "/usr/local/bin/imsg",
      dbPath: "/Users/<you>/Library/Messages/chat.db",
    },
  },
}
```

      </Step>

      <Step title="启动 gateway">

```bash
openclaw gateway
```

      </Step>

      <Step title="批准首次私信配对（默认 dmPolicy）">

```bash
openclaw pairing list imessage
openclaw pairing approve imessage <CODE>
```

        配对请求 1 小时后过期。
      </Step>
    </Steps>

  </Tab>

  <Tab title="通过 SSH 远程 Mac">
    OpenClaw 仅需要 stdio 兼容的 `cliPath`，所以你可以将 `cliPath` 指向一个通过 SSH 连接到远程 Mac 并运行 `imsg` 的包装脚本。

```bash
#!/usr/bin/env bash
exec ssh -T gateway-host imsg "$@"
```

    启用附件时的推荐配置：

```json5
{
  channels: {
    imessage: {
      enabled: true,
      cliPath: "~/.openclaw/scripts/imsg-ssh",
      remoteHost: "user@gateway-host", // used for SCP attachment fetches
      includeAttachments: true,
      // Optional: override allowed attachment roots.
      // Defaults include /Users/*/Library/Messages/Attachments
      attachmentRoots: ["/Users/*/Library/Messages/Attachments"],
      remoteAttachmentRoots: ["/Users/*/Library/Messages/Attachments"],
    },
  },
}
```

    如果 `remoteHost` 未设置，OpenClaw 尝试通过解析 SSH 包装脚本自动检测它。
    `remoteHost` 必须是 `host` 或 `user@host`（无空格或 SSH 选项）。
    OpenClaw 对 SCP 使用严格 host-key 检查，所以 relay host key 必须已存在于 `~/.ssh/known_hosts`。
    附件路径针对允许的根（`attachmentRoots` / `remoteAttachmentRoots`）验证。

  </Tab>
</Tabs>

## 要求和权限（macOS）

- 运行 `imsg` 的 Mac 上 Messages 必须已登录。
- 运行 OpenClaw/`imsg` 的进程上下文需要 Full Disk Access（Messages DB 访问）。
- 通过 Messages.app 发送消息需要 Automation 权限。

<Tip>
权限按进程上下文授予。如果 gateway 无头运行（LaunchAgent/SSH），在同一上下文中运行一次性交互命令以触发提示：

```bash
imsg chats --limit 1
# 或
imsg send <handle> "test"
```

</Tip>

## 访问控制和路由

<Tabs>
  <Tab title="私信策略">
    `channels.imessage.dmPolicy` 控制直接消息：

    - `pairing`（默认）
    - `allowlist`
    - `open`（需要 `allowFrom` 包含 `"*"`）
    - `disabled`

    白名单字段：`channels.imessage.allowFrom`。

    白名单条目可以是 handles 或聊天目标（`chat_id:*`、`chat_guid:*`、`chat_identifier:*`）。

  </Tab>

  <Tab title="群组策略 + 提及">
    `channels.imessage.groupPolicy` 控制群组处理：

    - `allowlist`（配置时默认）
    - `open`
    - `disabled`

    群组发送者白名单：`channels.imessage.groupAllowFrom`。

    运行时回退：如果 `groupAllowFrom` 未设置，iMessage 群组发送者检查在可用时回退到 `allowFrom`。
    运行时注意：如果 `channels.imessage` 完全缺失，运行时回退到 `groupPolicy="allowlist"` 并记录警告（即使设置了 `channels.defaults.groupPolicy`）。

    群组提及门控：

    - iMessage 无原生提及元数据
    - 提及检测使用正则模式（`agents.list[].groupChat.mentionPatterns`，回退 `messages.groupChat.mentionPatterns`)
    - 无配置模式时，提及门控无法强制

    来自授权发送者的控制命令可绕过群组中的提及门控。

  </Tab>

  <Tab title="Sessions 和确定性回复">
    - 私信使用直接路由；群组使用群组路由。
    - 默认 `session.dmScope=main`，iMessage 私信折叠入 agent 主 session。
    - 群组 sessions 隔离（`agent:<agentId>:imessage:group:<chat_id>`）。
    - 回复使用原始频道/目标元数据路由回 iMessage。

    类群组线程行为：

    某些多参与者 iMessage 线程可能以 `is_group=false` 到达。
    如果该 `chat_id` 显式配置在 `channels.imessage.groups` 下，OpenClaw 将其视为群组流量（群组门控 + 群组 session 隔离）。

  </Tab>
</Tabs>

## ACP 对话绑定

旧版 iMessage 聊天也可绑定到 ACP sessions。

快速操作流程：

- 在私信或允许的群组聊天中运行 `/acp spawn codex --bind here`。
- 该 iMessage 对话中的后续消息路由到生成的 ACP session。
- `/new` 和 `/reset` 原地重置同一绑定的 ACP session。
- `/acp close` 关闭 ACP session 并移除绑定。

通过顶层 `bindings[]` 条目配置持久绑定，使用 `type: "acp"` 和 `match.channel: "imessage"`。

`match.peer.id` 可使用：

- 规范化私信 handle 如 `+15555550123` 或 `user@example.com`
- `chat_id:<id>`（推荐用于稳定群组绑定）
- `chat_guid:<guid>`
- `chat_identifier:<identifier>`

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
        channel: "imessage",
        accountId: "default",
        peer: { kind: "group", id: "chat_id:123" },
      },
      acp: { label: "codex-group" },
    },
  ],
}
```

请参阅 [ACP Agents](/tools/acp-agents) 了解共享 ACP 绑定行为。

## 部署模式

<AccordionGroup>
  <Accordion title="专用 bot macOS 用户（独立 iMessage 身份）">
    使用专用 Apple ID 和 macOS 用户，以便 bot 流量与你的个人 Messages profile 隔离。

    典型流程：

    1. 创建/登录专用 macOS 用户。
    2. 在该用户中使用 bot Apple ID 登录 Messages。
    3. 在该用户安装 `imsg`。
    4. 创建 SSH wrapper 以便 OpenClaw 可在该用户上下文中运行 `imsg`。
    5. 将 `channels.imessage.accounts.<id>.cliPath` 和 `.dbPath` 指向该用户 profile。

    首次运行可能需要在该 bot 用户会话中进行 GUI 批准（Automation + Full Disk Access）。

  </Accordion>

  <Accordion title="通过 Tailscale 远程 Mac（示例）">
    典型拓扑：

    - gateway 在 Linux/VM 上运行
    - iMessage + `imsg` 在你的 tailnet 中 Mac 上运行
    - `cliPath` wrapper 使用 SSH 运行 `imsg`
    - `remoteHost` 启用 SCP 附件获取

    示例：

```json5
{
  channels: {
    imessage: {
      enabled: true,
      cliPath: "~/.openclaw/scripts/imsg-ssh",
      remoteHost: "bot@mac-mini.tailnet-1234.ts.net",
      includeAttachments: true,
      dbPath: "/Users/bot/Library/Messages/chat.db",
    },
  },
}
```

```bash
#!/usr/bin/env bash
exec ssh -T bot@mac-mini.tailnet-1234.ts.net imsg "$@"
```

    使用 SSH keys 以便 SSH 和 SCP 都是非交互式。
    先信任 host key（例如 `ssh bot@mac-mini.tailnet-1234.ts.net`）以便 `known_hosts` 填充。

  </Accordion>

  <Accordion title="多账号模式">
    iMessage 支持在 `channels.imessage.accounts` 下按账号配置。

    每个账号可覆盖字段如 `cliPath`、`dbPath`、`allowFrom`、`groupPolicy`、`mediaMaxMb`、历史设置和附件根白名单。

  </Accordion>
</AccordionGroup>

## 媒体、分块和发送目标

<AccordionGroup>
  <Accordion title="附件和媒体">
    - 入站附件摄取可选：`channels.imessage.includeAttachments`
    - 设置 `remoteHost` 时可通过 SCP 获取远程附件路径
    - 附件路径必须匹配允许的根：
      - `channels.imessage.attachmentRoots`（本地）
      - `channels.imessage.remoteAttachmentRoots`（远程 SCP 模式）
      - 默认根模式：`/Users/*/Library/Messages/Attachments`
    - SCP 使用严格 host-key 检查（`StrictHostKeyChecking=yes`)
    - 出站媒体大小使用 `channels.imessage.mediaMaxMb`（默认 16 MB）
  </Accordion>

  <Accordion title="出站分块">
    - 文本分块限制：`channels.imessage.textChunkLimit`（默认 4000)
    - 分块模式：`channels.imessage.chunkMode`
      - `length`（默认）
      - `newline`（段落优先分割）
  </Accordion>

  <Accordion title="寻址格式">
    优先显式目标：

    - `chat_id:123`（推荐用于稳定路由）
    - `chat_guid:...`
    - `chat_identifier:...`

    Handle 目标也支持：

    - `imessage:+1555...`
    - `sms:+1555...`
    - `user@example.com`

```bash
imsg chats --limit 20
```

  </Accordion>
</AccordionGroup>

## 配置写入

iMessage 默认允许频道发起的配置写入（用于 `commands.config: true` 时的 `/config set|unset`）。

禁用：

```json5
{
  channels: {
    imessage: {
      configWrites: false,
    },
  },
}
```

## 故障排除

<AccordionGroup>
  <Accordion title="imsg 未找到或 RPC 不支持">
    验证二进制和 RPC 支持：

```bash
imsg rpc --help
openclaw channels status --probe
```

    如果探测报告 RPC 不支持，更新 `imsg`。

  </Accordion>

  <Accordion title="私信被忽略">
    检查：

    - `channels.imessage.dmPolicy`
    - `channels.imessage.allowFrom`
    - 配对批准（`openclaw pairing list imessage`）

  </Accordion>

  <Accordion title="群组消息被忽略">
    检查：

    - `channels.imessage.groupPolicy`
    - `channels.imessage.groupAllowFrom`
    - `channels.imessage.groups` 白名单行为
    - 提及模式配置（`agents.list[].groupChat.mentionPatterns`）

  </Accordion>

  <Accordion title="远程附件失败">
    检查：

    - `channels.imessage.remoteHost`
    - `channels.imessage.remoteAttachmentRoots`
    - 从 gateway 主机的 SSH/SCP key 认证
    - gateway 主机上 `~/.ssh/known_hosts` 中存在 host key
    - 运行 Messages 的 Mac 上远程路径可读性

  </Accordion>

  <Accordion title="macOS 权限提示被错过">
    在同一用户/会话上下文的交互式 GUI 终端中重新运行并批准提示：

```bash
imsg chats --limit 1
imsg send <handle> "test"
```

    确认运行 OpenClaw/`imsg` 的进程上下文已授予 Full Disk Access + Automation。

  </Accordion>
</AccordionGroup>

## 配置参考指针

- [配置参考 - iMessage](/gateway/configuration-reference#imessage)
- [Gateway 配置](/gateway/configuration)
- [配对](/channels/pairing)
- [BlueBubbles](/channels/bluebubbles)

## 相关内容

- [频道概览](/channels) — 所有支持的频道
- [配对](/channels/pairing) — 私信认证和配对流程
- [群组](/channels/groups) — 群组聊天行为和提及门控
- [频道路由](/channels/channel-routing) — 消息的 session 路由
- [安全](/gateway/security) — 访问模型和加固
