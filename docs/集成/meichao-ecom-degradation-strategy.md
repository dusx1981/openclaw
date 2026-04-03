# 美潮电商插件降级策略技术文档

## 概述

美潮电商插件实现了多级数据降级策略，确保在外部 API 不稳定时仍能获取数据。降级策略由熔断器 (Circuit Breaker)、冷却管理器 (Cooldown Manager)、错误分类器 (Error Classifier) 三大核心组件协同工作。

## 降级层级

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         数据获取优先级                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Level 1: fresh_cache (新鲜缓存)                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  条件：缓存存在且未过期                                          │   │
│  │  延迟：< 10ms                                                    │   │
│  │  数据新鲜度：100%                                                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                         ↓ 失败                                          │
│                                                                         │
│  Level 2: database (数据库)                                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  条件：数据库存在历史数据                                        │   │
│  │  延迟：< 50ms                                                    │   │
│  │  数据新鲜度：取决于上次更新时间                                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                         ↓ 失败                                          │
│                                                                         │
│  Level 3: primary_source (主要数据源)                                   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  条件：官方 API 可用、熔断器关闭、未在冷却中                     │   │
│  │  延迟：100-2000ms                                                │   │
│  │  数据新鲜度：100%                                                │   │
│  │  示例：taobao/official_api, amazon/official_api                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                         ↓ 失败                                          │
│                                                                         │
│  Level 4: fallback_source (备用数据源)                                  │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  条件：第三方 API 可用、熔断器关闭、未在冷却中                   │   │
│  │  延迟：200-3000ms                                                │   │
│  │  数据新鲜度：95-100%                                             │   │
│  │  示例：taobao/third_party_api, taobao/skill_crawler              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                         ↓ 失败                                          │
│                                                                         │
│  Level 5: stale_cache (过期缓存)                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  条件：缓存存在但已过期                                         │   │
│  │  延迟：< 10ms                                                    │   │
│  │  数据新鲜度：取决于过期时间，可能 1-24 小时旧                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                         ↓ 失败                                          │
│                                                                         │
│  Level 6: error (错误)                                                  │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  条件：所有数据源都失败                                         │   │
│  │  返回错误信息                                                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 核心组件

### 1. 熔断器 (Circuit Breaker)

熔断器防止故障数据源持续被调用，实现快速失败。

**状态机**：

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       熔断器状态机                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                    失败次数 >= 阈值 (5次)                               │
│          ┌────────────────────────────────────┐                        │
│          │                                    │                        │
│          ▼                                    │                        │
│   ┌──────────────┐                    ┌──────────────┐                │
│   │   CLOSED     │                    │     OPEN     │                │
│   │   (关闭)     │ ─────────────────▶ │    (打开)    │                │
│   │              │                    │              │                │
│   │ 允许所有请求 │                    │ 拒绝所有请求 │                │
│   └──────────────┘                    └──────────────┘                │
│          ▲                                    │                        │
│          │                                    │                        │
│          │         成功次数 >= 阈值 (3次)     │ 超时后 (30s)           │
│          │         ┌────────────────────┐    │                        │
│          │         │                    │    │                        │
│          │         ▼                    │    │                        │
│          │  ┌──────────────┐            │    │                        │
│          └──│  HALF-OPEN   │◀───────────┘    │                        │
│             │  (半开)      │                  │                        │
│             │              │──────────────────┘                        │
│             │ 允许有限请求 │  失败时立即打开                            │
│             └──────────────┘                                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**配置参数**：

```typescript
interface CircuitBreakerConfig {
  enabled: boolean; // 是否启用熔断器
  failureThreshold: number; // 失败阈值 (默认 5)
  openDuration: number; // 打开持续时间 (默认 30000ms)
  halfOpenMaxCalls: number; // 半开状态最大调用次数 (默认 1)
  successThreshold: number; // 成功阈值，关闭熔断器 (默认 3)
}
```

**核心 API**：

```typescript
class CircuitBreaker {
  // 获取当前状态
  getState(): "closed" | "open" | "half-open";

  // 是否可以执行请求
  canExecute(): boolean;

  // 记录成功
  recordSuccess(): void;

  // 记录失败
  recordFailure(): void;

  // 重置熔断器
  reset(): void;
}
```

### 2. 冷却管理器 (Cooldown Manager)

冷却管理器在数据源失败后暂时停止调用，避免频繁重试。

**冷却策略**：

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        冷却时间计算                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  普通错误冷却时间：                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  基础时间: 5 分钟                                                │   │
│  │  最大时间: 60 分钟                                               │   │
│  │  计算公式: baseMinutes * 5^(errorCount - 1)                     │   │
│  │                                                                  │   │
│  │  第 1 次错误: 5 分钟                                             │   │
│  │  第 2 次错误: 25 分钟                                            │   │
│  │  第 3 次错误: 60 分钟 (达到上限)                                 │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  严重错误冷却时间：                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  基础时间: 60 分钟 (5 * 12 严重倍数)                             │   │
│  │  最大时间: 1440 分钟 (24 小时)                                   │   │
│  │                                                                  │   │
│  │  严重错误类型:                                                   │   │
│  │  - auth_permanent (永久认证失败)                                 │   │
│  │  - billing (计费问题)                                           │   │
│  │  - blocked (被封禁)                                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  探测机制：                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  在冷却结束前 2 分钟内，允许尝试探测请求                         │   │
│  │  探测间隔: 最少 30 秒                                            │   │
│  │  条件: 必须是主数据源且有备用数据源                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**配置参数**：

```typescript
interface CooldownSettings {
  baseMinutes: number; // 基础冷却时间 (默认 5)
  maxMinutes: number; // 最大冷却时间 (默认 60)
  severeMultiplier: number; // 严重错误倍数 (默认 12)
  probeWindowMinutes: number; // 探测窗口 (默认 2)
  probeMinIntervalSeconds: number; // 探测最小间隔 (默认 30)
}
```

**核心 API**：

```typescript
interface CooldownManager {
  // 数据源是否在冷却中
  isInCooldown(sourceId: string): boolean;

  // 获取冷却状态
  getCooldownState(sourceId: string): SourceCooldownState;

  // 是否可以探测
  canProbe(sourceId: string, hasFallback: boolean, isPrimary: boolean): boolean;

  // 记录成功
  recordSuccess(sourceId: string): void;

  // 记录错误
  recordError(sourceId: string, reason: DataSourceFailoverReason): void;

  // 记录探测尝试
  recordProbeAttempt(sourceId: string): void;

  // 获取剩余冷却时间
  getCooldownRemaining(sourceId: string): number | undefined;
}
```

### 3. 错误分类器 (Error Classifier)

错误分类器根据错误类型决定降级策略。

**错误分类**：

```typescript
type DataSourceFailoverReason =
  | "auth" // 认证失败
  | "auth_permanent" // 永久认证失败 (严重)
  | "rate_limit" // 速率限制
  | "overloaded" // 服务过载
  | "billing" // 计费问题 (严重)
  | "timeout" // 超时
  | "not_found" // 资源不存在
  | "blocked" // 被封禁 (严重)
  | "captcha" // 验证码
  | "unknown"; // 未知错误
```

**HTTP 状态码映射**：

| 状态码      | 失败原因   |
| ----------- | ---------- |
| 401         | auth       |
| 403         | blocked    |
| 404         | not_found  |
| 429         | rate_limit |
| 500/502/503 | overloaded |
| 504         | timeout    |

**平台特定错误码映射**：

```typescript
// 淘宝错误码
const TAOBAO_ERROR_CODES = {
  "isp.session-not-exist": "auth",
  "isp.session-expired": "auth",
  "isp.insufficient-isv-permissions": "auth_permanent",
  "isp.isv-account-frozen": "auth_permanent",
  "isp.api-service-overloaded": "overloaded",
  "isp.rate-limit-exceeded": "rate_limit",
  "isp.item-not-found": "not_found",
};

// Amazon 错误码
const AMAZON_ERROR_CODES = {
  ThrottlingException: "rate_limit",
  AccessDenied: "auth",
  UnauthorizedAccess: "auth",
  ResourceNotFound: "not_found",
  ServiceUnavailable: "overloaded",
};
```

**核心 API**：

```typescript
function classifyError(error: unknown, platform?: string): ClassifiedError {
  return {
    reason: DataSourceFailoverReason,  // 失败原因
    originalError: Error,               // 原始错误
    message: string,                    // 错误消息
    status?: number,                    // HTTP 状态码
    code?: string,                      // 平台错误码
    isSevere: boolean,                  // 是否严重错误
  };
}
```

## 降级流程

### 完整降级流程

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     fetchWithFailover 降级流程                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. 获取候选数据源列表                                                  │
│     ┌───────────────────────────────────────────────────────────────┐  │
│     │  candidates = [primary, fallback1, fallback2, ...]            │  │
│     │  最多 maxSources (默认 3) 个                                   │  │
│     └───────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  2. 遍历候选数据源                                                      │
│     ┌───────────────────────────────────────────────────────────────┐  │
│     │  FOR each source IN candidates:                               │  │
│     │                                                               │  │
│     │    2.1 检查熔断器                                             │  │
│     │    ┌─────────────────────────────────────────────────────┐   │  │
│     │    │  IF circuitBreaker.canExecute() === false:          │   │  │
│     │    │    LOG "circuit_open"                               │   │  │
│     │    │    CONTINUE  // 跳过此数据源                        │   │  │
│     │    └─────────────────────────────────────────────────────┘   │  │
│     │                                                               │  │
│     │    2.2 检查冷却状态                                           │  │
│     │    ┌─────────────────────────────────────────────────────┐   │  │
│     │    │  IF isInCooldown(sourceId):                         │   │  │
│     │    │    IF canProbe(sourceId):                           │   │  │
│     │    │      LOG "probe_source"                             │   │  │
│     │    │      recordProbeAttempt(sourceId)                   │   │  │
│     │    │      // 继续尝试请求                                 │   │  │
│     │    │    ELSE:                                             │   │  │
│     │    │      LOG "skip_cooldown_source"                     │   │  │
│     │    │      CONTINUE  // 跳过此数据源                      │   │  │
│     │    └─────────────────────────────────────────────────────┘   │  │
│     │                                                               │  │
│     │    2.3 执行请求                                               │  │
│     │    ┌─────────────────────────────────────────────────────┐   │  │
│     │    │  TRY:                                                  │   │  │
│     │    │    data = await fetch(source)                        │   │  │
│     │    │    circuitBreaker.recordSuccess()                    │   │  │
│     │    │    cooldownManager.recordSuccess(sourceId)           │   │  │
│     │    │    RETURN { data, source, degradationLevel }         │   │  │
│     │    │                                                        │   │  │
│     │    │  CATCH error:                                          │   │  │
│     │    │    classified = classifyError(error)                  │   │  │
│     │    │    circuitBreaker.recordFailure()                     │   │  │
│     │    │    cooldownManager.recordError(sourceId, reason)     │   │  │
│     │    │    LOG "source_failed"                                 │   │  │
│     │    │    CONTINUE  // 尝试下一个数据源                      │   │  │
│     │    └─────────────────────────────────────────────────────┘   │  │
│     │                                                               │  │
│     │  END FOR                                                      │  │
│     └───────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  3. 所有数据源都失败                                                    │
│     ┌───────────────────────────────────────────────────────────────┐  │
│     │  THROW "No available data sources"                            │  │
│     └───────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### UseCase 层降级流程

```typescript
class FetchProductUseCase {
  async execute(platform: Platform, platformId: string): Promise<Result> {
    // Level 1: 检查新鲜缓存
    const cached = await cacheProvider.getProductWithFallback(platform, platformId);
    if (cached && !cached.isStale) {
      return { data: cached.data, sourceType: "fresh_cache", levelNumber: 1 };
    }

    // 保存过期缓存作为最后备选
    const staleFallback = cached?.isStale ? cached : null;

    // Level 2: 检查数据库
    const existing = await repository.findByPlatformId(platform, platformId);
    if (existing) {
      return { data: existing, sourceType: "database", levelNumber: 2 };
    }

    // Level 3/4: 调用 API (含故障转移)
    const result = await gateway.fetchProduct(platformId);
    if (result.success) {
      return {
        data: result.data,
        sourceType:
          result.degradationLevel === "fallback_source" ? "fallback_source" : "primary_source",
        levelNumber: 3,
        isDegraded: result.degradationLevel === "fallback_source",
      };
    }

    // Level 5: 使用过期缓存
    if (staleFallback) {
      return {
        data: staleFallback.data,
        sourceType: "stale_cache",
        levelNumber: 4,
        isDegraded: true,
      };
    }

    // Level 6: 错误
    return { data: null, sourceType: "error", levelNumber: 5, error: result.error };
  }
}
```

## 数据源配置

### 配置结构

```typescript
interface DataCollectionConfig {
  // 默认配置
  default?: PlatformDataSourceConfig;

  // 按平台配置
  platforms?: Partial<Record<Platform, PlatformDataSourceConfig>>;

  // 全局设置
  settings?: DataCollectionSettings;
}

type PlatformDataSourceConfig =
  | string // 单个数据源 ID
  | {
      primary?: string; // 主数据源
      fallbacks?: string[]; // 备用数据源列表
    };
```

### 默认配置

```typescript
const DEFAULT_CONFIG = {
  taobao: {
    primary: "taobao/official_api",
    fallbacks: ["taobao/third_party_api", "taobao/skill_crawler"],
  },
  amazon: {
    primary: "amazon/official_api",
    fallbacks: ["amazon/third_party_api"],
  },
  douyin: "douyin/skill_crawler",
};
```

### 数据源 ID 格式

```
<platform>/<source_type>

示例：
- taobao/official_api     (淘宝官方 API)
- taobao/third_party_api  (淘宝第三方 API)
- taobao/skill_crawler    (淘宝爬虫)
- amazon/official_api     (Amazon 官方 API)
```

## 决策日志

每次降级决策都会记录日志，用于分析和调试：

```typescript
interface DegradationDecisionLog {
  event: "degradation_decision";
  decision: DegradationDecision;
  runId: string;
  timestamp: number;
  platform: string;
  productId: string;
  source: {
    id: string;
    type: DataSourceType;
    priority: number;
  };
  error?: {
    reason: DataSourceFailoverReason;
    message: string;
    status?: number;
    code?: string;
  };
  cooldown?: {
    errorCount: number;
    cooldownUntil: number;
    willProbe: boolean;
  };
  circuitBreaker?: {
    state: CircuitBreakerState;
    failureCount: number;
  };
  latencyMs: number;
}

type DegradationDecision =
  | "skip_cooldown_source" // 跳过冷却中的数据源
  | "probe_source" // 探测冷却中的数据源
  | "source_failed" // 数据源失败
  | "source_succeeded" // 数据源成功
  | "circuit_open" // 熔断器打开
  | "fallback_to_stale"; // 回退到过期缓存
```

## 相关文件

| 文件路径                                               | 说明                                 |
| ------------------------------------------------------ | ------------------------------------ |
| `src/infrastructure/adapters/BasePlatformAdapter.ts`   | 基础适配器，实现 `fetchWithFailover` |
| `src/infrastructure/circuit-breaker/CircuitBreaker.ts` | 熔断器实现                           |
| `src/infrastructure/cooldown/CooldownManager.ts`       | 冷却管理器实现                       |
| `src/infrastructure/classification/ErrorClassifier.ts` | 错误分类器实现                       |
| `src/domain/data-source-config.ts`                     | 数据源配置和默认值                   |
| `src/domain/types.ts`                                  | 领域类型定义                         |
| `src/application/use-cases/FetchProductUseCase.ts`     | 获取商品用例                         |
| `src/infrastructure/logging/DecisionLogger.ts`         | 决策日志记录器                       |

## 最佳实践

### 1. 配置合理的熔断器参数

```typescript
// 高频调用场景
const highFrequencyConfig = {
  failureThreshold: 3, // 降低阈值，更快熔断
  openDuration: 60000, // 延长打开时间
};

// 低频调用场景
const lowFrequencyConfig = {
  failureThreshold: 5, // 默认阈值
  openDuration: 30000, // 默认时间
};
```

### 2. 配置多级备用数据源

```typescript
const config = {
  primary: "taobao/official_api",
  fallbacks: [
    "taobao/third_party_api", // 第一备用
    "taobao/skill_crawler", // 最后备用
  ],
};
```

### 3. 监控决策日志

```typescript
// 订阅降级决策事件
decisionLogger.onDecision((log) => {
  if (log.decision === "source_failed" && log.error?.isSevere) {
    alertService.sendAlert({
      level: "critical",
      message: `严重错误: ${log.platform} - ${log.error.reason}`,
    });
  }
});
```

### 4. 合理使用缓存

```typescript
const cacheConfig = {
  ttl: 3600000, // 1 小时过期
  staleWhileRevalidate: true, // 允许使用过期缓存
  maxStaleAge: 86400000, // 最大过期时间 24 小时
};
```

## 工具详细降级策略

### 工具选择指南

| 需求             | 工具                     | 使用场景                      |
| ---------------- | ------------------------ | ----------------------------- |
| 获取特定商品详情 | `ecom-product-fetch`     | 已有平台+商品ID，需要完整信息 |
| 按关键词搜索商品 | `ecom-product-search`    | 市场调研、商品发现、爆款挖掘  |
| 检查平台健康状态 | `ecom-validate-platform` | 批量操作前检查、排查数据问题  |

### 平台 ID 格式

| 平台       | ID 格式    | 示例          |
| ---------- | ---------- | ------------- |
| 淘宝       | 商品 ID    | `12345`       |
| Amazon     | ASIN       | `B0ABC123`    |
| 抖音       | 商品 ID    | `prod_abc123` |
| 1688       | Offer ID   | `offer_12345` |
| Shopee     | Item ID    | `item.12345`  |
| 拼多多     | 商品 ID    | `goods_12345` |
| 京东       | SKU ID     | `sku_12345`   |
| AliExpress | Product ID | `prod_12345`  |

---

### ecom-product-fetch (商品详情获取)

**功能**：获取单个商品的详细数据，包括标题、价格、销量、评分、店铺信息等。

**参数说明**：

| 参数        | 描述                            | 必填 |
| ----------- | ------------------------------- | ---- |
| `platform`  | 平台名称：`taobao`、`amazon` 等 | 是   |
| `productId` | 平台特定的商品 ID（见上表）     | 是   |

**完整降级流程**：

```
┌─────────────────────────────────────────────────────────────────────────┐
│                 ecom-product-fetch 降级流程                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. 检查新鲜缓存 (fresh_cache)                                          │
│     ┌───────────────────────────────────────────────────────────────┐  │
│     │  来源: Redis 缓存                                             │  │
│     │  Key: product:{platform}:{platformId}                        │  │
│     │  TTL: 30 分钟 (PRODUCT_TTL_MS = 1800000)                     │  │
│     │  条件: 缓存存在且未过期                                       │  │
│     │  命中: 返回缓存数据，degradationLevel = "fresh_cache"         │  │
│     └───────────────────────────────────────────────────────────────┘  │
│                         ↓ 未命中                                        │
│                                                                         │
│  2. 检查数据库 (database)                                               │
│     ┌───────────────────────────────────────────────────────────────┐  │
│     │  来源: PostgreSQL                                             │  │
│     │  表: products                                                 │  │
│     │  查询: findByPlatformId(platform, platformId)                 │  │
│     │  条件: 数据库存在历史记录                                     │  │
│     │  命中: 返回数据库数据，degradationLevel = "database"           │  │
│     └───────────────────────────────────────────────────────────────┘  │
│                         ↓ 未命中                                        │
│                                                                         │
│  3. 调用 API 获取 (fetchWithFailover)                                   │
│     ┌───────────────────────────────────────────────────────────────┐  │
│     │  数据源优先级 (以淘宝为例):                                   │  │
│     │  ┌─────────────────────────────────────────────────────────┐ │  │
│     │  │ 1. taobao/official_api (官方 API)                      │ │  │
│     │  │    - 优先级: 1                                          │ │  │
│     │  │    - 配额: 100/天                                       │ │  │
│     │  │    - 成本: 免费                                         │ │  │
│     │  └─────────────────────────────────────────────────────────┘ │  │
│     │                         ↓ 失败                                │  │
│     │  ┌─────────────────────────────────────────────────────────┐ │  │
│     │  │ 2. taobao/third_party_api (第三方 API)                  │ │  │
│     │  │    - 优先级: 2                                          │ │  │
│     │  │    - 配额: 1000/天                                      │ │  │
│     │  │    - 成本: 0.01元/次                                    │ │  │
│     │  └─────────────────────────────────────────────────────────┘ │  │
│     │                         ↓ 失败                                │  │
│     │  ┌─────────────────────────────────────────────────────────┐ │  │
│     │  │ 3. taobao/skill_crawler (爬虫)                          │ │  │
│     │  │    - 优先级: 3                                          │ │  │
│     │  │    - 配额: 500/天                                       │ │  │
│     │  │    - 成本: 0.05元/次                                    │ │  │
│     │  └─────────────────────────────────────────────────────────┘ │  │
│     └───────────────────────────────────────────────────────────────┘  │
│                         ↓ 全部失败                                      │
│                                                                         │
│  4. 使用过期缓存 (stale_cache)                                          │
│     ┌───────────────────────────────────────────────────────────────┐  │
│     │  条件: 缓存存在但已过期                                       │  │
│     │  返回: 过期缓存数据，degradationLevel = "stale_cache"          │  │
│     │  标记: isDegraded = true                                      │  │
│     └───────────────────────────────────────────────────────────────┘  │
│                         ↓ 无缓存                                        │
│                                                                         │
│  5. 返回错误                                                            │
│     ┌───────────────────────────────────────────────────────────────┐  │
│     │  degradationLevel = "error"                                   │  │
│     │  返回错误信息                                                  │  │
│     └───────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**API 接口详情**：

| 平台   | 数据源             | API 端点                             | 认证方式                | 接口说明                   |
| ------ | ------------------ | ------------------------------------ | ----------------------- | -------------------------- |
| 淘宝   | official_api       | `https://eco.taobao.com/router/rest` | AppKey + AppSecret 签名 | 淘宝开放平台 API           |
| 淘宝   | third_party_api    | 第三方服务商端点                     | API Key                 | 第三方数据服务商           |
| 淘宝   | skill_crawler      | 内部爬虫服务                         | 内部认证                | 自建爬虫服务               |
| Amazon | amazon_sp_api      | Amazon SP-API                        | AWS IAM + LWA           | Amazon Selling Partner API |
| Amazon | amazon_product_api | Product Advertising API              | Associate Tag + API Key | Amazon 商品广告 API        |

**淘宝 API 调用详情**：

```typescript
// 环境变量配置
TAOBAO_APP_KEY=your_app_key
TAOBAO_APP_SECRET=your_app_secret
TAOBAO_ACCESS_TOKEN=optional_access_token  // 可选，部分接口需要
TAOBAO_API_ENDPOINT=https://eco.taobao.com/router/rest  // 可选，默认值

// API 请求参数
interface TaobaoApiRequest {
  method: string;           // API 方法名
  params: Record<string, string | number>;  // 业务参数
  needAuth?: boolean;       // 是否需要用户授权
}

// 商品详情接口
method: "taobao.item.seller.get"  // 或类似接口
params: {
  num_iid: "12345",  // 商品 ID
  fields: "num_iid,title,price,pic_url,detail_url,volume,nick"
}

// 签名算法: MD5(secret + params_sorted + secret)
```

**返回数据结构**：

```typescript
interface FetchProductUseCaseResult {
  data: ProductData | null; // 商品数据
  sourceType: string; // 数据来源类型
  degradationLevel: DegradationLevel; // 降级级别
  levelNumber: number; // 级别编号 (1-5)
  isDegraded: boolean; // 是否降级
  age?: number; // 数据年龄 (毫秒)
  cached: boolean; // 是否来自缓存
  source: string; // 数据源 ID
  latencyMs: number; // 延迟 (毫秒)
  error?: string; // 错误信息
}

interface ProductData {
  platform: Platform; // 平台
  platformId: string; // 平台商品 ID
  title: string; // 商品标题
  price: number; // 价格
  currency: string; // 货币
  sales: number; // 销量
  rating?: number; // 评分
  reviewsCount?: number; // 评论数
  shopName?: string; // 店铺名称
  sourceUrl: string; // 商品链接
  isTrending: boolean; // 是否爆款
}
```

**使用技巧**：

- **去除 ID 前后空格** — 处理用户输入错误，避免无效请求
- **确认平台支持** — 目前只有淘宝和 Amazon 有活跃的适配器
- **优雅处理缺失商品** — 部分 ID 可能已下架或删除，检查 `data` 是否为 null
- **使用结果中的 `sourceUrl`** — 为用户提供原始商品链接
- **检查 `isDegraded` 字段** — 了解数据是否来自备用数据源
- **监控 `latencyMs`** — 高延迟可能表示 API 问题或降级

**工作流示例：单品分析**

```
1. 用已知 ID 获取商品详情
   ecom-product-fetch(platform="taobao", productId="12345")

2. 检查返回数据
   - 如果 isDegraded=true，说明使用了备用数据源
   - 查看 source 字段了解具体来源

3. 通过搜索查看竞品情况
   ecom-product-search(platform="taobao", keyword="<商品标题关键词>", limit=20)

4. 在其他平台交叉验证
   ecom-product-fetch(platform="amazon", productId="B0ABC123")
```

---

### ecom-product-search (商品搜索)

**功能**：按关键词搜索商品，返回商品列表。

**参数说明**：

| 参数       | 描述                            | 必填 |
| ---------- | ------------------------------- | ---- |
| `platform` | 平台名称：`taobao`、`amazon` 等 | 是   |
| `keyword`  | 搜索关键词或商品名称            | 是   |
| `limit`    | 最大结果数（默认 50，最大 100） | 否   |

**降级流程**：

```
┌─────────────────────────────────────────────────────────────────────────┐
│                 ecom-product-search 降级流程                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  注意: 当前实现未使用 fetchWithFailover 多数据源切换                     │
│        只使用单一数据源 + 重试机制                                      │
│                                                                         │
│  1. 选择数据源                                                          │
│     ┌───────────────────────────────────────────────────────────────┐  │
│     │  优先级排序:                                                  │  │
│     │  1. 指定的 preferredSource (如果提供)                         │  │
│     │  2. 可用数据源中优先级最高的                                  │  │
│     │                                                               │  │
│     │  条件: isAvailable && hasRemainingQuota()                     │  │
│     └───────────────────────────────────────────────────────────────┘  │
│                         ↓                                               │
│                                                                         │
│  2. 执行搜索 (withRetry)                                                │
│     ┌───────────────────────────────────────────────────────────────┐  │
│     │  重试配置:                                                    │  │
│     │  - retryCount: 3 (最多重试 3 次)                              │  │
│     │  - retryDelayMs: 1000 (初始延迟 1 秒)                         │  │
│     │  - 指数退避: delay * 2^i (每次重试延迟翻倍)                   │  │
│     └───────────────────────────────────────────────────────────────┘  │
│                         ↓                                               │
│                                                                         │
│  3. 返回结果                                                            │
│     ┌───────────────────────────────────────────────────────────────┐  │
│     │  成功: 返回商品列表                                           │  │
│     │  失败: 返回错误信息                                           │  │
│     └───────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  改进建议:                                                               │
│  - 应该使用 fetchWithFailover 实现多数据源切换                          │
│  - 应该添加缓存层                                                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**API 接口详情**：

| 平台   | 接口                    | 方法                  | 参数                                 |
| ------ | ----------------------- | --------------------- | ------------------------------------ |
| 淘宝   | 淘宝开放平台            | `taobao.items.search` | q, page_no, page_size                |
| Amazon | Product Advertising API | `SearchItems`         | Keywords, ItemPage, ItemCountPerPage |

**淘宝搜索 API 调用详情**：

```typescript
// 搜索请求
interface ProductSearchParams {
  q: string;           // 搜索关键词
  page_no: number;     // 页码 (从 1 开始)
  page_size: number;   // 每页数量 (默认 20, 最大 100)
}

// API 调用
method: "taobao.items.search"
params: {
  q: "龙虾",
  page_no: 1,
  page_size: 50
}

// 返回数据
{
  items: {
    item: [
      {
        num_iid: "12345",      // 商品 ID
        title: "商品标题",
        price: "99.00",        // 价格字符串
        pic_url: "https://...", // 图片 URL
        volume: 1000           // 销量
      }
    ],
    total_results: 10000    // 总结果数
  }
}
```

**返回数据结构**：

```typescript
interface SearchResult {
  success: boolean;
  search: {
    platform: string;
    keyword: string;
    limit: number;
  };
  results: {
    total: number; // 总结果数
    count: number; // 当前页数量
    page: number; // 当前页
    pageSize: number; // 每页数量
  };
  source: string; // 数据源
  latencyMs: number; // 延迟
  products: Array<{
    platformId: string;
    title: string;
    price: number;
    sales: number;
    rating?: number;
    shopName?: string;
    isTrending: boolean;
    sourceUrl: string;
  }>;
}
```

**使用技巧**：

- **使用具体关键词** — 宽泛的词会返回大量无关结果，降低搜索质量
- **合理设置 `limit`** — 快速查询用 20-30，深度调研用 50-100
- **筛选 `isTrending`** — 爆款商品反映市场需求，是选品的重要指标
- **跨平台对比** — 用不同的 `platform` 参数多次调用，对比价格和销量
- **关注 `latencyMs`** — 搜索延迟通常高于单品获取，用于监控 API 健康状态

**工作流示例：市场调研**

```
1. 用目标关键词在各平台搜索商品
   ecom-product-search(platform="taobao", keyword="龙虾零食", limit=50)
   ecom-product-search(platform="amazon", keyword="lobster snacks", limit=50)

2. 对比结果中的价格、销量、评分
   - 按 sales 排序找出热销商品
   - 筛选 isTrending=true 找出爆款

3. 识别高销量增速的爆款商品
   - 关注 sales 高且 rating > 4.5 的商品

4. 数据异常时验证平台健康状态
   ecom-validate-platform(platform="taobao", count=10)
```

---

### ecom-validate-platform (平台验证)

**功能**：验证平台数据采集能力，检查 API 健康状态。

**参数说明**：

| 参数       | 描述                               | 必填 |
| ---------- | ---------------------------------- | ---- |
| `platform` | 要验证的平台（省略则验证所有平台） | 否   |
| `count`    | 验证请求数（默认 10，最大 100）    | 否   |

**输出内容**：

- **成功率** — 成功请求的百分比，用于评估平台健康度
- **分来源统计** — 按数据源拆分（API、爬虫、缓存），了解各数据源表现
- **降级路径** — 使用了哪些备用源，评估降级策略有效性
- **示例商品** — 成功获取的商品样例，验证数据质量

**验证流程**：

```
┌─────────────────────────────────────────────────────────────────────────┐
│                 ecom-validate-platform 验证流程                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. 生成测试商品 ID                                                     │
│     ┌───────────────────────────────────────────────────────────────┐  │
│     │  数量: options.count (默认 10, 最大 100)                      │  │
│     │  格式: 随机生成的 10-15 位数字                                │  │
│     └───────────────────────────────────────────────────────────────┘  │
│                         ↓                                               │
│                                                                         │
│  2. 批量验证 (每个商品 ID)                                              │
│     ┌───────────────────────────────────────────────────────────────┐  │
│     │  FOR each productId IN productIds:                            │  │
│     │    result = adapter.fetchWithFailover(productId)              │  │
│     │                                                               │  │
│     │    IF result.success:                                         │  │
│     │      statsCollector.recordSuccess(sourceId, sourceType)       │  │
│     │      sampleCollector.add(product, sourceId)                   │  │
│     │      degradationTracker.recordFallback(lastSource, sourceId)  │  │
│     │    ELSE:                                                      │  │
│     │      statsCollector.recordFailure(sourceId, sourceType, reason)│  │
│     └───────────────────────────────────────────────────────────────┘  │
│                         ↓                                               │
│                                                                         │
│  3. 生成报告                                                            │
│     ┌───────────────────────────────────────────────────────────────┐  │
│     │  统计:                                                        │  │
│     │  - 总请求数、成功数、失败数                                   │  │
│     │  - 成功率百分比                                               │  │
│     │  - 按数据源分组的统计                                         │  │
│     │                                                               │  │
│     │  降级信息:                                                    │  │
│     │  - 总降级次数                                                 │  │
│     │  - 降级路径 (如: official_api → third_party_api)              │  │
│     │                                                               │  │
│     │  示例商品:                                                     │  │
│     │  - 成功获取的商品样例 (最多 5 个)                             │  │
│     │  - 可选脱敏处理                                               │  │
│     └───────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**验证器实现**：

```typescript
class TaobaoValidator extends PlatformValidator {
  async validate(options: ValidationOptions): Promise<ValidationResult> {
    // 1. 重置统计
    this.statsCollector.reset();
    this.sampleCollector.reset();
    this.degradationTracker.reset();

    // 2. 生成测试 ID
    const productIds = this.generateProductIds(options.count);

    // 3. 批量验证
    for (const productId of productIds) {
      const result = await this.adapter.fetchWithFailover(/* ... */);

      if (result.success) {
        this.statsCollector.recordSuccess(sourceId, sourceType);
        this.sampleCollector.add(result.data, sourceId);
      } else {
        this.statsCollector.recordFailure(sourceId, sourceType, reason);
      }
    }

    // 4. 返回结果
    return {
      platform: "taobao",
      timestamp: Date.now(),
      duration: Date.now() - startTime,
      stats: this.statsCollector.getStats(),
      degradation: this.degradationTracker.getInfo(),
      samples: this.sampleCollector.getSamples(),
    };
  }
}
```

**返回数据结构**：

```typescript
interface ValidationResult {
  platform: string; // 平台名称
  timestamp: number; // 验证时间戳
  durationMs: number; // 总耗时 (毫秒)

  stats: {
    total: number; // 总请求数
    successes: number; // 成功数
    failures: number; // 失败数
    successRate: number; // 成功率 (百分比)

    perSourceStats: Array<{
      // 按数据源统计
      sourceId: string;
      sourceType: string; // official_api | third_party_api | skill_crawler
      successRate: number;
    }>;

    failureReasons: Record<string, number>; // 失败原因统计
  };

  degradation: {
    totalFallbacks: number; // 总降级次数
    paths: string[]; // 降级路径列表
  };

  samples: Array<{
    // 示例商品
    productId: string;
    title: string;
    price: number;
    currency: string;
    source: string;
  }>;
}
```

**支持的验证器**：

| 平台   | 验证器类        | 文件位置                            |
| ------ | --------------- | ----------------------------------- |
| 淘宝   | TaobaoValidator | `src/validation/TaobaoValidator.ts` |
| Amazon | AmazonValidator | `src/validation/AmazonValidator.ts` |

**使用技巧**：

- **批量抓取前运行** — 确保平台健康，避免无效请求
- **用 `count=10` 快速检查** — 更快的验证，适合实时监控
- **用 `count=50+` 深度测试** — 发现边缘情况和偶发问题
- **检查 `degradation.paths`** — 了解备用源的可靠性
- **关注 `stats.successRate`** — 成功率低于 80% 表示平台有问题

**工作流示例：平台健康检查**

```
1. 大规模操作前验证所有平台
   ecom-validate-platform(count=20)

2. 查看成功率和降级路径
   - successRate > 90%: 健康
   - successRate 70-90%: 有问题，检查降级路径
   - successRate < 70%: 严重问题，暂停操作

3. 识别失败的数据源
   - 查看 stats.perSourceStats 找出失败的数据源
   - 查看 stats.failureReasons 了解失败原因

4. 健康状态可接受后再执行抓取/搜索
   - 如果降级路径包含多个源，说明主数据源有问题
   - 考虑调整数据源优先级或联系服务商
```

---

## 错误处理

### 常见错误

| 错误                        | 原因               | 处理方式                            |
| --------------------------- | ------------------ | ----------------------------------- |
| `Unsupported platform`      | 平台未注册         | 查看支持的平台列表 (taobao, amazon) |
| `platform is required`      | 缺少平台参数       | 提供平台名称                        |
| `productId is required`     | 缺少商品 ID        | 提供平台特定的商品 ID               |
| `keyword is required`       | 缺少搜索关键词     | 提供搜索关键词                      |
| `Failed to fetch product`   | API 错误或无数据   | 验证平台状态，重试请求              |
| `No validator registered`   | 平台缺少验证器     | 只有淘宝/Amazon 有验证器            |
| `No available data sources` | 所有数据源都不可用 | 检查 API 配额和认证状态             |

### 错误恢复策略

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         错误恢复策略                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. 认证错误 (auth, auth_permanent)                                     │
│     ┌───────────────────────────────────────────────────────────────┐  │
│     │  - 检查 API Key 和 Secret 是否正确                            │  │
│     │  - 检查 Access Token 是否过期                                 │  │
│     │  - 重新获取授权 (auth_permanent 需要联系服务商)               │  │
│     └───────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  2. 速率限制 (rate_limit)                                               │
│     ┌───────────────────────────────────────────────────────────────┐  │
│     │  - 系统自动进入冷却状态                                        │  │
│     │  - 等待冷却结束后重试                                          │  │
│     │  - 考虑升级 API 配额                                           │  │
│     └───────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  3. 服务过载 (overloaded)                                               │
│     ┌───────────────────────────────────────────────────────────────┐  │
│     │  - 系统自动切换到备用数据源                                    │  │
│     │  - 熔断器会在 30 秒后尝试恢复                                  │  │
│     │  - 监控持续时间，持续过长则联系服务商                          │  │
│     └───────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  4. 商品不存在 (not_found)                                              │
│     ┌───────────────────────────────────────────────────────────────┐  │
│     │  - 确认商品 ID 是否正确                                        │  │
│     │  - 商品可能已下架或删除                                        │  │
│     │  - 不需要重试，这是正常情况                                    │  │
│     └───────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  5. 验证码 (captcha)                                                    │
│     ┌───────────────────────────────────────────────────────────────┐  │
│     │  - 爬虫数据源遇到验证码                                        │  │
│     │  - 系统自动切换到其他数据源                                    │  │
│     │  - 考虑使用 API 数据源替代爬虫                                 │  │
│     └───────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## API 端点汇总

### 淘宝开放平台

| 接口     | 端点                     | 认证            | 用途             |
| -------- | ------------------------ | --------------- | ---------------- |
| 商品详情 | `taobao.item.seller.get` | AppKey + Secret | 获取单个商品详情 |
| 商品搜索 | `taobao.items.search`    | AppKey + Secret | 按关键词搜索商品 |

**认证配置**：

```bash
# 必需
TAOBAO_APP_KEY=your_app_key
TAOBAO_APP_SECRET=your_app_secret

# 可选 (部分接口需要)
TAOBAO_ACCESS_TOKEN=user_access_token

# 可选 (自定义端点)
TAOBAO_API_ENDPOINT=https://eco.taobao.com/router/rest
```

**签名算法**：

```typescript
// 1. 拼接所有参数 (按 key 排序)
const sortedParams = Object.keys(params)
  .sort()
  .map((key) => `${key}${params[key]}`)
  .join("");

// 2. MD5 签名
const sign = md5(appSecret + sortedParams + appSecret);
```

### Amazon API

| 接口                    | 端点                              | 认证          | 用途         |
| ----------------------- | --------------------------------- | ------------- | ------------ |
| SP-API                  | `sellingpartnerapi-na.amazon.com` | AWS IAM + LWA | 官方商品数据 |
| Product Advertising API | `api.amazon.com`                  | Associate Tag | 商品搜索     |

**认证配置**：

```bash
# AWS 凭证
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# Amazon SP-API 配置
AMAZON_SELLER_ID=your_seller_id
AMAZON_MARKETPLACE_ID=ATVPDKIKX0DER

# LWA (Login with Amazon)
AMAZON_CLIENT_ID=your_client_id
AMAZON_CLIENT_SECRET=your_client_secret
AMAZON_REFRESH_TOKEN=your_refresh_token
```

---

## 缓存配置

### Redis 缓存

```typescript
// 默认 TTL 配置
const DEFAULT_TTL_MS = 3600000; // 1 小时
const PRODUCT_TTL_MS = 1800000; // 30 分钟 (商品数据)
const PRICE_TTL_MS = 300000; // 5 分钟 (价格数据)

// Redis 连接配置
interface RedisConfig {
  host: string; // Redis 主机
  port: number; // Redis 端口
  password?: string; // Redis 密码
  db?: number; // 数据库编号
}

// 环境变量
REDIS_HOST = localhost;
REDIS_PORT = 6379;
REDIS_PASSWORD = optional_password;
```

### 缓存 Key 格式

```
product:{platform}:{platformId}     // 商品详情
search:{platform}:{keyword}:{page}  // 搜索结果
validation:{platform}               // 验证结果
```

---

## 数据库存储

### PostgreSQL 配置

```typescript
interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

// 环境变量
POSTGRES_HOST = localhost;
POSTGRES_PORT = 5432;
POSTGRES_DATABASE = meichao;
POSTGRES_USER = postgres;
POSTGRES_PASSWORD = password;
```

### 商品表结构

```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(20) NOT NULL,
  platform_id VARCHAR(100) NOT NULL,
  title TEXT NOT NULL,
  price DECIMAL(10, 2),
  currency VARCHAR(10),
  sales INTEGER,
  rating DECIMAL(3, 2),
  shop_name VARCHAR(255),
  source_url TEXT,
  is_trending BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(platform, platform_id)
);
```
