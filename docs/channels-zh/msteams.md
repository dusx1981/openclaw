---
summary: "Microsoft Teams bot 支持状态、能力和配置"
read_when:
  - 正在开发 Microsoft Teams 频道功能
title: "Microsoft Teams"
---

# Microsoft Teams (plugin)

> "放弃一切希望，汝等以此入者。"

更新：2026-01-21

状态：文本 + 私信附件受支持；频道/群组文件发送需要 `sharePointSiteId` + Graph 权限（见[群聊发送文件](#sending-files-in-group-chats)）。投票通过 Adaptive Cards 发送。消息操作暴露显式 `upload-file` 用于文件优先发送。

## 需要插件

Microsoft Teams 作为插件提供，不随核心安装捆绑。

**破坏性变更 (2026.1.15)：** Microsoft Teams 从核心移出。如果你使用它，必须安装插件。

原因：保持核心安装更轻量，让 Microsoft Teams 依赖独立更新。

通过 CLI 安装（npm registry）：

```bash
openclaw plugins install @openclaw/msteams
```

本地检出（从 git 仓库运行时）：

```bash
openclaw plugins install ./path/to/local/msteams-plugin
```

如果你在设置期间选择 Teams 且检测到 git 检出，
OpenClaw 会自动提供本地安装路径。

详情：[Plugins](/tools/plugin)

## 快速设置（新手）

1. 安装 Microsoft Teams 插件。
2. 创建一个 **Azure Bot**（App ID + client secret + tenant ID）。
3. 用这些凭证配置 OpenClaw。
4. 通过公共 URL 或隧道暴露 `/api/messages`（默认端口 3978）。
5. 安装 Teams app 包并启动 gateway。

最小配置：

```json5
{
  channels: {
    msteams: {
      enabled: true,
      appId: "<APP_ID>",
      appPassword: "<APP_PASSWORD>",
      tenantId: "<TENANT_ID>",
      webhook: { port: 3978, path: "/api/messages" },
    },
  },
}
```

注意：群聊默认被阻止（`channels.msteams.groupPolicy: "allowlist"`）。要允许群组回复，设置 `channels.msteams.groupAllowFrom`（或使用 `groupPolicy: "open"` 允许任何成员，提及触发）。

## 目标

- 通过 Teams 私信、群聊或频道与 OpenClaw 交流。
- 保持路由确定性：回复始终回到消息到达的频道。
- 默认安全的频道行为（除非另有配置，需要提及）。

## 配置写入

默认情况下，Microsoft Teams 允许写入由 `/config set|unset` 触发的配置更新（需要 `commands.config: true`）。

禁用：

```json5
{
  channels: { msteams: { configWrites: false } },
}
```

## 访问控制（私信 + 群组）

**私信访问**

- 默认：`channels.msteams.dmPolicy = "pairing"`。未知发送者在批准前被忽略。
- `channels.msteams.allowFrom` 应使用稳定 AAD object ID。
- UPN/display name 是可变的；直接匹配默认禁用，仅在 `channels.msteams.dangerouslyAllowNameMatching: true` 时启用。
- 向导可在凭证允许时通过 Microsoft Graph 解析名称到 ID。

**群组访问**

- 默认：`channels.msteams.groupPolicy = "allowlist"`（除非你添加 `groupAllowFrom` 则阻止）。使用 `channels.defaults.groupPolicy` 在未设置时覆盖默认。
- `channels.msteams.groupAllowFrom` 控制哪些发送者可在群聊/频道中触发（回退到 `channels.msteams.allowFrom`）。
- 设置 `groupPolicy: "open"` 允许任何成员（仍默认提及触发）。
- 要允许**无频道**，设置 `channels.msteams.groupPolicy: "disabled"`。

示例：

```json5
{
  channels: {
    msteams: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["user@org.com"],
    },
  },
}
```

**Teams + 频道白名单**

- 通过在 `channels.msteams.teams` 下列出 teams 和频道来限定群组/频道回复。
- 键应使用稳定 team ID 和频道会话 ID。
- 当 `groupPolicy="allowlist"` 且存在 teams 白名单时，仅列出的 teams/频道被接受（提及触发）。
- 配置向导接受 `Team/Channel` 条目并为你存储它们。
- 启动时，OpenClaw 将 team/channel 和用户白名单名称解析为 ID（当 Graph 权限允许时）并记录映射；未解析的 team/channel 名称按输入保留但默认被路由忽略，除非启用 `channels.msteams.dangerouslyAllowNameMatching: true`。

示例：

```json5
{
  channels: {
    msteams: {
      groupPolicy: "allowlist",
      teams: {
        "My Team": {
          channels: {
            General: { requireMention: true },
          },
        },
      },
    },
  },
}
```

## 工作原理

1. 安装 Microsoft Teams 插件。
2. 创建一个 **Azure Bot**（App ID + secret + tenant ID）。
3. 构建一个 **Teams app package**，引用 bot 并包含下方 RSC 权限。
4. 将 Teams app 上传/安装到团队（或个人范围用于私信）。
5. 在 `~/.openclaw/openclaw.json`（或环境变量）中配置 `msteams` 并启动 gateway。
6. Gateway 默认在 `/api/messages` 监听 Bot Framework webhook 流量。

## Azure Bot 设置（先决条件）

在配置 OpenClaw 前，你需要创建 Azure Bot 资源。

### 步骤 1：创建 Azure Bot

1. 访问 [Create Azure Bot](https://portal.azure.com/#create/Microsoft.AzureBot)
2. 填写 **Basics** 标签页：

   | 字段               | 值                                               |
   | ------------------ | ------------------------------------------------ |
   | **Bot handle**     | 你的 bot 名称，如 `openclaw-msteams`（必须唯一） |
   | **Subscription**   | 选择你的 Azure 订阅                              |
   | **Resource group** | 创建新或使用现有                                 |
   | **Pricing tier**   | **Free** 用于开发/测试                           |
   | **Type of App**    | **Single Tenant**（推荐 - 见下方注释）           |
   | **Creation type**  | **Create new Microsoft App ID**                  |

> **弃用通知：** 2025-07-31 后创建新的多租户 bot 已弃用。新 bot 使用 **Single Tenant**。

3. 点击 **Review + create** → **Create**（等待约 1-2 分钟）

### 步骤 2：获取凭证

1. 访问你的 Azure Bot 资源 → **Configuration**
2. 复制 **Microsoft App ID** → 这是你的 `appId`
3. 点击 **Manage Password** → 进入 App Registration
4. 在 **Certificates & secrets** → **New client secret** → 复制 **Value** → 这是你的 `appPassword`
5. 进入 **Overview** → 复制 **Directory (tenant) ID** → 这是你的 `tenantId`

### 步骤 3：配置 Messaging Endpoint

1. 在 Azure Bot → **Configuration**
2. 将 **Messaging endpoint** 设置为你的 webhook URL：
   - 生产：`https://your-domain.com/api/messages`
   - 本地开发：使用隧道（见下方 [Local Development](#local-development-tunneling)）

### 步骤 4：启用 Teams Channel

1. 在 Azure Bot → **Channels**
2. 点击 **Microsoft Teams** → Configure → Save
3. 接受 Terms of Service

## 本地开发（隧道）

Teams 无法访问 `localhost`。本地开发使用隧道：

**选项 A：ngrok**

```bash
ngrok http 3978
# 复制 https URL，如 https://abc123.ngrok.io
# 设置 messaging endpoint 为：https://abc123.ngrok.io/api/messages
```

**选项 B：Tailscale Funnel**

```bash
tailscale funnel 3978
# 使用你的 Tailscale funnel URL 作为 messaging endpoint
```

## Teams Developer Portal（替代方案）

你可使用 [Teams Developer Portal](https://dev.teams.microsoft.com/apps) 替代手动创建 manifest ZIP：

1. 点击 **+ New app**
2. 填写基本信息（名称、描述、开发者信息）
3. 进入 **App features** → **Bot**
4. 选择 **Enter a bot ID manually** 并粘贴你的 Azure Bot App ID
5. 检查范围：**Personal**、**Team**、**Group Chat**
6. 点击 **Distribute** → **Download app package**
7. 在 Teams 中：**Apps** → **Manage your apps** → **Upload a custom app** → 选择 ZIP

这通常比手动编辑 JSON manifest 更简单。

## 测试 Bot

**选项 A：Azure Web Chat（先验证 webhook）**

1. 在 Azure Portal → 你的 Azure Bot 资源 → **Test in Web Chat**
2. 发送消息 - 你应看到响应
3. 这确认你的 webhook 端点在 Teams 设置前工作

**选项 B：Teams（app 安装后）**

1. 安装 Teams app（sideload 或组织目录）
2. 在 Teams 中找到 bot 并发送私信
3. 检查 gateway 日志查看入站活动

## 设置（最小文本式）

1. **安装 Microsoft Teams 插件**
   - 从 npm：`openclaw plugins install @openclaw/msteams`
   - 从本地检出：`openclaw plugins install ./path/to/local/msteams-plugin`

2. **Bot 注册**
   - 创建 Azure Bot（见上文）并记录：
     - App ID
     - Client secret（App password）
     - Tenant ID（单租户）

3. **Teams app manifest**
   - 包含 `botId = <App ID>` 的 `bot` 条目。
   - 范围：`personal`、`team`、`groupChat`。
   - `supportsFiles: true`（个人范围文件处理需要）。
   - 添加 RSC 权限（见下文）。
   - 创建图标：`outline.png`（32x32）和 `color.png`（192x192）。
   - 将三个文件打包为 ZIP：`manifest.json`、`outline.png`、`color.png`。

4. **配置 OpenClaw**

   ```json5
   {
     channels: {
       msteams: {
         enabled: true,
         appId: "<APP_ID>",
         appPassword: "<APP_PASSWORD>",
         tenantId: "<TENANT_ID>",
         webhook: { port: 3978, path: "/api/messages" },
       },
     },
   }
   ```

   你也可使用环境变量替代配置键：
   - `MSTEAMS_APP_ID`
   - `MSTEAMS_APP_PASSWORD`
   - `MSTEAMS_TENANT_ID`

5. **Bot 端点**
   - 将 Azure Bot Messaging Endpoint 设置为：
     - `https://<host>:3978/api/messages`（或你选择的路径/端口）。

6. **运行 gateway**
   - Teams 频道在插件安装且 `msteams` 配置存在凭证时自动启动。

## 成员信息操作

OpenClaw 为 Microsoft Teams 暴露 Graph-backed `member-info` 操作，以便 agents 和自动化可直接从 Microsoft Graph 解析频道成员详情（display name、email、role）。

要求：

- `Member.Read.Group` RSC 权限（已在推荐 manifest 中）
- 跨团队查找：`User.Read.All` Graph Application 权限需管理员同意

该操作由 `channels.msteams.actions.memberInfo` 控制（默认：Graph 凭证可用时启用）。

## 历史上下文

- `channels.msteams.historyLimit` 控制有多少最近频道/群组消息被包装进提示。
- 回退到 `messages.groupChat.historyLimit`。设置 `0` 禁用（默认 50）。
- 获取的线程历史由发送者白名单过滤（`allowFrom` / `groupAllowFrom`），所以线程上下文种子仅包含允许发送者的消息。
- 引用附件上下文（从 Teams reply HTML 派生的 `ReplyTo*`）当前按接收传递。
- 换言之，白名单控制谁可触发 agent；仅特定补充上下文路径今天被过滤。
- 私信历史可用 `channels.msteams.dmHistoryLimit` 限制（用户回合）。每用户覆盖：`channels.msteams.dms["<user_id>"].historyLimit`。

## 当前 Teams RSC 权限（Manifest）

这些是 Teams app manifest 中**现有的 resourceSpecific 权限**。它们仅在安装 app 的团队/聊天内适用。

**用于频道（team 范围）：**

- `ChannelMessage.Read.Group` (Application) - 无需 @mention 接收所有频道消息
- `ChannelMessage.Send.Group` (Application)
- `Member.Read.Group` (Application)
- `Owner.Read.Group` (Application)
- `ChannelSettings.Read.Group` (Application)
- `TeamMember.Read.Group` (Application)
- `TeamSettings.Read.Group` (Application)

**用于群聊：**

- `ChatMessage.Read.Chat` (Application) - 无需 @mention 接收所有群聊消息

## Teams Manifest 示例（已删减）

最小有效示例，包含必需字段。替换 ID 和 URL。

```json5
{
  $schema: "https://developer.microsoft.com/en-us/json-schemas/teams/v1.23/MicrosoftTeams.schema.json",
  manifestVersion: "1.23",
  version: "1.0.0",
  id: "00000000-0000-0000-0000-000000000000",
  name: { short: "OpenClaw" },
  developer: {
    name: "Your Org",
    websiteUrl: "https://example.com",
    privacyUrl: "https://example.com/privacy",
    termsOfUseUrl: "https://example.com/terms",
  },
  description: { short: "OpenClaw in Teams", full: "OpenClaw in Teams" },
  icons: { outline: "outline.png", color: "color.png" },
  accentColor: "#5B6DEF",
  bots: [
    {
      botId: "11111111-1111-1111-1111-111111111111",
      scopes: ["personal", "team", "groupChat"],
      isNotificationOnly: false,
      supportsCalling: false,
      supportsVideo: false,
      supportsFiles: true,
    },
  ],
  webApplicationInfo: {
    id: "11111111-1111-1111-1111-111111111111",
  },
  authorization: {
    permissions: {
      resourceSpecific: [
        { name: "ChannelMessage.Read.Group", type: "Application" },
        { name: "ChannelMessage.Send.Group", type: "Application" },
        { name: "Member.Read.Group", type: "Application" },
        { name: "Owner.Read.Group", type: "Application" },
        { name: "ChannelSettings.Read.Group", type: "Application" },
        { name: "TeamMember.Read.Group", type: "Application" },
        { name: "TeamSettings.Read.Group", type: "Application" },
        { name: "ChatMessage.Read.Chat", type: "Application" },
      ],
    },
  },
}
```

### Manifest 注意事项（必需字段）

- `bots[].botId` **必须**匹配 Azure Bot App ID。
- `webApplicationInfo.id` **必须**匹配 Azure Bot App ID。
- `bots[].scopes` 必须包含你计划使用的表面（`personal`、`team`、`groupChat`）。
- `bots[].supportsFiles: true` 是个人范围文件处理必需的。
- `authorization.permissions.resourceSpecific` 必须包含频道读/发如果你需要频道流量。

### 更新现有 app

要更新已安装的 Teams app（如添加 RSC 权限）：

1. 用新设置更新你的 `manifest.json`
2. **增加 `version` 字段**（如 `1.0.0` → `1.1.0`）
3. **重新打包** manifest 和图标（`manifest.json`、`outline.png`、`color.png`）
4. 上传新 zip：
   - **选项 A (Teams Admin Center)：** Teams Admin Center → Teams apps → Manage apps → 找到你的 app → Upload new version
   - **选项 B (Sideload)：** 在 Teams → Apps → Manage your apps → Upload a custom app
5. **对于团队频道：** 在每个团队重新安装 app 以使新权限生效
6. **完全退出并重启 Teams**（非仅关闭窗口）以清除缓存的 app 元数据

## 能力：仅 RSC vs Graph

### 仅 **Teams RSC**（app 已安装，无 Graph API 权限）

可用：

- 读取频道消息**文本**内容。
- 发送频道消息**文本**内容。
- 接收**个人（私信）**文件附件。

不可用：

- 频道/群组**图片或文件内容**（载荷仅含 HTML stub）。
- 下载存储在 SharePoint/OneDrive 的附件。
- 读取消息历史（超出实时 webhook 事件）。

### **Teams RSC + Microsoft Graph Application 权限**

增加：

- 下载托管内容（粘贴到消息中的图片）。
- 下载存储在 SharePoint/OneDrive 的文件附件。
- 通过 Graph 读取频道/聊天消息历史。

### RSC vs Graph API

| 能力           | RSC 权限           | Graph API                 |
| -------------- | ------------------ | ------------------------- |
| **实时消息**   | 是（通过 webhook） | 否（仅轮询）              |
| **历史消息**   | 否                 | 是（可查询历史）          |
| **设置复杂度** | 仅 App manifest    | 需管理员同意 + token 流程 |
| **离线工作**   | 否（必须运行）     | 是（随时查询）            |

**结论：** RSC 用于实时监听；Graph API 用于历史访问。要获取离线时错过的消息，你需要带 `ChannelMessage.Read.All` 的 Graph API（需管理员同意）。

## Graph-enabled 媒体 + 历史（频道需要）

如果你需要在**频道**中使用图片/文件或想获取**消息历史**，你必须启用 Microsoft Graph 权限并授予管理员同意。

1. 在 Entra ID (Azure AD) **App Registration** 中添加 Microsoft Graph **Application 权限**：
   - `ChannelMessage.Read.All`（频道附件 + 历史）
   - `Chat.Read.All` 或 `ChatMessage.Read.All`（群聊）
2. **授予管理员同意**给租户。
3. 提升 Teams app **manifest 版本**，重新上传，并在 Teams **重新安装 app**。
4. **完全退出并重启 Teams** 以清除缓存的 app 元数据。

**用户提及的额外权限：** 用户 @mentions 对对话中用户开箱即用。但如果你想动态搜索和提及**不在当前对话中**的用户，添加 `User.Read.All` (Application) 权限并授予管理员同意。

## 已知限制

### Webhook 超时

Teams 通过 HTTP webhook 投递消息。如果处理时间过长（如慢 LLM 响应），你可能看到：

- Gateway 超时
- Teams 重试消息（导致重复）
- 丢弃的回复

OpenClaw 通过快速返回并主动发送回复来处理，但非常慢的响应仍可能导致问题。

### 格式

Teams markdown 比 Slack 或 Discord 更受限：

- 基本格式可用：**bold**、_italic_、`code`、links
- 复杂 markdown（表格、嵌套列表）可能无法正确渲染
- Adaptive Cards 用于投票和任意卡片发送（见下文）

## 配置

关键设置（共享频道模式见 `/gateway/configuration`）：

- `channels.msteams.enabled`：启用/禁用频道。
- `channels.msteams.appId`、`channels.msteams.appPassword`、`channels.msteams.tenantId`：bot 凭证。
- `channels.msteams.webhook.port`（默认 `3978`）
- `channels.msteams.webhook.path`（默认 `/api/messages`）
- `channels.msteams.dmPolicy`：`pairing | allowlist | open | disabled`（默认：pairing）
- `channels.msteams.allowFrom`：私信白名单（建议 AAD object ID）。向导在 Graph 访问可用时在设置期间解析名称到 ID。
- `channels.msteams.dangerouslyAllowNameMatching`：break-glass 开关重新启用可变 UPN/display-name 匹配和直接 team/channel 名称路由。
- `channels.msteams.textChunkLimit`：出站文本分块大小。
- `channels.msteams.chunkMode`：`length`（默认）或 `newline` 在长度分块前按空行（段落边界）分割。
- `channels.msteams.mediaAllowHosts`：入站附件主机白名单（默认为 Microsoft/Teams 域名）。
- `channels.msteams.mediaAuthAllowHosts`：媒体重试附加 Authorization headers 的主机白名单（默认为 Graph + Bot Framework 主机）。
- `channels.msteams.requireMention`：频道/群组需要 @mention（默认 true）。
- `channels.msteams.replyStyle`：`thread | top-level`（见 [Reply Style](#reply-style-threads-vs-posts))。
- `channels.msteams.teams.<teamId>.replyStyle`：每团队覆盖。
- `channels.msteams.teams.<teamId>.requireMention`：每团队覆盖。
- `channels.msteams.teams.<teamId>.tools`：频道覆盖缺失时使用的默认每团队工具策略覆盖（`allow`/`deny`/`alsoAllow`）。
- `channels.msteams.teams.<teamId>.toolsBySender`：默认每团队每发送者工具策略覆盖（支持 `"*"` 通配符）。
- `channels.msteams.teams.<teamId>.channels.<conversationId>.replyStyle`：每频道覆盖。
- `channels.msteams.teams.<teamId>.channels.<conversationId>.requireMention`：每频道覆盖。
- `channels.msteams.teams.<teamId>.channels.<conversationId>.tools`：每频道工具策略覆盖（`allow`/`deny`/`alsoAllow`）。
- `channels.msteams.teams.<teamId>.channels.<conversationId>.toolsBySender`：每频道每发送者工具策略覆盖（支持 `"*"` 通配符）。
- `toolsBySender` 键应使用显式前缀：
  `id:`、`e164:`、`username:`、`name:`（遗留无前缀键仍仅映射到 `id:`）。
- `channels.msteams.actions.memberInfo`：启用或禁用 Graph-backed 成员信息操作（默认：Graph 凭证可用时启用）。
- `channels.msteams.sharePointSiteId`：群聊/频道文件上传的 SharePoint site ID（见[群聊发送文件](#sending-files-in-group-chats))。

## 路由 & 会话

- 会话键遵循标准 agent 格式（见 [/concepts/session](/concepts/session))：
  - 私信共享主会话（`agent:<agentId>:<mainKey>`）。
  - 频道/群组消息使用会话 id：
    - `agent:<agentId>:msteams:channel:<conversationId>`
    - `agent:<agentId>:msteams:group:<conversationId>`

## Reply Style：线程 vs Posts

Teams 最近在相同底层数据模型上引入两种频道 UI 样式：

| 样式                      | 描述                           | 推荐 `replyStyle` |
| ------------------------- | ------------------------------ | ----------------- |
| **Posts**（经典）         | 消息显示为卡片，下方有线程回复 | `thread`（默认）  |
| **Threads**（Slack-like） | 消息线性流动，更像 Slack       | `top-level`       |

**问题：** Teams API 不暴露频道使用哪种 UI 样式。如果你使用错误的 `replyStyle`：

- `thread` 在 Threads 样式频道 → 回复尴尬嵌套
- `top-level` 在 Posts 样式频道 → 回复显示为单独顶层帖子而非在线程中

**解决方案：** 根据频道设置配置 `replyStyle`：

```json5
{
  channels: {
    msteams: {
      replyStyle: "thread",
      teams: {
        "19:abc...@thread.tacv2": {
          channels: {
            "19:xyz...@thread.tacv2": {
              replyStyle: "top-level",
            },
          },
        },
      },
    },
  },
}
```

## 附件 & 图片

**当前限制：**

- **私信：** 图片和文件附件通过 Teams bot 文件 API 工作。
- **频道/群组：** 附件存在于 M365 存储（SharePoint/OneDrive）。Webhook 载荷仅含 HTML stub，非实际文件字节。**需要 Graph API 权限**下载频道附件。
- 对于显式文件优先发送，使用 `action=upload-file` 配合 `media` / `filePath` / `path`；可选 `message` 成为附带文本/评论，`filename` 覆盖上传名称。

无 Graph 权限时，带图片的频道消息将作为纯文本接收（图片内容对 bot 不可访问）。
默认情况下，OpenClaw 仅从 Microsoft/Teams 主机名下载媒体。使用 `channels.msteams.mediaAllowHosts` 覆盖（使用 `["*"]` 允许任何主机）。
Authorization headers 仅附加给 `channels.msteams.mediaAuthAllowHosts` 中主机（默认为 Graph + Bot Framework 主机）。保持此列表严格（避免多租户后缀）。

## 群聊发送文件

Bot 可在私信中使用 FileConsentCard 流程发送文件（内置）。但**在群聊/频道发送文件**需要额外设置：

| 上下文                 | 文件如何发送                          | 需要设置                             |
| ---------------------- | ------------------------------------- | ------------------------------------ |
| **私信**               | FileConsentCard → 用户接受 → bot 上传 | 开箱即用                             |
| **群聊/频道**          | 上传到 SharePoint → 分享链接          | 需要 `sharePointSiteId` + Graph 权限 |
| **图片（任何上下文）** | Base64 编码内联                       | 开箱即用                             |

### 为什么群聊需要 SharePoint

Bot 没有个人 OneDrive drive（`/me/drive` Graph API 端点对 application 身份不工作）。要在群聊/频道发送文件，bot 上传到 **SharePoint site** 并创建分享链接。

### 设置

1. 在 Entra ID (Azure AD) → App Registration **添加 Graph API 权限**：
   - `Sites.ReadWrite.All` (Application) - 上传文件到 SharePoint
   - `Chat.Read.All` (Application) - 可选，启用每用户分享链接

2. **授予管理员同意**给租户。

3. **获取你的 SharePoint site ID：**

   ```bash
   # 通过 Graph Explorer 或带有效 token 的 curl：
   curl -H "Authorization: Bearer $TOKEN" \
     "https://graph.microsoft.com/v1.0/sites/{hostname}:/{site-path}"

   # 示例：对于 "contoso.sharepoint.com/sites/BotFiles" 的站点
   curl -H "Authorization: Bearer $TOKEN" \
     "https://graph.microsoft.com/v1.0/sites/contoso.sharepoint.com:/sites/BotFiles"

   # 响应包含："id": "contoso.sharepoint.com,guid1,guid2"
   ```

4. **配置 OpenClaw：**

   ```json5
   {
     channels: {
       msteams: {
         // ... 其他配置 ...
         sharePointSiteId: "contoso.sharepoint.com,guid1,guid2",
       },
     },
   }
   ```

### 分享行为

| 权限                                    | 分享行为                               |
| --------------------------------------- | -------------------------------------- |
| 仅 `Sites.ReadWrite.All`                | 组织范围分享链接（组织中任何人可访问） |
| `Sites.ReadWrite.All` + `Chat.Read.All` | 每用户分享链接（仅聊天成员可访问）     |

每用户分享更安全，仅聊天参与者可访问文件。如果缺少 `Chat.Read.All` 权限，bot 回退到组织范围分享。

### 回退行为

| 场景                                    | 结果                                       |
| --------------------------------------- | ------------------------------------------ |
| 群聊 + 文件 + `sharePointSiteId` 已配置 | 上传到 SharePoint，发送分享链接            |
| 群聊 + 文件 + 无 `sharePointSiteId`     | 尝试 OneDrive 上传（可能失败），仅发送文本 |
| 个人聊天 + 文件                         | FileConsentCard 流程（无 SharePoint 工作） |
| 任何上下文 + 图片                       | Base64 编码内联（无 SharePoint 工作）      |

### 文件存储位置

上传的文件存储在配置 SharePoint site 默认文档库的 `/OpenClawShared/` 文件夹。

## 投票（Adaptive Cards）

OpenClaw 将 Teams 投票作为 Adaptive Cards 发送（无原生 Teams poll API）。

- CLI：`openclaw message poll --channel msteams --target conversation:<id> ...`
- 投票由 gateway 记录在 `~/.openclaw/msteams-polls.json`。
- Gateway 必须保持在线以记录投票。
- 投票尚未自动发布结果摘要（如需要检查存储文件）。

## Adaptive Cards（任意）

使用 `message` 工具或 CLI 向 Teams 用户或会话发送任意 Adaptive Card JSON。

`card` 参数接受 Adaptive Card JSON 对象。当提供 `card` 时，消息文本可选。

**Agent 工具：**

```json5
{
  action: "send",
  channel: "msteams",
  target: "user:<id>",
  card: {
    type: "AdaptiveCard",
    version: "1.5",
    body: [{ type: "TextBlock", text: "Hello!" }],
  },
}
```

**CLI：**

```bash
openclaw message send --channel msteams \
  --target "conversation:19:abc...@thread.tacv2" \
  --card '{"type":"AdaptiveCard","version":"1.5","body":[{"type":"TextBlock","text":"Hello!"}]}'
```

卡片 schema 和示例见 [Adaptive Cards documentation](https://adaptivecards.io/)。目标格式详情见下文 [Target formats](#target-formats)。

## 目标格式

MSTeams 目标使用前缀区分用户和会话：

| 目标类型          | 格式                             | 示例                                             |
| ----------------- | -------------------------------- | ------------------------------------------------ |
| 用户（按 ID）     | `user:<aad-object-id>`           | `user:40a1a0ed-4ff2-4164-a219-55518990c197`      |
| 用户（按名称）    | `user:<display-name>`            | `user:John Smith`（需要 Graph API）              |
| 群组/频道         | `conversation:<conversation-id>` | `conversation:19:abc123...@thread.tacv2`         |
| 群组/频道（原始） | `<conversation-id>`              | `19:abc123...@thread.tacv2`（如果包含 `@thread`) |

**CLI 示例：**

```bash
# 按 ID 发送给用户
openclaw message send --channel msteams --target "user:40a1a0ed-..." --message "Hello"

# 按显示名发送给用户（触发 Graph API 查找）
openclaw message send --channel msteams --target "user:John Smith" --message "Hello"

# 发送到群聊或频道
openclaw message send --channel msteams --target "conversation:19:abc...@thread.tacv2" --message "Hello"

# 发送 Adaptive Card 到会话
openclaw message send --channel msteams --target "conversation:19:abc...@thread.tacv2" \
  --card '{"type":"AdaptiveCard","version":"1.5","body":[{"type":"TextBlock","text":"Hello"}]}'
```

**Agent 工具示例：**

```json5
{
  action: "send",
  channel: "msteams",
  target: "user:John Smith",
  message: "Hello!",
}
```

```json5
{
  action: "send",
  channel: "msteams",
  target: "conversation:19:abc...@thread.tacv2",
  card: {
    type: "AdaptiveCard",
    version: "1.5",
    body: [{ type: "TextBlock", text: "Hello" }],
  },
}
```

注意：无 `user:` 前缀时，名称默认为群组/team 解析。按显示名目标人时始终使用 `user:`。

## 主动消息

- 主动消息仅在用户交互**后**可能，因为我们在那时存储会话引用。
- `dmPolicy` 和白名单控制见 `/gateway/configuration`。

## Team 和 Channel ID（常见误区）

Teams URL 中的 `groupId` 查询参数**不是**用于配置的 team ID。从 URL 路径提取 ID：

**Team URL：**

```
https://teams.microsoft.com/l/team/19%3ABk4j...%40thread.tacv2/conversations?groupId=...
                                    └────────────────────────────┘
                                    Team ID（URL 解码此值）
```

**Channel URL：**

```
https://teams.microsoft.com/l/channel/19%3A15bc...%40thread.tacv2/ChannelName?groupId=...
                                      └─────────────────────────┘
                                      Channel ID（URL 解码此值）
```

**用于配置：**

- Team ID = `/team/` 后的路径段（URL 解码，如 `19:Bk4j...@thread.tacv2`）
- Channel ID = `/channel/` 后的路径段（URL 解码）
- **忽略** `groupId` 查询参数

## 私有频道

Bot 在私有频道中支持有限：

| 功能                | 标准频道 | 私有频道               |
| ------------------- | -------- | ---------------------- |
| Bot 安装            | Yes      | Limited                |
| 实时消息（webhook） | Yes      | May not work           |
| RSC 权限            | Yes      | May behave differently |
| @mentions           | Yes      | If bot is accessible   |
| Graph API 历史      | Yes      | Yes（带权限）          |

**私有频道不工作的变通：**

1. 使用标准频道进行 bot 交互
2. 使用私信 - 用户始终可直接消息 bot
3. 使用 Graph API 访问历史（需要 `ChannelMessage.Read.All`）

## 故障排除

### 常见问题

- **频道图片不显示：** Graph 权限或管理员同意缺失。重新安装 Teams app 并完全退出/重启 Teams。
- **频道无响应：** 默认需要提及；设置 `channels.msteams.requireMention=false` 或按 team/channel 配置。
- **版本不匹配（Teams 仍显示旧 manifest）：** 移除 + 重新添加 app 并完全退出 Teams 以刷新。
- **Webhook 401 Unauthorized：** 手动测试无 Azure JWT 时预期——意味着端点可达但认证失败。使用 Azure Web Chat 正确测试。

### Manifest 上传错误

- **"Icon file cannot be empty"：** Manifest 引用 0 字节图标文件。创建有效 PNG 图标（`outline.png` 32x32，`color.png` 192x192）。
- **"webApplicationInfo.Id already in use"：** App 仍安装在另一个团队/聊天。先找到并卸载，或等待 5-10 分钟传播。
- **上传时 "Something went wrong"：** 通过 [https://admin.teams.microsoft.com](https://admin.teams.microsoft.com) 上传替代，打开浏览器 DevTools (F12) → Network 标签，检查响应体获取实际错误。
- **Sideload 失败：** 尝试 "Upload an app to your org's app catalog" 替代 "Upload a custom app"——这通常绕过 sideload 限制。

### RSC 权限不工作

1. 验证 `webApplicationInfo.id` 精确匹配你的 bot App ID
2. 重新上传 app 并在团队/聊天重新安装
3. 检查组织管理员是否阻止 RSC 权限
4. 确认使用正确范围：teams 用 `ChannelMessage.Read.Group`，群聊用 `ChatMessage.Read.Chat`

## 参考资料

- [Create Azure Bot](https://learn.microsoft.com/en-us/azure/bot-service/bot-service-quickstart-registration) - Azure Bot 设置指南
- [Teams Developer Portal](https://dev.teams.microsoft.com/apps) - 创建/管理 Teams apps
- [Teams app manifest schema](https://learn.microsoft.com/en-us/microsoftteams/platform/resources/schema/manifest-schema)
- [Receive channel messages with RSC](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/conversations/channel-messages-with-rsc)
- [RSC permissions reference](https://learn.microsoft.com/en-us/microsoftteams/platform/graph-api/rsc/resource-specific-consent)
- [Teams bot file handling](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/bots-filesv4)（频道/群组需要 Graph）
- [Proactive messaging](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/conversations/send-proactive-messages)

## 相关文档

- [频道概览](/channels) — 所有支持的频道
- [配对](/channels/pairing) — 私信认证和配对流程
- [群组](/channels/groups) — 群聊行为和提及触发
- [频道路由](/channels/channel-routing) — 消息的会话路由
- [安全](/gateway/security) — 访问模型和加固
