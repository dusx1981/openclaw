## Why

meichao-ecom 插件存在两个架构问题：

1. **共享实例问题**：`TaobaoValidator` 创建了独立的 `TaobaoAdapter` 实例，而不是使用 `PlatformRegistry` 中的共享实例。这导致熔断器、冷却管理器和数据源状态在不同工具之间不同步。

2. **搜索缺少降级**：`ecom-product-search` 工具的 `searchProducts()` 方法没有使用 `fetchWithFailover` 降级机制，而 `fetchProduct()` 有完整的降级支持。当淘宝 API 不可用时，搜索功能直接失败，无法降级到开放搜索。

现在修复这两个问题，可以为搜索功能提供与抓取功能相同的可靠性保障。

## What Changes

- 修复 `TaobaoValidator` 使用 `PlatformRegistry` 中的共享 `TaobaoAdapter` 实例
- 新增 `ProductSearchProvider` 接口，定义开放搜索提供商的标准契约
- 新增 `BingShoppingProvider` 实现，使用必应购物搜索 API
- 新增 `TavilyProductProvider` 实现，复用 OpenClaw 的 Tavily 基础设施
- 新增 `ProductSearchClient` 统一客户端，支持多提供商降级
- 修改 `TaobaoAdapter.searchProducts()` 使用 `fetchWithFailover` 实现降级
- 在 `TaobaoAdapter` 中新增 `taobao_open_search` 数据源
- 更新 `DataSourceType` 类型，新增 `"open_search"` 类型

## Capabilities

### New Capabilities

- `product-search-provider`: 开放搜索提供商接口和实现，支持 Bing Shopping 和 Tavily 作为商品搜索的降级数据源

### Modified Capabilities

- `platform-adapter`: 修改 `searchProducts()` 方法使用 `fetchWithFailover` 降级机制，与 `fetchProduct()` 保持一致的可靠性设计

## Impact

**代码变更：**

- `extensions/meichao-ecom/src/infrastructure/search/` (新建目录)
  - `types.ts` - 搜索类型定义
  - `ProductSearchProvider.ts` - Provider 接口
  - `ProductSearchClient.ts` - 统一客户端
  - `providers/BingShoppingProvider.ts` - Bing 实现
  - `providers/TavilyProductProvider.ts` - Tavily 实现
- `extensions/meichao-ecom/src/infrastructure/adapters/TaobaoAdapter.ts` (修改)
  - 新增 `taobao_open_search` 数据源
  - 修改 `searchProducts()` 使用 `fetchWithFailover`
- `extensions/meichao-ecom/src/validation/TaobaoValidator.ts` (修改)
  - 使用 `PlatformRegistry.get("taobao")` 获取共享实例
- `extensions/meichao-ecom/src/domain/types.ts` (修改)
  - `DataSourceType` 新增 `"open_search"`

**依赖：**

- Bing Search API (免费层 1000 次/月)
- 复用 OpenClaw 已有的 Tavily 扩展

**配置：**

- 新增 `BING_API_KEY` 环境变量支持
- 更新 `.env.example`
