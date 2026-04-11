---
summary: "Broadcast a WhatsApp message to multiple agents"
read_when:
  - Configuring broadcast groups
  - Debugging multi-agent replies in WhatsApp
status: experimental
title: "Broadcast Groups"
---

# 广播群组

**状态：** 实验性  
**版本：** 在 2026.1.9 中添加

## 概述

广播群组允许多个 agent 同时处理和响应同一消息。这让你可以在单个 WhatsApp 群组或私信中创建专门的 agent 团队协作 — 全部使用一个电话号码。

当前范围：**仅 WhatsApp**（web 频道）。

广播群组在频道白名单和群组激活规则之后评估。在 WhatsApp 群组中，这意味着广播发生在 OpenClaw 通常会回复的时候（例如：在提及时，取决于你的群组设置）。

## 使用场景

### 1. 专门的 Agent 团队

部署具有原子化、明确职责的多个 agent：

```
群组："开发团队"
Agents:
  - CodeReviewer（审查代码片段）
  - DocumentationBot（生成文档）
  - SecurityAuditor（检查漏洞）
  - TestGenerator（建议测试用例）
```

每个 agent 处理同一消息并提供其专门视角。

### 2. 多语言支持

```
群组："国际支持"
Agents:
  - Agent_EN（英文回复）
  - Agent_DE（德文回复）
  - Agent_ES（西班牙文回复）
```

### 3. 质量保证工作流

```
群组："客户支持"
Agents:
  - SupportAgent（提供答案）
  - QAAgent（审查质量，仅在发现问题时回复）
```

### 4. 任务自动化

```
群组："项目管理"
Agents:
  - TaskTracker（更新任务数据库）
  - TimeLogger（记录时间花费）
  - ReportGenerator（创建摘要）
```

## 配置

### 基本设置

添加顶层 `broadcast` 部分（与 `bindings` 并列）。键是 WhatsApp peer ids：

- 群组聊天：group JID（如 `120363403215116621@g.us`）
- 私信：E.164 电话号码（如 `+15551234567`）

```json
{
  "broadcast": {
    "120363403215116621@g.us": ["alfred", "baerbel", "assistant3"]
  }
}
```

**结果：** 当 OpenClaw 在此聊天中回复时，它将运行所有三个 agent。

### 处理策略

控制 agent 如何处理消息：

#### 并行（默认）

所有 agent 同时处理：

```json
{
  "broadcast": {
    "strategy": "parallel",
    "120363403215116621@g.us": ["alfred", "baerbel"]
  }
}
```

#### 顺序

Agent 按顺序处理（一个等待上一个完成）：

```json
{
  "broadcast": {
    "strategy": "sequential",
    "120363403215116621@g.us": ["alfred", "baerbel"]
  }
}
```

### 完整示例

```json
{
  "agents": {
    "list": [
      {
        "id": "code-reviewer",
        "name": "Code Reviewer",
        "workspace": "/path/to/code-reviewer",
        "sandbox": { "mode": "all" }
      },
      {
        "id": "security-auditor",
        "name": "Security Auditor",
        "workspace": "/path/to/security-auditor",
        "sandbox": { "mode": "all" }
      },
      {
        "id": "docs-generator",
        "name": "Documentation Generator",
        "workspace": "/path/to/docs-generator",
        "sandbox": { "mode": "all" }
      }
    ]
  },
  "broadcast": {
    "strategy": "parallel",
    "120363403215116621@g.us": ["code-reviewer", "security-auditor", "docs-generator"],
    "120363424282127706@g.us": ["support-en", "support-de"],
    "+15555550123": ["assistant", "logger"]
  }
}
```

## 工作原理

### 消息流程

1. **收到的消息**到达 WhatsApp 群组
2. **广播检查**：系统检查 peer ID 是否在 `broadcast` 中
3. **如果在广播列表中**：
   - 所有列出的 agent 处理消息
   - 每个 agent 有自己的 session key 和隔离的上下文
   - Agent 并行（默认）或顺序处理
4. **如果不在广播列表中**：
   - 应用正常路由（第一个匹配的绑定）

注意：广播群组不会绕过频道白名单或群组激活规则（提及/命令/等）。它们仅改变消息符合处理条件时*运行哪些 agent*。

### Session 隔离

广播群组中的每个 agent 保持完全独立的：

- **Session keys**（`agent:alfred:whatsapp:group:120363...` vs `agent:baerbel:whatsapp:group:120363...`)
- **对话历史**（agent 不看到其他 agent 的消息）
- **Workspace**（如配置，独立沙箱）
- **工具访问**（不同的允许/拒绝列表）
- **记忆/上下文**（独立的 IDENTITY.md、SOUL.md 等）
- **群组上下文缓冲**（用于上下文的最近群组消息）按 peer 共享，所以所有广播 agent 在触发时看到相同的上下文

这允许每个 agent 有：

- 不同的人格
- 不同的工具访问（如只读 vs读写）
- 不同的模型（如 opus vs sonnet)
- 安装不同的技能

### 示例：隔离的 Sessions

在群组 `120363403215116621@g.us` 中，agent 为 `["alfred", "baerbel"]`：

**Alfred 的上下文：**

```
Session: agent:alfred:whatsapp:group:120363403215116621@g.us
History: [user message, alfred's previous responses]
Workspace: /Users/user/openclaw-alfred/
Tools: read, write, exec
```

**Bärbel 的上下文：**

```
Session: agent:baerbel:whatsapp:group:120363403215116621@g.us
History: [user message, baerbel's previous responses]
Workspace: /Users/user/openclaw-baerbel/
Tools: read only
```

## 最佳实践

### 1. 保持 Agent 专注

为每个 agent 设计单一、明确的职责：

```json
{
  "broadcast": {
    "DEV_GROUP": ["formatter", "linter", "tester"]
  }
}
```

✅ **好的：** 每个 agent 有一个职责  
❌ **差的：** 一个通用的"dev-helper" agent

### 2. 使用描述性名称

清楚表明每个 agent 的功能：

```json
{
  "agents": {
    "security-scanner": { "name": "Security Scanner" },
    "code-formatter": { "name": "Code Formatter" },
    "test-generator": { "name": "Test Generator" }
  }
}
```

### 3. 配置不同的工具访问

只给 agent 需要的工具：

```json
{
  "agents": {
    "reviewer": {
      "tools": { "allow": ["read", "exec"] } // 只读
    },
    "fixer": {
      "tools": { "allow": ["read", "write", "edit", "exec"] } // 读写
    }
  }
}
```

### 4. 监控性能

有多个 agent 时，考虑：

- 使用 `"strategy": "parallel"`（默认）以提高速度
- 将广播群组限制为 5-10 个 agent
- 为简单 agent 使用更快的模型

### 5. 优雅处理失败

Agent 独立失败。一个 agent 的错误不会阻止其他 agent：

```
消息 → [Agent A ✓, Agent B ✗ error, Agent C ✓]
结果：Agent A 和 C 响应，Agent B 记录错误
```

## 兼容性

### 提供者

广播群组目前支持：

- ✅ WhatsApp（已实现）
- 🚧 Telegram（计划中）
- 🚧 Discord（计划中）
- 🚧 Slack（计划中）

### 路由

广播群组与现有路由一起工作：

```json
{
  "bindings": [
    {
      "match": { "channel": "whatsapp", "peer": { "kind": "group", "id": "GROUP_A" } },
      "agentId": "alfred"
    }
  ],
  "broadcast": {
    "GROUP_B": ["agent1", "agent2"]
  }
}
```

- `GROUP_A`：仅 alfred 响应（正常路由）
- `GROUP_B`：agent1 和 agent2 都响应（广播）

**优先级：** `broadcast` 优先于 `bindings`。

## 故障排除

### Agent 不响应

**检查：**

1. Agent IDs 存在于 `agents.list`
2. Peer ID 格式正确（如 `120363403215116621@g.us`)
3. Agent 未在拒绝列表中

**调试：**

```bash
tail -f ~/.openclaw/logs/gateway.log | grep broadcast
```

### 仅一个 Agent 响应

**原因：** Peer ID 可能在 `bindings` 中但不在 `broadcast` 中。

**修复：** 添加到广播配置或从 bindings 中移除。

### 性能问题

**如果多个 agent 时变慢：**

- 减少每群组的 agent 数量
- 使用更轻的模型（sonnet 代替 opus)
- 检查沙箱启动时间

## 示例

### 示例 1：代码审查团队

```json
{
  "broadcast": {
    "strategy": "parallel",
    "120363403215116621@g.us": [
      "code-formatter",
      "security-scanner",
      "test-coverage",
      "docs-checker"
    ]
  },
  "agents": {
    "list": [
      {
        "id": "code-formatter",
        "workspace": "~/agents/formatter",
        "tools": { "allow": ["read", "write"] }
      },
      {
        "id": "security-scanner",
        "workspace": "~/agents/security",
        "tools": { "allow": ["read", "exec"] }
      },
      {
        "id": "test-coverage",
        "workspace": "~/agents/testing",
        "tools": { "allow": ["read", "exec"] }
      },
      { "id": "docs-checker", "workspace": "~/agents/docs", "tools": { "allow": ["read"] } }
    ]
  }
}
```

**用户发送：** 代码片段  
**响应：**

- code-formatter："修复了缩进并添加了类型提示"
- security-scanner："⚠️ 第 12 行有 SQL 注入漏洞"
- test-coverage："覆盖率是 45%，缺少错误情况测试"
- docs-checker："函数 `process_data` 缺少文档字符串"

### 示例 2：多语言支持

```json
{
  "broadcast": {
    "strategy": "sequential",
    "+15555550123": ["detect-language", "translator-en", "translator-de"]
  },
  "agents": {
    "list": [
      { "id": "detect-language", "workspace": "~/agents/lang-detect" },
      { "id": "translator-en", "workspace": "~/agents/translate-en" },
      { "id": "translator-de", "workspace": "~/agents/translate-de" }
    ]
  }
}
```

## API 参考

### 配置 Schema

```typescript
interface OpenClawConfig {
  broadcast?: {
    strategy?: "parallel" | "sequential";
    [peerId: string]: string[];
  };
}
```

### 字段

- `strategy`（可选）：如何处理 agent
  - `"parallel"`（默认）：所有 agent 同时处理
  - `"sequential"`：Agent 按数组顺序处理
- `[peerId]`：WhatsApp 群组 JID、E.164 号码或其他 peer ID
  - 值：应该处理消息的 agent ID 数组

## 限制

1. **最大 agent 数：** 无硬限制，但 10+ 个 agent 可能变慢
2. **共享上下文：** Agent 不看到彼此的响应（设计如此）
3. **消息顺序：** 并行响应可能以任意顺序到达
4. **速率限制：** 所有 agent 计入 WhatsApp 速率限制

## 未来增强

计划功能：

- [ ] 共享上下文模式（agent 看到彼此的响应）
- [ ] Agent 协调（agent 可以互相信号）
- [ ] 动态 agent 选择（根据消息内容选择 agent）
- [ ] Agent 优先级（某些 agent 先于其他响应）

## 参见

- [多 Agent 配置](/tools/multi-agent-sandbox-tools)
- [路由配置](/channels/channel-routing)
- [Session 管理](/concepts/session)
