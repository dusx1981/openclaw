## Context

meichao-ecom 插件当前的架构问题：

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         当前架构问题                                                  │
└─────────────────────────────────────────────────────────────────────────────────────┘

  问题 1: 实例不共享
  ─────────────────────────────────────────────────────────────────────────────────────

  bootstrap.ts                         TaobaoValidator.ts
  ┌─────────────────────┐              ┌─────────────────────┐
  │ TaobaoAdapter       │              │ TaobaoAdapter       │
  │ .create()           │              │ .create()           │
  │ (实例 A)            │              │ (实例 B)            │
  │                     │              │                     │
  │ circuitBreakers ────┼──────────────┼─ circuitBreakers    │
  │ cooldownManager ────┼──────────────┼─ cooldownManager    │
  │ dataSources ────────┼──────────────┼─ dataSources        │
  └─────────────────────┘              └─────────────────────┘
           │                                    │
           ▼                                    ▼
    共享状态                              独立状态
    (fetch/search 使用)                  (validator 使用)

  问题 2: searchProducts 无降级
  ─────────────────────────────────────────────────────────────────────────────────────

  fetchProduct()                        searchProducts()
  ┌─────────────────────┐              ┌─────────────────────┐
  │ fetchWithFailover() │              │ getDataSource()     │
  │                     │              │ (只取一个源)         │
  │ source1 → fail      │              │                     │
  │ source2 → fail      │              │ try {               │
  │ source3 → OK!       │              │   withRetry()       │
  │                     │              │ } catch {           │
  │ ✅ 有降级           │              │   return error      │
  └─────────────────────┘              │ }                   │
                                       │                     │
                                       │ ❌ 无降级            │
                                       └─────────────────────┘
```

## Goals / Non-Goals

**Goals:**

- 修复 `TaobaoValidator` 使用共享的 `TaobaoAdapter` 实例
- 为 `searchProducts()` 添加与 `fetchProduct()` 相同的降级机制
- 创建可扩展的 `ProductSearchProvider` 接口，支持多种开放搜索提供商
- 实现 Bing Shopping 和 Tavily 作为开放搜索提供商
- 保持向后兼容，现有工具调用方式不变

**Non-Goals:**

- 不修改 `fetchProduct()` 的现有实现
- 不添加新的电商平台支持（只针对现有的 taobao/amazon）
- 不实现开放搜索结果的自动平台识别（返回数据标记来源）

## Decisions

### 1. ProductSearchProvider 接口设计

**决定：** 创建独立的 `ProductSearchProvider` 接口，而非复用 OpenClaw 的 `WebSearchProvider`

**理由：**

- `WebSearchProvider` 返回网页搜索结果（标题、URL、片段）
- 商品搜索需要电商特定字段（价格、销量、评分、店铺）
- 独立接口允许针对电商场景优化（平台过滤、价格范围）

**替代方案：**

- 直接使用 `WebSearchProvider` 并转换结果 — 需要在多处处理转换逻辑
- 在 `BasePlatformAdapter` 中硬编码开放搜索 — 不易扩展

### 2. 开放搜索提供商优先级

**决定：** Bing Shopping 优先，Tavily 作为 fallback

**理由：**

- Bing Shopping 免费配额 1000 次/月，适合开发和小规模使用
- Bing 国内访问相对稳定
- Tavily 已有 OpenClaw 基础设施支持，作为备选

**替代方案：**

- Google Shopping — 需要代理，国内不稳定
- SerpAPI — 付费服务，成本较高

### 3. 数据源类型扩展

**决定：** 在 `DataSourceType` 中新增 `"open_search"` 类型

**理由：**

- 与现有 `"official_api"`、`"third_party_api"`、`"skill_crawler"` 保持一致
- 允许配置系统区分数据源类型
- 便于监控和日志分析

### 4. 共享实例修复方式

**决定：** `TaobaoValidator` 从 `PlatformRegistry` 获取共享实例

**理由：**

- 保持状态一致性（熔断器、冷却管理器）
- 减少内存占用
- 验证结果反映实际运行状态

**替代方案：**

- 将验证器状态同步到共享实例 — 复杂且容易出错
- 创建新的共享状态管理器 — 过度设计

## Risks / Trade-offs

### [Risk] 开放搜索数据质量较低

→ **Mitigation：** 在返回结果中标记 `dataSource: "open_search"` 和 `dataQuality: "medium"`

### [Risk] Bing API 配额限制

→ **Mitigation：** 在 DataSource 中设置 `dailyQuota`，达到配额后自动跳过

### [Risk] 开放搜索返回非目标平台商品

→ **Mitigation：** 使用 `site:` 过滤限定搜索范围（如 `site:taobao.com OR site:tmall.com`）

### [Risk] 搜索结果格式不一致

→ **Mitigation：** 在 `ProductSearchProvider` 接口中定义转换层，统一输出格式

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         目标架构                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘

  extensions/meichao-ecom/src/infrastructure/
  │
  ├── search/                              # 新建
  │   ├── index.ts
  │   ├── types.ts                         # ProductSearchParams, ProductSearchResult
  │   ├── ProductSearchProvider.ts         # Provider 接口
  │   ├── ProductSearchClient.ts           # 统一客户端 + 降级逻辑
  │   └── providers/
  │       ├── BingShoppingProvider.ts      # Bing Shopping API
  │       └── TavilyProductProvider.ts     # Tavily (复用 OpenClaw)
  │
  └── adapters/
      └── TaobaoAdapter.ts                 # 修改: searchProducts 使用 fetchWithFailover


  搜索请求流程:
  ─────────────────────────────────────────────────────────────────────────────────────

  ecom-product-search
        │
        ▼
  SearchProductsUseCase.execute()
        │
        ▼
  TaobaoAdapter.searchProducts()
        │
        ▼
  ┌─────────────────────────────────────────────────────────────────────────────────────┐
  │  fetchWithFailover()                                                               │
  │                                                                                    │
  │  ┌─────────────────┐                                                              │
  │  │ taobao_official │  priority: 1                                                  │
  │  │ _api            │  (淘宝官方 API，需要密钥)                                      │
  │  └─────────────────┘                                                              │
  │         │ fail                                                                     │
  │         ▼                                                                          │
  │  ┌─────────────────┐                                                              │
  │  │ taobao_third    │  priority: 2                                                  │
  │  │ _party          │  (第三方聚合 API)                                              │
  │  └─────────────────┘                                                              │
  │         │ fail                                                                     │
  │         ▼                                                                          │
  │  ┌─────────────────┐                                                              │
  │  │ taobao_crawler  │  priority: 3                                                  │
  │  │                 │  (网页爬虫)                                                    │
  │  └─────────────────┘                                                              │
  │         │ fail                                                                     │
  │         ▼                                                                          │
  │  ┌─────────────────┐                                                              │
  │  │ taobao_open     │  priority: 4                                                  │
  │  │ _search         │  (开放搜索 ← 新增)                                             │
  │  │                 │                                                               │
  │  │ ProductSearchClient.search() →                                                  │
  │  │   BingShoppingProvider                                                         │
  │  │   ↓ fail                                                                       │
  │  │   TavilyProductProvider                                                        │
  │  └─────────────────┘                                                              │
  │                                                                                    │
  └─────────────────────────────────────────────────────────────────────────────────────┘


  共享实例修复:
  ─────────────────────────────────────────────────────────────────────────────────────

  Before:
  ┌─────────────────────────────────────────────────────────────────────────────────────┐
  │  class TaobaoValidator {                                                            │
  │    constructor() {                                                                  │
  │      this.adapter = TaobaoAdapter.create();   // 独立实例                          │
  │    }                                                                               │
  │  }                                                                                 │
  └─────────────────────────────────────────────────────────────────────────────────────┘

  After:
  ┌─────────────────────────────────────────────────────────────────────────────────────┐
  │  class TaobaoValidator {                                                            │
  │    constructor() {                                                                  │
  │      this.adapter = PlatformRegistry.get("taobao");   // 共享实例                   │
  │    }                                                                               │
  │  }                                                                                 │
  └─────────────────────────────────────────────────────────────────────────────────────┘
```

## Migration Plan

1. **创建 `search/` 模块** — 不影响现有代码
2. **修改 `TaobaoAdapter`** — 添加新数据源和降级逻辑
3. **修复 `TaobaoValidator`** — 使用共享实例
4. **更新配置** — 添加 `BING_API_KEY` 环境变量
5. **添加测试** — 确保降级逻辑正确

无破坏性变更，现有工具调用方式保持不变。

## Open Questions

- 是否需要为 Amazon 也添加开放搜索支持？（可在后续迭代）
- Bing Custom Search Engine ID 是否需要配置？（可使用默认配置）
