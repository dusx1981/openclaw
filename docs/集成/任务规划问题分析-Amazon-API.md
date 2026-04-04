# 任务规划问题分析报告：Amazon API 集成案例

> **文档类型**: 问题分析报告  
> **日期**: 2026-04-03  
> **相关 Change**: fix-p0-storage-and-amazon  
> **问题**: 任务列表过度拆分，忽视现有能力，导致工作量估算错误

---

## 执行摘要

在 Amazon API 集成的任务规划中，我们发现了一个系统性问题：**任务列表与实际能力严重脱节**。

### 问题数据

```
原始任务列表：
├─ Phase 2: 40 tasks
├─ 预估工作量: Day 3-4 (2 天)
└─ 预估代码量: 未明确

修订后任务列表：
├─ Phase 2: 4 tasks (-90%)
├─ 实际工作量: 6 小时 (1 天)
└─ 实际代码量: ≈300 行

差异原因：
├─ 忽视了 amazon-sp-api SDK 已提供的能力 (认证、签名、速率限制)
├─ 忽视了基础设施已实现的能力 (容错系统、降级逻辑、重试策略)
└─ 任务过度拆分 (每步骤独立成任务)
```

### 关键发现

1. **知识沉淀 ≠ 知识使用** - 有文档但未在决策时使用
2. **Spec 应考虑现有能力** - Spec 假设自己实现所有功能
3. **缺少强制检查机制** - 文档是参考，不是强制要求
4. **顺序错误** - 先规划，后沉淀知识（应该反过来）

---

## 问题详情

### 1. 矛盾的事实

```
┌─────────────────────────────────────────────────────────┐
│          已有的知识 vs 实际的使用                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  我拥有的知识：                                          │
│  ✅ INFRASTRUCTURE.md - 基础设施能力地图                │
│  ✅ design.md - 设计文档                                │
│  ✅ proposal.md - 提案文档                              │
│  ✅ Phase 1 实现记录 - 36/38 tasks 已完成               │
│  ✅ TaobaoAdapter 完整实现 - 288 行参考代码             │
│                                                         │
│  但我创建的 Phase 2 任务列表：                           │
│  ❌ 40 tasks - 过度拆分                                 │
│  ❌ 包含 SDK 已提供的功能                               │
│  ❌ 包含基础设施已实现的能力                            │
│  ❌ 忽视了已有的参考实现                                │
│                                                         │
│  矛盾：                                                 │
│  我有知识，但我没有使用知识！                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2. 任务列表的具体问题

#### 问题 2.1: 重复造轮子

```
原任务列表包含：

Section 2.2 SP-API 客户端 (10 tasks)：
├─ 创建 auth/LWAAuth.ts 实现 LWA 认证
├─ 创建 auth/AWSSigner.ts 实现 AWS 签名
├─ 实现令牌刷新逻辑
├─ 实现速率限制处理
└─ 添加错误处理和重试逻辑

事实：
✅ amazon-sp-api SDK 已提供 LWA 认证（自动刷新令牌）
✅ amazon-sp-api SDK 已提供 AWS 签名（AWS4-HMAC-SHA256）
✅ amazon-sp-api SDK 已提供速率限制（自动 throttling）
✅ ErrorClassifier 已配置 Amazon 错误映射
✅ RetryRunner 已提供 createAmazonRetryRunner

结论：这些任务都是重复造轮子！
```

#### 问题 2.2: 忽视基础设施

```
原任务列表包含：

Section 2.5 AmazonAdapter 实现 (9 tasks)：
├─ 添加错误分类和降级逻辑
├─ 实现健康检查方法
├─ 添加速率限制和重试
└─ 添加错误处理

事实：
✅ BasePlatformAdapter 已集成：
   ├─ ErrorClassifier（Amazon 映射已配置）
   ├─ CircuitBreaker（熔断器）
   ├─ DegradationExecutor（降级执行）
   ├─ CooldownManager（冷却管理）
   ├─ DecisionLogger（决策日志）
   ├─ RetryRunner（重试策略）
   └─ fetchWithFailover（自动降级）

结论：这些能力都已实现，只需继承 BasePlatformAdapter！
```

#### 问题 2.3: 过度拆分

```
原任务列表拆分：

2.1 依赖和配置 (6 tasks)：
├─ 安装 amazon-sp-api 依赖
├─ 安装 aws-sdk-client-v3 依赖
├─ 创建 Amazon 配置 schema
├─ 更新 openclaw.plugin.json
├─ 创建 .env.example
└─ 验证配置加载逻辑

问题：
├─ 每个步骤都是单独任务
├─ 完成时间 < 30 分钟的任务
├─ aws-sdk-client-v3 不需要（SDK 已包含）
└─ 应该合并为一个任务："配置和依赖管理"

合理的拆分：
□ 配置和依赖管理（1 小时，≈50 行）
   包含：安装依赖、配置环境变量、验证配置
```

---

## 根本原因分析

### 原因 1: Spec 的假设性问题

```
amazon-sp-api-integration/spec.md 写道：

"The system SHALL authenticate with Amazon SP-API
 using LWA (Login with Amazon) and AWS Signature V4."

"The system SHALL respect Amazon SP-API rate limits
 and implement retry logic."

问题：
├─ Spec 假设要自己实现这些能力
├─ 没有考虑 amazon-sp-api SDK 已经提供了这些能力
├─ 没有考虑基础设施已经实现了容错系统
└─ 任务列表是按照 Spec 生成的

结果：
├─ 任务列表包含"创建 LWAAuth.ts"
├─ 任务列表包含"实现令牌刷新逻辑"
├─ 任务列表包含"实现速率限制处理"
└─ 都是重复造轮子！
```

### 原因 2: 时间顺序问题

```
实际时间线：

20:09 - 创建 proposal.md
         └─ 定义了要做什么

20:11 - 创建 design.md
         └─ 定义了如何实现（但没考虑 SDK）

20:12-20:13 - 创建 specs
         └─ 定义了详细需求（假设自己实现）

[某个时间点] - 创建原始 tasks.md
         └─ 按照 spec 生成任务列表
         └─ 包含 40 个过度拆分的任务

22:18 - 创建 INFRASTRUCTURE.md
         └─ 用户要求我补充基础设施能力地图
         └─ 记录了已有能力

22:36 - 修订 tasks.md
         └─ 基于 INFRASTRUCTURE.md 修正
         └─ 从 40 tasks 缩减为 4 tasks

关键问题：
├─ Spec 创建时，没有考虑 SDK 能力
├─ Tasks 创建时，没有参考 INFRASTRUCTURE.md（当时还没有）
└─ 知识沉淀发生在规划之后，而不是之前
```

### 原因 3: 缺少强制检查机制

```
当前情况：
├─ INFRASTRUCTURE.md 存在，但不是强制的
├─ Spec 没有引用 INFRASTRUCTURE.md
└─ Tasks 没有检查"是否已有能力"

应该：
├─ Spec 编写时，必须检查：
│   ├─ 是否有 SDK 提供？
│   ├─ 基础设施是否已实现？
│   └─ 能否复用现有能力？
├─ Tasks 编写时，必须检查：
│   ├─ 每个 task 是否复用了现有能力？
│   └─ 是否避免了重复造轮子？
└─ 强制检查清单
```

### 原因 4: 知识沉淀与知识使用脱节

```
问题：
├─ 我创建了 INFRASTRUCTURE.md
├─ 但我在规划时没有主动使用它
└─ 文档存在 ≠ 文档被使用

反思：
├─ 创建文档是响应命令，不是主动决策
├─ 知识沉淀 ≠ 知识内化
└─ 文档是参考，不是决策依据
```

---

## 影响分析

### 直接影响

```
1. 工作量误估
   ├─ 原预估：2 天，40 tasks
   ├─ 实际：1 天，4 tasks
   └─ 误差：200%

2. 资源浪费风险
   ├─ 如果按原计划执行
   ├─ 会重复实现 SDK 已提供的功能
   └─ 预计浪费 1-2 天工作量

3. 代码冗余风险
   ├─ 可能创建 LWAAuth.ts
   ├─ 可能创建 AWSSigner.ts
   ├─ 可能实现令牌刷新逻辑
   └─ 导致代码库膨胀和维护负担
```

### 系统性影响

```
1. 规划流程缺陷
   ├─ Spec → Tasks 缺少"能力检查"环节
   ├─ 知识沉淀发生在规划之后
   └─ 没有强制使用文档的机制

2. 文档价值被削弱
   ├─ INFRASTRUCTURE.md 创建了但未被使用
   ├─ 文档的价值被质疑
   └─ 可能导致后续不再创建文档

3. 决策质量下降
   ├─ 没有基于实际能力决策
   ├─ 没有参考已有实现
   └─ 决策基于假设而非事实
```

---

## 改进方案

### 方案 1: Spec 模板改进

```
当前 Spec 写法：
┌───────────────────────────────────────────────┐
│ The system SHALL authenticate with Amazon     │
│ SP-API using LWA and AWS Signature V4.        │
└───────────────────────────────────────────────┘

改进的 Spec 写法：
┌───────────────────────────────────────────────┐
│ ### Requirement: SP-API Authentication        │
│                                               │
│ **Capability Assessment**:                    │
│ - SDK: amazon-sp-api 已提供                   │
│   ├─ LWA authentication (auto token refresh)  │
│   ├─ AWS Signature V4                         │
│   └─ Rate limiting                            │
│ - Infrastructure: 已实现                       │
│   ├─ ErrorClassifier (Amazon 映射已配置)      │
│   └─ RetryRunner (createAmazonRetryRunner)   │
│                                               │
│ **Requirement**:                              │
│ The system SHALL integrate with Amazon SP-API │
│ using the amazon-sp-api SDK.                  │
│                                               │
│ **Implementation Focus**:                     │
│ - Configure SDK credentials                   │
│ - Wrap SDK client (≈100 lines)                │
│ - Transform API responses to ProductData      │
└───────────────────────────────────────────────┘
```

### 方案 2: 任务规划检查清单

```
任务规划前必须检查：

□ 1. 调研阶段
   ├─ 是否有官方 SDK？
   ├─ SDK 是否活跃维护？
   ├─ SDK 是否覆盖核心功能？
   └─ 查看 INFRASTRUCTURE.md

□ 2. 能力复用检查
   ├─ 哪些能力 SDK 已提供？
   ├─ 哪些能力基础设施已实现？
   └─ 哪些能力需要自己实现？

□ 3. 任务粒度检查
   ├─ 每个任务是否是完整工作单元？
   ├─ 每个任务预估代码量是否合理（50-500 行）？
   └─ 是否避免了过度拆分？

□ 4. 参考实现检查
   ├─ 是否有类似的实现可参考？
   ├─ 参考实现的代码量是多少？
   └─ 预估工作量是否与参考实现匹配？
```

### 方案 3: Spec 与基础设施关联

```
在 spec.md 中明确标注：

### Requirement: SP-API Authentication

**SDK Capability**:
✅ amazon-sp-api SDK 已提供 LWA 认证和 AWS 签名
   - 自动刷新令牌
   - AWS4-HMAC-SHA256 签名
   - 参考: https://www.npmjs.com/package/amazon-sp-api

**Infrastructure Capability**:
✅ ErrorClassifier 已配置 Amazon 错误映射
✅ RetryRunner 已提供 createAmazonRetryRunner

**Implementation Focus**:
- 封装 SDK 客户端（≈100 行）
- 配置环境变量
```

### 方案 4: 知识沉淀前置

```
理想流程：
1. 调研现有能力（SDK、基础设施）
2. 知识沉淀（INFRASTRUCTURE.md）
3. 编写 Spec（考虑现有能力）
4. 规划任务（基于 Spec + 现有能力）
5. 实施

实际流程（问题）：
1. 编写 proposal（没有充分调研）
2. 编写 design（没有考虑 SDK）
3. 编写 spec（假设自己实现）
4. 创建 tasks（按照 spec 生成）
5. 实施 Phase 1
6. 知识沉淀（INFRASTRUCTURE.md）← 太晚了！
7. 发现问题，修订 tasks

改进：
├─ 在规划前先创建/更新 INFRASTRUCTURE.md
├─ Spec 编写时必须引用 INFRASTRUCTURE.md
└─ 任务规划时必须基于 INFRASTRUCTURE.md
```

---

## 实施建议

### 短期改进（立即执行）

```
1. 更新 Spec 文档
   ├─ 为每个 Requirement 添加"Capability Assessment"章节
   ├─ 明确标注 SDK 和基础设施的能力
   └─ 区分"已提供"和"需要实现"

2. 创建检查清单文档
   ├─ 任务规划检查清单
   ├─ Spec 编写检查清单
   └─ 强制在规划前检查

3. 更新任务模板
   ├─ 任务描述包含预估代码量
   ├─ 任务描述包含复用的能力
   └─ 任务粒度参考标准（50-500 行）
```

### 中期改进（1-2 周）

```
1. 改进 Spec 模板
   ├─ 添加"调研"章节
   ├─ 添加"Capability Assessment"章节
   └─ 添加"Implementation Focus"章节

2. 创建"不做什么"清单
   ├─ 不要重复实现 SDK 已提供的功能
   ├─ 不要重复实现基础设施已实现的能力
   └─ 不要过度拆分任务

3. 改进文档关联
   ├─ Spec 引用 INFRASTRUCTURE.md
   ├─ Tasks 引用 Spec 和 INFRASTRUCTURE.md
   └─ 建立文档间的链接
```

### 长期改进（1-2 月）

```
1. 自动化检查
   ├─ CI 检查 Spec 是否包含 Capability Assessment
   ├─ CI 检查 Tasks 是否引用了 INFRASTRUCTURE.md
   └─ 自动提示可能的重复造轮子

2. 知识库建设
   ├─ SDK 能力库
   ├─ 基础设施能力库
   └─ 反模式库

3. 流程固化
   ├─ Spec → Review → Tasks 流程
   ├─ 强制的检查点
   └─ 知识沉淀作为规划的前置条件
```

---

## 关键教训

### 教训 1: 知识沉淀 ≠ 知识使用

```
现象：
├─ 我创建了 INFRASTRUCTURE.md
├─ 但我在规划时没有主动使用它
└─ 文档存在 ≠ 文档被使用

根本原因：
├─ 创建文档是响应命令，不是主动决策
├─ 知识沉淀 ≠ 知识内化
└─ 文档是参考，不是决策依据

改进：
├─ 在决策前强制检查文档
├─ 文档成为决策的必要输入
└─ 知识沉淀 → 知识内化 → 知识使用
```

### 教训 2: 规格编写应该考虑现有能力

```
现象：
├─ Spec 假设要自己实现所有能力
├─ 导致任务列表包含重复造轮子的任务
└─ 工作量估算错误

根本原因：
├─ Spec 编写前没有充分调研
├─ Spec 没有引用 INFRASTRUCTURE.md
└─ 没有区分"已提供"和"需要实现"

改进：
├─ Spec 增加调研章节
├─ 明确标注 SDK 和基础设施的能力
└─ Implementation Focus 聚焦需要实现的部分
```

### 教训 3: 知识沉淀应该发生在规划之前

```
现象：
├─ 先规划，后沉淀知识
├─ 发现问题后再修订
└─ 返工和浪费

根本原因：
├─ 缺少"调研阶段"的前置要求
├─ 规划时没有要求先更新 INFRASTRUCTURE.md
└─ 顺序错误

改进：
├─ 规划前必须更新 INFRASTRUCTURE.md
├─ 规划前必须调研 SDK 能力
└─ 知识沉淀 → 规划 → 实施（正确顺序）
```

### 教训 4: 需要"强制检查"机制

```
现象：
├─ 文档是参考，不是强制
├─ Agent 可以忽略文档
└─ 没有机制保证文档被使用

根本原因：
├─ 文档缺少强制执行力
├─ 没有检查点验证文档使用
└─ 依赖 Agent 的主动性

改进：
├─ 创建强制检查清单
├─ 在关键决策点验证
└─ 自动化检查（长期）
```

### 教训 5: Spec → Tasks → Implementation 的连贯性

```
现象：
├─ Spec 定义需求
├─ Tasks 实现需求
└─ 但中间缺少"能力复用检查"环节

根本原因：
├─ 流程缺失
├─ 没有检查 Spec 是否考虑了现有能力
└─ 没有检查 Tasks 是否复用了现有能力

改进：
├─ Spec 审查：是否考虑了 SDK 和基础设施？
├─ Tasks 审查：是否复用了现有能力？
└─ 审查作为流程的必要环节
```

---

## 案例对比

### Taobao vs Amazon

```
┌─────────────────────────────────────────────────────────┐
│          Taobao vs Amazon 实现对比                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Taobao（无官方 SDK）                                   │
│  ├─ 自己实现：签名算法、OAuth、错误处理                 │
│  ├─ 代码量：558 行                                      │
│  ├─ 工作量：2-3 天                                      │
│  └─ 参考实现：完整可用                                  │
│                                                         │
│  Amazon（有官方 SDK）                                   │
│  ├─ SDK 提供：认证、签名、速率限制、错误处理            │
│  ├─ 只需实现：封装 SDK + 数据转换                       │
│  ├─ 代码量：≈300 行                                     │
│  ├─ 工作量：1 天                                        │
│  └─ 工作量减少：64%                                     │
│                                                         │
│  关键差异：                                             │
│  ├─ Taobao 无 SDK → 自己实现所有能力                   │
│  └─ Amazon 有 SDK → 封装 SDK 提供的能力                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 原任务列表 vs 修订后任务列表

```
┌─────────────────────────────────────────────────────────┐
│          任务列表对比                                    │
├────────────────┬────────────────┬───────────────────────┤
│ 维度           │ 原版           │ 修订版                │
├────────────────┼────────────────┼───────────────────────┤
│ 任务数量       │ 40 tasks       │ 4 tasks               │
│ 工作量预估     │ 2 天           │ 1 天（6 小时）         │
│ 代码量预估     │ ???            │ ≈300 行               │
│ 平均每任务代码 │ ???            │ ≈75 行                │
│ 平均每任务时间 │ ???            │ 1.5 小时              │
├────────────────┼────────────────┼───────────────────────┤
│ 重复造轮子     │ ❌ 很多        │ ✅ 避免                │
│ SDK 能力利用   │ ❌ 忽视        │ ✅ 充分利用            │
│ 基础设施复用   │ ❌ 忽视        │ ✅ 充分复用            │
│ 测试集成       │ ❌ 单独列出    │ ✅ 集成到任务          │
├────────────────┼────────────────┼───────────────────────┤
│ 清晰度         │ ⚠️ 过度拆分    │ ✅ 清晰完整            │
│ 可执行性       │ ⚠️ 每步很小    │ ✅ 独立完整            │
│ 进度追踪       │ ⚠️ 难追踪      │ ✅ 易追踪              │
└────────────────┴────────────────┴───────────────────────┘
```

---

## 后续行动

### 立即行动

- [x] 修订 tasks.md（Phase 2: 40 → 4 tasks）
- [x] 更新 INFRASTRUCTURE.md
- [ ] 创建任务规划检查清单
- [ ] 更新 Spec 模板

### 本周行动

- [ ] 为所有 Spec 添加"Capability Assessment"章节
- [ ] 创建"不做什么"清单
- [ ] 改进文档间的关联和引用

### 长期行动

- [ ] 自动化检查机制
- [ ] 知识库建设
- [ ] 流程固化

---

## 附录

### A. 相关文档

- **Change**: `openspec/changes/fix-p0-storage-and-amazon/`
- **INFRASTRUCTURE.md**: `extensions/meichao-ecom/INFRASTRUCTURE.md`
- **Taobao API 实现**: `extensions/meichao-ecom/src/infrastructure/api/taobao/`
- **Amazon Adapter**: `extensions/meichao-ecom/src/infrastructure/adapters/AmazonAdapter.ts`

### B. 参考资源

- **amazon-sp-api SDK**: https://www.npmjs.com/package/amazon-sp-api
- **Amazon SP-API 官方文档**: https://developer-docs.amazon.com/sp-api/
- **OpenSpec 规范**: 项目内的 OpenSpec 文档

### C. 数据统计

```
Phase 1 任务统计：
├─ 总任务：38
├─ 已完成：36
├─ 未完成：2（代码审查、文档更新）
└─ 完成率：94.7%

Phase 2 任务统计（修订后）：
├─ 总任务：4
├─ 已完成：0
├─ 未完成：4
└─ 预估工作量：6 小时

代码量对比：
├─ Taobao API：558 行（自己实现）
├─ Amazon API：≈300 行（封装 SDK）
└─ 减少：46%
```

---

## 结论

这次问题分析揭示了任务规划中的系统性缺陷：**知识沉淀与知识使用的脱节**。

关键问题不是"缺少文档"，而是"有文档但未使用"。这需要从流程、机制、文化三个层面改进：

1. **流程层面**: 知识沉淀前置，作为规划的前置条件
2. **机制层面**: 强制检查清单，验证知识使用
3. **文化层面**: 知识内化，主动使用而非被动响应

只有这样，才能真正发挥知识沉淀的价值，避免重复造轮子，提高开发效率。

---

**报告撰写**: AI Agent (Codex)  
**审核**: 待人工审核  
**状态**: 已完成
