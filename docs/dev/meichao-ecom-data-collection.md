---
summary: "美潮电商数据采集模块 - 多平台商品数据抓取、价格监控、趋势分析"
title: "Meichao E-Commerce Data Collection"
---

# Meichao E-Commerce Data Collection

美潮电商数据采集模块是一个可扩展的电商数据采集与分析系统，支持多平台商品数据抓取、价格监控、销售趋势分析等功能。采用六边形架构设计，领域核心无外部依赖，便于测试和扩展。

## Features

| 功能 | 说明 |
|------|------|
| 多平台采集 | 支持淘宝、Amazon 等主流电商平台 |
| 数据管道 | 可配置的 ETL 数据处理管道 |
| 智能缓存 | Redis 缓存层，支持 TTL 和缓存降级 |
| 配额管理 | API 调用配额跟踪与告警 |
| 数据去重 | 自动去重，避免重复数据 |
| 数据验证 | 商品数据字段校验 |

## Supported Platforms

| Platform | Status | Data Source | Priority |
|----------|--------|-------------|----------|
| Taobao (淘宝) | Production | Official API, Third-party API, Crawler | 1 |
| Amazon | Production | SP-API, Product API | 2 |
| Douyin (抖音) | Planned | - | - |
| 1688 | Planned | - | - |
| Shopee | Planned | - | - |
| JD (京东) | Planned | - | - |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Interface Layer (M7)                     │
│                    Plugin Entry Point                        │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer (M5-M6)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ DataPipeline │  │   UseCases   │  │   Services   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                  Infrastructure Layer (M2-M4)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Adapters    │  │  PostgreSQL  │  │    Redis     │       │
│  │ (Taobao/Amz) │  │  Repository  │  │    Cache     │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      Domain Layer (M1)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Entities   │  │ Value Objects│  │    Ports     │       │
│  │   (Product)  │  │ (DataSource) │  │ (Interfaces) │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## Quick Setup

<Steps>
  <Step title="Start Infrastructure">
    
    启动 PostgreSQL 和 Redis 容器：

```bash
cd extensions/meichao-ecom
docker-compose up -d
```

  </Step>

  <Step title="Configure Environment">

    复制环境变量配置：

```bash
cp .env.example .env
# 编辑 .env 设置数据库连接信息
```

  </Step>

  <Step title="Run Tests">

```bash
pnpm test
```

  </Step>
</Steps>

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_HOST` | `localhost` | PostgreSQL 主机 |
| `POSTGRES_PORT` | `5432` | PostgreSQL 端口 |
| `POSTGRES_DB` | `meichao` | 数据库名称 |
| `POSTGRES_USER` | `meichao` | 数据库用户 |
| `POSTGRES_PASSWORD` | `meichao_secret` | 数据库密码 |
| `REDIS_HOST` | `localhost` | Redis 主机 |
| `REDIS_PORT` | `6379` | Redis 端口 |
| `REDIS_PASSWORD` | - | Redis 密码 (可选) |

### Plugin Configuration

```json5
{
  plugins: {
    entries: {
      "meichao-ecom": {
        enabled: true,
        config: {
          platforms: ["taobao", "amazon"],
          concurrency: 10,
          cacheTtlMs: 1800000,
          alertChannels: [
            {
              type: "webhook",
              config: { url: "https://your-webhook-url" }
            }
          ]
        }
      }
    }
  }
}
```

## Data Pipeline

数据管道采用过滤器链模式，依次执行以下阶段：

```
Fetch → Validate → Dedupe → Store → Cache
```

### Pipeline Filters

| Filter | Purpose | Input | Output |
|--------|---------|-------|--------|
| **FetchFilter** | 从平台获取商品数据 | platformIds | ProductData[] |
| **ValidateFilter** | 验证数据字段完整性 | ProductData[] | ProductData[] (valid) |
| **DedupeFilter** | 去除重复商品 | ProductData[] | ProductData[] (unique) |
| **StoreFilter** | 持久化到数据库 | ProductData[] | ProductData[] (stored) |
| **CacheFilter** | 缓存到 Redis | ProductData[] | ProductData[] (cached) |

### Pipeline Options

```typescript
interface PipelineOptions {
  useCache?: boolean;       // 是否使用缓存 (default: true)
  skipValidation?: boolean; // 跳过验证阶段
  skipDedupe?: boolean;     // 跳过去重阶段
  skipStore?: boolean;      // 跳过存储阶段
  forceRefresh?: boolean;   // 强制刷新缓存
}
```

### Pipeline Result

```typescript
interface PipelineResult {
  success: boolean;
  products: ProductData[];
  errors: PipelineError[];
  stats: {
    totalRequested: number;
    fetched: number;
    validated: number;
    deduplicated: number;
    cached: number;
    stored: number;
    failed: number;
    durationMs: number;
  };
}
```

## Platform Adapters

每个平台适配器支持多个数据源，按优先级排序：

### Taobao Adapter

```typescript
const adapter = TaobaoAdapter.create();

// 数据源配置
const dataSources = [
  { id: "taobao_official_api", type: "official_api", priority: 1 },
  { id: "taobao_third_party", type: "third_party_api", priority: 2 },
  { id: "taobao_crawler", type: "skill_crawler", priority: 3 },
];
```

### Amazon Adapter

```typescript
const adapter = AmazonAdapter.create();

// 数据源配置
const dataSources = [
  { id: "amazon_sp_api", type: "official_api", priority: 1 },
  { id: "amazon_product_api", type: "third_party_api", priority: 2 },
];
```

### Adapter Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `fetchProduct(platformId)` | 获取单个商品 | `FetchResult<ProductData>` |
| `fetchProducts(platformIds)` | 批量获取商品 | `FetchResult<ProductData>[]` |
| `searchProducts(keyword, options)` | 搜索商品 | `FetchResult<SearchResult>` |
| `healthCheck()` | 健康检查 | `AdapterHealth` |
| `getAvailableDataSources()` | 获取可用数据源 | `string[]` |

## Data Source Priority

数据源按以下优先级选择：

```
1. Official API (免费额度有限，优先使用)
2. Third-party API (付费，次选)
3. Skill Crawler (成本高，最后选择)
```

选择逻辑：
1. 过滤可用且有剩余配额的数据源
2. 按 priority 升序排序
3. 选择第一个满足条件的源

## Quota Management

配额管理服务跟踪各数据源的 API 调用配额：

### Quota Status

```typescript
interface QuotaStatus {
  sourceId: string;
  platform: Platform;
  used: number;          // 已使用配额
  total: number;         // 总配额
  remaining: number;     // 剩余配额
  percentUsed: number;   // 使用百分比
  isOverBudget: boolean; // 是否超限
}
```

### Quota Alerts

| Threshold | Severity | Action |
|-----------|----------|--------|
| 80% | warning | 发送警告通知 |
| 95% | critical | 发送紧急通知，切换数据源 |

## Alert Service

告警服务支持多种通知渠道：

### Supported Channels

| Channel | Type | Config |
|---------|------|--------|
| Feishu (飞书) | `feishu` | `{ webhook: string }` |
| Email | `email` | `{ to: string[] }` |
| Webhook | `webhook` | `{ url: string }` |

### Alert Types

| Type | Description |
|------|-------------|
| `quota_warning` | 配额使用超过 80% |
| `quota_critical` | 配额使用超过 95% |
| `fetch_error` | 数据获取失败 |
| `health_check` | 健康检查失败 |

## API Reference

### Initialize Platform

```typescript
import { initializePlatform, getPipeline, getFetchProductUseCase } from "@openclaw/meichao-ecom";

await initializePlatform({
  postgres: { host: "localhost", port: 5432 },
  redis: { host: "localhost", port: 6379 },
  alertChannels: [{ type: "webhook", config: { url: "..." } }],
});
```

### Execute Pipeline

```typescript
const pipeline = getPipeline();

const result = await pipeline.execute("taobao", ["12345", "67890"], {
  useCache: true,
});

console.log(result.stats);
// {
//   totalRequested: 2,
//   fetched: 2,
//   validated: 2,
//   stored: 2,
//   cached: 2,
//   failed: 0,
//   durationMs: 150
// }
```

### Fetch Products

```typescript
const useCase = getFetchProductUseCase("taobao");

// 获取单个商品
const result = await useCase.execute("taobao", "12345", true);

console.log(result.product, result.cached, result.source);
```

### Search Products

```typescript
const useCase = getSearchProductsUseCase("taobao");

const result = await useCase.execute("taobao", "龙虾", {
  pageSize: 20,
  page: 1,
  sortBy: "sales",
  sortOrder: "desc",
});

console.log(result.products, result.total);
```

## Data Model

### Product Entity

```typescript
interface ProductData {
  platform: Platform;           // 平台标识
  platformId: string;           // 平台商品ID
  title: string;                // 商品标题
  mainImage?: string;           // 主图URL
  images?: string[];            // 图片列表
  sourceUrl: string;            // 商品链接
  price: number;                // 当前价格
  originalPrice?: number;       // 原价
  currency: string;             // 货币
  sales: number;                // 销量
  salesUnit?: string;           // 销量单位
  salesPeriod: SalesPeriod;     // 销量周期
  rating?: number;              // 评分 (0-5)
  reviewsCount?: number;        // 评价数
  shopId?: string;              // 店铺ID
  shopName?: string;            // 店铺名称
  shopUrl?: string;             // 店铺链接
  categoryId?: string;          // 类目ID
  categoryName?: string;        // 类目名称
  categoryPath?: string[];      // 类目路径
  status: ProductStatus;        // 商品状态
  priority: ProductPriority;    // 优先级
  isTrending: boolean;          // 是否爆款
  merchantId?: string;          // 商家ID
  tags?: string[];              // 标签
  extraData?: Record<string, unknown>; // 扩展数据
}
```

### Enums

```typescript
type Platform = "taobao" | "amazon" | "douyin" | "1688" | "shopee" | "pinduoduo" | "jd" | "aliexpress";

type ProductStatus = "active" | "inactive" | "deleted" | "sold_out";

type ProductPriority = "P0" | "P1" | "P2";  // P0 = 爆款

type SalesPeriod = "day" | "week" | "month";

type DataSourceType = "official_api" | "third_party_api" | "skill_crawler";
```

## Database Schema

### products 表

```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(20) NOT NULL,
  platform_id VARCHAR(100) NOT NULL,
  title VARCHAR(500) NOT NULL,
  main_image TEXT,
  images JSONB,
  source_url TEXT NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  original_price DECIMAL(12,2),
  currency VARCHAR(3) NOT NULL,
  sales INTEGER DEFAULT 0,
  sales_unit VARCHAR(20),
  sales_period VARCHAR(10),
  rating DECIMAL(2,1),
  reviews_count INTEGER,
  shop_id VARCHAR(100),
  shop_name VARCHAR(200),
  shop_url TEXT,
  category_id VARCHAR(100),
  category_name VARCHAR(200),
  category_path JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  priority VARCHAR(5) NOT NULL DEFAULT 'P1',
  is_trending BOOLEAN DEFAULT FALSE,
  merchant_id VARCHAR(100),
  tags JSONB,
  extra_data JSONB,
  first_seen_at TIMESTAMP DEFAULT NOW(),
  last_seen_at TIMESTAMP DEFAULT NOW(),
  price_updated_at TIMESTAMP,
  sales_updated_at TIMESTAMP,
  UNIQUE(platform, platform_id)
);

CREATE INDEX idx_products_platform ON products(platform);
CREATE INDEX idx_products_merchant ON products(merchant_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_trending ON products(is_trending);
```

## Troubleshooting

<AccordionGroup>
  <Accordion title="数据库连接失败">

检查 PostgreSQL 是否运行：

```bash
docker ps | grep postgres
```

检查连接配置：

```bash
echo $POSTGRES_HOST $POSTGRES_PORT
psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB
```

  </Accordion>

  <Accordion title="Redis 连接失败">

检查 Redis 是否运行：

```bash
docker ps | grep redis
redis-cli -h $REDIS_HOST -p $REDIS_PORT ping
```

  </Accordion>

  <Accordion title="数据获取失败">

1. 检查数据源配置和配额
2. 启用 debug 日志查看详细信息：

```bash
export OPENCLAW_LOG_LEVEL=debug
openclaw logs --follow
```

3. 检查平台适配器健康状态：

```typescript
const health = await adapter.healthCheck();
console.log(health);
```

  </Accordion>

  <Accordion title="缓存不生效">

检查缓存配置和 TTL：

```typescript
const stats = await cacheProvider.getStats();
console.log(stats);
// { entries: 100, hitRate: 0.85, hits: 850, misses: 150 }
```

  </Accordion>
</AccordionGroup>

## Performance

### Benchmark Results

| Scenario | Data Size | Duration | Throughput |
|----------|-----------|----------|------------|
| ValidateFilter | 1000 products | ~1ms | ~1M ops/s |
| DedupeFilter | 1000 products | ~0.5ms | ~2M ops/s |
| FetchFilter (mock) | 100 products | ~9ms | ~11K ops/s |
| Full Pipeline | 100 products | ~20ms | ~5K ops/s |

### Concurrency Scaling

```
concurrency=1:   8,898 ops/s
concurrency=5:  11,158 ops/s
concurrency=10: 11,653 ops/s  (最佳)
concurrency=20: 11,420 ops/s
concurrency=50: 11,618 ops/s  (收益递减)
```

**建议**: 默认并发数设置为 10-20

## Extending

### Adding a New Platform

1. 创建适配器文件：

```typescript
// src/infrastructure/adapters/NewPlatformAdapter.ts
import { BasePlatformAdapter } from "./BasePlatformAdapter.js";

export class NewPlatformAdapter extends BasePlatformAdapter {
  static create(): NewPlatformAdapter {
    return new NewPlatformAdapter({
      platform: "newplatform",
      dataSources: [...],
      defaultTimeoutMs: 10000,
      retryCount: 3,
      retryDelayMs: 1000,
    });
  }

  getPlatform(): "newplatform" {
    return "newplatform";
  }

  async fetchProduct(platformId: string, options?: FetchOptions): Promise<FetchResult<ProductData>> {
    // 实现获取逻辑
  }
}
```

2. 注册到 PlatformRegistry：

```typescript
import { PlatformRegistry } from "../registry/PlatformRegistry.js";
import { NewPlatformAdapter } from "../adapters/NewPlatformAdapter.js";

PlatformRegistry.register(NewPlatformAdapter.create());
```

### Adding a Custom Filter

```typescript
// src/application/pipeline/filters/CustomFilter.ts
import type { PipelineFilter, PipelineContext, PipelineFilterInput, PipelineFilterOutput } from "../types.js";

export class CustomFilter implements PipelineFilter {
  readonly name = "custom";

  async execute(context: PipelineContext, input: PipelineFilterInput): Promise<PipelineFilterOutput> {
    const products = input.products.filter(p => /* 自定义逻辑 */);
    return { products, errors: [], stats: {} };
  }
}

// 添加到管道
pipeline.addFilter(new CustomFilter());
```

## Related Docs

- [Plugin System](/dev/plugin-system)
- [Configuration](/configuration)
- [Testing](/testing)
- [Debugging Guide](/dev/debugging)