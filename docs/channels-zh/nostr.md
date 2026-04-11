---
summary: "通过 NIP-04 加密消息的 Nostr 私信频道"
read_when:
  - 你想 OpenClaw 通过 Nostr 接收私信
  - 你正在设置去中心化消息
title: "Nostr"
---

# Nostr

**状态：** 可选插件（默认禁用）。

Nostr 是一个用于社交网络的去中心化协议。此频道使 OpenClaw 能通过 NIP-04 接收和响应加密私信（DM）。

## 安装（按需）

### Onboarding（推荐）

- Onboarding (`openclaw onboard`) 和 `openclaw channels add` 列出可选频道插件。
- 选择 Nostr 会提示你按需安装插件。

安装默认：

- **Dev channel + git checkout 可用：** 使用本地插件路径。
- **Stable/Beta：** 从 npm 下载。

你始终可以在提示中覆盖选择。

### 手动安装

```bash
openclaw plugins install @openclaw/nostr
```

使用本地检出（开发流程）：

```bash
openclaw plugins install --link <path-to-local-nostr-plugin>
```

安装或启用插件后重启 Gateway。

### 非交互式设置

```bash
openclaw channels add --channel nostr --private-key "$NOSTR_PRIVATE_KEY"
openclaw channels add --channel nostr --private-key "$NOSTR_PRIVATE_KEY" --relay-urls "wss://relay.damus.io,wss://relay.primal.net"
```

使用 `--use-env` 保持 `NOSTR_PRIVATE_KEY` 在环境中而非存储密钥到配置。

## 快速设置

1. 生成 Nostr 密钥对（如需要）：

```bash
# 使用 nak
nak key generate
```

2. 添加到配置：

```json5
{
  channels: {
    nostr: {
      privateKey: "${NOSTR_PRIVATE_KEY}",
    },
  },
}
```

3. 导出密钥：

```bash
export NOSTR_PRIVATE_KEY="nsec1..."
```

4. 重启 Gateway。

## 配置参考

| 键           | 类型     | 默认值                                      | 描述                     |
| ------------ | -------- | ------------------------------------------- | ------------------------ |
| `privateKey` | string   | required                                    | `nsec` 或 hex 格式的私钥 |
| `relays`     | string[] | `['wss://relay.damus.io', 'wss://nos.lol']` | Relay URL（WebSocket）   |
| `dmPolicy`   | string   | `pairing`                                   | 私信访问策略             |
| `allowFrom`  | string[] | `[]`                                        | 允许的发送者公钥         |
| `enabled`    | boolean  | `true`                                      | 启用/禁用频道            |
| `name`       | string   | -                                           | 显示名称                 |
| `profile`    | object   | -                                           | NIP-01 profile 元数据    |

## Profile 元数据

Profile 数据作为 NIP-01 `kind:0` 事件发布。你可从 Control UI（Channels -> Nostr -> Profile）管理它或直接在配置中设置。

示例：

```json5
{
  channels: {
    nostr: {
      privateKey: "${NOSTR_PRIVATE_KEY}",
      profile: {
        name: "openclaw",
        displayName: "OpenClaw",
        about: "Personal assistant DM bot",
        picture: "https://example.com/avatar.png",
        banner: "https://example.com/banner.png",
        website: "https://example.com",
        nip05: "openclaw@example.com",
        lud16: "openclaw@example.com",
      },
    },
  },
}
```

注意：

- Profile URL 必须使用 `https://`。
- 从 relays 导入会合并字段并保留本地覆盖。

## 访问控制

### 私信策略

- **pairing**（默认）：未知发送者获得配对码。
- **allowlist**：仅 `allowFrom` 中公钥可私信。
- **open**：公开入站私信（需要 `allowFrom: ["*"]`）。
- **disabled**：忽略入站私信。

执行注意：

- 入站事件签名在发送者策略和 NIP-04 解密前验证，所以伪造事件被早期拒绝。
- 配对回复在不处理原始私信体的情况下发送。
- 入站私信被速率限制，过大载荷在解密前丢弃。

### 白名单示例

```json5
{
  channels: {
    nostr: {
      privateKey: "${NOSTR_PRIVATE_KEY}",
      dmPolicy: "allowlist",
      allowFrom: ["npub1abc...", "npub1xyz..."],
    },
  },
}
```

## 密钥格式

接受的格式：

- **私钥：** `nsec...` 或 64 字符 hex
- **公钥 (`allowFrom`)：** `npub...` 或 hex

## Relays

默认：`relay.damus.io` 和 `nos.lol`。

```json5
{
  channels: {
    nostr: {
      privateKey: "${NOSTR_PRIVATE_KEY}",
      relays: ["wss://relay.damus.io", "wss://relay.primal.net", "wss://nostr.wine"],
    },
  },
}
```

提示：

- 使用 2-3 个 relays 用于冗余。
- 避免过多 relays（延迟、重复）。
- 付费 relays 可提高可靠性。
- 本地 relays 可用于测试（`ws://localhost:7777`）。

## 协议支持

| NIP    | 状态      | 描述                          |
| ------ | --------- | ----------------------------- |
| NIP-01 | Supported | 基本事件格式 + profile 元数据 |
| NIP-04 | Supported | 加密私信（`kind:4`）          |
| NIP-17 | Planned   | Gift-wrapped 私信             |
| NIP-44 | Planned   | 版本化加密                    |

## 测试

### 本地 relay

```bash
# 启动 strfry
docker run -p 7777:7777 ghcr.io/hoytech/strfry
```

```json5
{
  channels: {
    nostr: {
      privateKey: "${NOSTR_PRIVATE_KEY}",
      relays: ["ws://localhost:7777"],
    },
  },
}
```

### 手动测试

1. 从日志记录 bot 公钥（npub）。
2. 打开 Nostr 客户端（Damus、Amethyst 等）。
3. 向 bot 公钥发送私信。
4. 验证响应。

## 故障排除

### 未接收消息

- 验证私钥有效。
- 确保 relay URL 可达且使用 `wss://`（或 `ws://` 用于本地）。
- 确认 `enabled` 非 `false`。
- 检查 Gateway 日志查看 relay 连接错误。

### 未发送响应

- 检查 relay 接受写入。
- 验证出站连通性。
- 注意 relay 速率限制。

### 重复响应

- 使用多个 relays 时预期。
- 消息按事件 ID 去重；仅第一个投递触发响应。

## 安全

- 永不提交私钥。
- 使用环境变量存储密钥。
- 生产 bot 考虑 `allowlist`。
- 签名在发送者策略前验证，发送者策略在解密前执行，所以伪造事件被早期拒绝，未知发送者无法强制完整加密工作。

## 限制（MVP）

- 仅私信（无群聊）。
- 无媒体附件。
- 仅 NIP-04（NIP-17 gift-wrap 计划中）。

## 相关文档

- [频道概览](/channels) — 所有支持的频道
- [配对](/channels/pairing) — 私信认证和配对流程
- [群组](/channels/groups) — 群聊行为和提及触发
- [频道路由](/channels/channel-routing) — 消息的会话路由
- [安全](/gateway/security) — 访问模型和加固
