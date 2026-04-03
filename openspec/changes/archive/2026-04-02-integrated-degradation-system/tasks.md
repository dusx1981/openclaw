# Tasks: Integrated Degradation System

## Phase 1: 核心降级路径（P0 - 必须实现）

- [x] Task 1.1: 创建类型定义
  - **File**: `extensions/meichao-ecom/src/infrastructure/degradation/types.ts`
  - **Description**: 添加 DegradationOptions, DegradationResult, DataSourceFailoverReason, ClassifiedError, CooldownState 类型
  - **Acceptance**: 类型定义完整，JSDoc 注释清晰，与现有 DataSource 类型兼容

- [x] Task 1.2: 创建 DegradationPath 类
  - **File**: `extensions/meichao-ecom/src/infrastructure/degradation/DegradationPath.ts`
  - **Description**: 实现固定降级路径管理，基于 DataSource.type 判断顺序
  - **Acceptance**: CORE_ORDER 固定顺序正确，getPath() 方法根据 type 返回数据源列表，支持跳过某些数据源类型，正确处理可用性和配额检查

- [x] Task 1.3: 创建 CooldownManager 类
  - **File**: `extensions/meichao-ecom/src/infrastructure/degradation/CooldownManager.ts`
  - **Description**: 实现冷却时间管理，指数退避，区分临时/严重错误，冷却窗口保持不变
  - **Acceptance**: isInCooldown() 正确判断冷却状态，recordFailure() 正确计算冷却时间且冷却窗口保持不变，recordSuccess() 正确重置状态，冷却时间正确（1m→5m→15m→30m, 1h→2h→4h→24h）

- [x] Task 1.4: 创建 DegradationExecutor 类
  - **File**: `extensions/meichao-ecom/src/infrastructure/degradation/DegradationExecutor.ts`
  - **Description**: 实现统一降级执行器，协调 Retry + CircuitBreaker + CooldownManager
  - **Acceptance**: execute() 方法正确执行降级逻辑，正确协调 RetryRunner 和 CircuitBreaker，正确使用 CooldownManager，正确记录降级决策，返回 DegradationResult 包含所有必要字段

- [x] Task 1.5: 创建降级模块导出
  - **File**: `extensions/meichao-ecom/src/infrastructure/degradation/index.ts`
  - **Description**: 导出所有降级模块组件
  - **Acceptance**: 导出所有类型和类，导出路径简洁

- [x] Task 1.6: 添加降级模块测试
  - **Files**: `extensions/meichao-ecom/src/infrastructure/degradation/__tests__/DegradationPath.test.ts`, `CooldownManager.test.ts`, `DegradationExecutor.test.ts`
  - **Description**: 测试降级模块各种场景
  - **Acceptance**: DegradationPath 测试：降级顺序、跳过类型、可用性检查；CooldownManager 测试：冷却状态、失败记录、成功重置、冷却窗口保持；DegradationExecutor 测试：降级执行、错误处理、决策记录

- [x] Task 1.7: 重构 BasePlatformAdapter
  - **File**: `extensions/meichao-ecom/src/infrastructure/adapters/BasePlatformAdapter.ts`
  - **Description**: 简化 BasePlatformAdapter，移除硬编码降级逻辑，使用统一模块
  - **Acceptance**: 文件行数减少到 ~230 lines，移除硬编码降级逻辑，使用 DegradationPath 和 DegradationExecutor，保留业务逻辑方法，向后兼容（fetchWithFailover 接口保持不变）

- [x] Task 1.8: 更新 TaobaoAdapter
  - **File**: `extensions/meichao-ecom/src/infrastructure/adapters/TaobaoAdapter.ts`
  - **Description**: 使用 DegradationPath 和 DegradationExecutor，添加 mock 数据返回
  - **Acceptance**: 继承 BasePlatformAdapter 的 DegradationExecutor，fetchProduct() 使用 fetchWithFailover，searchProducts() 使用 fetchWithFailover，当 productApi 为 null 时返回 mock 数据，测试通过 (25/25)

- [x] Task 1.9: 更新 AmazonAdapter
  - **File**: `extensions/meichao-ecom/src/infrastructure/adapters/AmazonAdapter.ts`
  - **Description**: 使用 DegradationPath 和 DegradationExecutor
  - **Acceptance**: 继承 BasePlatformAdapter 的 DegradationExecutor，fetchProduct() 使用 fetchWithFailover，searchProducts() 使用 fetchWithFailover，测试通过 (7/7)

---

## Phase 2: 预设模板和工具参数（P1 - 推荐实现）

- [x] Task 2.1: 实现预设模板
  - **File**: `extensions/meichao-ecom/src/infrastructure/degradation/DegradationPath.ts`
  - **Description**: 添加预设模板常量，支持标准/成本优化/速度优化/可靠性优先
  - **Acceptance**: PRESETS 常量定义正确，getPath() 支持预设模板选择，预设模板测试通过

- [x] Task 2.2: 更新 product-fetch-tool 参数
  - **File**: `extensions/meichao-ecom/src/tools/product-fetch-tool.ts`
  - **Description**: 添加 degradation 参数，支持预设模板和自定义配置
  - **Acceptance**: degradation 参数定义正确，参数透传到 Adapter，参数验证正确，文档更新

- [x] Task 2.3: 更新 product-search-tool 参数
  - **File**: `extensions/meichao-ecom/src/tools/product-search-tool.ts`
  - **Description**: 添加 degradation 参数，支持预设模板和自定义配置
  - **Acceptance**: degradation 参数定义正确，参数透传到 Adapter，参数验证正确，文档更新

- [x] Task 2.4: 添加预设模板测试
  - **File**: `extensions/meichao-ecom/src/infrastructure/degradation/__tests__/DegradationPath.test.ts`
  - **Description**: 测试预设模板各种场景
  - **Acceptance**: standard, cost-optimized, speed-optimized, reliability-first 模板测试

---

## Phase 3: 高级特性（P2 - 可选实现）

- [x] Task 3.1: 实现会话粘性
  - **File**: `extensions/meichao-ecom/src/infrastructure/degradation/SessionStickiness.ts`
  - **Description**: 为批量任务固定数据源，提升缓存效率
  - **Acceptance**: SessionStickiness 类实现正确，固定数据源逻辑正确，会话过期处理正确，测试通过

- [x] Task 3.2: 添加决策日志持久化
  - **File**: `extensions/meichao-ecom/src/infrastructure/logging/DecisionLogger.ts`
  - **Description**: 持久化降级决策日志，支持查询和分析
  - **Acceptance**: 日志写入正确，查询接口正确，支持按 runId/platform/sourceId 查询，测试通过

- [x] Task 3.3: 实现 Probe 机制
  - **File**: `extensions/meichao-ecom/src/infrastructure/degradation/CooldownManager.ts`
  - **Description**: 冷却快结束时提前尝试，加速恢复
  - **Acceptance**: canProbe() 条件判断正确，Probe 执行逻辑正确，Probe 成功/失败处理正确，测试通过

- [x] Task 3.4: 实现自定义降级顺序
  - **File**: `extensions/meichao-ecom/src/infrastructure/degradation/DegradationPath.ts`
  - **Description**: 支持高级模式自定义降级顺序
  - **Acceptance**: 支持自定义 typeOrder，验证自定义顺序合法性，与预设模板共存，测试通过

---

## Phase 4: 文档和清理

- [x] Task 4.1: 更新技术文档
  - **File**: `docs/集成/meichao-ecom-数据源降级策略.md`
  - **Description**: 更新技术文档，描述统一降级体系
  - **Acceptance**: 三组件架构图清晰，预设模板说明完整，工具参数说明清晰，示例代码完整

- [x] Task 4.2: 清理重复代码
  - **Files**: `extensions/meichao-ecom/src/infrastructure/adapters/BasePlatformAdapter.ts`, `ErrorClassifier.ts`
  - **Description**: 移除旧的降级逻辑，统一使用降级模块
  - **Acceptance**: 移除所有重复代码，ErrorClassifier 简化，BasePlatformAdapter 简化完成，所有测试通过

- [x] Task 4.3: 添加集成测试
  - **File**: `extensions/meichao-ecom/src/infrastructure/degradation/__tests__/integration.test.ts`
  - **Description**: 测试完整降级流程
  - **Acceptance**: 完整降级流程测试（official_api → third_party_api → skill_crawler → open_search），冷却状态切换测试，预设模板切换测试，错误处理测试

---

## Summary

- **Total Tasks**: 20
- **Completed**: 20
- **Status**: All tasks complete ✓
