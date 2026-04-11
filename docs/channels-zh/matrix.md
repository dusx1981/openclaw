---
summary: "Matrix 支持状态、设置和配置示例"
read_when:
  - 在 OpenClaw 中设置 Matrix
  - 配置 Matrix E2EE 和验证
title: "Matrix"
---

# Matrix (plugin)

Matrix 是 OpenClaw 的 Matrix 频道插件。
它使用官方 `matrix-js-sdk`，支持私信、房间、线程、媒体、反应、投票、位置和 E2EE。

## 需要插件

Matrix 是插件，不随核心 OpenClaw 捆绑。

从 npm 安装：

```bash
openclaw plugins install @openclaw/matrix
```

从本地检出安装：

```bash
openclaw plugins install ./path/to/local/matrix-plugin
```

详见 [Plugins](/tools/plugin)。

## 设置

1. 安装插件。
2. 在你的 homeserver 上创建 Matrix 账户。
3. 配置 `channels.matrix`，使用：
   - `homeserver` + `accessToken`，或
   - `homeserver` + `userId` + `password`。
4. 重启 gateway。
5. 与机器人发起私信或邀请其加入房间。

交互式设置路径：

```bash
openclaw channels add
openclaw configure --section channels
```

Matrix 向导实际询问的内容：

- homeserver URL
- 认证方式：访问令牌或密码
- 仅在选择密码认证时需要用户 ID
- 可选设备名称
- 是否启用 E2EE
- 是否现在配置 Matrix 房间访问

重要的向导行为：

- 如果所选账户已有 Matrix 认证环境变量，且该账户尚未在配置中保存认证，向导会提供环境变量快捷方式，仅为该账户写入 `enabled: true`。
- 当你交互式添加另一个 Matrix 账户时，输入的账户名称会被标准化为配置和环境变量中使用的账户 ID。例如，`Ops Bot` 变为 `ops-bot`。
- 私信白名单提示立即接受完整的 `@user:server` 值。显示名称仅在实时目录查找找到一个精确匹配时有效；否则向导会要求你使用完整的 Matrix ID 重试。
- 房间白名单提示直接接受房间 ID 和别名。它们也可以实时解析已加入房间的名称，但未解析的名称仅在设置期间按输入保留，稍后会被运行时白名单解析忽略。建议使用 `!room:server` 或 `#alias:server`。
- 运行时房间/会话身份使用稳定的 Matrix 房间 ID。房间声明的别名仅用作查找输入，而非长期会话键或稳定群组身份。
- 要在保存前解析房间名称，使用 `openclaw channels resolve --channel matrix "Project Room"`。

最小令牌式设置：

```json5
{
  channels: {
    matrix: {
      enabled: true,
      homeserver: "https://matrix.example.org",
      accessToken: "syt_xxx",
      dm: { policy: "pairing" },
    },
  },
}
```

密码式设置（登录后令牌被缓存）：

```json5
{
  channels: {
    matrix: {
      enabled: true,
      homeserver: "https://matrix.example.org",
      userId: "@bot:example.org",
      password: "replace-me", // pragma: allowlist secret
      deviceName: "OpenClaw Gateway",
    },
  },
}
```

Matrix 将缓存的凭证存储在 `~/.openclaw/credentials/matrix/`。
默认账户使用 `credentials.json`；命名账户使用 `credentials-<account>.json`。

环境变量等效项（当配置键未设置时使用）：

- `MATRIX_HOMESERVER`
- `MATRIX_ACCESS_TOKEN`
- `MATRIX_USER_ID`
- `MATRIX_PASSWORD`
- `MATRIX_DEVICE_ID`
- `MATRIX_DEVICE_NAME`

对于非默认账户，使用账户范围的环境变量：

- `MATRIX_<ACCOUNT_ID>_HOMESERVER`
- `MATRIX_<ACCOUNT_ID>_ACCESS_TOKEN`
- `MATRIX_<ACCOUNT_ID>_USER_ID`
- `MATRIX_<ACCOUNT_ID>_PASSWORD`
- `MATRIX_<ACCOUNT_ID>_DEVICE_ID`
- `MATRIX_<ACCOUNT_ID>_DEVICE_NAME`

账户 `ops` 示例：

- `MATRIX_OPS_HOMESERVER`
- `MATRIX_OPS_ACCESS_TOKEN`

对于标准化账户 ID `ops-bot`，使用：

- `MATRIX_OPS_X2D_BOT_HOMESERVER`
- `MATRIX_OPS_X2D_BOT_ACCESS_TOKEN`

Matrix 转义账户 ID 中的标点符号以保持范围环境变量无冲突。
例如，`-` 变为 `_X2D_`，所以 `ops-prod` 映射到 `MATRIX_OPS_X2D_PROD_*`。

交互式向导仅在这些认证环境变量已存在且所选账户尚未在配置中保存 Matrix 认证时才提供环境变量快捷方式。

## 配置示例

这是一个实用的基础配置，包含私信配对、房间白名单和启用的 E2EE：

```json5
{
  channels: {
    matrix: {
      enabled: true,
      homeserver: "https://matrix.example.org",
      accessToken: "syt_xxx",
      encryption: true,

      dm: {
        policy: "pairing",
        threadReplies: "off",
      },

      groupPolicy: "allowlist",
      groupAllowFrom: ["@admin:example.org"],
      groups: {
        "!roomid:example.org": {
          requireMention: true,
        },
      },

      autoJoin: "allowlist",
      autoJoinAllowlist: ["!roomid:example.org"],
      threadReplies: "inbound",
      replyToMode: "off",
      streaming: "partial",
    },
  },
}
```

## 流式预览

Matrix 回复流式是可选的。

当你希望 OpenClaw 发送单条草稿回复、在模型生成文本时原地编辑该草稿、并在回复完成时最终化它时，将 `channels.matrix.streaming` 设置为 `"partial"`：

```json5
{
  channels: {
    matrix: {
      streaming: "partial",
    },
  },
}
```

- `streaming: "off"` 是默认值。OpenClaw 等待最终回复并一次性发送。
- `streaming: "partial"` 为当前 assistant 块创建一条可编辑的预览消息，而非发送多条部分消息。
- `blockStreaming: true` 启用单独的 Matrix 进度消息。当 `streaming: "partial"` 时，Matrix 为当前块保留实时草稿，并将已完成的块保留为单独消息。
- 当 `streaming: "partial"` 且 `blockStreaming` 关闭时，Matrix 仅编辑实时草稿，在该块或回合完成时发送完成的回复。
- 如果预览不再适合单个 Matrix 事件，OpenClaw 停止预览流式并回退到正常的最终投递。
- 带媒体的回复仍正常发送附件。如果陈旧预览无法安全复用，OpenClaw 在发送最终媒体回复前将其删除。
- 预览编辑消耗额外的 Matrix API 调用。如果你想要最保守的速率限制行为，保持流式关闭。

`blockStreaming` 本身不启用草稿预览。
使用 `streaming: "partial"` 进行预览编辑；然后仅在你也希望已完成的 assistant 块作为单独进度消息可见时添加 `blockStreaming: true`。

## 加密和验证

在加密 (E2EE) 房间中，出站图片事件使用 `thumbnail_file` 以便图片预览与完整附件一起加密。未加密房间仍使用普通 `thumbnail_url`。无需配置——插件自动检测 E2EE 状态。

### Bot 到 bot 房间

默认情况下，来自其他已配置 OpenClaw Matrix 账户的 Matrix 消息被忽略。

当你有意想要 inter-agent Matrix 流量时使用 `allowBots`：

```json5
{
  channels: {
    matrix: {
      allowBots: "mentions", // true | "mentions"
      groups: {
        "!roomid:example.org": {
          requireMention: true,
        },
      },
    },
  },
}
```

- `allowBots: true` 在允许的房间和私信中接受来自其他已配置 Matrix bot 账户的消息。
- `allowBots: "mentions"` 仅在那些消息在房间中显式提及此 bot 时接受。私信仍被允许。
- `groups.<room>.allowBots` 覆盖单个房间的账户级设置。
- OpenClaw 仍忽略来自相同 Matrix 用户 ID 的消息以避免自回复循环。
- Matrix 此处不暴露原生 bot 标志；OpenClaw 将"bot-authored"视为"由此 OpenClaw gateway 上另一个已配置 Matrix 账户发送"。

在共享房间中启用 bot-to-bot 流量时使用严格的房间白名单和提及要求。

启用加密：

```json5
{
  channels: {
    matrix: {
      enabled: true,
      homeserver: "https://matrix.example.org",
      accessToken: "syt_xxx",
      encryption: true,
      dm: { policy: "pairing" },
    },
  },
}
```

检查验证状态：

```bash
openclaw matrix verify status
```

详细状态（完整诊断）：

```bash
openclaw matrix verify status --verbose
```

在机器可读输出中包含存储的恢复密钥：

```bash
openclaw matrix verify status --include-recovery-key --json
```

引导跨签名和验证状态：

```bash
openclaw matrix verify bootstrap
```

多账户支持：使用 `channels.matrix.accounts` 配合每账户凭证和可选 `name`。详见 [Configuration reference](/gateway/configuration-reference#multi-account-all-channels)。

详细引导诊断：

```bash
openclaw matrix verify bootstrap --verbose
```

在引导前强制重置新的跨签名身份：

```bash
openclaw matrix verify bootstrap --force-reset-cross-signing
```

使用恢复密钥验证此设备：

```bash
openclaw matrix verify device "<your-recovery-key>"
```

详细设备验证详情：

```bash
openclaw matrix verify device "<your-recovery-key>" --verbose
```

检查房间密钥备份健康状况：

```bash
openclaw matrix verify backup status
```

详细备份健康诊断：

```bash
openclaw matrix verify backup status --verbose
```

从服务器备份恢复房间密钥：

```bash
openclaw matrix verify backup restore
```

详细恢复诊断：

```bash
openclaw matrix verify backup restore --verbose
```

删除当前服务器备份并创建新的备份基线。如果存储的备份密钥无法干净加载，此重置也可以重新创建秘密存储，以便未来的冷启动可以加载新备份密钥：

```bash
openclaw matrix verify backup reset --yes
```

所有 `verify` 命令默认简洁（包括静默内部 SDK 日志），仅在使用 `--verbose` 时显示详细诊断。
脚本时使用 `--json` 获取完整机器可读输出。

在多账户设置中，Matrix CLI 命令使用隐式 Matrix 默认账户，除非你传入 `--account <id>`。
如果你配置多个命名账户，先设置 `channels.matrix.defaultAccount`，否则那些隐式 CLI 操作会停止并要求你显式选择账户。
当你希望验证或设备操作显式目标命名账户时使用 `--account`：

```bash
openclaw matrix verify status --account assistant
openclaw matrix verify backup restore --account assistant
openclaw matrix devices list --account assistant
```

当加密为命名账户禁用或不可用时，Matrix 警告和验证错误指向该账户的配置键，例如 `channels.matrix.accounts.assistant.encryption`。

### "已验证"的含义

OpenClaw 仅在此 Matrix 设备被你自己的跨签名身份验证时才将其视为已验证。
实践中，`openclaw matrix verify status --verbose` 暴露三个信任信号：

- `Locally trusted`：此设备仅被当前客户端信任
- `Cross-signing verified`：SDK 通过跨签名报告设备已验证
- `Signed by owner`：设备被你自己的自签名密钥签名

`Verified by owner` 仅在存在跨签名验证或所有者签名时变为 `yes`。
仅本地信任不足以让 OpenClaw 将设备视为完全已验证。

### 引导做什么

`openclaw matrix verify bootstrap` 是加密 Matrix 账户的修复和设置命令。
它按顺序执行以下所有操作：

- 引导秘密存储，尽可能复用现有恢复密钥
- 引导跨签名并上传缺失的公共跨签名密钥
- 尝试标记和跨签名当前设备
- 如果不存在则创建新的服务器端房间密钥备份

如果 homeserver 需要交互式认证来上传跨签名密钥，OpenClaw 先尝试无认证上传，然后使用 `m.login.dummy`，当配置了 `channels.matrix.password` 时使用 `m.login.password`。

仅在有意丢弃当前跨签名身份并创建新身份时使用 `--force-reset-cross-signing`。

如果你有意想丢弃当前房间密钥备份并为未来消息开始新备份基线，使用 `openclaw matrix verify backup reset --yes`。
仅在你接受不可恢复的旧加密历史将保持不可用、且 OpenClaw 可能重新创建秘密存储（如果当前备份秘密无法安全加载）时执行此操作。

### 新备份基线

如果你希望保持未来加密消息工作并接受丢失不可恢复的旧历史，按顺序运行这些命令：

```bash
openclaw matrix verify backup reset --yes
openclaw matrix verify backup status --verbose
openclaw matrix verify status
```

当你想显式目标命名 Matrix 账户时，向每个命令添加 `--account <id>`。

### 启动行为

当 `encryption: true` 时，Matrix 默认 `startupVerification` 为 `"if-unverified"`。
启动时，如果此设备仍未验证，Matrix 将在另一个 Matrix 客户端请求自验证，
在一个请求已待处理时跳过重复请求，并在重启后应用本地冷却时间再重试。
失败的请求尝试默认比成功请求创建更快重试。
设置 `startupVerification: "off"` 禁用自动启动请求，或调整 `startupVerificationCooldownHours` 如果你想要更短或更长的重试窗口。

启动还自动执行保守的加密引导遍。
该遍优先尝试复用当前秘密存储和跨签名身份，避免重置跨签名，除非你运行显式引导修复流程。

如果启动发现损坏的引导状态且配置了 `channels.matrix.password`，OpenClaw 可以尝试更严格的修复路径。
如果当前设备已被所有者签名，OpenClaw 会保留该身份而非自动重置。

从之前的公共 Matrix 插件升级：

- OpenClaw 尽可能自动复用相同的 Matrix 账户、访问令牌和设备身份。
- 在任何可操作的 Matrix 迁移更改运行前，OpenClaw 在 `~/Backups/openclaw-migrations/` 下创建或复用恢复快照。
- 如果你使用多个 Matrix 账户，在从旧的扁平存储布局升级前设置 `channels.matrix.defaultAccount`，以便 OpenClaw 知道哪个账户应接收该共享遗留状态。
- 如果之前的插件本地存储了 Matrix 房间密钥备份解密密钥，启动或 `openclaw doctor --fix` 会将其自动导入新的恢复密钥流程。
- 如果 Matrix 访问令牌在迁移准备后更改，启动现在在放弃自动备份恢复前扫描兄弟令牌哈希存储根以查找待处理的遗留恢复状态。
- 如果 Matrix 访问令牌稍后为相同账户、homeserver 和用户更改，OpenClaw 现在优先复用最完整的现有令牌哈希存储根，而非从空 Matrix 状态目录开始。
- 在下一次 gateway 启动时，备份的房间密钥自动恢复到新的加密存储。
- 如果旧插件有从未备份的仅本地房间密钥，OpenClaw 会明确警告。这些密钥无法从之前的 rust 加密存储自动导出，因此一些旧加密历史可能保持不可用，直到手动恢复。
- 详见 [Matrix migration](/install/migrating-matrix) 了解完整升级流程、限制、恢复命令和常见迁移消息。

加密运行时状态按账户、按用户令牌哈希根组织在
`~/.openclaw/matrix/accounts/<account>/<homeserver>__<user>/<token-hash>/`。
该目录包含同步存储 (`bot-storage.json`)、加密存储 (`crypto/`)、
恢复密钥文件 (`recovery-key.json`)、IndexedDB 快照 (`crypto-idb-snapshot.json`)、
线程绑定 (`thread-bindings.json`) 和启动验证状态 (`startup-verification.json`)
（当这些功能被使用时）。
当令牌更改但账户身份保持不变时，OpenClaw 复用该账户/homeserver/用户三元组的最佳现有根，以便之前的同步状态、加密状态、线程绑定和启动验证状态保持可见。

### Node 加密存储模型

此插件中的 Matrix E2EE 使用官方 `matrix-js-sdk` Rust 加密路径在 Node 中。
该路径期望 IndexedDB-backed 持久化，当你希望加密状态在重启后存活时。

OpenClaw 当前在 Node 中通过以下方式提供：

- 使用 `fake-indexeddb` 作为 SDK 期望的 IndexedDB API shim
- 在 `initRustCrypto` 前从 `crypto-idb-snapshot.json` 恢复 Rust 加密 IndexedDB 内容
- 在 init 和运行时后将更新的 IndexedDB 内容持久化回 `crypto-idb-snapshot.json`
- 使用建议性文件锁对 `crypto-idb-snapshot.json` 序列化快照恢复和持久化，以便 gateway 运行时持久化和 CLI 维护不会在同一快照文件上竞争

这是兼容性/存储管道，而非自定义加密实现。
快照文件是敏感运行时状态，以限制性文件权限存储。
在 OpenClaw 的安全模型下，gateway 主机和本地 OpenClaw 状态目录已在受信任的操作者边界内，所以这主要是运营持久性关注，而非单独的远程信任边界。

计划改进：

- 添加 SecretRef 支持以持久化 Matrix 密钥材料，以便恢复密钥和相关存储加密秘密可从 OpenClaw secrets 提供者获取，而非仅本地文件

## Profile 管理

使用以下命令更新所选账户的 Matrix 自 profile：

```bash
openclaw matrix profile set --name "OpenClaw Assistant"
openclaw matrix profile set --avatar-url https://cdn.example.org/avatar.png
```

当你想显式目标命名 Matrix 账户时添加 `--account <id>`。

Matrix 直接接受 `mxc://` avatar URL。当你传入 `http://` 或 `https://` avatar URL 时，OpenClaw 先将其上传到 Matrix 并将解析的 `mxc://` URL 存回 `channels.matrix.avatarUrl`（或选定的账户覆盖）。

## 自动验证通知

Matrix 现在将验证生命周期通知直接发布到严格私信验证房间作为 `m.notice` 消息。
这包括：

- 验证请求通知
- 验证就绪通知（带显式"通过 emoji 验证"指导）
- 验证开始和完成通知
- SAS 详情（emoji 和十进制）（当可用时）

来自另一个 Matrix 客户端的入站验证请求被 OpenClaw 跟踪并自动接受。
对于自验证流程，OpenClaw 也在 emoji 验证可用时自动启动 SAS 流程并确认其自身侧。
对于来自另一个 Matrix 用户/设备的验证请求，OpenClaw 自动接受请求，然后等待 SAS 流程正常进行。
你仍需在你的 Matrix 客户端比较 emoji 或十进制 SAS 并在那里确认"它们匹配"以完成验证。

OpenClaw 不盲目自动接受自发起的重复流程。启动在自验证请求已待处理时跳过创建新请求。

验证协议/系统通知不转发到 agent 聊天管道，所以它们不产生 `NO_REPLY`。

### 设备卫生

旧的 OpenClaw 管理的 Matrix 设备可能在账户上累积，使加密房间信任更难推理。
列出它们：

```bash
openclaw matrix devices list
```

移除陈旧的 OpenClaw 管理的设备：

```bash
openclaw matrix devices prune-stale
```

### 直接房间修复

如果私信状态不同步，OpenClaw 可能带有指向旧单人房间而非活跃私信的陈旧 `m.direct` 映射。检查对等方的当前映射：

```bash
openclaw matrix direct inspect --user-id @alice:example.org
```

修复它：

```bash
openclaw matrix direct repair --user-id @alice:example.org
```

修复保持 Matrix 特定逻辑在插件内：

- 它优先选择已映射到 `m.direct` 的严格 1:1 私信
- 否则回退到该用户当前加入的任何严格 1:1 私信
- 如果无健康私信存在，它创建新的直接房间并将 `m.direct` 重写为指向它

修复流程不自动删除旧房间。它仅选择健康私信并更新映射，以便新 Matrix 发送、验证通知和其他私信流程再次目标正确房间。

## 线程

Matrix 对自动回复和消息工具发送都支持原生 Matrix 线程。

- `threadReplies: "off"` 保持回复顶层并将入站线程消息保持在父会话上。
- `threadReplies: "inbound"` 仅在入站消息已在该线程中时在线程内回复。
- `threadReplies: "always"` 将房间回复保持在以触发消息为根的线程中，并通过来自第一个触发消息的匹配线程范围会话路由该对话。
- `dm.threadReplies` 仅覆盖私信的顶层设置。例如，你可以保持房间线程隔离同时保持私信扁平。
- 入站线程消息将线程根消息作为额外 agent 上下文包含。
- 消息工具发送现在当目标是相同房间或相同私信用户目标时自动继承当前 Matrix 线程，除非提供显式 `threadId`。
- Matrix 支持运行时线程绑定。`/focus`、`/unfocus`、`/agents`、`/session idle`、`/session max-age` 和线程绑定 `/acp spawn` 现在在 Matrix 房间和私信中工作。
- 当 `threadBindings.spawnSubagentSessions=true` 时，顶层 Matrix 房间/私信 `/focus` 创建新 Matrix 线程并将其绑定到目标会话。
- 在现有 Matrix 线程内运行 `/focus` 或 `/acp spawn --thread here` 绑定该当前线程。

## ACP 会话绑定

Matrix 房间、私信和现有 Matrix 线程可以转换为持久 ACP 工作空间，无需更改聊天表面。

快速操作者流程：

- 在你想继续使用的 Matrix 私信、房间或现有线程内运行 `/acp spawn codex --bind here`。
- 在顶层 Matrix 私信或房间中，当前私信/房间保持聊天表面，未来消息路由到生成的 ACP 会话。
- 在现有 Matrix 线程内，`--bind here` 就地绑定该当前线程。
- `/new` 和 `/reset` 就地重置相同绑定的 ACP 会话。
- `/acp close` 关闭 ACP 会话并移除绑定。

注意：

- `--bind here` 不创建子 Matrix 线程。
- `threadBindings.spawnAcpSessions` 仅对 `/acp spawn --thread auto|here` 需要，其中 OpenClaw 需要创建或绑定子 Matrix 线程。

### 线程绑定配置

Matrix 从 `session.threadBindings` 继承全局默认，也支持每频道覆盖：

- `threadBindings.enabled`
- `threadBindings.idleHours`
- `threadBindings.maxAgeHours`
- `threadBindings.spawnSubagentSessions`
- `threadBindings.spawnAcpSessions`

Matrix 线程绑定生成标志是可选的：

- 设置 `threadBindings.spawnSubagentSessions: true` 允许顶层 `/focus` 创建和绑定新 Matrix 线程。
- 设置 `threadBindings.spawnAcpSessions: true` 允许 `/acp spawn --thread auto|here` 将 ACP 会话绑定到 Matrix 线程。

## 反应

Matrix 支持出站反应操作、入站反应通知和入站确认反应。

- 出站反应工具由 `channels["matrix"].actions.reactions` 控制。
- `react` 向特定 Matrix 事件添加反应。
- `reactions` 列出特定 Matrix 事件的当前反应摘要。
- `emoji=""` 移除该事件上 bot 账户自身的反应。
- `remove: true` 仅从 bot 账户移除指定的 emoji 反应。

确认反应使用标准 OpenClaw 解析顺序：

- `channels["matrix"].accounts.<accountId>.ackReaction`
- `channels["matrix"].ackReaction`
- `messages.ackReaction`
- agent 身份 emoji 后备

确认反应范围按此顺序解析：

- `channels["matrix"].accounts.<accountId>.ackReactionScope`
- `channels["matrix"].ackReactionScope`
- `messages.ackReactionScope`

反应通知模式按此顺序解析：

- `channels["matrix"].accounts.<accountId>.reactionNotifications`
- `channels["matrix"].reactionNotifications`
- 默认：`own`

当前行为：

- `reactionNotifications: "own"` 在它们目标 bot-authored Matrix 消息时转发添加的 `m.reaction` 事件。
- `reactionNotifications: "off"` 禁用反应系统事件。
- 反应移除仍不合成为系统事件，因为 Matrix 将那些表面为删除而非独立 `m.reaction` 移除。

## 历史上下文

- `channels.matrix.historyLimit` 控制 Matrix 房间消息触发 agent 时有多少最近房间消息作为 `InboundHistory` 包含。
- 它回退到 `messages.groupChat.historyLimit`。设置 `0` 禁用。
- Matrix 房间历史仅限房间。私信使用正常会话历史。
- Matrix 房间历史仅限待处理：OpenClaw 缓冲尚未触发回复的房间消息，然后在提及或其他触发到达时快照该窗口。
- 当前触发消息不包含在 `InboundHistory` 中；它保留在该回合的主入站消息体中。
- 相同 Matrix 事件的重试复用原始历史快照而非漂移到更新的房间消息。

## 上下文可见性

Matrix 对补充房间上下文（如获取的回复文本、线程根和待处理历史）支持共享的 `contextVisibility` 控制。

- `contextVisibility: "all"` 是默认值。补充上下文按接收保留。
- `contextVisibility: "allowlist"` 将补充上下文过滤为活动房间/用户白名单检查允许的发送者。
- `contextVisibility: "allowlist_quote"` 行为类似 `allowlist`，但仍保留一条显式引用回复。

此设置影响补充上下文可见性，不影响入站消息本身是否可以触发回复。
触发授权仍来自 `groupPolicy`、`groups`、`groupAllowFrom` 和私信策略设置。

## 私信和房间策略示例

```json5
{
  channels: {
    matrix: {
      dm: {
        policy: "allowlist",
        allowFrom: ["@admin:example.org"],
        threadReplies: "off",
      },
      groupPolicy: "allowlist",
      groupAllowFrom: ["@admin:example.org"],
      groups: {
        "!roomid:example.org": {
          requireMention: true,
        },
      },
    },
  },
}
```

详见 [Groups](/channels/groups) 了解提及触发和白名单行为。

Matrix 私信配对示例：

```bash
openclaw pairing list matrix
openclaw pairing approve matrix <CODE>
```

如果未批准的 Matrix 用户在批准前持续向你发送消息，OpenClaw 复用相同的待处理配对码，可能在短暂冷却后再次发送提醒回复，而非生成新码。

详见 [Pairing](/channels/pairing) 了解共享私信配对流程和存储布局。

## Exec 批准

Matrix 可作为 Matrix 账户的 exec 批准客户端。

- `channels.matrix.execApprovals.enabled`
- `channels.matrix.execApprovals.approvers`（可选；回退到 `channels.matrix.dm.allowFrom`）
- `channels.matrix.execApprovals.target`（`dm` | `channel` | `both`，默认：`dm`）
- `channels.matrix.execApprovals.agentFilter`
- `channels.matrix.execApprovals.sessionFilter`

批准者必须是 Matrix 用户 ID 如 `@owner:example.org`。Matrix 当 `enabled` 未设置或 `"auto"` 且至少一个批准者可解析时自动启用原生 exec 批准，来自 `execApprovals.approvers` 或 `channels.matrix.dm.allowFrom`。设置 `enabled: false` 显式禁用 Matrix 作为原生批准客户端。批准请求否则回退到其他配置的批准路由或 exec 批准后备策略。

投递规则：

- `target: "dm"` 向批准者私信发送批准提示
- `target: "channel"` 将提示发送回原始 Matrix 房间或私信
- `target: "both"` 向批准者私信和原始 Matrix 房间或私信发送

Matrix 目前使用文本批准提示。批准者通过 `/approve <id> allow-once`、`/approve <id> allow-always` 或 `/approve <id> deny` 解析。

仅已解析批准者可批准或拒绝。频道投递包含命令文本，所以仅在受信任房间中启用 `channel` 或 `both`。

Matrix 批准提示复用共享核心批准规划器。Matrix 特定表面仅是传输：房间/私信路由和消息发送/更新/删除行为。

每账户覆盖：

- `channels.matrix.accounts.<account>.execApprovals`

相关文档：[Exec approvals](/tools/exec-approvals)

## 多账户示例

```json5
{
  channels: {
    matrix: {
      enabled: true,
      defaultAccount: "assistant",
      dm: { policy: "pairing" },
      accounts: {
        assistant: {
          homeserver: "https://matrix.example.org",
          accessToken: "syt_assistant_xxx",
          encryption: true,
        },
        alerts: {
          homeserver: "https://matrix.example.org",
          accessToken: "syt_alerts_xxx",
          dm: {
            policy: "allowlist",
            allowFrom: ["@ops:example.org"],
            threadReplies: "off",
          },
        },
      },
    },
  },
}
```

顶层 `channels.matrix` 值作为命名账户的默认值，除非账户覆盖它们。
你可以使用 `groups.<room>.account`（或遗留 `rooms.<room>.account`）将继承房间条目范围限定到单个 Matrix 账户。
无 `account` 的条目在所有 Matrix 被间共享，带 `account: "default"` 的条目在默认账户直接配置在顶层 `channels.matrix.*` 时仍工作。
部分共享认证默认不自身创建单独隐式默认账户。OpenClaw 仅在默认有新鲜认证（`homeserver` 加 `accessToken`，或 `homeserver` 加 `userId` 和 `password`）时合成顶层 `default` 账户；命名账户仍可通过 `homeserver` 加 `userId` 在缓存的凭证稍后满足认证时保持可发现。
当你希望 OpenClaw 为隐式路由、探测和 CLI 操作优先一个命名 Matrix 账户时设置 `defaultAccount`。
如果你配置多个命名账户，设置 `defaultAccount` 或为依赖隐式账户选择的 CLI 命令传入 `--account <id>`。
当你想为单个命令覆盖隐式选择时向 `openclaw matrix verify ...` 和 `openclaw matrix devices ...` 传入 `--account <id>`。

## 私有/LAN homeservers

默认情况下，OpenClaw 为 SSRF 保护阻止私有/内部 Matrix homeservers，除非你为每个账户显式启用。

如果你的 homeserver 运行在 localhost、LAN/Tailscale IP 或内部主机名上，为该 Matrix 账户启用 `allowPrivateNetwork`：

```json5
{
  channels: {
    matrix: {
      homeserver: "http://matrix-synapse:8008",
      allowPrivateNetwork: true,
      accessToken: "syt_internal_xxx",
    },
  },
}
```

CLI 设置示例：

```bash
openclaw matrix account add \
  --account ops \
  --homeserver http://matrix-synapse:8008 \
  --allow-private-network \
  --access-token syt_ops_xxx
```

此可选仅允许受信任的私有/内部目标。公共明文 homeservers 如 `http://matrix.example.org:8008` 仍被阻止。尽可能使用 `https://`。

## Matrix 流量代理

如果你的 Matrix 部署需要显式出站 HTTP(S) 代理，设置 `channels.matrix.proxy`：

```json5
{
  channels: {
    matrix: {
      homeserver: "https://matrix.example.org",
      accessToken: "syt_bot_xxx",
      proxy: "http://127.0.0.1:7890",
    },
  },
}
```

命名账户可通过 `channels.matrix.accounts.<id>.proxy` 覆盖顶层默认。
OpenClaw 使用相同代理设置进行运行时 Matrix 流量和账户状态探测。

## 目标解析

Matrix 在 OpenClaw 要求房间或用户目标的任何位置接受这些目标格式：

- 用户：`@user:server`、`user:@user:server` 或 `matrix:user:@user:server`
- 房间：`!room:server`、`room:!room:server` 或 `matrix:room:!room:server`
- 别名：`#alias:server`、`channel:#alias:server` 或 `matrix:channel:#alias:server`

实时目录查找使用登录的 Matrix 账户：

- 用户查找在该 homeserver 上查询 Matrix 用户目录。
- 房间查找直接接受显式房间 ID 和别名，然后回退到为该账户搜索已加入房间名称。
- 已加入房间名称查找是尽力而为。如果房间名称无法解析为 ID 或别名，它被运行时白名单解析忽略。

## 配置参考

- `enabled`：启用或禁用频道。
- `name`：账户的可选标签。
- `defaultAccount`：配置多个 Matrix 账户时的首选账户 ID。
- `homeserver`：homeserver URL，例如 `https://matrix.example.org`。
- `allowPrivateNetwork`：允许此 Matrix 账户连接到私有/内部 homeservers。当 homeserver 解析为 `localhost`、LAN/Tailscale IP 或如 `matrix-synapse` 的内部主机时启用。
- `proxy`：Matrix 流量的可选 HTTP(S) 代理 URL。命名账户可通过自己的 `proxy` 覆盖顶层默认。
- `userId`：完整 Matrix 用户 ID，例如 `@bot:example.org`。
- `accessToken`：令牌式认证的访问令牌。`channels.matrix.accessToken` 和 `channels.matrix.accounts.<id>.accessToken` 支持 plaintext 值和 SecretRef 值，跨 env/file/exec 提供者。详见 [Secrets Management](/gateway/secrets)。
- `password`：密码式登录的密码。支持 plaintext 值和 SecretRef 值。
- `deviceId`：显式 Matrix 设备 ID。
- `deviceName`：密码登录的设备显示名称。
- `avatarUrl`：存储的自 avatar URL 用于 profile 同步和 `set-profile` 更新。
- `initialSyncLimit`：启动同步事件限制。
- `encryption`：启用 E2EE。
- `allowlistOnly`：强制私信和房间仅白名单行为。
- `allowBots`：允许来自其他已配置 OpenClaw Matrix 账户的消息（`true` 或 `"mentions"`）。
- `groupPolicy`：`open`、`allowlist` 或 `disabled`。
- `contextVisibility`：补充房间上下文可见性模式（`all`、`allowlist`、`allowlist_quote`）。
- `groupAllowFrom`：房间流量的用户 ID 白名单。
- `groupAllowFrom` 条目应为完整 Matrix 用户 ID。未解析的名称在运行时被忽略。
- `historyLimit`：作为群组历史上下文包含的最大房间消息数。回退到 `messages.groupChat.historyLimit`。设置 `0` 禁用。
- `replyToMode`：`off`、`first` 或 `all`。
- `markdown`：出站 Matrix 文本的可选 Markdown 渲染配置。
- `streaming`：`off`（默认）、`partial`、`true` 或 `false`。`partial` 和 `true` 启用单消息草稿预览带原地编辑更新。
- `blockStreaming`：`true` 在草稿预览流式活跃时为已完成的 assistant 块启用单独进度消息。
- `threadReplies`：`off`、`inbound` 或 `always`。
- `threadBindings`：线程绑定会话路由和生命周期的每频道覆盖。
- `startupVerification`：启动时自动自验证请求模式（`if-unverified`、`off`）。
- `startupVerificationCooldownHours`：重试自动启动验证请求前的冷却时间。
- `textChunkLimit`：出站消息分块大小。
- `chunkMode`：`length` 或 `newline`。
- `responsePrefix`：出站回复的可选消息前缀。
- `ackReaction`：此频道/账户的可选确认反应覆盖。
- `ackReactionScope`：可选确认反应范围覆盖（`group-mentions`、`group-all`、`direct`、`all`、`none`、`off`）。
- `reactionNotifications`：入站反应通知模式（`own`、`off`）。
- `mediaMaxMb`：Matrix 媒体处理的媒体大小上限 MB。适用于出站发送和入站媒体处理。
- `autoJoin`：邀请自动加入策略（`always`、`allowlist`、`off`）。默认：`off`。
- `autoJoinAllowlist`：`autoJoin` 为 `allowlist` 时允许的房间/别名。别名条目在邀请处理期间解析为房间 ID；OpenClaw 不信任被邀请房间声称的别名状态。
- `dm`：私信策略块（`enabled`、`policy`、`allowFrom`、`threadReplies`）。
- `dm.allowFrom` 条目应为完整 Matrix 用户 ID，除非你已通过实时目录查找解析它们。
- `dm.threadReplies`：仅私信线程策略覆盖（`off`、`inbound`、`always`）。它覆盖顶层 `threadReplies` 设置用于私信中的回复位置和会话隔离。
- `execApprovals`：Matrix 原生 exec 批准投递（`enabled`、`approvers`、`target`、`agentFilter`、`sessionFilter`）。
- `execApprovals.approvers`：允许批准 exec 请求的 Matrix 用户 ID。当 `dm.allowFrom` 已识别批准者时可选。
- `execApprovals.target`：`dm | channel | both`（默认：`dm`）。
- `accounts`：命名每账户覆盖。顶层 `channels.matrix` 值作为这些条目的默认值。
- `groups`：每房间策略映射。建议使用房间 ID 或别名；未解析的房间名称在运行时被忽略。会话/群组身份在解析后使用稳定房间 ID，而人类可读标签仍来自房间名称。
- `groups.<room>.account`：在多账户设置中将一个继承房间条目限定到特定 Matrix 账户。
- `groups.<room>.allowBots`：已配置 bot 发送者的房间级覆盖（`true` 或 `"mentions"`）。
- `groups.<room>.users`：每房间发送者白名单。
- `groups.<room>.tools`：每房间工具允许/拒绝覆盖。
- `groups.<room>.autoReply`：房间级提及触发覆盖。`true` 禁用该房间的提及要求；`false` 强制恢复它们。
- `groups.<room>.skills`：可选房间级技能过滤。
- `groups.<room>.systemPrompt`：可选房间级系统提示片段。
- `rooms`：`groups` 的遗留别名。
- `actions`：每操作工具控制（`messages`、`reactions`、`pins`、`profile`、`memberInfo`、`channelInfo`、`verification`）。

## 相关文档

- [频道概览](/channels) — 所有支持的频道
- [配对](/channels/pairing) — 私信认证和配对流程
- [群组](/channels/groups) — 群聊行为和提及触发
- [频道路由](/channels/channel-routing) — 消息的会话路由
- [安全](/gateway/security) — 访问模型和加固
