## Context

当前 `TaobaoAdapter` 使用硬编码的模拟数据返回商品信息，无法获取真实的淘宝商品数据。淘宝开放平台提供了官方 API 接口，需要：

1. App Key 和 App Secret 进行身份认证
2. 签名机制（MD5 或 HMAC-SHA256）保证请求安全
3. OAuth 2.0 授权获取用户级别的数据访问权限

## Goals / Non-Goals

**Goals:**
- 实现淘宝开放平台 API 客户端
- 支持商品详情查询（`taobao.item.seller.get`）
- 支持商品搜索（`taobao.items.search`）
- 实现签名生成和验证
- 支持环境变量配置 API 凭证
- 保留现有的降级机制

**Non-Goals:**
- 不实现所有淘宝 API（仅实现商品相关）
- 不实现淘宝 OAuth 授权页面（仅支持已有 access_token）
- 不实现订单、物流等其他业务 API
- 不实现第三方数据服务接入（本次仅接入官方 API）

## Decisions

### Decision 1: API 客户端架构

**选择**: 独立的 `TaobaoApiClient` 类，与 `TaobaoAdapter` 分离

**理由**:
- 职责分离：API 客户端专注 HTTP 通信，Adapter 专注业务逻辑
- 可测试性：API 客户端可独立 mock
- 可复用：其他模块可直接使用 API 客户端

```
TaobaoAdapter
    └── TaobaoApiClient
            ├── TaobaoSignature (签名生成)
            └── TaobaoRequestBuilder (请求构建)
```

### Decision 2: 签名算法

**选择**: HMAC-SHA256（淘宝推荐）

**理由**:
- 比 MD5 更安全
- 淘宝开放平台官方推荐
- 防止签名被破解

**备选方案**:
- MD5 ❌ 安全性较低
- RSA ❌ 实现复杂，淘宝未强制要求

### Decision 3: 凭证存储

**选择**: 环境变量 + 配置文件

**理由**:
- 环境变量适合容器化部署
- 配置文件适合本地开发
- 敏感信息不入代码仓库

```
TAOBAO_APP_KEY=xxx
TAOBAO_APP_SECRET=xxx
TAOBAO_ACCESS_TOKEN=xxx (可选)
```

### Decision 4: 错误处理

**选择**: 统一错误分类 + 重试机制

**理由**:
- 淘宝 API 有统一的错误码体系
- 部分错误可重试（限流、服务繁忙）
- 与现有降级机制集成

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| API 限流导致请求失败 | 实现令牌桶限流，复用现有熔断机制 |
| App Secret 泄露 | 使用环境变量，不写入代码；定期轮换密钥 |
| API 响应格式变更 | 版本化响应解析，添加字段校验 |
| 无效商品 ID 返回错误 | 正确处理错误响应，记录日志 |