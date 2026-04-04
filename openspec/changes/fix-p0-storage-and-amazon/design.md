# Fix P0 Storage and Amazon API - Design Document

## Context

### Current Architecture

```
存储层架构：
┌──────────────────────────────────────┐
│   ProductRepository (Interface)       │
└──────────────────────────────────────┘
                ↓
┌──────────────────────────────────────┐
│ TransactionalProductRepository       │
│  - ❌ 未使用事务 client              │
│  - ❌ 无回滚机制                     │
└──────────────────────────────────────┘
                ↓
┌──────────────────────────────────────┐
│          PostgreSQL Pool             │
└──────────────────────────────────────┘

缓存层架构：
┌──────────────────────────────────────┐
│        CacheProvider                 │
│  - ⚠️ 使用 keys() (O(N))            │
│  - ⚠️ 无批量操作                     │
└──────────────────────────────────────┘
                ↓
┌──────────────────────────────────────┐
│           Redis Client               │
└──────────────────────────────────────┘

平台适配器架构：
┌──────────────────────────────────────┐
│      AmazonAdapter (Mock)            │
│  - ⚠️ 返回假数据                     │
│  - ⚠️ 无真实 API 调用                │
└──────────────────────────────────────┘
```

### Problem Analysis

**问题1: TransactionalProductRepository 未使用事务**

```typescript
// 当前实现 (错误)
async createMany(items: ProductCreateInput[]): Promise<Product[]> {
  const results: Product[] = [];
  for (const item of items) {
    const result = await this.create(item);  // 每个操作独立事务
    results.push(result);
  }
  return results;
}

// 问题：
// 1. 未使用事务 client
// 2. 部分失败无法回滚
// 3. 数据一致性风险
```

**问题2: Redis keys() 性能问题**

```typescript
// 当前实现 (低效)
async clear(): Promise<void> {
  const client = getClient();
  const keys = await client.keys("*");  // O(N) 操作
  if (keys.length > 0) {
    await client.del(keys);
  }
}

// 问题：
// 1. keys() 阻塞 Redis
// 2. 大量键时性能急剧下降
// 3. 影响其他 Redis 操作
```

**问题3: AmazonAdapter Mock 实现**

```typescript
// 当前实现 (Mock)
async fetchProducts(ids: string[]): Promise<ProductData[]> {
  return ids.map(id => this.createMockProduct(id));  // 假数据
}

// 问题：
// 1. 无法采集真实数据
// 2. 客户需求无法满足
// 3. 生产不可用
```

### Constraints

**技术约束**:

- 必须向后兼容，不破坏现有 API
- PostgreSQL 连接池配置不可改
- Redis 版本 7.x
- Node.js 22+

**业务约束**:

- 2-3 周完成
- 最小化风险
- 渐进式部署

**合规约束**:

- Amazon SP-API 使用条款
- 数据采集合规性
- API 速率限制

## Goals / Non-Goals

### Goals

1. **修复存储层事务 Bug**
   - 正确使用事务 client
   - 实现事务回滚
   - 确保数据一致性

2. **优化 Redis 性能**
   - 移除 keys() 使用
   - 支持批量操作
   - 提升缓存性能

3. **实现 Amazon 真实 API**
   - SP-API 认证集成
   - 产品定价 API
   - 目录 API
   - 数据转换层

4. **提升测试质量**
   - 测试通过率 80%+
   - 核心功能测试覆盖
   - 集成测试

### Non-Goals

1. **其他平台适配器** - 仅 Amazon，其他平台按需
2. **第三方数据源** - 后续单独实现
3. **完整重构** - 仅修复关键问题，不做大规模重构
4. **UI/UX 改进** - 本次聚焦后端

## Decisions

### Decision 1: 事务处理策略

**选择**: 使用 PostgreSQL 事务 + 显式回滚

**备选方案**:

- ❌ 保持现状 (不修复)
  - 问题: 数据一致性风险
- ❌ 使用 ORM 事务
  - 问题: 引入额外依赖
- ✅ 使用原生事务 client
  - 优点: 无额外依赖，性能好

**实现方案**:

```typescript
// TransactionManager.ts
export class TransactionManager {
  async runInTransaction<T>(
    fn: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

// ProductRepository.ts
async createMany(items: ProductCreateInput[]): Promise<Product[]> {
  return this.transactionManager.runInTransaction(async (client) => {
    const results: Product[] = [];
    for (const item of items) {
      const result = await this.createWithClient(client, item);
      results.push(result);
    }
    return results;
  });
}
```

**风险缓解**:

- 完善单元测试
- 集成测试验证
- 灰度发布

### Decision 2: Redis 优化策略

**选择**: 维护键集合 + SCAN 替代 keys()

**备选方案**:

- ❌ 继续使用 keys()
  - 问题: 性能瓶颈
- ❌ 使用 Redis Sets
  - 问题: 额外内存开销
- ✅ 维护键集合 + SCAN
  - 优点: 平衡性能和内存

**实现方案**:

```typescript
// RedisKeyManager.ts
export class RedisKeyManager {
  private readonly keySetKey = 'meichao:cache:keys';

  async addKey(key: string): Promise<void> {
    const client = getClient();
    await client.sAdd(this.keySetKey, key);
  }

  async removeKey(key: string): Promise<void> {
    const client = getClient();
    await client.sDel(this.keySetKey, key);
  }

  async getAllKeys(): Promise<string[]> {
    const client = getClient();
    return client.sMembers(this.keySetKey);
  }

  async clearAll(): Promise<void> {
    const client = getClient();
    const keys = await this.getAllKeys();
    if (keys.length > 0) {
      await client.del(keys);
      await client.del(this.keySetKey);
    }
  }
}

// 使用 SCAN 的备选方案
async clearWithScan(): Promise<void> {
  const client = getClient();
  const iterator = client.scanIterator({
    match: 'meichao:*',
    count: 100
  });

  for await (const key of iterator) {
    await client.del(key);
  }
}
```

**性能对比**:

```
keys() 操作:     O(N) - 阻塞 Redis
SCAN 操作:       O(1) per iteration - 不阻塞
键集合维护:      O(1) per operation - 内存换性能
```

### Decision 3: Amazon SP-API 集成策略

**选择**: 使用 amazon-sp-api 官方 SDK

**备选方案**:

- ❌ 自己实现认证和签名
  - 问题: 复杂，易出错
- ✅ 使用 amazon-sp-api SDK
  - 优点: 官方支持，稳定
- ❌ 使用第三方服务
  - 问题: 成本高，依赖外部

**实现方案**:

```typescript
// AmazonSPApiClient.ts
import SellingPartnerAPI from "amazon-sp-api";

export class AmazonSPApiClient {
  private client: SellingPartnerAPI;

  constructor(config: AmazonConfig) {
    this.client = new SellingPartnerAPI({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      refreshToken: config.refreshToken,
      region: config.region,
    });
  }

  async getProductPricing(asins: string[]): Promise<ProductPricing[]> {
    const response = await this.client.callAPI({
      operation: "getPricing",
      endpoint: "productPricing",
      query: {
        Marketplaces: [this.config.marketplaceId],
        Asins: asins,
        ItemType: "Asin",
      },
    });

    return this.transformPricing(response);
  }

  async getCatalogItem(asin: string): Promise<CatalogItem> {
    const response = await this.client.callAPI({
      operation: "getCatalogItem",
      endpoint: "catalogItems",
      path: {
        asin,
      },
      query: {
        MarketplaceIds: [this.config.marketplaceId],
      },
    });

    return this.transformCatalogItem(response);
  }
}

// AmazonAdapter.ts
export class AmazonAdapter extends BasePlatformAdapter {
  private apiClient: AmazonSPApiClient;

  async fetchProducts(ids: string[]): Promise<ProductData[]> {
    const pricing = await this.apiClient.getProductPricing(ids);
    const catalog = await Promise.all(ids.map((id) => this.apiClient.getCatalogItem(id)));

    return this.mergeData(pricing, catalog);
  }
}
```

**配置管理**:

```json
{
  "amazon": {
    "clientId": "${AMAZON_CLIENT_ID}",
    "clientSecret": "${AMAZON_CLIENT_SECRET}",
    "refreshToken": "${AMAZON_REFRESH_TOKEN}",
    "region": "NA",
    "marketplaceId": "ATVPDKIKX0DER"
  }
}
```

### Decision 4: 测试修复策略

**选择**: 修复 Mock 配置 + 新增集成测试

**当前问题**:

```typescript
// postgres.test.ts - Mock 未正确设置
vi.mock("pg", () => {
  const mockPool = vi.fn();
  return { default: { Pool: mockPool } };
});

// 问题: mockPool 返回 undefined
```

**修复方案**:

```typescript
vi.mock("pg", () => {
  const mockQuery = vi.fn();
  const mockEnd = vi.fn();

  const mockPool = vi.fn(() => ({
    query: mockQuery,
    end: mockEnd,
    connect: vi.fn(),
  }));

  return {
    default: {
      Pool: mockPool,
    },
    Pool: mockPool,
  };
});

describe("postgres", () => {
  let postgres: typeof import("./storage/postgres.js");
  let mockPoolInstance: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    postgres = await import("./storage/postgres.js");
    const pg = await import("pg");
    mockPoolInstance = new pg.default.Pool();
  });

  afterEach(async () => {
    if (postgres?.closePool) {
      await postgres.closePool();
    }
  });

  // tests...
});
```

## Risks / Trade-offs

### Risk 1: Amazon API 变更

**风险**: Amazon 可能更新 API，导致集成失效
**概率**: 中
**影响**: 高
**缓解措施**:

- 使用官方 SDK
- 订阅 Amazon 开发者通知
- 版本锁定
- 监控告警

### Risk 2: 事务修复引入新 Bug

**风险**: 事务逻辑复杂，可能引入新问题
**概率**: 低
**影响**: 高
**缓解措施**:

- 完善测试覆盖
- 代码审查
- 灰度发布
- 回滚方案

### Risk 3: Redis 键集合内存占用

**风险**: 维护键集合占用额外内存
**概率**: 高
**影响**: 低
**缓解措施**:

- 定期清理过期键
- 监控内存使用
- 备选方案: SCAN

### Trade-off 1: 性能 vs 内存

**选择**: 使用键集合 (内存换性能)
**放弃**: 纯 SCAN 方案 (性能换内存)
**理由**:

- 生产环境性能优先
- 内存成本低于性能损失
- Redis 内存充足

### Trade-off 2: 完整性 vs 时间

**选择**: 快速修复核心问题
**放弃**: 完整的架构重构
**理由**:

- 时间紧迫 (2-3 周)
- 核心问题优先
- 后续持续改进

## Migration Plan

### Phase 1: 存储层修复 (Day 1-2)

```
1. 创建 TransactionManager
   ├─ 实现事务管理
   ├─ 添加单元测试
   └─ 验证功能

2. 修复 ProductRepository
   ├─ 使用 TransactionManager
   ├─ 更新所有事务操作
   └─ 测试验证

3. 优化 CacheProvider
   ├─ 创建 RedisKeyManager
   ├─ 更新缓存操作
   └─ 性能测试

4. 部署验证
   ├─ 本地测试
   ├─ 测试环境验证
   └─ 灰度发布
```

### Phase 2: Amazon API 实现 (Day 3-4)

```
1. SDK 集成
   ├─ 安装依赖
   ├─ 配置认证
   └─ 测试连接

2. API 封装
   ├─ AmazonSPApiClient
   ├─ 产品定价 API
   └─ 目录 API

3. Adapter 更新
   ├─ AmazonAdapter 真实实现
   ├─ 数据转换
   └─ 错误处理

4. 集成测试
   ├─ API 调用测试
   ├─ 数据验证
   └─ 性能测试
```

### Phase 3: 测试修复 (Day 5)

```
1. Mock 修复
   ├─ postgres.test.ts
   ├─ redis.test.ts
   ├─ ProductRepository.test.ts
   └─ CacheProvider.test.ts

2. 新增测试
   ├─ TransactionManager.test.ts
   ├─ RedisKeyManager.test.ts
   └─ AmazonAdapter.test.ts

3. 验证
   ├─ 运行全部测试
   ├─ 检查覆盖率
   └─ 确认 80%+ 通过率
```

### Rollback Plan

```
每个阶段都有回滚方案：

Phase 1 回滚:
├─ Git revert 存储层改动
├─ 恢复原有 ProductRepository
└─ 无需数据迁移

Phase 2 回滚:
├─ Git revert Amazon API 改动
├─ 恢复 Mock 实现
└─ 移除配置

Phase 3 回滚:
├─ Git revert 测试改动
└─ 无影响
```

## Open Questions

### Q1: Amazon API 凭证如何获取？

**选项**:

- A. 用户提供 (推荐)
- B. 系统内置 (不合规)
- C. 环境变量 (推荐)

**倾向**: A + C，支持用户配置 + 环境变量覆盖

### Q2: Redis 键集合如何处理过期？

**选项**:

- A. 定期清理 (Cron)
- B. TTL 自动过期
- C. 惰性清理

**倾向**: B，使用 Redis TTL 自动过期

### Q3: 测试环境如何模拟 Amazon API？

**选项**:

- A. Mock API 响应
- B. 使用测试账号
- C. 录制/回放

**倾向**: A，Mock API 响应用于单元测试

### Q4: 事务超时如何处理？

**选项**:

- A. 固定超时
- B. 动态超时
- C. 无超时

**倾向**: A，固定 30 秒超时
