# 每个 ADK 开发者都应该知道的 5 种 Agent Skill 设计模式

掌握 Google ADK agents 的 5 种 SKILL.md 设计模式——Tool Wrapper、Generator、Reviewer、Inversion、Pipeline。包含可运行的代码和决策树。

## 概述

**ADK skill 设计模式**是组织 SKILL.md 文件的可复用结构模板——这种基于 Markdown 的指令格式告诉 Google ADK agents 如何使用工具、生成内容或编排多步骤工作流。

Agent Skills 规范定义了容器——SKILL.md frontmatter、`references/`、`assets/`、`scripts/` 目录——但没有说明内部应该放什么。这是一个内容设计问题，而不是格式问题。

五种模式不断出现。本文将命名最实用的五种，展示每种模式在 ADK 中的工作代码，并帮助你为用例选择正确的模式。

---

## 核心要点

- **Tool Wrapper** —— 类似于库的速查表；让 agent 仅在相关时应用其约定
- **Generator** —— 类似于 agent 填写的表单；每次都生成一致的结构化文档
- **Reviewer** —— 类似于评分标准；根据检查清单对提交的代码进行评分，按严重程度分组
- **Inversion** —— agent 先采访你；在产生任何输出之前提出结构化问题
- **Pipeline** —— 类似于需要签收的配方；强制执行严格的逐步工作流，确保不会跳过任何步骤
- 这五种模式可以**组合**——Pipeline 可以包含 Reviewer 步骤；Generator 可以使用 Inversion 收集输入

---

## SKILL.md 格式速览

Agent Skills 标准已被 30+ agent 工具采用——Claude Code、Gemini CLI、GitHub Copilot、Cursor 等。每个 skill 都遵循相同的目录结构：

```
skill-name/
├── SKILL.md          ← YAML frontmatter + markdown 指令（必需）
├── references/       ← 样式指南、检查清单、约定（可选）
├── assets/           ← 模板和输出格式（可选）
└── scripts/          ← 可执行脚本（可选）
```

---

## SkillToolset 与三个层级

ADK 的 `SkillToolset` 通过三个自动生成的工具实现渐进式披露：

- `list_skills` —— 显示 skill 名称和描述（L1）
- `load_skill` —— 获取完整指令（L2）
- `load_skill_resource` —— 按需加载参考文件和模板（L3）

agent 在启动时为每个 skill 支付约 100 tokens，然后仅在需要时加载其余内容。

---

## 模式 1：Tool Wrapper —— 教 Agent 学习一个库

### 定义

**Tool Wrapper** 是一种 agent skill，将库或工具的约定、最佳实践和编码标准打包成按需知识，当 agent 使用该技术时加载。这是最简单的 SKILL.md 模式——只有指令加参考文件，没有模板或脚本。

### 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    Tool Wrapper 模式                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   用户请求                                                       │
│      │                                                          │
│      ▼                                                          │
│   ┌─────────────┐                                               │
│   │ SKILL.md    │ ← 触发关键词：FastAPI、REST APIs、Pydantic    │
│   │ (指令)      │                                               │
│   └──────┬──────┘                                               │
│          │                                                      │
│          ▼                                                      │
│   ┌─────────────────────┐                                       │
│   │ references/         │                                       │
│   │ conventions.md      │ ← 库的详细约定文档                     │
│   └─────────────────────┘                                       │
│          │                                                      │
│          ▼                                                      │
│   Agent 应用规则作为领域专业知识                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 示例代码

```yaml
# skills/api-expert/SKILL.md
---
name: api-expert
description: FastAPI 开发最佳实践和约定。用于构建、审查或调试 FastAPI 应用、REST APIs 或 Pydantic 模型时。
metadata:
  pattern: tool-wrapper
  domain: fastapi
---

你是 FastAPI 开发专家。将这些约定应用到用户的代码或问题中。

## 核心约定

加载 'references/conventions.md' 获取完整的 FastAPI 最佳实践列表。

## 审查代码时
1. 加载约定参考
2. 根据每个约定检查用户的代码
3. 对于每个违规，引用具体规则并建议修复

## 编写代码时
1. 加载约定参考
2. 严格遵循每个约定
3. 为所有函数签名添加类型注解
4. 使用 Annotated 风格进行依赖注入
```

### 何时使用 Tool Wrapper

当你希望 agent 为特定库、SDK 或内部系统应用一致的、专家级约定时。这是最广泛采用的模式：

- **Vercel `react-best-practices`** —— 40+ React 和 Next.js 性能规则
- **Supabase `supabase-postgres-best-practices`** —— Postgres 优化指南
- **Google `gemini-api-dev`** —— Gemini API 官方 Tool Wrapper
- **Google `adk-core_skills`** —— Google 官方 ADK 开发技能

---

## 模式 2：Generator —— 生成结构化输出

### 定义

**Generator** skill 通过填充可复用模板来生成文档、报告或配置。与 Tool Wrapper 不同，它使用两个可选目录：`assets/` 保存输出模板（要填写的结构），`references/` 保存样式指南（要遵循的质量规则）。

### 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    Generator 模式                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   用户请求："写一份报告"                                          │
│      │                                                          │
│      ▼                                                          │
│   ┌─────────────┐                                               │
│   │ SKILL.md    │ ← 编排流程                                     │
│   │ (指令)      │                                               │
│   └──────┬──────┘                                               │
│          │                                                      │
│     ┌────┴────┐                                                 │
│     ▼         ▼                                                 │
│   ┌─────────────┐  ┌─────────────────┐                         │
│   │references/  │  │assets/          │                         │
│   │style-guide  │  │report-template  │                         │
│   │.md         │  │.md              │                         │
│   │(质量规则)  │  │(输出模板)        │                         │
│   └─────────────┘  └─────────────────┘                         │
│          │                │                                     │
│          └───────┬────────┘                                     │
│                  ▼                                              │
│         填充模板，遵循样式指南                                     │
│                  │                                              │
│                  ▼                                              │
│         结构化的 Markdown 报告                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 示例代码

```yaml
# skills/report-generator/SKILL.md
---
name: report-generator
description: 生成结构化的 Markdown 技术报告。用于用户要求编写、创建或起草报告、摘要或分析文档时。
metadata:
  pattern: generator
  output-format: markdown
---

你是技术报告生成器。严格按以下步骤执行：

步骤 1：加载 'references/style-guide.md' 获取语气和格式规则。

步骤 2：加载 'assets/report-template.md' 获取所需的输出结构。

步骤 3：询问用户填充模板所需的任何缺失信息：
- 主题或题目
- 关键发现或数据点
- 目标受众（技术、高管、普通）

步骤 4：按照样式指南规则填充模板。模板中的每个部分都必须出现在输出中。

步骤 5：将完成的报告作为单个 Markdown 文档返回。
```

### 何时使用 Generator

当输出每次都需要遵循固定结构时——一致性比创造性更重要：

- **技术报告** —— 执行摘要、方法论、发现、建议
- **API 文档** —— 每个端点都有相同的章节
- **提交消息** —— 强制执行 Conventional Commits 格式
- **ADK agent 脚手架** —— 生成标准项目结构

---

## 模式 3：Reviewer —— 根据标准评估

### 定义

**Reviewer** skill 根据 `references/` 中存储的检查清单评估代码、内容或工件，生成按严重程度分组的评分发现报告。关键设计洞察：将检查内容（检查清单文件）与检查方式（指令中的审查协议）分离。

### 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    Reviewer 模式                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   用户提交代码                                                   │
│      │                                                          │
│      ▼                                                          │
│   ┌─────────────┐                                               │
│   │ SKILL.md    │ ← 审查协议                                     │
│   │ (指令)      │                                               │
│   └──────┬──────┘                                               │
│          │                                                      │
│          ▼                                                      │
│   ┌─────────────────────┐                                       │
│   │ references/         │                                       │
│   │ review-checklist.md │ ← 检查规则                             │
│   └─────────────────────┘                                       │
│          │                                                      │
│          ▼                                                      │
│   ┌─────────────────────────────────────────────────┐          │
│   │ 输出：评分报告                                   │          │
│   │ ─────────────────                              │          │
│   │ • 摘要：代码功能，整体质量评估                   │          │
│   │ • 发现：按严重程度分组                          │          │
│   │   - ERROR（必须修复）                           │          │
│   │   - WARNING（应该修复）                         │          │
│   │   - INFO（建议考虑）                            │          │
│   │ • 评分：1-10 分及简要理由                       │          │
│   │ • 前 3 建议：最有影响力的改进                   │          │
│   └─────────────────────────────────────────────────┘          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 示例代码

```yaml
# skills/code-reviewer/SKILL.md
---
name: code-reviewer
description: 审查 Python 代码的质量、风格和常见 bug。用于用户提交代码审查、请求代码反馈或想要代码审计时。
metadata:
  pattern: reviewer
  severity-levels: error,warning,info
---

你是 Python 代码审查员。严格按以下审查协议执行：

步骤 1：加载 'references/review-checklist.md' 获取完整的审查标准。

步骤 2：仔细阅读用户的代码。在批评之前理解其目的。

步骤 3：将检查清单中的每条规则应用到代码。对于发现的每个违规：
- 记录行号（或大致位置）
- 分类严重程度：error（必须修复）、warning（应该修复）、info（建议考虑）
- 解释为什么这是个问题，而不仅仅是哪里有问题
- 用修正后的代码建议具体修复

步骤 4：生成结构化的审查报告，包含以下部分：
- **摘要**：代码功能，整体质量评估
- **发现**：按严重程度分组（先 error，后 warning，再 info）
- **评分**：1-10 分及简要理由
- **前 3 建议**：最有影响力的改进
```

### 何时使用 Reviewer

任何人类审查员使用检查清单的地方——Reviewer skill 可以编码并一致地应用：

- **代码审查** —— 根据团队风格规则捕获可变默认参数、缺少类型提示、裸 `except:`
- **安全审计** —— 对提交的代码运行 OWASP Top 10 检查
- **编辑审查** —— 根据内部样式指南检查博客文章或文档
- **ADK agent 审查** —— 根据团队的 `google-adk-conventions` 验证新 agent

---

## 模式 4：Inversion —— Skill 采访你

### 定义

**Inversion** 翻转典型的 agent 交互：不是用户驱动对话，而是 skill 指示 agent 在产生任何输出之前通过定义的阶段提出结构化问题。agent 在收集到所有需要的信息之前不会行动。

### 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    Inversion 模式                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   用户："我想构建一个系统"                                        │
│      │                                                          │
│      ▼                                                          │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │ 阶段 1：问题发现（一次问一个问题，等待每个回答）          │  │
│   │ ───────────────────────────────────────────────────────│  │
│   │ Q1: "这个项目为用户解决什么问题？"                       │  │
│   │ [等待回答]                                               │  │
│   │ Q2: "主要用户是谁？他们的技术水平如何？"                  │  │
│   │ [等待回答]                                               │  │
│   │ Q3: "预期规模是多少？"                                   │  │
│   │ [等待回答]                                               │  │
│   └─────────────────────────────────────────────────────────┘  │
│                         │                                       │
│                         ▼                                       │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │ 阶段 2：技术约束（仅在阶段 1 完全回答后）                 │  │
│   │ ───────────────────────────────────────────────────────│  │
│   │ Q4: "你将使用什么部署环境？"                             │  │
│   │ [等待回答]                                               │  │
│   │ Q5: "有什么技术栈要求或偏好吗？"                         │  │
│   │ [等待回答]                                               │  │
│   │ Q6: "有哪些不可协商的需求？"                             │  │
│   │ [等待回答]                                               │  │
│   └─────────────────────────────────────────────────────────┘  │
│                         │                                       │
│                         ▼                                       │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │ 阶段 3：综合（所有问题回答后）                            │  │
│   │ ───────────────────────────────────────────────────────│  │
│   │ 1. 加载模板                                              │  │
│   │ 2. 使用收集的需求填充每个部分                            │  │
│   │ 3. 向用户展示完成的计划                                   │  │
│   │ 4. 迭代直到用户确认                                       │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 示例代码

```yaml
# skills/project-planner/SKILL.md
---
name: project-planner
description: 通过结构化问题收集需求来规划新软件项目。用于用户说"我想构建"、"帮我规划"、"设计一个系统"或"开始一个新项目"时。
metadata:
  pattern: inversion
  interaction: multi-turn
---

你正在进行结构化的需求访谈。在所有阶段完成之前，不要开始构建或设计。

## 阶段 1 —— 问题发现（一次问一个问题，等待每个回答）

按顺序问这些问题。不要跳过任何问题。

- Q1: "这个项目为用户解决什么问题？"
- Q2: "主要用户是谁？他们的技术水平如何？"
- Q3: "预期规模是多少？（日活用户、数据量、请求率）"

## 阶段 2 —— 技术约束（仅在阶段 1 完全回答后）

- Q4: "你将使用什么部署环境？"
- Q5: "有什么技术栈要求或偏好吗？"
- Q6: "有哪些不可协商的需求？（延迟、正常运行时间、合规性、预算）"

## 阶段 3 —— 综合（所有问题回答后）

1. 加载 'assets/plan-template.md' 获取输出格式
2. 使用收集的需求填充模板的每个部分
3. 向用户展示完成的计划
4. 问："这个计划是否准确反映了你的需求？你想改变什么？"
5. 根据反馈迭代直到用户确认
```

### 何时使用 Inversion

agent 在做有用工作之前需要用户上下文的任何地方——它防止最常见的 agent 失败模式：基于假设而不是提问生成详细计划：

- **需求收集** —— 在产生技术设计之前采访用户
- **诊断访谈** —— 在建议修复之前走完结构化故障排除检查清单
- **配置向导** —— 在生成基础设施配置之前收集部署偏好
- **ADK agent 设计** —— 在脚手架新 agent 之前采访用户

---

## 模式 5：Pipeline —— 强制执行多步骤工作流

### 定义

**Pipeline** skill 定义顺序工作流，每个步骤必须在下一个步骤开始之前完成，并有明确的门控条件防止 agent 跳过验证。这是最复杂的模式——使用所有三个可选目录（`references/`、`assets/`、`scripts/`）并在步骤之间添加控制流。

### 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    Pipeline 模式                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   输入：Python 源代码                                           │
│      │                                                          │
│      ▼                                                          │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │ 步骤 1：解析与清单                                        │  │
│   │ ──────────────────                                       │  │
│   │ • 提取所有公共类、函数、常量                              │  │
│   │ • 以检查清单形式展示清单                                  │  │
│   │ • 问："这是你想文档化的完整公共 API 吗？"                 │  │
│   └─────────────────────────────────────────────────────────┘  │
│                         │                                       │
│                    用户确认？                                    │
│                         ▼                                       │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │ 步骤 2：生成 Docstrings                                   │  │
│   │ ────────────────────────                                 │  │
│   │ • 加载 references/docstring-style.md                     │  │
│   │ • 为每个缺少 docstring 的函数生成 docstring              │  │
│   │ • 展示每个生成的 docstring 供用户批准                    │  │
│   │ • 在用户确认前不要进入步骤 3                              │  │
│   └─────────────────────────────────────────────────────────┘  │
│                         │                                       │
│                    用户确认？                                    │
│                         ▼                                       │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │ 步骤 3：组装文档                                          │  │
│   │ ──────────────────                                       │  │
│   │ • 加载 assets/api-doc-template.md                        │  │
│   │ • 编译所有类、函数、docstrings                           │  │
│   │ • 生成单个 API 参考文档                                   │  │
│   └─────────────────────────────────────────────────────────┘  │
│                         │                                       │
│                         ▼                                       │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │ 步骤 4：质量检查                                          │  │
│   │ ──────────────────                                       │  │
│   │ • 加载 references/quality-checklist.md                   │  │
│   │ • 检查：每个公共符号都有文档                              │  │
│   │ • 检查：每个参数都有类型和描述                            │  │
│   │ • 检查：每个函数至少有一个使用示例                        │  │
│   │ • 修复问题后展示最终文档                                  │  │
│   └─────────────────────────────────────────────────────────┘  │
│                         │                                       │
│                         ▼                                       │
│   输出：完整的 API 文档                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 示例代码

```yaml
# skills/doc-pipeline/SKILL.md
---
name: doc-pipeline
description: 通过多步骤流水线从 Python 源代码生成 API 文档。用于用户要求文档化模块、生成 API 文档或从代码创建文档时。
metadata:
  pattern: pipeline
  steps: "4"
---

你正在运行文档生成流水线。按顺序执行每个步骤。如果步骤失败，不要跳过或继续。

## 步骤 1 —— 解析与清单
分析用户的 Python 代码以提取所有公共类、函数和常量。以检查清单形式展示清单。问："这是你想文档化的完整公共 API 吗？"

## 步骤 2 —— 生成 Docstrings
对于每个缺少 docstring 的函数：
- 加载 'references/docstring-style.md' 获取所需格式
- 严格按照样式指南生成 docstring
- 展示每个生成的 docstring 供用户批准
在用户确认之前不要进入步骤 3。

## 步骤 3 —— 组装文档
加载 'assets/api-doc-template.md' 获取输出结构。将所有类、函数和 docstrings 编译成单个 API 参考文档。

## 步骤 4 —— 质量检查
根据 'references/quality-checklist.md' 审查：
- 每个公共符号都有文档
- 每个参数都有类型和描述
- 每个函数至少有一个使用示例
报告结果。在展示最终文档之前修复问题。
```

### 何时使用 Pipeline

步骤有依赖关系且顺序很重要的多步骤流程——如果跳过某个步骤会产生不正确或未验证的输出，就使用 Pipeline：

- **文档生成** —— 解析代码 → 生成 docstrings（用户批准）→ 组装文档 → 质量检查
- **数据处理** —— 验证输入 → 转换 → 丰富 → 写入输出
- **部署工作流** —— 运行测试 → 构建工件 → 部署到 staging → 冒烟测试 → 提升到生产
- **ADK agent 入职** —— 采访用户（Inversion）→ 脚手架文件（Generator）→ 根据约定验证（Reviewer）

---

## 选择正确的 ADK Skill 模式

每种模式回答不同的问题。使用下表找到正确的模式：

| 模式 | 使用场景 | 使用的目录 | 复杂度 |
|------|---------|-----------|--------|
| **Tool Wrapper** | Agent 需要特定库或工具的专家知识 | `references/` | 低 |
| **Generator** | 输出每次都必须遵循固定模板 | `assets/` + `references/` | 中 |
| **Reviewer** | 代码或内容需要根据检查清单评估 | `references/` | 中 |
| **Inversion** | Agent 必须在行动前从用户收集上下文 | `assets/` | 中——多轮 |
| **Pipeline** | 工作流有顺序步骤，步骤之间有验证门控 | `references/` + `assets/` + `scripts/` | 高 |

### 决策树

```
开始
  │
  ▼
需要多步骤工作流且步骤之间有验证？
  │
  ├─ 是 → Pipeline
  │
  └─ 否
       │
       ▼
     Agent 需要在行动前收集用户输入？
       │
       ├─ 是 → Inversion
       │
       └─ 否
            │
            ▼
          输出需要遵循固定模板？
            │
            ├─ 是 → Generator
            │
            └─ 否
                 │
                 ▼
               需要根据检查清单评估代码/内容？
                 │
                 ├─ 是 → Reviewer
                 │
                 └─ 否 → Tool Wrapper
                         （默认：加载约定作为专家知识）
```

---

## 模式组合

模式可以组合：

- **Pipeline + Reviewer** —— doc-pipeline 的步骤 4 是质量审查
- **Generator + Inversion** —— Generator 可以使用 Inversion 在生成输出前收集输入
- **Tool Wrapper + Pipeline** —— Tool Wrapper 可以作为参考文件嵌入 Pipeline skill

arXiv 论文"SoK: Agentic Skills"发现生产系统通常组合 2-3 种模式。

---

## ADK Skills 生态系统

Agent Skills 标准意味着为 Claude Code、Gemini CLI、Cursor 等 30+ 兼容 agent 编写的任何 skill 都可以在 ADK 中加载：

- **skills.sh** —— 最大的社区市场（86,000+ 安装）
- **google-gemini/gemini-skills** —— Google 官方 Gemini API Tool Wrapper skills
- **google/adk-docs/skills** —— Google 官方 ADK 开发技能
- **vercel-labs/agent-skills** —— Vercel 官方 React、Next.js skills
- **supabase/agent-skills** —— Supabase Postgres 优化指南
- **anthropics/skills** —— 生产级文档 skills

---

## ADK Core Skills：Google 官方开发技能

Google 发布官方技能，教编码 agent 如何编写 ADK 代码：

| Skill | 教授内容 |
|-------|---------|
| `adk-dev-guide` | ADK 架构、agent 类型、工具定义、回调 |
| `adk-cheatsheet` | 常见 ADK 任务的快速参考模式 |
| `adk-eval-guide` | 编写和运行 agent 评估 |
| `adk-deploy-guide` | 将 ADK agents 部署到 Cloud Run 和 Vertex AI |
| `adk-observability-guide` | ADK agents 的追踪、日志和监控 |
| `adk-scaffold` | 项目脚手架和目录结构 |

安装所有六个：

```bash
npx skills add google/adk-docs -y -g
```

---

## 常见问题

### 可以在 ADK 中开发的 skills 用于其他编码 agent 吗？

是的——你在 ADK 中开发的 skills 遵循 agentskills.io 规范，与 Gemini CLI、Claude Code、Cursor 使用相同的开放标准。

### 一个 agent 可以有多少 skills？

当前 ADK 版本没有硬性限制。SkillToolset 通过 `process_llm_request()` 在每次 LLM 调用时注入 skill 描述（每个约 100 tokens）。50 个 skills 时，每次调用约 5,000-7,500 tokens 开销。

### 模式可以组合吗？

是的。Pipeline skill 可以包含 Reviewer 步骤。Generator 可以使用 Inversion 收集输入。

### 在哪里存储 skills——项目级还是用户级？

项目级（`<project>/.agents/skills/`）用于团队共享的 skills。用户级（`~/.agents/skills/`）用于跨项目的个人 skills。

### 如何测试 skill 的有效性？

agentskills.io 规范定义了评估方法：在 `evals/evals.json` 中创建测试用例，在有和没有 skill 的情况下运行每个用例，测量通过率差异。

### ADK skills 和 tools 有什么区别？

Tools 给 agents 采取行动的能力——调用 API、读取文件、查询数据库。Skills 教 agents *何时*以及*如何*有效地使用这些工具。一个 tool 是"调用天气 API"。一个 skill 是"当用户询问旅行时，检查每个目的地的天气，比较结果，并格式化为行程单"。

---

## 参考

1. [Skills for ADK Agents](https://google.github.io/adk-docs/skills/) —— SkillToolset 和渐进式披露官方文档
2. [Agent Skills Specification](https://agentskills.io/specification) —— 定义 SKILL.md 格式的开放标准
3. [Part 1: Progressive Disclosure with SkillToolset](/posts/adk-agent-skills-part1/) —— 基础：L1/L2/L3 层级
4. [Part 2: File-Based, External Skills, and SkillToolset Internals](/posts/adk-agent-skills-part2/) —— SKILL.md 格式详解
5. [Part 3: Skills That Write Skills](/posts/adk-agent-skills-part3/) —— Meta-skill 模式
6. [Companion Code Repository](https://github.com/lavinigam-gcp/build-with-adk/tree/main/adk-skill-design-patterns) —— 本文所有五种模式的可运行代码

---

*翻译自：[5 Agent Skill Design Patterns Every ADK Developer Should Know](https://lavinigam.com/posts/adk-skill-design-patterns/) by Lavi Nigam*