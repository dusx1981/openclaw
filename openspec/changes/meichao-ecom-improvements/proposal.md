# meichao-ecom 系统性改进提案

## Why

当前 meichao-ecom 插件虽然基础架构完整（六边形架构、Pipeline 模式、降级机制），但存在以下核心问题：

1. **数据源实现不完整**：定义了 4 种数据源类型，但只有 official_api 和 open_search 有实际实现，third_party_api 和 skill_crawler 为空
2. **平台覆盖不足**：支持 8 个平台，但只有 Taobao 有真实 API 实现，其他都是 mock
3. **存储层问题**：事务处理有 bug，缓存使用 keys() 性能差
4. **配置分散**：配置读取分散在多处，缺乏统一管理
5. **测试覆盖不足**：关键组件缺少单元测试

这些问题导致系统无法在生产环境中可靠运行。

## What Changes

### 数据源完善

- 实现第三方 API 数据源（聚水潭、蝉妈妈等电商数据服务）
- 实现 Skill Crawler 数据源（浏览器自动化采集）
- 完善 Amazon SP-API 真实调用

### 存储层修复

- 修复 TransactionalProductRepository 未使用事务 client 的问题
- 优化 Redis 缓存，避免使用 keys() 命令
- 添加数据库连接池健康检查

### 配置管理统一

- 创建统一配置加载器，集中管理所有配置项
- 支持配置验证、默认值和环境变量覆盖

### 错误处理改进

- 统一使用 logger 替代 console.warn/error
- 完善错误分类逻辑，支持更多平台错误码
- 添加错误追踪 ID，方便排查问题

### 测试覆盖完善

- 添加 bootstrap.ts、Container.ts 单元测试
- 添加 AmazonAdapter 测试
- 添加存储层集成测试

## Capabilities

### New Capabilities

- `third-party-api-datasource`：第三方 API 数据源实现，支持聚水潭、蝉妈妈等服务
- `skill-crawler-datasource`：浏览器自动化采集数据源
- `unified-config-loader`：统一配置加载器

### Modified Capabilities

- `platform-adapter`：完善各平台适配器的真实 API 调用
- `product-repository`：修复事务处理 bug
- `cache-provider`：优化 Redis 操作性能

## Impact

### 新增文件

- `src/infrastructure/datasources/ThirdPartyApiDataSource.ts`
- `src/infrastructure/datasources/SkillCrawlerDataSource.ts`
- `src/infrastructure/datasources/index.ts`
- `src/infrastructure/config/UnifiedConfigLoader.ts`
- `src/infrastructure/api/amazon/` 目录

### 修改文件

- `src/infrastructure/storage/ProductRepository.ts`
- `src/infrastructure/cache/CacheProvider.ts`
- `src/infrastructure/adapters/AmazonAdapter.ts`
- `src/application/bootstrap.ts`
- `src/logging.ts`

### 测试文件

- 新增约 15 个测试文件

### 无破坏性变更

- 所有改动向后兼容，不影响现有 API

## Phased Approach

由于改进范围较大，建议分阶段实施：

### Phase 1：基础设施修复（高优先级）

- 存储层 bug 修复
- Redis 性能优化
- 配置管理统一

### Phase 2：数据源扩展（中优先级）

- 第三方 API 数据源
- Amazon 真实 API
- 测试覆盖

### Phase 3：高级功能（低优先级）

- Skill Crawler 数据源
- 更多平台支持
- 性能优化
