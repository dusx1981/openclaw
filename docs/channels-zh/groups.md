---
summary: "Group chat behavior across surfaces (Discord/iMessage/Matrix/Microsoft Teams/Signal/Slack/Telegram/WhatsApp/Zalo)"
read_when:
  - Changing group chat behavior or mention gating
title: "Groups"
---

# 群组

OpenClaw 在各平台统一处理群组聊天：Discord、iMessage、Matrix、Microsoft Teams、Signal、Slack、Telegram、WhatsApp、Zalo。

## 新手入门（2 分钟）

OpenClaw"驻留"在你自己的消息账号上。没有单独的 WhatsApp bot 用户。
如果**你**在群组中，OpenClaw 能看到该群组并在那里响应。

默认行为：

- 群组受限（`groupPolicy: "allowlist"`）。
- 回复需要提及，除非你显式禁用提及门控。

解释：白名单发送者可通过提及 OpenClaw 触发它。

> TL;DR
>
> - **私信访问**由 `*.allowFrom` 控制。
> - **群组访问**由 `*.groupPolicy` + 白名单（`*.groups`、`*.groupAllowFrom`）控制。
> - **回复触发**由提及门控（`requireMention`、`/activation`）控制。

快速流程（群组消息会发生什么）：

```
groupPolicy? disabled -> drop
groupPolicy? allowlist -> group allowed? no -> drop
requireMention? yes -> mentioned? no -> store for context only
otherwise -> reply
```

## 上下文可见性和白名单

群组安全涉及两个不同控制：

- **触发授权**：谁可触发 agent（`groupPolicy`、`groups`、`groupAllowFrom`、频道特定白名单）。
- **上下文可见性**：向模型注入什么补充上下文（回复文本、引用、线程历史、转发元数据）。

默认情况下，OpenClaw 优先正常聊天行为，上下文大多保持原样接收。这意味着白名单主要决定谁可触发操作，不是每个引用或历史片段的通用删除边界。

当前行为是频道特定的：

- 某些频道已在特定路径应用基于发送者的补充上下文过滤（例如 Slack 线程播种、Matrix 回复/线程查找）。
- 其他频道仍按接收传递引用/回复/转发上下文。

加固方向（计划）：

- `contextVisibility: "all"`（默认）保持当前原样接收行为。
- `contextVisibility: "allowlist"` 过滤补充上下文到白名单发送者。
- `contextVisibility: "allowlist_quote"` 是 `allowlist` 加一个显式引用/回复例外。

直到此加固模型跨频道一致实现，预期按平台有差异。

![群组消息流程](/images/groups-flow.svg)

如果你想要...

| 目标                                | 设置什么                                                   |
| ----------------------------------- | ---------------------------------------------------------- |
| 允许所有群组但仅在 @mentions 时回复 | `groups: { "*": { requireMention: true } }`                |
| 禁用所有群组回复                    | `groupPolicy: "disabled"`                                  |
| 仅特定群组                          | `groups: { "<group-id>": { ... } }`（无 `"*"` 键）         |
| 仅你可触发群组                      | `groupPolicy: "allowlist"`, `groupAllowFrom: ["+1555..."]` |

## Session keys

- 群组 sessions 使用 `agent:<agentId>:<channel>:group:<id>` session keys（房间/频道使用 `agent:<agentId>:<channel>:channel:<id>`）。
- Telegram 论坛主题向群组 id 添加 `:topic:<threadId>`，所以每个主题有自己的 session。
- 直接聊天使用主 session（或如配置按发送者）。
- 群组 sessions 跳过心跳。

<a id="pattern-personal-dms-public-groups-single-agent"></a>

## 模式：个人私信 + 公开群组（单 agent）

可以 — 如果你的"个人"流量是**私信**且你的"公开"流量是**群组**，这很好工作。

原因：在单 agent 模式下，私信通常落入**主** session key（`agent:main:main`），而群组始终使用**非主** session keys（`agent:main:<channel>:group:<id>`）。如果你用 `mode: "non-main"` 启用沙箱，那些群组 sessions 在 Docker 中运行，而你的主私信 session 保持主机上。

这给你一个 agent"大脑"（共享 workspace + 记忆），但两种执行姿态：

- **私信**：完整工具（主机）
- **群组**：沙箱 + 受限工具（Docker）

> 如果你需要真正分开的 workspace/人格（"个人"和"公开"绝不混合），使用第二 agent + bindings。请参阅 [多 Agent 路由](/concepts/multi-agent)。

示例（私信主机，群组沙箱 + 仅消息工具）：

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main", // groups/channels are non-main -> sandboxed
        scope: "session", // strongest isolation (one container per group/channel)
        workspaceAccess: "none",
      },
    },
  },
  tools: {
    sandbox: {
      tools: {
        // If allow is non-empty, everything else is blocked (deny still wins).
        allow: ["group:messaging", "group:sessions"],
        deny: ["group:runtime", "group:fs", "group:ui", "nodes", "cron", "gateway"],
      },
    },
  },
}
```

想要"群组仅可查看文件夹 X"而不是"无主机访问"？保持 `workspaceAccess: "none"` 并仅将白名单路径挂载到沙箱：

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main",
        scope: "session",
        workspaceAccess: "none",
        docker: {
          binds: [
            // hostPath:containerPath:mode
            "/home/user/FriendsShared:/data:ro",
          ],
        },
      },
    },
  },
}
```

相关：

- 配置键和默认：[Gateway 配置](/gateway/configuration-reference#agentsdefaultssandbox)
- 调试工具为何被阻止：[Sandbox vs Tool Policy vs Elevated](/gateway/sandbox-vs-tool-policy-vs-elevated)
- Bind mounts 详情：[沙箱](/gateway/sandboxing#custom-bind-mounts)

## 显示标签

- UI 标签在可用时使用 `displayName`，格式为 `<channel>:<token>`。
- `#room` 保留用于房间/频道；群组聊天使用 `g-<slug>`（小写，空格 -> `-`，保留 `#@+._-`)。

## 群组策略

按频道控制群组/房间消息处理：

```json5
{
  channels: {
    whatsapp: {
      groupPolicy: "disabled", // "open" | "disabled" | "allowlist"
      groupAllowFrom: ["+15551234567"],
    },
    telegram: {
      groupPolicy: "disabled",
      groupAllowFrom: ["123456789"], // numeric Telegram user id (wizard can resolve @username)
    },
    signal: {
      groupPolicy: "disabled",
      groupAllowFrom: ["+15551234567"],
    },
    imessage: {
      groupPolicy: "disabled",
      groupAllowFrom: ["chat_id:123"],
    },
    msteams: {
      groupPolicy: "disabled",
      groupAllowFrom: ["user@org.com"],
    },
    discord: {
      groupPolicy: "allowlist",
      guilds: {
        GUILD_ID: { channels: { help: { allow: true } } },
      },
    },
    slack: {
      groupPolicy: "allowlist",
      channels: { "#general": { allow: true } },
    },
    matrix: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["@owner:example.org"],
      groups: {
        "!roomId:example.org": { allow: true },
        "#alias:example.org": { allow: true },
      },
    },
  },
}
```

| 策略          | 行为                              |
| ------------- | --------------------------------- |
| `"open"`      | 群组绕过白名单；提及门控仍适用。  |
| `"disabled"`  | 完全阻止所有群组消息。            |
| `"allowlist"` | 仅允许匹配配置白名单的群组/房间。 |

注意：

- `groupPolicy` 与提及门控分开（需要 @mentions）。
- WhatsApp/Telegram/Signal/iMessage/Microsoft Teams/Zalo：使用 `groupAllowFrom`（回退：显式 `allowFrom`）。
- 私信配对批准（`*-allowFrom` store 条目）仅应用于私信访问；群组发送者授权保持显式于群组白名单如 `groupAllowFrom` 或该频道文档化的配置回退。
- Discord：白名单使用 `channels.discord.guilds.<id>.channels`。
- Slack：白名单使用 `channels.slack.channels`。
- Matrix：白名单使用 `channels.matrix.groups`。优先 room IDs 或 aliases；已加入 room 名称查找是尽力而为，未解析名称在运行时忽略。使用 `channels.matrix.groupAllowFrom` 限制发送者；也支持按 room `users` 白名单。
- 群组私信分开控制（`channels.discord.dm.*`、`channels.slack.dm.*`）。
- Telegram 白名单可匹配用户 IDs（`"123456789"`、`"telegram:123456789"`、`"tg:123456789"`）或 usernames（`"@alice"` 或 `"alice"`）；前缀大小写不敏感。
- 默认是 `groupPolicy: "allowlist"`；如果群组白名单为空，群组消息被阻止。
- 运行时安全：当提供者块完全缺失（`channels.<provider>` 不存在），群组策略回退到失败关闭模式（通常 `allowlist`）而不是继承 `channels.defaults.groupPolicy`。

快速心智模型（群组消息评估顺序）：

1. `groupPolicy` (open/disabled/allowlist)
2. 群组白名单（`*.groups`、`*.groupAllowFrom`、频道特定白名单）
3. 提及门控（`requireMention`、`/activation`）

## 提及门控（默认）

群组消息需要提及除非按群组覆盖。默认位于 `*.groups."*"`。

回复 bot 消息算作隐式提及（当频道支持回复元数据）。这适用于 Telegram、WhatsApp、Slack、Discord 和 Microsoft Teams。

```json5
{
  channels: {
    whatsapp: {
      groups: {
        "*": { requireMention: true },
        "123@g.us": { requireMention: false },
      },
    },
    telegram: {
      groups: {
        "*": { requireMention: true },
        "123456789": { requireMention: false },
      },
    },
    imessage: {
      groups: {
        "*": { requireMention: true },
        "123": { requireMention: false },
      },
    },
  },
  agents: {
    list: [
      {
        id: "main",
        groupChat: {
          mentionPatterns: ["@openclaw", "openclaw", "\\+15555550123"],
          historyLimit: 50,
        },
      },
    ],
  },
}
```

注意：

- `mentionPatterns` 是大小写不敏感安全正则模式；无效模式和不安全嵌套重复形式被忽略。
- 提供显式提及的平台仍传递；模式是回退。
- 按 agent 覆盖：`agents.list[].groupChat.mentionPatterns`（当多 agent 共享群组时有用）。
- 提及门控仅在提及检测可能时强制（原生提及或 `mentionPatterns` 配置）。
- Discord 默认位于 `channels.discord.guilds."*"`（按 guild/频道可覆盖）。
- 群组历史上下文跨频道统一包装，是**仅待处理**（因提及门控跳过的消息）；使用 `messages.groupChat.historyLimit` 作为全局默认和 `channels.<channel>.historyLimit`（或 `channels.<channel>.accounts.*.historyLimit`）作为覆盖。设置 `0` 禁用。

## 群组/频道工具限制（可选）

某些频道配置支持限制**特定群组/房间/频道内**可用工具。

- `tools`：整个群组允许/拒绝工具。
- `toolsBySender`：群组内按发送者覆盖。
  使用显式键前缀：
  `id:<senderId>`、`e164:<phone>`、`username:<handle>`、`name:<displayName>` 和 `"*"` 通配符。
  旧版无前缀键仍被接受并仅匹配为 `id:`。

解析顺序（最具体优先）：

1. 群组/频道 `toolsBySender` 匹配
2. 群组/频道 `tools`
3. 默认（`"*"`）`toolsBySender` 匹配
4. 默认（`"*"`）`tools`

示例（Telegram）：

```json5
{
  channels: {
    telegram: {
      groups: {
        "*": { tools: { deny: ["exec"] } },
        "-1001234567890": {
          tools: { deny: ["exec", "read", "write"] },
          toolsBySender: {
            "id:123456789": { alsoAllow: ["exec"] },
          },
        },
      },
    },
  },
}
```

注意：

- 群组/频道工具限制在全局/agent 工具策略之外应用（deny 仍优先）。
- 某些频道使用不同嵌套用于房间/频道（如 Discord `guilds.*.channels.*`、Slack `channels.*`、Microsoft Teams `teams.*.channels.*`）。

## 群组白名单

当配置 `channels.whatsapp.groups`、`channels.telegram.groups` 或 `channels.imessage.groups` 时，键作为群组白名单。使用 `"*"` 允许所有群组同时仍设置默认提及行为。

常见混淆：私信配对批准不等于群组授权。
对于支持私信配对的频道，配对 store 仅解锁私信。群组命令仍需来自配置白名单如 `groupAllowFrom` 或该频道文档化的配置回退的显式群组发送者授权。

常见意图（复制/粘贴）：

1. 禁用所有群组回复

```json5
{
  channels: { whatsapp: { groupPolicy: "disabled" } },
}
```

2. 仅允许特定群组（WhatsApp）

```json5
{
  channels: {
    whatsapp: {
      groups: {
        "123@g.us": { requireMention: true },
        "456@g.us": { requireMention: false },
      },
    },
  },
}
```

3. 允许所有群组但需要提及（显式）

```json5
{
  channels: {
    whatsapp: {
      groups: { "*": { requireMention: true } },
    },
  },
}
```

4. 仅所有者可在群组触发（WhatsApp）

```json5
{
  channels: {
    whatsapp: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["+15551234567"],
      groups: { "*": { requireMention: true } },
    },
  },
}
```

## 激活（仅所有者）

群组所有者可切换按群组激活：

- `/activation mention`
- `/activation always`

所有者由 `channels.whatsapp.allowFrom` 确定（或未设置时 bot 自己的 E.164）。作为独立消息发送命令。其他平台目前忽略 `/activation`。

## 上下文字段

群组入站 payloads 设置：

- `ChatType=group`
- `GroupSubject`（如已知）
- `GroupMembers`（如已知）
- `WasMentioned`（提及门控结果）
- Telegram 论坛主题还包含 `MessageThreadId` 和 `IsForum`。

频道特定注意：

- BlueBubbles 可在正常群组门控通过后从本地 Contacts 数据库可选增强未命名 macOS 群组参与者，在填充 `GroupMembers` 前。这默认关闭。

Agent 系统提示在新群组 session 第一轮包含群组介绍。它提醒模型像人类响应，避免 Markdown 表格，避免输入字面 `\n` 序列。

## iMessage 特定

- 路由或白名单时优先 `chat_id:<id>`。
- 列出聊天：`imsg chats --limit 20`。
- 群组回复总是返回同一 `chat_id`。

## WhatsApp 特定

请参阅 [群组消息](/channels/group-messages) 了解 WhatsApp 特定行为（历史注入、提及处理详情）。
