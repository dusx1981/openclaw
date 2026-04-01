---
summary: "OpenClaw 配置示例大全"
title: "配置示例大全"
---

# 配置示例大全

本文档提供 OpenClaw 各种场景的配置示例。

## 配置文件位置

| 文件 | 位置 | 用途 |
|------|------|------|
| 主配置 | `~/.openclaw/openclaw.json` | 全局配置 |
| 环境变量 | `.env` 或 shell | 敏感信息 |
| 凭证 | `~/.openclaw/credentials/` | 频道凭证存储 |

## 基础配置

### 最小配置

适用于：只想使用 CLI 与 AI 对话

```json5
{
  agent: {
    model: "openai/gpt-4.1",
  },
}
```

### 标准配置

适用于：本地开发 + 多频道

```json5
{
  agent: {
    model: "anthropic/claude-opus-4-6",
    thinking: "high",
  },

  gateway: {
    port: 18789,
    bind: "loopback",
    mode: "local",
  },

  channels: {
    telegram: {
      botToken: "YOUR_BOT_TOKEN",
    },
  },
}
```

## 模型配置

### OpenAI 模型

```json5
{
  agent: {
    model: "openai/gpt-4.1",
  },
}
```

环境变量：

```bash
export OPENAI_API_KEY="sk-..."
```

### Anthropic Claude

```json5
{
  agent: {
    model: "anthropic/claude-opus-4-6",
    thinking: "high",
  },
}
```

环境变量：

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

### 模型故障转移

配置多个模型，按优先级尝试：

```json5
{
  agent: {
    model: "anthropic/claude-opus-4-6",
  },

  authProfiles: {
    profiles: [
      {
        name: "claude-primary",
        type: "anthropic",
        apiKey: "${ANTHROPIC_API_KEY}",
      },
      {
        name: "openai-fallback",
        type: "openai",
        apiKey: "${OPENAI_API_KEY}",
      },
    ],

    defaults: {
      anthropic: ["claude-primary"],
      openai: ["openai-fallback"],
    },
  },
}
```

## Gateway 配置

### 本地模式（默认）

```json5
{
  gateway: {
    port: 18789,
    bind: "loopback",
    mode: "local",
  },
}
```

### Tailscale Serve 模式

仅 tailnet 内可访问：

```json5
{
  gateway: {
    port: 18789,
    bind: "loopback",
    tailscale: {
      mode: "serve",
    },
  },
}
```

### Tailscale Funnel 模式

公网访问（需要密码认证）：

```json5
{
  gateway: {
    port: 18789,
    bind: "loopback",
    auth: {
      mode: "password",
    },
    tailscale: {
      mode: "funnel",
    },
  },
}
```

### 远程访问

```json5
{
  gateway: {
    port: 18789,
    bind: "0.0.0.0",  // 监听所有接口
    auth: {
      mode: "password",
      password: "YOUR_SECURE_PASSWORD",
    },
  },
}
```

## 频道配置

### Telegram

#### 方式一：环境变量

```bash
export TELEGRAM_BOT_TOKEN="123456:ABCDEF..."
```

#### 方式二：配置文件

```json5
{
  channels: {
    telegram: {
      botToken: "123456:ABCDEF...",
      allowFrom: ["*"],              // 允许所有用户
      groups: {
        "*": {
          requireMention: true,      // 群组需要 @ 提及
        },
      },
    },
  },
}
```

#### Telegram Webhook 模式

```json5
{
  channels: {
    telegram: {
      botToken: "123456:ABCDEF...",
      webhookUrl: "https://your-domain.com/webhook/telegram",
      webhookSecret: "YOUR_SECRET",
    },
  },
}
```

### Discord

```json5
{
  channels: {
    discord: {
      token: "YOUR_BOT_TOKEN",
      allowFrom: ["*"],

      // 服务器配置
      guilds: {
        "GUILD_ID": {
          enabled: true,
        },
      },

      // 媒体限制
      mediaMaxMb: 25,
    },
  },
}
```

环境变量：

```bash
export DISCORD_BOT_TOKEN="YOUR_BOT_TOKEN"
```

### Slack

```json5
{
  channels: {
    slack: {
      botToken: "xoxb-...",
      appToken: "xapp-...",

      // DM 配置
      dmPolicy: "pairing",  // 需要配对码

      // 允许的频道
      allowFrom: ["*"],
    },
  },
}
```

环境变量：

```bash
export SLACK_BOT_TOKEN="xoxb-..."
export SLACK_APP_TOKEN="xapp-..."
```

### WhatsApp

```bash
# 首先登录
pnpm openclaw channels login
```

配置：

```json5
{
  channels: {
    whatsapp: {
      allowFrom: ["*"],

      // 群组配置
      groups: ["*"],  // 允许所有群组
    },
  },
}
```

### Signal

前置条件：安装 `signal-cli`

```json5
{
  channels: {
    signal: {
      phoneNumber: "+1234567890",
      allowFrom: ["*"],
    },
  },
}
```

### BlueBubbles (iMessage)

推荐用于 iMessage 集成。BlueBubbles 服务端运行在 macOS 上：

```json5
{
  channels: {
    bluebubbles: {
      serverUrl: "http://your-mac:1234",
      password: "YOUR_BLUEBUBBLES_PASSWORD",
      webhookPath: "/webhook/bluebubbles",
    },
  },
}
```

### iMessage (Legacy)

仅 macOS，需要 Messages.app 已登录：

```json5
{
  channels: {
    imessage: {
      enabled: true,
      groups: ["*"],
    },
  },
}
```

### Microsoft Teams

```json5
{
  channels: {
    msteams: {
      tenantId: "YOUR_TENANT_ID",
      clientId: "YOUR_CLIENT_ID",
      clientSecret: "YOUR_CLIENT_SECRET",

      allowFrom: ["*"],
      groupPolicy: "open",  // 或使用 groupAllowFrom
    },
  },
}
```

### Google Chat

```json5
{
  channels: {
    googlechat: {
      projectId: "YOUR_PROJECT_ID",
      privateKey: "-----BEGIN PRIVATE KEY-----\n...",
      clientEmail: "your-service-account@project.iam.gserviceaccount.com",
    },
  },
}
```

### Matrix

```json5
{
  channels: {
    matrix: {
      homeserverUrl: "https://matrix.org",
      accessToken: "YOUR_ACCESS_TOKEN",
      userId: "@yourbot:matrix.org",
    },
  },
}
```

### IRC

```json5
{
  channels: {
    irc: {
      server: "irc.libera.chat",
      port: 6697,
      nick: "YourBot",
      channels: ["#openclaw"],
    },
  },
}
```

### Feishu

```json5
{
  channels: {
    feishu: {
      appId: "YOUR_APP_ID",
      appSecret: "YOUR_APP_SECRET",
    },
  },
}
```

### LINE

```json5
{
  channels: {
    line: {
      channelAccessToken: "YOUR_ACCESS_TOKEN",
      channelSecret: "YOUR_CHANNEL_SECRET",
    },
  },
}
```

## 安全配置

### DM 配对策略

默认情况下，DM 需要 pairing code：

```json5
{
  channels: {
    telegram: {
      dmPolicy: "pairing",  // 默认值
    },
    discord: {
      dmPolicy: "pairing",
    },
    slack: {
      dmPolicy: "pairing",
    },
  },
}
```

### 开放 DM（谨慎使用）

```json5
{
  channels: {
    telegram: {
      dmPolicy: "open",
      allowFrom: ["*"],
    },
  },
}
```

### Sandbox 配置

为非 main 会话启用沙盒：

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main",
        allowlist: ["bash", "process", "read", "write", "edit"],
        denylist: ["browser", "canvas", "nodes", "cron"],
      },
    },
  },
}
```

## 浏览器控制

```json5
{
  browser: {
    enabled: true,
    color: "#FF4500",  // 浏览器边框颜色
  },
}
```

## 高级配置

### 多 Agent 路由

```json5
{
  agents: {
    defaults: {
      model: "anthropic/claude-opus-4-6",
      workspace: "~/.openclaw/workspace",
    },

    // 特定频道使用不同模型
    overrides: [
      {
        channels: ["telegram"],
        model: "openai/gpt-4.1",
      },
    ],
  },
}
```

### 认证配置

```json5
{
  authProfiles: {
    profiles: [
      {
        name: "openai-main",
        type: "openai",
        apiKey: "${OPENAI_API_KEY}",
      },
      {
        name: "anthropic-main",
        type: "anthropic",
        apiKey: "${ANTHROPIC_API_KEY}",
      },
    ],

    rotation: {
      enabled: true,
      onFailure: "next",
    },
  },
}
```

### 日志配置

```json5
{
  logging: {
    level: "debug",
    file: "~/.openclaw/logs/openclaw.log",
  },
}
```

## 环境变量参考

| 变量 | 用途 |
|------|------|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token |
| `DISCORD_BOT_TOKEN` | Discord Bot Token |
| `SLACK_BOT_TOKEN` | Slack Bot Token |
| `SLACK_APP_TOKEN` | Slack App Token |
| `OPENAI_API_KEY` | OpenAI API Key |
| `ANTHROPIC_API_KEY` | Anthropic API Key |
| `OPENCLAW_PROFILE` | 配置环境（dev/staging/prod） |
| `OPENCLAW_SKIP_CHANNELS` | 跳过频道连接 |
| `OPENCLAW_LIVE_TEST` | 启用实时测试 |

## 验证配置

```bash
# 检查配置是否正确
pnpm openclaw doctor

# 验证特定频道
pnpm openclaw channels status

# 详细诊断
pnpm openclaw gateway status --deep
```