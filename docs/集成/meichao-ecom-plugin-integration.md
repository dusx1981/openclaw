# 美潮电商插件 (meichao-ecom) OpenClaw 集成文档

## 概述

美潮电商插件 (`meichao-ecom`) 是一个 OpenClaw 工具插件，为 OpenClaw 提供跨境电商数据采集与智能分析能力。支持淘宝、Amazon、抖音、1688、Shopee、拼多多、京东、AliExpress 等主流电商平台。

## 注册机制

### 插件入口

插件通过 `definePluginEntry` 函数定义入口，位于 `extensions/meichao-ecom/index.ts`：

```typescript
export default definePluginEntry({
  id: "meichao-ecom",
  name: "Meichao E-commerce",
  description: "美潮龙虾跨境电商数据采集与智能分析系统",
  register(api: OpenClawPluginApi) {
    // 注册逻辑
  },
});
```

### 注册流程

```
┌─────────────────────────────────────────────────────────────────────┐
│                      插件注册流程                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. OpenClaw 加载插件                                               │
│     ┌───────────────────────────────────────────────────────────┐  │
│     │  读取 openclaw.plugin.json                                 │  │
│     │  ↓                                                         │  │
│     │  加载 index.ts (definePluginEntry)                         │  │
│     │  ↓                                                         │  │
│     │  调用 register(api) 函数                                   │  │
│     └───────────────────────────────────────────────────────────┘  │
│                                                                     │
│  2. 插件注册内容                                                    │
│     ┌───────────────────────────────────────────────────────────┐  │
│     │  api.registerTool() → 注册 Agent 工具                      │  │
│     │  api.registerCli()  → 注册 CLI 命令                        │  │
│     └───────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## OpenClawPluginApi 接口

插件通过 `OpenClawPluginApi` 接口与 OpenClaw 核心交互：

```typescript
export type OpenClawPluginApi = {
  id: string;
  name: string;
  version?: string;
  description?: string;
  source: string;
  rootDir?: string;
  config: OpenClawConfig;
  pluginConfig?: Record<string, unknown>;
  runtime: PluginRuntime;
  logger: PluginLogger;

  // 工具注册
  registerTool: (tool: AnyAgentTool, opts?) => void;

  // CLI 命令注册
  registerCli: (registrar, opts?) => void;

  // 其他注册方法
  registerHook: (events, handler, opts?) => void;
  registerHttpRoute: (params) => void;
  registerChannel: (registration) => void;
  registerProvider: (provider) => void;
  // ...
};
```

## 注册的功能

### 1. Agent 工具 (Tools)

插件注册了 3 个 Agent 工具，可在对话中通过自然语言调用：

#### ecom-product-fetch

**功能**：从电商平台获取单个商品的详细数据

**参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| platform | string | 是 | 平台名称 (taobao, amazon, douyin, 1688, shopee, pinduoduo, jd, aliexpress) |
| productId | string | 是 | 商品ID (淘宝 item ID, Amazon ASIN 等) |

**返回数据**：

```json
{
  "success": true,
  "product": {
    "platform": "taobao",
    "platformId": "12345",
    "title": "商品标题",
    "price": 99.0,
    "currency": "CNY",
    "sales": 1000,
    "rating": 4.8,
    "reviewsCount": 500,
    "shopName": "店铺名称",
    "sourceUrl": "https://..."
  },
  "source": "primary_api",
  "cached": false,
  "latencyMs": 250
}
```

**使用场景**：

- 获取特定商品的详细信息
- 分析竞品价格和销量
- 监控商品状态变化

#### ecom-product-search

**功能**：在电商平台搜索商品列表

**参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| platform | string | 是 | 平台名称 |
| keyword | string | 是 | 搜索关键词 |
| limit | number | 否 | 结果数量 (默认 50，最大 100) |

**返回数据**：

```json
{
  "success": true,
  "search": {
    "platform": "taobao",
    "keyword": "龙虾",
    "limit": 50
  },
  "results": {
    "total": 10000,
    "count": 50,
    "page": 1,
    "pageSize": 50
  },
  "products": [
    {
      "platformId": "12345",
      "title": "商品标题",
      "price": 99.0,
      "sales": 1000,
      "rating": 4.8,
      "shopName": "店铺名称",
      "sourceUrl": "https://..."
    }
  ]
}
```

**使用场景**：

- 市场调研和竞品分析
- 发现热门商品和趋势
- 寻找潜在爆款产品

#### ecom-validate-platform

**功能**：验证电商平台数据采集功能状态

**参数**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| platform | string | 否 | 平台名称 (不指定则验证所有平台) |
| count | number | 否 | 验证请求数量 (默认 10，最大 100) |

**返回数据**：

```json
{
  "success": true,
  "validation": {
    "platform": "taobao",
    "timestamp": 1712345678000,
    "durationMs": 1500
  },
  "stats": {
    "total": 10,
    "successes": 9,
    "failures": 1,
    "successRate": "90.00",
    "perSource": [
      { "sourceId": "api_1", "sourceType": "official_api", "successRate": "100.00" }
    ]
  },
  "degradation": {
    "totalFallbacks": 1,
    "paths": ["api_1 → api_2"]
  },
  "samples": [...]
}
```

**使用场景**：

- 检查 API 健康状态
- 验证数据源可用性
- 故障排查和监控

### 2. CLI 命令

插件注册了 `meichao` 命令组，提供命令行操作：

```
openclaw meichao <command>

Commands:
  fetch <platform> <productId>  从指定平台获取商品数据
  search <platform> <keyword>   在指定平台搜索商品
  validate [platform]           验证平台数据采集功能
  platforms                     列出所有支持的平台

Options:
  --json                        输出 JSON 格式
  -l, --limit <number>          限制结果数量
  -c, --count <number>          验证请求数量
  --all                         验证所有平台
```

#### 使用示例

```bash
# 获取商品数据
openclaw meichao fetch taobao 12345

# 搜索商品
openclaw meichao search taobao "龙虾" --limit 20

# 验证平台
openclaw meichao validate taobao --count 20

# 验证所有平台
openclaw meichao validate --all

# 列出支持的平台
openclaw meichao platforms
```

## 配置 Schema

插件定义了配置 Schema (`openclaw.plugin.json`)：

```json
{
  "id": "meichao-ecom",
  "name": "Meichao E-commerce",
  "configSchema": {
    "type": "object",
    "properties": {
      "postgres": {
        "type": "object",
        "properties": {
          "host": { "type": "string" },
          "port": { "type": "number" },
          "database": { "type": "string" },
          "user": { "type": "string" },
          "password": { "type": "string" }
        }
      },
      "redis": {
        "type": "object",
        "properties": {
          "host": { "type": "string" },
          "port": { "type": "number" },
          "password": { "type": "string" }
        }
      },
      "alertChannels": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "type": { "type": "string", "enum": ["feishu", "email", "webhook"] },
            "config": { "type": "object" }
          }
        }
      }
    }
  }
}
```

### 配置示例

在 `~/.openclaw/openclaw.json` 中配置：

```json
{
  "plugins": {
    "meichao-ecom": {
      "postgres": {
        "host": "localhost",
        "port": 5432,
        "database": "meichao",
        "user": "postgres",
        "password": "password"
      },
      "redis": {
        "host": "localhost",
        "port": 6379
      }
    }
  }
}
```

## 架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        OpenClaw 核心架构                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Agent Runtime                              │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │   │
│  │  │ Tool: fetch │  │Tool: search │  │Tool: validate│             │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │   │
│  │         │                │                │                     │   │
│  └─────────┼────────────────┼────────────────┼─────────────────────┘   │
│            │                │                │                         │
│  ┌─────────▼────────────────▼────────────────▼─────────────────────┐   │
│  │                   meichao-ecom 插件                              │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │                    Application Layer                      │   │   │
│  │  │  Use Cases: FetchProduct, SearchProducts, ValidatePlatform│   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │                    Domain Layer                           │   │   │
│  │  │  Types: Platform, ProductData, DataSource, FetchResult    │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  │  ┌──────────────────────────────────────────────────────────┐   │   │
│  │  │                 Infrastructure Layer                      │   │   │
│  │  │  Adapters: TaobaoAdapter, AmazonAdapter                   │   │   │
│  │  │  Registry: PlatformRegistry, ValidatorRegistry            │   │   │
│  │  │  Storage: PostgreSQL, Redis Cache                         │   │   │
│  │  └──────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│            │                │                │                         │
│  ┌─────────▼────────────────▼────────────────▼─────────────────────┐   │
│  │                     External Services                           │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │   │
│  │  │ Taobao  │ │ Amazon  │ │ Douyin  │ │  1688   │ │ Shopee  │   │   │
│  │  │   API   │ │   API   │ │   API   │ │   API   │ │   API   │   │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 支持的平台

| 平台       | ID         | 货币 | 数据源     |
| ---------- | ---------- | ---- | ---------- |
| 淘宝       | taobao     | CNY  | API + 爬虫 |
| Amazon     | amazon     | USD  | API + 爬虫 |
| 抖音       | douyin     | CNY  | API + 爬虫 |
| 1688       | 1688       | CNY  | API + 爬虫 |
| Shopee     | shopee     | SGD  | API + 爬虫 |
| 拼多多     | pinduoduo  | CNY  | API + 爬虫 |
| 京东       | jd         | CNY  | API + 爬虫 |
| AliExpress | aliexpress | USD  | API + 爬虫 |

## 数据降级策略

插件实现了多级数据降级策略，确保数据获取的可靠性：

```
┌─────────────────────────────────────────────────────────────────────┐
│                      数据获取优先级                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. fresh_cache     → 新鲜缓存 (未过期)                            │
│  2. primary_source  → 主要数据源 (官方 API)                        │
│  3. fallback_source → 备用数据源 (第三方 API)                      │
│  4. database        → 数据库历史数据                               │
│  5. stale_cache     → 过期缓存 (降级模式)                          │
│                                                                     │
│  触发降级的条件：                                                   │
│  - 认证失败 (auth, auth_permanent)                                 │
│  - 速率限制 (rate_limit)                                           │
│  - 服务过载 (overloaded)                                           │
│  - 计费问题 (billing)                                              │
│  - 超时 (timeout)                                                  │
│  - 被封禁 (blocked)                                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 相关文件

| 文件路径                                               | 说明            |
| ------------------------------------------------------ | --------------- |
| `extensions/meichao-ecom/index.ts`                     | 插件入口        |
| `extensions/meichao-ecom/openclaw.plugin.json`         | 插件配置 Schema |
| `extensions/meichao-ecom/runtime-api.ts`               | 运行时 API 导出 |
| `extensions/meichao-ecom/src/tools/`                   | Agent 工具实现  |
| `extensions/meichao-ecom/src/cli/`                     | CLI 命令实现    |
| `extensions/meichao-ecom/src/domain/types.ts`          | 领域类型定义    |
| `extensions/meichao-ecom/src/application/bootstrap.js` | 应用层引导      |
| `extensions/meichao-ecom/src/infrastructure/`          | 基础设施实现    |
