# Fix P0 Storage Bugs and Implement Amazon API

## Why

meichao-ecom 系统当前存在两个 P0 级别的问题，完全阻塞生产使用：

### 1. 存储层 Bug - 数据一致性风险

**TransactionalProductRepository 问题**:

- 未正确使用事务 client
- 事务处理逻辑错误
- 无回滚机制
- **影响**: 数据一致性风险，可能导致数据损坏

**Redis CacheProvider 性能问题**:

- 使用 `keys()` 命令 (O(N) 时间复杂度)
- 在大量缓存键时性能急剧下降
- 无批量操作优化
- **影响**: 生产环境性能瓶颈

### 2. 数据源实现不完整 - 核心功能缺失

**平台适配器状态**:

- ✅ Taobao: 完整实现，真实 API
- ⚠️ Amazon: Mock 实现，无法采集真实数据
- ⚠️ JD, PDD, 1688, Tmall, Shopee, Lazada: 全部 Mock

**数据源类型实现**:

- ✅ official_api: 淘宝实现
- ❌ third_party_api: 空实现
- ❌ skill_crawler: 空实现
- ✅ open_search: Bing/Tavily

**影响**:

- 只能采集淘宝数据
- 无法满足多平台数据采集需求
- 客户无法使用 Amazon 等平台数据

### 业务影响

```
当前能力:
├─ 可用平台: 1/8 (淘宝)
├─ 数据源类型: 2/4
└─ 生产可用: ❌ NO

客户痛点:
├─ Amazon 数据采集需求强烈
├─ 多平台数据对比分析需求
└─ 第三方数据源补充需求
```

**Why Now**: P0 问题阻塞生产使用已 10 天，必须立即解决才能交付客户使用。

## What Changes

### Phase 1: 存储层 Bug 修复 (Week 1, 2-3 天)

**TransactionalProductRepository 修复**:

- 修复事务 client 使用
- 实现正确的事务处理逻辑
- 添加事务回滚机制
- 添加并发场景处理
- 完善错误处理

**Redis CacheProvider 优化**:

- 移除 `keys()` 使用
- 改用 SCAN 或维护键集合
- 添加批量操作支持
- 优化缓存键命名规范
- 添加性能监控

**数据库连接池健康检查**:

- 添加连接池状态检查
- 实现自动重连机制
- 添加连接池监控指标

### Phase 2: Amazon API 实现 (Week 1, 2-3 天)

**Amazon SP-API 集成**:

- 实现 SP-API 认证流程
- 实现 Product Pricing API
- 实现 Catalog Items API
- 实现数据转换层
- 添加速率限制和错误处理

**AmazonAdapter 完善**:

- 替换 Mock 为真实实现
- 实现完整的 CRUD 操作
- 添加重试和降级逻辑
- 完善错误分类

### Phase 3: 测试完善 (Week 1, 1 天)

**测试修复**:

- 修复 postgres.test.ts Mock 配置
- 修复 redis.test.ts Mock 配置
- 修复 ProductRepository.test.ts
- 修复 CacheProvider.test.ts
- 目标: 测试通过率 80%+

**新增测试**:

- 添加 AmazonAdapter 单元测试
- 添加存储层集成测试
- 添加性能基准测试

### Phase 4: 配置管理优化 (Week 2, 2-3 天) [可选]

**统一配置加载器**:

- 创建 UnifiedConfigLoader
- 集中配置验证
- 统一环境变量覆盖
- 添加配置文档

## Capabilities

### New Capabilities

- `amazon-sp-api-integration`: Amazon SP-API 真实集成，支持产品定价、目录等核心 API
- `storage-transaction-fix`: 存储层事务修复，确保数据一致性
- `redis-performance-optimization`: Redis 性能优化，避免 O(N) 操作

### Modified Capabilities

- `platform-adapter`: AmazonAdapter 从 Mock 升级为真实实现
- `product-repository`: 修复事务处理 bug
- `cache-provider`: 优化性能，支持大规模数据

## Impact

### 新增文件

```
src/infrastructure/api/amazon/
├─ AmazonSPApiClient.ts         # SP-API 客户端
├─ auth/
│  ├─ LWAAuth.ts               # Login with Amazon 认证
│  └─ AWSSigner.ts             # AWS 签名
├─ products/
│  ├─ ProductPricingApi.ts     # 定价 API
│  └─ CatalogItemsApi.ts       # 目录 API
└─ types.ts                     # Amazon 特定类型

src/infrastructure/storage/
└─ TransactionManager.ts        # 事务管理器

src/infrastructure/cache/
└─ RedisKeyManager.ts           # Redis 键管理器
```

### 修改文件

```
核心修复:
├─ src/infrastructure/storage/ProductRepository.ts
├─ src/infrastructure/cache/CacheProvider.ts
├─ src/infrastructure/adapters/AmazonAdapter.ts
└─ src/infrastructure/storage/postgres.ts

测试修复:
├─ src/infrastructure/postgres.test.ts
├─ src/infrastructure/redis.test.ts
├─ src/infrastructure/ProductRepository.test.ts
├─ src/infrastructure/CacheProvider.test.ts
└─ src/infrastructure/adapters/AmazonAdapter.test.ts

配置新增:
└─ openclaw.plugin.json         # Amazon API 配置
```

### 新增测试文件

```
test/integration/amazon-sp-api.test.ts
test/unit/TransactionManager.test.ts
test/unit/RedisKeyManager.test.ts
test/performance/cache-performance.test.ts
```

### 依赖变更

```json
{
  "dependencies": {
    "amazon-sp-api": "^1.0.0", // 新增
    "aws-sdk-client-v3": "^3.0.0" // 新增
  }
}
```

### 配置变更

```json
{
  "amazon": {
    "clientId": "string",
    "clientSecret": "string",
    "refreshToken": "string",
    "region": "string",
    "marketplaceId": "string"
  }
}
```

### 破坏性变更

**无破坏性变更** - 所有改动向后兼容，不影响现有 API。

### 迁移路径

```
1. 部署新版本
   ├─ 数据库迁移 (无 schema 变更)
   ├─ 配置更新 (添加 Amazon 配置)
   └─ 重启服务

2. 验证
   ├─ 淘宝数据采集测试
   ├─ Amazon 数据采集测试
   └─ 性能测试

3. 切换
   └─ 无需切换，自动生效
```

## Phased Approach

### Week 1: 核心修复

```
Day 1-2: 存储层 Bug 修复
├─ TransactionalProductRepository 修复
├─ Redis CacheProvider 优化
└─ 连接池健康检查

Day 3-4: Amazon API 实现
├─ SP-API 认证集成
├─ 产品定价 API
├─ 目录 API
└─ AmazonAdapter 完善

Day 5: 测试修复
├─ Mock 配置修复
├─ 新增测试
└─ 目标: 80%+ 通过率
```

### Week 2: 稳定化 (可选)

```
Day 1-2: 配置管理优化
├─ UnifiedConfigLoader
└─ 配置验证

Day 3: 性能优化
├─ 缓存策略优化
└─ 批量操作支持

Day 4-5: 文档与测试
├─ API 使用文档
├─ 部署指南
└─ 测试提升到 90%+
```

## Success Criteria

### 必须达成 (Week 1)

```
功能目标:
├─ ✅ 存储层事务正确处理
├─ ✅ Redis 性能无明显瓶颈
├─ ✅ Amazon 真实数据采集可用
└─ ✅ 测试通过率 ≥ 80%

质量目标:
├─ ✅ 无已知 P0 bug
├─ ✅ 核心功能测试覆盖
└─ ✅ 生产环境验证通过
```

### 应该达成 (Week 2)

```
质量目标:
├─ ✅ 测试通过率 ≥ 90%
├─ ✅ 配置管理统一
└─ ✅ 完整的错误处理

文档目标:
├─ ✅ API 使用文档
├─ ✅ 部署指南
└─ ✅ 故障排查手册
```

### 可以达成 (后续)

```
扩展目标:
├─ 第三方数据源实现
├─ 其他平台适配器
└─ 性能监控完善
```

## Risks & Mitigations

### Risk 1: Amazon SP-API 复杂性

**风险**: SP-API 文档复杂，认证流程繁琐
**影响**: 可能延长时间
**缓解措施**:

- 使用官方 SDK
- 参考成功案例
- 预留缓冲时间

### Risk 2: 事务修复引入新 bug

**风险**: 事务逻辑复杂，可能引入新问题
**影响**: 数据一致性问题
**缓解措施**:

- 完善测试覆盖
- 代码审查
- 灰度发布

### Risk 3: Redis 优化影响现有功能

**风险**: 改动缓存逻辑可能影响现有功能
**影响**: 功能回归
**缓解措施**:

- 渐进式优化
- 完善测试
- 回滚方案

## Dependencies

### 前置条件

- ✅ 测试系统已恢复 (Phase 4 完成)
- ✅ SDK entry 已注册
- ❌ Amazon API 凭证 (需要配置)

### 外部依赖

- Amazon SP-API 服务可用
- 第三方库稳定性
- PostgreSQL/Redis 服务稳定

## Related Work

### 关联 OpenSpec Changes

- `unify-meichao-ecom-test-architecture`: 测试系统修复 (Phase 4 已完成)
- `meichao-ecom-improvements`: 整体改进计划 (可参考)
- `smart-source-selection`: 数据源选择策略 (后续)

### 技术债务

本次修复解决部分技术债务:

- ✅ 存储层事务 bug
- ✅ Redis 性能问题
- ❌ 配置管理分散 (Week 2)
- ❌ 第三方数据源缺失 (后续)
