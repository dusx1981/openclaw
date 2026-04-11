---
name: ecom-ai-price-monitor
description: 电商价格动态监控，自动跟踪竞品价格变化，支持自动调价维护竞争力。Use when need to monitor competitor prices and auto-adjust pricing.
---

# 价格动态监控与自动调整 E-commerce AI Price Monitor

定时监控竞品同款商品价格变化，根据商家配置的规则自动调整本店价格，保持价格竞争力。

## 核心功能

1. **定时扫描**：定期搜索同款商品，获取竞品最新价格
2. **变动检测**：识别竞品降价/涨价超过阈值
3. **规则决策**：根据预设规则决定是否跟进调价
4. **自动执行**：通过API更新本店价格（或通知商家确认）

## 配置格式

商家需要在配置中定义监控列表：

```json
{
  "watchList": [
    {
      "itemId": "本店商品ID",
      "currentPrice": 199.0,
      "minPrice": 120.0,
      "maxPrice": 249.0,
      "competitorItemUrls": ["https://item.taobao.com/item.htm?id=xxxxxx"],
      "followThresholdPercent": 5,
      "keepPriceDiff": 0,
      "autoAdjust": true
    }
  ],
  "checkIntervalHours": 6,
  "maxAdjustPerDayPercent": 15
}
```

## 工作流程

```
1. 遍历监控列表
   ↓
2. 获取每个商品竞品当前价格
   ↓
3. 计算价格变化幅度
   ↓
4. 判断是否触发调整：
   • 变化幅度 ≥ 配置阈值？
   • 新价格在 [minPrice, maxPrice] 范围内？
   ↓
5. 决策：
   • autoAdjust = true 且 幅度小 → 自动执行调价
   • 幅度大 → 通知商家确认
   ↓
6. 通过淘宝API更新价格
   ↓
7. 记录调价历史，生成日报
```

## 定价策略支持

| 策略             | 说明                           | 配置方式             |
| ---------------- | ------------------------------ | -------------------- |
| **紧跟降价**     | 竞品降价，自动跟进保持价格一致 | `keepPriceDiff: 0`   |
| **保持差价**     | 始终比竞品便宜N元              | `keepPriceDiff: -5`  |
| **保持溢价**     | 始终比竞品贵N元（品牌定位）    | `keepPriceDiff: +10` |
| **只监控不调整** | 只通知，不自动调价             | `autoAdjust: false`  |

## 告警规则

| 场景                                     | 处理方式                     |
| ---------------------------------------- | ---------------------------- |
| 竞品降价超过阈值，但新价格低于本店最低价 | 通知商家，由人工决策是否跟进 |
| 单日多次调整幅度超过最大限制             | 暂停调整，通知商家人工审核   |
| 竞品商品下架                             | 通知商家，供决策参考         |

## 数据存储

```
data/price-monitor/
├── watch-list.json          # 监控配置
├── price-history/
│   └── {itemId}.csv        # 时间序列价格历史
└── adjustment-log.csv      # 调价记录日志
```

## 详细决策逻辑

### 计算目标价格公式

```
目标价格 = 竞品当前价格 + keepPriceDiff
```

- `keepPriceDiff: 0` → 和竞品同价
- `keepPriceDiff: -5` → 比竞品便宜5元
- `keepPriceDiff: +10` → 比竞品贵10元（品牌定位）

### 触发调整条件

全部满足才会调整：

```
1. |竞品当前价格 - 上次记录价格| ≥ followThresholdPercent × 上次记录价格
   (价格变动幅度超过配置阈值)
   ↓
2. 计算出的目标价格 ≥ minPrice  (不低于保本最低价)
   AND 目标价格 ≤ maxPrice      (不高于定价上限)
   ↓
3. 单日累计调整幅度 ≤ maxAdjustPerDayPercent × 原价
   (单日调整不超过限制，避免价格震荡)
   ↓
满足 → 执行调整
不满足 → 通知商家人工决策
```

## 完整工作流时序

```
cron 定时触发 (每配置间隔Hours)
   ↓
1. 加载监控列表 watch-list.json
   ↓
2. 遍历每个需要监控的商品：
   ↓
   a. ecom-product-fetch → 获取竞品当前价格
   ↓
   b. 和历史价格比较 → 计算变动幅度
   ↓
   c. 计算目标价格 → 检查边界条件
   ↓
   d. 决策分支：
   ├─ [自动] 满足所有条件 AND autoAdjust=true → 自动调价
   │  ↓
   │  调用淘宝API更新价格
   │  记录价格历史
   │  记录调价日志
   │  通知商家"已自动调整价格"
   │
   ├─ [人工确认] 条件不满足 OR 变动幅度大 → 不自动调
   │  ↓
   │  message通知商家：
   │  • 商品信息
   │  • 竞品价格变动
   │  • 系统建议新价格
   │  • 请商家确认是否调整
   │
   └─ [只监控] autoAdjust=false → 只通知不执行
   ↓
3. 所有商品处理完
   ↓
4. 生成今日监控日报 → 发送给商家
```

## 数据存储结构

```
data/price-monitor/{shopId}/
├── watch-list.json              # 监控配置（商家编辑）
├── price-history/
│   └── {itemId}.csv            # 竞品价格历史
│   # 格式：timestamp,competitor_price,our_price,adjusted
└── adjustment-log.csv           # 调价日志
# 格式：date,itemId,old_price,new_price,competitor_price,auto
```

## 告警场景处理

| 场景                 | 原因                                           | 处理方式                                                                |
| -------------------- | ---------------------------------------------- | ----------------------------------------------------------------------- |
| **竞品降价跌破底价** | 竞品降价后，跟进会低于我们minPrice             | ❌ 不自动调 → 通知商家："竞品降价到X，跟进会低于底价，是否跟进请您决策" |
| **单日调整超限**     | 竞品多次降价，累计幅度超过每日限制             | ⏸️ 暂停调整 → 通知商家："今日调整幅度已超限，请人工审核"                |
| \*\*竞品商品404/下架 | 竞品商品找不到了                               | ℹ️ 通知商家："监控的竞品商品已下架，请检查"                             |
| **竞品涨价**         | 竞品涨价，我们可以保持原价或跟进涨价赚更多利润 | 👀 自动跟进涨价（只要在价格区间内）→ 通知商家"已跟随涨价，利润增加"     |

## 商家操作界面

### 添加商品到监控

商家发送：

```
监控商品 12345678，竞品 https://item.taobao.com/item.htm?id=87654321，策略：比竞品便宜5元，自动调整
```

AI自动添加到 `watch-list.json`

### 移除监控

```
停止监控 12345678
```

### 查看监控列表

```
查看当前监控列表
```

输出表格：本店商品 → 竞品 → 当前价差 → 策略 → 自动调价

## 配置完整示例

```json
{
  "enabled": true,
  "shopId": "your-shop-id",
  "watchList": [
    {
      "itemId": "612345678901",
      "itemName": "迷你自带线无线充电器 10000mAh",
      "currentPrice": 99.0,
      "minPrice": 59.0,
      "maxPrice": 129.0,
      "competitorItemIds": ["612345678902"],
      "followThresholdPercent": 5,
      "keepPriceDiff": -5,
      "autoAdjust": true
    }
  ],
  "checkIntervalHours": 6,
  "maxAdjustPerDayPercent": 15,
  "notifyChannel": "telegram",
  "notifyTarget": "@merchant"
}
```

## 分步实现路径

### Phase 1：基础监控（2天）

1. ✅ 配置存储：watch-list.json 读写
2. ✅ 遍历竞品 → ecom-product-fetch 获取价格
3. ✅ 价格变动检测
4. ✅ 记录价格历史

### Phase 2：决策逻辑（1-2天）

1. ✅ 目标价格计算公式
2. ✅ 边界条件检查（min/max价格区间、单日幅度限制
3. ✅ 自动/人工决策分支
4. ✅ 调用淘宝API执行调价

### Phase 3：通知报表（1天）

1. ✅ 异常告警通知商家（message技能
2. ✅ 自动调价通知
3. ✅ 每日监控日报

### Phase 4：交互优化（可选）

1. ✅ 商家自然语言添加/移除监控
2. ✅ 查看监控列表

## 依赖工具

- `ecom-product-fetch` - 获取竞品商品最新价格
- `taobao-shop-sync` - 获取本店商品信息 + 调用API更新价格
- `cron` - 定时触发监控
- `message` - 通知商家确认、发送告警日报
