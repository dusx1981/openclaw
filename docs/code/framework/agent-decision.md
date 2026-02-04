# OpenClaw Agent 决策架构：Tools 与 Skills 选择机制

## 1. 概述

OpenClaw Agent 是一个基于 Pi Agent Protocol 的智能助手运行时，其核心职责是根据用户输入决定：
1. 是否需要调用 **Tools**（工具）执行具体操作
2. 是否需要参考 **Skills**（技能）获取专业领域指导
3. 如何组合使用两者完成复杂任务

本文档深入解析 Agent 如何在运行时做出这些决策。

---

## 2. 核心架构概览

### 2.1 运行时组件关系

```
┌─────────────────────────────────────────────────────────────────────┐
│                        用户消息入口                                    │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   pi-embedded-runner.ts                              │
│  - 构建系统提示词 (system-prompt.ts)                                 │
│  - 加载 Skills 到提示词                                              │
│  - 注入可用 Tools 列表                                               │
│  - 启动 Agent 会话                                                   │
└─────────────────────────────┬───────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  Skills Section  │ │  Tools Registry │ │  Agent (LLM)    │
│  (提示词上下文)   │ │  (可执行函数)    │ │  (决策引擎)      │
└──────────────────┘ └──────────────────┘ └──────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   pi-embedded-subscribe.ts                           │
│  - 处理工具调用事件                                                  │
│  - 执行工具并返回结果                                                │
│  - 格式化流式响应                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 决策发生的三个层面

| 层面 | 描述 | 实现位置 |
|------|------|----------|
| **提示词层面** | 通过系统提示词指导 Agent 何时使用 Skills/Tools | `system-prompt.ts` |
| **工具层面** | 定义具体可执行的操作及其功能描述 | `pi-tools.ts` / `tools/*.ts` |
| **执行层面** | 处理工具调用、管理状态、流式响应 | `pi-embedded-subscribe.ts` |

---

## 3. Skills 在决策中的角色

### 3.1 Skills 本质

Skills **不是可直接执行的代码**，而是**结构化的 prompt 模板**：

```typescript
interface Skill {
  name: string;           // 技能名称
  description: string;     // 简短描述
  prompt: string;         // 核心指导规则
  filePath: string;       // 文件路径（可被 read 工具读取）
  source: string;         // 来源标识
}
```

### 3.2 Skills 如何进入决策流程

**关键文件**：`src/agents/system-prompt.ts` - `buildSkillsSection()` 函数

```typescript
function buildSkillsSection(params: {
  skillsPrompt?: string;
  isMinimal: boolean;
  readToolName: string;
}) {
  if (params.isMinimal) {
    return [];  // 子 agent 模式不包含 skills
  }
  
  const trimmed = params.skillsPrompt?.trim();
  if (!trimmed) {
    return [];
  }
  
  return [
    "## Skills (mandatory)",
    "Before replying: scan <available_skills> <description> entries.",
    // 核心决策指令：技能选择规则
    `- If exactly one skill clearly applies: read its SKILL.md at <location> with \`${params.readToolName}\`, then follow it.`,
    "- If multiple could apply: choose the most specific one, then read/follow it.",
    "- If none clearly apply: do not read any SKILL.md.",
    // 约束：每次只读一个技能
    "Constraints: never read more than one skill up front; only read after selecting.",
    trimmed,
    "",
  ];
}
```

**决策逻辑解读**：

1. **"mandatory"**：Agent 必须扫描可用技能列表
2. **单技能匹配** → 使用 `read` 工具读取技能文件 → 按规则执行
3. **多技能匹配** → 选择最相关的一个 → 读取执行
4. **无匹配** → 不读取任何技能，直接回复
5. **约束** → 每次只预读一个技能，避免信息过载

### 3.3 Skills 提示词构建流程

```typescript
// src/agents/skills/workspace.ts
function buildWorkspaceSkillsPrompt(workspaceDir: string): string {
  const entries = loadSkillEntries(workspaceDir);
  const eligible = filterSkillEntries(entries, config);
  
  // 技能按优先级合并（workspace > managed > bundled > extra）
  const resolvedSkills = eligible.map((entry) => entry.skill);
  
  // 格式化为 <available_skills> 区块
  return formatSkillsForPrompt(resolvedSkills);
}
```

**生成的 Skills 区块示例**：

```
## Skills (mandatory)
Before replying: scan <available_skills> <description> entries.
- If exactly one skill clearly applies: read its SKILL.md at <location> with `read`, then follow it.
- If multiple could apply: choose the most specific one, then read/follow it.
- If none clearly apply: do not read any SKILL.md.
Constraints: never read more than one skill up front; only read after selecting.

<available_skills>
<skill>
<name>web-developer</name>
<description>Expert web developer with focus on accessibility</description>
<location>/workspace/skills/web-developer/SKILL.md</location>
</skill>
<skill>
<name>database-expert</name>
<description>SQL and NoSQL database specialist</description>
<location>/workspace/skills/database-expert/SKILL.md</location>
</skill>
</available_skills>
```

---

## 4. Tools 在决策中的角色

### 4.1 Tools 本质

Tools 是**可直接执行的函数**，具有：

```typescript
interface AgentTool {
  name: string;           // 工具名称（LLM 调用标识）
  description: string;     // 功能描述（LLM 决策依据）
  parameters: Type;       // 参数 schema
  execute: (args) => Promise<AgentToolResult>;  // 实现
}
```

### 4.2 Tools 如何注册到 Agent

**核心入口**：`src/agents/pi-tools.ts` - `createOpenClawCodingTools()`

```typescript
function createOpenClawCodingTools(options?: {
  sandbox?: SandboxContext;
  config?: OpenClawConfig;
  modelProvider?: string;
  groupId?: string;
  // ...更多上下文
}): AnyAgentTool[] {
  // 1. 基础编码工具
  const base = [
    createReadTool(workspaceRoot),
    createWriteTool(workspaceRoot),
    createEditTool(workspaceRoot),
    // ...
  ];
  
  // 2. 执行工具
  const execTool = createExecTool({ ... });
  
  // 3. Web 工具
  const webFetchTool = createWebFetchTool({ ... });
  const webSearchTool = createWebSearchTool({ ... });
  
  // 4. 消息工具
  const messageTool = createMessageTool({ ... });
  
  // 5. 会话工具
  const sessionsSendTool = createSessionsSendTool({ ... });
  const sessionsSpawnTool = createSessionsSpawnTool({ ... });
  
  // 6. 浏览器工具
  const browserTool = createBrowserTool({ ... });
  
  // 7. 工具策略过滤
  const filtered = filterToolsByPolicy(tools, effectivePolicy);
  
  // 8. 返回给 Agent
  return filtered;
}
```

### 4.3 Tools 描述注入系统提示词

**关键文件**：`src/agents/system-prompt.ts` - 工具描述构建

```typescript
function buildAgentSystemPrompt(params: {
  toolNames?: string[];
  toolSummaries?: Record<string, string>;
  // ...
}) {
  const coreToolSummaries = {
    read: "Read file contents",
    write: "Create or overwrite files",
    edit: "Make precise edits to files",
    exec: "Run shell commands",
    web_search: "Search the web (Brave API)",
    web_fetch: "Fetch and extract readable content from a URL",
    browser: "Control web browser",
    message: "Send messages and channel actions",
    sessions_spawn: "Spawn a sub-agent session",
    // ...
  };
  
  // 构建工具列表（按优先级排序）
  const toolOrder = [
    "read", "write", "edit", "apply_patch",
    "grep", "find", "ls",
    "exec", "process",
    "web_search", "web_fetch", "browser",
    "message", "gateway",
    "sessions_list", "sessions_history", "sessions_send", "sessions_spawn",
  ];
  
  const toolLines = enabledTools.map((tool) => {
    const summary = coreToolSummaries[tool] ?? externalToolSummaries.get(tool);
    return summary ? `- ${tool}: ${summary}` : `- ${tool}`;
  });
  
  return [
    "## Tooling",
    "Tool availability (filtered by policy):",
    ...toolLines,
    // ...
  ];
}
```

### 4.4 工具分类与决策上下文

| 类别 | 工具 | 触发场景 |
|------|------|----------|
| **文件操作** | read, write, edit | 文件读写、代码修改 |
| **命令执行** | exec, process | 系统命令、后台进程 |
| **网络操作** | web_search, web_fetch, browser | 信息检索、网页交互 |
| **消息发送** | message, message_send | 跨会话通信 |
| **会话管理** | sessions_spawn, sessions_send | 子 agent 创建 |
| **媒体处理** | image, canvas | 图片分析 |
| **任务调度** | cron | 定时任务 |

---

## 5. Agent 决策流程详解

### 5.1 决策时序图

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  User Input │────▶│   Agent     │────▶│  Decision   │
│             │     │  (LLM)      │     │  Point      │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │ 1. Match   │ │ 2. Use Tool │ │ 3. Direct  │
    │  Skill?    │ │             │ │  Response   │
    └──────┬──────┘ └──────┬──────┘ └─────────────┘
           │               │
           ▼               ▼
    ┌─────────────┐ ┌─────────────┐
    │ read Skill │ │ Call Tool   │
    │ & Follow   │ │ → Execute   │
    └──────┬──────┘ └──────┬──────┘
           │               │
           │               ▼
           │        ┌─────────────┐
           │        │ Return      │
           │        │ Result      │
           │        └──────┬──────┘
           │               │
           └───────────────┼───────────────┐
                           ▼
                    ┌─────────────┐
                    │ Agent       │
                    │ Synthesizes │
                    │ Response    │
                    └─────────────┘
```

### 5.2 决策点 1：是否需要 Skills

**系统提示词指令**：

```
Before replying: scan <available_skills> <description> entries.
- If exactly one skill clearly applies: read its SKILL.md
- If multiple could apply: choose the most specific one
- If none clearly apply: do not read any SKILL.md
```

**Agent 推理过程**（伪代码）：

```typescript
function shouldUseSkill(userInput: string, availableSkills: Skill[]): Skill | null {
  // 1. 扫描所有技能描述
  const matches = availableSkills.filter(skill => {
    const description = skill.description.toLowerCase();
    // 2. 检查用户输入是否匹配技能领域
    return userInput.toLowerCase().includes(description) ||
           description.includes(keywordFrom(userInput));
  });
  
  // 3. 决策
  if (matches.length === 0) {
    return null;  // 不需要技能
  } else if (matches.length === 1) {
    return matches[0];  // 单技能匹配 → 读取使用
  } else {
    // 多技能 → 选择最相关的一个
    return selectMostSpecific(matches, userInput);
  }
}
```

### 5.3 决策点 2：是否需要 Tools

**系统提示词指令**：

```
Tool availability (filtered by policy):
- read: Read file contents
- exec: Run shell commands
- web_search: Search the web
- message: Send messages
...
```

**Agent 推理过程**：

```typescript
function shouldUseTool(task: string): Tool | null {
  // 基于任务类型匹配工具
  if (task.startsWith("search the web for") || task.includes("find information about")) {
    return { name: "web_search", params: { query: extractQuery(task) } };
  }
  
  if (task.startsWith("run") || task.includes("execute command")) {
    return { name: "exec", params: { cmd: extractCommand(task) } };
  }
  
  if (task.includes("read file")) {
    return { name: "read", params: { path: extractPath(task) } };
  }
  
  if (task.includes("send message")) {
    return { name: "message", params: { text: extractMessage(task) } };
  }
  
  // ... 更多任务类型映射
  
  return null;  // 不需要工具
}
```

### 5.4 组合决策示例

**用户输入**：
```
Create a REST API endpoint for user registration and notify me on Telegram
```

**Agent 决策过程**：

```
Step 1: 检查 Skills
├── 扫描 <available_skills>
├── 匹配: "web-developer" (web API 开发)
├── 决策: 读取 /workspace/skills/web-developer/SKILL.md
└── 遵循技能规则进行开发

Step 2: 确定 Tools 需求
├── 需要创建文件: read → write (文件操作)
├── 需要测试 API: exec (curl 测试)
├── 需要发送通知: message (Telegram 消息)

Step 3: 执行计划
├── 1. read skill file
├── 2. write API code
├── 3. exec test command
└── 4. message notification
```

---

## 6. 工具调用处理机制

### 6.1 工具调用生命周期

**文件**：`src/agents/pi-embedded-subscribe.ts`

```typescript
// 工具调用事件处理
function createEmbeddedPiSessionEventHandler(ctx: SubscribeContext) {
  return {
    onToolInvocation(params) {
      // 1. 接收工具调用
      const { toolName, toolCallId, input } = params;
      
      // 2. 查找工具
      const tool = findTool(toolName);
      
      // 3. 执行工具
      const result = await tool.execute(input);
      
      // 4. 返回结果
      return {
        toolCallId,
        content: result.content,
      };
    },
    
    onTextDelta(params) {
      // 处理流式文本
    },
  };
}
```

### 6.2 工具结果处理

```typescript
async function handleToolResult(toolResult: AgentToolResult) {
  // 1. 格式化结果
  const formatted = formatToolOutput(toolResult);
  
  // 2. 过滤敏感信息
  const sanitized = sanitizeResult(formatted);
  
  // 3. 注入到 Agent 上下文
  return injectIntoContext(sanitized);
}
```

---

## 7. 策略过滤机制

### 7.1 多层策略系统

```typescript
// 策略优先级（从高到低）
const policies = [
  profilePolicy,           // CLI profile 级别
  providerProfilePolicy,   // provider profile 级别
  globalPolicy,           // 全局级别
  agentPolicy,            // agent 配置级别
  groupPolicy,            // 群组级别
  sandboxPolicy,          // 沙箱配置级别
  subagentPolicy,         // 子 agent 级别
];

function filterTools(tools: AnyAgentTool[], policies: ToolPolicy[]): AnyAgentTool[] {
  let filtered = tools;
  
  for (const policy of policies) {
    filtered = filterToolsByPolicy(filtered, policy);
  }
  
  return filtered;
}
```

### 7.2 策略如何影响决策

```yaml
# config.json 示例
tools:
  # 全局策略
  allow: ["read", "write", "exec"]
  deny: ["*"]
  
  # Agent 特定策略
  agents:
    my-agent:
      tools:
        allow: ["read", "write"]  # 禁用 exec
```

**决策影响**：Agent 看到可用工具列表被过滤后，会调整其执行计划。

---

## 8. 子 Agent 场景的决策隔离

### 8.1 子 Agent 模式（minimal prompt）

```typescript
function buildAgentSystemPrompt(params: {
  promptMode?: "full" | "minimal" | "none";
}) {
  const isMinimal = params.promptMode === "minimal";
  
  if (isMinimal) {
    // 子 agent：禁用 Skills
    const skillsSection = buildSkillsSection({ isMinimal: true });
    
    // 子 agent：只保留核心工具
    const toolLines = [
      "read", "write", "exec", "web_fetch"
    ];
    
    return [...toolLines.join("\n")];
  }
  
  // 主 agent：完整功能
  return fullPrompt;
}
```

### 8.2 隔离效果

| 模式 | Skills | 可用工具 | 用途 |
|------|--------|----------|------|
| **full** | 启用 | 全部 | 主会话 |
| **minimal** | 禁用 | 核心子集 | 子 agent |
| **none** | 禁用 | 极少 | 极简场景 |

---

## 9. 技能命令直接调用

### 9.1 `/command` 映射到工具

**技能可以定义命令分派**：

```yaml
---
command-dispatch: tool
command-tool: sessions_spawn
command-arg-mode: raw
description: Database expert
---
```

**执行流程**：

```
用户输入: /db-expert "optimize this query"
    │
    ▼
路由到 Skill Command Dispatch
    │
    ▼
调用工具: sessions_spawn
参数: { message: "optimize this query", agentId: "db-expert" }
    │
    ▼
创建新会话 → Agent 执行
```

---

## 10. 完整决策流程图

```
                                    ┌─────────────────┐
                                    │   用户消息输入    │
                                    └────────┬────────┘
                                             │
                                             ▼
                              ┌────────────────────────┐
                              │   加载系统提示词         │
                              │   + Skills 区块         │
                              │   + Tools 列表           │
                              └────────┬───────────────┘
                                       │
                                       ▼
                    ┌────────────────────────────────────┐
                    │         Agent (LLM) 推理           │
                    │  1. 扫描 Skills 描述                │
                    │  2. 评估 Tools 可用性                │
                    │  3. 规划执行策略                    │
                    └────────────────┬───────────────────┘
                                     │
           ┌──────────────────────────┼──────────────────────────┐
           ▼                          ▼                          ▼
    ┌─────────────┐           ┌─────────────┐           ┌─────────────┐
    │  需要 Skills │           │  需要 Tools │           │  直接回复    │
    └──────┬──────┘           └──────┬──────┘           └─────────────┘
           │                          │
           ▼                          ▼
    ┌─────────────┐           ┌─────────────┐
    │ read skill  │           │ call tool   │
    │ & follow    │           │ → execute   │
    └──────┬──────┘           └──────┬──────┘
           │                          │
           └───────────┬──────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  工具结果注入    │
              │  → 继续推理     │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  生成最终回复     │
              └─────────────────┘
```

---

## 11. 关键代码索引

| 功能 | 文件路径 | 关键函数/类 |
|------|----------|-------------|
| Agent 执行器 | `src/agents/pi-embedded-runner.ts` | `runEmbeddedPiAgent()` |
| 事件订阅 | `src/agents/pi-embedded-subscribe.ts` | `createEmbeddedPiSessionEventHandler()` |
| 系统提示词 | `src/agents/system-prompt.ts` | `buildAgentSystemPrompt()` |
| 技能提示构建 | `src/agents/system-prompt.ts` | `buildSkillsSection()` |
| 技能加载 | `src/agents/skills/workspace.ts` | `loadSkillEntries()`, `buildWorkspaceSkillsPrompt()` |
| 工具创建 | `src/agents/pi-tools.ts` | `createOpenClawCodingTools()` |
| 工具策略 | `src/agents/pi-tools/policy.ts` | `filterToolsByPolicy()` |

---

## 12. 总结

OpenClaw Agent 的决策架构遵循以下原则：

1. **分离关注点**：Skills 提供上下文指导，Tools 提供执行能力
2. **LLM 驱动决策**：通过精心设计的系统提示词引导 Agent 做出正确选择
3. **渐进式执行**：工具调用结果注入上下文，支持多轮推理
4. **策略保护**：多层策略过滤确保安全边界
5. **模式隔离**：主/子 Agent 采用不同提示词策略
