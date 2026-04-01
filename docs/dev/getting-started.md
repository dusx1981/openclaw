---
summary: "从源码启动和开发 OpenClaw 的完整指南"
title: "源码启动指南"
---

# 从源码启动 OpenClaw

本指南详细说明如何从源码启动和开发 OpenClaw 项目。

## 环境要求

### 必需软件

| 软件 | 版本要求 | 说明 |
|------|----------|------|
| Node.js | >= 22.16.0 | 推荐 Node 24，支持 Node 22 LTS |
| pnpm | 10.23.0+ | 推荐的包管理器 |
| Git | 任意版本 | 用于克隆仓库 |

### 可选软件

| 软件 | 用途 |
|------|------|
| Bun | 可选运行时，支持直接执行 TypeScript |
| Docker | 用于沙盒测试和容器化部署 |

## 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/openclaw/openclaw.git
cd openclaw
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 构建 UI（首次运行）

```bash
pnpm ui:build
```

### 4. 构建项目

```bash
pnpm build
```

### 5. 启动项目

```bash
# 方式一：使用 pnpm 运行 CLI（直接执行 TypeScript，开发推荐）
pnpm openclaw onboard --install-daemon

# 方式二：启动 Gateway（带自动重载）
pnpm gateway:watch

# 方式三：运行开发模式
pnpm dev
```

## 开发模式详解

### CLI 开发模式

`pnpm openclaw` 通过 `tsx` 直接执行 TypeScript，无需每次构建：

```bash
# 运行 onboarding 向导
pnpm openclaw onboard

# 启动 Gateway
pnpm openclaw gateway run --port 18789

# 发送消息
pnpm openclaw message send --to +1234567890 --message "Hello"

# 与 AI 对话
pnpm openclaw agent --message "Ship checklist" --thinking high
```

### Gateway 开发模式

```bash
# 带自动重载的 Gateway（修改代码后自动重启）
pnpm gateway:watch

# 开发模式（跳过频道连接）
OPENCLAW_SKIP_CHANNELS=1 pnpm gateway:dev

# 重置开发环境
pnpm gateway:dev:reset
```

### TUI 开发模式

```bash
# 启动终端 UI
pnpm tui

# 开发模式 TUI
OPENCLAW_PROFILE=dev pnpm tui:dev
```

## 配置方法

### 基础配置文件

配置文件位置：`~/.openclaw/openclaw.json`

#### 最小配置示例

```json5
{
  agent: {
    model: "anthropic/claude-opus-4-6",
  },
}
```

#### 完整配置示例

```json5
{
  // AI 模型配置
  agent: {
    model: "anthropic/claude-opus-4-6",
    thinking: "high",
  },

  // Gateway 配置
  gateway: {
    port: 18789,
    bind: "loopback",
    mode: "local",
  },

  // Telegram 频道配置
  channels: {
    telegram: {
      botToken: "YOUR_BOT_TOKEN",
      allowFrom: ["*"],
    },
  },

  // Discord 频道配置
  channels: {
    discord: {
      token: "YOUR_DISCORD_TOKEN",
      allowFrom: ["*"],
    },
  },

  // Slack 频道配置
  channels: {
    slack: {
      botToken: "xoxb-...",
      appToken: "xapp-...",
    },
  },

  // WhatsApp 配置（需要先登录）
  channels: {
    whatsapp: {
      allowFrom: ["*"],
    },
  },
}
```

### 环境变量配置

创建 `.env` 文件或设置环境变量：

```bash
# Telegram
export TELEGRAM_BOT_TOKEN="YOUR_BOT_TOKEN"

# Discord
export DISCORD_BOT_TOKEN="YOUR_DISCORD_TOKEN"

# Slack
export SLACK_BOT_TOKEN="xoxb-..."
export SLACK_APP_TOKEN="xapp-..."

# OpenAI API Key
export OPENAI_API_KEY="sk-..."

# Anthropic API Key
export ANTHROPIC_API_KEY="sk-ant-..."
```

### 频道配置示例

#### Telegram Bot

1. 通过 [@BotFather](https://t.me/botfather) 创建 Bot 并获取 Token
2. 配置：

```json5
{
  channels: {
    telegram: {
      botToken: "123456:ABCDEF...",
    },
  },
}
```

或使用环境变量：

```bash
export TELEGRAM_BOT_TOKEN="123456:ABCDEF..."
```

#### Discord Bot

1. 在 [Discord Developer Portal](https://discord.com/developers/applications) 创建应用
2. 创建 Bot 并获取 Token
3. 配置：

```json5
{
  channels: {
    discord: {
      token: "YOUR_DISCORD_BOT_TOKEN",
      guilds: {
        "YOUR_GUILD_ID": {
          enabled: true,
        },
      },
    },
  },
}
```

#### WhatsApp

```bash
# 登录 WhatsApp
pnpm openclaw channels login

# 登录后会话保存在 ~/.openclaw/credentials/
```

#### BlueBubbles (iMessage)

```json5
{
  channels: {
    bluebubbles: {
      serverUrl: "http://your-mac:1234",
      password: "YOUR_PASSWORD",
      webhookPath: "/webhook/bluebubbles",
    },
  },
}
```

## 常用开发命令

### 构建相关

| 命令 | 说明 |
|------|------|
| `pnpm build` | 完整构建项目 |
| `pnpm build:docker` | Docker 环境构建 |
| `pnpm ui:build` | 构建 UI |

### 测试相关

| 命令 | 说明 |
|------|------|
| `pnpm test` | 运行测试 |
| `pnpm test:coverage` | 运行测试并生成覆盖率报告 |
| `pnpm test:watch` | 监听模式运行测试 |
| `pnpm test:fast` | 快速单元测试 |
| `pnpm test:gateway` | Gateway 相关测试 |
| `pnpm test:live` | 实时测试（需要真实 API Keys） |

### 代码质量

| 命令 | 说明 |
|------|------|
| `pnpm check` | 完整检查（格式 + 类型 + Lint） |
| `pnpm lint` | 运行 Oxlint |
| `pnpm lint:fix` | 自动修复 Lint 问题 |
| `pnpm format` | 格式化代码 |
| `pnpm tsgo` | TypeScript 类型检查 |

### 开发服务器

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 开发模式运行 |
| `pnpm gateway:watch` | Gateway 自动重载模式 |
| `pnpm gateway:dev` | Gateway 开发模式（跳过频道） |
| `pnpm tui` | 终端 UI |
| `pnpm ui:dev` | UI 开发服务器 |
| `pnpm docs:dev` | 文档开发服务器 |

## 项目结构

```
openclaw/
├── src/                    # 源代码
│   ├── cli/               # CLI 相关代码
│   ├── commands/          # CLI 命令实现
│   ├── gateway/           # Gateway 核心
│   ├── channels/          # 频道连接器
│   ├── telegram/          # Telegram 实现
│   ├── discord/           # Discord 实现
│   ├── slack/             # Slack 实现
│   ├── signal/            # Signal 实现
│   └── ...
├── extensions/            # 扩展插件
├── apps/
│   ├── macos/            # macOS 应用
│   ├── ios/              # iOS 应用
│   └── android/          # Android 应用
├── docs/                  # 文档
├── scripts/               # 构建脚本
├── ui/                    # Web UI
└── test/                  # 测试文件
```

## 故障排查

### 端口被占用

```bash
# 检查端口占用
lsof -i :18789

# 停止 Gateway
pnpm openclaw gateway stop
```

### 依赖安装失败

```bash
# 清理并重新安装
rm -rf node_modules
pnpm install
```

### Gateway 启动失败

```bash
# 运行诊断
pnpm openclaw doctor

# 查看详细日志
pnpm openclaw gateway run --verbose
```

### TypeScript 编译错误

```bash
# 清理构建缓存
rm -rf dist
pnpm build
```

## 相关文档

- [配置参考](/gateway/configuration)
- [频道配置](/channels)
- [Gateway 运维手册](/gateway)
- [安全指南](/gateway/security)