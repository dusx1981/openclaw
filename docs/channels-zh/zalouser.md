---
summary: "Zalo personal account support via native zca-js (QR login), capabilities, and configuration"
read_when:
  - Setting up Zalo Personal for OpenClaw
  - Debugging Zalo Personal login or message flow
title: "Zalo Personal"
---

# Zalo Personal（非官方）

状态：实验性。此集成通过 OpenClaw 内的原生 `zca-js` 自动化**个人 Zalo 账号**。

> **警告：** 这是非官方集成，可能导致账号暂停/封禁。风险自负。

## 需要插件

Zalo Personal 作为插件发布，不捆绑在核心安装中。

- 通过 CLI 安装：`openclaw plugins install @openclaw/zalouser`
- 或从源码检出：`openclaw plugins install ./path/to/local/zalouser-plugin`
- 详情：[Plugins](/tools/plugin)

无需外部 `zca`/`openzca` CLI 二进制文件。

## 快速设置（新手）

1. 安装插件（见上）。
2. 登录（QR，在 Gateway 机器上）：
   - `openclaw channels login --channel zalouser`
   - 用 Zalo 手机 app 扫描 QR code。
3. 启用 channel：

```json5
{
  channels: {
    zalouser: {
      enabled: true,
      dmPolicy: "pairing",
    },
  },
}
```

4. 重启 Gateway（或完成设置）。
5. DM 访问默认为配对；首次联系时批准配对代码。

## 它是什么

- 完全通过 `zca-js` 进程内运行。
- 使用原生事件监听器接收入站消息。
- 通过 JS API 直接发送回复（文本/媒体/链接）。
- 设计用于"个人账号"场景，Zalo Bot API 不可用时。

## 命名

Channel id 为 `zalouser` 以明确这自动化**个人 Zalo 用户账号**（非官方）。我们保持 `zalo` 保留用于潜在未来官方 Zalo API 集成。

## 查找 ID（目录）

使用目录 CLI 发现 peers/groups 及其 ID：

```bash
openclaw directory self --channel zalouser
openclaw directory peers list --channel zalouser --query "name"
openclaw directory groups list --channel zalouser --query "work"
```

## 限制

- 出站文本分块到约 2000 字符（Zalo 客户端限制）。
- 流式传输默认被阻止。

## 访问控制（DM）

`channels.zalouser.dmPolicy` 支持：`pairing | allowlist | open | disabled`（默认：`pairing`）。

`channels.zalouser.allowFrom` 接受用户 ID 或名称。设置期间，名称使用插件进程内联系人查找解析为 ID。

批准方式：

- `openclaw pairing list zalouser`
- `openclaw pairing approve zalouser <code>`

## 群组访问（可选）

- 默认：`channels.zalouser.groupPolicy = "open"`（群组允许）。使用 `channels.defaults.groupPolicy` 在未设置时覆盖默认。
- 用以下限制为白名单：
  - `channels.zalouser.groupPolicy = "allowlist"`
  - `channels.zalouser.groups`（键应为稳定群组 ID；名称在启动时尽可能解析为 ID）
  - `channels.zalouser.groupAllowFrom`（控制允许群组中哪些发送者可触发 bot）
- 阻止所有群组：`channels.zalouser.groupPolicy = "disabled"`。
- 配置 Wizard 可提示群组白名单。
- 启动时，OpenClaw 将白名单中的群组/用户名称解析为 ID 并记录映射。
- 群组白名单匹配默认 ID-only。未解析名称在 auth 时被忽略除非启用 `channels.zalouser.dangerouslyAllowNameMatching: true`。
- `channels.zalouser.dangerouslyAllowNameMatching: true` 是 break-glass 兼容模式，重新启用可变群组名称匹配。
- 如果 `groupAllowFrom` 未设置，运行时回退到 `allowFrom` 进行群组发送者检查。
- 发送者检查同时应用于正常群组消息和控制命令（例如 `/new`、`/reset`）。

示例：

```json5
{
  channels: {
    zalouser: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["1471383327500481391"],
      groups: {
        "123456789": { allow: true },
        "Work Chat": { allow: true },
      },
    },
  },
}
```

### 群组提及门控

- `channels.zalouser.groups.<group>.requireMention` 控制群组回复是否需要提及。
- 解析顺序：精确群组 id/name -> 规范化群组 slug -> `*` -> 默认（`true`）。
- 这同时应用于白名单群组和开放群组模式。
- 授权控制命令（例如 `/new`）可绕过提及门控。
- 当群组消息因需要提及被跳过时，OpenClaw 存储为待处理群组历史并在下一个处理的群组消息上包含它。
- 群组历史限制默认为 `messages.groupChat.historyLimit`（回退 `50`）。你可用 `channels.zalouser.historyLimit` 按账号覆盖。

示例：

```json5
{
  channels: {
    zalouser: {
      groupPolicy: "allowlist",
      groups: {
        "*": { allow: true, requireMention: true },
        "Work Chat": { allow: true, requireMention: false },
      },
    },
  },
}
```

## 多账号

账号映射到 OpenClaw 状态中的 `zalouser` profiles。示例：

```json5
{
  channels: {
    zalouser: {
      enabled: true,
      defaultAccount: "default",
      accounts: {
        work: { enabled: true, profile: "work" },
      },
    },
  },
}
```

## 输入、反应和投递确认

- OpenClaw 在分发回复前发送输入事件（尽力而为）。
- 消息反应动作 `react` 在 channel 动作中支持 `zalouser`。
  - 使用 `remove: true` 从消息移除特定反应 emoji。
  - 反应语义：[Reactions](/tools/reactions)
- 对于包含事件元数据的入站消息，OpenClaw 发送已投递 + 已阅确认（尽力而为）。

## 故障排除

**登录不持久：**

- `openclaw channels status --probe`
- 重新登录：`openclaw channels logout --channel zalouser && openclaw channels login --channel zalouser`

**白名单/群组名称未解析：**

- 在 `allowFrom`/`groupAllowFrom`/`groups` 中使用数字 ID，或精确好友/群组名称。

**从旧 CLI-based 设置升级：**

- 移除任何旧外部 `zca` 进程假设。
- Channel 现在完全在 OpenClaw 内运行，无需外部 CLI 二进制文件。

## 相关

- [Channels Overview](/channels) — 所有支持的 channels
- [Pairing](/channels/pairing) — DM 认证和配对流程
- [Groups](/channels/groups) — 群聊行为和提及门控
- [Channel Routing](/channels/channel-routing) — 消息的 session 路由
- [Security](/gateway/security) — 访问模型和安全加固
