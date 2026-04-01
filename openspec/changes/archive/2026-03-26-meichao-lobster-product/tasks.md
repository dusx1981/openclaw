# 模块化开发任务清单

> **实现顺序**: M0 → M1 → M2/M3(并行) → M4 → M5 → M6 → M7
> 
> **验收原则**: 每个模块完成后必须通过测试验收，才能继续下一模块
> 
> **详细计划**: 见 [plan.md](./plan.md)

---

## 进度总览

| 模块 | 名称 | 状态 | 测试数 | 依赖 |
|------|------|------|--------|------|
| M0 | 基础设施 | 🟢 完成 | - | 无 |
| M1 | 领域核心 | 🟢 完成 | 74 | 无 |
| M2 | 存储层 | 🟢 完成 | 28 | M0, M1 |
| M3 | 缓存层 | 🟢 完成 | 28 | M0, M1 |
| M4 | 平台网关 | 🟢 完成 | 46 | M1 |
| M5 | 数据管道 | 🟢 完成 | 22 | M2, M3, M4 |
| M6 | 应用服务 | 🟢 完成 | 22 | M1-M5 |
| M7 | 接口层 | 🟢 完成 | 4 | M6 |

**总体进度**: 100% | **总测试数**: 220 | **完成日期**: 2026-03-25

---

## M0: 基础设施模块

**目标**: 提供 PostgreSQL + Redis 容器环境

### 验收标准
- [x] `docker-compose up -d` 成功启动
- [x] PostgreSQL 可连接
- [x] Redis 可连接
- [x] products 表已创建

### 任务
- [x] M0.1 创建 docker-compose.yml
- [x] M0.2 创建 init.sql (表结构 + 索引)
- [x] M0.3 创建 .env.example
- [x] M0.4 验证容器启动

### 输出
```
extensions/meichao-ecom/
├── docker-compose.yml
├── init.sql
└── .env.example
```

---

## M1: 领域核心模块 ✅

**目标**: 定义业务类型、端口接口、实体、值对象

### 验收标准
- [x] 类型定义无外部依赖
- [x] 端口接口只有方法签名
- [x] 实体包含验证方法
- [x] 测试覆盖率 ≥ 90%

### 任务
- [x] M1.1 创建 types.ts (Platform, ProductStatus 等)
- [x] M1.2 创建 entities/Product.ts (含验证)
- [x] M1.3 创建 value-objects/DataSource.ts
- [x] M1.4 创建 value-objects/Quota.ts
- [x] M1.5 创建 ports/ProductRepository.ts (接口)
- [x] M1.6 创建 ports/PlatformGateway.ts (接口)
- [x] M1.7 创建 ports/CacheProvider.ts (接口)
- [x] M1.8 编写单元测试

### 输出
```
src/domain/
├── types.ts
├── entities/Product.ts
├── value-objects/DataSource.ts
├── value-objects/Quota.ts
├── ports/ProductRepository.ts
├── ports/PlatformGateway.ts
├── ports/CacheProvider.ts
└── __tests__/*.test.ts
```

---

## M2: 存储层模块 ✅

**目标**: 实现 PostgreSQL 数据存储

### 依赖
- M0 (基础设施)
- M1 (ProductRepository 接口)

### 验收标准
- [x] 连接池可建立
- [x] CRUD 操作正确
- [x] 事务支持正确
- [x] 测试覆盖率 ≥ 80%

### 任务
- [x] M2.1 创建 MockProductRepository
- [x] M2.2 创建 storage/postgres.ts
- [x] M2.3 创建 storage/ProductRepository.ts
- [x] M2.4 实现 CRUD 方法
- [x] M2.5 实现事务支持
- [x] M2.6 编写单元测试
- [x] M2.7 编写集成测试

### 输出
```
src/infrastructure/storage/
├── postgres.ts
├── ProductRepository.ts
└── __tests__/*.test.ts

src/__mocks__/ProductRepository.ts
```

---

## M3: 缓存层模块 ✅

**目标**: 实现 Redis 缓存

### 依赖
- M0 (基础设施)
- M1 (CacheProvider 接口)

### 验收标准
- [x] 连接可建立
- [x] get/set/delete 正确
- [x] TTL 支持正确
- [x] 测试覆盖率 ≥ 80%

### 任务
- [x] M3.1 创建 MockCacheProvider
- [x] M3.2 创建 cache/redis.ts
- [x] M3.3 创建 cache/CacheProvider.ts
- [x] M3.4 实现 get/set/delete/getJson/setJson
- [x] M3.5 编写单元测试
- [x] M3.6 编写集成测试

### 输出
```
src/infrastructure/cache/
├── redis.ts
├── CacheProvider.ts
└── __tests__/*.test.ts

src/__mocks__/CacheProvider.ts
```

---

## M4: 平台网关模块 ✅

**目标**: 实现电商平台数据获取适配器

### 依赖
- M1 (PlatformGateway 接口)

### 验收标准
- [x] 适配器实现统一接口
- [x] 数据标准化正确
- [x] 多数据源选择正确
- [x] 重试机制正确
- [x] 测试覆盖率 ≥ 80%

### 任务
- [x] M4.1 创建 MockPlatformGateway
- [x] M4.2 创建 adapters/BasePlatformAdapter.ts
- [x] M4.3 创建 registry/PlatformRegistry.ts
- [x] M4.4 实现 TaobaoAdapter
- [x] M4.5 实现 AmazonAdapter
- [ ] M4.6 实现 DouyinAdapter (可选扩展)
- [ ] M4.7 实现 1688Adapter (可选扩展)
- [ ] M4.8 实现 ShopeeAdapter (可选扩展)
- [x] M4.9 编写单元测试

### 输出
```
src/infrastructure/
├── adapters/
│   ├── BasePlatformAdapter.ts
│   ├── taobao.ts
│   ├── amazon.ts
│   ├── douyin.ts
│   ├── 1688.ts
│   ├── shopee.ts
│   └── __tests__/*.test.ts
├── registry/PlatformRegistry.ts
└── __mocks__/PlatformGateway.ts
```

---

## M5: 数据管道模块 ✅

**目标**: 实现 ETL 数据处理管道

### 依赖
- M2, M3, M4 (通过接口)

### 验收标准
- [x] 管道可顺序执行过滤器
- [x] 验证/去重/缓存逻辑正确
- [x] 错误处理完整
- [x] 测试覆盖率 ≥ 80%

### 任务
- [x] M5.1 创建 pipeline/types.ts
- [x] M5.2 创建 filters/FetchFilter.ts
- [x] M5.3 创建 filters/ValidateFilter.ts
- [x] M5.4 创建 filters/DedupeFilter.ts
- [x] M5.5 创建 filters/StoreFilter.ts
- [x] M5.6 创建 filters/CacheFilter.ts
- [x] M5.7 创建 DataPipeline.ts
- [x] M5.8 编写单元测试
- [x] M5.9 编写集成测试

### 输出
```
src/application/pipeline/
├── types.ts
├── DataPipeline.ts
├── filters/*.ts
└── __tests__/*.test.ts
```

---

## M6: 应用服务模块 ✅

**目标**: 实现业务用例

### 依赖
- M1-M5 (通过接口)

### 验收标准
- [x] UseCase 可协调各模块
- [x] QuotaService 可跟踪配额
- [x] 依赖注入正确
- [x] 测试覆盖率 ≥ 80%

### 任务
- [x] M6.1 创建 container/Container.ts
- [x] M6.2 创建 FetchProductUseCase.ts
- [x] M6.3 创建 SearchProductsUseCase.ts
- [x] M6.4 创建 QuotaService.ts
- [x] M6.5 创建 AlertService.ts
- [x] M6.6 编写单元测试

### 输出
```
src/application/
├── container/Container.ts
├── use-cases/*.ts
├── services/*.ts
└── __tests__/*.test.ts
```

---

## M7: 接口层模块 ✅

**目标**: 实现 CLI Tools 和插件入口

### 依赖
- M6 (应用服务)

### 验收标准
- [x] 所有 Tool 可执行
- [x] 插件可加载

### 任务
- [x] M7.1 创建 package.json
- [x] M7.2 创建 index.ts (插件注册)
- [x] M7.3 实现 initializePlatform()
- [x] M7.4 实现 shutdownPlatform()
- [x] M7.5 编写 E2E 测试

### 输出
```
extensions/meichao-ecom/
├── package.json
├── index.ts
└── __tests__/*.test.ts
```

---

## 测试覆盖率目标

| 模块 | 行覆盖率 | 分支覆盖率 |
|------|---------|-----------|
| M1 | 95% | 90% |
| M2-M6 | 85% | 80% |
| M7 | 75% | 70% |
| **总体** | **85%** | **80%** |

---

## 开始开发

```bash
/opsx-apply meichao-lobster-product
```