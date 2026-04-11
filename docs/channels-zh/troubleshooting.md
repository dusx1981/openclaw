---
summary: "Fast channel level troubleshooting with per channel failure signatures and fixes"
read_when:
  - Channel transport says connected but replies fail
  - You need channel specific checks before deep provider docs
title: "Channel Troubleshooting"
---

# Channel 故障排除

当 channel 连接但行为错误时使用此页面。

## 命令阶梯

先按顺序运行这些：

```bash
openclaw status
openclaw gateway status
openclaw logs --follow
openclaw doctor
openclaw channels status --probe
```

健康基线：

- `Runtime: running`
- `RPC probe: ok`
- Channel probe 显示 connected/ready

## WhatsApp

### WhatsApp 故障特征

| 症状                  | 最快检查                                  | 修复                                  |
| --------------------- | ----------------------------------------- | ------------------------------------- |
| 已连接但无 DM 回复    | `openclaw pairing list whatsapp`          | 批准发送者或切换 DM 策略/白名单。     |
| 群组消息被忽略        | 检查配置中的 `requireMention` + 提及模式  | 提及 bot 或放宽该群组的提及策略。     |
| 随机断开/重新登录循环 | `openclaw channels status --probe` + 日志 | 重新登录并验证 credentials 目录健康。 |

完整故障排除：[/channels/whatsapp#troubleshooting](/channels/whatsapp#troubleshooting)

## Telegram

### Telegram 故障特征

| 症状                           | 最快检查                               | 修复                                                              |
| ------------------------------ | -------------------------------------- | ----------------------------------------------------------------- |
| `/start` 但无可用回复流程      | `openclaw pairing list telegram`       | 批准配对或更改 DM 策略。                                          |
| Bot 在线但群组保持沉默         | 验证提及要求和 bot 隐私模式            | 禁用隐私模式用于群组可见性或提及 bot。                            |
| 发送失败带网络错误             | 检查日志中的 Telegram API 调用失败     | 修复 DNS/IPv6/proxy 路由到 `api.telegram.org`。                   |
| `setMyCommands` 在启动时被拒绝 | 检查日志中的 `BOT_COMMANDS_TOO_MUCH`   | 减少插件/skill/自定义 Telegram 命令或禁用原生菜单。               |
| 升级后白名单阻止你             | `openclaw security audit` 和配置白名单 | 运行 `openclaw doctor --fix` 或用数字发送者 ID 替换 `@username`。 |

完整故障排除：[/channels/telegram#troubleshooting](/channels/telegram#troubleshooting)

## Discord

### Discord 故障特征

| 症状                    | 最快检查                           | 修复                                                    |
| ----------------------- | ---------------------------------- | ------------------------------------------------------- |
| Bot 在线但无 guild 回复 | `openclaw channels status --probe` | 允许 guild/channel 并验证 message content intent。      |
| 群组消息被忽略          | 检查日志中的提及门控丢弃           | 提及 bot 或设置 guild/channel `requireMention: false`。 |
| DM 回复缺失             | `openclaw pairing list discord`    | 批准 DM 配对或调整 DM 策略。                            |

完整故障排除：[/channels/discord#troubleshooting](/channels/discord#troubleshooting)

## Slack

### Slack 故障特征

| 症状                       | 最快检查                             | 修复                                       |
| -------------------------- | ------------------------------------ | ------------------------------------------ |
| Socket mode 已连接但无响应 | `openclaw channels status --probe`   | 验证 app token + bot token 和必需 scopes。 |
| DM 被阻止                  | `openclaw pairing list slack`        | 批准配对或放宽 DM 策略。                   |
| Channel 消息被忽略         | 检查 `groupPolicy` 和 channel 白名单 | 允许该 channel 或将策略切换为 `open`。     |

完整故障排除：[/channels/slack#troubleshooting](/channels/slack#troubleshooting)

## iMessage 和 BlueBubbles

### iMessage 和 BlueBubbles 故障特征

| 症状                      | 最快检查                                                                | 修复                                          |
| ------------------------- | ----------------------------------------------------------------------- | --------------------------------------------- |
| 无入站事件                | 验证 webhook/server 可达性和 app 权限                                   | 修复 webhook URL 或 BlueBubbles server 状态。 |
| 可发送但 macOS 上无法接收 | 检查 macOS Messages 自动化的隐私权限                                    | 重新授予 TCC 权限并重启 channel 进程。        |
| DM 发送者被阻止           | `openclaw pairing list imessage` 或 `openclaw pairing list bluebubbles` | 批准配对或更新白名单。                        |

完整故障排除：

- [/channels/imessage#troubleshooting](/channels/imessage#troubleshooting)
- [/channels/bluebubbles#troubleshooting](/channels/bluebubbles#troubleshooting)

## Signal

### Signal 故障特征

| 症状                    | 最快检查                           | 修复                                                |
| ----------------------- | ---------------------------------- | --------------------------------------------------- |
| 守护进程可达但 bot 沉默 | `openclaw channels status --probe` | 验证 `signal-cli` 守护进程 URL/account 和接收模式。 |
| DM 被阻止               | `openclaw pairing list signal`     | 批准发送者或调整 DM 策略。                          |
| 群组回复不触发          | 检查群组白名单和提及模式           | 添加发送者/群组或放宽门控。                         |

完整故障排除：[/channels/signal#troubleshooting](/channels/signal#troubleshooting)

## QQ Bot

### QQ Bot 故障特征

| 症状                    | 最快检查                               | 修复                                               |
| ----------------------- | -------------------------------------- | -------------------------------------------------- |
| Bot 回复 "gone to Mars" | 验证配置中的 `appId` 和 `clientSecret` | 设置 credentials 或重启 Gateway。                  |
| 无入站消息              | `openclaw channels status --probe`     | 在 QQ Open Platform 验证 credentials。             |
| 语音未转录              | 检查 STT provider 配置                 | 配置 `channels.qqbot.stt` 或 `tools.media.audio`。 |
| 主动消息未到达          | 检查 QQ 平台交互要求                   | QQ 可能阻止无最近交互的 bot 主动消息。             |

完整故障排除：[/channels/qqbot#troubleshooting](/channels/qqbot#troubleshooting)

## Matrix

### Matrix 故障特征

| 症状                               | 最快检查                               | 修复                                                                  |
| ---------------------------------- | -------------------------------------- | --------------------------------------------------------------------- |
| 已登录但忽略 room 消息             | `openclaw channels status --probe`     | 检查 `groupPolicy`、room 白名单和提及门控。                           |
| DM 不处理                          | `openclaw pairing list matrix`         | 批准发送者或调整 DM 策略。                                            |
| 加密 rooms 失败                    | `openclaw matrix verify status`        | 重新验证设备，然后检查 `openclaw matrix verify backup status`。       |
| Backup restore 待处理/损坏         | `openclaw matrix verify backup status` | 运行 `openclaw matrix verify backup restore` 或用 recovery key 重试。 |
| Cross-signing/bootstrap 看起来错误 | `openclaw matrix verify bootstrap`     | 一次性修复 secret storage、cross-signing 和 backup 状态。             |

完整设置和配置：[Matrix](/channels/matrix)
