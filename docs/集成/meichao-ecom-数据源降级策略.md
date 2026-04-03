# meichao-ecom 数据源降级策略

## 概述

meichao-ecom 采用多层降级策略，确保在数据源故障时仍能获取产品数据。系统通过 **Retry + CircuitBreaker** 双层保护机制，配合智能错误分类，实现从官方 API 到开放搜索的完整降级路径。

```
降级路径（优先级顺序）:
official_api → third_party_api → skill_crawler → open_search
```

## 核心架构

### 双层保护机制

```
┌─────────────────────────────────────────────────────────────────┐
│                     完整降级流程                                 │
└─────────────────────────────────────────────────────────────────┘

用户请求: fetchProduct("item123")
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  fetchWithFailover(fn, options)                                 │
├─────────────────────────────────────────────────────────────────┤
│  Step 1: 获取候选数据源                                          │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ getConfiguredSourceCandidates()                            │ │
│  │                                                            │ │
│  │ 1. 检查 sourceConfig (primary + fallbacks)                │ │
│  │ 2. 或使用默认优先级排序                                    │ │
│  │ 3. 过滤: isAvailable && hasRemainingQuota                 │ │
│  │ 4. 应用 preferredSource (如有)                            │ │
│  │ 5. 应用 skipSources 过滤                                  │ │
│  │ 6. 截取 maxSources (默认 3 个)                            │ │
│  │                                                            │ │
│  │ 结果: [                                                    │ │
│  │   {id: "taobao/official_api", priority: 1},               │ │
│  │   {id: "taobao/third_party_api", priority: 2},            │ │
│  │   {id: "taobao/skill_crawler", priority: 3},              │ │
│  │ ]                                                          │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: 循环尝试每个数据源                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  for (source of candidates) {                                   │
│      │                                                           │
│      ▼                                                           │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ CircuitBreaker 检查                                         ││
│  │                                                             ││
│  │ circuitBreaker.canExecute()?                               ││
│  │                                                             ││
│  │ ┌─────────┬──────────┬─────────────┬──────────────────┐   ││
│  │ │ CLOSED  │   OPEN   │  HALF-OPEN  │  Result          │   ││
│  │ ├─────────┼──────────┼─────────────┼──────────────────┤   ││
│  │ │ true    │  false   │ halfOpenCalls│ ✓ 执行 / ✗ 跳过 │   ││
│  │ │         │          │ < maxCalls   │                  │   ││
│  │ └─────────┴──────────┴─────────────┴──────────────────┘   ││
│  │                                                             ││
│  │ 如果 OPEN:                                                  ││
│  │   → log decision: "circuit_open"                           ││
│  │   → continue (尝试下一个数据源)                             ││
│  │                                                             ││
│  └────────────────────────────────────────────────────────────┘│
│      │                                                           │
│      ▼ (如果可执行)                                              │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ RetryRunner 执行                                            ││
│  │                                                             ││
│  │ retryRunner(() => fn(source))                              ││
│  │                                                             ││
│  │ 内部流程:                                                   ││
│  │ ┌──────────────────────────────────────────────────────┐ ││
│  │ │ for (attempt of [1, 2, 3]) {                          │ ││
│  │ │   try {                                                │ ││
│  │ │     result = await fn(source)                         │ ││
│  │ │     return result // ✓ 成功                           │ ││
│  │ │   } catch (error) {                                    │ ││
│  │ │     classified = classifyError(error, platform)       │ ││
│  │ │                                                         │ ││
│  │ │     if (isSevereError(classified.reason)) {           │ ││
│  │ │       throw error // ✗ 不重试, 立即失败              │ ││
│  │ │     }                                                  │ ││
│  │ │                                                         │ ││
│  │ │     // 非严重错误, 等待后重试                          │ ││
│  │ │     delay = exponentialBackoff(attempt)               │ ││
│  │ │     await sleep(delay)                                 │ ││
│  │ │   }                                                    │ ││
│  │ │ }                                                      │ ││
│  │ │ throw lastError // ✗ 所有重试失败                     │ ││
│  │ └──────────────────────────────────────────────────────┘ ││
│  │                                                             ││
│  │ Retry 参数:                                                 ││
│  │   attempts: 3                                              ││
│  │   minDelayMs: 500ms (Taobao) / 1000ms (Amazon)            ││
│  │   maxDelayMs: 30s (Taobao) / 60s (Amazon)                 ││
│  │   jitter: 0.1                                              ││
│  │                                                             ││
│  └────────────────────────────────────────────────────────────┘│
│      │                                                           │
│      ├─ 成功 ──▶ circuitBreaker.recordSuccess()                 │
│      │           updateDataSource(source.markAvailable())      │
│      │           return data                                    │
│      │                                                           │
│      └─ 失败 ──▶ circuitBreaker.recordFailure()                 │
│                  updateDataSource({ lastError })               │
│                  continue (尝试下一个数据源)                    │
│  }                                                              │
│                                                                  │
│  throw lastError // ✗ 所有数据源都失败                          │
└─────────────────────────────────────────────────────────────────┘
```

## 数据源类型与优先级

### Taobao 平台数据源

```
┌──────────────────────────────────────────────────────────────┐
│  Priority  │  Source ID                 │  Type              │
├────────────┼────────────────────────────┼────────────────────┤
│  1         │  taobao/official_api       │  official_api      │
│            │  淘宝官方 API               │  最可靠、最准确     │
│            │  成本: 中等                 │                    │
│            │  配额: 每日 10000 次        │                    │
├────────────┼────────────────────────────┼────────────────────┤
│  2         │  taobao/third_party_api    │  third_party_api   │
│            │  第三方 API 服务            │  较可靠            │
│            │  成本: 高                   │                    │
│            │  配额: 每日 5000 次         │                    │
├────────────┼────────────────────────────┼────────────────────┤
│  3         │  taobao/skill_crawler      │  skill_crawler     │
│            │  技能爬虫                   │  最不稳定          │
│            │  成本: 低                   │                    │
│            │  配额: 每日 2000 次         │                    │
├────────────┼────────────────────────────┼────────────────────┤
│  4         │  taobao/open_search        │  open_search       │
│            │  开放搜索 (Bing/Tavily)     │  搜索结果而非直接数据 │
│            │  成本: 低                   │                    │
│            │  配额: 无限制               │                    │
└──────────────────────────────────────────────────────────────┘
```

### Amazon 平台数据源

```
┌──────────────────────────────────────────────────────────────┐
│  Priority  │  Source ID                 │  Type              │
├────────────┼────────────────────────────┼────────────────────┤
│  1         │  amazon/official_api       │  official_api      │
│            │  Amazon 官方 API            │  Amazon PA-API     │
│            │  成本: 中等                 │                    │
│            │  配额: 每小时 1000 次       │                    │
├────────────┼────────────────────────────┼────────────────────┤
│  2         │  amazon/third_party_api    │  third_party_api   │
│            │  第三方 API 服务            │  Rainforest API    │
│            │  成本: 高                   │                    │
│            │  配额: 每日 10000 次        │                    │
└──────────────────────────────────────────────────────────────┘
```

### 数据源特性对比

```
┌─────────────────┬────────────┬────────────┬────────────┬────────────┐
│  特性           │  Official  │  Third     │  Crawler   │  Open      │
│                 │  API       │  Party     │            │  Search    │
├─────────────────┼────────────┼────────────┼────────────┼────────────┤
│  数据准确性     │  ★★★★★    │  ★★★★     │  ★★★      │  ★★       │
│  数据完整性     │  ★★★★★    │  ★★★★     │  ★★       │  ★        │
│  响应速度       │  ★★★★     │  ★★★      │  ★★       │  ★★★     │
│  稳定性         │  ★★★★★    │  ★★★★     │  ★★       │  ★★★★    │
│  成本           │  中        │  高        │  低        │  低        │
│  配额限制       │  有        │  有        │  有        │  无        │
│  反爬风险       │  无        │  无        │  高        │  无        │
│  维护难度       │  低        │  低        │  高        │  低        │
└─────────────────┴────────────┴────────────┴────────────┴────────────┘
```

## CircuitBreaker 状态机

### 状态转换流程

```
                    ┌──────────────┐
                    │              │
        ┌──────────▶│   CLOSED     │◀──────────┐
        │           │  (正常状态)   │           │
        │           │              │           │
        │           │  canExecute: │           │
        │           │    ✓ true    │           │
        │           │              │           │
        │           └──────┬───────┘           │
        │                  │                   │
        │  successThreshold │   failureThreshold │
        │  达标 (3次成功)    │   达标 (5次失败)   │
        │                  │                   │
        │                  ▼                   │
        │           ┌──────────────┐           │
        │           │              │           │
        │           │  HALF-OPEN   │           │
        │           │  (试探状态)   │           │
        │           │              │           │
        │           │  canExecute: │           │
        │           │  halfOpenCalls│           │
        │           │  < maxCalls  │           │
        │           │  (10次)      │           │
        │           │              │           │
        │           └──────┬───────┘           │
        │                  │                   │
        │                  │  任何失败         │
        │                  │                   │
        │                  ▼                   │
        │           ┌──────────────┐           │
        │           │              │           │
        │           │    OPEN      │           │
        │           │  (熔断状态)   │           │
        │           │              │           │
        │           │  canExecute: │           │
        │           │    ✗ false   │           │
        │           │              │           │
        │           │  等待 60 秒   │           │
        │           │  自动转 HALF │           │
        │           │  -OPEN       │           │
        │           └──────┬───────┘           │
        │                  │                   │
        │       openDuration │                 │
        │       过期 (60s)   │                 │
        │                  │                   │
        └──────────────────┴───────────────────┘
```

### 配置参数

```typescript
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  enabled: true,
  failureThreshold: 5, // CLOSED → OPEN 触发阈值
  openDuration: 60000, // OPEN 持续时间 (60s)
  halfOpenMaxCalls: 10, // HALF-OPEN 允许试探次数
  successThreshold: 3, // HALF-OPEN → CLOSED 恢复阈值
};
```

### 状态说明

| 状态      | 说明     | canExecute | 行为                                                         |
| --------- | -------- | ---------- | ------------------------------------------------------------ |
| CLOSED    | 正常状态 | ✓ true     | 允许所有请求，记录成功/失败次数                              |
| OPEN      | 熔断状态 | ✗ false    | 拒绝所有请求，等待 60s 后自动转 HALF-OPEN                    |
| HALF-OPEN | 试探状态 | ✓ 受限     | 允许最多 10 次试探请求，成功 3 次 → CLOSED，失败 1 次 → OPEN |

## 错误分类机制

### 错误类型与决策矩阵

```
┌─────────────────┬───────────────────┬─────────────────┬─────────┬─────────────┐
│  Error Type     │  Reason           │  Is Severe?     │  Retry? │  Fallback?  │
├─────────────────┼───────────────────┼─────────────────┼─────────┼─────────────┤
│  HTTP 401       │  auth             │  ✗ No           │  ✓ Yes  │  ✓ Yes      │
│  HTTP 403       │  blocked          │  ✓ Yes (SEVERE) │  ✗ No   │  ✗ No       │
│  HTTP 404       │  not_found        │  ✗ No           │  ✗ No   │  ✗ No       │
│  HTTP 429       │  rate_limit       │  ✗ No           │  ✓ Yes  │  ✓ Yes      │
│  HTTP 500/502   │  overloaded       │  ✗ No           │  ✓ Yes  │  ✓ Yes      │
│  HTTP 503       │  overloaded       │  ✗ No           │  ✓ Yes  │  ✓ Yes      │
│  HTTP 504       │  timeout          │  ✗ No           │  ✓ Yes  │  ✓ Yes      │
├─────────────────┼───────────────────┼─────────────────┼─────────┼─────────────┤
│  Taobao         │                   │                 │         │             │
│  isp.session-   │  auth             │  ✗ No           │  ✓ Yes  │  ✓ Yes      │
│  expired        │                   │                 │         │             │
│  isp.rate-limit │  rate_limit       │  ✗ No           │  ✓ Yes  │  ✓ Yes      │
│  isp.isv-account│  auth_permanent   │  ✓ Yes (SEVERE) │  ✗ No   │  ✗ No       │
│  -frozen        │                   │                 │         │             │
│  isp.item-not-  │  not_found        │  ✗ No           │  ✗ No   │  ✗ No       │
│  found          │                   │                 │         │             │
├─────────────────┼───────────────────┼─────────────────┼─────────┼─────────────┤
│  Node Errors    │                   │                 │         │             │
│  ETIMEDOUT      │  timeout          │  ✗ No           │  ✓ Yes  │  ✓ Yes      │
│  ECONNREFUSED   │  overloaded       │  ✗ No           │  ✓ Yes  │  ✓ Yes      │
│  ECONNRESET     │  overloaded       │  ✗ No           │  ✓ Yes  │  ✓ Yes      │
├─────────────────┼───────────────────┼─────────────────┼─────────┼─────────────┤
│  Special        │                   │                 │         │             │
│  Captcha        │  captcha          │  ✗ No           │  ✗ No   │  ✓ Yes      │
│  Billing Error  │  billing          │  ✓ Yes (SEVERE) │  ✗ No   │  ✗ No       │
└─────────────────┴───────────────────┴─────────────────┴─────────┴─────────────┘
```

### 严重错误定义

```typescript
export const SEVERE_FAILOVER_REASONS: DataSourceFailoverReason[] = [
  "auth_permanent", // 账号永久冻结，所有数据源都无法使用
  "billing", // 计费问题，所有数据源都无法使用
  "blocked", // IP 被封禁，所有数据源都无法使用
];
```

**严重错误特性**:

- ✗ 不重试 (所有数据源都会遇到相同问题)
- ✗ 不尝试 fallback (问题不是数据源特有的)
- ✓ 立即返回错误给调用者

### 非严重错误特性

**重试策略**:

- ✓ RetryRunner 内部重试 (最多 3 次)
- ✓ Exponential backoff (500ms → 30s)
- ✓ 如果仍失败，尝试下一个数据源

**降级决策**:

- ✓ 标记当前数据源失败
- ✓ CircuitBreaker 记录失败次数
- ✓ 尝试下一个优先级的数据源

## Retry 机制

### Retry 配置

```typescript
// Taobao Retry Defaults
export const TAOBAO_RETRY_DEFAULTS: Required<RetryConfig> = {
  attempts: 3, // 最多 3 次重试
  minDelayMs: 500, // 最小延迟 500ms
  maxDelayMs: 30_000, // 最大延迟 30s
  jitter: 0.1, // 10% 抖动避免同步重试
};

// Amazon Retry Defaults
export const AMAZON_RETRY_DEFAULTS: Required<RetryConfig> = {
  attempts: 3, // 最多 3 次重试
  minDelayMs: 1000, // 最小延迟 1000ms
  maxDelayMs: 60_000, // 最大延迟 60s
  jitter: 0.1, // 10% 抖动
};
```

### Exponential Backoff 算法

```
Attempt 1: delay = minDelayMs * (2^0) + jitter
         = 500ms + 50ms (jitter)
         = ~550ms

Attempt 2: delay = minDelayMs * (2^1) + jitter
         = 1000ms + 100ms (jitter)
         = ~1100ms

Attempt 3: delay = minDelayMs * (2^2) + jitter
         = 2000ms + 200ms (jitter)
         = ~2200ms

最大延迟限制: maxDelayMs (30s for Taobao, 60s for Amazon)
```

### Retry Runner 实现

```typescript
export function createTaobaoRetryRunner(params?: {
  retry?: RetryConfig;
  verbose?: boolean;
}): RetryRunner {
  return createRateLimitRetryRunner({
    retry: params?.retry,
    defaults: TAOBAO_RETRY_DEFAULTS,
    logLabel: "taobao",
    shouldRetry: (err) => {
      const classified = classifyError(err, "taobao");
      return !isSevereError(classified.reason); // 严重错误不重试
    },
    verbose: params?.verbose,
  });
}
```

## 决策日志

### 日志结构

```typescript
export interface DegradationDecisionLog {
  event: "degradation_decision";
  decision: DegradationDecision;
  runId: string; // 请求唯一标识
  timestamp: number; // 时间戳
  platform: string; // 平台 (taobao, amazon)
  productId: string; // 产品 ID
  source: {
    id: string; // 数据源 ID
    type: DataSourceType; // 数据源类型
    priority: number; // 优先级
  };
  error?: {
    reason: DataSourceFailoverReason; // 错误分类
    message: string; // 错误消息
    status?: number; // HTTP 状态码
    code?: string; // 平台错误码
  };
  circuitBreaker?: {
    state: CircuitBreakerState; // 熔断器状态
    failureCount: number; // 失败次数
  };
  latencyMs: number; // 响应延迟
  degradationLevel?: number; // 降级层级
}
```

### 决策类型

```typescript
export type DegradationDecision =
  | "source_failed" // 数据源失败，尝试下一个
  | "source_succeeded" // 数据源成功，返回数据
  | "circuit_open" // CircuitBreaker OPEN，跳过该数据源
  | "fallback_to_stale"; // 所有数据源失败，使用过期缓存
```

### 日志示例

```json
{
  "event": "degradation_decision",
  "decision": "source_failed",
  "runId": "run_1234567890_abc123",
  "timestamp": 1712345678901,
  "platform": "taobao",
  "productId": "item123",
  "source": {
    "id": "taobao/official_api",
    "type": "official_api",
    "priority": 1
  },
  "error": {
    "reason": "rate_limit",
    "message": "isp.rate-limit-exceeded",
    "code": "isp.rate-limit-exceeded"
  },
  "circuitBreaker": {
    "state": "closed",
    "failureCount": 3
  },
  "latencyMs": 1500
}
```

## 配置示例

### 数据源配置

```typescript
const dataCollectionConfig: DataCollectionConfig = {
  default: {
    primary: "taobao/official_api",
    fallbacks: ["taobao/third_party_api", "taobao/skill_crawler"],
  },
  platforms: {
    taobao: {
      primary: "taobao/official_api",
      fallbacks: ["taobao/third_party_api", "taobao/skill_crawler"],
    },
    amazon: {
      primary: "amazon/official_api",
      fallbacks: ["amazon/third_party_api"],
    },
  },
  settings: {
    maxFallbackSources: 3, // 最多尝试 3 个数据源
    enableStaleCache: true, // 启用过期缓存
    staleCacheMaxAge: 3600000, // 过期缓存最大年龄 1 小时
    circuitBreaker: {
      failureThreshold: 5, // 5 次失败触发熔断
      openDuration: 60000, // 熔断持续 60 秒
      halfOpenMaxCalls: 10, // HALF-OPEN 允许 10 次试探
      successThreshold: 3, // 3 次成功恢复
    },
  },
};
```

### Adapter 使用示例

```typescript
// 创建 Adapter
const adapter = await TaobaoAdapter.create({
  dataSources: [
    DataSource.create({
      id: "taobao/official_api",
      platform: "taobao",
      type: "official_api",
      priority: 1,
      costPerCall: 0.01,
      dailyQuota: 10000,
    }),
    DataSource.create({
      id: "taobao/third_party_api",
      platform: "taobao",
      type: "third_party_api",
      priority: 2,
      costPerCall: 0.05,
      dailyQuota: 5000,
    }),
    DataSource.create({
      id: "taobao/skill_crawler",
      platform: "taobao",
      type: "skill_crawler",
      priority: 3,
      costPerCall: 0.001,
      dailyQuota: 2000,
    }),
  ],
  sourceConfig: {
    primary: "taobao/official_api",
    fallbacks: ["taobao/third_party_api", "taobao/skill_crawler"],
  },
  settings: {
    maxFallbackSources: 3,
    circuitBreaker: {
      failureThreshold: 5,
      openDuration: 60000,
    },
  },
});

// 获取产品数据
const result = await adapter.fetchProduct("item123");
```

## 最佳实践

### 1. 配置合理的 fallback 数量

```
推荐配置:
  maxFallbackSources: 3

原因:
  - 太少 (1-2): 降级选项不足，容易彻底失败
  - 太多 (>5): 增加延迟，浪费配额
  - 适中 (3): 平衡可靠性和性能
```

### 2. 根据平台特性调整 Retry 参数

```
Taobao:
  - minDelayMs: 500ms    (淘宝 API 相对稳定)
  - maxDelayMs: 30s      (避免过长等待)

Amazon:
  - minDelayMs: 1000ms   (Amazon API 限流严格)
  - maxDelayMs: 60s      (等待更长时间恢复)
```

### 3. 监控 CircuitBreaker 状态

```typescript
// 定期检查熔断器状态
const health = await adapter.healthCheck();
console.log({
  isHealthy: health.isHealthy,
  availableSources: health.availableSources,
  errors: health.errors,
});

// 获取特定数据源的熔断器状态
const cbState = adapter.circuitBreakers.get("taobao/official_api")?.getState();
console.log(`Official API CircuitBreaker: ${cbState}`);
```

### 4. 处理严重错误

```typescript
try {
  const result = await adapter.fetchProduct("item123");
} catch (error) {
  const classified = classifyError(error, "taobao");

  if (classified.isSevere) {
    // 严重错误: 所有数据源都无法使用
    // 建议: 停止请求，通知运维团队
    console.error("SEVERE ERROR:", classified.reason);
    await notifyOpsTeam(classified);
  } else {
    // 非严重错误: 可能是临时问题
    // 建议: 等待后重试
    console.warn("TEMPORARY ERROR:", classified.reason);
  }
}
```

### 5. 使用决策日志进行故障分析

```typescript
// 获取最近的降级决策日志
const logs = adapter.decisionLogger.getLogs();

// 分析失败原因
const failuresByReason = logs
  .filter((log) => log.decision === "source_failed")
  .reduce((acc, log) => {
    const reason = log.error?.reason || "unknown";
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {});

console.log("Failure Analysis:", failuresByReason);
// Output:
// {
//   "rate_limit": 15,
//   "timeout": 8,
//   "overloaded": 5
// }
```

## 性能指标

### 降级路径性能对比

```
┌─────────────────┬────────────┬────────────┬────────────┬────────────┐
│  Metric         │  Official  │  Third     │  Crawler   │  Open      │
│                 │  API       │  Party     │            │  Search    │
├─────────────────┼────────────┼────────────┼────────────┼────────────┤
│  Avg Latency    │  ~200ms    │  ~500ms    │  ~2000ms   │  ~1000ms   │
│  Success Rate   │  95%       │  90%       │  70%       │  85%       │
│  Retry Rate     │  5%        │  10%       │  30%       │  15%       │
│  CircuitBreak   │  Rare      │  Occasional│  Frequent  │  Rare      │
│  Trigger Rate   │            │            │            │            │
└─────────────────┴────────────┴────────────┴────────────┴────────────┘
```

### 降级路径延迟估算

```
完整降级路径延迟 (所有数据源失败):

  Official API (3 retries + CircuitBreaker):
    = 3 * (attempt_time + backoff_delay)
    = 3 * (500ms + exponential_backoff)
    = ~10s (worst case)

  Third Party API (3 retries + CircuitBreaker):
    = ~10s

  Skill Crawler (3 retries + CircuitBreaker):
    = ~10s

  Total: ~30s (所有数据源失败的最坏情况)

理想情况 (Official API 成功):
  = 1 * attempt_time
  = ~200ms

降级到 Third Party API:
  = Official API (失败) + Third Party API (成功)
  = ~10s + ~500ms
  = ~10.5s
```

## 监控与告警

### 关键监控指标

```
1. 数据源成功率
   - metric: source_success_rate
   - threshold: < 70% 需告警

2. CircuitBreaker OPEN 频率
   - metric: circuit_breaker_open_count
   - threshold: > 5 次/小时 需告警

3. 降级路径使用频率
   - metric: fallback_usage_rate
   - threshold: > 30% 需告警

4. 平均响应延迟
   - metric: avg_response_latency_ms
   - threshold: > 5000ms 需告警

5. 严重错误频率
   - metric: severe_error_count
   - threshold: > 1 次 需立即告警
```

### 建议的告警策略

```
SEVERE_ERROR_ALERT:
  - 触发条件: 任何严重错误
  - 响应: 立即通知运维团队
  - 动作: 检查账号状态、IP 状态、计费状态

CIRCUIT_BREAKER_ALERT:
  - 触发条件: CircuitBreaker OPEN > 5 次/小时
  - 响应: 通知开发团队
  - 动作: 检查 API 健康状态、调整配置

FALLBACK_RATE_ALERT:
  - 触发条件: Fallback 使用率 > 30%
  - 响应: 通知开发团队
  - 动作: 检查主数据源稳定性、调整优先级

LATENCY_ALERT:
  - 触发条件: 平均延迟 > 5000ms
  - 响应: 通知开发团队
  - 动作: 优化数据源、减少 fallback 深度
```

## 未来扩展

### 待实现功能

```
┌─────────────────────┬────────────────────┬───────────────────────────┐
│  功能               │  当前状态          │  OpenSpec Change          │
├─────────────────────┼────────────────────┼───────────────────────────┤
│  Health Score       │  ✗ 未实现          │  smart-source-selection   │
│  Strategy Selection │  ✗ 未实现          │  smart-source-selection   │
│  Database Freshness │  ✗ 未实现          │  database-freshness-check │
│  Cache Layer        │  ✗ 未实现          │  meichao-ecom-improvements │
│  Transactional Repo │  ✗ 有 bug          │  meichao-ecom-improvements │
│  Unified Config     │  ✗ 分散            │  meichao-ecom-improvements │
└─────────────────────┴────────────────────┴───────────────────────────┘
```

### 理想的完整降级路径

```
Fresh Cache (< 1h)
    │
    ▼
Database (< 24h)
    │
    ▼
Primary Source (official_api)
    │
    ▼
Fallback Source (third_party_api)
    │
    ▼
Stale Cache (> 24h, but < 7 days)
    │
    ▼
Error
```

### 智能数据源选择策略

```
┌──────────────────────────────────────────────────────────────┐
│  SourceSelectionStrategy                                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Priority Strategy (当前实现):                               │
│    - 选择顺序: priority ASC                                  │
│    - 适用场景: 简单、稳定环境                                │
│                                                              │
│  Cost-First Strategy (待实现):                               │
│    - 选择顺序: costPerCall ASC                               │
│    - 适用场景: 成本敏感、配额充足                            │
│                                                              │
│  Reliability-First Strategy (待实现):                        │
│    - 选择顺序: healthScore DESC                              │
│    - 适用场景: 高可靠性需求、不稳定环境                      │
│                                                              │
│  Health Score 计算公式:                                      │
│    healthScore = successRate * 0.7 +                        │
│                  latencyScore * 0.2 +                        │
│                  circuitBreakerBonus * 0.1                   │
│                                                              │
│    successRate = successCount / (successCount + failureCount) │
│    latencyScore = 1 - (avgLatency / maxAcceptableLatency)   │
│    circuitBreakerBonus = 1 if CLOSED else 0                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## 参考文档

- [OpenClaw Plugin SDK 使用指南](./OpenClaw-Plugin-SDK-使用指南.md)
- [meichao-ecom 熔断与冷却机制设计](./meichao-ecom-熔断与冷却机制设计.md)
- [meichao-ecom 架构优化技术报告](./meichao-ecom-架构优化技术报告.md)

---

**文档版本**: v1.0  
**最后更新**: 2026-04-02  
**作者**: OpenClaw Team
