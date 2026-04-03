# Capability: Degradation Executor

## Overview

统一降级执行器，协调 Retry + CircuitBreaker + CooldownManager，被所有工具共享。

**核心特性**：

- 执行降级逻辑（循环尝试数据源）
- 协调 Retry + CircuitBreaker + CooldownManager
- 记录决策日志
- 被多个工具共享（fetch, search, validate, etc.）
- 支持验证模式（测试所有数据源）

## Interface

```typescript
/**
 * 降级执行器
 */
class DegradationExecutor {
  /**
   * 构造函数
   */
  constructor(config: DegradationExecutorConfig);

  /**
   * 执行降级逻辑
   */
  async execute<T>(
    path: DegradationPath,
    fn: (source: DataSource) => Promise<T>,
    options?: DegradationOptions,
  ): Promise<DegradationResult<T>>;
}

/**
 * 降级执行器配置
 */
interface DegradationExecutorConfig {
  retryRunnerFactory: (platform: Platform) => RetryRunner;
  circuitBreakerConfig: CircuitBreakerConfig;
  errorClassifier: (error: unknown, platform: Platform) => ClassifiedError;
  cooldownManager: CooldownManager;
  decisionLogger: DecisionLogger;
  cooldownSettings?: CooldownSettings;
}

/**
 * 降级结果（泛型）
 */
interface DegradationResult<T> {
  success: boolean;
  data?: T;
  source?: DataSource;
  degradationLevel?: number;
  error?: ClassifiedError;
  attempts?: SourceAttempt[];
  latencyMs?: number;
  cached?: boolean;
}

/**
 * 数据源尝试记录
 */
interface SourceAttempt {
  sourceId: string;
  success: boolean;
  latencyMs?: number;
  error?: string;
}
```

## Behavior

### execute() 执行流程

```typescript
async execute<T>(
  path: DegradationPath,
  fn: (source: DataSource) => Promise<T>,
  options?: DegradationOptions,
): Promise<DegradationResult<T>> {

  // 1. 获取降级路径
  const sources = path.getPath(options);

  // 2. 循环尝试每个数据源
  const attempts: SourceAttempt[] = [];
  const startTime = Date.now();

  for (const source of sources) {
    const attemptStart = Date.now();

    // 3. 检查冷却状态（非验证模式）
    if (!options?.validateMode && this.cooldownManager.isInCooldown(source.id)) {
      this.decisionLogger.log({
        decision: "skip_cooldown_source",
        sourceId: source.id,
        ...
      });
      continue;
    }

    // 4. 检查 CircuitBreaker（非验证模式）
    const circuitBreaker = this.circuitBreakers.get(source.id);
    if (!options?.validateMode && circuitBreaker && !circuitBreaker.canExecute()) {
      this.decisionLogger.log({
        decision: "circuit_open",
        sourceId: source.id,
        ...
      });
      continue;
    }

    // 5. 使用 RetryRunner 执行
    const retryRunner = this.retryRunners.get(source.id);

    try {
      const data = await retryRunner(() => fn(source));

      attempts.push({
        sourceId: source.id,
        success: true,
        latencyMs: Date.now() - attemptStart,
      });

      // 6. 成功处理
      this.cooldownManager.recordSuccess(source.id);
      circuitBreaker?.recordSuccess();
      this.decisionLogger.log({
        decision: "source_succeeded",
        sourceId: source.id,
        ...
      });

      // 7. 正常模式：立即返回
      if (!options?.validateMode) {
        return {
          success: true,
          data,
          source,
          attempts,
          latencyMs: Date.now() - startTime,
        };
      }

      // 验证模式：继续测试所有数据源

    } catch (error) {
      // 8. 失败处理
      const classifiedError = this.errorClassifier(error, source.platform);

      attempts.push({
        sourceId: source.id,
        success: false,
        latencyMs: Date.now() - attemptStart,
        error: classifiedError.message,
      });

      this.cooldownManager.recordFailure(source.id, classifiedError);
      circuitBreaker?.recordFailure();
      this.decisionLogger.log({
        decision: "source_failed",
        sourceId: source.id,
        error: classifiedError,
        ...
      });

      // 验证模式：继续测试所有数据源
    }
  }

  // 9. 所有数据源失败
  return {
    success: false,
    attempts,
    error: attempts[attempts.length - 1]?.error,
    latencyMs: Date.now() - startTime,
  };
}
```

### 协调 Retry + CircuitBreaker + CooldownManager

```
┌─────────────────────────────────────────────────────────────────────────┐
│  协调流程                                                                 │
└─────────────────────────────────────────────────────────────────────────┘

执行前检查:
├── CooldownManager.isInCooldown(sourceId)
│   → 跳过冷却中的数据源
│
└── CircuitBreaker.isOpen(sourceId)
    → 跳过熔断的数据源

执行中使用 RetryRunner:
├── retryRunner.run(fn, retryConfig)
│   ├── 内部重试（如 3 次）
│   └── 每次重试间隔递增
│
└── 每次重试失败 → classifyError → 判断是否需要继续重试

执行后更新状态:
├── 成功:
│   ├── CooldownManager.recordSuccess(sourceId)
│   └── CircuitBreaker.recordSuccess(sourceId)
│
└── 失败:
    ├── CooldownManager.recordFailure(sourceId, classifiedError)
    └── CircuitBreaker.recordFailure(sourceId)
```

### 验证模式（validateMode）

```typescript
// 验证模式：测试所有数据源
const result = await executor.execute(
  path,
  async (source) => adapter.doFetchProduct(randomProductId, source),
  { validateMode: true }
);

// 返回所有数据源的测试结果
{
  success: true,
  attempts: [
    { sourceId: "taobao_official_api", success: true, latencyMs: 150 },
    { sourceId: "taobao_third_party_api", success: true, latencyMs: 200 },
    { sourceId: "taobao_skill_crawler", success: false, error: "timeout" },
  ],
  latencyMs: 350,
}
```

**验证模式特性**：

- 忽略冷却和熔断状态
- 测试所有数据源（不提前返回）
- 记录每个数据源的成功/失败
- 用于 ecom-validate-platform 工具

### 使用示例

```typescript
// 工具 1: ecom-product-fetch
const result1 = await executor.execute(
  path,
  async (source) => adapter.doFetchProduct(platformId, source),
  { maxSources: 3 },
);

// 工具 2: ecom-product-search
const result2 = await executor.execute(
  path,
  async (source) => adapter.doSearchProducts(keyword, source),
  { preset: "speed-optimized", allowOpenSearch: true },
);

// 工具 3: ecom-validate-platform
const result3 = await executor.execute(
  path,
  async (source) => adapter.doFetchProduct(randomProductId, source),
  { validateMode: true },
);

// 未来工具: ecom-product-compare
const results = await Promise.all([
  executor.execute(path, async (source) => adapter.doFetchProduct(id1, source), {
    preset: "speed-optimized",
  }),
  executor.execute(path, async (source) => adapter.doFetchProduct(id2, source), {
    preset: "speed-optimized",
  }),
]);
```

## Error Handling

- 所有数据源失败 → 返回 { success: false, error }
- RetryRunner 内部重试失败 → 记录失败，继续下一个数据源
- CircuitBreaker 熔断 → 跳过该数据源
- CooldownManager 冷却中 → 跳过该数据源

## Tests

1. **单数据源成功**: execute → 返回成功结果
2. **单数据源失败后降级**: primary 失败 → 尝试 fallback → 成功
3. **所有数据源失败**: 所有失败 → 返回错误
4. **冷却跳过**: isInCooldown=true → 跳过该数据源
5. **熔断跳过**: circuitBreaker.isOpen=true → 跳过该数据源
6. **错误分类**: classifyError → 正确识别错误类型
7. **决策日志**: 每次尝试都记录 decisionLog
8. **重试协调**: RetryRunner 内部重试 → 最终失败后降级
9. **验证模式**: validateMode=true → 测试所有数据源
10. **冷却窗口保持**: 冷却中失败 → 不延长冷却时间

## Dependencies

- `degradation-path` - DegradationPath
- `source-cooldown` - CooldownManager
- `failover-error-classification` - classifyError, ClassifiedError
- `degradation-decision-log` - DecisionLogger
- `../retry-policy.js` - RetryRunner
- `../circuit-breaker/CircuitBreaker.js` - CircuitBreaker
