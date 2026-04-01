# OpenClaw Control UI Session 无法切换问题分析

## 问题描述

访问 `http://127.0.0.1:7777/chat?session=main` 时，对话框左上角显示的 session 是 `heartbeat`，且无法切换到 `main` session。

## 症状

- URL 参数 `?session=main` 未生效
- Session 选择器显示错误的值
- Session 选择器可能被禁用（无法点击切换）

## 代码分析

### Session 存储流程

```
┌─────────────────────────────────────────────────────┐
│ 1. loadSettings() 从 localStorage 加载             │
│    → 可能存储了之前的 'heartbeat' session           │
│                                                     │
│ 2. sessionKey = this.settings.sessionKey           │
│    → 初始化为 localStorage 的值                     │
│                                                     │
│ 3. handleConnected() → applySettingsFromUrl()      │
│    → 从 URL 读取 session=main 并覆盖               │
│                                                     │
│ 问题：如果 URL 没有 session 参数或解析失败          │
│       则显示 localStorage 中的旧值                  │
└─────────────────────────────────────────────────────┘
```

### 关键代码位置

| 文件 | 作用 |
|------|------|
| `ui/src/ui/app.ts:154` | sessionKey 初始化 |
| `ui/src/ui/app-settings.ts:90-154` | applySettingsFromUrl 处理 URL 参数 |
| `ui/src/ui/storage.ts:192-283` | loadSettings 从 localStorage 加载 |
| `ui/src/ui/app-render.helpers.ts:133-168` | renderChatSessionSelect 渲染 session 选择器 |
| `ui/src/ui/app-gateway.ts:148-176` | applySessionDefaults 应用服务器默认值 |

### Session 选择器禁用条件

```typescript
// ui/src/ui/app-render.helpers.ts:141
?disabled=${!state.connected || sessionGroups.length === 0}
```

选择器在以下情况被禁用：
1. `state.connected = false` - WebSocket 未连接
2. `sessionGroups.length === 0` - sessions 列表为空

### Session 列表加载

```typescript
// ui/src/ui/controllers/sessions.ts:32-78
export async function loadSessions(state: SessionsState, overrides?: {...}) {
  // 调用 sessions.list RPC 获取 session 列表
  const res = await state.client.request<SessionsListResult | undefined>("sessions.list", params);
}
```

## 根本原因（已确认）

### Heartbeat `target: "none"` 是正常状态

当配置中没有设置 `agents.defaults.heartbeat.target` 时，默认值为 `"none"`：

```typescript
// src/infra/heartbeat-summary.ts:24
const DEFAULT_HEARTBEAT_TARGET = "none";
```

**这是正常状态**：`target: "none"` 表示 heartbeat 只运行模型检查，但不发送消息到任何 channel。这在以下场景很有用：
- 开发/测试环境
- 只想监控 agent 状态，不想发送消息
- 没有配置任何消息通道

### 问题：sender 默认值导致 origin 被污染

当 `target: "none"` 且 session 没有 `lastChannel` 时：

```
┌─────────────────────────────────────────────────────┐
│ 1. resolveHeartbeatDeliveryTarget()                │
│    → delivery.channel = "none"                     │
│    → delivery.lastChannel = undefined (新session)  │
│                                                     │
│ 2. resolveHeartbeatSenderContext()                 │
│    → provider = delivery.lastChannel = undefined   │
│    → allowFrom = []                                │
│                                                     │
│ 3. resolveHeartbeatSenderId()                      │
│    → return candidates[0] ?? "heartbeat"           │
│    → sender = "heartbeat"                          │
│                                                     │
│ 4. heartbeat-runner.ts 构建 ctx:                   │
│    ctx = {                                          │
│      From: sender,     // "heartbeat"              │
│      To: sender,        // "heartbeat"             │
│      Provider: "heartbeat",                        │
│    }                                                │
│                                                     │
│ 5. initSessionState() → deriveSessionMetaPatch()   │
│    → origin.label = ctx.From = "heartbeat"         │
└─────────────────────────────────────────────────────┘
```

### 代码追踪

`resolveHeartbeatSenderId` 函数（`src/infra/outbound/targets.ts:469-500`）：

```typescript
function resolveHeartbeatSenderId(params) {
  const candidates = [
    deliveryTo?.trim(),
    provider && deliveryTo ? `${provider}:${deliveryTo}` : undefined,
    lastTo?.trim(),
    provider && lastTo ? `${provider}:${lastTo}` : undefined,
  ].filter((val) => Boolean(val?.trim()));

  // ...
  return candidates[0] ?? "heartbeat";  // 默认值！
}
```

当没有有效的 delivery target 时，所有 candidates 都为空，返回默认值 `"heartbeat"`。

### origin.label 设置逻辑

`src/channels/conversation-label.ts:34-37`：

```typescript
if (chatType === "direct") {
  return ctx.SenderName?.trim() || ctx.From?.trim() || undefined;
}
```

当 `From = "heartbeat"` 时，`origin.label = "heartbeat"`。

## 解决方案

### 方案 1：清理 session 数据（推荐）

修改 `~/.openclaw/agents/main/sessions/sessions.json`：

```bash
# 备份原文件
cp ~/.openclaw/agents/main/sessions/sessions.json ~/.openclaw/agents/main/sessions/sessions.json.bak

# 清理 origin 和 deliveryContext
python3 -c "
import json
with open('$HOME/.openclaw/agents/main/sessions/sessions.json') as f:
    data = json.load(f)
if 'agent:main:main' in data:
    entry = data['agent:main:main']
    if 'origin' in entry:
        entry['origin'] = {}
    if 'deliveryContext' in entry:
        del entry['deliveryContext']
    if 'displayName' in entry:
        del entry['displayName']
    if 'label' in entry:
        del entry['label']
with open('$HOME/.openclaw/agents/main/sessions/sessions.json', 'w') as f:
    json.dump(data, f, indent=2)
"

# 重启 gateway
pkill -f openclaw-gateway
pnpm openclaw gateway run
```

### 方案 2：清除浏览器 localStorage

如果问题仍然存在，清除浏览器 localStorage：

1. 打开浏览器开发者工具 (F12)
2. Application → Local Storage → `http://127.0.0.1:7777`
3. 删除所有 `openclaw.control.*` 相关的键
4. 刷新页面

### 验证

```bash
# 检查进程
ps aux | grep openclaw-gateway | grep -v grep

# 检查端口
ss -ltnp | grep 7777

# 获取 dashboard URL
pnpm openclaw dashboard --no-open
```

## 预防措施

1. 避免使用 "heartbeat" 作为 channel/provider 标识符
2. 在 session 创建时确保 `origin` 字段正确设置
3. 定期检查 `sessions.json` 中的异常数据

## 代码修复建议

### 方案 1：在 `deriveSessionOrigin` 中跳过内部消息通道（推荐）

修改 `src/config/sessions/metadata.ts`：

```typescript
import { normalizeMessageChannel } from "../../utils/message-channel.js";

// 内部消息通道列表，不应更新 session origin
const INTERNAL_PROVIDERS = new Set(["heartbeat", "exec-event", "cron-event", "webchat"]);

export function deriveSessionOrigin(ctx: MsgContext): SessionOrigin | undefined {
  const providerRaw =
    (typeof ctx.OriginatingChannel === "string" && ctx.OriginatingChannel) ||
    ctx.Surface ||
    ctx.Provider;
  const provider = normalizeMessageChannel(providerRaw);
  
  // 跳过内部消息通道，不更新 origin
  if (provider && INTERNAL_PROVIDERS.has(provider)) {
    return undefined;
  }
  
  // ... 原有逻辑
}
```

### 方案 2：在 `resolveHeartbeatSenderId` 中返回 undefined

修改 `src/infra/outbound/targets.ts`：

```typescript
function resolveHeartbeatSenderId(params): string | undefined {
  // ...
  
  // 当没有有效的 delivery target 时，返回 undefined 而不是 "heartbeat"
  // 这样调用方可以检测并跳过 origin 更新
  return candidates[0] ?? undefined;
}
```

### 方案 3：在 heartbeat-runner 中不传递 From/To

修改 `src/infra/heartbeat-runner.ts`，当 `delivery.channel === "none"` 时不设置 `From`/`To`：

```typescript
const ctx = {
  Body: appendCronStyleCurrentTimeLine(prompt, cfg, startedAt),
  // 只在有有效 delivery target 时设置 From/To
  ...(delivery.channel !== "none" && {
    From: sender,
    To: sender,
  }),
  OriginatingChannel: delivery.channel !== "none" ? delivery.channel : undefined,
  OriginatingTo: delivery.to,
  AccountId: delivery.accountId,
  MessageThreadId: delivery.threadId,
  Provider: hasExecCompletion ? "exec-event" : hasCronEvents ? "cron-event" : "heartbeat",
  SessionKey: runSessionKey,
};
```

### 推荐方案

**方案 1** 是最完整的修复，因为它会在所有地方阻止内部消息通道更新 session origin，包括：
- heartbeat
- exec-event
- cron-event  
- webchat

## 相关文件

- `ui/src/ui/app.ts` - 主应用组件
- `ui/src/ui/app-settings.ts` - 设置和 URL 参数处理
- `ui/src/ui/storage.ts` - localStorage 存储
- `ui/src/ui/app-render.helpers.ts` - Session 选择器渲染
- `ui/src/ui/controllers/sessions.ts` - Session 数据加载
- `src/gateway/session-utils.ts` - 服务端 session 列表逻辑（**buildGatewaySessionRow 函数**）

## 修复记录

- **日期**: 2026-03-31
- **问题**: Session 显示 "heartbeat" 无法切换
- **原因**: `sessions.json` 中 `origin.label` 被错误设置为 "heartbeat"
- **修复**: 清理 `origin` 和 `deliveryContext` 字段

## Bug 报告

**问题**: Heartbeat 运行时会错误地更新 session 的 `origin.label`

**影响**: 当 heartbeat 配置为 `target: "none"` 或没有有效的 delivery target 时，`origin.label` 会被设置为 `"heartbeat"`，导致 UI 显示错误的 session 名称。

**建议修复**:

在 `src/config/sessions/metadata.ts` 的 `deriveSessionOrigin` 函数中，检查 `Provider` 是否为内部消息通道：

```typescript
// 添加到 deriveSessionOrigin 函数开头
const providerRaw = (typeof ctx.OriginatingChannel === "string" && ctx.OriginatingChannel) ||
  ctx.Surface ||
  ctx.Provider;

// 跳过内部消息通道（heartbeat, exec-event, cron-event, webchat）
if (providerRaw) {
  const normalized = providerRaw.toLowerCase();
  if (normalized === "heartbeat" || normalized === "exec-event" || 
      normalized === "cron-event" || normalized === "webchat") {
    return undefined;
  }
}
```

或者在 `src/infra/heartbeat-runner.ts` 中，不传递 `From`/`To` 字段：

```typescript
const ctx = {
  Body: appendCronStyleCurrentTimeLine(prompt, cfg, startedAt),
  // 不设置 From/To，避免污染 origin
  OriginatingChannel: delivery.channel !== "none" ? delivery.channel : undefined,
  OriginatingTo: delivery.to,
  AccountId: delivery.accountId,
  MessageThreadId: delivery.threadId,
  Provider: hasExecCompletion ? "exec-event" : hasCronEvents ? "cron-event" : "heartbeat",
  SessionKey: runSessionKey,
};
```