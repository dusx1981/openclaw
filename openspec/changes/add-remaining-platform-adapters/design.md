# Design: Add Remaining Platform Adapters

## 架构概述

> **基础架构详见**: `INFRASTRUCTURE.md` 系统架构概览 (line 11-52)

所有平台继承 `BasePlatformAdapter`，复用完整的容错系统：

```
BasePlatformAdapter (253 行)
├─ 容错系统 (已集成，不要重复实现)
│  ├─ ErrorClassifier
│  ├─ CircuitBreaker
│  ├─ DegradationExecutor
│  ├─ CooldownManager
│  └─ DecisionLogger
└─ 子类只需实现
   ├─ getPlatform()
   ├─ fetchProduct()
   ├─ fetchProducts()
   └─ searchProducts()
```

> **参考实现**: `INFRASTRUCTURE.md` TaobaoAdapter 参考模式 (line 503-567)

---

## 平台特定设计

> **实现模式判断**: `INFRASTRUCTURE.md` 复用决策树 (line 456-482)

### 1. 1688 (阿里巴巴批发平台)

**实现模式**: 参考 Taobao（同属阿里系，无官方 SDK）

```
API 特点:
├─ 与 Taobao API 类似（阿里系）
├─ 需要 appKey, appSecret
├─ 签名算法: MD5 或 HMAC-SHA256
└─ 批发价、起批量等特有字段

数据源配置:
├─ alibaba_1688_official_api (优先级 1)
├─ alibaba_1688_third_party (优先级 2)
└─ alibaba_1688_crawler (优先级 3)

特殊字段 → extraData:
├─ wholesalePrice: 批发价
├─ minOrderQuantity: 起批量
└─ supplierInfo: 供应商信息

错误映射:
├─ 'system.error' → 'SYSTEM_ERROR'
├─ 'insufficient.permissions' → 'ACCESS_DENIED'
└─ 'item.not.exist' → 'NOT_FOUND'

主要 API:
├─ alibaba.product.get (商品详情)
└─ alibaba.product.search (商品搜索)
```

**参考**: TaobaoApiClient (203 行)

---

### 2. JD (京东)

**实现模式**: SDK 封装（有 jd-sdk）或自实现

```
API 特点:
├─ 京东宙斯开放平台
├─ OAuth 2.0 认证
├─ RESTful API
└─ 可能需要 SDK 封装

数据源配置:
├─ jd_official_api (优先级 1)
├─ jd_third_party (优先级 2)
└─ jd_crawler (优先级 3)

特殊字段 → extraData:
├─ commissionInfo: 佣金信息
├─ couponInfo: 优惠券信息
└─ plusPrice: PLUS 价格

错误映射:
├─ '400' → 'INVALID_REQUEST'
├─ '403' → 'ACCESS_DENIED'
└─ '500' → 'SYSTEM_ERROR'

主要 API:
├─ jd.union.open.goods.jingfen.query (精选商品)
├─ jd.union.open.goods.promotiongoodsinfo (详情)
└─ jd.union.open.goods.query (搜索)
```

**参考**: AmazonSPApiClient (110 行) - SDK 封装模式

---

### 3. Pinduoduo (拼多多)

**实现模式**: 参考 Taobao（无官方 SDK）

```
API 特点:
├─ 多多进宝开放平台
├─ client_id, secret 认证
├─ MD5 签名
└─ 拼团价、销量等特有字段

数据源配置:
├─ pinduoduo_official_api (优先级 1)
├─ pinduoduo_third_party (优先级 2)
└─ pinduoduo_crawler (优先级 3)

特殊字段 → extraData:
├─ groupPrice: 拼团价
├─ normalPrice: 单买价
├─ groupRequiredNum: 成团人数
└─ salesTip: 销量提示 (如 "已拼10万+件")

错误映射:
├─ '40001' → 'ACCESS_DENIED'
├─ '50000' → 'SYSTEM_ERROR'
└─ '52001' → 'RATE_LIMIT'

主要 API:
├─ pdd.ddk.goods.detail (商品详情)
├─ pdd.ddk.goods.search (商品搜索)
└─ pdd.ddk.goods.recommend.get (推荐商品)
```

**参考**: TaobaoApiClient (203 行)

---

### 4. Douyin (抖音电商)

**实现模式**: 参考 Taobao（无官方 SDK）

```
API 特点:
├─ 抖音开放平台
├─ OAuth 2.0 认证
├─ 签名算法: SHA256
└─ 直播价、短视频链接等特有字段

数据源配置:
├─ douyin_official_api (优先级 1)
├─ douyin_third_party (优先级 2)
└─ douyin_crawler (优先级 3)

特殊字段 → extraData:
├─ livePrice: 直播价
├─ videoUrl: 短视频链接
├─ influencerInfo: 达人信息
└─ commissionRate: 佣金比例

错误映射:
├─ '10001' → 'SYSTEM_ERROR'
├─ '10002' → 'ACCESS_DENIED'
└─ '10003' → 'RATE_LIMIT'

主要 API:
├─ product.detail (商品详情)
├─ product.list (商品列表)
└─ product.search (商品搜索)
```

**参考**: TaobaoApiClient (203 行)

---

### 5. Shopee (虾皮)

**实现模式**: SDK 封装或自实现

```
API 特点:
├─ Shopee Open Platform
├─ Partner ID, Key 认证
├─ HMAC-SHA256 签名
└─ 多站点支持 (SG, MY, TH, etc.)

数据源配置:
├─ shopee_official_api (优先级 1)
├─ shopee_third_party (优先级 2)
└─ shopee_crawler (优先级 3)

特殊字段 → extraData:
├─ shopLocation: 店铺位置
├─ shopeeVerified: Shopee 验证
├─ crossBorder: 是否跨境
└─ currency: 多币种

错误映射:
├─ 'error_auth' → 'ACCESS_DENIED'
├─ 'error_param' → 'INVALID_REQUEST'
└─ 'error_server' → 'SYSTEM_ERROR'

主要 API:
├─ item/get_item_list (商品列表)
├─ item/get_item_base_info (商品详情)
└─ item/search (商品搜索)
```

**参考**: AmazonSPApiClient (110 行) - 如果有 SDK

---

### 6. AliExpress (速卖通)

**实现模式**: 参考 Taobao（阿里系，无官方 SDK）

```
API 特点:
├─ 速卖通开放平台
├─ appKey, appSecret 认证
├─ 签名算法: MD5 或 HMAC-SHA256
└─ 多语言、多币种、跨境物流

数据源配置:
├─ aliexpress_official_api (优先级 1)
├─ aliexpress_third_party (优先级 2)
└─ aliexpress_crawler (优先级 3)

特殊字段 → extraData:
├─ shipToCountries: 配送国家
├─ deliveryTime: 配送时间
├─ originalLanguage: 原始语言
└─ discountRate: 折扣率

错误映射:
├─ '200' → 'SUCCESS'
├─ '500' → 'SYSTEM_ERROR'
└─ '520' → 'RATE_LIMIT'

主要 API:
├─ aliexpress.affiliate.product.query (商品查询)
├─ aliexpress.affiliate.product.detail (商品详情)
└─ aliexpress.affiliate.featured.promo.get (促销)
```

**参考**: TaobaoApiClient (203 行)

---

## 错误分类扩展

> **不要重复实现**: ErrorClassifier 已提供完整能力，只需添加配置

```typescript
// ErrorClassifier.ts - PLATFORM_ERROR_MAPPINGS

// 添加以下配置
'1688': {
  'system.error': 'SYSTEM_ERROR',
  'insufficient.permissions': 'ACCESS_DENIED',
  'item.not.exist': 'NOT_FOUND',
},
jd: {
  '400': 'INVALID_REQUEST',
  '403': 'ACCESS_DENIED',
  '500': 'SYSTEM_ERROR',
},
pinduoduo: {
  '40001': 'ACCESS_DENIED',
  '50000': 'SYSTEM_ERROR',
  '52001': 'RATE_LIMIT',
},
douyin: {
  '10001': 'SYSTEM_ERROR',
  '10002': 'ACCESS_DENIED',
  '10003': 'RATE_LIMIT',
},
shopee: {
  'error_auth': 'ACCESS_DENIED',
  'error_param': 'INVALID_REQUEST',
  'error_server': 'SYSTEM_ERROR',
},
aliexpress: {
  '200': 'SUCCESS',
  '500': 'SYSTEM_ERROR',
  '520': 'RATE_LIMIT',
},
```

---

## 重试策略扩展

```typescript
// retry-policy.ts - PLATFORM_RETRY_CONFIGS

// 添加以下配置
'1688': {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
},
jd: {
  maxRetries: 3,
  initialDelay: 1500,
  maxDelay: 15000,
},
pinduoduo: {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
},
douyin: {
  maxRetries: 3,
  initialDelay: 2000,
  maxDelay: 20000,
},
shopee: {
  maxRetries: 5,
  initialDelay: 2000,
  maxDelay: 30000,
},
aliexpress: {
  maxRetries: 3,
  initialDelay: 1500,
  maxDelay: 15000,
},
```

---

## 测试策略

> **参考**: Amazon API 测试 (25 tests)

每个平台测试结构:

```
XxxClient.test.ts
├─ 配置验证 (3 tests)
├─ 签名算法 (2 tests)
├─ 错误处理 (3 tests)
├─ 健康检查 (2 tests)
└─ 环境变量 (1 test)
目标: 11+ tests

XxxProductApi.test.ts
├─ getProduct (3 tests)
├─ searchProducts (1 test)
├─ 数据转换 (4 tests)
├─ 特殊字段 (2 tests)
├─ 错误处理 (2 tests)
└─ 健康检查 (1 test)
目标: 12+ tests

XxxAdapter.test.ts
├─ Adapter 创建 (1 test)
├─ fetchProduct 流程 (2 tests)
├─ 降级逻辑 (2 tests)
├─ 熔断器触发 (1 test)
├─ 数据源管理 (1 test)
└─ 健康检查 (1 test)
目标: 8+ tests
```

**总测试目标**: 每平台 31+ tests，总计 186+ tests

---

## 配置管理

```bash
# .env.example

# 1688 (阿里巴巴批发)
ALIBABA_1688_APP_KEY=
ALIBABA_1688_APP_SECRET=
ALIBABA_1688_API_URL=https://gw.open.1688.com/openapi/

# JD (京东)
JD_APP_KEY=
JD_APP_SECRET=
JD_API_URL=https://api.jd.com/routerjson

# Pinduoduo (拼多多)
PINDUODUO_CLIENT_ID=
PINDUODUO_CLIENT_SECRET=
PINDUODUO_API_URL=https://gw-api.pinduoduo.com/api/router

# Douyin (抖音电商)
DOUYIN_APP_ID=
DOUYIN_APP_SECRET=
DOUYIN_API_URL=https://developer.toutiao.com/api/

# Shopee (虾皮)
SHOPEE_PARTNER_ID=
SHOPEE_PARTNER_KEY=
SHOPEE_API_URL=https://partner.shopeemobile.com/api/v2/

# AliExpress (速卖通)
ALIEXPRESS_APP_KEY=
ALIEXPRESS_APP_SECRET=
ALIEXPRESS_API_URL=https://api.aliexpress.com/
```

---

## 集成点

### Bootstrap 注册

```typescript
// src/application/bootstrap.ts

export function initializePlatform(): void {
  // 已有
  PlatformRegistry.register(taobaoAdapter);
  PlatformRegistry.register(amazonAdapter);

  // 新增
  PlatformRegistry.register(alibaba1688Adapter);
  PlatformRegistry.register(jdAdapter);
  PlatformRegistry.register(pinduoduoAdapter);
  PlatformRegistry.register(douyinAdapter);
  PlatformRegistry.register(shopeeAdapter);
  PlatformRegistry.register(aliexpressAdapter);
}
```

---

## 时间线

```
Week 1-2: 国内平台（优先级高）
├─ 1688 实现 + 测试
└─ JD 实现 + 测试

Week 3-4: 更多国内平台
├─ Pinduoduo 实现 + 测试
└─ Douyin 实现 + 测试

Week 5-6: 跨境平台
├─ Shopee 实现 + 测试
└─ AliExpress 实现 + 测试

每个平台:
├─ Day 1-2: API 客户端 + 产品 API
├─ Day 2-3: Adapter + 集成
└─ 验收: 测试通过率 > 80%
```
