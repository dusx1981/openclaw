# meichao-ecom 改进技术设计

## Context

当前 meichao-ecom 插件规模：

- 123 个 TypeScript 源文件
- 51 个测试文件
- 约 15,000 行代码
- 支持 8 个电商平台（但只有 2 个有真实实现）

技术栈：

- Node.js 22+
- TypeScript (ESM)
- PostgreSQL（持久化）
- Redis（缓存）
- 六边形架构 + Pipeline 模式

## Goals / Non-Goals

**Goals:**

1. 修复关键 bug（事务处理、缓存性能）
2. 统一配置管理，消除分散的配置读取
3. 实现缺失的数据源，完善降级链路
4. 提高测试覆盖率到 70%+
5. 改进错误处理和日志记录

**Non-Goals:**

- 不新增更多电商平台支持（保持现有 8 个）
- 不改变现有 API 接口
- 不重构整体架构（六边形架构保持不变）
- 不引入新的外部依赖（使用现有库）

## Decisions

### D1：数据源抽象层

**Decision:** 创建 `DataSourceExecutor` 接口，统一各类型数据源的执行方式。

**Rationale:**

- 当前各数据源实现分散在 Adapter 中
- 缺少统一的生命周期管理
- 难以添加新的数据源类型

**Design:**

```
┌─────────────────────────────────────────────────────────────────┐
│                      DataSourceExecutor                         │
├─────────────────────────────────────────────────────────────────┤
│ interface DataSourceExecutor {                                  │
│   id: string;                                                   │
│   type: DataSourceType;                                         │
│   execute<T>(params: ExecuteParams): Promise<T>;                │
│   isAvailable(): boolean;                                       │
│   getQuota(): QuotaInfo;                                        │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
   │ OfficialApi    │  │ ThirdPartyApi  │  │ SkillCrawler   │
   │ Executor       │  │ Executor       │  │ Executor       │
   └────────────────┘  └────────────────┘  └────────────────┘
```

**Alternatives Considered:**

- 在 Adapter 中直接实现：现有模式，难以维护
- 使用工厂模式：需要额外管理工厂实例

### D2：统一配置加载器

**Decision:** 创建 `UnifiedConfigLoader` 类，集中管理所有配置。

**Rationale:**

- 当前配置读取分散在 5+ 个地方
- 缺少配置验证
- 难以追踪配置来源

**Design:**

```
┌─────────────────────────────────────────────────────────────────┐
│                      UnifiedConfigLoader                        │
├─────────────────────────────────────────────────────────────────┤
│ class UnifiedConfigLoader {                                     │
│   private config: MeichaoEcomConfig;                           │
│                                                                 │
│   static fromEnv(): UnifiedConfigLoader;                        │
│   static fromFile(path: string): UnifiedConfigLoader;           │
│                                                                 │
│   getDatabaseConfig(): DatabaseConfig;                          │
│   getRedisConfig(): RedisConfig;                                │
│   getApiConfig(platform: Platform): ApiConfig;                  │
│   getSearchConfig(): SearchConfig;                              │
│                                                                 │
│   validate(): ValidationResult;                                 │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘

配置优先级：
1. 代码中指定的值（最低优先级）
2. 配置文件中的值
3. 环境变量
4. 运行时参数（最高优先级）
```

**Alternatives Considered:**

- 使用 config 库：引入新依赖，且功能过剩
- 保持现状：难以维护

### D3：TransactionalProductRepository 修复

**Decision:** 修复事务处理，确保使用传入的 client。

**Rationale:**
当前实现：

```typescript
class TransactionalProductRepository implements ProductRepository {
  constructor(private client: PoolClient) {}

  async create(data: ProductCreateInput): Promise<Product> {
    const repo = new PostgresProductRepository(); // ❌ 创建新实例，未使用 client
    return repo.create(data);
  }
}
```

应该改为：

```typescript
async create(data: ProductCreateInput): Promise<Product> {
  const sql = "INSERT INTO ...";
  const result = await this.client.query(sql, params);  // ✅ 使用传入的 client
  return rowToProduct(result.rows[0]);
}
```

### D4：Redis keys() 替换

**Decision:** 使用 SCAN 替代 KEYS，避免阻塞。

**Rationale:**

- `KEYS *` 在大数据量时会阻塞 Redis
- `SCAN` 是增量迭代，不会阻塞

**Before:**

```typescript
const keys = await client.keys("*"); // ❌ 阻塞操作
```

**After:**

```typescript
async function scanAllKeys(client: RedisClient, pattern = "*"): Promise<string[]> {
  const keys: string[] = [];
  let cursor = 0;
  do {
    const [nextCursor, batch] = await client.scan(cursor, { MATCH: pattern });
    cursor = parseInt(nextCursor, 10);
    keys.push(...batch);
  } while (cursor !== 0);
  return keys;
}
```

### D5：统一日志系统

**Decision:** 扩展现有 `logging.ts`，替换所有 `console.warn/error`。

**Rationale:**

- 已有 `pipelineLog` 用于 Pipeline 日志
- 需要扩展为通用 logger
- 支持 log level 和结构化日志

**Design:**

```typescript
// logging.ts
export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => { ... },
  warn: (message: string, meta?: Record<string, unknown>) => { ... },
  error: (message: string, error?: Error, meta?: Record<string, unknown>) => { ... },
  debug: (message: string, meta?: Record<string, unknown>) => { ... },
};

// 使用
logger.error(`Failed to fetch product ${numIid}`, error, { platform: 'taobao' });
```

## Risks / Trade-offs

### Risk 1：数据源扩展可能引入不稳定性

**Mitigation:** 每个数据源独立测试，使用 feature flag 控制启用

### Risk 2：配置统一可能影响现有行为

**Mitigation:** 保持向后兼容，现有环境变量优先级最高

### Risk 3：事务修复可能影响现有数据

**Mitigation:** 添加集成测试，验证事务回滚场景

### Risk 4：Redis SCAN 性能不如 KEYS（小数据量时）

**Mitigation:** 添加配置项，允许在小数据量时使用 KEYS

## Migration Plan

### Phase 1（1-2 周）

1. 修复 TransactionalProductRepository
2. 替换 Redis KEYS 为 SCAN
3. 创建 UnifiedConfigLoader
4. 添加关键测试

### Phase 2（2-3 周）

1. 实现 ThirdPartyApiDataSource
2. 完善 AmazonAdapter
3. 统一日志系统
4. 提高测试覆盖率

### Phase 3（1-2 周）

1. 实现 SkillCrawlerDataSource（可选）
2. 性能优化
3. 文档更新

### Rollback Strategy

- 每个改动独立 PR
- 使用 feature flag 控制新功能
- 保持旧代码路径，新功能稳定后移除

## Open Questions

1. **第三方 API 选择**：聚水潭还是蝉妈妈？或者两者都支持？
2. **Skill Crawler 技术**：使用 Puppeteer 还是 Playwright？
3. **配置格式**：支持 JSON、YAML 还是 TOML？
4. **日志输出**：输出到文件还是只输出到控制台？
