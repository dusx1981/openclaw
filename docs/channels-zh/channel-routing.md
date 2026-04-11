---
summary: "Routing rules per channel (WhatsApp, Telegram, Discord, Slack) and shared context"
read_when:
  - Changing channel routing or inbox behavior
title: "Channel Routing"
---

# 频道和路由

OpenClaw 将回复**路由回消息来源的频道**。模型不选择频道；路由是确定性的，由主机配置控制。

## 关键术语

- **Channel**：`telegram`、`whatsapp`、`discord`、`irc`、`googlechat`、`slack`、`signal`、`imessage`、`line`，以及扩展频道。`webchat` 是内部 WebChat UI 频道，不是可配置的出站频道。
- **AccountId**：按频道账号实例（如支持）。
- 可选频道默认账号：`channels.<channel>.defaultAccount` 选择出站路径未指定 `accountId` 时使用的账号。
  - 在多账号设置中，当配置两个或更多账号时，设置明确默认（`defaultAccount` 或 `accounts.default`）。否则，回退路由可能选择第一个规范化账号 ID。
- **AgentId**：隔离的 workspace + session 存储（"大脑")。
- **SessionKey**：用于存储上下文和控制并发性的存储桶键。

## Session key 形状（示例）

直接消息折叠为 agent 的**主** session：

- `agent:<agentId>:<mainKey>`（默认：`agent:main:main`）

群组和频道保持按频道隔离：

- 群组：`agent:<agentId>:<channel>:group:<id>`
- 频道/房间：`agent:<agentId>:<channel>:channel:<id>`

线程：

- Slack/Discord 线程将 `:thread:<threadId>` 添加到基础键。
- Telegram 论坛主题在群组键中嵌入 `:topic:<topicId>`。

示例：

- `agent:main:telegram:group:-1001234567890:topic:42`
- `agent:main:discord:channel:123456:thread:987654`

## 主私信路由固定

当 `session.dmScope` 为 `main` 时，私信可能共享一个主 session。为防止 session 的 `lastRoute` 被非所有者私信覆盖，OpenClaw 在满足以下所有条件时从 `allowFrom` 推断固定所有者：

- `allowFrom` 有且仅有一个非通配符条目。
- 该条目可以规范化为该频道的具体发送者 ID。
- 入站私信发送者与该固定所有者不匹配。

在该不匹配情况下，OpenClaw 仍记录入站 session 元数据，但跳过更新主 session `lastRoute`。

## 路由规则（如何选择 agent）

路由为每条入站消息选择**一个 agent**：

1. **精确 peer 匹配**（带 `peer.kind` + `peer.id` 的 `bindings`)。
2. **父级 peer 匹配**（线程继承）。
3. **Guild + roles 匹配**（Discord）通过 `guildId` + `roles`。
4. **Guild 匹配**（Discord）通过 `guildId`。
5. **Team 匹配**（Slack）通过 `teamId`。
6. **Account 匹配**（频道上的 `accountId`)。
7. **Channel 匹配**（该频道上的任何账号，`accountId: "*"`）。
8. **默认 agent**（`agents.list[].default`，否则第一个列表条目，回退到 `main`)。

当绑定包含多个匹配字段（`peer`、`guildId`、`teamId`、`roles`) 时，**所有提供的字段必须匹配**才能应用该绑定。

匹配的 agent 决定使用哪个 workspace 和 session 存储。

## 广播群组（运行多个 agent）

广播群组让你在 OpenClaw 通常会回复时为同一 peer 运行**多个 agent**（例如：在 WhatsApp 群组中，在提及/激活门控后）。

配置：

```json5
{
  broadcast: {
    strategy: "parallel",
    "120363403215116621@g.us": ["alfred", "baerbel"],
    "+15555550123": ["support", "logger"],
  },
}
```

请参阅：[广播群组](/channels/broadcast-groups)。

## 配置概览

- `agents.list`：命名 agent 定义（workspace、model 等）。
- `bindings`：将入站频道/账号/peers 映射到 agent。

示例：

```json5
{
  agents: {
    list: [{ id: "support", name: "Support", workspace: "~/.openclaw/workspace-support" }],
  },
  bindings: [
    { match: { channel: "slack", teamId: "T123" }, agentId: "support" },
    { match: { channel: "telegram", peer: { kind: "group", id: "-100123" } }, agentId: "support" },
  ],
}
```

## Session 存储

Session 存储位于状态目录下（默认 `~/.openclaw`）：

- `~/.openclaw/agents/<agentId>/sessions/sessions.json`
- JSONL transcripts 与存储并列

你可以通过 `session.store` 和 `{agentId}` 模板覆盖存储路径。

Gateway 和 ACP session 发现还会扫描默认 `agents/` 根目录下和模板化 `session.store` 根目录下的磁盘-backed agent 存储。发现的存储必须在该解析的 agent 根目录内，并使用常规的 `sessions.json` 文件。符号链接和根目录外的路径被忽略。

## WebChat 行为

WebChat 附着到**选定的 agent** 并默认为该 agent 的主 session。因此，WebChat 让你在一处查看该 agent 的跨频道上下文。

## 回复上下文

入站回复包含：

- 可用时包含 `ReplyToId`、`ReplyToBody` 和 `ReplyToSender`。
- 引用上下文作为 `[Replying to ...]` 块附加到 `Body`。

这跨频道一致。
