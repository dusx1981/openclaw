## Context

当前降级策略分散在多个层面：

**OpenClaw 模型降级 (参考)**:
- 配置：`string | { primary, fallbacks }`
- 错误分类：10 种 FailoverReason
- 冷却机制：指数退避 (1min → 1h max)
- Probe 机制：冷却快结束时提前尝试
- 决策日志：结构化记录

**Meichao-Ecom 数据采集降级 (现有)**:
- 多层降级：Cache → Database → Sources → Stale Cache
- 健康追踪：滑动窗口统计
- 选择策略：priority / cost-first / reliability-first
- 数据库新鲜度：last_seen_at 检查

**目标**：借鉴成熟模式，整合为统一降级体系。

## Goals / Non-Goals

**Goals:**
- 统一降级配置格式
- 引入 FailoverReason 错误分类
- 实现指数退避冷却
- 添加 Probe 机制
- 结构化决策日志
- 整合到统一流程

**Non-Goals:**
- 不做分布式协调
- 不做持久化冷却状态
- 不做机器学习预测

## Decisions

### Decision 1: 统一降级配置格式

**选择**: 借鉴 `AgentModelConfig` 设计

```typescript
type DataSourceConfig = 
  | string                                    // 简写: "taobao_official_api"
  | {                                         // 完整:
      primary?: string;                       // 主数据源
      fallbacks?: string[];                   // 备用数据源
      strategy?: SelectionStrategy;           // 选择策略
      cooldown?: CooldownSettings;            // 冷却设置
    };
```

**理由**:
- 简洁：常用场景一行配置
- 灵活：高级场景完整配置
- 与 openclaw 风格一致

### Decision 2: 错误分类体系

**选择**: 借鉴 FailoverReason，适配数据采集场景

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

**理由**:
- 不同错误需要不同处理策略
- 冷却时间根据错误类型调整
- 结构化日志便于分析

### Decision 3: 冷却机制

**选择**: 指数退避 + 最大上限

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      普通错误冷却                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   errorCount=1 → 1 分钟                                                     │
│   errorCount=2 → 5 分钟                                                     │
│   errorCount=3 → 25 分钟                                                    │
│   errorCount=4+ → 1 小时 (最大)                                             │
│                                                                             │
│   公式: min(60min, 5min × 5^(errorCount-1))                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                      严重错误冷却 (auth_permanent/billing/blocked)          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   count=1 → 5 小时                                                          │
│   count=2 → 10 小时                                                         │
│   count=3 → 20 小时                                                         │
│   count=4+ → 24 小时 (最大)                                                 │
│                                                                             │
│   公式: min(24h, 5h × 2^(count-1))                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

成功后重置:
├── errorCount = 0
├── cooldownUntil = undefined
└── lastSuccessAt = now
```

**理由**:
- 指数退避避免雪崩
- 最大上限防止永久禁用
- 成功后重置鼓励恢复

### Decision 4: Probe 机制

**选择**: 冷却快结束时提前尝试

```
Probe 条件:
├── isPrimary (只对主数据源 probe)
├── 有备用数据源可用
├── 距上次 probe > 30 秒
└── 距冷却结束 < 2 分钟 或 已过期

Probe 行为:
├── 临时允许使用冷却中的数据源
├── 成功 → 重置冷却
└── 失败 → 继续冷却
```

**理由**:
- 避免不必要的等待
- 尽早发现恢复的数据源
- 有备用时才 probe，降低风险

### Decision 5: 统一降级流程

**选择**: 6 层降级链

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      统一降级流程                                           │
└─────────────────────────────────────────────────────────────────────────────┘

Layer 1: Fresh Cache (Redis, TTL 控制)
    │ ↓ miss
Layer 2: Database (新鲜度检查)
    │ ↓ stale
Layer 3: Primary Source (冷却检查)
    │ ↓ cooldown / error
Layer 4: Fallback Sources (依次尝试)
    │ ↓ all failed
Layer 5: Stale Cache (过期缓存)
    │ ↓ miss
Layer 6: Error

每层返回:
├── data: 实际数据
├── sourceType: 来源类型
├── degradationLevel: 降级层级
├── isDegraded: 是否降级
└── age?: 数据年龄
```

**理由**:
- 清晰的优先级
- 每层都有明确的时效性控制
- 便于监控和调试

### Decision 6: 决策日志格式

**选择**: 结构化日志

```typescript
interface DegradationDecisionLog {
  event: "degradation_decision";
  decision: 
    | "skip_cooldown_source"
    | "probe_cooldown_source"
    | "source_failed"
    | "source_succeeded"
    | "fallback_to_stale_cache";
  
  runId: string;
  platform: string;
  productId: string;
  
  source: {
    id: string;
    type: "official_api" | "third_party_api" | "crawler";
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
  
  latencyMs: number;
}
```

**理由**:
- 便于问题排查
- 支持统计分析
- 与 openclaw 风格一致

## Risks / Trade-offs

**Risk 1**: 冷却时间过长导致数据源闲置
→ Mitigation: Probe 机制提前恢复

**Risk 2**: 错误分类不准确
→ Mitigation: 提供手动重置接口

**Risk 3**: 日志量大
→ Mitigation: 按 runId 聚合，定期清理

**Trade-off**: 不持久化冷却状态，重启后重置
→ 可接受：重启后重新统计是合理的