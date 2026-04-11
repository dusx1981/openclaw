---
summary: "Behavior and config for WhatsApp group message handling (mentionPatterns are shared across surfaces)"
read_when:
  - Changing group message rules or mentions
title: "Group Messages"
---

# 群组消息（WhatsApp web 频道）

目标：让 Clawd 在 WhatsApp 群组中，仅在 ping 时唤醒，并将该线程与个人私信 session 分开。

注意：`agents.list[].groupChat.mentionPatterns` 现在 Telegram/Discord/Slack/iMessage 也使用；此文档聚焦 WhatsApp 特定行为。对于多 agent 设置，按 agent 设置 `agents.list[].groupChat.mentionPatterns`（或使用 `messages.groupChat.mentionPatterns` 作为全局回退）。

## 当前实现（2025-12-03）

- 激活模式：`mention`（默认）或 `always`。`mention` 需要 ping（通过 `mentionedJids` 的真实 WhatsApp @-mentions、安全正则模式或文本中任意位置的 bot E.164）。`always` 在每条消息上唤醒 agent，但仅当能添加有意义价值时回复；否则返回静默 token `NO_REPLY`。默认可在配置（`channels.whatsapp.groups`) 中设置，并通过 `/activation` 按群组覆盖。当 `channels.whatsapp.groups` 设置时，它也作为群组白名单（包含 `"*"` 以允许所有）。
- 群组策略：`channels.whatsapp.groupPolicy` 控制是否接受群组消息（`open|disabled|allowlist`）。`allowlist` 使用 `channels.whatsapp.groupAllowFrom`（回退：显式 `channels.whatsapp.allowFrom`）。默认为 `allowlist`（阻止直到你添加发送者）。
- 按群组 sessions：session keys 格式如 `agent:<agentId>:whatsapp:group:<jid>`，所以命令如 `/verbose on` 或 `/think high`（作为独立消息发送）作用于该群组；个人私信状态不受影响。群组线程跳过心跳。
- 上下文注入：**仅待处理**群组消息（默认 50）_未_ 触发运行的消息在 `[Chat messages since your last reply - for context]` 下前缀，触发行在 `[Current message - respond to this]` 下。已在 session 中的消息不重新注入。
- 发送者呈现：每个群组批次现在以 `[from: Sender Name (+E164)]` 结束，所以 Pi 知道谁在说话。
- 临时/阅后即焚：我们在提取文本/提及前解包，所以其中的 ping 仍触发。
- 群组系统提示：在群组 session 第一轮（以及每当 `/activation` 更改模式时），我们在系统提示中注入简短说明如 `You are replying inside the WhatsApp group "<subject>". Group members: Alice (+44...), Bob (+43...), … Activation: trigger-only … Address the specific sender noted in the message context.` 如果元数据不可用，我们仍告诉 agent 这是群组聊天。

## 配置示例（WhatsApp）

向 `~/.openclaw/openclaw.json` 添加 `groupChat` 块，以便即使 WhatsApp 在文本 body 中去除视觉 `@`，显示名称 ping 仍工作：

```json5
{
  channels: {
    whatsapp: {
      groups: {
        "*": { requireMention: true },
      },
    },
  },
  agents: {
    list: [
      {
        id: "main",
        groupChat: {
          historyLimit: 50,
          mentionPatterns: ["@?openclaw", "\\+?15555550123"],
        },
      },
    ],
  },
}
```

注意：

- 正则表达式大小写不敏感，使用与其他配置正则面相同的安全正则护栏；无效模式和不安全嵌套重复被忽略。
- WhatsApp 仍通过 `mentionedJids` 发送规范提及当某人点击联系人，所以数字回退很少需要但是有用的安全网。

### 激活命令（仅所有者）

使用群组聊天命令：

- `/activation mention`
- `/activation always`

仅所有者号码（来自 `channels.whatsapp.allowFrom`，或未设置时 bot 自己的 E.164）可更改此。在群组中作为独立消息发送 `/status` 以查看当前激活模式。

## 如何使用

1. 将你的 WhatsApp 账号（运行 OpenClaw 的账号）添加到群组。
2. 说 `@openclaw …`（或包含号码）。仅白名单发送者可触发，除非你设置 `groupPolicy: "open"`。
3. Agent 提示将包含最近群组上下文加尾部 `[from: …]` 标记，以便它可以正确称呼。
4. Session 级指令（`/verbose on`、`/think high`、`/new` 或 `/reset`、`/compact`) 仅应用于该群组 session；作为独立消息发送以注册。你的个人私信 session 保持独立。

## 测试 / 验证

- 手动冒烟测试：
  - 在群组中发送 `@openclaw` ping 并确认回复引用发送者名称。
  - 发送第二个 ping 并验证历史块被包含然后在下一轮清除。
- 检查 gateway 日志（用 `--verbose` 运行）以查看显示 `from: <groupJid>` 和 `[from: …]` suffix 的 `inbound web message` 条目。

## 已知注意事项

- 群组有意跳过心跳以避免嘈杂广播。
- Echo suppression 使用组合批次字符串；如果你不带提及发送相同文本两次，仅第一条获得响应。
- Session store 条目在 session store（默认 `~/.openclaw/agents/<agentId>/sessions/sessions.json`）中显示为 `agent:<agentId>:whatsapp:group:<jid>`；缺少条目仅表示群组尚未触发运行。
- 群组中的正在输入指示遵循 `agents.defaults.typingMode`（默认：未提及时 `message`）。
