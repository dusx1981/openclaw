# 基础设施能力地图

> 让任何 agent 都能快速了解"已有什么能力可以复用"，以及"不做什么"

---

## 📊 系统架构概览

### 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                   美潮电商系统架构                        │
│                  总计：10183 行 TypeScript               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  用户接口层 (CLI/Tools) - 1025 行                       │
│  ├─ CLI Commands: fetch, search, validate, platforms   │
│  └─ Agent Tools: product-fetch, product-search        │
│                         ↓                               │
│  应用层 (Application) - 1784 行                         │
│  ├─ Use Cases: FetchProductUseCase, SearchProductsUseCase│
│  ├─ Pipeline: DataPipeline (ETL 过滤器链)              │
│  └─ Services: AlertService, QuotaService               │
│                         ↓                               │
│  领域层 (Domain) - 1184 行 ⭐ 核心业务逻辑               │
│  ├─ Entities: Product                                  │
│  ├─ Value Objects: DataSource, Quota                   │
│  ├─ Ports: PlatformGateway, ProductRepository, CacheProvider│
│  └─ Types: Platform, ProductData, DataSourceType...    │
│                         ↓                               │
│  基础设施层 (Infrastructure) - 5715 行                   │
│  ├─ 容错系统 (1553 行) ⭐ 核心竞争力                    │
│  │   └─ ErrorClassifier, CircuitBreaker, Degradation...│
│  ├─ 平台适配器 (811 行)                                │
│  │   └─ BasePlatformAdapter, TaobaoAdapter, AmazonAdapter│
│  ├─ 存储层 (1307 行) ⭐ 新增事务管理                   │
│  │   └─ TransactionManager (218), PoolHealthCheck (212), Repository (877)│
│  ├─ 缓存层 (444 行) ⭐ 优化 keys() 性能                │
│  │   └─ CacheProvider (302), RedisKeyManager (142)     │
│  ├─ 平台 API (818 行) ⭐ 新增 Amazon SP-API           │
│  │   ├─ Taobao API (558 行) - 完整实现                 │
│  │   └─ Amazon API (260 行) - SP-API 集成             │
│  │       ├─ AmazonSPApiClient.ts (110 行)             │
│  │       └─ AmazonProductApi.ts (150 行)              │
│  ├─ 搜索系统 (221 行)                                  │
│  │   └─ ProductSearchClient, Bing, Tavily             │
│  └─ 注册中心、重试策略 (172 行)                        │
│                                                         │
│  辅助模块: Validation (760 行), Helpers (717 行)        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 六边形架构（领域驱动设计）

```
                    ┌──────────┐
                    │   CLI    │
                    │  Tools   │
                    └─────┬────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
    ┌────▼────┐      ┌────▼────┐     ┌────▼────┐
    │ Fetch   │      │ Search  │     │Validate │  Use Cases
    │ UseCase │      │ UseCase │     │ UseCase │
    └────┬────┘      └────┬────┘     └────┬────┘
         │                │                │
         └────────────────┼────────────────┘
                          │
                    ┌─────▼────┐
                    │  Domain  │ ⭐ 领域核心无外部依赖
                    │  Layer   │
                    └─────┬────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
    ┌────▼────┐      ┌────▼────┐     ┌────▼────┐
    │Platform │      │ Storage │     │  Cache  │  Adapters
    │Gateway  │      │ Adapter │     │Provider │  (实现 Ports)
    │ (Taobao)│      │  (PG)   │     │ (Redis) │
    └─────────┘      └─────────┘     └─────────┘

关键原则：
├─ Domain 层无外部依赖（纯业务逻辑）
├─ Application 层依赖 Domain 接口
└─ Infrastructure 层实现 Domain 接口
```

---

## 🔄 协作关系

### 模块间依赖

```
依赖方向：外层 → 内层

CLI/Tools
    ├─ 依赖 → Application (Use Cases, Pipeline)
    └─ 调用 → bootstrap.initializePlatform()

Application
    ├─ 依赖 → Domain (Ports 接口)
    ├─ 使用 → Container (依赖注入)
    └─ 协调 → Gateway, Repository, Cache

Domain
    └─ 无外部依赖 ⭐

Infrastructure
    ├─ 实现 → Domain Ports
    ├─ 继承 → BasePlatformAdapter (容错系统)
    └─ 依赖 → 外部服务 (PostgreSQL, Redis, API)
```

### 数据流（典型请求）

```
用户请求
    ↓
UseCase.execute(platform, ids)
    ↓
DataPipeline.execute()
    ↓
Filters Chain:
    ├─ FetchFilter
    │   └─ PlatformGateway.fetchProducts()
    │       └─ BasePlatformAdapter.fetchWithFailover()
    │           └─ DegradationExecutor.execute()
    │               ├─ 尝试 primary source
    │               ├─ 失败 → fallback source
    │               └─ 记录决策日志
    ├─ ValidateFilter
    ├─ DedupeFilter
    ├─ StoreFilter
    │   └─ ProductRepository.save()
    │       └─ TransactionManager.runInTransaction()
    └─ CacheFilter
        └─ CacheProvider.set()
    ↓
返回 PipelineResult
```

### 容错系统协作

```
fetchProduct() 调用
    ↓
BasePlatformAdapter.fetchWithFailover()
    ├─ 构建 DegradationPath（数据源优先级）
    └─ 调用 DegradationExecutor.execute()
        ↓
    for (source in path) {
        ├─ 检查 CooldownManager.isInCooldown()
        ├─ 检查 CircuitBreaker.canExecute()
        ├─ 调用 RetryRunner（带重试）
        │   └─ doFetchProduct()
        ├─ 成功 → 返回结果
        └─ 失败 →
            ├─ ErrorClassifier.classifyError()
            ├─ DecisionLogger.log()
            ├─ CooldownManager.recordFailure()
            └─ 尝试下一个数据源
    }
```

---

## 💼 业务功能

### 1. 产品数据采集

**支持的数据源（按优先级）**:

```
1. official_api (优先级 1)
   - 免费或低成本
   - 最可靠，数据最准确

2. third_party_api (优先级 2)
   - 付费服务，速度快
   - 数据质量参差不齐

3. skill_crawler (优先级 3)
   - 付费服务，速度慢
   - 数据可能不完整

4. open_search (优先级 4)
   - 免费或低成本
   - 数据不准确（最终降级方案）
```

**降级流程**:

```
官方 API → 第三方 API → 爬虫 → 开放搜索
   ↓ 失败      ↓ 失败    ↓ 失败   ↓ 成功/失败
```

**已实现平台**:

- ✅ Taobao（完整实现，4 个数据源）
- ✅ Amazon（SP-API 集成，Product Pricing + Catalog Items API）

### 2. 产品搜索

**支持的搜索 Provider**:

```
Bing Shopping API (133 行)
- 免费层：1000 次/月
- 支持自定义搜索配置
- 购物结果优化

Tavily API (83 行)
- 通过 OpenClaw tavily 插件
- 需要配置 API Key
```

**使用场景**: 当主数据源不可用时的降级搜索

### 3. 平台验证

**验证项**:

- API 连接性
- 认证配置
- 数据完整性
- 响应时间
- 成功率

**输出**: 验证报告 + 统计数据 + 降级趋势

### 4. 配额管理

**功能**:

- 实时配额跟踪
- 预算告警
- 配额使用统计

### 5. 告警服务

**支持的通知渠道**:

- 飞书（Feishu）
- Email
- Webhook

**告警场景**: API 配额超额、数据源不健康、降级频繁

---

## 💻 技术栈

### 核心技术

```
语言：TypeScript 5.0+
运行时：Node.js 22+
架构：六边形架构（领域驱动设计）

数据存储：
├─ PostgreSQL (pg ^8.13.0)
└─ Redis (redis ^4.7.0)

验证：
└─ TypeBox (@sinclair/typebox 0.34.48)

测试：
├─ Vitest ^4.1.2
└─ Coverage V8

平台 API：
├─ Taobao：自己实现（无官方 SDK）
└─ Amazon：amazon-sp-api SDK（待集成）
```

### OpenClaw 集成

```json
{
  "id": "meichao-ecom",
  "extensions": ["./index.ts"],
  "commands": ["meichao"]
}
```

**集成方式**:

- 作为 OpenClaw 插件
- 提供 Agent 工具
- 提供 CLI 命令

---

## 📈 性能指标

### 代码统计

```
总计：9923 行 TypeScript

分层统计：
├─ Domain Layer:      1184 行 (11.9%)
├─ Infrastructure:    5455 行 (55.0%)
├─ Application:       1784 行 (18.0%)
├─ Tools:              571 行 (5.8%)
├─ Validation:         760 行 (7.7%)
├─ CLI/Commands:       454 行 (4.6%)
└─ Helpers:            717 行 (7.2%)

核心模块：
├─ 容错系统: 1553 行 (Infrastructure 内)
├─ 平台适配器: 811 行 (Infrastructure 内)
└─ 存储层: 877 行 (Infrastructure 内)
```

### 容错系统性能

```
错误分类：< 1ms
熔断器状态检查：< 1ms
冷却状态检查：< 1ms
降级决策：< 5ms
决策日志记录：< 1ms
```

### 缓存性能

```
Redis 键管理：
├─ keys() 命令: O(N) - 阻塞 Redis ❌
└─ RedisKeyManager: O(1) - 不阻塞 ✅

缓存命中率：> 80%
平均延迟：< 10ms
```

---

## ❌ "不做什么"清单 ⭐ 最重要

> **关键**: 记录"不做什么"比记录"做什么"更重要

### 容错系统（不要重复实现）

```
❌ 不要自己实现错误分类
   ✅ ErrorClassifier 已提供 Amazon/Taobao 映射
   ✅ 新平台只需在 PLATFORM_ERROR_MAPPINGS 添加配置

❌ 不要自己实现熔断器
   ✅ CircuitBreaker 已集成到 BasePlatformAdapter

❌ 不要自己实现降级逻辑
   ✅ DegradationExecutor 已集成到 BasePlatformAdapter
   ✅ 使用 fetchWithFailover 自动降级

❌ 不要自己实现冷却管理
   ✅ CooldownManager 已集成到 BasePlatformAdapter

❌ 不要自己实现决策日志
   ✅ DecisionLogger 已集成到 BasePlatformAdapter

❌ 不要自己实现重试逻辑
   ✅ retry-policy.ts 已提供 RetryRunner 工厂
   ✅ BasePlatformAdapter 已集成 RetryRunner
```

### SDK 能力（不要重复实现）

```
❌ 不要为 amazon-sp-api 自己实现 LWA 认证
   ✅ SDK 已提供自动令牌刷新

❌ 不要为 amazon-sp-api 自己实现 AWS 签名
   ✅ SDK 已提供 AWS4-HMAC-SHA256 签名

❌ 不要为 amazon-sp-api 自己实现速率限制
   ✅ SDK 已提供自动 throttling

❌ 不要为 amazon-sp-api 自己实现错误处理
   ✅ SDK 已提供错误分类
   ✅ ErrorClassifier 已集成 Amazon 映射
```

### 存储层（不要重复实现）

```
❌ 不要自己实现事务管理
   ✅ TransactionManager 已提供完整事务能力

❌ 不要自己实现健康检查
   ✅ PoolHealthCheck 已提供健康检查模式
```

### 缓存层（不要使用危险操作）

```
❌ 不要使用 keys() 命令
   ✅ 使用 RedisKeyManager.getAllKeys() (O(1))
   ✅ keys() 会阻塞 Redis (O(N))
```

---

## 📝 实现清单 ⭐ 实用工具

### Amazon Adapter 实现清单（当前任务）

```
✅ 1. AmazonAdapter 已存在 (Mock)
     位置: src/infrastructure/adapters/AmazonAdapter.ts
     状态: doFetchProduct 抛出错误

□ 2. 安装 amazon-sp-api SDK
     命令: npm install amazon-sp-api
     文档: https://www.npmjs.com/package/amazon-sp-api

□ 3. 创建 AmazonSPApiClient.ts (≈100 行)
     位置: src/infrastructure/api/amazon/AmazonSPApiClient.ts
     功能: 封装 SDK，配置 LWA 认证
     SDK 已提供: LWA 认证、AWS 签名、速率限制、错误处理

□ 4. 创建 AmazonProductApi.ts (≈100 行)
     位置: src/infrastructure/api/amazon/AmazonProductApi.ts
     功能: 封装 ProductPricing + CatalogItems，数据转换

□ 5. 实现 AmazonAdapter.doFetchProduct (≈50 行)
     调用: this.productApi.getProduct(platformId)
     返回: ProductData

预计工作量: 1 天 (≈250 行)
```

### 新平台 Adapter 实现清单

```
□ 1. 创建 Adapter 文件
     位置: src/infrastructure/adapters/<Platform>Adapter.ts
     继承: BasePlatformAdapter

□ 2. 定义数据源（1-4 个）
     类型: official_api, third_party_api, skill_crawler, open_search
     优先级: 1-4

□ 3. 创建 API 客户端
     有 SDK: 封装 SDK (≈100 行)
     无 SDK: 自己实现签名、认证 (≈500 行)

□ 4. 实现 doFetchProduct / doSearchProducts

□ 5. 注册到 PlatformRegistry

□ 6. 配置错误映射（可选）
     位置: src/infrastructure/classification/ErrorClassifier.ts
```

---

## 🎯 复用决策树

```
需要实现新平台 API
│
├─▶ 是否有官方 SDK？
│   ├─ 有 → 封装 SDK (≈100 行)
│   │      SDK 已提供：认证、签名、速率限制、错误处理
│   └─ 无 → 参考 Taobao API 实现 (≈500 行)
│          自己实现：签名、认证、错误处理
│
├─▶ 继承 BasePlatformAdapter
│   ├─ ✅ 已集成：容错系统、降级逻辑、健康检查
│   └─ ⚠️ 需实现：getPlatform, doFetchProduct, doSearchProducts
│
├─▶ 定义数据源
│   ├─ official_api (优先级 1)
│   ├─ third_party_api (优先级 2)
│   ├─ skill_crawler (优先级 3)
│   └─ open_search (优先级 4)
│
└─▶ 注册到 PlatformRegistry

工作量预估：
├─ Amazon (有 SDK): ≈250 行，1 天
└─ Taobao (无 SDK): ≈800 行，2-3 天
```

---

## 🔌 实现指南 ⭐ TaobaoAdapter 参考模式

### BasePlatformAdapter 已集成的容错能力

```
BasePlatformAdapter (253 行)
├─ ErrorClassifier - 错误分类（Amazon/Taobao 映射已配置）
├─ CircuitBreaker - 熔断器（closed → open → half-open）
├─ DegradationExecutor - 降级执行器（自动尝试备用数据源）
├─ CooldownManager - 冷却管理（防止频繁降级）
├─ DecisionLogger - 决策日志（记录所有降级决策）
└─ RetryRunner - 重试策略（指数退避 + ErrorClassifier）

✅ 继承 BasePlatformAdapter 即可获得所有容错能力
❌ 不要重复实现这些能力！
```

### TaobaoAdapter 实现模式（完整参考）

**位置**: `src/infrastructure/adapters/TaobaoAdapter.ts` (288 行)

```typescript
export class TaobaoAdapter extends BasePlatformAdapter {
  private apiClient: TaobaoApiClient;
  private productApi: TaobaoProductApi;

  static create(): TaobaoAdapter {
    // 1. 定义数据源（4 个）
    const dataSources = [
      DataSource.create({
        id: "taobao_official_api",
        platform: "taobao",
        type: "official_api",
        priority: 1,
        costPerCall: 0,
        dailyQuota: 100,
        usedQuota: 0,
        isAvailable: true,
      }),
      DataSource.create({ id: "taobao_third_party", ..., priority: 2 }),
      DataSource.create({ id: "taobao_crawler", ..., priority: 3 }),
      DataSource.create({ id: "taobao_open_search", ..., priority: 4 }),
    ];

    // 2. 初始化 API 客户端
    this.apiClient = TaobaoApiClient.fromEnv();
    this.productApi = new TaobaoProductApi(this.apiClient);

    return new TaobaoAdapter({
      platform: "taobao",
      dataSources,
      defaultTimeoutMs: 10000,
      retryCount: 3,
      retryDelayMs: 1000,
    });
  }

  getPlatform(): "taobao" { return "taobao"; }

  // 3. 使用 fetchWithFailover（自动降级）
  async fetchProduct(platformId: string, options?: FetchOptions) {
    const result = await this.fetchWithFailover(
      async (source) => this.doFetchProduct(platformId, source.id, options),
      { preferredSource: options?.preferredSource, maxSources: 2 }
    );

    return {
      success: true,
      data: result.data,
      source: result.source,
      latencyMs: result.totalLatencyMs,
      degradationLevel: result.degradationLevel,
      attempts: result.attempts,
    };
  }

  // 4. 核心业务逻辑
  private async doFetchProduct(platformId: string, sourceId: string) {
    return await this.productApi.getProduct(platformId);
  }
}
```

---

## 🔄 可配置降级策略

### 4 种预置策略

```typescript
"standard":           [official_api, third_party_api, skill_crawler, open_search]
"cost-optimized":     [official_api, skill_crawler, open_search]
"speed-optimized":    [third_party_api, official_api, open_search]
"reliability-first":  [official_api, third_party_api]
```

### 自定义降级选项

```typescript
interface DegradationOptions {
  preset?: "standard" | "cost-optimized" | "speed-optimized" | "reliability-first";
  customOrder?: DataSourceType[];
  preferredSource?: string;
  skipTypes?: DataSourceType[];
  skipSources?: string[];
  maxSources?: number;
  allowCrawler?: boolean;
  allowOpenSearch?: boolean;
  onSourceFailure?: (sourceId, error) => void;
}
```

### 环境变量配置

- CircuitBreaker: `DEGRADATION_CIRCUIT_BREAKER_*`
- Cooldown: `DEGRADATION_COOLDOWN_*`
- HealthProbe: `DEGRADATION_HEALTH_PROBE_*`

详见: `src/infrastructure/config/degradation.config.ts`

---

## 📊 能力地图

### 已实现基础设施 (5455 行)

```
容错系统 (1553 行) ⭐ 已集成到 BasePlatformAdapter
├─ ErrorClassifier.ts (166 行) - 错误分类，Amazon/Taobao 映射已配置
├─ CircuitBreaker.ts (104 行) - 熔断器，closed → open → half-open
├─ DegradationExecutor.ts (171 行) - 降级执行，自动尝试备用数据源
├─ CooldownManager.ts (192 行) - 冷却管理，防止频繁降级
├─ DegradationPath.ts (128 行) - 降级路径，预置策略 + 自定义
├─ SessionStickiness.ts (101 行) - 会话粘性，保证用户体验一致
├─ DecisionLogger.ts (229 行) - 决策日志，追踪降级过程
├─ HealthProbeScheduler.ts (184 行) - 健康探测
└─ types.ts (121 行) - 类型定义

平台基础设施 (811 行) ⭐ 可扩展
├─ BasePlatformAdapter.ts (253 行) - Adapter 基类，已集成容错
├─ TaobaoAdapter.ts (288 行) - 淘宝实现（完整参考）
├─ AmazonAdapter.ts (159 行) - Amazon Mock → 需填充
└─ MockPlatformGateway.ts (111 行) - Mock Gateway

存储层 (877 行)
├─ TransactionManager.ts (218 行) - 事务管理，错误分类，重试逻辑
├─ PoolHealthCheck.ts (212 行) - 健康检查，自动重连，告警阈值
└─ ProductRepository.ts (877 行) - 产品存储

缓存层 (443 行)
├─ CacheProvider.ts (302 行) - 缓存抽象，性能监控，批量操作
└─ RedisKeyManager.ts (141 行) - O(1) 键管理，替代 keys()

搜索系统 (221 行)
├─ ProductSearchClient.ts (86 行) - 搜索客户端，Provider 注册
├─ ProductSearchRegistry.ts (89 行) - Provider 注册
├─ BingShoppingProvider.ts (133 行) - Bing Shopping API
└─ TavilyProductProvider.ts (83 行) - Tavily API

平台注册 (91 行)
└─ PlatformRegistry.ts (91 行) - 平台 Adapter 注册，发现，健康状态

重试策略 (81 行)
└─ retry-policy.ts (81 行) - RetryRunner 工厂，Taobao/Amazon 配置

Taobao API (558 行) ⭐ 完整实现参考
├─ TaobaoApiClient.ts (203 行) - 核心客户端，签名算法
├─ TaobaoProductApi.ts (135 行) - 产品 API 封装
├─ TaobaoOAuth.ts (70 行) - OAuth 认证
├─ TaobaoRequestBuilder.ts (68 行) - 请求构建
└─ index.ts (13 行) - 导出

Amazon API (260 行) ⭐ SP-API SDK 封装
├─ AmazonSPApiClient.ts (110 行) - SDK 封装，配置验证，健康检查
├─ AmazonProductApi.ts (150 行) - Product Pricing API, Catalog Items API, 数据转换
└─ 注: amazon-sp-api SDK 提供 80% 能力（认证、签名、速率限制）
```

---

## 📚 参考文档

### 源码位置

- **Taobao API 完整实现**: `src/infrastructure/api/taobao/` (558 行)
- **Amazon API 实现**: `src/infrastructure/api/amazon/` (260 行)
  - `AmazonSPApiClient.ts` - SDK 封装
  - `AmazonProductApi.ts` - 产品 API
- **BasePlatformAdapter 基类**: `src/infrastructure/adapters/BasePlatformAdapter.ts` (253 行)
- **容错系统**: `src/infrastructure/degradation/` (1553 行)
- **事务管理**: `src/infrastructure/storage/TransactionManager.ts` (218 行)
- **Redis 优化**: `src/infrastructure/cache/RedisKeyManager.ts` (142 行)
- **降级配置**: `src/infrastructure/config/degradation.config.ts`
- **错误分类**: `src/infrastructure/classification/ErrorClassifier.ts`

### 外部文档

- **amazon-sp-api SDK**: https://www.npmjs.com/package/amazon-sp-api
- **Amazon SP-API 官方文档**: https://developer-docs.amazon.com/sp-api/
- **技术架构文档**: `/projects/openclaw/docs/集成/美潮电商系统技术架构文档.md`

---

## 🔄 维护指南

### 何时更新此文档

1. **添加新基础设施时** - 记录位置、能力、使用场景
2. **发现新反模式时** - 添加到"不做什么"清单
3. **发现新复用场景时** - 更新复用决策树
4. **修改基础设施时** - 更新能力和使用示例

### 文档原则

- ✅ **聚焦决策支持** - "不做什么"清单最重要
- ✅ **提供执行指导** - 实现清单、实现模式
- ✅ **避免详细接口** - 源码更适合作为参考
- ✅ **突出工作量预估** - 帮助决策
- ✅ **展示架构全景** - 帮助理解系统
