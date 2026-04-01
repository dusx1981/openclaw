## Context

当前 meichao-ecom 数据采集系统降级机制现状：

**已实现**:
- 多层降级：Cache → Database → Sources → Stale Cache
- 数据源故障转移：`fetchWithFailover()` 顺序尝试
- 重试机制：指数退避重试
- 过期缓存降级：`getWithFallback()`

**已设计未实现**:
- 熔断器配置已定义但无实现类
- 健康检查接口存在但无自动调度

**OpenClaw 成熟模式**:
- 配置格式：`string | { primary, fallbacks }`
- 错误分类：10 种 FailoverReason
- 冷却机制：指数退避 + Probe 提前恢复
- 决策日志：结构化记录

## Goals / Non-Goals

**Goals:**
- 实现熔断器模式：失败阈值、自动熔断、半开恢复
- 实现健康探测调度：定时检查、自动恢复
- 统一冷却机制：错误分类、指数退避
- 结构化决策日志
- 整合为完整降级体系

**Non-Goals:**
- 不做分布式协调（单机内存状态）
- 不做持久化冷却/熔断状态（重启后重置）
- 不做机器学习预测

## Decisions

### Decision 1: 熔断器状态机

**选择**: 三态熔断器 (Closed → Open → HalfOpen)

```
┌──────────────────────────────────────────────────────────────────┐
│                      熔断器状态机                                 │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│   ┌────────┐    failures >= threshold    ┌────────┐              │
│   │ Closed │ ─────────────────────────────►│  Open  │              │
│   └────────┘                                └────────┘              │
│       ▲                                        │                   │
│       │                                        │ timeout           │
│       │ success                                ▼                   │
│       │                                  ┌──────────┐             │
│       └──────────────────────────────────│ HalfOpen │             │
│              success                     └──────────┘             │
│                                                  │                │
│                                           failure │                │
│                                                  ▼                │
│                                             ┌────────┐            │
│                                             │  Open  │            │
│                                             └────────┘            │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘

Closed: 正常状态，允许所有请求
Open: 熔断状态，拒绝所有请求
HalfOpen: 半开状态，允许探测请求
```

**配置**:
```typescript
interface CircuitBreakerConfig {
  enabled: boolean;           // default: true
  failureThreshold: number;   // default: 5
  openDuration: number;       // default: 30000ms
  halfOpenMaxCalls: number;   // default: 1
  successThreshold: number;   // default: 3 (for HalfOpen → Closed)
}
```

**理由**: 经典熔断器模式，业界验证有效

### Decision 2: 健康探测调度

**选择**: 基于定时器的健康探测

```typescript
interface HealthProbeConfig {
  interval: number;           // 探测间隔，default: 60000ms
  initialDelay: number;       // 初始延迟，default: 5000ms
  timeout: number;            // 探测超时，default: 10000ms
  unhealthyThreshold: number; // 不健康阈值，default: 3
  recoveryThreshold: number;  // 恢复阈值，default: 2
}
```

**探测策略**:
1. 仅对非健康数据源探测
2. 探测成功 → 计入恢复计数
3. 恢复计数达标 → 标记健康
4. 探测失败 → 重置恢复计数

**理由**: 主动发现恢复的数据源，减少故障时间

### Decision 3: 错误分类与冷却

**选择**: 借鉴 OpenClaw FailoverReason

```typescript
type DataSourceFailoverReason =
  | "auth"              // 认证失败
  | "auth_permanent"    // 认证永久失效
  | "rate_limit"        // 速率限制
  | "overloaded"        // 服务过载
  | "billing"           // 计费问题
  | "timeout"           // 请求超时
  | "not_found"         // 数据不存在
  | "blocked"           // IP 被封
  | "captcha"           // 验证码
  | "unknown";          // 未知错误
```

**冷却时间**:
```
普通错误: min(60min, 5min × 5^(errorCount-1))
严重错误 (auth_permanent/billing/blocked): min(24h, 60min × 2^(errorCount-1))
```

**Probe 机制**:
- 只对主数据源 probe
- 有备用数据源可用
- 距冷却结束 < 2 分钟

**理由**: 不同错误需要不同处理，指数退避避免雪崩

### Decision 4: 统一降级流程

**选择**: 6 层降级链

```
Layer 1: Fresh Cache (Redis TTL)
    ↓ miss
Layer 2: Database (新鲜度检查)
    ↓ stale/not found
Layer 3: Primary Source (熔断器 + 冷却检查)
    ↓ blocked
Layer 4: Fallback Sources (依次尝试)
    ↓ all failed
Layer 5: Stale Cache (过期缓存)
    ↓ miss
Layer 6: Error
```

**返回结构**:
```typescript
interface DegradationResult<T> {
  data: T;
  sourceType: "fresh_cache" | "database" | "primary_source" | 
              "fallback_source" | "stale_cache";
  degradationLevel: number;    // 1-6
  isDegraded: boolean;
  age?: number;                // 数据年龄 (ms)
  circuitBreakerState?: "closed" | "open" | "half-open";
  cooldownRemaining?: number;  // 剩余冷却时间 (ms)
}
```

**理由**: 清晰的优先级，每层都有明确的时效性控制

### Decision 5: 决策日志格式

**选择**: 结构化 JSON 日志

```typescript
interface DegradationDecisionLog {
  event: "degradation_decision";
  decision: "skip_cooldown_source" | "probe_source" | "source_failed" | 
            "source_succeeded" | "circuit_open" | "fallback_to_stale";
  
  runId: string;
  timestamp: number;
  platform: string;
  productId: string;
  
  source: { id: string; type: string; priority: number };
  error?: { reason: DataSourceFailoverReason; message: string };
  cooldown?: { errorCount: number; cooldownUntil: number; willProbe: boolean };
  circuitBreaker?: { state: string; failureCount: number };
  
  latencyMs: number;
}
```

**理由**: 便于问题排查和统计分析

## Risks / Trade-offs

**Risk 1**: 内存状态丢失（重启后熔断器/冷却状态重置）
→ Mitigation: 重启后重新统计是合理的，活跃数据源会快速恢复

**Risk 2**: 熔断器误判（临时故障被误判为永久故障）
→ Mitigation: HalfOpen 状态允许探测恢复，可手动重置

**Risk 3**: 健康探测增加系统负载
→ Mitigation: 仅对非健康数据源探测，配置合理的探测间隔

**Trade-off**: 不持久化状态
→ 可接受：单机场景下内存状态足够，持久化增加复杂度