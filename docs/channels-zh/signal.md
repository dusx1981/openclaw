---
summary: "Signal support via signal-cli (JSON-RPC + SSE), setup paths, and number model"
read_when:
  - Setting up Signal support
  - Debugging Signal send/receive
title: "Signal"
---

# Signal (signal-cli)

状态：外部 CLI 集成。Gateway 通过 HTTP JSON-RPC + SSE 与 `signal-cli` 通信。

## 前提条件

- 在服务器上安装 OpenClaw（以下 Linux 流程在 Ubuntu 24 上测试）。
- Gateway 运行的主机上需要 `signal-cli`。
- 一个可以接收验证短信的电话号码（用于短信注册路径）。
- 注册时需要浏览器访问 Signal captcha (`signalcaptchas.org`)。

## 快速设置（新手）

1. 为机器人使用**单独的 Signal 号码**（推荐）。
2. 安装 `signal-cli`（如果使用 JVM 版本需要 Java）。
3. 选择一种设置路径：
   - **路径 A（QR 链接）：** `signal-cli link -n "OpenClaw"` 然后用 Signal 扫码。
   - **路径 B（SMS 注册）：** 用 captcha + SMS 验证注册专用号码。
4. 配置 OpenClaw 并重启 Gateway。
5. 发送第一条 DM 并批准配对 (`openclaw pairing approve signal <CODE>`。

最小配置：

```json5
{
  channels: {
    signal: {
      enabled: true,
      account: "+15551234567",
      cliPath: "signal-cli",
      dmPolicy: "pairing",
      allowFrom: ["+15557654321"],
    },
  },
}
```

字段参考：

| 字段        | 描述                                                   |
| ----------- | ------------------------------------------------------ |
| `account`   | Bot 电话号码，E.164 格式 (`+15551234567`)              |
| `cliPath`   | `signal-cli` 路径（如果在 `PATH` 中则为 `signal-cli`） |
| `dmPolicy`  | DM 访问策略（推荐 `pairing`）                          |
| `allowFrom` | 允许 DM 的电话号码或 `uuid:<id>` 值                    |

## 它是什么

- 通过 `signal-cli` 的 Signal channel（非嵌入式 libsignal）。
- 确定性路由：回复总是返回 Signal。
- DM 共享 agent 的主 session；群组隔离 (`agent:<agentId>:signal:group:<groupId>`。

## 配置写入

默认情况下，Signal 允许由 `/config set|unset` 触发的配置更新（需要 `commands.config: true`）。

禁用方法：

```json5
{
  channels: { signal: { configWrites: false } },
}
```

## 号码模型（重要）

- Gateway 连接到一个 **Signal 设备**（`signal-cli` 账号）。
- 如果你在**个人 Signal 账号**上运行 bot，它会忽略你自己的消息（防循环）。
- 对于"我发消息给 bot 它回复"的场景，使用**单独的 bot 号码**。

## 设置路径 A：链接现有 Signal 账号（QR）

1. 安装 `signal-cli`（JVM 或原生版本）。
2. 链接 bot 账号：
   - `signal-cli link -n "OpenClaw"` 然后在 Signal 中扫描 QR。
3. 配置 Signal 并启动 Gateway。

示例：

```json5
{
  channels: {
    signal: {
      enabled: true,
      account: "+15551234567",
      cliPath: "signal-cli",
      dmPolicy: "pairing",
      allowFrom: ["+15557654321"],
    },
  },
}
```

多账号支持：使用 `channels.signal.accounts` 配置每个账号及可选 `name`。参见 [`gateway/configuration`](/gateway/configuration-reference#multi-account-all-channels) 的通用模式。

## 设置路径 B：注册专用 bot 号码（SMS，Linux）

当你想要一个专用 bot 号码而不是链接现有 Signal app 账号时使用此路径。

1. 获取一个可以接收 SMS 的号码（或固定电话的语音验证）。
   - 使用专用 bot 号码避免账号/session 冲突。
2. 在 Gateway 主机上安装 `signal-cli`：

```bash
VERSION=$(curl -Ls -o /dev/null -w %{url_effective} https://github.com/AsamK/signal-cli/releases/latest | sed -e 's/^.*\/v//')
curl -L -O "https://github.com/AsamK/signal-cli/releases/download/v${VERSION}/signal-cli-${VERSION}-Linux-native.tar.gz"
sudo tar xf "signal-cli-${VERSION}-Linux-native.tar.gz" -C /opt
sudo ln -sf /opt/signal-cli /usr/local/bin/
signal-cli --version
```

如果使用 JVM 版本 (`signal-cli-${VERSION}.tar.gz`），先安装 JRE 25+。
保持 `signal-cli` 更新；上游指出旧版本可能因 Signal 服务器 API 变化而失效。

3. 注册并验证号码：

```bash
signal-cli -a +<BOT_PHONE_NUMBER> register
```

如果需要 captcha：

1. 打开 `https://signalcaptchas.org/registration/generate.html`。
2. 完成 captcha，从"Open Signal"复制 `signalcaptcha://...` 链接目标。
3. 尽可能与浏览器 session 使用相同的外部 IP。
4. 立即重新运行注册（captcha token 快速过期）：

```bash
signal-cli -a +<BOT_PHONE_NUMBER> register --captcha '<SIGNALCAPTCHA_URL>'
signal-cli -a +<BOT_PHONE_NUMBER> verify <VERIFICATION_CODE>
```

4. 配置 OpenClaw，重启 Gateway，验证 channel：

```bash
# 如果以用户 systemd 服务运行 Gateway：
systemctl --user restart openclaw-gateway.service

# 然后验证：
openclaw doctor
openclaw channels status --probe
```

5. 配对 DM 发送者：
   - 发送任意消息给 bot 号码。
   - 在服务器上批准代码：`openclaw pairing approve signal <PAIRING_CODE>`。
   - 将 bot 号码保存为手机联系人以避免"未知联系人"提示。

重要：用 `signal-cli` 注册电话号码账号可能导致该号码的主 Signal app session 失效。建议使用专用 bot 号码，或如果需要保持现有手机 app 设置则使用 QR 链接模式。

上游参考：

- `signal-cli` README: `https://github.com/AsamK/signal-cli`
- Captcha 流程: `https://github.com/AsamK/signal-cli/wiki/Registration-with-captcha`
- 链接流程: `https://github.com/AsamK/signal-cli/wiki/Linking-other-devices-(Provisioning)`

## 外部守护进程模式（httpUrl）

如果你想自己管理 `signal-cli`（慢 JVM 冷启动、容器初始化或共享 CPU），单独运行守护进程并让 OpenClaw 连接它：

```json5
{
  channels: {
    signal: {
      httpUrl: "http://127.0.0.1:8080",
      autoStart: false,
    },
  },
}
```

这跳过 OpenClaw 内部的自动启动和启动等待。对于自动启动时的慢启动，设置 `channels.signal.startupTimeoutMs`。

## 访问控制（DM + 群组）

DM：

- 默认：`channels.signal.dmPolicy = "pairing"`。
- 未知发送者收到配对代码；消息在批准前被忽略（代码 1 小时后过期）。
- 批准方式：
  - `openclaw pairing list signal`
  - `openclaw pairing approve signal <CODE>`
- 配对是 Signal DM 的默认 token 交换。详情：[Pairing](/channels/pairing)
- 仅 UUID 发送者（来自 `sourceUuid`）存储为 `uuid:<id>` 在 `channels.signal.allowFrom`。

群组：

- `channels.signal.groupPolicy = open | allowlist | disabled`。
- `channels.signal.groupAllowFrom` 控制当设置为 `allowlist` 时谁可以在群组中触发。
- `channels.signal.groups["<group-id>" | "*"]` 可以用 `requireMention`、`tools` 和 `toolsBySender` 覆盖群组行为。
- 多账号设置中使用 `channels.signal.accounts.<id>.groups` 进行账号级别覆盖。
- 运行时注意：如果 `channels.signal` 完全缺失，运行时回退到 `groupPolicy="allowlist"` 进行群组检查（即使设置了 `channels.defaults.groupPolicy`）。

## 工作原理（行为）

- `signal-cli` 作为守护进程运行；Gateway 通过 SSE 读取事件。
- 入站消息规范化为共享 channel envelope。
- 回复总是路由回相同号码或群组。

## 媒体 + 限制

- 出站文本分块到 `channels.signal.textChunkLimit`（默认 4000）。
- 可选换行分块：设置 `channels.signal.chunkMode="newline"` 在长度分块前按空行（段落边界）分割。
- 支持附件（从 `signal-cli` 获取的 base64）。
- 默认媒体上限：`channels.signal.mediaMaxMb`（默认 8）。
- 使用 `channels.signal.ignoreAttachments` 跳过下载媒体。
- 群组历史上下文使用 `channels.signal.historyLimit`（或 `channels.signal.accounts.*.historyLimit`），回退到 `messages.groupChat.historyLimit`。设为 `0` 禁用（默认 50）。

## 输入 + 已读回执

- **输入指示器**：OpenClaw 通过 `signal-cli sendTyping` 发送输入信号，在回复运行时刷新它们。
- **已读回执**：当 `channels.signal.sendReadReceipts` 为 true 时，OpenClaw 为允许的 DM 转发已读回执。
- Signal-cli 不暴露群组的已读回执。

## 反应（消息工具）

- 使用 `message action=react` 配合 `channel=signal`。
- 目标：发送者 E.164 或 UUID（使用配对输出的 `uuid:<id>`；裸 UUID 也行）。
- `messageId` 是你正在反应的消息的 Signal 时间戳。
- 群组反应需要 `targetAuthor` 或 `targetAuthorUuid`。

示例：

```
message action=react channel=signal target=uuid:123e4567-e89b-12d3-a456-426614174000 messageId=1737630212345 emoji=🔥
message action=react channel=signal target=+15551234567 messageId=1737630212345 emoji=🔥 remove=true
message action=react channel=signal target=signal:group:<groupId> targetAuthor=uuid:<sender-uuid> messageId=1737630212345 emoji=✅
```

配置：

- `channels.signal.actions.reactions`: 启用/禁用反应动作（默认 true）。
- `channels.signal.reactionLevel`: `off | ack | minimal | extensive`。
  - `off`/`ack` 禁用 agent 反应（消息工具 `react` 会报错）。
  - `minimal`/`extensive` 启用 agent 反应并设置指导级别。
- 账号级别覆盖：`channels.signal.accounts.<id>.actions.reactions`、`channels.signal.accounts.<id>.reactionLevel`。

## 投递目标（CLI/cron）

- DM：`signal:+15551234567`（或纯 E.164）。
- UUID DM：`uuid:<id>`（或裸 UUID）。
- 群组：`signal:group:<groupId>`。
- 用户名：`username:<name>`（如果你的 Signal 账号支持）。

## 故障排除

先运行这个排查阶梯：

```bash
openclaw status
openclaw gateway status
openclaw logs --follow
openclaw doctor
openclaw channels status --probe
```

然后必要时确认 DM 配对状态：

```bash
openclaw pairing list signal
```

常见故障：

- 守护进程可达但无回复：验证账号/守护进程设置（`httpUrl`、`account`）和接收模式。
- DM 被忽略：发送者等待配对批准。
- 群组消息被忽略：群组发送者/提及门控阻止投递。
- 编辑后配置验证错误：运行 `openclaw doctor --fix`。
- Signal 在诊断中缺失：确认 `channels.signal.enabled: true`。

额外检查：

```bash
openclaw pairing list signal
pgrep -af signal-cli
grep -i "signal" "/tmp/openclaw/openclaw-$(date +%Y-%m-%d).log" | tail -20
```

排查流程：[/channels/troubleshooting](/channels/troubleshooting)。

## 安全说明

- `signal-cli` 本地存储账号密钥（通常在 `~/.local/share/signal-cli/data/`）。
- 服务器迁移或重建前备份 Signal 账号状态。
- 保持 `channels.signal.dmPolicy: "pairing"`，除非你明确需要更广泛的 DM 访问。
- SMS 验证只在注册或恢复流程中需要，但失去号码/账号控制会使重新注册复杂化。

## 配置参考（Signal）

完整配置：[Configuration](/gateway/configuration)

Provider 选项：

- `channels.signal.enabled`: 启用/禁用 channel 启动。
- `channels.signal.account`: bot 账号的 E.164。
- `channels.signal.cliPath`: `signal-cli` 的路径。
- `channels.signal.httpUrl`: 完整守护进程 URL（覆盖 host/port）。
- `channels.signal.httpHost`、`channels.signal.httpPort`: 守护进程绑定（默认 127.0.0.1:8080）。
- `channels.signal.autoStart`: 自动启动守护进程（默认 true 如果 `httpUrl` 未设置）。
- `channels.signal.startupTimeoutMs`: 启动等待超时 ms（上限 120000）。
- `channels.signal.receiveMode`: `on-start | manual`。
- `channels.signal.ignoreAttachments`: 跳过附件下载。
- `channels.signal.ignoreStories`: 从守护进程忽略 stories。
- `channels.signal.sendReadReceipts`: 转发已读回执。
- `channels.signal.dmPolicy`: `pairing | allowlist | open | disabled`（默认：pairing）。
- `channels.signal.allowFrom`: DM 白名单（E.164 或 `uuid:<id>`。`open` 需要 `"*"`。Signal 无用户名；使用电话/UUID id。
- `channels.signal.groupPolicy`: `open | allowlist | disabled`（默认：allowlist）。
- `channels.signal.groupAllowFrom`: 群组发送者白名单。
- `channels.signal.groups`: 按 Signal 群组 id（或 `"*"`）键控的群组级别覆盖。支持字段：`requireMention`、`tools`、`toolsBySender`。
- `channels.signal.accounts.<id>.groups`: 多账号设置中 `channels.signal.groups` 的账号级别版本。
- `channels.signal.historyLimit`: 作为上下文包含的最大群组消息数（0 禁用）。
- `channels.signal.dmHistoryLimit`: DM 历史限制（用户轮次）。用户级别覆盖：`channels.signal.dms["<phone_or_uuid>"].historyLimit`。
- `channels.signal.textChunkLimit`: 出站分块大小（字符）。
- `channels.signal.chunkMode`: `length`（默认）或 `newline` 在长度分块前按空行（段落边界）分割。
- `channels.signal.mediaMaxMb`: 入站/出站媒体上限（MB）。

相关全局选项：

- `agents.list[].groupChat.mentionPatterns`（Signal 不支持原生提及）。
- `messages.groupChat.mentionPatterns`（全局回退）。
- `messages.responsePrefix`。

## 相关

- [Channels Overview](/channels) — 所有支持的 channels
- [Pairing](/channels/pairing) — DM 认证和配对流程
- [Groups](/channels/groups) — 群聊行为和提及门控
- [Channel Routing](/channels/channel-routing) — 消息的 session 路由
- [Security](/gateway/security) — 访问模型和安全加固
