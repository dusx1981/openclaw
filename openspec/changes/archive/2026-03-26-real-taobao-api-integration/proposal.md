## Why

当前 `TaobaoAdapter.doFetchProduct()` 返回的是硬编码的模拟数据，无法采集真实的淘宝商品信息。需要接入淘宝开放平台 API 或第三方数据服务，实现真实的商品数据采集功能。

## What Changes

- 移除 `TaobaoAdapter.doFetchProduct()` 中的模拟数据逻辑
- 实现淘宝开放平台 API 客户端（使用 App Key/Secret 认证）
- 支持商品详情查询 API (`taobao.item.seller.get`)
- 支持商品搜索 API (`taobao.items.search`)
- 添加 API 签名生成逻辑（淘宝开放平台签名规范）
- 添加 OAuth 2.0 授权流程
- 支持配置化 API 凭证（环境变量/配置文件）
- 保留降级机制，支持备用数据源

## Capabilities

### New Capabilities

- `taobao-api-client`: 淘宝开放平台 API 客户端，包含认证、签名、请求发送等功能
- `taobao-oauth`: 淘宝 OAuth 2.0 授权流程实现

### Modified Capabilities

- `platform-validator`: 修改验证结果以反映真实 API 调用状态

## Impact

- 修改文件:
  - `src/infrastructure/adapters/TaobaoAdapter.ts` - 替换模拟数据为真实 API 调用
  - `src/infrastructure/api/taobao/` - 新增淘宝 API 客户端模块
- 新增依赖:
  - 可能需要加密库用于签名生成（crypto 模块，Node.js 内置）
- 配置变更:
  - 需要配置 `TAOBAO_APP_KEY` 和 `TAOBAO_APP_SECRET` 环境变量
  - 可选配置 `TAOBAO_API_ENDPOINT`（默认为官方地址）