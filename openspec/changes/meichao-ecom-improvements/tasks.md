# meichao-ecom 改进任务清单

## Phase 1: 基础设施修复（高优先级）

### 1. TransactionalProductRepository 修复

- [ ] 1.1 修复 `create()` 方法使用传入的 client
- [ ] 1.2 修复 `update()` 方法使用传入的 client
- [ ] 1.3 修复 `findByPlatformId()` 方法使用传入的 client
- [ ] 1.4 修复 `delete()` 方法使用传入的 client
- [ ] 1.5 添加事务集成测试验证回滚场景

### 2. Redis 缓存优化

- [ ] 2.1 创建 `scanAllKeys()` 辅助函数替代 `keys()`
- [ ] 2.2 修改 `clear()` 使用 SCAN
- [ ] 2.3 修改 `clearExpired()` 使用 SCAN
- [ ] 2.4 添加 SCAN 批量大小配置
- [ ] 2.5 移除 `getStats()` 中的 `clearExpired()` 调用
- [ ] 2.6 添加操作延迟追踪
- [ ] 2.7 添加 Redis 连接重试逻辑
- [ ] 2.8 添加 Circuit Breaker for Redis

### 3. 统一配置加载器

- [ ] 3.1 定义 `MeichaoEcomConfig` 接口
- [ ] 3.2 创建 `UnifiedConfigLoader` 类
- [ ] 3.3 实现 `fromEnv()` 静态方法
- [ ] 3.4 实现 `fromFile()` 静态方法（可选）
- [ ] 3.5 实现 `getDatabaseConfig()` 方法
- [ ] 3.6 实现 `getRedisConfig()` 方法
- [ ] 3.7 实现 `getApiConfig(platform)` 方法
- [ ] 3.8 实现 `getSearchConfig()` 方法
- [ ] 3.9 实现 `validate()` 方法
- [ ] 3.10 更新 `bootstrap.ts` 使用 UnifiedConfigLoader
- [ ] 3.11 添加配置加载器单元测试

### 4. 统一日志系统

- [ ] 4.1 扩展 `logging.ts` 为通用 logger
- [ ] 4.2 添加 log level 支持（debug, info, warn, error）
- [ ] 4.3 添加结构化日志支持（meta 字段）
- [ ] 4.4 替换 `TaobaoApiClient` 中的 console
- [ ] 4.5 替换 `TaobaoProductApi` 中的 console
- [ ] 4.6 替换 `TaobaoAdapter` 中的 console
- [ ] 4.7 替换其他文件中的 console

## Phase 2: 数据源扩展（中优先级）

### 5. DataSourceExecutor 接口

- [ ] 5.1 定义 `DataSourceExecutor` 接口
- [ ] 5.2 定义 `ExecuteParams` 和 `ExecuteResult` 类型
- [ ] 5.3 创建 `BaseDataSourceExecutor` 抽象类
- [ ] 5.4 更新 `BasePlatformAdapter` 使用 Executor 模式

### 6. 第三方 API 数据源

- [ ] 6.1 调研聚水潭 API 文档
- [ ] 6.2 调研蝉妈妈 API 文档
- [ ] 6.3 创建 `JushutanApiClient.ts`
- [ ] 6.4 创建 `JushutanExecutor.ts`
- [ ] 6.5 创建 `ChanmamaApiClient.ts`
- [ ] 6.6 创建 `ChanmamaExecutor.ts`
- [ ] 6.7 在 `TaobaoAdapter` 中注册第三方 API 执行器
- [ ] 6.8 添加第三方 API 单元测试
- [ ] 6.9 添加第三方 API 集成测试（mock server）

### 7. Amazon 真实 API

- [ ] 7.1 调研 Amazon SP-API 文档
- [ ] 7.2 创建 `src/infrastructure/api/amazon/` 目录
- [ ] 7.3 创建 `AmazonSpApiClient.ts`
- [ ] 7.4 创建 `AmazonProductsApi.ts`
- [ ] 7.5 实现 `getProductDetails()` API 调用
- [ ] 7.6 实现 `searchProducts()` API 调用
- [ ] 7.7 更新 `AmazonAdapter` 使用真实 API
- [ ] 7.8 添加 Amazon API 单元测试

### 8. 测试覆盖完善

- [ ] 8.1 添加 `bootstrap.ts` 单元测试
- [ ] 8.2 添加 `Container.ts` 单元测试
- [ ] 8.3 添加 `AmazonAdapter.test.ts`
- [ ] 8.4 添加 `UnifiedConfigLoader.test.ts`
- [ ] 8.5 添加存储层集成测试
- [ ] 8.6 验证测试覆盖率达到 70%+

## Phase 3: 高级功能（低优先级）

### 9. Skill Crawler 数据源（可选）

- [ ] 9.1 选择爬虫框架（Puppeteer vs Playwright）
- [ ] 9.2 创建 `SkillCrawlerExecutor.ts`
- [ ] 9.3 实现商品详情页爬取
- [ ] 9.4 实现搜索结果页爬取
- [ ] 9.5 添加反爬检测处理
- [ ] 9.6 实现浏览器实例池
- [ ] 9.7 添加爬虫单元测试

### 10. 性能优化

- [ ] 10.1 实现 `fetchProducts()` 批量查询
- [ ] 10.2 优化数据库索引
- [ ] 10.3 添加查询结果缓存预热
- [ ] 10.4 性能基准测试

### 11. 文档更新

- [ ] 11.1 更新 SKILL.md
- [ ] 11.2 更新 README.md
- [ ] 11.3 添加架构决策记录（ADR）
- [ ] 11.4 添加部署指南

## 验收标准

### Phase 1 验收

- [ ] 所有事务测试通过
- [ ] Redis 操作不再使用 KEYS 命令
- [ ] 配置统一从 UnifiedConfigLoader 读取
- [ ] 无 console.warn/error 残留

### Phase 2 验收

- [ ] 第三方 API 数据源可用
- [ ] Amazon API 真实调用可用
- [ ] 测试覆盖率 ≥ 70%

### Phase 3 验收

- [ ] 爬虫数据源可用（如实现）
- [ ] 文档完整
- [ ] 性能基准符合预期
