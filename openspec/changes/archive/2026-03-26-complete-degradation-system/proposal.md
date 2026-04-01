## Why

当前 meichao-ecom 数据采集系统存在降级机制不完整的问题：熔断器已设计但未实现、健康探测缺失、数据源冷却恢复手动操作、错误处理分散。这导致系统在数据源故障时缺乏智能降级能力，可能出现雪崩效应或长时间不可用。

借鉴 OpenClaw 成熟的模型降级设计模式，构建完整的降级管理体系，实现稳定的自动化故障恢复。

## What Changes

- 实现熔断器模式（Circuit Breaker）：失败阈值检测、自动熔断、半开恢复
- 实现健康探测调度：定时健康检查、自动恢复、状态持久化
- 实现统一冷却机制：错误分类、指数退避、Probe 提前恢复
- 实现决策日志：结构化记录降级决策过程
- 整合到统一降级流程：6 层降级链 + 智能源选择

## Capabilities

### New Capabilities

- `circuit-breaker`: 熔断器实现，包括失败计数、自动熔断、半开探测、恢复逻辑
- `health-probe-scheduler`: 健康探测调度器，定时检查数据源健康状态
- `source-cooldown`: 数据源冷却机制，错误分类和指数退避冷却
- `degradation-decision-log`: 降级决策日志，结构化记录便于排查和分析
- `unified-degradation-flow`: 统一降级流程，整合所有机制到 6 层降级链

### Modified Capabilities

- `data-source-config`: 扩展现有配置，支持冷却设置和熔断器配置
- `platform-adapter`: 增强故障转移逻辑，集成熔断器和冷却机制

## Impact

**核心文件变更**:
- `src/domain/types.ts` - 新增熔断器、冷却状态等类型
- `src/domain/data-source-config.ts` - 扩展配置格式
- `src/infrastructure/adapters/BasePlatformAdapter.ts` - 集成熔断器和冷却
- `src/application/use-cases/FetchProductUseCase.ts` - 整合统一降级流程

**新增文件**:
- `src/infrastructure/circuit-breaker/CircuitBreaker.ts`
- `src/infrastructure/circuit-breaker/CircuitBreakerState.ts`
- `src/infrastructure/health/HealthProbeScheduler.ts`
- `src/infrastructure/cooldown/CooldownManager.ts`
- `src/infrastructure/logging/DecisionLogger.ts`

**依赖关系**:
- 熔断器依赖冷却机制（冷却时间计算）
- 健康探测依赖熔断器（半开状态探测）
- 统一降级流程依赖所有子机制