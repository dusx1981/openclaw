## Why

当前数据采集降级策略分散在多个层面，缺乏统一的设计模式。借鉴 OpenClaw 模型管理降级方案，需要整合为：固定降级路径、智能冷却、错误分类、统一执行的降级体系。

**核心需求**：

1. 统一管理工具的降级策略（`ecom-product-fetch` 和 `ecom-product-search`）
2. 固定降级路径：`official_api → third_party_api → skill_crawler → open_search`
3. 每个平台独立管理，无跨平台回退
4. 借鉴 OpenClaw Model Failover 最佳实践

## What Changes

- **固定降级路径**：通过 `DataSource.type` 字段判断降级顺序，无需显式配置 `fallbacks`
- **统一执行器**：`DegradationExecutor` 协调 Retry + CircuitBreaker + CooldownManager
- **智能冷却**：指数退避（普通错误 1min→1h，严重错误 5h→24h）
- **错误分类**：`DataSourceFailoverReason` 区分临时/严重错误
- **结构化日志**：降级决策日志，便于分析和排查
- **简化 Adapter**：BasePlatformAdapter 职责简化，减少 ~200 lines

## Capabilities

### New Capabilities

- `degradation-path`: 固定降级路径能力，基于 DataSource.type 自动排序，支持预设模板
- `degradation-executor`: 统一降级执行能力，协调 Retry + CircuitBreaker + Cooldown，支持验证模式

### Modified Capabilities

- `source-cooldown`: 数据源冷却能力，更新为冷却窗口保持逻辑，支持可配置冷却时间
- `failover-error-classification`: 故障转移错误分类能力，更新错误分类优先级
- `degradation-decision-log`: 降级决策日志能力，更新为 DegradationExecutor 使用方式
- `platform-adapter`: 平台适配器能力，职责简化（降级逻辑移至 DegradationExecutor）

### Removed Capabilities

- `unified-degradation-config`: 移除（新架构不再需要配置解析，使用 DegradationPath 自动判断）

## Impact

- `src/infrastructure/degradation/`: 新增降级模块目录
  - `DegradationPath.ts` (~100 lines)
  - `DegradationExecutor.ts` (~150 lines)
  - `CooldownManager.ts` (~80 lines)
- `src/infrastructure/adapters/BasePlatformAdapter.ts`: 重构，减少 ~200 lines
- `src/domain/types.ts`: 新增 DataSourceFailoverReason、CooldownState 类型
- `docs/集成/`: 更新降级机制文档
