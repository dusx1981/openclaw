---
summary: "Tlon/Urbit support status, capabilities, and configuration"
read_when:
  - Working on Tlon/Urbit channel features
title: "Tlon"
---

# Tlon（插件）

Tlon 是基于 Urbit 构建的去中心化消息应用。OpenClaw 连接到你的 Urbit ship，可响应 DM 和群聊消息。群组回复默认需要 @ 提及，可通过白名单进一步限制。

状态：通过插件支持。支持 DM、群组提及、thread 回复、富文本格式和图片上传。反应和 polls 尚不支持。

## 需要插件

Tlon 作为插件发布，不捆绑在核心安装中。

通过 CLI 安装（npm registry）：

```bash
openclaw plugins install @openclaw/tlon
```

本地检出（从 git repo 运行时）：

```bash
openclaw plugins install ./path/to/local/tlon-plugin
```

详情：[Plugins](/tools/plugin)

## 设置

1. 安装 Tlon 插件。
2. 收集你的 ship URL 和 login code。
3. 配置 `channels.tlon`。
4. 重启 Gateway。
5. DM bot 或在群组 channel 中提及它。

最小配置（单账号）：

```json5
{
  channels: {
    tlon: {
      enabled: true,
      ship: "~sampel-palnet",
      url: "https://your-ship-host",
      code: "lidlut-tabwed-pillex-ridrup",
      ownerShip: "~your-main-ship", // 推荐：你的 ship，始终允许
    },
  },
}
```

## 私有/LAN ships

默认情况下，OpenClaw 阻止私有/内部 hostnames 和 IP 范围用于 SSRF 保护。
如果你的 ship 运行在私有网络（localhost、LAN IP 或内部 hostname），
你必须显式 opt in：

```json5
{
  channels: {
    tlon: {
      url: "http://localhost:8080",
      allowPrivateNetwork: true,
    },
  },
}
```

这适用于以下 URL：

- `http://localhost:8080`
- `http://192.168.x.x:8080`
- `http://my-ship.local:8080`

⚠️ 只有在你信任本地网络时才启用此设置。此设置禁用对你 ship URL 请求的 SSRF 保护。

## 群组 channels

默认启用自动发现。你也可以手动 pin channels：

```json5
{
  channels: {
    tlon: {
      groupChannels: ["chat/~host-ship/general", "chat/~host-ship/support"],
    },
  },
}
```

禁用自动发现：

```json5
{
  channels: {
    tlon: {
      autoDiscoverChannels: false,
    },
  },
}
```

## 访问控制

DM 白名单（空 = 不允许 DM，使用 `ownerShip` 进行批准流程）：

```json5
{
  channels: {
    tlon: {
      dmAllowlist: ["~zod", "~nec"],
    },
  },
}
```

群组授权（默认受限）：

```json5
{
  channels: {
    tlon: {
      defaultAuthorizedShips: ["~zod"],
      authorization: {
        channelRules: {
          "chat/~host-ship/general": {
            mode: "restricted",
            allowedShips: ["~zod", "~nec"],
          },
          "chat/~host-ship/announcements": {
            mode: "open",
          },
        },
      },
    },
  },
}
```

## Owner 和批准系统

设置 owner ship 以接收未授权用户尝试交互时的批准请求：

```json5
{
  channels: {
    tlon: {
      ownerShip: "~your-main-ship",
    },
  },
}
```

Owner ship **自动在各处授权** — DM invites 自动接受，
channel 消息始终允许。你不需要将 owner 添加到 `dmAllowlist` 或
`defaultAuthorizedShips`。

设置后，owner 收到以下 DM 通知：

- 来自不在白名单中的 ships 的 DM 请求
- 在无授权的 channels 中的提及
- 群组 invite 请求

## 自动接受设置

自动接受 DM invites（对于 dmAllowlist 中的 ships）：

```json5
{
  channels: {
    tlon: {
      autoAcceptDmInvites: true,
    },
  },
}
```

自动接受群组 invites：

```json5
{
  channels: {
    tlon: {
      autoAcceptGroupInvites: true,
    },
  },
}
```

## 投递目标（CLI/cron）

使用这些配合 `openclaw message send` 或 cron 投递：

- DM：`~sampel-palnet` 或 `dm/~sampel-palnet`
- 群组：`chat/~host-ship/channel` 或 `group:~host-ship/channel`

## 捆绑 skill

Tlon 插件包含一个捆绑 skill（[`@tloncorp/tlon-skill`](https://github.com/tloncorp/tlon-skill），
提供 Tlon 操作的 CLI 访问：

- **Contacts**：获取/更新 profiles、列出 contacts
- **Channels**：列出、创建、发布消息、获取历史
- **Groups**：列出、创建、管理成员
- **DMs**：发送消息、对消息反应
- **Reactions**：添加/删除对 posts 和 DMs 的 emoji 反应
- **Settings**：通过斜杠命令管理插件权限

插件安装后 skill 自动可用。

## 功能

| 功能          | 状态                                |
| ------------- | ----------------------------------- |
| 直接消息      | ✅ 支持                             |
| 群组/channels | ✅ 支持（默认提及门控）             |
| Threads       | ✅ 支持（thread 中自动回复）        |
| 富文本        | ✅ Markdown 转换为 Tlon 格式        |
| 图片          | ✅ 上传到 Tlon 存储                 |
| 反应          | ✅ 通过[捆绑 skill](#bundled-skill) |
| Polls         | ❌ 尚不支持                         |
| 原生命令      | ✅ 支持（默认仅 owner）             |

## 故障排除

先运行这个排查阶梯：

```bash
openclaw status
openclaw gateway status
openclaw logs --follow
openclaw doctor
```

常见故障：

- **DM 被忽略**：发送者不在 `dmAllowlist` 且无 `ownerShip` 配置用于批准流程。
- **群组消息被忽略**：channel 未发现或发送者未授权。
- **连接错误**：检查 ship URL 可达性；为本地 ships 启用 `allowPrivateNetwork`。
- **Auth 错误**：验证 login code 是当前的（codes 会轮换）。

## 配置参考

完整配置：[Configuration](/gateway/configuration)

Provider 选项：

- `channels.tlon.enabled`: 启用/禁用 channel 启动。
- `channels.tlon.ship`: bot 的 Urbit ship 名称（例如 `~sampel-palnet`）。
- `channels.tlon.url`: ship URL（例如 `https://sampel-palnet.tlon.network`）。
- `channels.tlon.code`: ship login code。
- `channels.tlon.allowPrivateNetwork`: 允许 localhost/LAN URLs（SSRF 绕过）。
- `channels.tlon.ownerShip`: 批准系统的 owner ship（始终授权）。
- `channels.tlon.dmAllowlist`: 允许 DM 的 ships（空 = 无）。
- `channels.tlon.autoAcceptDmInvites`: 自动接受来自白名单 ships 的 DM。
- `channels.tlon.autoAcceptGroupInvites`: 自动接受所有群组 invites。
- `channels.tlon.autoDiscoverChannels`: 自动发现群组 channels（默认：true）。
- `channels.tlon.groupChannels`: 手动 pin 的 channel nests。
- `channels.tlon.defaultAuthorizedShips`: 所有 channels 授权的 ships。
- `channels.tlon.authorization.channelRules`: channel 级别 auth 规则。
- `channels.tlon.showModelSignature`: 追加模型名称到消息。

## 注意

- 群组回复需要提及（例如 `~your-bot-ship`）才响应。
- Thread 回复：如果入站消息在 thread 中，OpenClaw 在 thread 中回复。
- 富文本：Markdown 格式（bold、italic、code、headers、lists）转换为 Tlon 原生格式。
- 图片：URL 上传到 Tlon 存储并嵌入为图片块。

## 相关

- [Channels Overview](/channels) — 所有支持的 channels
- [Pairing](/channels/pairing) — DM 认证和配对流程
- [Groups](/channels/groups) — 群聊行为和提及门控
- [Channel Routing](/channels/channel-routing) — 消息的 session 路由
- [Security](/gateway/security) — 访问模型和安全加固
