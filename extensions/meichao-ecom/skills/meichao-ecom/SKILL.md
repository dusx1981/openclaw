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

| 参数        | 描述                            | 必填 |
| ----------- | ------------------------------- | ---- |
| `platform`  | 平台名称：`taobao`、`amazon` 等 | 是   |
| `productId` | 平台特定的商品 ID（见上表）     | 是   |

### 使用技巧

- **去除 ID 前后空格** — 处理用户输入错误
- **确认平台支持** — 目前只有淘宝和 Amazon 有活跃的适配器
- **优雅处理缺失商品** — 部分 ID 可能已下架或删除
- **使用结果中的 `sourceUrl`** — 为用户提供原始商品链接

## ecom-product-search

按关键词搜索商品。返回标题、价格、销量、评分、店铺名称和来源链接。

| 参数       | 描述                            | 必填 |
| ---------- | ------------------------------- | ---- |
| `platform` | 平台名称：`taobao`、`amazon` 等 | 是   |
| `keyword`  | 搜索关键词或商品名称            | 是   |
| `limit`    | 最大结果数（默认 50，最大 100） | 否   |

### 使用技巧

- **使用具体关键词** — 宽泛的词会返回大量无关结果
- **合理设置 `limit`** — 快速查询用 20-30，深度调研用 50-100
- **筛选 `isTrending`** — 爆款商品反映市场需求
- **跨平台对比** — 用不同的 `platform` 参数多次调用

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
ecom-product-search(platform="taobao", keyword="零食", limit=50)
ecom-product-search(platform="amazon", keyword="snacks", limit=50)
ecom-validate-platform(platform="taobao", count=10)
```

### 单品分析

1. 用已知 ID 获取商品详情
2. 查看定价、销量历史、店铺信誉
3. 通过搜索查看竞品情况
4. 在其他平台交叉验证

```
ecom-product-fetch(platform="taobao", productId="12345")
ecom-product-search(platform="taobao", keyword="<商品标题关键词>", limit=20)
```

### 平台健康检查

1. 大规模操作前验证所有平台
2. 查看成功率和降级路径
3. 识别失败的数据源
4. 健康状态可接受后再执行抓取/搜索

```
ecom-validate-platform(count=20)
```

## 降级机制

系统使用多个数据源，支持自动降级：

| 数据源类型      | 优先级 | 特点                   |
| --------------- | ------ | ---------------------- |
| official_api    | 1      | 最可靠，有配额限制     |
| third_party_api | 2      | 覆盖好，可能有频率限制 |
| skill_crawler   | 3      | 备用方案，较慢但全面   |

当抓取结果中 `isDegraded=true` 时，表示数据来自备用源。查看 `source` 字段了解具体来源。

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
