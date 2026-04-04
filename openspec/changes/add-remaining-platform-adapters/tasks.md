# Implementation Tasks

## 设计原则

> **参考**: `fix-p0-storage-and-amazon` Phase 2 Amazon API 实现（4 个任务）

**关键洞察**:

- BasePlatformAdapter 已集成完整容错系统
- ErrorClassifier 只需添加配置（不是新功能）
- retry-policy 只需添加配置（不是新功能）
- 测试是验证手段，不是独立任务

**每个平台**: 4-5 个任务（参考 Amazon）

---

## Phase 1: 基础配置（所有平台共用）

- [x] 1.1 环境变量配置
  - 更新 `.env.example` 添加所有平台环境变量
  - 平台: 1688, JD, Pinduoduo, Douyin, Shopee, AliExpress

- [x] 1.2 错误映射配置
  - 更新 `ErrorClassifier.ts` 的 `PLATFORM_ERROR_MAPPINGS`
  - 添加 6 个平台的错误码映射

- [x] 1.3 重试策略配置
  - 更新 `retry-policy.ts` 的 `PLATFORM_RETRY_CONFIGS`
  - 添加 6 个平台的重试配置

---

## Phase 2: 1688 平台实现（Week 1）

> **实现模式**: 参考 Taobao（阿里系，无官方 SDK）
> **预估工作量**: ≈550 行，2-3 天

- [x] 2.1 配置和依赖管理
  - 确认 API 文档: https://open.1688.com
  - 配置环境变量:
    - `ALIBABA_1688_APP_KEY`
    - `ALIBABA_1688_APP_SECRET`
    - `ALIBABA_1688_API_URL`
  - 验证配置加载

- [x] 2.2 创建 Alibaba1688ApiClient
  - 创建 `src/infrastructure/api/alibaba/` 目录
  - 创建 `Alibaba1688ApiClient.ts` (≈200 行)
    - 配置验证
    - 签名算法（MD5 或 HMAC-SHA256）
    - HTTP 请求封装
    - 错误处理
    - 健康检查
  - 参考: `TaobaoApiClient.ts` (203 行)

- [x] 2.3 创建 Alibaba1688ProductApi
  - 创建 `Alibaba1688ProductApi.ts` (≈135 行)
    - getProduct() - 商品详情
    - searchProducts() - 商品搜索
    - transformToProductData() - 数据转换
    - 特殊字段: wholesalePrice, minOrderQuantity
  - 参考: `TaobaoProductApi.ts` (135 行)

- [x] 2.4 实现 Alibaba1688Adapter
  - 创建 `Alibaba1688Adapter.ts` (继承 BasePlatformAdapter)
  - 定义数据源:
    - alibaba_1688_official_api
    - alibaba_1688_third_party
    - alibaba_1688_crawler
  - 实现 getPlatform(), fetchProduct(), searchProducts()
  - 注册到 PlatformRegistry
  - 参考: `AmazonAdapter.ts` (171 行)

- [x] 2.5 验证
  - 运行单元测试
  - 验证测试通过率 > 80%
  - Code Review

---

## Phase 3: JD 平台实现（Week 2）

> **实现模式**: SDK 封装或自实现
> **预估工作量**: ≈300 行（SDK）或 ≈550 行（自实现），2-3 天

- [x] 3.1 配置和依赖管理
  - 调研 JD SDK 可用性
  - 安装 SDK（如果有）: `pnpm add jd-sdk`
  - 配置环境变量:
    - `JD_APP_KEY`
    - `JD_APP_SECRET`
    - `JD_API_URL`

- [x] 3.2 创建 JDClient
  - 创建 `src/infrastructure/api/jd/` 目录
  - 创建 `JDClient.ts` (≈110 行 SDK 封装 或 ≈200 行自实现)
    - OAuth 2.0 认证
    - API 调用封装
    - 错误处理
  - 参考: `AmazonSPApiClient.ts` (110 行) 或 `TaobaoApiClient.ts` (203 行)

- [x] 3.3 创建 JDProductApi
  - 创建 `JDProductApi.ts` (≈150 行)
    - getProduct() - 商品详情
    - searchProducts() - 商品搜索
    - transformToProductData()
    - 特殊字段: commissionInfo, plusPrice

- [x] 3.4 实现 JDAdapter
  - 创建 `JDAdapter.ts`
  - 定义数据源
  - 实现所有抽象方法
  - 注册到 PlatformRegistry

- [x] 3.5 验证
  - 运行单元测试
  - 验证测试通过率 > 80%
  - Code Review

---

## Phase 4: Pinduoduo 平台实现（Week 3）

> **实现模式**: 参考 Taobao（无官方 SDK）
> **预估工作量**: ≈550 行，2-3 天

- [x] 4.1 配置和依赖管理
  - 确认 API 文档: https://open.pinduoduo.com
  - 配置环境变量:
    - `PINDUODUO_CLIENT_ID`
    - `PINDUODUO_CLIENT_SECRET`
    - `PINDUODUO_API_URL`

- [x] 4.2 创建 PinduoduoClient
  - 创建 `src/infrastructure/api/pinduoduo/` 目录
  - 创建 `PinduoduoClient.ts` (≈200 行)
    - MD5 签名
    - API 调用封装
    - 错误处理
  - 参考: `TaobaoApiClient.ts` (203 行)

- [x] 4.3 创建 PinduoduoProductApi
  - 创建 `PinduoduoProductApi.ts` (≈135 行)
    - getProduct() - 商品详情
    - searchProducts() - 商品搜索
    - 特殊字段: groupPrice, groupRequiredNum

- [x] 4.4 实现 PinduoduoAdapter
  - 创建 `PinduoduoAdapter.ts`
  - 定义数据源
  - 注册到 PlatformRegistry

- [x] 4.5 验证
  - 运行单元测试
  - 验证测试通过率 > 80%
  - Code Review

---

## Phase 5: Douyin 平台实现（Week 3-4）

> **实现模式**: 参考 Taobao（无官方 SDK）
> **预估工作量**: ≈550 行，2-3 天

- [x] 5.1 配置和依赖管理
  - 确认 API 文档: https://developer.open-douyin.com
  - 配置环境变量:
    - `DOUYIN_APP_ID`
    - `DOUYIN_APP_SECRET`
    - `DOUYIN_API_URL`

- [x] 5.2 创建 DouyinClient
  - 创建 `src/infrastructure/api/douyin/` 目录
  - 创建 `DouyinClient.ts` (≈200 行)
    - OAuth 2.0 认证
    - SHA256 签名
    - API 调用封装
  - 参考: `TaobaoApiClient.ts` (203 行)

- [x] 5.3 创建 DouyinProductApi
  - 创建 `DouyinProductApi.ts` (≈135 行)
    - getProduct() - 商品详情
    - searchProducts() - 商品搜索
    - 特殊字段: livePrice, videoUrl

- [x] 5.4 实现 DouyinAdapter
  - 创建 `DouyinAdapter.ts`
  - 定义数据源
  - 注册到 PlatformRegistry

- [x] 5.5 验证
  - 运行单元测试
  - 验证测试通过率 > 80%
  - Code Review

---

## Phase 6: Shopee 平台实现（Week 5）

> **实现模式**: SDK 封装或自实现
> **预估工作量**: ≈300 行（SDK）或 ≈550 行（自实现），2-3 天

- [x] 6.1 配置和依赖管理
  - 调研 Shopee SDK 可用性
  - 配置环境变量:
    - `SHOPEE_PARTNER_ID`
    - `SHOPEE_PARTNER_KEY`
    - `SHOPEE_API_URL`

- [x] 6.2 创建 ShopeeClient
  - 创建 `src/infrastructure/api/shopee/` 目录
  - 创建 `ShopeeClient.ts` (≈110-200 行)
    - Partner ID, Key 认证
    - HMAC-SHA256 签名
    - 多站点支持
  - 参考: `AmazonSPApiClient.ts` (110 行) 或 `TaobaoApiClient.ts` (203 行)

- [x] 6.3 创建 ShopeeProductApi
  - 创建 `ShopeeProductApi.ts` (≈150 行)
    - getProduct() - 商品详情
    - searchProducts() - 商品搜索
    - 特殊字段: shipToCountries, deliveryTime

- [x] 6.4 实现 ShopeeAdapter
  - 创建 `ShopeeAdapter.ts`
  - 定义数据源
  - 注册到 PlatformRegistry

- [x] 6.5 验证
  - 运行单元测试
  - 验证测试通过率 > 80%
  - Code Review

---

## Phase 7: AliExpress 平台实现（Week 5-6）

> **实现模式**: 参考 Taobao（阿里系，无官方 SDK）
> **预估工作量**: ≈550 行，2-3 天

- [x] 7.1 配置和依赖管理
  - 确认 API 文档: https://developers.aliexpress.com
  - 配置环境变量:
    - `ALIEXPRESS_APP_KEY`
    - `ALIEXPRESS_APP_SECRET`
    - `ALIEXPRESS_API_URL`

- [x] 7.2 创建 AliExpressClient
  - 创建 `src/infrastructure/api/aliexpress/` 目录
  - 创建 `AliExpressClient.ts` (≈200 行)
    - appKey, appSecret 认证
    - 签名算法
    - 多语言支持
  - 参考: `TaobaoApiClient.ts` (203 行)

- [x] 7.3 创建 AliExpressProductApi
  - 创建 `AliExpressProductApi.ts` (≈135 行)
    - getProduct() - 商品详情
    - searchProducts() - 商品搜索
    - 特殊字段: shipToCountries, discountRate

- [x] 7.4 实现 AliExpressAdapter
  - 创建 `AliExpressAdapter.ts`
  - 定义数据源
  - 注册到 PlatformRegistry

- [x] 7.5 验证
  - 运行单元测试
  - 验证测试通过率 > 80%
  - Code Review

---

## Phase 8: 最终验证与文档（Week 6）

- [x] 8.1 全量测试
  - 运行所有平台测试: `pnpm test`
  - 验证整体测试通过率 > 80%
  - 验证所有平台注册成功

- [x] 8.2 文档更新
  - 更新 `INFRASTRUCTURE.md`
    - 更新平台状态（全部 ✅）
    - 更新代码行数统计
    - 添加各平台 API 位置
  - 更新 `README.md`
    - 更新支持平台列表
    - 添加配置说明

- [x] 8.3 最终审查
  - Code Review 全部平台实现
  - 安全审查（API 密钥管理）
  - 错误处理审查
  - 文档完整性检查

---

## Summary

**总计任务**: 43 tasks

**对比**:

- 原设计: 103 tasks（过度拆分）
- 新设计: 43 tasks（参考 Amazon 模式）
- 减少: 60 tasks (58%)

**预估时间**: 5-6 weeks

**里程碑**:

- Week 1: 1688 完成
- Week 2: JD 完成
- Week 3: Pinduoduo 完成
- Week 4: Douyin 完成
- Week 5: Shopee 完成
- Week 6: AliExpress 完成 + 最终验证

**复用基础设施**:

- ✅ BasePlatformAdapter (253 行)
- ✅ 容错系统 (1553 行)
- ✅ 存储层 (1307 行)
- ✅ 缓存层 (444 行)
- ✅ 重试策略 (81 行)

**新增代码量估算**:

- 1688: ≈550 行
- JD: ≈300-550 行
- Pinduoduo: ≈550 行
- Douyin: ≈550 行
- Shopee: ≈300-550 行
- AliExpress: ≈550 行
- **总计**: ≈3000-3600 行
