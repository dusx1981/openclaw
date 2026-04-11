---
summary: "Google Chat app support status, capabilities, and configuration"
read_when:
  - Working on Google Chat channel features
title: "Google Chat"
---

# Google Chat (Chat API)

状态：通过 Google Chat API webhooks 支持私信 + spaces（仅 HTTP）。

## 快速设置（新手）

1. 创建 Google Cloud 项目并启用 **Google Chat API**。
   - 前往：[Google Chat API Credentials](https://console.cloud.google.com/apis/api/chat.googleapis.com/credentials)
   - 如果尚未启用，启用 API。
2. 创建 **Service Account**：
   - 点击 **Create Credentials** > **Service Account**。
   - 命名任意（如 `openclaw-chat`）。
   - 权限留空（点击 **Continue**）。
   - principals with access 留空（点击 **Done**）。
3. 创建并下载 **JSON Key**：
   - 在 service account 列表中，点击刚创建的账号。
   - 前往 **Keys** 标签页。
   - 点击 **Add Key** > **Create new key**。
   - 选择 **JSON** 并点击 **Create**。
4. 将下载的 JSON 文件存储在 gateway 主机上（如 `~/.openclaw/googlechat-service-account.json`）。
5. 在 [Google Cloud Console Chat Configuration](https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat) 创建 Google Chat 应用：
   - 填写 **Application info**：
     - **App name**：（如 `OpenClaw`)
     - **Avatar URL**：（如 `https://openclaw.ai/logo.png`)
     - **Description**：（如 `Personal AI Assistant`)
   - 启用 **Interactive features**。
   - 在 **Functionality** 下，勾选 **Join spaces and group conversations**。
   - 在 **Connection settings** 下，选择 **HTTP endpoint URL**。
   - 在 **Triggers** 下，选择 **Use a common HTTP endpoint URL for all triggers** 并设置为你的 gateway 公共 URL 后跟 `/googlechat`。
     - _提示：运行 `openclaw status` 查找你的 gateway 公共 URL。_
   - 在 **Visibility** 下，勾选 **Make this Chat app available to specific people and groups in &lt;Your Domain&gt;**。
   - 在文本框中输入你的邮箱地址（如 `user@example.com`）。
   - 点击底部 **Save**。
6. **启用应用状态**：
   - 保存后，**刷新页面**。
   - 查找 **App status** 部分（通常在保存后顶部或底部附近）。
   - 将状态更改为 **Live - available to users**。
   - 再次点击 **Save**。
7. 用 service account 路径 + webhook audience 配置 OpenClaw：
   - Env：`GOOGLE_CHAT_SERVICE_ACCOUNT_FILE=/path/to/service-account.json`
   - 或配置：`channels.googlechat.serviceAccountFile: "/path/to/service-account.json"`。
8. 设置 webhook audience 类型 + 值（匹配你的 Chat 应用配置）。
9. 启动 gateway。Google Chat 将 POST 到你的 webhook 路径。

## 添加到 Google Chat

Gateway 运行且你的邮箱添加到可见列表后：

1. 前往 [Google Chat](https://chat.google.com/)。
2. 点击 **Direct Messages** 旁的 **+**（加号）图标。
3. 在搜索栏（通常添加人的位置），输入你在 Google Cloud Console 配置的 **App name**。
   - **注意**：Bot _不会_ 出现在"Marketplace"浏览列表中，因为它是私人应用。你必须按名称搜索它。
4. 从结果中选择你的 bot。
5. 点击 **Add** 或 **Chat** 开始 1:1 对话。
6. 发送"Hello"触发助手！

## 公共 URL（仅 Webhook）

Google Chat webhooks 需要公共 HTTPS 端点。为安全起见，**仅向互联网暴露 `/googlechat` 路径**。将 OpenClaw dashboard 和其他敏感端点保持在你的私人网络上。

### 选项 A：Tailscale Funnel（推荐）

使用 Tailscale Serve 用于私人 dashboard，使用 Funnel 用于公共 webhook 路径。这保持 `/` 私人，仅暴露 `/googlechat`。

1. **检查 gateway 绑定的地址：**

   ```bash
   ss -tlnp | grep 18789
   ```

   记下 IP 地址（如 `127.0.0.1`、`0.0.0.0` 或你的 Tailscale IP 如 `100.x.x.x`）。

2. **仅向 tailnet 暴露 dashboard（端口 8443）：**

   ```bash
   # 如果绑定到 localhost (127.0.0.1 或 0.0.0.0):
   tailscale serve --bg --https 8443 http://127.0.0.1:18789

   # 如果仅绑定到 Tailscale IP (如 100.106.161.80):
   tailscale serve --bg --https 8443 http://100.106.161.80:18789
   ```

3. **仅公开暴露 webhook 路径：**

   ```bash
   # 如果绑定到 localhost (127.0.0.1 或 0.0.0.0):
   tailscale funnel --bg --set-path /googlechat http://127.0.0.1:18789/googlechat

   # 如果仅绑定到 Tailscale IP (如 100.106.161.80):
   tailscale funnel --bg --set-path /googlechat http://100.106.161.80:18789/googlechat
   ```

4. **授权节点 Funnel 访问：**
   如果提示，访问输出中显示的授权 URL 以在你的 tailnet policy 中为此节点启用 Funnel。

5. **验证配置：**

   ```bash
   tailscale serve status
   tailscale funnel status
   ```

你的公共 webhook URL 将是：
`https://<node-name>.<tailnet>.ts.net/googlechat`

你的私人 dashboard 保持 tailnet-only：
`https://<node-name>.<tailnet>.ts.net:8443/`

在 Google Chat 应用配置中使用公共 URL（不带 `:8443`）。

> 注意：此配置在重启后持久化。稍后移除，运行 `tailscale funnel reset` 和 `tailscale serve reset`。

### 选项 B：反向代理（Caddy）

如果你使用 Caddy 等反向代理，仅代理特定路径：

```caddy
your-domain.com {
    reverse_proxy /googlechat* localhost:18789
}
```

使用此配置，任何 `your-domain.com/` 的请求将被忽略或返回 404，而 `your-domain.com/googlechat` 安全路由到 OpenClaw。

### 选项 C：Cloudflare Tunnel

配置你的 tunnel ingress rules 仅路由 webhook 路径：

- **Path**：`/googlechat` -> `http://localhost:18789/googlechat`
- **Default Rule**：HTTP 404（Not Found）

## 工作原理

1. Google Chat 向 gateway 发送 webhook POSTs。每个请求包含 `Authorization: Bearer <token>` header。
   - 当 header 存在时，OpenClaw 在读取/解析完整 webhook bodies 验证 bearer 认证。
   - 携带 `authorizationEventObject.systemIdToken` 的 Google Workspace Add-on 请求通过更严格的预认证 body budget 支持。
2. OpenClaw 针对配置的 `audienceType` + `audience` 验证 token：
   - `audienceType: "app-url"` → audience 是你的 HTTPS webhook URL。
   - `audienceType: "project-number"` → audience 是 Cloud project number。
3. 消息按 space 路由：
   - 私信使用 session key `agent:<agentId>:googlechat:direct:<spaceId>`。
   - Spaces 使用 session key `agent:<agentId>:googlechat:group:<spaceId>`。
4. 私信访问默认为配对。未知发送者收到配对码；批准方式：
   - `openclaw pairing approve googlechat <code>`
5. 群组 spaces 默认需要 @-mention。如果提及检测需要应用用户名，使用 `botUser`。

## 目标

使用这些标识符进行发送和白名单：

- 直接消息：`users/<userId>`（推荐）。
- 原始邮箱 `name@example.com` 是可变的，仅用于直接白名单匹配当 `channels.googlechat.dangerouslyAllowNameMatching: true`。
- 已弃用：`users/<email>` 被视为用户 id，不是邮箱白名单。
- Spaces：`spaces/<spaceId>`。

## 配置要点

```json5
{
  channels: {
    googlechat: {
      enabled: true,
      serviceAccountFile: "/path/to/service-account.json",
      // 或 serviceAccountRef: { source: "file", provider: "filemain", id: "/channels/googlechat/serviceAccount" }
      audienceType: "app-url",
      audience: "https://gateway.example.com/googlechat",
      webhookPath: "/googlechat",
      botUser: "users/1234567890", // optional; helps mention detection
      dm: {
        policy: "pairing",
        allowFrom: ["users/1234567890"],
      },
      groupPolicy: "allowlist",
      groups: {
        "spaces/AAAA": {
          allow: true,
          requireMention: true,
          users: ["users/1234567890"],
          systemPrompt: "Short answers only.",
        },
      },
      actions: { reactions: true },
      typingIndicator: "message",
      mediaMaxMb: 20,
    },
  },
}
```

注意：

- Service account 凭据也可以通过 `serviceAccount`（JSON 字符串）内联传递。
- `serviceAccountRef` 也支持（env/file SecretRef），包括 `channels.googlechat.accounts.<id>.serviceAccountRef` 下的按账号 refs。
- 如果 `webhookPath` 未设置，默认 webhook 路径为 `/googlechat`。
- `dangerouslyAllowNameMatching` 为白名单重新启用可变邮箱主体匹配（紧急兼容模式）。
- 当 `actions.reactions` 启用时，表情反应通过 `reactions` 工具和 `channels action` 可用。
- 消息操作暴露文本 `send` 和显式附件发送 `upload-file`。`upload-file` 接受 `media` / `filePath` / `path` 加可选 `message`、`filename` 和线程目标。
- `typingIndicator` 支持 `none`、`message`（默认）和 `reaction`（reaction 需要用户 OAuth）。
- 附件通过 Chat API 下载并存储在媒体管道中（大小由 `mediaMaxMb` 限制）。

Secrets 参考详情：[Secrets 管理](/gateway/secrets)。

## 故障排除

### 405 Method Not Allowed

如果 Google Cloud Logs Explorer 显示类似错误：

```
status code: 405, reason phrase: HTTP error response: HTTP/1.1 405 Method Not Allowed
```

这表示 webhook handler 未注册。常见原因：

1. **频道未配置**：配置中缺少 `channels.googlechat` 部分。验证：

   ```bash
   openclaw config get channels.googlechat
   ```

   如果返回"Config path not found"，添加配置（见 [配置要点](#config-highlights))。

2. **插件未启用**：检查插件状态：

   ```bash
   openclaw plugins list | grep googlechat
   ```

   如果显示"disabled"，在配置中添加 `plugins.entries.googlechat.enabled: true`。

3. **Gateway 未重启**：添加配置后，重启 gateway：

   ```bash
   openclaw gateway restart
   ```

验证频道正在运行：

```bash
openclaw channels status
# 应显示：Google Chat default: enabled, configured, ...
```

### 其他问题

- 检查 `openclaw channels status --probe` 以获取认证错误或缺少 audience 配置。
- 如果无消息到达，确认 Chat 应用 webhook URL + 事件订阅。
- 如果提及门控阻止回复，将 `botUser` 设置为应用用户资源名称并验证 `requireMention`。
- 发送测试消息时使用 `openclaw logs --follow` 查看请求是否到达 gateway。

相关文档：

- [Gateway 配置](/gateway/configuration)
- [安全](/gateway/security)
- [表情反应](/tools/reactions)

## 相关内容

- [频道概览](/channels) — 所有支持的频道
- [配对](/channels/pairing) — 私信认证和配对流程
- [群组](/channels/groups) — 群组聊天行为和提及门控
- [频道路由](/channels/channel-routing) — 消息的 session 路由
- [安全](/gateway/security) — 访问模型和加固
