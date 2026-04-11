---
summary: "Zalo bot support status, capabilities, and configuration"
read_when:
  - Working on Zalo features or webhooks
title: "Zalo"
---

# Zalo（Bot API）

状态：实验性。支持 DM。[Capabilities](#capabilities) 部分反映当前 Marketplace-bot 行为。

## 需要插件

Zalo 作为插件发布，不捆绑在核心安装中。

- 通过 CLI 安装：`openclaw plugins install @openclaw/zalo`
- 或在设置时选择 **Zalo** 并确认安装提示
- 详情：[Plugins](/tools/plugin)

## 快速设置（新手）

1. 安装 Zalo 插件：
   - 从源码检出：`openclaw plugins install ./path/to/local/zalo-plugin`
   - 从 npm（如果发布）：`openclaw plugins install @openclaw/zalo`
   - 或在设置时选择 **Zalo** 并确认安装提示
2. 设置 token：
   - 环境变量：`ZALO_BOT_TOKEN=...`
   - 或配置：`channels.zalo.accounts.default.botToken: "..."`。
3. 重启 Gateway（或完成设置）。
4. DM 访问默认为配对；首次联系时批准配对代码。

最小配置：

```json5
{
  channels: {
    zalo: {
      enabled: true,
      accounts: {
        default: {
          botToken: "12345689:abc-xyz",
          dmPolicy: "pairing",
        },
      },
    },
  },
}
```

## 它是什么

Zalo 是越南为主的消息应用；其 Bot API 让 Gateway 为 1:1 对话运行 bot。
适合支持或通知，你需要确定性路由回 Zalo。

此页面反映 **Zalo Bot Creator / Marketplace bots** 的当前 OpenClaw 行为。
**Zalo Official Account (OA) bots** 是不同的 Zalo 产品界面，可能行为不同。

- Gateway 拥有的 Zalo Bot API channel。
- 确定性路由：回复返回 Zalo；模型从不选择 channels。
- DM 共享 agent 的主 session。
- [Capabilities](#capabilities) 部分显示当前 Marketplace-bot 支持。

## 设置（快速路径）

### 1) 创建 bot token（Zalo Bot Platform）

1. 前往 [https://bot.zaloplatforms.com](https://bot.zaloplatforms.com) 并登录。
2. 创建新 bot 并配置其设置。
3. 复制完整 bot token（通常为 `numeric_id:secret`）。对于 Marketplace bots，可用的运行时 token 可能出现在创建后的 bot 欢迎消息中。

### 2) 配置 token（环境变量或配置）

示例：

```json5
{
  channels: {
    zalo: {
      enabled: true,
      accounts: {
        default: {
          botToken: "12345689:abc-xyz",
          dmPolicy: "pairing",
        },
      },
    },
  },
}
```

如果你后来迁移到群组可用的 Zalo bot 界面，可以显式添加群组特定配置如 `groupPolicy` 和 `groupAllowFrom`。对于当前 Marketplace-bot 行为，参见 [Capabilities](#capabilities)。

环境变量选项：`ZALO_BOT_TOKEN=...`（仅适用于默认账号）。

多账号支持：使用 `channels.zalo.accounts` 配置账号级别 tokens 和可选 `name`。

3. 重启 Gateway。Zalo 在 token 解析时启动（环境变量或配置）。
4. DM 访问默认为配对。首次联系 bot 时批准代码。

## 工作原理（行为）

- 入站消息规范化为共享 channel envelope，带媒体占位符。
- 回复总是路由回相同 Zalo chat。
- 默认长轮询；webhook 模式通过 `channels.zalo.webhookUrl` 可用。

## 限制

- 出站文本分块到 2000 字符（Zalo API 限制）。
- 媒体下载/上传受 `channels.zalo.mediaMaxMb` 上限（默认 5）。
- 流式传输默认被阻止，因为 2000 字符限制使流式传输不太有用。

## 访问控制（DM）

### DM 访问

- 默认：`channels.zalo.dmPolicy = "pairing"`。未知发送者收到配对代码；消息在批准前被忽略（代码 1 小时后过期）。
- 批准方式：
  - `openclaw pairing list zalo`
  - `openclaw pairing approve zalo <CODE>`
- 配对是默认 token 交换。详情：[Pairing](/channels/pairing)
- `channels.zalo.allowFrom` 接受数字用户 ID（无 username 查找可用）。

## 访问控制（群组）

对于 **Zalo Bot Creator / Marketplace bots**，群组支持实践中不可用，因为 bot 根本无法被添加到群组。

这意味着以下群组相关配置键存在于 schema 中，但对 Marketplace bots 不可用：

- `channels.zalo.groupPolicy` 控制群组入站处理：`open | allowlist | disabled`。
- `channels.zalo.groupAllowFrom` 限制哪些发送者 ID 可在群组中触发 bot。
- 如果 `groupAllowFrom` 未设置，Zalo 回退到 `allowFrom` 进行发送者检查。
- 运行时注意：如果 `channels.zalo` 完全缺失，运行时仍回退到 `groupPolicy="allowlist"` 用于安全。

群组策略值（当群组访问在你的 bot 界面上可用时）：

- `groupPolicy: "disabled"` — 阻止所有群组消息。
- `groupPolicy: "open"` — 允许任何群组成员（提及门控）。
- `groupPolicy: "allowlist"` — 失败关闭默认；只接受白名单发送者。

如果你使用不同的 Zalo bot 产品界面并验证了工作的群组行为，单独记录而不是假设它与 Marketplace-bot 流程匹配。

## 长轮询 vs webhook

- 默认：长轮询（无需公共 URL）。
- Webhook 模式：设置 `channels.zalo.webhookUrl` 和 `channels.zalo.webhookSecret`。
  - Webhook secret 必须为 8-256 字符。
  - Webhook URL 必须使用 HTTPS。
  - Zalo 用 `X-Bot-Api-Secret-Token` header 发送事件用于验证。
  - Gateway HTTP 在 `channels.zalo.webhookPath` 处理 webhook 请求（默认为 webhook URL 路径）。
  - 请求必须使用 `Content-Type: application/json`（或 `+json` media types）。
  - 重复事件（`event_name + message_id`）在短重播窗口内被忽略。
  - 突发流量按路径/源速率限制，可能返回 HTTP 429。

**注意：** getUpdates（轮询）和 webhook 按 Zalo API 文档互斥。

## 支持的消息类型

快速支持快照见 [Capabilities](#capabilities)。以下注释在行为需要额外上下文时添加细节。

- **文本消息**：完全支持，2000 字符分块。
- **文本中的普通 URL**：表现为普通文本输入。
- **链接预览 / 富链接卡片**：见 [Capabilities](#capabilities) 中 Marketplace-bot 状态；它们未可靠触发回复。
- **图片消息**：见 [Capabilities](#capabilities) 中 Marketplace-bot 状态；入站图片处理不可靠（typing indicator 无最终回复）。
- **Stickers**：见 [Capabilities](#capabilities) 中 Marketplace-bot 状态。
- **语音 notes / 音频文件 / 视频 / 通用文件附件**：见 [Capabilities](#capabilities) 中 Marketplace-bot 状态。
- **不支持类型**：被记录（例如来自受保护用户的消息）。

## Capabilities

此表总结当前 **Zalo Bot Creator / Marketplace bot** 在 OpenClaw 中的行为。

| 功能                     | 状态                              |
| ------------------------ | --------------------------------- |
| 直接消息                 | ✅ 支持                           |
| 群组                     | ❌ Marketplace bots 不可用        |
| 媒体（入站图片）         | ⚠️ 有限 / 在你的环境中验证        |
| 媒体（出站图片）         | ⚠️ Marketplace bots 未重新测试    |
| 文本中的普通 URL         | ✅ 支持                           |
| 链接预览                 | ⚠️ Marketplace bots 不可靠        |
| 反应                     | ❌ 不支持                         |
| Stickers                 | ⚠️ Marketplace bots 无 agent 回复 |
| 语音 notes / 音频 / 视频 | ⚠️ Marketplace bots 无 agent 回复 |
| 文件附件                 | ⚠️ Marketplace bots 无 agent 回复 |
| Threads                  | ❌ 不支持                         |
| Polls                    | ❌ 不支持                         |
| 原生命令                 | ❌ 不支持                         |
| 流式传输                 | ⚠️ 被阻止（2000 字符限制）        |

## 投递目标（CLI/cron）

- 使用 chat id 作为目标。
- 示例：`openclaw message send --channel zalo --target 123456789 --message "hi"`。

## 故障排除

**Bot 不响应：**

- 检查 token 有效：`openclaw channels status --probe`
- 验证发送者已批准（配对或 allowFrom）
- 检查 Gateway 日志：`openclaw logs --follow`

**Webhook 未接收事件：**

- 确保 webhook URL 使用 HTTPS
- 验证 secret token 为 8-256 字符
- 确认 Gateway HTTP 端点在配置路径上可达
- 检查 getUpdates 轮询未运行（它们互斥）

## 配置参考（Zalo）

完整配置：[Configuration](/gateway/configuration)

顶层平键（`channels.zalo.botToken`、`channels.zalo.dmPolicy` 等）是旧版单账号简写。新配置推荐 `channels.zalo.accounts.<id>.*`。两种形式仍在此记录因为它们存在于 schema 中。

Provider 选项：

- `channels.zalo.enabled`: 启用/禁用 channel 启动。
- `channels.zalo.botToken`: 来自 Zalo Bot Platform 的 bot token。
- `channels.zalo.tokenFile`: 从常规文件路径读取 token。拒绝 symlinks。
- `channels.zalo.dmPolicy`: `pairing | allowlist | open | disabled`（默认：pairing）。
- `channels.zalo.allowFrom`: DM 白名单（用户 ID）。`open` 需要 `"*"`。Wizard 会询问数字 ID。
- `channels.zalo.groupPolicy`: `open | allowlist | disabled`（默认：allowlist）。配置中存在；当前 Marketplace-bot 行为见 [Capabilities](#capabilities) 和 [Access control (Groups)](#access-control-groups)。
- `channels.zalo.groupAllowFrom`: 群组发送者白名单（用户 ID）。未设置时回退到 `allowFrom`。
- `channels.zalo.mediaMaxMb`: 入站/出站媒体上限（MB，默认 5）。
- `channels.zalo.webhookUrl`: 启用 webhook 模式（需要 HTTPS）。
- `channels.zalo.webhookSecret`: webhook secret（8-256 字符）。
- `channels.zalo.webhookPath`: Gateway HTTP server 上的 webhook 路径。
- `channels.zalo.proxy`: API 请求的代理 URL。

多账号选项：

- `channels.zalo.accounts.<id>.botToken`: 账号级别 token。
- `channels.zalo.accounts.<id>.tokenFile`: 账号级别常规 token 文件。拒绝 symlinks。
- `channels.zalo.accounts.<id>.name`: 显示名称。
- `channels.zalo.accounts.<id>.enabled`: 启用/禁用账号。
- `channels.zalo.accounts.<id>.dmPolicy`: 账号级别 DM 策略。
- `channels.zalo.accounts.<id>.allowFrom`: 账号级别白名单。
- `channels.zalo.accounts.<id>.groupPolicy`: 账号级别群组策略。配置中存在；当前 Marketplace-bot 行为见 [Capabilities](#capabilities) 和 [Access control (Groups)](#access-control-groups)。
- `channels.zalo.accounts.<id>.groupAllowFrom`: 账号级别群组发送者白名单。
- `channels.zalo.accounts.<id>.webhookUrl`: 账号级别 webhook URL。
- `channels.zalo.accounts.<id>.webhookSecret`: 账号级别 webhook secret。
- `channels.zalo.accounts.<id>.webhookPath`: 账号级别 webhook 路径。
- `channels.zalo.accounts.<id>.proxy`: 账号级别代理 URL。

## 相关

- [Channels Overview](/channels) — 所有支持的 channels
- [Pairing](/channels/pairing) — DM 认证和配对流程
- [Groups](/channels/groups) — 群聊行为和提及门控
- [Channel Routing](/channels/channel-routing) — 消息的 session 路由
- [Security](/gateway/security) — 访问模型和安全加固
