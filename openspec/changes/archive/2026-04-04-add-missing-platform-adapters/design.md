# Design: Add Missing Platform Adapters

## 架构概述

所有平台继承 `BasePlatformAdapter`，复用完整的容错系统。

**设计原则**: 所有 5 个平台独立实现，不复用现有 Adapter 代码。

---

## 平台特定设计

### 1. TikTok Shop (TK) - 抖音海外版电商

**实现模式**: 参考 DouyinClient 结构，独立实现

```
API 特点:
├─ TikTok Shop Open Platform
│  └─ https://partner.tiktokshop.com/
├─ OAuth 2.0 认证
├─ HMAC-SHA256 签名
└─ 多市场支持 (US, UK, MY, PH, TH, VN, SG)

数据源配置:
├─ tiktok_shop_official_api (优先级 1)
├─ tiktok_shop_third_party (优先级 2)
└─ tiktok_shop_crawler (优先级 3)

特殊字段 → extraData:
├─ shopRegion: 店铺区域 (US/UK/MY...)
├─ tiktokShopId: TikTok Shop ID
├─ creatorInfo: 达人信息
│  ├─ creatorId
│  ├─ creatorName
│  └─ followerCount
├─ liveStreamInfo: 直播信息
│  ├─ liveId
│  ├─ liveViews
│  └─ livePrice
└─ videoInfo: 短视频信息
   ├─ videoId
   └─ videoViews

错误映射:
├─ '10000' → 'SYSTEM_ERROR'
├─ '10001' → 'ACCESS_DENIED'
├─ '10002' → 'RATE_LIMIT'
├─ '10003' → 'INVALID_REQUEST'
└─ '10004' → 'NOT_FOUND'

主要 API:
├─ /api/products/detail (商品详情)
├─ /api/products/search (商品搜索)
└─ /api/products/list (商品列表)
```

**参考**: DouyinClient.ts (218 行) 结构相似

---

### 2. Lazada - 阿里系东南亚平台

**实现模式**: 参考 AliExpressClient 结构，独立实现

```
API 特点:
├─ Lazada Open Platform
│  └─ https://open.lazada.com/
├─ appKey, appSecret 认证
├─ 签名算法: HMAC-SHA256
└─ 多站点支持 (MY, SG, TH, PH, ID, VN)

数据源配置:
├─ lazada_official_api (优先级 1)
├─ lazada_third_party (优先级 2)
└─ lazada_crawler (优先级 3)

特殊字段 → extraData:
├─ shopLocation: 店铺位置
├─ lazadaMall: Lazada Mall 标识
├─ countryCode: 国家代码
├─ currency: 多币种 (MYR/SGD/THB/PHP/IDR/VND)
├─ ratingScore: 评分
├─ brandOfficial: 品牌官方标识
└─ sellerType: 卖家类型

错误映射:
├─ 'InvalidAccessKeyId' → 'ACCESS_DENIED'
├─ 'SignatureMismatch' → 'ACCESS_DENIED'
├─ 'InvalidParameters' → 'INVALID_REQUEST'
├─ 'InternalError' → 'SYSTEM_ERROR'
├─ 'RateLimitExceeded' → 'RATE_LIMIT'
└─ 'ItemNotFound' → 'NOT_FOUND'

主要 API:
├─ /products/get (商品详情)
├─ /products/search (商品搜索)
├─ /products/get_item_list (商品列表)
└─ /seller/get (卖家信息)
```

**参考**: AliExpressClient.ts (210 行) 结构相似

---

### 3. TUME - 跨境电商平台

**实现模式**: 参考 TaobaoApiClient 结构，独立实现

```
API 特点:
├─ TUME Open Platform
│  └─ https://open.tume.com/ (待确认)
├─ appKey, appSecret 认证
├─ 签名算法: MD5 或 HMAC-SHA256 (待确认)
└─ 跨境物流支持

数据源配置:
├─ tume_official_api (优先级 1)
├─ tume_third_party (优先级 2)
└─ tume_crawler (优先级 3)

特殊字段 → extraData:
├─ shipToCountries: 配送国家
├─ deliveryTime: 配送时间 (天)
├─ customsInfo: 清关信息
│  ├─ hsCode
│  └─ customsCategory
├─ wholesalePrice: 批发价
├─ moq: 最小起订量
├─ originCountry: 原产国
└─ warehouseLocation: 仓库位置

错误映射:
├─ '1000' → 'SYSTEM_ERROR'
├─ '2000' → 'ACCESS_DENIED'
├─ '3000' → 'RATE_LIMIT'
├─ '4000' → 'INVALID_REQUEST'
└─ '5000' → 'NOT_FOUND'

主要 API:
├─ product.detail (商品详情)
├─ product.search (商品搜索)
├─ product.list (商品列表)
└─ logistics.query (物流查询)
```

**参考**: TaobaoApiClient.ts (203 行) 结构相似

---

### 4. 天猫 (Tmall) - 独立实现

**实现模式**: 使用淘宝 API，独立 Adapter 实现

```
实现方式:
├─ 使用淘宝开放平台 API
├─ 通过 user_type 字段过滤天猫商品
│  ├─ user_type = 1: 天猫店铺
│  └─ user_type = 0: 淘宝店铺
└─ 独立 TmallAdapter + TmallProductApi

API 配置:
├─ 复用 TAOBAO_APP_KEY/SECRET (同淘宝)
├─ 调用相同 API 但过滤天猫商品
└─ 增加天猫特有字段映射

数据源配置:
├─ tmall_taobao_api (优先级 1) - 淘宝 API 天猫商品
├─ tmall_third_party (优先级 2)
└─ tmall_crawler (优先级 3)

特殊字段 → extraData:
├─ isTmall: true (固定值)
├─ brandAuth: 品牌授权
│  ├─ brandName
│  ├─ brandLogo
│  └─ authStatus
├─ flagshipStore: 旗舰店标识
├─ tmallLevel: 天猫等级 (T1-T7)
├─ brandLicense: 品牌授权证
├─ serviceScore: 服务评分
├─ logisticsScore: 物流评分
└─ brandOfficial: 品牌官方店标识

商品过滤逻辑:
├─ API 响应中 user_type = 1 的商品
├─ 店铺类型 = "B" (天猫店铺)
└─ 标题/属性中包含 "天猫" 标识
```

**参考**: TaobaoAdapter.ts (288 行) + 商品过滤逻辑

---

### 5. 淘工厂 (TaoGongChang) - 独立实现

**实现模式**: 使用 1688 API，独立 Adapter 实现

```
实现方式:
├─ 使用 1688 开放平台 API
├─ 通过商品标签/属性过滤淘工厂商品
│  ├─ tag = "淘工厂"
│  └─ productType = "FACTORY_DIRECT"
└─ 独立 TaoGongChangAdapter + TaoGongChangProductApi

API 配置:
├─ 复用 ALIBABA_1688_APP_KEY/SECRET (同 1688)
├─ 调用相同 API 但过滤淘工厂商品
└─ 增加淘工厂特有字段映射

数据源配置:
├─ taogongchang_1688_api (优先级 1) - 1688 API 淘工厂商品
├─ taogongchang_third_party (优先级 2)
└─ taogongchang_crawler (优先级 3)

特殊字段 → extraData:
├─ isTaoGongChang: true (固定值)
├─ factoryDirect: 工厂直供标识
├─ customization: 定制能力
│  ├─ supportOEM: 支持 OEM
│  ├─ supportODM: 支持 ODM
│  └─ customizationTypes: 定制类型列表
├─ moq: 最小起订量
├─ leadTime: 交货周期 (天)
├─ factoryCert: 工厂认证
│  ├─ iso9001
│  ├─ iso14001
│  └─ otherCerts
├─ productionCapacity: 产能
└─ factoryLocation: 工厂位置

商品过滤逻辑:
├─ API 响应中 tag 包含 "淘工厂" 的商品
├─ productType = "FACTORY_DIRECT"
└─ supplierType = "FACTORY"
```

**参考**: Alibaba1688Adapter.ts (196 行) + 商品过滤逻辑

---

## 类型扩展

```typescript
// src/domain/types.ts

export type Platform =
  | "taobao"
  | "amazon"
  | "douyin"
  | "1688"
  | "shopee"
  | "pinduoduo"
  | "jd"
  | "aliexpress"
  | "tiktok_shop" // 新增
  | "lazada" // 新增
  | "tume" // 新增
  | "tmall" // 新增
  | "taogongchang"; // 新增

export const PLATFORM_NAMES: Record<Platform, string> = {
  // ... 现有平台
  tiktok_shop: "TikTok Shop",
  lazada: "Lazada",
  tume: "TUME",
  tmall: "天猫",
  taogongchang: "淘工厂",
};

export const PLATFORM_CURRENCIES: Record<Platform, string> = {
  // ... 现有平台
  tiktok_shop: "USD", // 多市场支持，默认 USD
  lazada: "SGD", // 多市场支持，默认 SGD
  tume: "CNY",
  tmall: "CNY",
  taogongchang: "CNY",
};
```

---

## 文件结构

```
extensions/meichao-ecom/src/infrastructure/api/
├─ tiktok-shop/
│  ├─ TikTokShopClient.ts        (≈220 行)
│  ├─ TikTokShopClient.test.ts   (≈130 行)
│  ├─ TikTokShopProductApi.ts    (≈160 行)
│  └─ TikTokShopProductApi.test.ts (≈230 行)
│
├─ lazada/
│  ├─ LazadaClient.ts            (≈220 行)
│  ├─ LazadaClient.test.ts       (≈130 行)
│  ├─ LazadaProductApi.ts        (≈160 行)
│  └─ LazadaProductApi.test.ts   (≈230 行)
│
├─ tume/
│  ├─ TumeClient.ts              (≈220 行)
│  ├─ TumeClient.test.ts         (≈130 行)
│  ├─ TumeProductApi.ts          (≈160 行)
│  └─ TumeProductApi.test.ts     (≈230 行)
│
├─ tmall/
│  ├─ TmallClient.ts             (≈180 行) - 复用淘宝 API
│  ├─ TmallClient.test.ts        (≈100 行)
│  ├─ TmallProductApi.ts         (≈170 行) - 包含过滤逻辑
│  └─ TmallProductApi.test.ts    (≈200 行)
│
└─ taogongchang/
   ├─ TaoGongChangClient.ts      (≈180 行) - 复用 1688 API
   ├─ TaoGongChangClient.test.ts (≈100 行)
   ├─ TaoGongChangProductApi.ts  (≈170 行) - 包含过滤逻辑
   └─ TaoGongChangProductApi.test.ts (≈200 行)

extensions/meichao-ecom/src/infrastructure/adapters/
├─ TikTokShopAdapter.ts          (≈195 行)
├─ LazadaAdapter.ts              (≈195 行)
├─ TumeAdapter.ts                (≈195 行)
├─ TmallAdapter.ts               (≈195 行)
└─ TaoGongChangAdapter.ts        (≈195 行)
```

---

## 配置扩展

### 环境变量 (.env.example)

```bash
# TikTok Shop
TIKTOK_SHOP_APP_KEY=
TIKTOK_SHOP_APP_SECRET=
TIKTOK_SHOP_API_URL=https://open-api.tiktokglobalshop.com/
# Optional: Market region (US, UK, MY, PH, TH, VN, SG)
TIKTOK_SHOP_REGION=US
# Optional: Request timeout (defaults to 30000)
TIKTOK_SHOP_API_TIMEOUT=

# Lazada
LAZADA_APP_KEY=
LAZADA_APP_SECRET=
LAZADA_API_URL=https://api.lazada.com.my/rest
# Optional: Country code (MY, SG, TH, PH, ID, VN)
LAZADA_COUNTRY=SG
# Optional: Request timeout (defaults to 30000)
LAZADA_API_TIMEOUT=

# TUME
TUME_APP_KEY=
TUME_APP_SECRET=
TUME_API_URL=https://api.tume.com/
# Optional: Request timeout (defaults to 30000)
TUME_API_TIMEOUT=

# 天猫 (复用淘宝配置)
# Uses TAOBAO_APP_KEY and TAOBAO_APP_SECRET
# 无需额外配置

# 淘工厂 (复用 1688 配置)
# Uses ALIBABA_1688_APP_KEY and ALIBABA_1688_APP_SECRET
# 无需额外配置
```

### 错误映射 (ErrorClassifier.ts)

```typescript
const PLATFORM_ERROR_MAPPINGS = {
  // ... 现有平台

  tiktok_shop: {
    codes: {
      "10000": "overloaded",
      "10001": "auth",
      "10002": "rate_limit",
      "10003": "unknown",
      "10004": "not_found",
    },
    patterns: [
      { pattern: /access.*denied/i, reason: "auth" },
      { pattern: /rate.*limit/i, reason: "rate_limit" },
      { pattern: /not.*found/i, reason: "not_found" },
    ],
  },

  lazada: {
    codes: {
      InvalidAccessKeyId: "auth",
      SignatureMismatch: "auth",
      InvalidParameters: "unknown",
      InternalError: "overloaded",
      RateLimitExceeded: "rate_limit",
    },
    patterns: [
      { pattern: /invalid.*key/i, reason: "auth" },
      { pattern: /rate.*limit/i, reason: "rate_limit" },
    ],
  },

  tume: {
    codes: {
      "1000": "overloaded",
      "2000": "auth",
      "3000": "rate_limit",
      "4000": "unknown",
      "5000": "not_found",
    },
    patterns: [
      { pattern: /unauthorized/i, reason: "auth" },
      { pattern: /rate.*limit/i, reason: "rate_limit" },
    ],
  },

  tmall: {
    // 复用淘宝错误映射
    codes: {
      "isp.session-not-exist": "auth",
      "isp.session-expired": "auth",
      "isp.rate-limit-exceeded": "rate_limit",
      "isp.item-not-found": "not_found",
    },
    patterns: [
      { pattern: /session/i, reason: "auth" },
      { pattern: /rate.*limit/i, reason: "rate_limit" },
    ],
  },

  taogongchang: {
    // 复用 1688 错误映射
    codes: {
      "system.error": "overloaded",
      "insufficient.permissions": "auth",
      "item.not.exist": "not_found",
      "rate.limit.exceeded": "rate_limit",
    },
    patterns: [
      { pattern: /permission/i, reason: "auth" },
      { pattern: /rate.*limit/i, reason: "rate_limit" },
    ],
  },
};
```

### 重试策略 (retry-policy.ts)

```typescript
// 新增重试配置
export const TIKTOK_SHOP_RETRY_DEFAULTS: Required<RetryConfig> = {
  attempts: 3,
  minDelayMs: 1000,
  maxDelayMs: 60_000,
  jitter: 0.1,
};

export const LAZADA_RETRY_DEFAULTS: Required<RetryConfig> = {
  attempts: 3,
  minDelayMs: 1000,
  maxDelayMs: 60_000,
  jitter: 0.1,
};

export const TUME_RETRY_DEFAULTS: Required<RetryConfig> = {
  attempts: 3,
  minDelayMs: 500,
  maxDelayMs: 30_000,
  jitter: 0.1,
};

export const TMALL_RETRY_DEFAULTS: Required<RetryConfig> = {
  attempts: 3,
  minDelayMs: 500,
  maxDelayMs: 30_000,
  jitter: 0.1,
};

export const TAOGONGCHANG_RETRY_DEFAULTS: Required<RetryConfig> = {
  attempts: 3,
  minDelayMs: 500,
  maxDelayMs: 30_000,
  jitter: 0.1,
};

// 新增创建函数
export function createTikTokShopRetryRunner(params?: { ... }): RetryRunner { ... }
export function createLazadaRetryRunner(params?: { ... }): RetryRunner { ... }
export function createTumeRetryRunner(params?: { ... }): RetryRunner { ... }
export function createTmallRetryRunner(params?: { ... }): RetryRunner { ... }
export function createTaoGongChangRetryRunner(params?: { ... }): RetryRunner { ... }
```

---

## 测试目标

每个平台测试结构：

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

**总测试目标**: 155+ tests

---

## 工作量估算

| 平台        | Client   | ProductApi | Adapter | 测试     | 总计         |
| ----------- | -------- | ---------- | ------- | -------- | ------------ |
| TikTok Shop | ≈220 行  | ≈160 行    | ≈195 行 | ≈360 行  | ≈935 行      |
| Lazada      | ≈220 行  | ≈160 行    | ≈195 行 | ≈360 行  | ≈935 行      |
| TUME        | ≈220 行  | ≈160 行    | ≈195 行 | ≈360 行  | ≈935 行      |
| 天猫        | ≈180 行  | ≈170 行    | ≈195 行 | ≈300 行  | ≈845 行      |
| 淘工厂      | ≈180 行  | ≈170 行    | ≈195 行 | ≈300 行  | ≈845 行      |
| **总计**    | ≈1020 行 | ≈820 行    | ≈975 行 | ≈1680 行 | **≈4495 行** |

---

## Bootstrap 注册

```typescript
// src/application/bootstrap.ts

import { TikTokShopAdapter } from "../infrastructure/adapters/TikTokShopAdapter.js";
import { LazadaAdapter } from "../infrastructure/adapters/LazadaAdapter.js";
import { TumeAdapter } from "../infrastructure/adapters/TumeAdapter.js";
import { TmallAdapter } from "../infrastructure/adapters/TmallAdapter.js";
import { TaoGongChangAdapter } from "../infrastructure/adapters/TaoGongChangAdapter.js";

export async function initializePlatform(): Promise<void> {
  // ... 现有平台注册

  PlatformRegistry.register(TikTokShopAdapter.create());
  PlatformRegistry.register(LazadaAdapter.create());
  PlatformRegistry.register(TumeAdapter.create());
  PlatformRegistry.register(TmallAdapter.create());
  PlatformRegistry.register(TaoGongChangAdapter.create());
}
```

---

## 复用基础设施

```
✅ 自动继承 (BasePlatformAdapter):
├─ CircuitBreaker 熔断器
├─ DegradationExecutor 降级执行
├─ CooldownManager 冷却管理
├─ DecisionLogger 决策日志
└─ RetryRunner 重试策略

✅ 只需配置扩展:
├─ ErrorClassifier 错误映射
├─ retry-policy.ts 重试配置
└─ PlatformRegistry 平台注册

❌ 不要重复实现:
├─ 事务管理 (TransactionManager)
├─ 存储层 (ProductRepository)
├─ 缓存层 (CacheProvider)
└─ 容错系统 (1553 行)
```
