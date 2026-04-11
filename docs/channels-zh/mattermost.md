---
summary: "Mattermost bot 设置和 OpenClaw 配置"
read_when:
  - 设置 Mattermost
  - 调试 Mattermost 路由
title: "Mattermost"
---

# Mattermost (plugin)

状态：通过插件支持（bot 令牌 + WebSocket 事件）。频道、群组和私信均受支持。
Mattermost 是一个可自托管团队消息平台；产品详情和下载见官方网站
[mattermost.com](https://mattermost.com)。

## 需要插件

Mattermost 作为插件提供，不随核心安装捆绑。

通过 CLI 安装（npm registry）：

```bash
openclaw plugins install @openclaw/mattermost
```

本地检出（从 git 仓库运行时）：

```bash
openclaw plugins install ./path/to/local/mattermost-plugin
```

如果你在设置期间选择 Mattermost 且检测到 git 检出，
OpenClaw 会自动提供本地安装路径。

详情：[Plugins](/tools/plugin)

## 快速设置

1. 安装 Mattermost 插件。
2. 创建 Mattermost bot 账户并复制 **bot token**。
3. 复制 Mattermost **base URL**（如 `https://chat.example.com`）。
4. 配置 OpenClaw 并启动 gateway。

最小配置：

```json5
{
  channels: {
    mattermost: {
      enabled: true,
      botToken: "mm-token",
      baseUrl: "https://chat.example.com",
      dmPolicy: "pairing",
    },
  },
}
```

## 原生斜杠命令

原生斜杠命令是可选的。启用后，OpenClaw 通过 Mattermost API 注册 `oc_*` 斜杠命令并在 gateway HTTP 服务器上接收回调 POST。

```json5
{
  channels: {
    mattermost: {
      commands: {
        native: true,
        nativeSkills: true,
        callbackPath: "/api/channels/mattermost/command",
        // 当 Mattermost 无法直接访问 gateway 时使用（反向代理/公共 URL）。
        callbackUrl: "https://gateway.example.com/api/channels/mattermost/command",
      },
    },
  },
}
```

注意：

- `native: "auto"` 对 Mattermost 默认禁用。设置 `native: true` 启用。
- 如果省略 `callbackUrl`，OpenClaw 从 gateway 主机/端口 + `callbackPath` 派生一个。
- 对于多账户设置，`commands` 可设置在顶层或 `channels.mattermost.accounts.<id>.commands` 下（账户值覆盖顶层字段）。
- 命令回调使用 OpenClaw 注册 `oc_*` 命令时 Mattermost 返回的每命令令牌验证。
- 斜杠回调在注册失败、启动部分完成或回调令牌不匹配已注册命令之一时拒绝。
- 可达性要求：回调端点必须可从 Mattermost 服务器访问。
  - 不要将 `callbackUrl` 设置为 `localhost`，除非 Mattermost 与 OpenClaw 运行在相同主机/网络命名空间。
  - 不要将 `callbackUrl` 设置为你的 Mattermost base URL，除非该 URL 反向代理 `/api/channels/mattermost/command` 到 OpenClaw。
  - 快速检查是 `curl https://<gateway-host>/api/channels/mattermost/command`；GET 应从 OpenClaw 返回 `405 Method Not Allowed`，而非 `404`。
- Mattermost 出站白名单要求：
  - 如果你的回调目标私有/tailnet/内部地址，设置 Mattermost `ServiceSettings.AllowedUntrustedInternalConnections` 包含回调主机/域名。
  - 使用主机/域名条目，而非完整 URL。
    - 好：`gateway.tailnet-name.ts.net`
    - 坏：`https://gateway.tailnet-name.ts.net`

## 环境变量（默认账户）

如果你更喜欢环境变量，在 gateway 主机上设置：

- `MATTERMOST_BOT_TOKEN=...`
- `MATTERMOST_URL=https://chat.example.com`

环境变量仅适用于**默认**账户 (`default`)。其他账户必须使用配置值。

## 聊天模式

Mattermost 自动回复私信。频道行为由 `chatmode` 控制：

- `oncall`（默认）：仅在频道中被 @提及 时响应。
- `onmessage`：响应每条频道消息。
- `onchar`：当消息以触发前缀开始时响应。

配置示例：

```json5
{
  channels: {
    mattermost: {
      chatmode: "onchar",
      oncharPrefixes: [">", "!"],
    },
  },
}
```

注意：

- `onchar` 仍响应显式 @提及。
- `channels.mattermost.requireMention` 为遗留配置保留，但推荐使用 `chatmode`。

## 线程和会话

使用 `channels.mattermost.replyToMode` 控制频道和群组回复是保持在主频道还是在触发帖子下启动线程。

- `off`（默认）：仅当入站帖子已在线程中时在线程回复。
- `first`：对于顶层频道/群组帖子，在该帖子下启动线程并将对话路由到线程范围会话。
- `all`：今天 Mattermost 的行为与 `first` 相同。
- 私信忽略此设置并保持非线程。

配置示例：

```json5
{
  channels: {
    mattermost: {
      replyToMode: "all",
    },
  },
}
```

注意：

- 线程范围会话使用触发帖子 id 作为线程根。
- `first` 和 `all` 当前等效，因为一旦 Mattermost 有线程根，后续分块和媒体继续在同一线程。

## 访问控制（私信）

- 默认：`channels.mattermost.dmPolicy = "pairing"`（未知发送者获得配对码）。
- 批准通过：
  - `openclaw pairing list mattermost`
  - `openclaw pairing approve mattermost <CODE>`
- 公开私信：`channels.mattermost.dmPolicy="open"` 加 `channels.mattermost.allowFrom=["*"]`。

## 频道（群组）

- 默认：`channels.mattermost.groupPolicy = "allowlist"`（提及触发）。
- 用 `channels.mattermost.groupAllowFrom` 白名单发送者（推荐用户 ID）。
- `@username` 匹配是可变的，仅在 `channels.mattermost.dangerouslyAllowNameMatching: true` 时启用。
- 开放频道：`channels.mattermost.groupPolicy="open"`（提及触发）。
- 运行时提示：如果 `channels.mattermost` 完全缺失，运行时回退到 `groupPolicy="allowlist"` 进行群组检查（即使设置了 `channels.defaults.groupPolicy`）。

## 出站投递目标

使用 `openclaw message send` 或 cron/webhooks 时使用这些目标格式：

- `channel:<id>` 用于频道
- `user:<id>` 用于私信
- `@username` 用于私信（通过 Mattermost API 解析）

纯 opaque ID（如 `64ifufp...`）在 Mattermost 中**不明确**（用户 ID vs 频道 ID）。

OpenClaw **用户优先**解析它们：

- 如果 ID 作为用户存在（`GET /api/v4/users/<id>` 成功），OpenClaw 通过 `/api/v4/channels/direct` 解析直接频道发送**私信**。
- 否则 ID 被视为**频道 ID**。

如果你需要确定性行为，始终使用显式前缀（`user:<id>` / `channel:<id>`）。

## 私信频道重试

当 OpenClaw 发送到 Mattermost 私信目标且需要先解析直接频道时，默认重试瞬态直接频道创建失败。

使用 `channels.mattermost.dmChannelRetry` 为 Mattermost 插件全局调整该行为，
或 `channels.mattermost.accounts.<id>.dmChannelRetry` 用于单个账户。

```json5
{
  channels: {
    mattermost: {
      dmChannelRetry: {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        timeoutMs: 30000,
      },
    },
  },
}
```

注意：

- 这仅适用于私信频道创建（`/api/v4/channels/direct`），非每个 Mattermost API 调用。
- 重试适用于瞬态失败如速率限制、5xx 响应和网络或超时错误。
- 除 `429` 外的 4xx 客户端错误被视为永久性且不重试。

## 反应（消息工具）

- 使用 `message action=react` 配合 `channel=mattermost`。
- `messageId` 是 Mattermost 帖子 id。
- `emoji` 接受如 `thumbsup` 或 `:+1:` 的名称（冒号可选）。
- 设置 `remove=true`（布尔值）移除反应。
- 反应添加/移除事件作为系统事件转发到路由的 agent 会话。

示例：

```
message action=react channel=mattermost target=channel:<channelId> messageId=<postId> emoji=thumbsup
message action=react channel=mattermost target=channel:<channelId> messageId=<postId> emoji=thumbsup remove=true
```

配置：

- `channels.mattermost.actions.reactions`：启用/禁用反应操作（默认 true）。
- 每账户覆盖：`channels.mattermost.accounts.<id>.actions.reactions`。

## 交互按钮（消息工具）

发送带可点击按钮的消息。当用户点击按钮时，agent 接收选择并可响应。

通过向频道能力添加 `inlineButtons` 启用按钮：

```json5
{
  channels: {
    mattermost: {
      capabilities: ["inlineButtons"],
    },
  },
}
```

使用 `message action=send` 配合 `buttons` 参数。按钮是二维数组（按钮行）：

```
message action=send channel=mattermost target=channel:<channelId> buttons=[[{"text":"Yes","callback_data":"yes"},{"text":"No","callback_data":"no"}]]
```

按钮字段：

- `text`（必需）：显示标签。
- `callback_data`（必需）：点击时发送回的值（用作操作 ID）。
- `style`（可选）：`"default"`、`"primary"` 或 `"danger"`。

当用户点击按钮时：

1. 所有按钮被替换为确认行（如 "✓ **Yes** selected by @user"）。
2. Agent 接收选择作为入站消息并响应。

注意：

- 按钮回调使用 HMAC-SHA256 验证（自动，无需配置）。
- Mattermost 从其 API 响应中剥离回调数据（安全特性），所以所有按钮在点击时被移除——部分移除不可能。
- 包含连字符或下划线的操作 ID 自动清理（Mattermost 路由限制）。

配置：

- `channels.mattermost.capabilities`：能力字符串数组。添加 `"inlineButtons"` 在 agent 系统提示中启用按钮工具描述。
- `channels.mattermost.interactions.callbackBaseUrl`：按钮回调的可选外部基 URL（例如 `https://gateway.example.com`）。当 Mattermost 无法在其绑定主机直接访问 gateway 时使用。
- 在多账户设置中，你也可以在 `channels.mattermost.accounts.<id>.interactions.callbackBaseUrl` 下设置相同字段。
- 如果省略 `interactions.callbackBaseUrl`，OpenClaw 从 `gateway.customBindHost` + `gateway.port` 派生回调 URL，然后回退到 `http://localhost:<port>`。
- 可达性规则：按钮回调 URL 必须可从 Mattermost 服务器访问。`localhost` 仅在 Mattermost 和 OpenClaw 运行在相同主机/网络命名空间时工作。
- 如果你的回调目标是私有/tailnet/内部地址，将其主机/域名添加到 Mattermost `ServiceSettings.AllowedUntrustedInternalConnections`。

### 直接 API 集成（外部脚本）

外部脚本和 webhooks 可通过 Mattermost REST API 直接发布按钮，而非通过 agent 的 `message` 工具。尽可能使用扩展的 `buildButtonAttachments()`；如果发布原始 JSON，遵循这些规则：

**载荷结构：**

```json5
{
  channel_id: "<channelId>",
  message: "Choose an option:",
  props: {
    attachments: [
      {
        actions: [
          {
            id: "mybutton01", // 仅字母数字 — 见下文
            type: "button", // 必需，否则点击被静默忽略
            name: "Approve", // 显示标签
            style: "primary", // 可选："default"、"primary"、"danger"
            integration: {
              url: "https://gateway.example.com/mattermost/interactions/default",
              context: {
                action_id: "mybutton01", // 必须匹配按钮 id（用于名称查找）
                action: "approve",
                // ... 任何自定义字段 ...
                _token: "<hmac>", // 见下文 HMAC 部分
              },
            },
          },
        ],
      },
    ],
  },
}
```

**关键规则：**

1. Attachments 在 `props.attachments` 中，非顶层 `attachments`（静默忽略）。
2. 每个操作需要 `type: "button"`——无它时点击被静默吞掉。
3. 每个操作需要 `id` 字段——Mattermost 忽略无 ID 的操作。
4. 操作 `id` 必须**仅字母数字**（`[a-zA-Z0-9]`）。连字符和下划线破坏 Mattermost 的服务器端操作路由（返回 404）。使用前清理它们。
5. `context.action_id` 必须匹配按钮的 `id` 以便确认消息显示按钮名称（如 "Approve"）而非原始 ID。
6. `context.action_id` 是必需的——交互处理器无它返回 400。

**HMAC 令牌生成：**

Gateway 用 HMAC-SHA256 验证按钮点击。外部脚本必须生成匹配 gateway 验证逻辑的令牌：

1. 从 bot 令牌派生秘密：
   `HMAC-SHA256(key="openclaw-mattermost-interactions", data=botToken)`
2. 构建**除 `_token` 外**包含所有字段的上下文对象。
3. 使用**排序键**和**无空格**序列化（gateway 使用带排序键的 `JSON.stringify`，产生紧凑输出）。
4. 签名：`HMAC-SHA256(key=secret, data=serializedContext)`
5. 将结果十六进制摘要添加为上下文中的 `_token`。

Python 示例：

```python
import hmac, hashlib, json

secret = hmac.new(
    b"openclaw-mattermost-interactions",
    bot_token.encode(), hashlib.sha256
).hexdigest()

ctx = {"action_id": "mybutton01", "action": "approve"}
payload = json.dumps(ctx, sort_keys=True, separators=(",", ":"))
token = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()

context = {**ctx, "_token": token}
```

常见 HMAC 陷阱：

- Python 的 `json.dumps` 默认添加空格（`{"key": "val"}`）。使用 `separators=(",", ":")` 匹配 JavaScript 的紧凑输出（`{"key":"val"}`）。
- 总是签名**所有**上下文字段（减去 `_token`）。Gateway 剥离 `_token` 后签名剩余所有内容。签名子集导致静默验证失败。
- 使用 `sort_keys=True`——gateway 在签名前排序键，Mattermost 可能在存储载荷时重排上下文字段。
- 从 bot 令牌派生秘密（确定性），而非随机字节。秘密必须跨创建按钮的进程和验证的 gateway 相同。

## 目录适配器

Mattermost 插件包含通过 Mattermost API 解析频道和用户名称的目录适配器。这使 `openclaw message send` 和 cron/webhook 投递中的 `#channel-name` 和 `@username` 目标可用。

无需配置——适配器使用账户配置中的 bot 令牌。

## 多账户

Mattermost 在 `channels.mattermost.accounts` 下支持多个账户：

```json5
{
  channels: {
    mattermost: {
      accounts: {
        default: { name: "Primary", botToken: "mm-token", baseUrl: "https://chat.example.com" },
        alerts: { name: "Alerts", botToken: "mm-token-2", baseUrl: "https://alerts.example.com" },
      },
    },
  },
}
```

## 故障排除

- 频道无回复：确保 bot 在频道中并提及它（oncall），使用触发前缀（onchar），或设置 `chatmode: "onmessage"`。
- 认证错误：检查 bot 令牌、base URL 和账户是否启用。
- 多账户问题：环境变量仅适用于 `default` 账户。
- 原生斜杠命令返回 `Unauthorized: invalid command token.`：OpenClaw 未接受回调令牌。典型原因：
  - 斜杠命令注册在启动时失败或仅部分完成
  - 回调命中错误的 gateway/账户
  - Mattermost 仍有指向之前回调目标的旧命令
  - gateway 重启未重新激活斜杠命令
- 如果原生斜杠命令停止工作，检查日志中的 `mattermost: failed to register slash commands` 或 `mattermost: native slash commands enabled but no commands could be registered`。
- 如果省略 `callbackUrl` 且日志警告回调解析为 `http://127.0.0.1:18789/...`，该 URL 可能仅在 Mattermost 与 OpenClaw 运行在相同主机/网络命名空间时可达。设置显式外部可达的 `commands.callbackUrl`。
- 按钮显示为白框：agent 可能发送格式错误的按钮数据。检查每个按钮有 `text` 和 `callback_data` 字段。
- 按钮渲染但点击无反应：验证 Mattermost 服务器配置中的 `AllowedUntrustedInternalConnections` 包含 `127.0.0.1 localhost`，且 ServiceSettings 中 `EnablePostActionIntegration` 为 `true`。
- 按钮点击返回 404：按钮 `id` 可能包含连字符或下划线。Mattermost 的操作路由器在非字母数字 ID 上失效。仅使用 `[a-zA-Z0-9]`。
- Gateway 日志 `invalid _token`：HMAC 不匹配。检查你签名所有上下文字段（非子集），使用排序键，并使用紧凑 JSON（无空格）。见上文 HMAC 部分。
- Gateway 日志 `missing _token in context`：`_token` 字段不在按钮上下文中。确保构建集成载荷时包含它。
- 确认显示原始 ID 而非按钮名称：`context.action_id` 不匹配按钮的 `id`。将两者设为相同清理值。
- Agent 不知道按钮：向 Mattermost 频道配置添加 `capabilities: ["inlineButtons"]`。

## 相关文档

- [频道概览](/channels) — 所有支持的频道
- [配对](/channels/pairing) — 私信认证和配对流程
- [群组](/channels/groups) — 群聊行为和提及触发
- [频道路由](/channels/channel-routing) — 消息的会话路由
- [安全](/gateway/security) — 访问模型和加固
