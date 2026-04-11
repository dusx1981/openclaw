---
name: ecom-ai-workspace
description: 全链路电商AI智能运营工作台，类似淘天"龙虾"工作台。支持智能选品、价格监控、广告优化、自动巡检、素材生成等完整电商运营能力。Use when building an e-commerce AI operation platform on OpenClaw.
---

# 电商AI工作台 E-commerce AI Workspace

基于OpenClaw构建全链路电商AI智能运营体系，实现"分析→决策→执行→优化"全自动闭环。

## 架构概述

### 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                   应用层 (Application Layer)                │
├─────────────────────────────────────────────────────────────┤
│  ecom-ai-selection  │  ecom-ai-price-monitor  │  ecom-ai-adoptimize  │
│  ecom-ai-creative   │  ecom-ai-customer-service  │  ecom-ai-shop-inspect  │
├─────────────────────────────────────────────────────────────┤
│                   数据层 (Data Layer)                       │
├─────────────────────────────────────────────────────────────┤
│  ecom-product-search  │  ecom-product-fetch  │  taobao-shop-sync  │  order-data-fetch  │
├─────────────────────────────────────────────────────────────┤
│              OpenClaw 核心能力 (Core Capabilities)          │
├─────────────────────────────────────────────────────────────┤
│  cron  │  subagent  │  message  │  browser  │  image  │  image_generate  │  web_search  │
└─────────────────────────────────────────────────────────────┘
```

## 核心工作流

### 全自动运营闭环

```
1. 定时触发 (cron)
   ↓
2. 数据采集
   • 拉取本店商品/订单数据
   • 爬取竞品价格/销量数据
   • 获取市场趋势热搜词
   ↓
3. AI分析决策 (subagent)
   • 分析市场需求、竞争格局
   • 生成优化策略/行动方案
   ↓
4. 商家确认 (message 通知)
   ↓
5. 自动执行 (API调用)
   • 调整价格
   • 更新广告预算
   • 重发商品素材
   ↓
6. 监控优化 (循环)
   • 监测效果数据
   • AI持续优化调整
```

## 各技能详细设计

### 1. 数据层技能

#### 1.1 `taobao-shop-sync` - 淘宝店铺数据同步

**触发条件**：

- 定时每日同步
- 手动触发单次同步

**工作流程**：

```
1. 调用淘宝开放平台API
   - 获取店铺商品列表
   - 获取库存信息
   - 获取价格信息
2. 保存到本地/云端数据库
3. 校验数据完整性
4. 发现异常(价格突变/库存为零)触发通知
```

**配置项**：

```json
{
  "taobao": {
    "appKey": "xxx",
    "appSecret": "xxx",
    "shopId": "xxx",
    "syncIntervalHours": 24
  }
}
```

**SKILL模板**：参见 [references/taobao-shop-sync.md](references/taobao-shop-sync.md)

#### 1.2 `order-data-fetch` - 订单数据拉取

**功能**：

- 拉取订单列表
- 统计销量/转化率/客单价
- 识别异常订单

**输出**：CSV/JSON格式报表，存入memory供分析使用

---

### 2. AI运营能力层技能

#### 2.1 `ecom-ai-selection` - 智能选品测款

**触发场景**：

- 商家问"帮我选几款潜力新品"
- 定时每周自动分析市场热点

**工作流程**：

```
1. 关键词采集
   • web_search 抓取行业热词
   • ecom-product-search 搜索同类热销商品

2. 数据分析
   • 统计价格区间分布
   • 分析销量排名
   • 识别市场空白

3. AI评分
   • 竞争度评分
   • 利润空间预测
   • 供应链可行性评估

4. 输出报告
   • TOP N推荐列表
   • 建议定价区间
   • 差异化卖点建议
```

**工具依赖**：`ecom-product-search`, `web_search`, `sessions_spawn`

**使用示例**：

```
帮我在淘宝搜索"夏季女装连衣裙"，推荐10个潜力新品方向
```

#### 2.2 `ecom-ai-price-monitor` - 价格动态监测与调整

**触发条件**：`cron` 每日/每6小时定时执行

**工作流程**：

```
1. 数据采集
   • 获取本店商品当前价格
   • 对标注"需监控"的商品，搜索竞品同款价格

2. 规则判断
   • 竞品降价超过X%？
   • 竞品参加平台活动？
   • 是否在价格保护期？

3. 决策生成
   • 保持原价/跟进降价/保持差距
   • 计算新价格和预期利润
   • 生成调整方案

4. 执行
   • 中小价格变动自动执行
   • 大变动脉搏商家确认后执行
   • 通过API更新淘宝价格
```

**商家配置示例**：

```yaml
monitor:
  - itemId: 12345678
    currentPrice: 199
    minPrice: 120
    maxPrice: 249
    followThreshold: 5%
    autoAdjust: true
```

#### 2.3 `ecom-ai-adoptimize` - 广告投放智能优化

**核心逻辑**：

```
每日优化循环：
1. 获取各计划曝光/点击/转化/ROI数据
2. 聚类分析：高转化词/低转化词
3. 预算调整：
   • ROI > 目标：增加出价 × 1.1
   • ROI < 目标：降低出价 × 0.9 或暂停
4. 关键词拓展：AI挖掘新长尾关键词
5. 生成报表推送商家
```

**关键指标**：

- 目标ROI阈值由商家配置
- 每日调整幅度限制(如不超过15%)避免震荡

#### 2.4 `ecom-ai-creative` - 商品图文创意生成

**功能**：

1. **文案生成**：根据商品信息生成标题、卖点、详情页文案
2. **主图生成**：`image_generate` 根据描述生成商品主图
3. **海报生成**：活动海报、优惠券图

**工作流程**：

```
1. ecom-product-fetch 获取商品详情
2. AI提炼核心卖点
3. 生成多版本文案/图片
4. 推送给商家选择
5. 选中后直接上传到淘宝
```

**提示工程**：参见 [references/creative-prompts.md](references/creative-prompts.md)

#### 2.5 `ecom-ai-customer-service` - AI客服

**分层处理策略**：

```
用户提问
    ↓
意图识别
    ↓
├─→ 常见问题(物流/退换货/尺寸) → 自动回复
    ↓
├─→ 复杂问题 → 转人工 + 记录上下文
    ↓
└─→ 售后纠纷 → 生成话术建议 + 提醒客服
```

**技能设计**：

- 用few-shot prompt做意图分类
- 商家可配置常见问题FAQ知识库
- 支持多轮会话上下文跟踪

#### 2.6 `ecom-ai-shop-inspect` - 自动店铺巡检

**每日巡检清单**：

- [ ] 商品价格是否异常
- [ ] 库存是否预警
- [ ] 主图/详情页是否有违规文案
- [ ] 评价是否有大量负面反馈
- [ ] 竞品是否有新活动上新

**实现方式**：

- `browser` 技能打开店铺首页/商品页截图
- `image` 视觉AI检查文案合规性
- OCR识别文字内容，关键词匹配违规词
- 发现问题立刻 `message` 通知商家

---

### 3. 工作流编排

#### 定时任务配置示例 (cron)

```json
{
  "name": "每日店铺巡检",
  "schedule": {
    "kind": "cron",
    "expr": "0 9 * * *",
    "tz": "Asia/Shanghai"
  },
  "payload": {
    "kind": "agentTurn",
    "message": "执行每日店铺巡检，发现问题通知我"
  },
  "sessionTarget": "current",
  "enabled": true
}
```

```json
{
  "name": "价格监控每6小时",
  "schedule": {
    "kind": "cron",
    "expr": "0 */6 * * *",
    "tz": "Asia/Shanghai"
  },
  "payload": {
    "kind": "agentTurn",
    "message": "检查监控列表商品价格，执行自动调价"
  },
  "sessionTarget": "current",
  "enabled": true
}
```

#### 技能间协作关系

```
ecom-ai-workspace (总控)
 ├─→ 选品分析: ecom-ai-selection → ecom-product-search → web_search → 输出报告
 ├─→ 价格监控: ecom-ai-price-monitor → taobao-shop-sync → ecom-product-search → 调价执行
 ├─→ 广告优化: ecom-ai-adoptimize → order-data-fetch → 预算调整
 └─→ 店铺巡检: ecom-ai-shop-inspect → browser → image → 告警通知
```

## 部署方式

### SaaS模式 (多租户)

```
商家A ─→
         OpenClaw Gateway → 隔离会话 → 电商技能 → 淘宝API
商家B ─→
```

- 每个商家一个独立session
- 配置加密存储
- 数据权限隔离

### 私有化部署

```
docker run -d \
  -p 7777:7777 \
  -v ~/.openclaw:/home/dusx/.openclaw \
  --name openclaw openclaw/openclaw:latest

# 启用电商技能包
openclaw skill install ecom-ai-workspace
openclaw skill configure ecom-ai-workspace --taobao-app-key=xxx --taobao-app-secret=xxx
```

## 安全设计

1. **API密钥加密存储**：商家API密钥加密保存，只有运行时解密
2. **数据不出域**：私有化部署所有数据留在商家本地
3. **会话隔离**：SaaS模式下各商家数据完全隔离
4. **操作审计**：所有自动操作记录日志，支持回滚

## 开发路线图

### Phase 1 - 基础数据能力

- [ ] `taobao-shop-sync`
- [ ] `ecom-ai-selection` 智能选品
- [ ] `ecom-ai-price-monitor` 价格监控

### Phase 2 - 运营自动化

- [ ] `ecom-ai-creative` 创意生成
- [ ] `ecom-ai-shop-inspect` 自动巡检
- [ ] `ecom-ai-adoptimize` 广告优化

### Phase 3 - 客服与增长

- [ ] `ecom-ai-customer-service` AI客服
- [ ] 库存预测与自动补货
- [ ] 活动营销方案自动生成

## 参考

- [OpenClaw Skill Creator](../../skill-creator/SKILL.md)
- [淘宝开放平台文档](https://open.taobao.com/)
