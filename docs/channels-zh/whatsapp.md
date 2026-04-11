---
summary: "WhatsApp channel support, access controls, delivery behavior, and operations"
read_when:
  - Working on WhatsApp/web channel behavior or inbox routing
title: "WhatsApp"
---

# WhatsApp（Web channel）

状态：通过 WhatsApp Web（Baileys）生产就绪。Gateway 拥有链接的 session。

## 安装（按需）

- Onboarding（`openclaw onboard`）和 `openclaw channels add --channel whatsapp`
  第一次选择时提示安装 WhatsApp 插件。
- `openclaw channels login --channel whatsapp` 在
  插件不存在时也提供安装流程。
- Dev channel + git checkout：默认使用本地插件路径。
- Stable/Beta：默认使用 npm package `@openclaw/whatsapp`。

手动安装仍然可用：

```bash
openclaw plugins install @openclaw/whatsapp
```

<CardGroup cols={3}>
  <Card title="配对" icon="link" href="/channels/pairing">
    未知发送者默认 DM 策略是配对。
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
  <Step title="配置 WhatsApp 访问策略">

```json5
{
  channels: {
    whatsapp: {
      dmPolicy: "pairing",
      allowFrom: ["+15551234567"],
      groupPolicy: "allowlist",
      groupAllowFrom: ["+15551234567"],
    },
  },
}
```

  </Step>

  <Step title="链接 WhatsApp（QR）">

```bash
openclaw channels login --channel whatsapp
```

    对于特定账号：

```bash
openclaw channels login --channel whatsapp --account work
```

  </Step>

  <Step title="启动 Gateway">

```bash
openclaw gateway
```

  </Step>

  <Step title="批准第一条配对请求（如果使用配对模式）">

```bash
openclaw pairing list whatsapp
openclaw pairing approve whatsapp <CODE>
```

    配对请求 1 小时后过期。每个 channel 待处理请求上限 3。

  </Step>
</Steps>

<Note>
OpenClaw 推荐在可能时在单独号码上运行 WhatsApp。（Channel 元数据和设置流程为该设置优化，但也支持个人号码设置。）
</Note>

## 部署模式

<AccordionGroup>
  <Accordion title="专用号码（推荐）">
    这是最干净的运营模式：

    - WhatsApp 单独身份用于 OpenClaw
    - 更清晰的 DM 白名单和路由边界
    - 降低自我聊天混淆几率

    最小策略模式：

    ```json5
    {
      channels: {
        whatsapp: {
          dmPolicy: "allowlist",
          allowFrom: ["+15551234567"],
        },
      },
    }
    ```

  </Accordion>

  <Accordion title="个人号码回退">
    Onboarding 支持个人号码模式并写入自我聊天友好基线：

    - `dmPolicy: "allowlist"`
    - `allowFrom` 包含你的个人号码
    - `selfChatMode: true`

    在运行时，自我聊天保护基于链接的自我号码和 `allowFrom`。

  </Accordion>

  <Accordion title="WhatsApp Web-only channel 范围">
    消息平台 channel 在当前 OpenClaw channel 架构中是基于 WhatsApp Web 的（`Baileys`）。

    在内置聊天 channel 注册表中没有单独的 Twilio WhatsApp 消息 channel。

  </Accordion>
</AccordionGroup>

## 运行时模型

- Gateway 拥有 WhatsApp socket 和重连循环。
- 出站发送需要目标账号有活跃 WhatsApp 监听器。
- 状态和广播聊天被忽略（`@status`、`@broadcast`）。
- 直接聊天使用 DM session 规则（`session.dmScope`；默认 `main` 将 DM 折叠为 agent 主 session）。
- 群组 session 隔离（`agent:<agentId>:whatsapp:group:<jid>`）。

## 访问控制和激活

<Tabs>
  <Tab title="DM 策略">
    `channels.whatsapp.dmPolicy` 控制直接聊天访问：

    - `pairing`（默认）
    - `allowlist`
    - `open`（需要 `allowFrom` 包含 `"*"`）
    - `disabled`

    `allowFrom` 接受 E.164 格式号码（内部规范化）。

    多账号覆盖：`channels.whatsapp.accounts.<id>.dmPolicy`（和 `allowFrom`）优先于 channel 级别默认。

    运行时行为细节：

    - 配对持久化在 channel allow-store 并与配置的 `allowFrom` 合并
    - 如果无白名单配置，链接的自我号码默认被允许
    - 出站 `fromMe` DM 从不自动配对

  </Tab>

  <Tab title="群组策略 + 白名单">
    群组访问有两层：

    1. **群组成员白名单**（`channels.whatsapp.groups`）
       - 如果 `groups` 略过，所有群组有资格
       - 如果 `groups` 存在，作为群组白名单（`"*"` 允许）

    2. **群组发送者策略**（`channels.whatsapp.groupPolicy` + `groupAllowFrom`）
       - `open`：发送者白名单绕过
       - `allowlist`：发送者必须匹配 `groupAllowFrom`（或 `*`）
       - `disabled`：阻止所有群组入站

    发送者白名单回退：

    - 如果 `groupAllowFrom` 未设置，运行时当可用时回退到 `allowFrom`
    - 发送者白名单在提及/回复激活前评估

    注意：如果完全无 `channels.whatsapp` 块，运行时群组策略回退为 `allowlist`（带警告日志），即使设置了 `channels.defaults.groupPolicy`。

  </Tab>

  <Tab title="提及 + /activation">
    群组回复默认需要提及。

    提及检测包括：

    - WhatsApp bot 身份的显式提及
    - 配置的提及正则模式（`agents.list[].groupChat.mentionPatterns`，回退 `messages.groupChat.mentionPatterns`）
    - 隐式回复 bot 检测（回复发送者匹配 bot 身份）

    安全注意：

    - 引用/回复仅满足提及门控；它**不**授予发送者授权
    - 使用 `groupPolicy: "allowlist"`，非白名单发送者仍被阻止即使他们回复白名单用户的消息

    Session 级别激活命令：

    - `/activation mention`
    - `/activation always`

    `activation` 更新 session 状态（非全局配置）。它是 owner 门控的。

  </Tab>
</Tabs>

## 个人号码和自我聊天行为

当链接的自我号码也在 `allowFrom` 中存在时，WhatsApp 自我聊天保护激活：

- 跳过自我聊天轮次的已读回执
- 忽略否则会 ping 自己的提及-JID 自动触发行为
- 如果 `messages.responsePrefix` 未设置，自我聊天回复默认为 `[{identity.name}]` 或 `[openclaw]`

## 消息规范化和上下文

<AccordionGroup>
  <Accordion title="入站 envelope + 回复上下文">
    入站 WhatsApp 消息包装在共享入站 envelope 中。

    如果存在引用回复，上下文以这种形式追加：

    ```text
    [Replying to <sender> id:<stanzaId>]
    <quoted body or media placeholder>
    [/Replying]
    ```

    回复元数据字段也在可用时填充（`ReplyToId`、`ReplyToBody`、`ReplyToSender`、发送者 JID/E.164）。

  </Accordion>

  <Accordion title="媒体占位符和位置/联系人提取">
    纯媒体入站消息用占位符规范化，如：

    - `<media:image>`
    - `<media:video>`
    - `<media:audio>`
    - `<media:document>`
    - `<media:sticker>`

    Location 和联系人 payload 在路由前规范化为文本上下文。

  </Accordion>

  <Accordion title="待处理群组历史注入">
    对于群组，未处理消息可被缓冲并在 bot 最终触发时作为上下文注入。

    - 默认限制：`50`
    - 配置：`channels.whatsapp.historyLimit`
    - 回退：`messages.groupChat.historyLimit`
    - `0` 禁用

    注入标记：

    - `[Chat messages since your last reply - for context]`
    - `[Current message - respond to this]`

  </Accordion>

  <Accordion title="已读回执">
    已读回执默认为接受的入站 WhatsApp 消息启用。

    全局禁用：

    ```json5
    {
      channels: {
        whatsapp: {
          sendReadReceipts: false,
        },
      },
    }
    ```

    账号级别覆盖：

    ```json5
    {
      channels: {
        whatsapp: {
          accounts: {
            work: {
              sendReadReceipts: false,
            },
          },
        },
      },
    }
    ```

    自我聊天轮次即使全局启用也跳过已读回执。

  </Accordion>
</AccordionGroup>

## 投递、分块和媒体

<AccordionGroup>
  <Accordion title="文本分块">
    - 默认分块限制：`channels.whatsapp.textChunkLimit = 4000`
    - `channels.whatsapp.chunkMode = "length" | "newline"`
    - `newline` 模式优先段落边界（空行），然后回退到长度安全分块
  </Accordion>

  <Accordion title="出站媒体行为">
    - 支持图片、视频、音频（PTT voice-note）和文档 payload
    - `audio/ogg` 重写为 `audio/ogg; codecs=opus` 用于 voice-note 兼容性
    - 动画 GIF 播放通过视频发送时的 `gifPlayback: true` 支持
    - Captions 在发送多媒体回复 payload 时应用到第一个媒体项目
    - 媒体源可以是 HTTP(S）、`file://` 或本地路径
  </Accordion>

  <Accordion title="媒体大小限制和回退行为">
    - 入站媒体保存上限：`channels.whatsapp.mediaMaxMb`（默认 `50`）
    - 出站媒体发送上限：`channels.whatsapp.mediaMaxMb`（默认 `50`）
    - 账号级别覆盖使用 `channels.whatsapp.accounts.<accountId>.mediaMaxMb`
    - 图片自动优化（resize/quality sweep）以适应限制
    - 媒体发送失败时，首项回退发送文本警告而不是静默丢弃响应
  </Accordion>
</AccordionGroup>

## 反应级别

`channels.whatsapp.reactionLevel` 控制 agent 在 WhatsApp 上使用 emoji 反应的范围：

| 级别          | Ack 反应 | Agent 主动反应 | 描述                       |
| ------------- | -------- | -------------- | -------------------------- |
| `"off"`       | 否       | 否             | 完全无反应                 |
| `"ack"`       | 是       | 否             | 仅 Ack 反应（预回复接收）  |
| `"minimal"`   | 是       | 是（保守）     | Ack + agent 反应带保守指导 |
| `"extensive"` | 是       | 是（鼓励）     | Ack + agent 反应带鼓励指导 |

默认：`"minimal"`。

账号级别覆盖使用 `channels.whatsapp.accounts.<id>.reactionLevel`。

```json5
{
  channels: {
    whatsapp: {
      reactionLevel: "ack",
    },
  },
}
```

## 确认反应

WhatsApp 通过 `channels.whatsapp.ackReaction` 支持入站接收时的立即 ack 反应。
Ack 反应由 `reactionLevel` 门控 — 当 `reactionLevel` 为 `"off"` 时它们被抑制。

```json5
{
  channels: {
    whatsapp: {
      ackReaction: {
        emoji: "👀",
        direct: true,
        group: "mentions", // always | mentions | never
      },
    },
  },
}
```

行为注意：

- 入站被接受后立即发送（预回复）
- 失败被记录但不阻止正常回复投递
- 群组模式 `mentions` 在提及触发轮次时反应；群组激活 `always` 作为此检查的绕过
- WhatsApp 使用 `channels.whatsapp.ackReaction`（旧版 `messages.ackReaction` 不在这里使用）

## 多账号和 credentials

<AccordionGroup>
  <Accordion title="账号选择和默认">
    - 账号 id 来自 `channels.whatsapp.accounts`
    - 默认账号选择：如果存在 `default`，否则第一个配置的账号 id（排序）
    - 账号 id 内部规范化用于查找
  </Accordion>

  <Accordion title="Credential 路径和旧版兼容性">
    - 当前 auth 路径：`~/.openclaw/credentials/whatsapp/<accountId>/creds.json`
    - 备份文件：`creds.json.bak`
    - `~/.openclaw/credentials/` 中旧版默认 auth 对于默认账号流程仍被识别/迁移
  </Accordion>

  <Accordion title="Logout 行为">
    `openclaw channels logout --channel whatsapp [--account <id>]` 清除该账号的 WhatsApp auth 状态。

    在旧版 auth 目录中，`oauth.json` 被保留而 Baileys auth 文件被移除。

  </Accordion>
</AccordionGroup>

## 工具、动作和配置写入

- Agent 工具支持包括 WhatsApp 反应动作（`react`）。
- 动作门控：
  - `channels.whatsapp.actions.reactions`
  - `channels.whatsapp.actions.polls`
- Channel 发起的配置写入默认启用（通过 `channels.whatsapp.configWrites=false` 禁用）。

## 故障排除

<AccordionGroup>
  <Accordion title="未链接（需要 QR）">
    症状：channel 状态报告未链接。

    修复：

    ```bash
    openclaw channels login --channel whatsapp
    openclaw channels status
    ```

  </Accordion>

  <Accordion title="已链接但断开 / 重连循环">
    症状：已链接账号反复断开或重连尝试。

    修复：

    ```bash
    openclaw doctor
    openclaw logs --follow
    ```

    如果需要，用 `channels login` 重新链接。

  </Accordion>

  <Accordion title="发送时无活跃监听器">
    目标账号无活跃 Gateway 监听器时出站发送快速失败。

    确保 Gateway 运行且账号已链接。

  </Accordion>

  <Accordion title="群组消息意外被忽略">
    按此顺序检查：

    - `groupPolicy`
    - `groupAllowFrom` / `allowFrom`
    - `groups` 白名单条目
    - 提及门控（`requireMention` + 提及模式）
    - `openclaw.json` 中重复键（JSON5）：后条目覆盖前条目，因此每个范围保持单个 `groupPolicy`

  </Accordion>

  <Accordion title="Bun 运行时警告">
    WhatsApp Gateway 运行时应使用 Node。Bun 被标记为稳定 WhatsApp/Telegram Gateway 操作不兼容。
  </Accordion>
</AccordionGroup>

## 配置参考指针

主要参考：

- [Configuration reference - WhatsApp](/gateway/configuration-reference#whatsapp)

高信号 WhatsApp 字段：

- 访问：`dmPolicy`、`allowFrom`、`groupPolicy`、`groupAllowFrom`、`groups`
- 投递：`textChunkLimit`、`chunkMode`、`mediaMaxMb`、`sendReadReceipts`、`ackReaction`、`reactionLevel`
- 多账号：`accounts.<id>.enabled`、`accounts.<id>.authDir`、账号级别覆盖
- 运营：`configWrites`、`debounceMs`、`web.enabled`、`web.heartbeatSeconds`、`web.reconnect.*`
- Session 行为：`session.dmScope`、`historyLimit`、`dmHistoryLimit`、`dms.<id>.historyLimit`

## 相关

- [Pairing](/channels/pairing)
- [Groups](/channels/groups)
- [Security](/gateway/security)
- [Channel routing](/channels/channel-routing)
- [Multi-agent routing](/concepts/multi-agent)
- [Troubleshooting](/channels/troubleshooting)
