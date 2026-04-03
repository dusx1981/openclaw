# meichao-ecom 降级机制设计文档

## 概述

本文档描述 meichao-ecom 插件的降级保护机制，采用简化的双层架构：

1. **Retry（重试）**：处理瞬时故障（秒级）
2. **Circuit Breaker（熔断器）**：防止级联失败（分钟级）

```
┌──────────────────────────────────────────────────────────────┐
│        简化的双层保护机制                                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Retry (使用 plugin-sdk/infra-runtime)                      │
│    - 问题: 瞬时故障（rate_limit, timeout, overloaded）      │
│    - 保护: 自动重试，指数退避 + jitter                      │
│    - 时间: 毫秒~秒级 (500ms ~ 30s)                          │
│                                                              │
│  Circuit Breaker (参考 Resilience4j 最佳实践)               │
│    - 问题: 持续故障导致的级联失败                            │
│    - 保护: 系统稳定性，快速失败                              │
│    - 时间: 秒级 (60s 熔断期)                                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## 架构演变说明

### 为什么移除了 Cooldown？

原设计包含三重保护：Retry + CircuitBreaker + Cooldown。但经过分析发现：

1. **Cooldown 不适合 DataSource 模型**
   - OpenClaw 使用 Cooldown 进行多 Profile 轮换
   - meichao-ecom 的 DataSource 是单一配置，无轮换需求
   - 时间尺度与 CircuitBreaker 重叠（分钟级）

2. **功能重复**
   - Retry 已处理瞬时故障（带指数退避）
   - CircuitBreaker 已提供熔断保护（60s）
   - Cooldown 的 5~60 分钟冷却过于保守

3. **增加了不必要的复杂性**
   - 需要协调 CB 和 Cooldown 状态
   - CB 的 HALF-OPEN 可能被 Cooldown 阻止
   - 代码复杂度增加，维护成本高

### 新架构的优势

```
┌──────────────────────────────────────────────────────────────┐
│        新旧架构对比                                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  旧架构 (过度设计):                                          │
│    Retry → CircuitBreaker → Cooldown → Failover             │
│    问题: 三层重叠，协调复杂                                  │
│                                                              │
│  新架构 (简洁清晰):                                          │
│    Retry (plugin-sdk) → CircuitBreaker → Failover           │
│    优势: 职责分离，无协调问题                                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## 1. Retry 设计

### 1.1 使用 OpenClaw plugin-sdk

meichao-ecom 现在使用 `openclaw/plugin-sdk/infra-runtime` 提供的 Retry 基础设施：

```typescript
import { createRateLimitRetryRunner, type RetryRunner } from "openclaw/plugin-sdk/infra-runtime";

export function createTaobaoRetryRunner(): RetryRunner {
  return createRateLimitRetryRunner({
    defaults: {
      attempts: 3,
      minDelayMs: 500,
      maxDelayMs: 30_000,
      jitter: 0.1,
    },
    logLabel: "taobao",
    shouldRetry: (err) => {
      const classified = classifyError(err, "taobao");
      return !isSevereError(classified.reason);
    },
  });
}
```

### 1.2 平台特定配置

| 平台   | attempts | minDelayMs | maxDelayMs | jitter |
| ------ | -------- | ---------- | ---------- | ------ |
| Taobao | 3        | 500        | 30,000     | 0.1    |
| Amazon | 3        | 1,000      | 60,000     | 0.1    |
| 默认   | 3        | 500        | 30,000     | 0.1    |

### 1.3 错误分类与重试决策

```typescript
// 严重错误：不重试，直接失败
const SEVERE_ERRORS = [
  "auth_permanent", // 认证永久失效
  "blocked", // IP/账号被封
  "billing", // 计费问题
];

// 非严重错误：重试
const RETRYABLE_ERRORS = [
  "rate_limit", // 频率限制
  "timeout", // 超时
  "overloaded", // 过载
];
```

### 1.4 指数退避 + Jitter

```
退避公式: delay = min(maxDelayMs, minDelayMs * 2^(attempt-1) * (1 + jitter * random()))

示例 (Taobao, minDelay=500ms, maxDelay=30s, jitter=0.1):
  Attempt 1: 成功 → 完成
  Attempt 2: 失败 → 等待 500ms * 2^1 * (0.9~1.1) ≈ 900~1100ms
  Attempt 3: 失败 → 等待 500ms * 2^2 * (0.9~1.1) ≈ 1800~2200ms
  Attempt 4: 失败 → 放弃，抛出错误
```

## 2. Circuit Breaker 设计

### 2.1 状态机模型

```
┌──────────────────────────────────────────────────────────────┐
│            Circuit Breaker 状态流转图                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│         ┌─────────────────────────────────────┐             │
│         │         CLOSED (正常)               │             │
│         │  • 允许所有请求通过                 │             │
│         │  • failureCount = 0                 │             │
│         └─────────────────────────────────────┘             │
│                            │                                 │
│                      连续 5 次失败                           │
│                            ▼                                 │
│         ┌─────────────────────────────────────┐             │
│         │          OPEN (熔断)                │             │
│         │  • 拒绝所有请求                     │             │
│         │  • 持续 60 秒                       │             │
│         └─────────────────────────────────────┘             │
│                            │                                 │
│                      60 秒后自动                             │
│                            ▼                                 │
│         ┌─────────────────────────────────────┐             │
│         │       HALF-OPEN (试探)              │             │
│         │  • 允许最多 10 次请求               │             │
│         │  • 测试服务是否恢复                 │             │
│         └─────────────────────────────────────┘             │
│                            │                                 │
│               ┌────────────┴────────────┐                   │
│           成功 3 次                  失败                    │
│               ▼                         ▼                   │
│         回到 CLOSED              回到 OPEN                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 配置参数（参考 Resilience4j）

```typescript
export const DEFAULT_CIRCUIT_BREAKER_CONFIG = {
  enabled: true,
  failureThreshold: 5, // 连续 5 次失败触发熔断
  openDuration: 60000, // 熔断持续 60 秒
  halfOpenMaxCalls: 10, // HALF-OPEN 允许 10 次试探
  successThreshold: 3, // 需 3 次成功才恢复
};
```

**配置说明**：

| 参数               | 值          | 说明                                   |
| ------------------ | ----------- | -------------------------------------- |
| `failureThreshold` | 5           | 连续失败次数阈值，避免偶发错误触发熔断 |
| `openDuration`     | 60000 (60s) | 给服务足够的恢复时间                   |
| `halfOpenMaxCalls` | 10          | 允许多次试探，提高恢复成功率           |
| `successThreshold` | 3           | 确保服务稳定后才恢复                   |

### 2.3 与 Resilience4j 对比

| 参数                                  | Resilience4j 默认 | meichao-ecom | 说明                       |
| ------------------------------------- | ----------------- | ------------ | -------------------------- |
| waitDurationInOpenState               | 60s               | 60s          | ✓ 一致                     |
| permittedNumberOfCallsInHalfOpenState | 10                | 10           | ✓ 一致                     |
| failureRateThreshold                  | 50%               | 5次          | 略有差异（计数 vs 百分比） |
| slowCallRateThreshold                 | 100%              | 不适用       | meichao-ecom 不监控慢调用  |

## 3. 协作流程

### 3.1 fetchWithFailover 流程

```typescript
async fetchWithFailover<T>(fn: (source: DataSource) => Promise<T>) {
  for (const source of sources) {
    // 步骤 1: 检查 CircuitBreaker
    const cb = this.circuitBreakers.get(source.id);
    if (!cb.canExecute()) {
      continue; // 跳过熔断的数据源
    }

    // 步骤 2: 使用 Retry 执行
    const retryRunner = this.retryRunners.get(source.id);

    try {
      const data = await retryRunner(() => fn(source));
      cb.recordSuccess();
      return { data, source: source.id };
    } catch (error) {
      cb.recordFailure();
      // 继续尝试下一个数据源
    }
  }

  throw new Error("No available data sources");
}
```

### 3.2 时间尺度分离

```
┌──────────────────────────────────────────────────────────────┐
│        时间尺度自然分离                                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Retry: 毫秒~秒级                                            │
│    • 第一次重试: ~500ms                                      │
│    • 第二次重试: ~1s                                         │
│    • 第三次重试: ~2s                                         │
│    • 总时长: ~3.5s                                           │
│                                                              │
│  CircuitBreaker: 分钟级                                      │
│    • 熔断期: 60s                                             │
│    • HALF-OPEN: 10 次试探                                    │
│    • 恢复判定: 3 次成功                                      │
│                                                              │
│  关键：两个机制时间尺度完全分离，无需协调                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## 4. 关键文件

### 4.1 文件结构

```
extensions/meichao-ecom/src/
  ├── domain/
  │   └── types.ts                     # 类型定义
  │   └── data-source-config.ts        # 配置
  │
  ├── infrastructure/
  │   ├── retry-policy.ts              # Retry 策略 (新增)
  │   ├── circuit-breaker/
  │   │   └── CircuitBreaker.ts        # 熔断器
  │   ├── classification/
  │   │   └── ErrorClassifier.ts       # 错误分类
  │   └── adapters/
  │       └── BasePlatformAdapter.ts   # 基类
```

### 4.2 依赖关系

```
BasePlatformAdapter
  ├── circuitBreakers: Map<string, CircuitBreaker>
  ├── retryRunners: Map<string, RetryRunner>
  └── fetchWithFailover()
        │
        ├─── CircuitBreaker.canExecute()
        │
        └─── RetryRunner(() => fn(source))
              │
              └─→ ErrorClassifier.classifyError()
```

## 5. 测试策略

### 5.1 单元测试

- `retry-policy.test.ts`: 测试 Retry 策略创建和配置
- `CircuitBreaker.test.ts`: 测试状态转换
- `ErrorClassifier.test.ts`: 测试错误分类

### 5.2 集成测试

- Retry + CircuitBreaker 协作流程
- 严重错误不重试
- 熔断恢复流程

### 5.3 Chaos 测试

- 模拟服务故障
- 模拟网络延迟
- 模拟 rate limit

## 6. 总结

### 改进成果

1. **代码简化**：移除 ~280 行 Cooldown 相关代码
2. **架构清晰**：职责分离，无协调问题
3. **遵循最佳实践**：使用 plugin-sdk，参考 Resilience4j
4. **维护性提升**：更少的代码，更清晰的职责

### 设计原则

1. **简单优于复杂**：双层保护足够
2. **复用而非重造**：使用 plugin-sdk Retry
3. **职责分离**：Retry 处理瞬时，CB 处理持续
4. **遵循最佳实践**：参考业界成熟方案

---

**文档版本**: 2.0 (简化版)  
**更新日期**: 2026-04-02  
**维护者**: meichao-ecom team  
**相关文档**: `/projects/openclaw/docs/集成/meichao-ecom-降级策略.md`
