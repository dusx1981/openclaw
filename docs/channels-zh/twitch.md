---
summary: "Twitch chat bot configuration and setup"
read_when:
  - Setting up Twitch chat integration for OpenClaw
title: "Twitch"
---

# Twitch（插件）

通过 IRC 连接的 Twitch chat 支持。OpenClaw 作为 Twitch 用户（bot 账号）连接，在 channels 中接收和发送消息。

## 需要插件

Twitch 作为插件发布，不捆绑在核心安装中。

通过 CLI 安装（npm registry）：

```bash
openclaw plugins install @openclaw/twitch
```

本地检出（从 git repo 运行时）：

```bash
openclaw plugins install ./path/to/local/twitch-plugin
```

详情：[Plugins](/tools/plugin)

## 快速设置（新手）

1. 为 bot 创建专用 Twitch 账号（或使用现有账号）。
2. 生成 credentials：[Twitch Token Generator](https://twitchtokengenerator.com/)
   - 选择 **Bot Token**
   - 验证 scopes `chat:read` 和 `chat:write` 已选中
   - 复制 **Client ID** 和 **Access Token**
3. 查找你的 Twitch user ID：[https://www.streamweasels.com/tools/convert-twitch-username-to-user-id/](https://www.streamweasels.com/tools/convert-twitch-username-to-user-id/)
4. 配置 token：
   - 环境变量：`OPENCLAW_TWITCH_ACCESS_TOKEN=...`（仅默认账号）
   - 或配置：`channels.twitch.accessToken`
   - 如果都设置，配置优先（环境变量回退仅默认账号）。
5. 启动 Gateway。

**⚠️ 重要：** 添加访问控制（`allowFrom` 或 `allowedRoles`）防止未授权用户触发 bot。`requireMention` 默认为 `true`。

最小配置：

```json5
{
  channels: {
    twitch: {
      enabled: true,
      username: "openclaw", // Bot 的 Twitch 账号
      accessToken: "oauth:abc123...", // OAuth Access Token（或使用 OPENCLAW_TWITCH_ACCESS_TOKEN 环境变量）
      clientId: "xyz789...", // Token Generator 的 Client ID
      channel: "vevisk", // 要加入的 Twitch channel（必需）
      allowFrom: ["123456789"], // （推荐）仅你的 Twitch user ID - 从 https://www.streamweasels.com/tools/convert-twitch-username-to-user-id/ 获取
    },
  },
}
```

## 它是什么

- Gateway 拥有的 Twitch channel。
- 确定性路由：回复总是返回 Twitch。
- 每个账号映射到隔离的 session 键 `agent:<agentId>:twitch:<accountName>`。
- `username` 是 bot 账号（谁认证），`channel` 是要加入的聊天室。

## 设置（详细）

### 生成 credentials

使用 [Twitch Token Generator](https://twitchtokengenerator.com/):

- 选择 **Bot Token**
- 验证 scopes `chat:read` 和 `chat:write` 已选中
- 复制 **Client ID** 和 **Access Token**

无需手动 app 注册。Tokens 数小时后过期。

### 配置 bot

**环境变量（仅默认账号）：**

```bash
OPENCLAW_TWITCH_ACCESS_TOKEN=oauth:abc123...
```

**或配置：**

```json5
{
  channels: {
    twitch: {
      enabled: true,
      username: "openclaw",
      accessToken: "oauth:abc123...",
      clientId: "xyz789...",
      channel: "vevisk",
    },
  },
}
```

如果环境变量和配置都设置，配置优先。

### 访问控制（推荐）

```json5
{
  channels: {
    twitch: {
      allowFrom: ["123456789"], // （推荐）仅你的 Twitch user ID
    },
  },
}
```

推荐 `allowFrom` 用于硬白名单。如果你想要基于 role 的访问则使用 `allowedRoles`。

**可用 roles：** `"moderator"`、`"owner"`、`"vip"`、`"subscriber"`、`"all"`。

**为什么用 user IDs？** Username 可以改变，允许冒充。User ID 是永久的。

查找你的 Twitch user ID：[https://www.streamweasels.com/tools/convert-twitch-username-to-user-id/](https://www.streamweasels.com/tools/convert-twitch-username-to-user-id/)（将你的 Twitch username 转换为 ID）

## Token 刷新（可选）

来自 [Twitch Token Generator](https://twitchtokengenerator.com/) 的 tokens 无法自动刷新 - 过期时重新生成。

要自动 token 刷新，在 [Twitch Developer Console](https://dev.twitch.tv/console) 创建你的 Twitch application 并添加到配置：

```json5
{
  channels: {
    twitch: {
      clientSecret: "your_client_secret",
      refreshToken: "your_refresh_token",
    },
  },
}
```

Bot 在过期前自动刷新 tokens 并记录刷新事件。

## 多账号支持

使用 `channels.twitch.accounts` 配置账号级别 tokens。参见 [`gateway/configuration`](/gateway/configuration) 的通用模式。

示例（一个 bot 账号在两个 channels）：

```json5
{
  channels: {
    twitch: {
      accounts: {
        channel1: {
          username: "openclaw",
          accessToken: "oauth:abc123...",
          clientId: "xyz789...",
          channel: "vevisk",
        },
        channel2: {
          username: "openclaw",
          accessToken: "oauth:def456...",
          clientId: "uvw012...",
          channel: "secondchannel",
        },
      },
    },
  },
}
```

**注意：** 每个账号需要自己的 token（每个 channel 一个 token）。

## 访问控制

### 基于 role 的限制

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          allowedRoles: ["moderator", "vip"],
        },
      },
    },
  },
}
```

### User ID 白名单（最安全）

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          allowFrom: ["123456789", "987654321"],
        },
      },
    },
  },
}
```

### 基于 role 的访问（替代）

`allowFrom` 是硬白名单。设置后，只有那些 user ID 被允许。
如果你想要基于 role 的访问，保持 `allowFrom` 未设置并配置 `allowedRoles`：

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          allowedRoles: ["moderator"],
        },
      },
    },
  },
}
```

### 禁用 @mention 要求

默认情况下，`requireMention` 为 `true`。要禁用并响应所有消息：

```json5
{
  channels: {
    twitch: {
      accounts: {
        default: {
          requireMention: false,
        },
      },
    },
  },
}
```

## 故障排除

首先，运行诊断命令：

```bash
openclaw doctor
openclaw channels status --probe
```

### Bot 不响应消息

**检查访问控制：** 确保你的 user ID 在 `allowFrom` 中，或临时移除
`allowFrom` 并设置 `allowedRoles: ["all"]` 测试。

**检查 bot 在 channel 中：** Bot 必须加入 `channel` 中指定的 channel。

### Token 问题

**"Failed to connect" 或认证错误：**

- 验证 `accessToken` 是 OAuth access token 值（通常以 `oauth:` 前缀开头）
- 检查 token 有 `chat:read` 和 `chat:write` scopes
- 如果使用 token 刷新，验证 `clientSecret` 和 `refreshToken` 已设置

### Token 刷新不工作

**检查日志中的刷新事件：**

```
Using env token source for mybot
Access token refreshed for user 123456 (expires in 14400s)
```

如果看到 "token refresh disabled (no refresh token)"：

- 确保 `clientSecret` 已提供
- 确保 `refreshToken` 已提供

## 配置

**账号配置：**

- `username` - Bot username
- `accessToken` - 带有 `chat:read` 和 `chat:write` 的 OAuth access token
- `clientId` - Twitch Client ID（来自 Token Generator 或你的 app）
- `channel` - 要加入的 channel（必需）
- `enabled` - 启用此账号（默认：`true`）
- `clientSecret` - 可选：用于自动 token 刷新
- `refreshToken` - 可选：用于自动 token 刷新
- `expiresIn` - Token 过期秒数
- `obtainmentTimestamp` - Token 获取时间戳
- `allowFrom` - User ID 白名单
- `allowedRoles` - 基于 role 的访问控制（`"moderator" | "owner" | "vip" | "subscriber" | "all"`）
- `requireMention` - 需要 @mention（默认：`true`）

**Provider 选项：**

- `channels.twitch.enabled` - 启用/禁用 channel 启动
- `channels.twitch.username` - Bot username（简化的单账号配置）
- `channels.twitch.accessToken` - OAuth access token（简化的单账号配置）
- `channels.twitch.clientId` - Twitch Client ID（简化的单账号配置）
- `channels.twitch.channel` - 要加入的 channel（简化的单账号配置）
- `channels.twitch.accounts.<accountName>` - 多账号配置（以上所有账号字段）

完整示例：

```json5
{
  channels: {
    twitch: {
      enabled: true,
      username: "openclaw",
      accessToken: "oauth:abc123...",
      clientId: "xyz789...",
      channel: "vevisk",
      clientSecret: "secret123...",
      refreshToken: "refresh456...",
      allowFrom: ["123456789"],
      allowedRoles: ["moderator", "vip"],
      accounts: {
        default: {
          username: "mybot",
          accessToken: "oauth:abc123...",
          clientId: "xyz789...",
          channel: "your_channel",
          enabled: true,
          clientSecret: "secret123...",
          refreshToken: "refresh456...",
          expiresIn: 14400,
          obtainmentTimestamp: 1706092800000,
          allowFrom: ["123456789", "987654321"],
          allowedRoles: ["moderator"],
        },
      },
    },
  },
}
```

## 工具动作

Agent 可以调用 `twitch` 配合动作：

- `send` - 发送消息到 channel

示例：

```json5
{
  action: "twitch",
  params: {
    message: "Hello Twitch!",
    to: "#mychannel",
  },
}
```

## 安全和运维

- **将 tokens 当作密码** - 永不将 tokens 提交到 git
- **为长时间运行的 bots 使用自动 token 刷新**
- **访问控制使用 user ID 白名单而非 usernames**
- **监控日志** 用于 token 刷新事件和连接状态
- **最小范围 tokens** - 只请求 `chat:read` 和 `chat:write`
- **如果卡住**：确认没有其他进程拥有 session 后重启 Gateway

## 限制

- **500 字符** 每消息（在词边界自动分块）
- Markdown 在分块前被剥离
- 无速率限制（使用 Twitch 内置速率限制）

## 相关

- [Channels Overview](/channels) — 所有支持的 channels
- [Pairing](/channels/pairing) — DM 认证和配对流程
- [Groups](/channels/groups) — 群聊行为和提及门控
- [Channel Routing](/channels/channel-routing) — 消息的 session 路由
- [Security](/gateway/security) — 访问模型和安全加固
