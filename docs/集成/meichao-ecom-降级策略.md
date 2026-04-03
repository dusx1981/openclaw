# meichao-ecom 降级策略工作流程

## 概览

meichao-ecom 实现了简化的双层降级机制，确保在主要数据源不可用时能够自动切换到备用源。

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          简化的降级机制架构                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐            │
│   │   Adapter    │─────▶│    Retry     │─────▶│   Circuit    │            │
│   │   (网关)     │      │   Runner     │      │   Breaker    │            │
│   └──────────────┘      └──────────────┘      └──────────────┘            │
│          │                      │                      │                  │
│          │                      │                      │                  │
│          ▼                      ▼                      ▼                  │
│   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐            │
│   │  DataSource  │      │    Error     │      │   Decision   │            │
│   │   Registry   │      │  Classifier  │      │   Logger     │            │
│   └──────────────┘      └──────────────┘      └──────────────┘            │
│                                                                             │
│   核心机制：                                                                 │
│   • Retry: 处理瞬时故障（秒级，使用 plugin-sdk）                            │
│   • Circuit Breaker: 防止级联失败（分钟级）                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 数据源层级

### Taobao 平台数据源

| 优先级 | 数据源 ID           | 类型            | 状态   | 说明                 |
| ------ | ------------------- | --------------- | ------ | -------------------- |
| 1      | taobao_official_api | official_api    | ✓ 可用 | 淘宝开放平台官方 API |
| 2      | taobao_third_party  | third_party_api | ⚠ 配置 | 第三方数据服务商     |
| 3      | taobao_crawler      | skill_crawler   | ⚠ 开发 | 浏览器自动化采集     |
| 4      | taobao_open_search  | open_search     | ✓ 可用 | Bing/Tavily 开放搜索 |

### 数据源配置详情

```
taobao_official_api:
  优先级: 1
  成本: 0元/次
  配额: 100次/天
  环境: TAOBAO_APP_KEY, TAOBAO_APP_SECRET, TAOBAO_ACCESS_TOKEN

taobao_third_party:
  优先级: 2
  成本: 0.01元/次
  配额: 1000次/天
  环境: JUSHUTA_API_KEY 或 CHANMAMA_API_KEY

taobao_crawler:
  优先级: 3
  成本: 0.05元/次
  配额: 500次/天
  依赖: Puppeteer/Playwright

taobao_open_search:
  优先级: 4
  成本: 0元/次 (免费额度)
  配额: 1000次/月
  环境: BING_API_KEY 或 TAVILY_API_KEY
```

## 工作流程

### 1. 商品详情获取 (fetchProduct)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      fetchProduct 工作流程                                   │
└─────────────────────────────────────────────────────────────────────────────┘

开始
  │
  ▼
┌────────────────────────┐
│ 获取数据源候选列表      │
│ (按优先级排序)          │
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ 检查 Circuit Breaker   │
│ 状态是否可执行？        │
└───────────┬────────────┘
            │
            ├─ OPEN ──────────▶ 跳过该数据源
            │
            ▼
┌────────────────────────┐
│ 使用 Retry 执行请求     │
│ (带指数退避 + jitter)   │
└───────────┬────────────┘
            │
            ├─ 成功 ──────────▶ 返回结果
            │                    记录成功到 CB
            │
            ▼
┌────────────────────────┐
│ 记录失败到 Circuit     │
│ Breaker               │
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ 尝试下一个数据源        │
└────────────────────────┘

失败（所有数据源都失败）
  │
  ▼
返回错误
```

### 2. Retry 机制详解

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Retry 执行流程                                          │
└─────────────────────────────────────────────────────────────────────────────┘

第一次尝试
  │
  ├─ 成功 ──────────────▶ 返回结果
  │
  └─ 失败
       │
       ├─ 错误分类
       │    ├─ 严重错误 (auth_permanent, blocked) ───▶ 不重试，抛出错误
       │    └─ 可重试错误 (rate_limit, timeout) ───▶ 继续
       │
       ▼
  指数退避等待 (minDelay * 2^attempt)
       │
       ▼
  第二次尝试
       │
       ├─ 成功 ──────────────▶ 返回结果
       │
       └─ 失败 ───▶ 重复上述流程
            │
            ▼
       第三次尝试
            │
            └─ 失败 ───▶ 抛出最后一个错误
```

### 3. Circuit Breaker 状态转换

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  Circuit Breaker 状态转换                                    │
└─────────────────────────────────────────────────────────────────────────────┘

CLOSED (正常)
  │
  │ 连续 5 次失败
  ▼
OPEN (熔断)
  │
  │ 60 秒后
  ▼
HALF-OPEN (试探)
  │
  ├─ 成功 3 次 ──────▶ CLOSED (恢复正常)
  │
  └─ 失败 ──────────▶ OPEN (继续熔断)
```

## 错误分类

### 严重错误（不重试）

```typescript
const SEVERE_ERRORS = [
  "auth_permanent", // 认证永久失效
  "blocked", // IP/账号被封
  "billing", // 计费问题
];
```

**处理策略**：

- Retry 不重试
- 直接标记失败
- 需要人工介入

### 可重试错误

```typescript
const RETRYABLE_ERRORS = [
  "rate_limit", // 频率限制
  "timeout", // 超时
  "overloaded", // 服务过载
  "not_found", // 资源不存在
  "captcha", // 需要验证码
];
```

**处理策略**：

- Retry 自动重试
- 指数退避
- 最多 3 次尝试

## 配置参数

### Retry 配置

```typescript
{
  attempts: 3,           // 最多 3 次尝试
  minDelayMs: 500,       // 最小延迟 500ms
  maxDelayMs: 30000,     // 最大延迟 30s
  jitter: 0.1,           // 10% 抖动
}
```

### Circuit Breaker 配置

```typescript
{
  enabled: true,
  failureThreshold: 5,   // 连续 5 次失败触发熔断
  openDuration: 60000,   // 熔断持续 60 秒
  halfOpenMaxCalls: 10,  // HALF-OPEN 允许 10 次试探
  successThreshold: 3,   // 需 3 次成功才恢复
}
```

## 决策日志

所有降级决策都被记录，用于故障追踪和性能分析：

```typescript
interface DegradationDecisionLog {
  event: "degradation_decision";
  decision: "source_failed" | "source_succeeded" | "circuit_open" | "fallback_to_stale";
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
  };
  circuitBreaker?: {
    state: CircuitBreakerState;
    failureCount: number;
  };
  latencyMs: number;
}
```

## 监控指标

### 关键指标

1. **数据源成功率**
   - 按 platform 和 source 统计
   - 预警阈值: < 80%

2. **Circuit Breaker 状态**
   - OPEN 状态频率
   - HALF-OPEN 成功率
   - 平均熔断时长

3. **重试统计**
   - 平均重试次数
   - 重试成功率
   - 按错误类型分布

4. **降级频率**
   - 主数据源降级次数
   - 备用数据源使用率
   - 降级决策分布

## 最佳实践

### 1. 数据源配置

```typescript
// 推荐配置
{
  primary: "taobao_official_api",
  fallbacks: [
    "taobao_third_party",
    "taobao_open_search",
  ],
  settings: {
    maxFallbackSources: 3,
    enableStaleCache: true,
    staleCacheMaxAge: 3600000,  // 1 小时
  },
}
```

### 2. 错误处理

```typescript
// 推荐：区分错误类型
if (error.reason === "auth_permanent") {
  // 严重错误：禁用数据源
  await disableDataSource(source.id);
  await notifyAdmin("认证失效，需要人工介入");
} else if (error.reason === "rate_limit") {
  // 可重试错误：记录并继续
  logger.warn("触发频率限制，稍后重试");
}
```

### 3. 监控告警

```typescript
// 推荐：设置监控阈值
if (circuitBreaker.state === "open") {
  alert("数据源熔断", {
    source: source.id,
    failureCount: circuitBreaker.failureCount,
    severity: "high",
  });
}
```

## 故障排查

### 常见问题

1. **频繁熔断**
   - 检查上游服务状态
   - 检查网络连接
   - 检查配额限制

2. **重试失败**
   - 检查错误分类是否正确
   - 检查重试配置是否合理
   - 检查上游服务是否真的恢复了

3. **降级频繁**
   - 检查主数据源健康状态
   - 检查备用数据源配置
   - 检查 Circuit Breaker 阈值

## 总结

### 架构优势

1. **简洁清晰**：双层机制，职责分离
2. **无协调问题**：时间尺度自然分离
3. **遵循最佳实践**：使用 plugin-sdk，参考 Resilience4j
4. **易于维护**：更少的代码，更清晰的逻辑

### 设计原则

1. **简单优于复杂**
2. **复用而非重造**
3. **职责单一**
4. **可观测性**

---

**文档版本**: 2.0 (简化版)  
**更新日期**: 2026-04-02  
**维护者**: meichao-ecom team  
**相关文档**: `/projects/openclaw/docs/集成/meichao-ecom-熔断与冷却机制设计.md`
