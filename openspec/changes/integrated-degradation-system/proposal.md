## Why

当前数据采集降级策略分散在多个层面，缺乏统一的设计模式。借鉴 openclaw 模型管理降级方案，需要整合为：简洁配置、智能冷却、错误分类、结构化日志的统一降级体系。

## What Changes

- 统一降级配置格式：支持 `string | { primary, fallbacks }` 简洁写法
- 引入 `FailoverReason` 错误分类（10 种：auth/rate_limit/timeout/overloaded/billing 等）
- 实现指数退避冷却机制：普通失败 1min→1h，billing 5h→24h
- 添加 Probe 机制：冷却快结束时提前尝试
- 结构化降级决策日志
- 整合数据库新鲜度检查到统一降级流程

## Capabilities

### New Capabilities

- `unified-degradation-config`: 统一降级配置能力，支持简洁配置格式
- `failover-error-classification`: 故障转移错误分类能力，10 种 FailoverReason
- `source-cooldown`: 数据源冷却能力，指数退避 + Probe 机制
- `degradation-decision-log`: 降级决策日志能力，结构化记录决策过程

### Modified Capabilities

- `data-freshness`: 数据新鲜度检查能力，整合到统一降级流程
- `source-selection-strategy`: 数据源选择策略能力，与冷却机制协同工作
- `source-health-tracker`: 数据源健康追踪能力，与冷却统计合并

## Impact

- `src/domain/types.ts`: 新增 FailoverReason、CooldownState 类型
- `src/infrastructure/adapters/BasePlatformAdapter.ts`: 重构为统一降级流程
- `src/infrastructure/degradation/`: 新增降级模块目录
- `docs/dev/数据采集/`: 更新降级机制文档