# Tasks: Integrated Degradation System

## Phase 1: 统一降级配置

### Task 1.1: 创建 DataSourceConfig 类型定义
- **File**: `extensions/meichao-ecom/src/domain/types.ts`
- **Description**: 添加 `DataSourceConfig`, `ResolvedDataSourceConfig`, `SelectionStrategy`, `CooldownSettings` 类型
- **Acceptance**:
  - 类型定义完整
  - JSDoc 注释清晰
  - 与现有类型兼容

### Task 1.2: 实现 parseDataSourceConfig 函数
- **File**: `extensions/meichao-ecom/src/domain/data-source-config.ts`
- **Description**: 解析简写和完整配置格式，填充默认值
- **Acceptance**:
  - 正确解析简写格式
  - 正确解析完整格式
  - 填充默认值
  - 无效 ID 抛出错误

### Task 1.3: 添加配置测试
- **File**: `extensions/meichao-ecom/src/domain/data-source-config.test.ts`
- **Description**: 测试配置解析各种场景
- **Acceptance**:
  - 简写解析测试
  - 完整解析测试
  - 默认值测试
  - 错误处理测试

---

## Phase 2: 错误分类

### Task 2.1: 创建 DataSourceFailoverReason 类型
- **File**: `extensions/meichao-ecom/src/domain/types.ts`
- **Description**: 添加 `DataSourceFailoverReason` 类型和 `ClassifiedError` 接口
- **Acceptance**:
  - 10 种错误类型定义
  - isSevere 函数签名

### Task 2.2: 实现 classifyError 函数
- **File**: `extensions/meichao-ecom/src/infrastructure/adapters/ErrorClassifier.ts`
- **Description**: 实现错误分类逻辑
- **Acceptance**:
  - HTTP 状态码映射
  - 平台错误码映射
  - 严重错误判断
  - 未知错误处理

### Task 2.3: 添加错误分类测试
- **File**: `extensions/meichao-ecom/src/infrastructure/adapters/ErrorClassifier.test.ts`
- **Description**: 测试错误分类各种场景
- **Acceptance**:
  - HTTP 状态码测试
  - 平台错误码测试
  - 严重错误判断测试
  - 未知错误测试

---

## Phase 3: 冷却机制

### Task 3.1: 创建 SourceCooldownState 类型
- **File**: `extensions/meichao-ecom/src/domain/types.ts`
- **Description**: 添加 `SourceCooldownState` 和 `CooldownManager` 接口
- **Acceptance**:
  - 状态字段完整
  - 管理器方法签名

### Task 3.2: 实现 InMemoryCooldownManager
- **File**: `extensions/meichao-ecom/src/infrastructure/cooldown/InMemoryCooldownManager.ts`
- **Description**: 实现内存冷却管理器
- **Acceptance**:
  - isInCooldown 正确判断
  - recordSuccess 正确重置
  - recordError 正确计算冷却时间
  - canProbe 正确判断

### Task 3.3: 实现冷却时间计算
- **File**: `extensions/meichao-ecom/src/infrastructure/cooldown/calculateCooldownDuration.ts`
- **Description**: 实现指数退避冷却时间计算
- **Acceptance**:
  - 普通错误计算正确
  - 严重错误计算正确
  - 最大值截断正确

### Task 3.4: 添加冷却管理测试
- **File**: `extensions/meichao-ecom/src/infrastructure/cooldown/InMemoryCooldownManager.test.ts`
- **Description**: 测试冷却管理各种场景
- **Acceptance**:
  - 冷却状态测试
  - 成功重置测试
  - 连续错误测试
  - Probe 条件测试

---

## Phase 4: 决策日志

### Task 4.1: 创建 DegradationDecisionLog 类型
- **File**: `extensions/meichao-ecom/src/domain/types.ts`
- **Description**: 添加 `DegradationDecisionLog` 和 `DecisionLogger` 接口
- **Acceptance**:
  - 日志字段完整
  - 管理器方法签名

### Task 4.2: 实现 InMemoryDecisionLogger
- **File**: `extensions/meichao-ecom/src/infrastructure/logging/InMemoryDecisionLogger.ts`
- **Description**: 实现内存决策日志管理器
- **Acceptance**:
  - log 正确写入
  - getByRunId 正确查询
  - getRecent 正确返回
  - clear 正确清理

### Task 4.3: 添加决策日志测试
- **File**: `extensions/meichao-ecom/src/infrastructure/logging/InMemoryDecisionLogger.test.ts`
- **Description**: 测试决策日志各种场景
- **Acceptance**:
  - 日志写入测试
  - runId 查询测试
  - JSON 序列化测试
  - 清理测试

---

## Phase 5: 整合到统一流程

### Task 5.1: 更新 BasePlatformAdapter
- **File**: `extensions/meichao-ecom/src/infrastructure/adapters/BasePlatformAdapter.ts`
- **Description**: 整合冷却管理器和决策日志
- **Acceptance**:
  - 请求前检查冷却状态
  - 失败后更新冷却状态
  - 成功后重置冷却状态
  - 记录决策日志

### Task 5.2: 更新 FetchProductUseCase
- **File**: `extensions/meichao-ecom/src/application/use-cases/FetchProductUseCase.ts`
- **Description**: 整合统一降级配置和 6 层降级链
- **Acceptance**:
  - 使用 DataSourceConfig
  - 实现 6 层降级
  - 记录降级层级

### Task 5.3: 添加配置注入
- **File**: `extensions/meichao-ecom/src/infrastructure/config/degradation.config.ts`
- **Description**: 提供降级配置入口
- **Acceptance**:
  - 支持环境变量配置
  - 支持配置文件
  - 默认值合理

### Task 5.4: 添加集成测试
- **File**: `extensions/meichao-ecom/src/application/use-cases/FetchProductUseCase.integration.test.ts`
- **Description**: 测试完整降级流程
- **Acceptance**:
  - Fresh Cache → Database → Primary → Fallback → Stale Cache → Error
  - 冷却状态正确切换
  - 日志正确记录

---

## Phase 6: 文档和清理

### Task 6.1: 更新架构文档
- **File**: `docs/dev/数据采集/架构设计.md`
- **Description**: 更新架构文档，描述统一降级体系
- **Acceptance**:
  - 6 层降级流程图
  - 配置说明
  - 错误处理说明

### Task 6.2: 清理重复代码
- **File**: `extensions/meichao-ecom/src/infrastructure/adapters/BasePlatformAdapter.ts`
- **Description**: 移除旧的降级逻辑，使用统一实现
- **Acceptance**:
  - 移除重复代码
  - 保留向后兼容
  - 测试全部通过

---

## Summary

- **Total Tasks**: 22
- **Estimated Time**: 3-4 days
- **Dependencies**: 
  - Phase 1 无依赖
  - Phase 2 依赖 Phase 1 (需要 DataSourceFailoverReason 类型)
  - Phase 3 依赖 Phase 2 (需要 classifyError)
  - Phase 4 依赖 Phase 2 (需要 DataSourceFailoverReason 类型)
  - Phase 5 依赖 Phase 1-4
  - Phase 6 依赖 Phase 5