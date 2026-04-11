---
summary: "QQ Bot 设置、配置和使用"
read_when:
  - 你想将 OpenClaw 连接到 QQ
  - 你需要 QQ Bot 凭证设置
  - 你想要 QQ Bot 群组或私聊支持
title: QQ Bot
---

# QQ Bot

QQ Bot 通过官方 QQ Bot API（WebSocket gateway）连接到 OpenClaw。
插件支持 C2C 私聊、群组 @消息 和公会频道消息，带富媒体（图片、语音、视频、文件）。

状态：捆绑频道插件。私信、群聊、公会频道和媒体均受支持。反应和线程不受支持。

## OpenClaw 捆绑

当前 OpenClaw 安装捆绑 QQ Bot。正常设置无需单独
`openclaw plugins install` 步骤。

## 设置

1. 访问 [QQ Open Platform](https://q.qq.com/) 并用手机 QQ 扫码注册/登录。
2. 点击 **创建 Bot** 创建新的 QQ bot。
3. 在 bot 设置页面找到 **AppID** 和 **AppSecret** 并复制。

> AppSecret 不以明文存储——如果你离开页面未保存，
> 需要重新生成新的。

4. 添加频道：

```bash
openclaw channels add --channel qqbot --token "AppID:AppSecret"
```

5. 重启 Gateway。

交互式设置路径：

```bash
openclaw channels add
openclaw configure --section channels
```

## 配置

最小配置：

```json5
{
  channels: {
    qqbot: {
      enabled: true,
      appId: "YOUR_APP_ID",
      clientSecret: "YOUR_APP_SECRET",
    },
  },
}
```

默认账户环境变量：

- `QQBOT_APP_ID`
- `QQBOT_CLIENT_SECRET`

文件支持的 AppSecret：

```json5
{
  channels: {
    qqbot: {
      enabled: true,
      appId: "YOUR_APP_ID",
      clientSecretFile: "/path/to/qqbot-secret.txt",
    },
  },
}
```

注意：

- 环境变量回退仅适用于默认 QQ Bot 账户。
- `openclaw channels add --channel qqbot --token-file ...` 仅提供 AppSecret；AppID 必须已在配置或 `QQBOT_APP_ID` 中设置。
- `clientSecret` 也接受 SecretRef 输入，非仅 plaintext 字符串。

### 多账户设置

在单个 OpenClaw 实例下运行多个 QQ bots：

```json5
{
  channels: {
    qqbot: {
      enabled: true,
      appId: "111111111",
      clientSecret: "secret-of-bot-1",
      accounts: {
        bot2: {
          enabled: true,
          appId: "222222222",
          clientSecret: "secret-of-bot-2",
        },
      },
    },
  },
}
```

每个账户启动自己的 WebSocket 连接并维护独立的
令牌缓存（按 `appId` 隔离）。

通过 CLI 添加第二个 bot：

```bash
openclaw channels add --channel qqbot --account bot2 --token "222222222:secret-of-bot-2"
```

### 语音（STT / TTS）

STT 和 TTS 支持带优先级回退的两级配置：

| 设置 | 插件特定             | 框架回退                      |
| ---- | -------------------- | ----------------------------- |
| STT  | `channels.qqbot.stt` | `tools.media.audio.models[0]` |
| TTS  | `channels.qqbot.tts` | `messages.tts`                |

```json5
{
  channels: {
    qqbot: {
      stt: {
        provider: "your-provider",
        model: "your-stt-model",
      },
      tts: {
        provider: "your-provider",
        model: "your-tts-model",
        voice: "your-voice",
      },
    },
  },
}
```

设置 `enabled: false` 任一项以禁用。

出站音频上传/转码行为也可通过
`channels.qqbot.audioFormatPolicy` 调整：

- `sttDirectFormats`
- `uploadDirectFormats`
- `transcodeEnabled`

## 目标格式

| 格式                       | 描述       |
| -------------------------- | ---------- |
| `qqbot:c2c:OPENID`         | 私聊 (C2C) |
| `qqbot:group:GROUP_OPENID` | 群聊       |
| `qqbot:channel:CHANNEL_ID` | 公会频道   |

> 每个 bot 有自己的用户 OpenID 集。Bot A 收到的 OpenID **不能**
> 用于通过 Bot B 发送消息。

## 斜杠命令

内置命令在 AI 队列前拦截：

| 命令           | 描述                            |
| -------------- | ------------------------------- |
| `/bot-ping`    | 延迟测试                        |
| `/bot-version` | 显示 OpenClaw 框架版本          |
| `/bot-help`    | 列出所有命令                    |
| `/bot-upgrade` | 显示 QQBot 升级指南链接         |
| `/bot-logs`    | 将最近 gateway 日志作为文件导出 |

向任何命令添加 `?` 查看用法帮助（例如 `/bot-upgrade ?`)。

## 故障排除

- **Bot 回复 "gone to mars"：** 凭证未配置或 Gateway 未启动。
- **无入站消息：** 验证 `appId` 和 `clientSecret` 正确，且 bot 在 QQ Open Platform 上启用。
- **使用 `--token-file` 设置仍显示未配置：** `--token-file` 仅设置 AppSecret。你仍需在配置或 `QQBOT_APP_ID` 中设置 `appId`。
- **主动消息未到达：** QQ 可能拦截 bot 发起的消息如果用户最近未交互。
- **语音未转录：** 确保 STT 已配置且提供者可达。
