# meichao-ecom 降级模块实现方案

## 概述

本方案旨在为 meichao-ecom 插件创建统一的降级策略模块，管理 `ecom-product-fetch` 和 `ecom-product-search` 两个工具的降级行为。

**核心需求**：

1. 统一管理工具的降级策略
2. 固定降级路径：`official_api → third_party_api → skill_crawler → open_search`（通过 DataSource.type 判断）
3. 每个平台独立管理，无跨平台回退
4. 借鉴 OpenClaw Model Failover 最佳实践

**设计原则**：

- 简洁配置，智能降级
- 稳定性优先，灵活性可选
- 统一管理，复用代码
- 使用完整数据源 ID（如 `taobao_official_api`），通过 `type` 字段判断降级顺序

---

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│           降级模块架构                                            │
└─────────────────────────────────────────────────────────────────┘

extensions/meichao-ecom/src/
├── infrastructure/
│   └── degradation/              # 统一降级模块
│       ├── index.ts              # 导出
│       ├── types.ts              # 类型定义
│       ├── DegradationPath.ts    # 降级路径管理（核心）
│       ├── DegradationExecutor.ts # 降级执行器
│       ├── CooldownManager.ts    # 冷却时间管理
│       └── __tests__/            # 测试
│
├── infrastructure/adapters/
│   ├── BasePlatformAdapter.ts    # 简化，只负责业务逻辑
│   ├── TaobaoAdapter.ts
│   └── AmazonAdapter.ts
│
└── tools/
    ├── product-fetch-tool.ts     # 使用统一降级模块
    └── product-search-tool.ts    # 使用统一降级模块
```

### 核心组件

```
┌─────────────────────────────────────────────────────────────────┐
│           核心组件职责                                            │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────┬──────────────────────────────────────────┐
│  组件                │  职责                                     │
├──────────────────────┼──────────────────────────────────────────┤
│  DegradationPath     │  - 管理固定降级路径                       │
│                      │  - 提供数据源选择逻辑                     │
│                      │  - 支持可配置选项                         │
├──────────────────────┼──────────────────────────────────────────┤
│  DegradationExecutor │  - 执行降级逻辑                           │
│                      │  - 协调 Retry + CircuitBreaker           │
│                      │  - 记录降级决策                           │
│                      │  - 被多个工具共享                         │
├──────────────────────┼──────────────────────────────────────────┤
│  CooldownManager     │  - 管理数据源冷却时间                     │
│                      │  - 指数退避算法                           │
│                      │  - 区分临时/严重错误                       │
└──────────────────────┴──────────────────────────────────────────┘
```

---

## 详细设计

### 1. DegradationPath（降级路径管理）

**职责**：管理固定的降级路径，提供数据源选择逻辑。

**设计**：

```typescript
/**
 * 降级路径管理器
 *
 * 核心特性：
 * 1. 固定降级路径（通过 type 字段判断）
 * 2. 支持跳过某些数据源类型
 * 3. 支持预设模板
 * 4. 高级模式支持自定义顺序
 *
 * 数据源 ID 格式：{platform}_{type}（如 taobao_official_api）
 * 降级判断：通过 DataSource.type 字段
 */
export class DegradationPath {
  /**
   * 核心降级顺序（固定，基于 type）
   */
  private static readonly CORE_ORDER: DataSourceType[] = [
    "official_api",
    "third_party_api",
    "skill_crawler",
    "open_search",
  ];

  /**
   * 预设模板（基于 type）
   */
  private static readonly PRESETS: Record<string, DataSourceType[]> = {
    standard: ["official_api", "third_party_api", "skill_crawler", "open_search"],
    "cost-optimized": ["official_api", "skill_crawler", "open_search"],
    "speed-optimized": ["third_party_api", "official_api", "open_search"],
    "reliability-first": ["official_api", "third_party_api"],
  };

  private platform: Platform;
  private sources: Map<string, DataSource>; // key = 完整 ID（如 taobao_official_api）

  constructor(platform: Platform, sources: DataSource[]) {
    this.platform = platform;
    this.sources = new Map(sources.map((s) => [s.id, s]));
  }

  /**
   * 获取降级路径
   */
  getPath(options?: DegradationOptions): DataSource[] {
    // 1. 确定降级顺序（预设 or 核心）
    const typeOrder = options?.preset
      ? DegradationPath.PRESETS[options.preset]
      : DegradationPath.CORE_ORDER;

    // 2. 应用跳过规则
    const filteredTypes = typeOrder.filter((type) => !options?.skipTypes?.includes(type));

    // 3. 映射到实际数据源
    const result: DataSource[] = [];
    for (const type of filteredTypes) {
      // 查找该类型的数据源
      const source = this.findSourceByType(type);
      if (source && source.isAvailable && source.hasRemainingQuota()) {
        result.push(source);
      }

      // 检查是否达到最大数量
      if (options?.maxSources && result.length >= options.maxSources) {
        break;
      }
    }

    return result;
  }

  /**
   * 根据 type 查找数据源
   */
  private findSourceByType(type: DataSourceType): DataSource | null {
    for (const source of this.sources.values()) {
      if (source.type === type) {
        return source;
      }
    }
    return null;
  }
}
```

**配置选项**：

```typescript
interface DegradationOptions {
  // 预设模板
  preset?: "standard" | "cost-optimized" | "speed-optimized" | "reliability-first";

  // 跳过的数据源类型
  skipTypes?: DataSourceType[];

  // 是否允许爬虫
  allowCrawler?: boolean;

  // 是否允许开放搜索
  allowOpenSearch?: boolean;

  // 最大数据源数量
  maxSources?: number;
}
```

### 2. DegradationExecutor（降级执行器）

**职责**：执行降级逻辑，协调 Retry + CircuitBreaker，记录决策。

**设计**：

```typescript
/**
 * 降级执行器
 *
 * 核心特性：
 * 1. 执行降级逻辑
 * 2. 协调 Retry + CircuitBreaker
 * 3. 记录降级决策
 * 4. 被多个工具共享
 */
export class DegradationExecutor {
  /**
   * 执行降级逻辑
   */
  async execute<T>(
    path: DegradationPath,
    fn: (source: DataSource) => Promise<T>,
    options?: DegradationOptions,
  ): Promise<DegradationResult<T>> {
    // 1. 获取降级路径
    const sources = path.getPath(options);

    // 2. 循环尝试每个数据源
    for (const source of sources) {
      // 3. 检查 CircuitBreaker
      // 4. 使用 RetryRunner 执行
      // 5. 错误分类
      // 6. 记录决策
      // 7. 成功返回，失败继续
    }

    // 8. 所有数据源失败，抛出错误
  }
}
```

### 3. CooldownManager（冷却时间管理）

**职责**：管理数据源冷却时间，区分临时/严重错误。

**设计**：

```typescript
/**
 * 冷却时间管理器
 *
 * 核心特性：
 * 1. 指数退避算法
 * 2. 区分临时/严重错误
 * 3. 冷却窗口保持不变（借鉴 OpenClaw）
 * 4. 自动恢复
 * 5. 可配置冷却时间
 */
export class CooldownManager {
  private cooldowns: Map<string, CooldownState> = new Map();
  private settings: Required<CooldownSettings>;

  constructor(settings?: CooldownSettings) {
    this.settings = {
      normalDurations: settings?.normalDurations ?? [1, 5, 15, 30], // 分钟
      severeDurations: settings?.severeDurations ?? [1, 2, 4, 24], // 小时
      enabled: settings?.enabled ?? true,
    };
  }

  /**
   * 记录失败
   *
   * 关键逻辑（借鉴 OpenClaw）：
   * - 如果已经在冷却中，只增加 errorCount，不延长冷却时间
   * - 否则，计算新的冷却时间
   */
  recordFailure(sourceId: string, error: ClassifiedError): void {
    if (!this.settings.enabled) return;

    const currentState = this.cooldowns.get(sourceId);
    const now = Date.now();

    // 关键：如果已经在冷却中，不延长冷却时间（借鉴 OpenClaw）
    if (currentState?.cooldownUntil && now < currentState.cooldownUntil) {
      this.cooldowns.set(sourceId, {
        ...currentState,
        errorCount: currentState.errorCount + 1, // 只增加计数
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
      lastErrorAt: now,
      lastErrorReason: error.reason,
    });
  }

  /**
   * 计算冷却时间（借鉴 OpenClaw）
   */
  private calculateCooldown(error: ClassifiedError, errorCount: number): number {
    const durations = error.isSevere
      ? this.settings.severeDurations.map((h) => h * 60 * 60 * 1000) // 小时转毫秒
      : this.settings.normalDurations.map((m) => m * 60 * 1000); // 分钟转毫秒

    return durations[Math.min(errorCount - 1, durations.length - 1)];
  }

  /**
   * 记录成功（重置冷却状态）
   */
  recordSuccess(sourceId: string): void {
    this.cooldowns.set(sourceId, {
      sourceId,
      errorCount: 0,
      cooldownUntil: undefined,
      lastSuccessAt: Date.now(),
      lastErrorAt: undefined,
      lastErrorReason: undefined,
    });
  }

  /**
   * 是否在冷却中
   */
  isInCooldown(sourceId: string): boolean {
    const state = this.cooldowns.get(sourceId);
    if (!state?.cooldownUntil) return false;
    return Date.now() < state.cooldownUntil;
  }

  /**
   * 获取冷却状态
   */
  getCooldownState(sourceId: string): CooldownState | undefined {
    return this.cooldowns.get(sourceId);
  }

  /**
   * 清除冷却
   */
  clearCooldown(sourceId: string): void {
    this.cooldowns.delete(sourceId);
  }
}

/**
 * 冷却状态
 */
interface CooldownState {
  sourceId: string;
  errorCount: number;
  cooldownUntil?: number;
  lastErrorAt?: number;
  lastErrorReason?: DataSourceFailoverReason;
  lastSuccessAt?: number;
}

/**
 * 冷却时间配置
 */
interface CooldownSettings {
  // 普通错误冷却时间（分钟）
  normalDurations?: number[]; // 默认 [1, 5, 15, 30]

  // 严重错误冷却时间（小时）
  severeDurations?: number[]; // 默认 [1, 2, 4, 24]

  // 是否启用冷却
  enabled?: boolean; // 默认 true
}
```

---

## 使用示例

### 在 Adapter 中使用

```typescript
// infrastructure/adapters/TaobaoAdapter.ts

import { DegradationPath, DegradationExecutor } from "../degradation/index.js";

export class TaobaoAdapter extends BasePlatformAdapter {
  private degradationPath: DegradationPath;
  private degradationExecutor: DegradationExecutor;

  constructor(sources: DataSource[]) {
    // 创建降级路径
    this.degradationPath = new DegradationPath("taobao", sources);

    // 创建降级执行器
    this.degradationExecutor = new DegradationExecutor({
      retryRunnerFactory: (platform) => createPlatformRetryRunner(platform),
      circuitBreakerConfig: DEFAULT_CIRCUIT_BREAKER_CONFIG,
      errorClassifier: (err, platform) => classifyError(err, platform),
    });
  }

  async fetchProduct(platformId: string): Promise<FetchResult<ProductData>> {
    // 使用统一降级执行器
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

  async searchProducts(keyword: string): Promise<FetchResult<SearchResult>> {
    // 使用相同的降级执行器
    const result = await this.degradationExecutor.execute(
      this.degradationPath,
      async (source) => this.doSearchProducts(keyword, source),
      {
        maxSources: 4,
        allowOpenSearch: true,
      },
    );

    return {
      success: true,
      data: result.data,
      source: result.source,
    };
  }
}
```

### 在 Tool 中使用

```typescript
// tools/product-fetch-tool.ts

export function createProductFetchTool(api: OpenClawPluginApi) {
  return {
    name: "ecom-product-fetch",
    parameters: Type.Object({
      platform: Type.String(),
      productId: Type.String(),

      // 降级选项
      degradation: Type.Optional(
        Type.Object({
          // 预设模板
          preset: Type.Optional(
            Type.String({
              enum: ["standard", "cost-optimized", "speed-optimized", "reliability-first"],
            }),
          ),

          // 跳过的数据源类型（基于 type 字段）
          skipTypes: Type.Optional(
            Type.Array(
              Type.String({
                enum: ["official_api", "third_party_api", "skill_crawler", "open_search"],
              }),
            ),
          ),

          // 最大数据源数量
          maxSources: Type.Optional(Type.Number()),
        }),
      ),
    }),

    async execute(_id: string, params: Record<string, unknown>) {
      const degradation = params.degradation as DegradationOptions | undefined;

      const result = await adapter.fetchProduct(platformId, {
        degradation, // 透传到 Adapter
      });

      // ...
    },
  };
}
```

**数据源命名约定**：

- ID 格式：`{platform}_{type}`（如 `taobao_official_api`, `amazon_sp_api`）
- Type 字段：`official_api` / `third_party_api` / `skill_crawler` / `open_search`
- 降级逻辑：通过 `DataSource.type` 字段判断顺序

---

## 实现优先级

### P0（必须实现）

```
┌─────────────────────────────────────────────────────────────────┐
│  Phase 1: 核心降级路径（~3 天）                                  │
└─────────────────────────────────────────────────────────────────┘

任务 1.1: 创建 DegradationPath 类
  - 文件: infrastructure/degradation/DegradationPath.ts
  - 行数: ~100 lines
  - 测试: __tests__/DegradationPath.test.ts

任务 1.2: 创建 DegradationExecutor 类
  - 文件: infrastructure/degradation/DegradationExecutor.ts
  - 行数: ~150 lines
  - 测试: __tests__/DegradationExecutor.test.ts

任务 1.3: 创建 CooldownManager 类
  - 文件: infrastructure/degradation/CooldownManager.ts
  - 行数: ~80 lines
  - 测试: __tests__/CooldownManager.test.ts

任务 1.4: 重构 BasePlatformAdapter
  - 文件: infrastructure/adapters/BasePlatformAdapter.ts
  - 修改: 简化到 ~150 lines

任务 1.5: 更新 TaobaoAdapter 和 AmazonAdapter
  - 文件: infrastructure/adapters/TaobaoAdapter.ts
  - 文件: infrastructure/adapters/AmazonAdapter.ts
  - 修改: 使用 DegradationPath 和 DegradationExecutor
```

### P1（推荐实现）

```
┌─────────────────────────────────────────────────────────────────┐
│  Phase 2: 预设模板 + 工具参数（~2 天）                           │
└─────────────────────────────────────────────────────────────────┘

任务 2.1: 实现预设模板
  - 文件: infrastructure/degradation/DegradationPath.ts
  - 添加: PRESETS 常量
  - 测试: 预设模板测试

任务 2.2: 更新工具参数
  - 文件: tools/product-fetch-tool.ts
  - 文件: tools/product-search-tool.ts
  - 添加: degradation 参数
```

### P2（可选实现）

```
┌─────────────────────────────────────────────────────────────────┐
│  Phase 3: 高级特性（~2 天）                                      │
└─────────────────────────────────────────────────────────────────┘

任务 3.1: 会话粘性
  - 文件: infrastructure/degradation/SessionStickiness.ts
  - 行数: ~50 lines
  - 用途: 为批量任务固定数据源，提升缓存效率

任务 3.2: 自定义降级顺序
  - 文件: infrastructure/degradation/DegradationPath.ts
  - 修改: 支持自定义顺序（advanced 模式）
  - 验证: 确保自定义顺序合法
```

---

## 文件清单

### 新增文件

```
extensions/meichao-ecom/src/infrastructure/degradation/
├── index.ts                          (~30 lines)
├── types.ts                          (~50 lines)
├── DegradationPath.ts                (~100 lines)
├── DegradationExecutor.ts            (~150 lines)
├── CooldownManager.ts                (~80 lines)
└── __tests__/
    ├── DegradationPath.test.ts       (~100 lines)
    ├── DegradationExecutor.test.ts   (~150 lines)
    └── CooldownManager.test.ts       (~80 lines)

总计: ~740 lines（新增）
```

### 修改文件

```
extensions/meichao-ecom/src/
├── infrastructure/adapters/
│   ├── BasePlatformAdapter.ts        (347 → 150 lines, 减少 ~200 lines)
│   ├── TaobaoAdapter.ts              (减少 ~10 lines)
│   └── AmazonAdapter.ts              (减少 ~10 lines)
│
└── tools/
    ├── product-fetch-tool.ts         (+10 lines)
    └── product-search-tool.ts        (+10 lines)

净增加: ~540 lines
```

---

## 测试策略

### 单元测试

```typescript
// DegradationPath.test.ts

describe("DegradationPath", () => {
  test("返回固定降级顺序", () => {
    const path = new DegradationPath("taobao", sources);
    const result = path.getPath();

    expect(result.map((s) => s.type)).toEqual([
      "official_api",
      "third_party_api",
      "skill_crawler",
      "open_search",
    ]);
  });

  test("支持跳过数据源", () => {
    const path = new DegradationPath("taobao", sources);
    const result = path.getPath({ skipTypes: ["skill_crawler"] });

    expect(result.map((s) => s.type)).toEqual(["official_api", "third_party_api", "open_search"]);
  });

  test("支持预设模板", () => {
    const path = new DegradationPath("taobao", sources);
    const result = path.getPath({ preset: "cost-optimized" });

    expect(result.map((s) => s.type)).toEqual(["official_api", "skill_crawler", "open_search"]);
  });
});
```

### 集成测试

```typescript
// DegradationExecutor.test.ts

describe("DegradationExecutor", () => {
  test("降级到下一个数据源", async () => {
    const executor = new DegradationExecutor(config);
    const path = new DegradationPath("taobao", sources);

    // Mock: 第一个数据源失败
    mockFetchProduct
      .mockRejectedValueOnce(new Error("rate limit"))
      .mockResolvedValueOnce({ data: "success" });

    const result = await executor.execute(path, async (source) => mockFetchProduct(source));

    expect(result.source).toBe("taobao_third_party");
    expect(result.attempts).toHaveLength(2);
  });

  test("严重错误立即失败", async () => {
    const executor = new DegradationExecutor(config);
    const path = new DegradationPath("taobao", sources);

    // Mock: 严重错误
    mockFetchProduct.mockRejectedValue(new Error("account frozen"));

    await expect(executor.execute(path, fn)).rejects.toThrow("account frozen");
  });
});
```

---

## 风险与缓解

### 风险 1: 破坏现有功能

**缓解**：

- 保持向后兼容，默认行为不变
- 分阶段重构，逐步迁移
- 完整的测试覆盖

### 风险 2: 性能影响

**缓解**：

- DegradationPath 和 DegradationExecutor 轻量级
- 不引入额外依赖
- 复用现有的 Retry 和 CircuitBreaker

### 风险 3: 配置复杂度

**缓解**：

- 提供预设模板，降低使用门槛
- 默认配置合理，满足 80% 场景
- 文档清晰，示例充分

---

## 参考文档

- [OpenClaw Model Failover](/concepts/model-failover)
- [meichao-ecom 数据源降级策略](./meichao-ecom-数据源降级策略.md)
- [Resilience4j Documentation](https://resilience4j.readme.io/)

---

**文档版本**: v1.0  
**创建日期**: 2026-04-02  
**作者**: OpenClaw Team
