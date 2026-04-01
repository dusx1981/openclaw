## Context

美潮龙虾是跨境电商商家，需要在 OpenClaw 平台上构建自动化数据采集与智能分析系统。当前痛点：
- 多平台数据分散，人工监控效率低
- 爆款识别依赖经验，缺乏数据支撑
- 竞品分析滞后，决策周期长

技术约束：
- 基于 OpenClaw 平台现有技能架构
- 需支持国内外主流电商平台
- 数据安全要求：支持私有化部署
- Token 消耗可控，月均预算 8.5万-19万 Token

## Goals / Non-Goals

**Goals:**
- 覆盖 10+ 电商平台，监控 1000+ 竞品
- 数据更新频率达到 1 小时
- 爆款识别准确率 ≥85%
- 人工成本降低 70%，决策效率提升 3 倍

**Non-Goals:**
- 不替代现有 ERP/OMS 系统
- 不提供支付/物流履约功能
- 不做自有电商平台的商品上架

## Decisions

### D1: 数据源优先级策略
- **选择**: 官方免费API → 第三方聚合API → Skill爬虫
- **原因**: 
  - 合规性：官方API 100%合规，避免反爬风险
  - 稳定性：官方API 99%+，爬虫仅 80%
  - 成本：免费额度优先，降低 94% 成本
- **数据源优先级矩阵**:

| 平台 | 第一优先 | 第二优先 | 第三优先 |
|------|---------|---------|---------|
| 淘宝 | taobao.item_get (免费100次/日) | 聚数塔聚合API | agent-browser |
| 1688 | 1688.offer.search (基础免费) | 聚数塔聚合API | agent-browser |
| Amazon | Amazon SP-API (免费额度) | amazon-product-api-skill | agent-browser |
| 抖音 | 蝉妈妈API (付费专业数据) | douyin-hot-trend | agent-browser |
| TikTok | tiktok-crawling Skill | 蝉妈妈API | agent-browser |

- **替代方案**: 纯爬虫方案，成本高、风险高、稳定性差

### D2: 数据存储架构
- **选择**: PostgreSQL + Redis + 时序数据库（InfluxDB）
- **原因**: 
  - PostgreSQL: 结构化竞品数据，支持 JSON 查询
  - Redis: 实时缓存，监控预警快速读取
  - InfluxDB: 价格/销量时序数据，支持趋势分析
- **替代方案**: 纯 MySQL（时序查询性能差）、MongoDB（关系查询弱）

### D3: 异常检测策略
- **选择**: 规则引擎 + 机器学习混合
- **原因**: 规则引擎快速响应已知模式，ML 发现未知异常
- **替代方案**: 纯规则（覆盖不全）、纯 ML（冷启动问题）

### D4: 报告生成架构
- **选择**: 模板引擎 + 图表库（ECharts）
- **原因**: 模板化降低开发成本，ECharts 与 OpenClaw UI 集成度高
- **替代方案**: 纯代码生成（维护成本高）

### D5: 技能选型策略
- **选择**: 基于下载量与成熟度优先选择高人气 Skill
- **选型原则**:
  - 下载量 >10K 的 Skill 优先（稳定性高、社区活跃）
  - 专用 Skill 优于通用 Skill（Token 消耗更低）
  - 合并功能重叠的 Skill（减少维护成本）
- **核心 Skill 清单**:

| 功能层 | Skill | 下载量 | 用途 |
|-------|-------|-------|------|
| 数据采集 | agent-browser | 78.9K | 浏览器自动化 |
| 数据采集 | amazon-product-api-skill | 1.1K | Amazon商品抓取 |
| 数据采集 | tiktok-crawling | 2.1K | TikTok视频抓取 |
| 趋势发现 | google-trends | 1.2K | 全球搜索热度 |
| 趋势发现 | douyin-hot-trend | 1.8K | 抖音热榜 |
| 竞品分析 | competitor-teardown | 857 | 竞品拆解 |
| 价格监控 | price-tracker | 2.5K | 多平台价格 |
| 搜索 | tavily-search | 113K | AI专用搜索 |
| 报告 | weekly-report-generator | 2.0K | 自动报告 |
| 存储 | notion | 43.5K | 知识库 |
| 集成 | api-gateway | 35.3K | 100+平台 |
| 通知 | feishu-bridge | 6.4K | 飞书推送 |
| 总结 | summarize | 89.4K | 内容总结 |

- **替代方案**: 使用通用 Skill（如 playwright-scraper-skill），但 Token 消耗更高

### D6: 通知渠道选择
- **选择**: 飞书（feishu-bridge + feishu-messaging）
- **原因**: 
  - 下载量高（6.4K + 5.6K），集成成熟
  - 支持消息推送 + 文档创建
  - 国产首选，适合国内团队
- **替代方案**: 钉钉/企业微信（需自研集成，维护成本高）

### D7: 知识库选择
- **选择**: Notion
- **原因**: 
  - 下载量最高（43.5K），社区活跃
  - 支持数据库、页面、知识沉淀
  - 团队协作友好
- **替代方案**: Obsidian（本地优先，适合个人使用）

### D8: 平台易扩展架构
- **选择**: 插件化 PlatformAdapter 架构 + YAML 配置驱动
- **架构设计**:
  ```
  PlatformRegistry (注册中心)
       │
       ├── TaobaoAdapter
       │    ├── DataSource 1: taobao.item_get (免费)
       │    ├── DataSource 2: 聚数塔聚合API
       │    └── DataSource 3: agent-browser
       │
       ├── AmazonAdapter
       │    ├── DataSource 1: Amazon SP-API (免费)
       │    └── DataSource 2: amazon-product-api-skill
       │
       └── [新增平台：只需创建YAML配置]
  ```
- **扩展流程**: 创建YAML配置 → 测试连通性 → 自动注册（无需修改代码）
- **替代方案**: 硬编码各平台逻辑，扩展成本高

### D9: 成功率保证策略
- **选择**: 四层容错架构
- **容错层级**:
  1. **重试层**: 单次请求失败，指数退避重试（1s, 2s, 4s），最多3次
  2. **降级层**: 数据源失败，自动切换下一优先级数据源
  3. **缓存层**: 所有数据源失败，返回缓存数据（标记过期）
  4. **人工层**: 持续失败，飞书告警 + 失败队列
- **健康检查**: 每5分钟检查数据源状态，失败率>50%熔断
- **目标成功率**: 99%+
- **替代方案**: 单一数据源，无容错，成功率低

### D10: 省钱策略
- **选择**: 智能调度 + 免费额度优先 + 分级更新
- **策略详解**:
  1. **免费额度优先**: 淘宝100次/日 → 用于热门商品
  2. **智能调度**: 缓存命中跳过采集，增量更新减少调用
  3. **分级更新频率**:
     - P0热门商品（10%）: 1小时更新
     - P1普通商品（30%）: 4小时更新
     - P2冷门商品（60%）: 24小时更新
  4. **成本监控**: 日成本>¥10预警，>¥50紧急告警
- **成本对比**: 纯爬虫 ¥270/月 → API优先 ¥16/月，节省94%
- **替代方案**: 不区分优先级，统一高频更新，成本高

### D11: 配额管理架构
- **选择**: QuotaManager + DataSourceSelector 组合
- **核心组件**:
  - `QuotaManager`: 跟踪各平台免费额度使用情况
  - `DataSourceSelector`: 根据配额和成本选择最优数据源
  - `CacheManager`: 减少重复调用
- **配额重置**: 每日自动重置，Redis存储状态
- **替代方案**: 无配额管理，可能超出免费额度产生额外费用

### D12: 数据模型设计
- **选择**: 主表统一 + JSONB扩展 + 可选扩展表
- **设计原则**:
  1. 核心先行：先实现主表，覆盖80%通用场景
  2. 扩展预留：设计扩展点，支持后续按需添加
  3. 向后兼容：扩展不影响现有数据结构和代码
  4. 渐进演进：从简单到复杂，按需扩展

- **架构分层**:
  ```
  Layer 1: 核心层（Phase 1 实现）
  └── products 主表 + extra_data JSONB
  
  Layer 2: 时序层（Phase 2 实现）
  ├── product_price_history
  └── product_sales_history
  
  Layer 3: 扩展层（Phase 3 按需实现）
  ├── taobao_extensions（可选）
  ├── amazon_extensions（可选）
  └── douyin_extensions（可选）
  
  Layer 4: 聚合层（Phase 4 按需实现）
  └── 物化视图、报表视图
  ```

- **主表设计（products）**:
  | 字段分类 | 字段 | 说明 |
  |---------|------|------|
  | 平台标识 | platform, platform_id | 唯一标识商品 |
  | 基本信息 | title, main_image, images, source_url | 商品基础属性 |
  | 价格信息 | price, original_price, currency | 价格相关 |
  | 销售信息 | sales, sales_unit, sales_period | 销量相关 |
  | 评价信息 | rating, reviews_count | 评分评论 |
  | 店铺信息 | shop_id, shop_name, shop_url | 店铺相关 |
  | 分类信息 | category_id, category_name, category_path | 类目相关 |
  | 状态优先级 | status, priority, is_trending | 状态管理 |
  | 商户关联 | merchant_id, tags | 商户归属 |
  | 扩展数据 | extra_data (JSONB) | 平台特有数据 |

- **extra_data JSONB 规范**:
  - 淘宝: commission, coupon, live, tmall, brand
  - Amazon: asin, fulfillment, buy_box, ranking, marketplace
  - 抖音: video, live, commission, promote_type
  - 1688: wholesale, supplier, min_order_qty
  - Shopee: region, shipping, campaign

- **扩展机制**:
  1. 主表字段扩展: ALTER TABLE 添加新字段（带默认值）
  2. extra_data扩展: 更新JSONB schema规范，无需修改表结构
  3. 平台扩展表: 创建外键关联主表的扩展表
  4. 历史时序表: 记录价格/销量等历史变化
  5. 物化视图: 预计算复杂聚合查询

- **替代方案**: 
  - 纯统一表：平台特有字段存储效率低
  - 纯分开表：跨平台查询复杂，维护成本高

### D13: Skill vs 传统代码技术选型
- **选择**: 混合方案（数据层传统代码 + 分析层Skill + 输出层Skill）
- **决策框架**:

| 判断维度 | 选传统代码 | 选 Skill |
|---------|-----------|---------|
| 调用频率 | 高频（每小时多次） | 低频（每日/周） |
| AI推理需求 | 不需要 | 需要（洞察/理解） |
| 输出稳定性 | 高稳定性要求 | 可接受波动 |
| Token成本敏感度 | 敏感 | 不敏感 |
| 开发速度 | 允许开发周期 | 快速上线 |
| 定制化需求 | 高度定制 | 通用场景 |

- **各场景技术选型**:

| 场景 | 技术方案 | 适用度 | 理由 |
|------|---------|--------|------|
| 数据采集 | 传统代码 | ★★★★★ | 高频调用、稳定性要求高、Token成本不可接受 |
| 数据存储 | 传统代码 | ★★★★★ | 性能要求高、数据安全可控 |
| 价格监控 | 传统代码 | ★★★★★ | 高频、实时、规则明确、需要99.9%可用性 |
| 销量监控 | 传统代码 | ★★★★★ | 高频、时序分析、逻辑简单 |
| 异常预警 | 传统代码 | ★★★★★ | 实时性要求高、规则引擎足够 |
| 趋势发现 | 传统为主+Skill补充 | ★★★★☆ | 核心采集传统，补充数据可用Skill |
| 爆款识别 | 传统代码(ML)+Skill解释 | ★★★★☆ | ML模型更适合预测，Skill用于自然语言解释 |
| 竞品分析 | Skill为主 | ★★★★★ | 需要深度洞察、LLM天然适合 |
| 评论分析 | Skill为主 | ★★★★★ | NLP任务、情感理解、多语言支持 |
| 市场调研 | 混合 | ★★★★☆ | 数据采集传统，分析洞察Skill |
| 智能推荐 | 混合 | ★★★★☆ | 规则传统，推荐解释Skill |
| 报告生成 | Skill为主 | ★★★★★ | 自然语言生成、模板化输出 |

- **架构分层**:
  ```
  Layer 1: 数据层（传统代码）
  ├── 数据采集（API + ETL）
  ├── 数据存储（PostgreSQL + Redis + InfluxDB）
  ├── 实时监控（价格/销量/异常预警）
  └── 配额管理、健康检查

  Layer 2: 分析层（混合）
  ├── 传统代码：统计计算、趋势计算、ML预测模型
  └── Skill：竞品分析、评论分析、市场洞察

  Layer 3: 输出层（Skill为主）
  ├── 报告生成（weekly-report-generator, summarize）
  ├── 知识沉淀（notion）
  └── 通知推送（feishu-bridge）
  ```

- **成本对比（监控1000商品/月）**:

| 方案 | 月成本 | 说明 |
|------|-------|------|
| 全Skill | ¥1100 | Token消耗110M，稳定后成本可控 |
| 全传统代码 | ¥5500 | 含开发摊销¥2500+维护¥3000 |
| **混合方案** | **¥2781** | 开发摊销¥1250+维护¥1500+Token¥31 |

- **替代方案**: 
  - 全Skill：高频场景Token成本不可接受，稳定性难保证
  - 全传统代码：缺乏AI洞察能力，开发维护成本高

### D14: 架构质量分析（高内聚、低耦合）
- **评估时间**: 2026-03-25
- **评估范围**: Phase 1 核心框架实现

#### 当前架构依赖图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CURRENT ARCHITECTURE                                │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────┐
                              │   index.ts   │
                              │   (入口)      │
                              └──────┬───────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
        ▼                            ▼                            ▼
┌───────────────┐          ┌───────────────┐            ┌───────────────┐
│  Registry     │◀─────────│   Selector    │            │  Adapters     │
│  (单例)       │◀─────────│   Health      │            │  (手动注册)    │
└───────┬───────┘          └───────────────┘            └───────┬───────┘
        │                                                       │
        ▼                                                       ▼
┌───────────────┐                                     ┌───────────────┐
│ BaseAdapter   │◀────────────────────────────────────│ TaobaoAdapter │
│ (抽象类)      │                                     │ AmazonAdapter │
└───────────────┘                                     │ DouyinAdapter │
        │                                             │ Adapter1688   │
        ▼                                             │ ShopeeAdapter │
┌───────────────┐                                             │
│    types.ts   │◀────────────────────────────────────────────┘
│  (类型定义)    │
└───────────────┘

┌───────────────┐          ┌───────────────┐
│     db.ts     │          │  ProductModel │
│ PostgreSQL    │◀─────────│  (数据访问)    │
│ Redis         │          └───────────────┘
│ (混合职责)    │
└───────────────┘
```

#### 耦合问题评估

| 问题 | 位置 | 严重程度 | 说明 |
|------|------|---------|------|
| **单例依赖** | `selector.ts:25`, `health.ts:45` | 🔴 高 | 直接调用 `PlatformRegistry.getInstance()`，无法替换实现，测试困难 |
| **硬编码注册** | `index.ts:36-40` | 🟡 中 | 手动 new 所有适配器，新增平台需改代码 |
| **硬编码配置** | 各适配器构造函数 | 🟡 中 | DataSource 配置写死在适配器内，无法动态调整 |
| **全局 db 实例** | `db.ts:217-218` | 🟡 中 | 导出单例 `db`, `redis`，测试时难以 mock |

```typescript
// 问题示例: selector.ts:24-25 - 紧耦合
constructor(errorCooldownMs = 300000) {
  this.registry = PlatformRegistry.getInstance();  // 无法注入 mock
}

// 问题示例: index.ts:36-40 - 硬编码注册
registry.register(new TaobaoAdapter());
registry.register(new AmazonAdapter());
// 新增平台需要修改此处代码
```

#### 内聚问题评估

| 问题 | 位置 | 说明 |
|------|------|------|
| **db.ts 双重职责** | `db.ts:43-220` | 同时管理 PostgreSQL 和 Redis，违反单一职责原则 |
| **Adapter 多职责** | 各适配器 | 同时负责：数据获取 + 数据标准化 + 扩展数据提取 + 重试逻辑 |
| **配置与代码混合** | `db.ts:24-41` | 默认配置硬编码，应抽离到配置文件 |

#### 良好设计点

| 设计点 | 说明 |
|--------|------|
| **抽象层清晰分离** | `types.ts` 纯类型定义，无依赖，可独立复用 |
| **适配器模式** | `BasePlatformAdapter` 抽象类定义统一接口，各平台适配器实现 |
| **统一数据模型** | 所有平台输出统一的 `ProductData` 格式，`normalizeData()` + `extractExtraData()` |
| **功能组件独立** | `QuotaManager`, `CacheManager`, `HealthChecker` 各自职责明确，互不依赖 |

#### 改进方案

**方案 A: 依赖注入重构（推荐）**

```
┌─────────────────────────────────────────────────────────────────┐
│                    推荐架构改进                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                     ┌─────────────────┐                         │
│                     │   Container     │                         │
│                     │   (DI 容器)     │                         │
│                     └────────┬────────┘                         │
│                              │                                  │
│         ┌────────────────────┼────────────────────┐             │
│         │                    │                    │             │
│         ▼                    ▼                    ▼             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │ Registry    │     │ DataSource  │     │ Cache       │       │
│  │ (注入)      │     │ Selector    │     │ Manager     │       │
│  └─────────────┘     │ (注入 registry)   │ (独立)      │       │
│                      └─────────────┘     └─────────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

改进点：
1. Registry 通过构造函数注入，而非单例
2. 适配器通过配置文件注册，而非硬编码
3. DataSourceSelector 接收 Registry 作为参数

**方案 B: 职责分离**

```
当前:                           建议:
─────────                       ─────────
db.ts                          db/
├── DatabaseManager            ├── postgres.ts
└── RedisManager               └── redis.ts

adapters/taobao.ts             adapters/taobao/
├── fetch                      ├── fetcher.ts
├── normalizeData              ├── normalizer.ts
└── extractExtraData           └── config.ts
```

**方案 C: 配置驱动**

```yaml
# config/adapters.yaml
adapters:
  - platform: taobao
    class: TaobaoAdapter
    sources:
      - id: taobao_official_api
        type: official_api
        priority: 1
        dailyQuota: 100
      - id: taobao_jushuta
        type: third_party_api
        priority: 2
        dailyQuota: 1000
```

#### 评估总结

| 维度 | 当前状态 | 目标状态 | 差距 |
|------|---------|---------|------|
| **高内聚** | 🟡 中等 | 🟢 高 | 拆分 db.ts，适配器职责分离 |
| **低耦合** | 🔴 较差 | 🟢 低 | 引入 DI，移除单例依赖 |
| **可测试性** | 🔴 差 | 🟢 好 | 依赖注入便于 mock |
| **可扩展性** | 🟡 中等 | 🟢 高 | 配置驱动注册 |

#### 后续改进任务

1. **Phase 1.5 重构**（建议优先级：高）
   - 引入简单的 DI 容器或工厂模式
   - 将单例依赖改为构造函数注入
   - 拆分 `db.ts` 为 `postgres.ts` 和 `redis.ts`

2. **Phase 2 优化**（建议优先级：中）
   - 实现配置驱动的适配器注册
   - 将适配器配置外置到 YAML 文件
   - 添加适配器热加载能力

### D15: 整体架构设计模式
- **评估时间**: 2026-03-25
- **目标**: 确立统一的顶层架构指导原则

#### 当前识别的设计模式

**结构型模式**

| 模式 | 应用位置 | 作用 |
|------|---------|------|
| **适配器模式** | `BasePlatformAdapter` + 各平台实现 | 统一不同平台的 API 接口 |
| **外观模式** | `index.ts` | 简化复杂的子系统调用 |
| **装饰器模式** | `withRetry()` 方法 | 为数据获取添加重试能力 |
| **代理模式** | `CacheManager` | 控制对数据的访问（缓存代理） |

**行为型模式**

| 模式 | 应用位置 | 作用 |
|------|---------|------|
| **策略模式** | `DataSourceSelector` | 动态选择数据源策略 |
| **模板方法模式** | `BasePlatformAdapter.fetchProduct()` | 定义算法骨架，子类实现细节 |
| **责任链模式** | 四层容错（重试→降级→缓存→告警） | 依次处理失败情况 |
| **观察者模式** | `HealthChecker` 周期检查 | 定期监控状态变化 |

**创建型模式**

| 模式 | 应用位置 | 作用 |
|------|---------|------|
| **单例模式** | `PlatformRegistry.getInstance()` | 全局唯一注册表 |
| **工厂方法模式** | `registerPlatformAdapter()` | 延迟创建适配器 |

#### 问题：模式分散，缺乏统一架构指导

```
┌─────────────────────────────────────────────────────────────────┐
│                 问题：模式像"补丁"分布各处                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐        │
│   │ 适配器  │   │  策略   │   │  单例   │   │  DAO    │        │
│   │  模式   │   │  模式   │   │  模式   │   │  模式   │        │
│   └────┬────┘   └────┬────┘   └────┬────┘   └────┬────┘        │
│        │             │             │             │              │
│        └─────────────┴─────────────┴─────────────┘              │
│                              │                                   │
│                              ▼                                   │
│                     缺乏统一的架构理念                           │
│                                                                 │
│   问题表现：                                                     │
│   - 单例 vs 依赖注入混用                                        │
│   - 职责边界模糊（db.ts 混合职责）                              │
│   - 配置分散（适配器配置、数据库配置各管各的）                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### 推荐：六边形架构 + 管道-过滤器混合架构

**六边形架构（Hexagonal Architecture）**

核心原则：
1. 领域核心不依赖任何外部框架/库
2. 所有外部交互通过"端口+适配器"
3. 业务逻辑与技术实现解耦

```
┌─────────────────────────────────────────────────────────────────┐
│                      六边形架构                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                        ┌─────────────────────┐                  │
│                        │      领域核心        │                  │
│                        │                     │                  │
│                        │  ┌───────────────┐  │                  │
│                        │  │ ProductData   │  │                  │
│                        │  │ (领域模型)     │  │                  │
│                        │  └───────────────┘  │                  │
│                        │                     │                  │
│                        │  ┌───────────────┐  │                  │
│                        │  │ 端口    │  │                  │
│                        │  │ - fetch()     │  │                  │
│                        │  │ - store()     │  │                  │
│                        │  │ - select()    │  │                  │
│                        │  └───────────────┘  │                  │
│                        └──────────┬──────────┘                  │
│                                   │                             │
│         ┌─────────────────────────┼─────────────────────────┐  │
│         │                         │                         │  │
│         ▼                         ▼                         ▼  │
│   ┌───────────┐            ┌───────────┐            ┌───────────┐
│   │ 驱动适配器 │            │ 驱动适配器 │            │ 被驱动适配器│
│   │ (入站)     │            │ (入站)     │            │ (出站)     │
│   └─────┬─────┘            └─────┬─────┘            └─────┬─────┘
│         │                        │                        │    │
│         ▼                        ▼                        ▼    │
│   ┌───────────┐            ┌───────────┐            ┌───────────┐
│   │  CLI/API  │            │  Scheduler│            │ 电商平台   │
│   │  (调用方) │            │  (调度器)  │            │ (外部系统) │
│   └───────────┘            └───────────┘            └───────────┘
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**管道-过滤器架构（Pipeline-Filter）**

适用于数据采集和处理流程：

```
┌─────────────────────────────────────────────────────────────────┐
│                      管道-过滤器架构                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   数据流向：                                                     │
│                                                                 │
│   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│   │ Source  │───▶│ Filter  │───▶│Transform │───▶│  Cache  │───▶│  Store  │
│   │ Filter  │    │ (验证)  │    │ (标准化) │    │ (缓存)  │    │ (存储)  │
│   └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
│                                                                 │
│   多数据源并联：                                                 │
│                                                                 │
│        ├──────▶ [官方API] ──────┐                               │
│        ├──────▶ [第三方API] ────┼───▶ Merge ───▶ Pipeline       │
│        └──────▶ [Skill爬虫] ────┘                               │
│                                                                 │
│   优点：                                                         │
│   - 每个过滤器独立、可测试                                       │
│   - 可灵活组合处理流程                                           │
│   - 易于添加新的处理步骤                                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**混合架构总览**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    推荐架构：六边形 + 管道混合                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                          ┌─────────────────────┐                            │
│                          │      CLI/API        │                            │
│                          │    (驱动适配器)      │                            │
│                          └──────────┬──────────┘                            │
│                                     │                                       │
│                                     ▼                                       │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                         应用层 (Use Cases)                           │  │
│   │                                                                      │  │
│   │   ┌──────────────────────────────────────────────────────────────┐  │  │
│   │   │                    数据管道 (Pipeline)                         │  │  │
│   │   │                                                              │  │  │
│   │   │  Fetch ──▶ Validate ──▶ Normalize ──▶ Enrich ──▶ Store     │  │  │
│   │   │                                                              │  │  │
│   │   └──────────────────────────────────────────────────────────────┘  │  │
│   │                                                                      │  │
│   │   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐          │  │
│   │   │ QuotaService  │  │ CacheService  │  │ AlertService  │          │  │
│   │   └───────────────┘  └───────────────┘  └───────────────┘          │  │
│   │                                                                      │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                     │                                       │
│                                     ▼                                       │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                          领域层 (Domain)                             │  │
│   │                                                                      │  │
│   │   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐          │  │
│   │   │ ProductData   │  │ DataSource    │  │ Quota         │          │  │
│   │   │ (实体)        │  │ (值对象)      │  │ (值对象)      │          │  │
│   │   └───────────────┘  └───────────────┘  └───────────────┘          │  │
│   │                                                                      │  │
│   │   ┌───────────────────────────────────────────────────────────┐    │  │
│   │   │                     端口 (Ports)                            │    │  │
│   │   │                                                           │    │  │
│   │   │  ProductRepository    PlatformGateway    CacheProvider   │    │  │
│   │   │  (存储端口)           (平台端口)         (缓存端口)       │    │  │
│   │   │                                                           │    │  │
│   │   └───────────────────────────────────────────────────────────┘    │  │
│   │                                                                      │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                     │                                       │
│                                     ▼                                       │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                       基础设施层 (Infrastructure)                    │  │
│   │                                                                      │  │
│   │   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐          │  │
│   │   │PostgresRepo   │  │PlatformAdapters│  │RedisCache    │          │  │
│   │   │(适配器)       │  │(适配器)        │  │(适配器)       │          │  │
│   │   └───────────────┘  └───────────────┘  └───────────────┘          │  │
│   │                                                                      │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### 架构分层映射

| 六边形架构概念 | 当前实现 | 目标实现 |
|---------------|---------|---------|
| **领域核心** | `types.ts` + 业务逻辑 | `domain/` 目录，纯业务逻辑 |
| **端口** | `BasePlatformAdapter` 接口 | 定义为纯接口，无实现 |
| **驱动适配器** | `TaobaoAdapter`, `AmazonAdapter` | 保持不变，实现端口 |
| **被驱动适配器** | CLI Tools（待实现） | 新增 Scheduler、API |
| **存储适配器** | `ProductModel`, `db.ts` | 重构为 Repository 模式 |

#### 目录结构重组建议

```
extensions/meichao-ecom/
├── src/
│   ├── domain/                      # 领域层（核心，无外部依赖）
│   │   ├── entities/
│   │   │   └── Product.ts           # 产品实体
│   │   ├── value-objects/
│   │   │   ├── DataSource.ts        # 数据源值对象
│   │   │   └── Quota.ts             # 配额值对象
│   │   └── ports/                   # 端口定义（接口）
│   │       ├── ProductRepository.ts
│   │       ├── PlatformGateway.ts
│   │       └── CacheProvider.ts
│   │
│   ├── application/                 # 应用层（用例）
│   │   ├── use-cases/
│   │   │   ├── FetchProductUseCase.ts
│   │   │   └── SearchProductsUseCase.ts
│   │   ├── services/
│   │   │   ├── QuotaService.ts
│   │   │   └── AlertService.ts
│   │   └── pipeline/                # 管道-过滤器
│   │       ├── FetchFilter.ts
│   │       ├── ValidateFilter.ts
│   │       ├── NormalizeFilter.ts
│   │       └── StoreFilter.ts
│   │
│   ├── infrastructure/              # 基础设施层（适配器实现）
│   │   ├── adapters/
│   │   │   ├── platforms/           # 平台适配器
│   │   │   │   ├── TaobaoAdapter.ts
│   │   │   │   └── AmazonAdapter.ts
│   │   │   └── storage/             # 存储适配器
│   │   │       ├── PostgresProductRepository.ts
│   │   │       └── RedisCacheProvider.ts
│   │   └── config/
│   │       └── adapters.yaml        # 配置驱动
│   │
│   └── interfaces/                  # 接口层（驱动适配器）
│       ├── cli/
│       │   └── commands/
│       └── tools/
│           └── ProductFetchTool.ts
```

#### 架构设计原则

1. **依赖倒置原则 (DIP)**
   - 高层模块不依赖低层模块，两者都依赖抽象
   - 抽象不依赖细节，细节依赖抽象

2. **单一职责原则 (SRP)**
   - 每个模块只负责一个功能领域
   - `db.ts` 拆分为 `postgres.ts` 和 `redis.ts`

3. **接口隔离原则 (ISP)**
   - 端口定义最小化接口
   - 不强迫实现不需要的方法

4. **开闭原则 (OCP)**
   - 对扩展开放：新增平台只需实现接口
   - 对修改封闭：核心逻辑不受影响

#### 与现有设计决策的关系

| 设计决策 | 架构位置 | 说明 |
|---------|---------|------|
| D8: 平台易扩展架构 | 领域层 + 基础设施层 | 端口定义接口，适配器实现 |
| D9: 四层容错架构 | 应用层 | 管道中的过滤器实现 |
| D11: 配额管理架构 | 应用层 | QuotaService 封装 |
| D12: 数据模型设计 | 领域层 | 实体和值对象定义 |
| D13: Skill vs 传统代码 | 基础设施层 | 适配器选择不同实现 |

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| API限流：免费额度不足 | 分级优先级调度 + 第三方API降级 + 缓存复用 |
| 数据源失败：API不可用 | 多数据源备份 + 健康检查 + 自动降级 |
| 第三方依赖：服务商变更 | 多服务商备份 + 官方API优先 |
| 成本超支：调用量过大 | 配额告警 + 成本监控 + 智能调度 |
| 平台扩展：新平台接入 | YAML配置驱动，无需修改代码 |
| 数据一致性：多源数据差异 | 数据标准化层 + 质量校验 |

## Open Questions

1. **企业资质是否齐全？**
   - 淘宝TOP API、京东开放平台需要企业认证
   - Amazon SP-API 需要卖家账号
   - 建议优先确认资质再开发

2. **第三方服务商选择？**
   - 聚数塔 vs 易数 vs 蝉妈妈，哪家更适合？
   - 建议先用免费试用测试数据质量

3. **API调用量预估？**
   - 免费额度是否够用？
   - 建议先监控实际调用量再决定是否升级套餐

4. **历史数据初始化？**
   - 3-6个月历史数据从哪里获取？
   - 是否需要采购第三方数据？

5. **抖音数据源选择？**
   - 蝉妈妈API（付费，专业）vs douyin-hot-trend Skill（免费，基础）
   - 建议根据业务重要程度选择

## Module Specifications（模块化实现规范）

### 模块总览

| 模块 | 名称 | 职责 | 依赖 | 实现顺序 |
|------|------|------|------|---------|
| M0 | 基础设施 | Docker、环境配置、数据库容器 | 无 | 1 |
| M1 | 领域核心 | 类型定义、端口接口、实体值对象 | 无 | 2 |
| M2 | 存储层 | PostgreSQL 连接、Repository 实现 | M0, M1 | 3 |
| M3 | 缓存层 | Redis 连接、CacheProvider 实现 | M0, M1 | 3(并行) |
| M4 | 平台网关 | 平台适配器、数据获取、标准化 | M1 | 4 |
| M5 | 数据管道 | ETL 处理、去重、验证、转换 | M2, M3, M4 | 5 |
| M6 | 应用服务 | Use Case、QuotaService、AlertService | M1-M5 | 6 |
| M7 | 接口层 | CLI Tools、API 端点 | M6 | 7 |

---

### M0: 基础设施模块

**职责**：提供系统运行所需的基础设施配置

**依赖**：无

**输出**：
- `docker-compose.yml` - PostgreSQL + Redis 容器配置
- `init.sql` - 数据库初始化脚本
- `.env.example` - 环境变量模板

**验收标准**：
- [ ] `docker-compose up -d` 成功启动 PostgreSQL 和 Redis
- [ ] `psql -h localhost -U meichao -d meichao_ecom` 可连接
- [ ] `redis-cli -h localhost ping` 返回 PONG
- [ ] `products` 表已创建，包含所有字段和索引

**实现任务**：
```
M0.1 Create docker-compose.yml with PostgreSQL + Redis
M0.2 Create init.sql with products table schema
M0.3 Create .env.example with required environment variables
M0.4 Verify containers can start and connect
```

**文件清单**：
```
extensions/meichao-ecom/
├── docker-compose.yml
├── init.sql
└── .env.example
```

---

### M1: 领域核心模块

**职责**：定义业务实体、值对象和端口接口，不依赖任何外部框架

**依赖**：无

**输入**：业务需求（产品数据模型、数据源类型）

**输出**：
- `src/domain/types.ts` - 核心类型定义
- `src/domain/entities/Product.ts` - 产品实体
- `src/domain/value-objects/DataSource.ts` - 数据源值对象
- `src/domain/value-objects/Quota.ts` - 配额值对象
- `src/domain/ports/ProductRepository.ts` - 存储端口
- `src/domain/ports/PlatformGateway.ts` - 平台网关端口
- `src/domain/ports/CacheProvider.ts` - 缓存提供者端口

**验收标准**：
- [ ] 所有类型定义无外部依赖（除 TypeScript 标准库）
- [ ] 端口接口只有方法签名，无实现
- [ ] 实体包含业务规则验证方法
- [ ] 值对象不可变且有验证逻辑

**实现任务**：
```
M1.1 Create src/domain/types.ts with Platform, ProductStatus, etc.
M1.2 Create src/domain/entities/Product.ts with validation
M1.3 Create src/domain/value-objects/DataSource.ts
M1.4 Create src/domain/value-objects/Quota.ts
M1.5 Create src/domain/ports/ProductRepository.ts interface
M1.6 Create src/domain/ports/PlatformGateway.ts interface
M1.7 Create src/domain/ports/CacheProvider.ts interface
M1.8 Write unit tests for entity validation
M1.9 Write unit tests for value object validation
```

**文件清单**：
```
extensions/meichao-ecom/src/domain/
├── types.ts
├── entities/
│   └── Product.ts
├── value-objects/
│   ├── DataSource.ts
│   └── Quota.ts
└── ports/
    ├── ProductRepository.ts
    ├── PlatformGateway.ts
    └── CacheProvider.ts
```

---

### M2: 存储层模块

**职责**：实现 PostgreSQL 数据存储，提供 Repository 实现

**依赖**：M0（基础设施）、M1（领域核心）

**输入**：
- M1 的 `ProductRepository` 端口接口
- M1 的 `Product` 实体定义

**输出**：
- `src/infrastructure/storage/postgres.ts` - PostgreSQL 连接管理
- `src/infrastructure/storage/ProductRepository.ts` - Repository 实现
- `src/infrastructure/storage/migrations/` - 数据库迁移脚本

**验收标准**：
- [ ] `PostgresConnection.connect()` 可建立连接池
- [ ] `PostgresConnection.healthCheck()` 返回正确状态
- [ ] `ProductRepository.create()` 可插入产品并返回 ID
- [ ] `ProductRepository.findById()` 可查询产品
- [ ] `ProductRepository.findByPlatformId()` 可按平台 ID 查询
- [ ] `ProductRepository.upsert()` 可插入或更新
- [ ] 事务支持正确（ROLLBACK 可回滚）
- [ ] 单元测试覆盖率 ≥ 80%

**实现任务**：
```
M2.1 Create src/infrastructure/storage/postgres.ts with connection pool
M2.2 Create src/infrastructure/storage/ProductRepository.ts
M2.3 Implement create() method
M2.4 Implement findById() method
M2.5 Implement findByPlatformId() method
M2.6 Implement findMany() method with pagination
M2.7 Implement update() method
M2.8 Implement upsert() method
M2.9 Implement delete() method
M2.10 Implement transaction support
M2.11 Write unit tests with mock database
M2.12 Write integration tests with real database
```

**文件清单**：
```
extensions/meichao-ecom/src/infrastructure/storage/
├── postgres.ts
├── ProductRepository.ts
└── migrations/
    └── 001_initial_schema.sql
```

---

### M3: 缓存层模块

**职责**：实现 Redis 缓存，提供 CacheProvider 实现

**依赖**：M0（基础设施）、M1（领域核心）

**输入**：
- M1 的 `CacheProvider` 端口接口
- 缓存配置（TTL、key prefix）

**输出**：
- `src/infrastructure/cache/redis.ts` - Redis 连接管理
- `src/infrastructure/cache/CacheProvider.ts` - CacheProvider 实现

**验收标准**：
- [ ] `RedisConnection.connect()` 可建立连接
- [ ] `RedisConnection.healthCheck()` 返回正确状态
- [ ] `CacheProvider.get()` 可获取缓存值
- [ ] `CacheProvider.set()` 可设置缓存值（带 TTL）
- [ ] `CacheProvider.delete()` 可删除缓存
- [ ] `CacheProvider.getJson()` 可获取 JSON 缓存
- [ ] 缓存 key 支持 namespace prefix
- [ ] 单元测试覆盖率 ≥ 80%

**实现任务**：
```
M3.1 Create src/infrastructure/cache/redis.ts with connection
M3.2 Create src/infrastructure/cache/CacheProvider.ts
M3.3 Implement get() method
M3.4 Implement set() method with TTL support
M3.5 Implement delete() method
M3.6 Implement getJson/setJson methods
M3.7 Implement getStats() method
M3.8 Write unit tests with mock Redis
M3.9 Write integration tests with real Redis
```

**文件清单**：
```
extensions/meichao-ecom/src/infrastructure/cache/
├── redis.ts
└── CacheProvider.ts
```

---

### M4: 平台网关模块

**职责**：实现各电商平台的数据获取适配器

**依赖**：M1（领域核心 - 端口接口）

**输入**：
- M1 的 `PlatformGateway` 端口接口
- 各平台 API 文档

**输出**：
- `src/infrastructure/adapters/BasePlatformAdapter.ts` - 抽象基类
- `src/infrastructure/adapters/taobao/` - 淘宝适配器
- `src/infrastructure/adapters/amazon/` - 亚马逊适配器
- `src/infrastructure/adapters/douyin/` - 抖音适配器
- `src/infrastructure/adapters/1688/` - 1688 适配器
- `src/infrastructure/adapters/shopee/` - Shopee 适配器
- `src/infrastructure/registry/PlatformRegistry.ts` - 适配器注册表

**验收标准**：
- [ ] `BasePlatformAdapter` 定义统一接口
- [ ] 每个适配器实现 `fetchProduct()` 方法
- [ ] 每个适配器实现 `normalizeData()` 方法
- [ ] 每个适配器实现 `extractExtraData()` 方法
- [ ] 多数据源选择逻辑正确（优先级排序）
- [ ] 重试机制工作正常（指数退避）
- [ ] `PlatformRegistry` 可注册和获取适配器
- [ ] 单元测试覆盖率 ≥ 80%

**实现任务**：
```
M4.1 Create src/infrastructure/adapters/BasePlatformAdapter.ts
M4.2 Create src/infrastructure/registry/PlatformRegistry.ts
M4.3 Create TaobaoAdapter with normalizeData and extractExtraData
M4.4 Create AmazonAdapter with normalizeData and extractExtraData
M4.5 Create DouyinAdapter with normalizeData and extractExtraData
M4.6 Create Adapter1688 with normalizeData and extractExtraData
M4.7 Create ShopeeAdapter with normalizeData and extractExtraData
M4.8 Implement selectDataSource() method with priority
M4.9 Implement withRetry() method with exponential backoff
M4.10 Implement healthCheck() method
M4.11 Write unit tests for each adapter
M4.12 Write integration tests with mock API responses
```

**文件清单**：
```
extensions/meichao-ecom/src/infrastructure/
├── adapters/
│   ├── BasePlatformAdapter.ts
│   ├── taobao/
│   │   ├── index.ts
│   │   ├── types.ts
│   │   └── normalizer.ts
│   ├── amazon/
│   │   ├── index.ts
│   │   ├── types.ts
│   │   └── normalizer.ts
│   ├── douyin/
│   │   ├── index.ts
│   │   ├── types.ts
│   │   └── normalizer.ts
│   ├── 1688/
│   │   ├── index.ts
│   │   ├── types.ts
│   │   └── normalizer.ts
│   └── shopee/
│       ├── index.ts
│       ├── types.ts
│       └── normalizer.ts
└── registry/
    └── PlatformRegistry.ts
```

---

### M5: 数据管道模块

**职责**：实现 ETL 数据处理管道

**依赖**：M2（存储层）、M3（缓存层）、M4（平台网关）

**输入**：
- 原始商品数据（从 M4 获取）
- 缓存提供者（M3）
- 存储仓库（M2）

**输出**：
- `src/application/pipeline/DataPipeline.ts` - 管道编排器
- `src/application/pipeline/filters/FetchFilter.ts` - 数据获取过滤器
- `src/application/pipeline/filters/ValidateFilter.ts` - 数据验证过滤器
- `src/application/pipeline/filters/NormalizeFilter.ts` - 数据标准化过滤器
- `src/application/pipeline/filters/DedupeFilter.ts` - 去重过滤器
- `src/application/pipeline/filters/StoreFilter.ts` - 存储过滤器
- `src/application/pipeline/filters/CacheFilter.ts` - 缓存过滤器

**验收标准**：
- [ ] 管道可按顺序执行所有过滤器
- [ ] 每个过滤器可独立测试
- [ ] 数据验证规则正确（必填字段、类型检查）
- [ ] 去重逻辑正确（按 platform + platformId）
- [ ] 缓存命中时跳过获取
- [ ] 失败时返回详细错误信息
- [ ] 管道执行指标可监控（耗时、成功率）
- [ ] 单元测试覆盖率 ≥ 80%

**实现任务**：
```
M5.1 Create src/application/pipeline/DataPipeline.ts orchestrator
M5.2 Create src/application/pipeline/filters/FetchFilter.ts
M5.3 Create src/application/pipeline/filters/ValidateFilter.ts
M5.4 Create src/application/pipeline/filters/NormalizeFilter.ts
M5.5 Create src/application/pipeline/filters/DedupeFilter.ts
M5.6 Create src/application/pipeline/filters/StoreFilter.ts
M5.7 Create src/application/pipeline/filters/CacheFilter.ts
M5.8 Implement pipeline execution with error handling
M5.9 Implement pipeline metrics collection
M5.10 Write unit tests for each filter
M5.11 Write integration tests for full pipeline
```

**文件清单**：
```
extensions/meichao-ecom/src/application/pipeline/
├── DataPipeline.ts
├── types.ts
└── filters/
    ├── FetchFilter.ts
    ├── ValidateFilter.ts
    ├── NormalizeFilter.ts
    ├── DedupeFilter.ts
    ├── StoreFilter.ts
    └── CacheFilter.ts
```

---

### M6: 应用服务模块

**职责**：实现业务用例和跨模块协调

**依赖**：M1-M5 所有模块

**输入**：
- 所有下层模块的服务和接口

**输出**：
- `src/application/use-cases/FetchProductUseCase.ts`
- `src/application/use-cases/SearchProductsUseCase.ts`
- `src/application/use-cases/SyncProductsUseCase.ts`
- `src/application/services/QuotaService.ts`
- `src/application/services/AlertService.ts`
- `src/application/services/SchedulerService.ts`
- `src/application/container/Container.ts` - 依赖注入容器

**验收标准**：
- [ ] `FetchProductUseCase` 可获取并存储单个产品
- [ ] `SearchProductsUseCase` 可搜索并存储多个产品
- [ ] `QuotaService` 可跟踪配额使用
- [ ] `AlertService` 可发送告警通知
- [ ] 依赖注入容器正确组装所有依赖
- [ ] 服务可独立测试（使用 mock 依赖）
- [ ] 单元测试覆盖率 ≥ 80%

**实现任务**：
```
M6.1 Create src/application/container/Container.ts (simple DI)
M6.2 Create src/application/use-cases/FetchProductUseCase.ts
M6.3 Create src/application/use-cases/SearchProductsUseCase.ts
M6.4 Create src/application/use-cases/SyncProductsUseCase.ts
M6.5 Create src/application/services/QuotaService.ts
M6.6 Create src/application/services/AlertService.ts
M6.7 Create src/application/services/SchedulerService.ts
M6.8 Implement container bindings
M6.9 Write unit tests for use cases
M6.10 Write unit tests for services
```

**文件清单**：
```
extensions/meichao-ecom/src/application/
├── container/
│   └── Container.ts
├── use-cases/
│   ├── FetchProductUseCase.ts
│   ├── SearchProductsUseCase.ts
│   └── SyncProductsUseCase.ts
└── services/
    ├── QuotaService.ts
    ├── AlertService.ts
    └── SchedulerService.ts
```

---

### M7: 接口层模块

**职责**：实现 CLI Tools 和 API 端点

**依赖**：M6（应用服务）

**输入**：
- M6 的 Use Cases 和 Services

**输出**：
- `src/interfaces/tools/ProductFetchTool.ts`
- `src/interfaces/tools/ProductSearchTool.ts`
- `src/interfaces/tools/PlatformStatusTool.ts`
- `src/interfaces/tools/QuotaStatusTool.ts`
- `index.ts` - 插件入口

**验收标准**：
- [ ] 所有 Tool 正确注册到 OpenClaw
- [ ] `product_fetch` Tool 可获取产品
- [ ] `product_search` Tool 可搜索产品
- [ ] `platform_status` Tool 返回平台状态
- [ ] `quota_status` Tool 返回配额状态
- [ ] 错误处理返回友好消息
- [ ] 插件可正确加载和初始化

**实现任务**：
```
M7.1 Create src/interfaces/tools/ProductFetchTool.ts
M7.2 Create src/interfaces/tools/ProductSearchTool.ts
M7.3 Create src/interfaces/tools/PlatformStatusTool.ts
M7.4 Create src/interfaces/tools/QuotaStatusTool.ts
M7.5 Create index.ts with plugin registration
M7.6 Implement initializePlatform() function
M7.7 Implement shutdownPlatform() function
M7.8 Write integration tests for tools
```

**文件清单**：
```
extensions/meichao-ecom/
├── index.ts
└── src/interfaces/tools/
    ├── ProductFetchTool.ts
    ├── ProductSearchTool.ts
    ├── PlatformStatusTool.ts
    └── QuotaStatusTool.ts
```

---

### 模块依赖关系图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           模块依赖关系（DAG）                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│     M0: 基础设施                                                            │
│         │                                                                   │
│         ├────────────────────┬────────────────────┐                        │
│         │                    │                    │                        │
│         ▼                    ▼                    ▼                        │
│     M2: 存储层          M3: 缓存层          M1: 领域核心                    │
│         │                    │                    │                         │
│         │                    │                    │                         │
│         │                    │                    ▼                         │
│         │                    │              M4: 平台网关                    │
│         │                    │                    │                         │
│         └────────────────────┴────────────────────┘                        │
│                              │                                              │
│                              ▼                                              │
│                        M5: 数据管道                                         │
│                              │                                              │
│                              ▼                                              │
│                        M6: 应用服务                                         │
│                              │                                              │
│                              ▼                                              │
│                        M7: 接口层                                           │
│                                                                             │
│   关键路径：M0 → M1 → M4 → M5 → M6 → M7                                     │
│   并行路径：M2 + M3 可在 M1 完成后并行实现                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 实现顺序与里程碑

| 阶段 | 模块 | 预计时间 | 里程碑 |
|------|------|---------|--------|
| **Phase 0** | M0: 基础设施 | 1天 | Docker 环境可用 |
| **Phase 1** | M1: 领域核心 | 2天 | 类型系统完成，可独立编译 |
| **Phase 2** | M2+M3: 存储与缓存 | 2天 | 数据可存取 |
| **Phase 3** | M4: 平台网关 | 3天 | 可从平台获取数据 |
| **Phase 4** | M5: 数据管道 | 2天 | 数据处理流程完整 |
| **Phase 5** | M6: 应用服务 | 2天 | 业务逻辑完整 |
| **Phase 6** | M7: 接口层 | 1天 | 插件可加载运行 |

**总计：约 13 个工作日**

---

## Test Specifications（测试规范）

### 测试策略总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         测试金字塔                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                          ┌─────────────┐                                    │
│                          │   E2E 测试   │  (M7: 接口层)                     │
│                          │   数量: 少   │                                    │
│                          └──────┬──────┘                                    │
│                                 │                                           │
│                     ┌───────────┴───────────┐                               │
│                     │      集成测试          │  (M5, M6: 管道、服务)         │
│                     │      数量: 中         │                               │
│                     └───────────┬───────────┘                               │
│                                 │                                           │
│           ┌─────────────────────┴─────────────────────┐                     │
│           │                单元测试                    │  (M1-M4: 核心)     │
│           │                数量: 多                   │                     │
│           └───────────────────────────────────────────┘                     │
│                                                                             │
│   测试原则：                                                                 │
│   1. 依赖通过接口注入，便于 mock                                            │
│   2. 每个模块有独立的测试目录                                               │
│   3. 单元测试不依赖外部服务（数据库、Redis、API）                            │
│   4. 集成测试使用 Docker Testcontainers                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 模块测试矩阵

| 模块 | 单元测试 | 集成测试 | E2E测试 | Mock依赖 |
|------|---------|---------|---------|---------|
| M0: 基础设施 | ❌ | ✅ | ❌ | 无 |
| M1: 领域核心 | ✅ | ❌ | ❌ | 无（无依赖） |
| M2: 存储层 | ✅ | ✅ | ❌ | Mock: ProductRepository接口 |
| M3: 缓存层 | ✅ | ✅ | ❌ | Mock: CacheProvider接口 |
| M4: 平台网关 | ✅ | ✅ | ❌ | Mock: PlatformGateway接口 |
| M5: 数据管道 | ✅ | ✅ | ❌ | Mock: M2, M3, M4 |
| M6: 应用服务 | ✅ | ✅ | ❌ | Mock: M1-M5 |
| M7: 接口层 | ❌ | ✅ | ✅ | Mock: M6 |

---

### M1: 领域核心 - 测试规范

**测试边界**：
- 测试类型定义的正确性
- 测试实体的验证逻辑
- 测试值对象的不变性和验证
- 不测试：接口定义（TypeScript 编译器保证）

**测试目录**：
```
extensions/meichao-ecom/src/domain/
├── __tests__/
│   ├── types.test.ts
│   ├── entities/
│   │   └── Product.test.ts
│   └── value-objects/
│       ├── DataSource.test.ts
│       └── Quota.test.ts
```

**测试用例**：

```typescript
// Product.test.ts
describe('Product Entity', () => {
  describe('create', () => {
    it('should create product with valid data')
    it('should throw error if platform is missing')
    it('should throw error if platformId is missing')
    it('should throw error if title is empty')
    it('should throw error if price is negative')
    it('should set default values for optional fields')
  })

  describe('update', () => {
    it('should update price and set priceUpdatedAt')
    it('should update sales and set salesUpdatedAt')
    it('should not update platform or platformId')
  })

  describe('markAsTrending', () => {
    it('should set isTrending to true')
    it('should set priority to P0')
  })
})

// DataSource.test.ts
describe('DataSource Value Object', () => {
  describe('create', () => {
    it('should create with valid data')
    it('should throw error if type is invalid')
    it('should throw error if priority is negative')
    it('should be immutable')
  })

  describe('hasRemainingQuota', () => {
    it('should return true if usedQuota < dailyQuota')
    it('should return false if usedQuota >= dailyQuota')
  })
})

// Quota.test.ts
describe('Quota Value Object', () => {
  describe('create', () => {
    it('should create with valid data')
    it('should throw error if dailyQuota is zero or negative')
    it('should be immutable')
  })

  describe('isOverLimit', () => {
    it('should return true if percentUsed >= 100%')
    it('should return false if percentUsed < 100%')
  })

  describe('isNearLimit', () => {
    it('should return true if percentUsed >= 80%')
    it('should return false if percentUsed < 80%')
  })
})
```

**测试命令**：
```bash
# 仅测试 M1 模块
pnpm test -- src/domain/__tests__/

# 覆盖率报告
pnpm test:coverage -- src/domain/__tests__/
```

**验收标准**：
- [ ] 所有测试通过
- [ ] 覆盖率 ≥ 90%
- [ ] 无外部依赖（不连接数据库/Redis）
- [ ] 测试执行时间 < 1 秒

---

### M2: 存储层 - 测试规范

**测试边界**：
- 单元测试：Repository 逻辑（使用 mock 数据库连接）
- 集成测试：真实 PostgreSQL 操作（使用 Testcontainers）
- 不测试：pg 库本身（第三方库）

**测试目录**：
```
extensions/meichao-ecom/src/infrastructure/storage/
├── __tests__/
│   ├── postgres.test.ts          # 单元测试
│   ├── ProductRepository.test.ts # 单元测试
│   └── __integration__/
│       └── ProductRepository.integration.test.ts
```

**Mock 策略**：

```typescript
// __mocks__/ProductRepository.ts
export class MockProductRepository implements ProductRepository {
  private products: Map<string, Product> = new Map()

  async create(data: ProductCreate): Promise<Product> {
    const product = { id: Math.random(), ...data }
    const key = `${data.platform}:${data.platformId}`
    this.products.set(key, product)
    return product
  }

  async findById(id: number): Promise<Product | null> {
    for (const product of this.products.values()) {
      if (product.id === id) return product
    }
    return null
  }

  async findByPlatformId(platform: string, platformId: string): Promise<Product | null> {
    return this.products.get(`${platform}:${platformId}`) || null
  }

  // ... 其他方法
}
```

**测试用例**：

```typescript
// ProductRepository.test.ts (单元测试)
describe('ProductRepository', () => {
  let repository: ProductRepository
  let mockDb: MockDatabase

  beforeEach(() => {
    mockDb = new MockDatabase()
    repository = new ProductRepository(mockDb)
  })

  describe('create', () => {
    it('should insert product and return with id')
    it('should throw DatabaseError on constraint violation')
    it('should set createdAt and updatedAt timestamps')
  })

  describe('findById', () => {
    it('should return product if exists')
    it('should return null if not exists')
    it('should parse JSONB fields correctly')
  })

  describe('findByPlatformId', () => {
    it('should find by platform and platformId')
    it('should return null if not found')
  })

  describe('upsert', () => {
    it('should insert new product')
    it('should update existing product')
    it('should not change id on update')
    it('should update updatedAt timestamp')
  })

  describe('transaction', () => {
    it('should commit on success')
    it('should rollback on error')
  })
})

// ProductRepository.integration.test.ts (集成测试)
describe('ProductRepository Integration', () => {
  let container: PostgreSqlContainer
  let repository: ProductRepository

  beforeAll(async () => {
    container = await new PostgreSqlContainer().start()
    const connection = new PostgresConnection(container.getConnectionUri())
    await connection.connect()
    repository = new ProductRepository(connection)
  })

  afterAll(async () => {
    await container.stop()
  })

  beforeEach(async () => {
    await repository.deleteAll()
  })

  it('should persist and retrieve product')
  it('should handle concurrent upserts correctly')
  it('should respect unique constraint on platform+platformId')
})
```

**测试命令**：
```bash
# 单元测试（无数据库）
pnpm test -- src/infrastructure/storage/__tests__/ProductRepository.test.ts

# 集成测试（需要 Docker）
pnpm test -- src/infrastructure/storage/__tests__/__integration__/
```

**验收标准**：
- [ ] 单元测试覆盖率 ≥ 80%
- [ ] 集成测试覆盖 CRUD 操作
- [ ] 单元测试执行时间 < 2 秒
- [ ] 集成测试执行时间 < 10 秒

---

### M3: 缓存层 - 测试规范

**测试边界**：
- 单元测试：缓存逻辑（使用 mock Redis）
- 集成测试：真实 Redis 操作
- 不测试：ioredis 库本身

**测试目录**：
```
extensions/meichao-ecom/src/infrastructure/cache/
├── __tests__/
│   ├── redis.test.ts
│   ├── CacheProvider.test.ts
│   └── __integration__/
│       └── CacheProvider.integration.test.ts
```

**Mock 策略**：

```typescript
// __mocks__/CacheProvider.ts
export class MockCacheProvider implements CacheProvider {
  private cache: Map<string, { value: string; expiresAt?: number }> = new Map()

  async get(key: string): Promise<string | null> {
    const entry = this.cache.get(key)
    if (!entry) return null
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }
    return entry.value
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.cache.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    })
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key)
  }

  // ... 其他方法
}
```

**测试用例**：

```typescript
// CacheProvider.test.ts
describe('CacheProvider', () => {
  let provider: CacheProvider
  let mockRedis: MockRedis

  beforeEach(() => {
    mockRedis = new MockRedis()
    provider = new CacheProvider(mockRedis)
  })

  describe('get/set', () => {
    it('should store and retrieve value')
    it('should return null for non-existent key')
    it('should respect TTL expiration')
  })

  describe('getJson/setJson', () => {
    it('should serialize object to JSON')
    it('should deserialize JSON to object')
    it('should return null for invalid JSON')
  })

  describe('key prefix', () => {
    it('should add prefix to all keys')
    it('should not duplicate prefix')
  })
})

// CacheProvider.integration.test.ts
describe('CacheProvider Integration', () => {
  let container: GenericContainer
  let provider: CacheProvider

  beforeAll(async () => {
    container = await new GenericContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .start()
    // ... setup
  })

  it('should connect to Redis')
  it('should handle connection errors gracefully')
  it('should support concurrent operations')
})
```

**验收标准**：
- [ ] 单元测试覆盖率 ≥ 80%
- [ ] TTL 过期逻辑正确
- [ ] 单元测试执行时间 < 1 秒

---

### M4: 平台网关 - 测试规范

**测试边界**：
- 单元测试：数据标准化、数据源选择、重试逻辑
- 集成测试：真实 API 调用（使用 mock server）
- 不测试：第三方 API 的可用性

**测试目录**：
```
extensions/meichao-ecom/src/infrastructure/adapters/
├── __tests__/
│   ├── BasePlatformAdapter.test.ts
│   ├── TaobaoAdapter.test.ts
│   ├── AmazonAdapter.test.ts
│   └── __integration__/
│       └── adapters.integration.test.ts
```

**Mock 策略**：

```typescript
// __mocks__/PlatformGateway.ts
export class MockPlatformGateway implements PlatformGateway {
  private responses: Map<string, ProductData> = new Map()

  setMockResponse(platformId: string, data: ProductData) {
    this.responses.set(platformId, data)
  }

  async fetchProduct(platformId: string): Promise<FetchResult<ProductData>> {
    const data = this.responses.get(platformId)
    if (data) {
      return { success: true, data, source: 'mock', latencyMs: 0, cached: false }
    }
    return { success: false, error: 'Not found', source: 'mock', latencyMs: 0, cached: false }
  }
}
```

**测试用例**：

```typescript
// TaobaoAdapter.test.ts
describe('TaobaoAdapter', () => {
  let adapter: TaobaoAdapter

  beforeEach(() => {
    adapter = new TaobaoAdapter()
  })

  describe('normalizeData', () => {
    it('should convert taobao raw data to ProductData')
    it('should handle missing optional fields')
    it('should parse price string to number')
    it('should set default currency to CNY')
  })

  describe('extractExtraData', () => {
    it('should extract commission info')
    it('should extract coupon info')
    it('should extract live info')
    it('should return empty object if no extra fields')
  })

  describe('selectDataSource', () => {
    it('should select highest priority available source')
    it('should respect preferred source if available')
    it('should skip sources with exhausted quota')
    it('should return null if no sources available')
  })

  describe('withRetry', () => {
    it('should retry on failure')
    it('should use exponential backoff')
    it('should throw after max attempts')
    it('should succeed if retry succeeds')
  })
})

// BasePlatformAdapter.test.ts
describe('BasePlatformAdapter', () => {
  describe('healthCheck', () => {
    it('should return true if any source available')
    it('should return false if all sources exhausted')
    it('should return false if all sources unavailable')
  })
})
```

**验收标准**：
- [ ] 每个适配器有独立测试
- [ ] 标准化逻辑覆盖率 100%
- [ ] 重试逻辑验证正确
- [ ] 单元测试执行时间 < 2 秒

---

### M5: 数据管道 - 测试规范

**测试边界**：
- 单元测试：每个过滤器的独立逻辑
- 集成测试：完整管道执行
- Mock：存储层、缓存层、平台网关

**测试目录**：
```
extensions/meichao-ecom/src/application/pipeline/
├── __tests__/
│   ├── DataPipeline.test.ts
│   ├── filters/
│   │   ├── FetchFilter.test.ts
│   │   ├── ValidateFilter.test.ts
│   │   ├── NormalizeFilter.test.ts
│   │   ├── DedupeFilter.test.ts
│   │   └── StoreFilter.test.ts
│   └── __integration__/
│       └── pipeline.integration.test.ts
```

**测试用例**：

```typescript
// ValidateFilter.test.ts
describe('ValidateFilter', () => {
  let filter: ValidateFilter

  beforeEach(() => {
    filter = new ValidateFilter()
  })

  describe('validate', () => {
    it('should pass valid product data')
    it('should fail if platform is missing')
    it('should fail if platformId is missing')
    it('should fail if title is empty')
    it('should fail if price is negative')
    it('should warn if rating out of range')
  })
})

// DedupeFilter.test.ts
describe('DedupeFilter', () => {
  it('should detect duplicate by platform+platformId')
  it('should keep latest record for duplicates')
  it('should handle empty input')
})

// DataPipeline.test.ts
describe('DataPipeline', () => {
  it('should execute filters in order')
  it('should stop on first failure')
  it('should collect metrics')
  it('should handle errors gracefully')
  it('should skip cache on force refresh')
})
```

**Mock 注入示例**：

```typescript
// pipeline.test.ts
describe('DataPipeline', () => {
  let pipeline: DataPipeline
  let mockRepo: MockProductRepository
  let mockCache: MockCacheProvider
  let mockGateway: MockPlatformGateway

  beforeEach(() => {
    mockRepo = new MockProductRepository()
    mockCache = new MockCacheProvider()
    mockGateway = new MockPlatformGateway()
    
    pipeline = new DataPipeline({
      repository: mockRepo,
      cache: mockCache,
      gateway: mockGateway,
    })
  })

  it('should fetch, validate, and store product', async () => {
    mockGateway.setMockResponse('123', mockProductData)
    
    const result = await pipeline.execute('taobao', '123')
    
    expect(result.success).toBe(true)
    expect(mockRepo.findById).toHaveBeenCalledWith(expect.any(Number))
  })
})
```

**验收标准**：
- [ ] 每个过滤器独立测试
- [ ] 管道集成测试覆盖完整流程
- [ ] Mock 正确隔离依赖
- [ ] 单元测试执行时间 < 3 秒

---

### M6: 应用服务 - 测试规范

**测试边界**：
- 单元测试：用例逻辑、服务逻辑
- 集成测试：服务间协调
- Mock：所有下层模块

**测试目录**：
```
extensions/meichao-ecom/src/application/
├── __tests__/
│   ├── use-cases/
│   │   ├── FetchProductUseCase.test.ts
│   │   └── SearchProductsUseCase.test.ts
│   └── services/
│       ├── QuotaService.test.ts
│       └── AlertService.test.ts
```

**测试用例**：

```typescript
// FetchProductUseCase.test.ts
describe('FetchProductUseCase', () => {
  let useCase: FetchProductUseCase
  let mockPipeline: MockDataPipeline
  let mockQuota: MockQuotaService

  beforeEach(() => {
    mockPipeline = new MockDataPipeline()
    mockQuota = new MockQuotaService()
    useCase = new FetchProductUseCase(mockPipeline, mockQuota)
  })

  describe('execute', () => {
    it('should fetch product from pipeline')
    it('should increment quota on success')
    it('should not increment quota on failure')
    it('should return cached result if available')
    it('should force refresh if requested')
  })
})

// QuotaService.test.ts
describe('QuotaService', () => {
  it('should track quota per source')
  it('should alert when quota reaches 80%')
  it('should alert when quota reaches 95%')
  it('should reset quota daily')
  it('should check if can use quota')
})
```

**验收标准**：
- [ ] 每个用例有独立测试
- [ ] Mock 隔离所有依赖
- [ ] 单元测试执行时间 < 2 秒

---

### M7: 接口层 - 测试规范

**测试边界**：
- 集成测试：Tool 注册和执行
- E2E 测试：完整用户流程

**测试目录**：
```
extensions/meichao-ecom/
├── __tests__/
│   ├── tools.test.ts
│   └── e2e/
│       └── plugin.e2e.test.ts
```

**测试用例**：

```typescript
// tools.test.ts
describe('CLI Tools', () => {
  describe('product_fetch', () => {
    it('should fetch product from valid platform')
    it('should return error for invalid platform')
    it('should handle network errors')
  })

  describe('platform_status', () => {
    it('should return status of all platforms')
    it('should show healthy/unhealthy status')
  })
})

// plugin.e2e.test.ts
describe('Plugin E2E', () => {
  it('should load plugin successfully')
  it('should register all tools')
  it('should initialize dependencies')
  it('should shutdown gracefully')
})
```

**验收标准**：
- [ ] 所有 Tool 可执行
- [ ] 错误消息友好
- [ ] 插件可加载/卸载

---

### 测试工具和配置

**依赖安装**：
```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@vitest/coverage-v8": "^1.0.0",
    "testcontainers": "^10.0.0",
    "msw": "^2.0.0"
  }
}
```

**Vitest 配置**：
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    exclude: ['**/__integration__/**', '**/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/__tests__/**', '**/__mocks__/**'],
    },
  },
})
```

**测试脚本**：
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:unit": "vitest run --exclude '**/__integration__/**'",
    "test:integration": "vitest run '**/__integration__/**'",
    "test:e2e": "vitest run '**/e2e/**'"
  }
}
```

---

### 测试数据 Fixtures

```
extensions/meichao-ecom/src/__fixtures__/
├── products.ts
│   ├── mockTaobaoProduct
│   ├── mockAmazonProduct
│   └── mockDouyinProduct
├── adapters.ts
│   ├── mockTaobaoRawData
│   └── mockAmazonRawData
└── errors.ts
    ├── mockNetworkError
    └── mockQuotaExceededError
```

---

### 测试覆盖率目标

| 模块 | 行覆盖率 | 分支覆盖率 | 函数覆盖率 |
|------|---------|-----------|-----------|
| M1: 领域核心 | 95% | 90% | 100% |
| M2: 存储层 | 85% | 80% | 90% |
| M3: 缓存层 | 85% | 80% | 90% |
| M4: 平台网关 | 85% | 80% | 90% |
| M5: 数据管道 | 85% | 80% | 90% |
| M6: 应用服务 | 85% | 80% | 90% |
| M7: 接口层 | 75% | 70% | 80% |
| **总体** | **85%** | **80%** | **90%** |