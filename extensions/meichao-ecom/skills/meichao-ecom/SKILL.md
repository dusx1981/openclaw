---
name: meichao-ecom
description: 跨境电商数据采集工具，支持商品抓取、搜索和平台验证。
metadata:
  {
    "openclaw":
      { "emoji": "🛒", "requires": { "config": ["plugins.entries.meichao-ecom.enabled"] } },
  }
---

# 美潮电商工具

## 工具选择指南

| 需求             | 工具                     | 使用场景                      |
| ---------------- | ------------------------ | ----------------------------- |
| 获取特定商品详情 | `ecom-product-fetch`     | 已有平台+商品ID，需要完整信息 |
| 按关键词搜索商品 | `ecom-product-search`    | 市场调研、商品发现、爆款挖掘  |
| 检查平台健康状态 | `ecom-validate-platform` | 批量操作前检查、排查数据问题  |

## 平台 ID 格式

| 平台       | ID 格式    | 示例          |
| ---------- | ---------- | ------------- |
| 淘宝       | 商品 ID    | `12345`       |
| Amazon     | ASIN       | `B0ABC123`    |
| 抖音       | 商品 ID    | `prod_abc123` |
| 1688       | Offer ID   | `offer_12345` |
| Shopee     | Item ID    | `item.12345`  |
| 拼多多     | 商品 ID    | `goods_12345` |
| 京东       | SKU ID     | `sku_12345`   |
| AliExpress | Product ID | `prod_12345`  |

## ecom-product-fetch

获取单个商品的详细数据。返回标题、价格、销量、评分、店铺信息和来源链接。

**默认跳过爬虫**，只使用官方和第三方 API，保证数据质量。

| 参数          | 描述                            | 必填 |
| ------------- | ------------------------------- | ---- |
| `platform`    | 平台名称：`taobao`、`amazon` 等 | 是   |
| `productId`   | 平台特定的商品 ID（见上表）     | 是   |
| `degradation` | 降级配置（默认跳过爬虫）        | 否   |

### degradation 参数

控制数据源降级行为，支持预设模板和自定义选项：

| 子参数            | 描述                                                                           |
| ----------------- | ------------------------------------------------------------------------------ |
| `preset`          | 预设模板：`standard`、`cost-optimized`、`speed-optimized`、`reliability-first` |
| `skipTypes`       | 跳过的数据源类型数组：`["skill_crawler", "open_search"]`                       |
| `maxSources`      | 最大尝试数据源数量（1-4，默认 3）                                              |
| `allowCrawler`    | 是否允许爬虫数据源（默认 true）                                                |
| `allowOpenSearch` | 是否允许开放搜索（默认 true）                                                  |
| `customOrder`     | 自定义数据源类型顺序：`["third_party_api", "official_api"]`                    |
| `preferredSource` | 优先使用的数据源 ID：`"taobao_official_api"`                                   |
| `skipSources`     | 跳过的数据源 ID 数组：`["taobao_crawler"]`                                     |

#### 预设模板

| 模板                | 数据源路径                                                   | 适用场景             |
| ------------------- | ------------------------------------------------------------ | -------------------- |
| `standard`          | official_api → third_party_api → skill_crawler → open_search | 默认，全路径         |
| `cost-optimized`    | official_api → skill_crawler → open_search                   | 跳过付费 API，省钱   |
| `speed-optimized`   | third_party_api → official_api → open_search                 | 优先快速响应源       |
| `reliability-first` | official_api → third_party_api                               | 只用可靠源，跳过爬虫 |

### 使用技巧

- **去除 ID 前后空格** — 处理用户输入错误
- **确认平台支持** — 目前只有淘宝和 Amazon 有活跃的适配器
- **优雅处理缺失商品** — 部分 ID 可能已下架或删除
- **使用结果中的 `sourceUrl`** — 为用户提供原始商品链接
- **用 `cost-optimized` 省钱** — 跳过付费的第三方 API
- **用 `speed-optimized` 加速** — 优先使用响应快的源
- **用 `reliability-first` 保质量** — 只使用可靠的官方和第三方 API

### 高级用法示例

**自定义降级顺序**：

```json
{
  "platform": "taobao",
  "productId": "12345",
  "degradation": {
    "customOrder": ["third_party_api", "official_api"]
  }
}
```

**优先使用特定数据源**：

```json
{
  "platform": "taobao",
  "productId": "12345",
  "degradation": {
    "preferredSource": "taobao_third_party"
  }
}
```

**跳过特定数据源**：

```json
{
  "platform": "taobao",
  "productId": "12345",
  "degradation": {
    "skipSources": ["taobao_crawler", "taobao_open_search"]
  }
}
```

## ecom-product-search

按关键词搜索商品。返回标题、价格、销量、评分、店铺名称和来源链接。

**默认跳过爬虫**，只使用官方和第三方 API，保证数据质量。

| 参数          | 描述                            | 必填 |
| ------------- | ------------------------------- | ---- |
| `platform`    | 平台名称：`taobao`、`amazon` 等 | 是   |
| `keyword`     | 搜索关键词或商品名称            | 是   |
| `limit`       | 最大结果数（默认 50，最大 100） | 否   |
| `degradation` | 降级配置（默认跳过爬虫）        | 否   |

### 使用技巧

- **使用具体关键词** — 宽泛的词会返回大量无关结果
- **合理设置 `limit`** — 快速查询用 20-30，深度调研用 50-100
- **筛选 `isTrending`** — 爆款商品反映市场需求
- **跨平台对比** — 用不同的 `platform` 参数多次调用
- **用 `preset` 优化** — 批量搜索时用 `speed-optimized` 加速
- **跳过爬虫** — 用 `preset: "reliability-first"` 或 `allowCrawler: false`

## ecom-validate-platform

验证数据采集能力。批量操作前或排查数据缺失时使用。

| 参数       | 描述                               | 必填 |
| ---------- | ---------------------------------- | ---- |
| `platform` | 要验证的平台（省略则验证所有平台） | 否   |
| `count`    | 验证请求数（默认 10，最大 100）    | 否   |

### 输出内容

- **成功率** — 成功请求的百分比
- **分来源统计** — 按数据源拆分（API、爬虫、缓存）
- **降级路径** — 使用了哪些备用源
- **示例商品** — 成功获取的商品样例

### 使用技巧

- **批量抓取前运行** — 确保平台健康
- **用 `count=10` 快速检查** — 更快的验证
- **用 `count=50+` 深度测试** — 发现边缘情况
- **检查 `degradation.paths`** — 了解备用源的可靠性

## 工作流

### 市场调研

1. 用目标关键词在各平台搜索商品
2. 对比结果中的价格、销量、评分
3. 识别高销量增速的爆款商品
4. 数据异常时验证平台健康状态

```
ecom-product-search(
  platform="taobao",
  keyword="零食",
  limit=50,
  degradation={ preset: "reliability-first" }
)
ecom-product-search(
  platform="amazon",
  keyword="snacks",
  limit=50,
  degradation={ preset: "reliability-first" }
)
ecom-product-validate(platform="taobao", count=10)
```

### 单品分析

1. 用已知 ID 获取商品详情
2. 查看定价、销量历史、店铺信誉
3. 通过搜索查看竞品情况
4. 在其他平台交叉验证

```
ecom-product-fetch(
  platform="taobao",
  productId="12345",
  degradation={ preset: "reliability-first" }
)
ecom-product-search(
  platform="taobao",
  keyword="<商品标题关键词>",
  limit=20,
  degradation={ preset: "reliability-first" }
)
```

### 平台健康检查

1. 大规模操作前验证所有平台
2. 查看成功率和降级路径
3. 识别失败的数据源
4. 健康状态可接受后再执行抓取/搜索

```
ecom-product-validate(count=20)
```

### 成本优化抓取

跳过付费第三方 API，进一步节省成本：

```
ecom-product-fetch(
  platform="taobao",
  productId="12345",
  degradation={ preset: "cost-optimized" }
)
```

### 快速搜索

优先使用响应快的数据源：

```
ecom-product-search(
  platform="taobao",
  keyword="爆款",
  limit=20,
  degradation={ preset: "speed-optimized" }
)
```

### 启用爬虫（不推荐）

如需启用爬虫，显式设置 `allowCrawler: true`：

```
ecom-product-search(
  platform="taobao",
  keyword="零食",
  degradation={ allowCrawler: true }
)
```

## 降级机制

系统使用多个数据源，支持自动降级和可配置的降级策略。

**默认行为**：跳过爬虫，只使用官方和第三方 API，保证数据质量。

### 数据源优先级

**默认降级路径（推荐）**：

```
official_api → third_party_api → open_search
（跳过 skill_crawler）
```

**完整降级路径（需显式启用）**：

```
┌──────────────────────────────────────────────────────────────┐
│                    完整降级路径（CORE_ORDER）                 │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│   │ official_api │───▶│third_party  │───▶│skill_crawler│     │
│   │   优先级 1   │    │   优先级 2   │    │   优先级 3   │     │
│   └─────────────┘    └─────────────┘    └─────────────┘     │
│          │                  │                   │           │
│          │                  │                   │           │
│          ▼                  ▼                   ▼           │
│   ┌─────────────────────────────────────────────────┐       │
│   │                open_search (优先级 4)            │       │
│   │         最后降级：Bing / Tavily 开放搜索          │       │
│   └─────────────────────────────────────────────────┘       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

| 数据源类型      | 优先级 | 特点               | 配额/限制      |
| --------------- | ------ | ------------------ | -------------- |
| official_api    | 1      | 最可靠，官方数据   | 有日配额限制   |
| third_party_api | 2      | 覆盖好，第三方服务 | 可能有频率限制 |
| skill_crawler   | 3      | 备用方案，网页爬虫 | 较慢但全面     |
| open_search     | 4      | 最后降级，开放搜索 | 数据质量中等   |

### 降级结果字段

当调用返回时，检查以下字段了解降级状态：

| 字段               | 描述                                             |
| ------------------ | ------------------------------------------------ |
| `source`           | 实际使用的数据源 ID                              |
| `degradationLevel` | `primary_source` 或 `fallback_source` 或 `error` |
| `isDegraded`       | 是否使用了备用源                                 |
| `attempts`         | 所有尝试过的数据源列表                           |

### 冷却机制

数据源失败后会进入冷却期，期间跳过该源：

| 错误类型         | 冷却时间                        |
| ---------------- | ------------------------------- |
| 普通错误（限流） | 1分钟 → 5分钟 → 15分钟 → 30分钟 |
| 严重错误（认证） | 1小时 → 2小时 → 4小时 → 24小时  |

**冷却窗口保持**：如果数据源已在冷却中再次失败，只增加错误计数，不延长冷却时间。

### 开放搜索降级

当所有 API 和爬虫数据源都失败时，系统会自动降级到开放搜索：

- **Bing Shopping Search** — 使用 Bing API 搜索商品页面
- **Tavily Search** — 使用 Tavily API 作为备选

开放搜索返回的数据质量较低（`dataQuality: "medium"`），建议仅在主数据源不可用时使用。

**配置方式：**

```bash
# 设置 Bing API Key（免费层 1000 次/月）
export BING_API_KEY="your-bing-api-key"

# Tavily 通过 OpenClaw 的 tavily 插件配置
# 配置路径: plugins.entries.tavily.config.webSearch.apiKey
```

## 错误处理

| 错误                      | 原因             | 处理方式                 |
| ------------------------- | ---------------- | ------------------------ |
| `Unsupported platform`    | 平台未注册       | 查看支持的平台列表       |
| `platform is required`    | 缺少平台参数     | 提供平台名称             |
| `productId is required`   | 缺少商品 ID      | 提供平台特定的商品 ID    |
| `Failed to fetch product` | API 错误或无数据 | 验证平台，重试           |
| `No validator registered` | 平台缺少验证器   | 只有淘宝/Amazon 有验证器 |

## 选择合适的工作流

1. **单品查询** — 用 `ecom-product-fetch`，提供平台 + ID
2. **市场调研** — 用 `ecom-product-search`，提供关键词 + 平台
3. **健康检查** — 在操作前后用 `ecom-validate-platform`

通过搜索发现商品后，如需详细信息，可结合 search + fetch 使用。
