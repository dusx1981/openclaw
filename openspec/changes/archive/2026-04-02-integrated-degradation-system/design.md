## Context

当前降级策略分散在多个层面，缺乏统一的设计模式：

**OpenClaw 模型降级 (参考)**:

- 分层降级：认证配置文件轮换 + 模型回退
- 错误分类：10 种 FailoverReason
- 冷却机制：指数退避 + Probe 机制
- 会话粘性：为每个会话固定认证配置文件
- 决策日志：结构化记录

**Meichao-Ecom 数据采集降级 (现有)**:

- BasePlatformAdapter 职责混杂（347 lines）
- 降级路径硬编码，无法根据业务场景调整
- ErrorClassifier 包含所有平台错误码，违反开放-封闭原则
- 缺乏统一的降级执行器

**目标**：借鉴成熟模式，创建统一的降级模块。

**核心需求**：

1. 固定降级路径：`official_api → third_party_api → skill_crawler → open_search`
2. 每个平台独立管理，无跨平台回退
3. 降级判断通过 `DataSource.type` 字段
4. 统一的执行器协调 Retry + CircuitBreaker + Cooldown

## Goals / Non-Goals

**Goals:**

- 固定降级路径管理（DegradationPath）
- 统一降级执行（DegradationExecutor）
- 智能冷却时间管理（CooldownManager）
- 简化 BasePlatformAdapter（减少 ~200 lines）
- 支持预设模板和工具参数配置

**Non-Goals:**

- 不做分布式协调（单机内存管理）
- 不做持久化冷却状态（重启后重置）
- 不做机器学习预测
- 不做跨平台降级（每个平台独立）

## Decisions

### Decision 1: 固定降级路径

**选择**: 通过 `DataSource.type` 字段判断降级顺序

```typescript
// 数据源 ID 格式
const sources = [
  { id: "taobao_official_api", type: "official_api", ... },
  { id: "taobao_third_party_api", type: "third_party_api", ... },
  { id: "taobao_skill_crawler", type: "skill_crawler", ... },
  { id: "taobao_open_search", type: "open_search", ... },
];

// 固定降级顺序（基于 type）
const CORE_ORDER: DataSourceType[] = [
  "official_api",
  "third_party_api",
  "skill_crawler",
  "open_search",
];
```

**理由**:

- 无需显式配置 `fallbacks`，简化配置
- 每个平台独立管理，无跨平台回退
- 通过 `type` 字段自动排序，符合业务逻辑
- 便于添加新数据源类型

### Decision 2: 三组件架构

**选择**: DegradationPath + DegradationExecutor + CooldownManager

```
┌─────────────────────────────────────────────────────────────────┐
│           核心组件职责                                            │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────┬──────────────────────────────────────────┐
│  DegradationPath     │  - 管理固定降级路径                       │
│                      │  - 提供数据源选择逻辑                     │
│                      │  - 支持预设模板和配置                     │
│                      │  - 基于 DataSource.type 判断顺序         │
├──────────────────────┼──────────────────────────────────────────┤
│  DegradationExecutor │  - 执行降级逻辑                           │
│                      │  - 协调 Retry + CircuitBreaker           │
│                      │  - 使用 CooldownManager                  │
│                      │  - 记录降级决策                           │
│                      │  - 被多个工具共享                         │
├──────────────────────┼──────────────────────────────────────────┤
│  CooldownManager     │  - 管理数据源冷却时间                     │
│                      │  - 指数退避算法                           │
│                      │  - 区分临时/严重错误                       │
│                      │  - 自动恢复                               │
└──────────────────────┴──────────────────────────────────────────┘
```

**理由**:

- 职责清晰，易于维护
- 组件复用，多个工具共享 DegradationExecutor
- Adapter 简化，只负责业务逻辑
- 便于测试和扩展

### Decision 3: 预设模板

**选择**: 提供常见业务场景的预设模板

```typescript
const PRESETS: Record<string, DataSourceType[]> = {
  standard: ["official_api", "third_party_api", "skill_crawler", "open_search"],
  "cost-optimized": ["official_api", "skill_crawler", "open_search"],
  "speed-optimized": ["third_party_api", "official_api", "open_search"],
  "reliability-first": ["official_api", "third_party_api"],
};
```

**理由**:

- 简化工具参数，用户无需了解降级细节
- 常见场景覆盖，降低学习成本
- 支持自定义，满足特殊需求

### Decision 4: 错误分类与冷却

**选择**: 借鉴 FailoverReason，区分临时/严重错误

```typescript
type DataSourceFailoverReason =
  | "auth" // 认证失败
  | "auth_permanent" // 认证永久失效（严重）
  | "rate_limit" // 速率限制
  | "overloaded" // 服务过载
  | "billing" // 计费问题（严重）
  | "timeout" // 请求超时
  | "not_found" // 数据不存在
  | "blocked" // IP 被封（严重）
  | "captcha" // 验证码
  | "unknown"; // 未知错误

interface ClassifiedError {
  reason: DataSourceFailoverReason;
  isSevere: boolean; // auth_permanent / billing / blocked
  message: string;
}
```

**冷却时间计算**:

```
普通错误冷却:
├── errorCount=1 → 1 分钟
├── errorCount=2 → 5 分钟
├── errorCount=3 → 15 分钟
├── errorCount=4 → 30 分钟 (最大)
└── 成功后重置

严重错误冷却 (auth_permanent / billing / blocked):
├── errorCount=1 → 1 小时
├── errorCount=2 → 2 小时
├── errorCount=3 → 4 小时
├── errorCount=4 → 24 小时 (最大)
└── 成功后重置
```

**理由**:

- 不同错误需要不同处理策略
- 严重错误需要更长冷却时间
- 成功后立即重置，鼓励恢复

### Decision 5: 统一降级流程

**选择**: DegradationExecutor 执行统一降级流程

```typescript
// 在 Adapter 中使用
export class TaobaoAdapter extends BasePlatformAdapter {
  private degradationPath: DegradationPath;
  private degradationExecutor: DegradationExecutor;

  async fetchProduct(platformId: string): Promise<FetchResult<ProductData>> {
    const result = await this.degradationExecutor.execute(
      this.degradationPath,
      async (source) => this.doFetchProduct(platformId, source),
      { maxSources: 3 },
    );

    return {
      success: true,
      data: result.data,
      source: result.source,
      degradationLevel: result.degradationLevel,
    };
  }
}
```

**理由**:

- Adapter 只负责业务逻辑，不关心降级细节
- 多个工具共享同一个 DegradationExecutor
- 配置可选，默认行为不变
- 易于测试和调试

### Decision 6: 工具参数透传

**选择**: 工具支持 degradation 参数，透传到 Adapter

```typescript
// tools/product-fetch-tool.ts
{
  parameters: Type.Object({
    platform: Type.String(),
    productId: Type.String(),

    degradation: Type.Optional(Type.Object({
      preset: Type.Optional(Type.StringEnum(["standard", "cost-optimized", ...])),
      skipTypes: Type.Optional(Type.Array(Type.StringEnum(["official_api", ...]))),
      maxSources: Type.Optional(Type.Number()),
    })),
  }),

  async execute(_id: string, params: Record<string, unknown>) {
    const degradation = params.degradation as DegradationOptions | undefined;

    const result = await adapter.fetchProduct(platformId, { degradation });
    // ...
  },
}
```

**理由**:

- 用户可自定义降级策略
- 参数简洁，易于理解
- 透传到 Adapter，无需中间层转换

### Decision 7: 冷却窗口保持不变

**选择**: 如果数据源已经在冷却中，只增加 errorCount，不延长冷却时间

```typescript
recordFailure(sourceId: string, error: ClassifiedError): void {
  const currentState = this.cooldowns.get(sourceId);
  const now = Date.now();

  // 关键：如果已经在冷却中，不延长冷却时间
  if (currentState?.cooldownUntil && now < currentState.cooldownUntil) {
    this.cooldowns.set(sourceId, {
      ...currentState,
      errorCount: currentState.errorCount + 1,  // 只增加计数
      lastErrorAt: now,
      lastErrorReason: error.reason,
    });
    return;
  }

  // 否则，计算新的冷却时间
  const duration = this.calculateCooldown(error, (currentState?.errorCount ?? 0) + 1);
  this.cooldowns.set(sourceId, {
    sourceId,
    errorCount: (currentState?.errorCount ?? 0) + 1,
    cooldownUntil: now + duration,
    ...
  });
}
```

**理由**:

- 避免"冷却时间无限延长"的问题（借鉴 OpenClaw）
- 如果数据源在冷却中，不应该因为新的错误而延长冷却
- errorCount 会累加，影响下次冷却时间的计算
- 提供手动重置接口（clearCooldown）

### Decision 8: 错误分类优先级

**选择**: 借鉴 OpenClaw 的多层分类策略，按优先级排序

```
错误分类优先级（从高到低）:

1. 特殊情况（不降级）
   - ImageSizeError, ImageDimensionError → null
   - 这些错误不应该触发降级

2. 严重错误（长冷却）
   - Billing error → "billing"
   - Auth permanent error → "auth_permanent"
   - Blocked error → "blocked"
   - 这些错误需要更长的冷却时间

3. 临时错误（短冷却）
   - Rate limit → "rate_limit"
   - Overloaded → "overloaded"
   - Timeout → "timeout"
   - 这些错误可能自动恢复

4. 平台特定错误
   - HTTP status code (Axios error)
   - Node error code (ETIMEDOUT, ECONNREFUSED)
   - Platform-specific error code
   - Platform-specific pattern matching

5. 默认
   - Unknown error → "unknown"
```

**理由**:

- 不同错误需要不同的处理策略
- 严重错误应该优先检测，避免误分类
- 平台特定错误提供更精确的分类
- 借鉴 OpenClaw 成熟的分类策略

### Decision 9: 可配置的冷却时间

**选择**: 提供 CooldownSettings 接口，支持自定义冷却时间

```typescript
interface CooldownSettings {
  // 普通错误冷却时间（分钟）
  normalDurations?: number[];  // 默认 [1, 5, 15, 30]

  // 严重错误冷却时间（小时）
  severeDurations?: number[];  // 默认 [1, 2, 4, 24]

  // 是否启用冷却
  enabled?: boolean;  // 默认 true
}

// 使用示例
const executor = new DegradationExecutor({
  cooldownSettings: {
    normalDurations: [1, 5, 15, 30],     // 1m, 5m, 15m, 30m
    severeDurations: [1, 2, 4, 24],      // 1h, 2h, 4h, 24h
  },
  ...
});
```

**理由**:

- 提供灵活性，满足不同业务场景
- 默认值合理，满足 80% 场景
- 可禁用冷却（enabled: false）
- 配置简洁，易于理解

## Risks / Trade-offs

**Risk 1**: 冷却时间过长导致数据源闲置
→ Mitigation: Probe 机制提前恢复（P2 阶段）

**Risk 2**: 错误分类不准确
→ Mitigation: 提供手动重置接口（clearCooldown）

**Risk 3**: 日志量大
→ Mitigation: 按 runId 聚合，定期清理

**Risk 4**: 冷却时间配置不当
→ Mitigation: 提供合理的默认值，文档说明配置建议

**Trade-off 1**: 不持久化冷却状态，重启后重置
→ 可接受：重启后重新统计是合理的

**Trade-off 2**: 不实现 Probe 机制（P2 阶段）
→ 可接受：冷却时间已经较短（1m → 30m），可以等待
