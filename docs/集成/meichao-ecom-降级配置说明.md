# meichao-ecom 降级配置说明

## 概述

meichao-ecom 插件支持灵活的数据源降级策略，通过 `degradation` 参数控制降级行为。

**默认行为**：跳过爬虫，只使用官方和第三方 API，保证数据质量。

```
默认降级路径：
official_api → third_party_api → open_search
（跳过 skill_crawler）
```

## degradation 参数

| 参数              | 类型     | 必填 | 默认值 | 说明                |
| ----------------- | -------- | ---- | ------ | ------------------- |
| `preset`          | string   | 否   | -      | 预设模板名称        |
| `skipTypes`       | string[] | 否   | -      | 跳过的数据源类型    |
| `maxSources`      | number   | 否   | 3      | 最大尝试数据源数量  |
| `allowCrawler`    | boolean  | 否   | false  | 是否允许爬虫        |
| `allowOpenSearch` | boolean  | 否   | true   | 是否允许开放搜索    |
| `preferredSource` | string   | 否   | -      | 优先使用的数据源 ID |

## 参数详解

### preset（预设模板）

预设模板是预定义的降级策略，简化常见场景的配置。

#### 可选值

| 值                  | 降级路径                                                     | 适用场景   | 说明                           |
| ------------------- | ------------------------------------------------------------ | ---------- | ------------------------------ |
| `standard`          | official_api → third_party_api → skill_crawler → open_search | 全路径降级 | 尝试所有数据源                 |
| `cost-optimized`    | official_api → skill_crawler → open_search                   | 成本优先   | 跳过付费第三方 API             |
| `speed-optimized`   | third_party_api → official_api → open_search                 | 速度优先   | 优先响应快的数据源             |
| `reliability-first` | official_api → third_party_api                               | 质量优先   | 只用可靠源，跳过爬虫和开放搜索 |

#### 示例

```json
{
  "platform": "taobao",
  "keyword": "华为电视",
  "degradation": {
    "preset": "reliability-first"
  }
}
```

**效果**：只尝试 `official_api` 和 `third_party_api`，跳过爬虫和开放搜索。

---

### skipTypes（跳过数据源类型）

显式指定要跳过的数据源类型数组。

#### 可选值

| 值                | 说明       |
| ----------------- | ---------- |
| `official_api`    | 官方 API   |
| `third_party_api` | 第三方 API |
| `skill_crawler`   | 爬虫       |
| `open_search`     | 开放搜索   |

#### 示例

```json
{
  "platform": "taobao",
  "keyword": "华为电视",
  "degradation": {
    "skipTypes": ["skill_crawler", "open_search"]
  }
}
```

**效果**：跳过爬虫和开放搜索，只尝试 `official_api` 和 `third_party_api`。

---

### maxSources（最大数据源数量）

限制最多尝试多少个数据源，用于控制响应时间。

#### 取值范围

- 最小值：1
- 最大值：4
- 默认值：3

#### 示例

```json
{
  "platform": "taobao",
  "productId": "12345",
  "degradation": {
    "maxSources": 2
  }
}
```

**效果**：最多尝试 2 个数据源。如果第一个失败，只再尝试一个备用源。

---

### allowCrawler（是否允许爬虫）

控制是否将爬虫数据源纳入降级路径。

#### 默认值

`false`（默认跳过爬虫）

#### 示例 1：禁止爬虫（默认）

```json
{
  "platform": "taobao",
  "keyword": "华为电视",
  "degradation": {
    "allowCrawler": false
  }
}
```

**降级路径**：`official_api → third_party_api → open_search`

#### 示例 2：允许爬虫

```json
{
  "platform": "taobao",
  "keyword": "华为电视",
  "degradation": {
    "allowCrawler": true
  }
}
```

**降级路径**：`official_api → third_party_api → skill_crawler → open_search`

---

### allowOpenSearch（是否允许开放搜索）

控制是否将开放搜索纳入降级路径。开放搜索使用 Bing/Tavily API，数据质量较低。

#### 默认值

`true`（默认允许开放搜索作为最后降级）

#### 示例 1：允许开放搜索（默认）

```json
{
  "platform": "taobao",
  "keyword": "华为电视",
  "degradation": {
    "allowOpenSearch": true
  }
}
```

**降级路径**：包含 `open_search` 作为最后降级。

#### 示例 2：禁止开放搜索

```json
{
  "platform": "taobao",
  "keyword": "华为电视",
  "degradation": {
    "allowOpenSearch": false
  }
}
```

**降级路径**：`official_api → third_party_api`（不包含 `open_search`）

---

### preferredSource（优先数据源）

指定优先使用的数据源 ID，覆盖默认优先级。

#### 数据源 ID 格式

| 平台   | 数据源 ID             |
| ------ | --------------------- |
| 淘宝   | `taobao_official_api` |
| 淘宝   | `taobao_third_party`  |
| 淘宝   | `taobao_crawler`      |
| 淘宝   | `taobao_open_search`  |
| Amazon | `amazon_sp_api`       |
| Amazon | `amazon_product_api`  |

#### 示例

```json
{
  "platform": "taobao",
  "productId": "12345",
  "degradation": {
    "preferredSource": "taobao_third_party"
  }
}
```

**效果**：优先尝试 `taobao_third_party`，失败后按默认顺序降级。

---

## 组合使用

### 场景 1：只用官方 API

```json
{
  "platform": "taobao",
  "keyword": "华为电视",
  "degradation": {
    "preset": "reliability-first",
    "maxSources": 1
  }
}
```

**降级路径**：只尝试 `official_api`。

---

### 场景 2：跳过付费 API

```json
{
  "platform": "taobao",
  "keyword": "华为电视",
  "degradation": {
    "preset": "cost-optimized"
  }
}
```

**降级路径**：`official_api → skill_crawler → open_search`（跳过 `third_party_api`）

---

### 场景 3：快速响应

```json
{
  "platform": "taobao",
  "keyword": "华为电视",
  "degradation": {
    "preset": "speed-optimized",
    "maxSources": 2
  }
}
```

**降级路径**：`third_party_api → official_api`（最多尝试 2 个源）

---

### 场景 4：最高质量数据

```json
{
  "platform": "taobao",
  "keyword": "华为电视",
  "degradation": {
    "preset": "reliability-first",
    "allowOpenSearch": false
  }
}
```

**降级路径**：`official_api → third_party_api`（只用官方和第三方 API）

---

### 场景 5：启用全部数据源

```json
{
  "platform": "taobao",
  "keyword": "华为电视",
  "degradation": {
    "preset": "standard",
    "allowCrawler": true,
    "allowOpenSearch": true
  }
}
```

**降级路径**：`official_api → third_party_api → skill_crawler → open_search`

---

## 返回结果字段

降级执行后，返回结果包含以下字段：

| 字段               | 类型    | 说明                                                     |
| ------------------ | ------- | -------------------------------------------------------- |
| `success`          | boolean | 是否成功                                                 |
| `source`           | string  | 最终使用的数据源 ID                                      |
| `degradationLevel` | string  | 降级级别：`primary_source` / `fallback_source` / `error` |
| `isDegraded`       | boolean | 是否使用了备用源                                         |
| `attempts`         | array   | 所有尝试的数据源列表                                     |
| `latencyMs`        | number  | 总耗时（毫秒）                                           |

### attempts 数组结构

```json
{
  "attempts": [
    {
      "sourceId": "taobao_official_api",
      "success": false,
      "latencyMs": 1500,
      "error": "API not configured"
    },
    {
      "sourceId": "taobao_third_party",
      "success": false,
      "latencyMs": 1200,
      "error": "API not configured"
    },
    {
      "sourceId": "taobao_open_search",
      "success": true,
      "latencyMs": 2500
    }
  ]
}
```

---

## 数据源优先级说明

| 数据源类型        | 优先级    | 特点               | 配额/限制              |
| ----------------- | --------- | ------------------ | ---------------------- |
| `official_api`    | 1（最高） | 最可靠，官方数据   | 有日配额限制           |
| `third_party_api` | 2         | 覆盖好，第三方服务 | 可能有频率限制，需付费 |
| `skill_crawler`   | 3         | 备用方案，网页爬虫 | 较慢但全面             |
| `open_search`     | 4（最低） | 最后降级，开放搜索 | 数据质量中等           |

---

## 配置建议

### 推荐配置

**日常使用**（默认）：

```json
{
  "degradation": {
    "allowCrawler": false
  }
}
```

**成本敏感**：

```json
{
  "degradation": {
    "preset": "cost-optimized",
    "allowCrawler": true
  }
}
```

**质量优先**：

```json
{
  "degradation": {
    "preset": "reliability-first"
  }
}
```

### 不推荐配置

**启用爬虫**（数据质量不稳定）：

```json
{
  "degradation": {
    "allowCrawler": true
  }
}
```

---

## 常见问题

### Q: 为什么默认跳过爬虫？

A: 爬虫数据源（`skill_crawler`）存在以下问题：

- 响应速度慢
- 数据质量不稳定
- 可能被反爬机制限制

默认跳过可以保证数据质量和响应速度。

### Q: 什么时候应该启用爬虫？

A: 以下场景可以考虑启用爬虫：

- 官方和第三方 API 都不可用
- 需要获取历史数据或已下架商品
- 预算有限，无法使用付费 API

### Q: 开放搜索的数据质量如何？

A: 开放搜索使用 Bing/Tavily API：

- 数据来源是公开搜索引擎
- 价格、销量等关键字段可能不准确
- 建议仅作为最后降级手段

### Q: 如何知道使用了哪个数据源？

A: 检查返回结果中的 `source` 字段和 `attempts` 数组：

```json
{
  "success": true,
  "source": "taobao_open_search",
  "isDegraded": true,
  "attempts": [...]
}
```

---

## 配置示例（完整）

### ecom-product-fetch

```json
{
  "platform": "taobao",
  "productId": "12345",
  "degradation": {
    "preset": "reliability-first",
    "maxSources": 3,
    "allowCrawler": false,
    "allowOpenSearch": true
  }
}
```

### ecom-product-search

```json
{
  "platform": "taobao",
  "keyword": "华为折叠屏手机",
  "limit": 50,
  "degradation": {
    "preset": "reliability-first",
    "maxSources": 3,
    "allowCrawler": false,
    "allowOpenSearch": true
  }
}
```

---

## 相关文档

- [meichao-ecom 数据源降级策略](./meichao-ecom-数据源降级策略.md)
- [meichao-ecom 降级模块实现方案](./meichao-ecom-降级模块实现方案.md)
- [SKILL.md](../../extensions/meichao-ecom/skills/meichao-ecom/SKILL.md)
