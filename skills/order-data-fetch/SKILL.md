---
name: order-data-fetch
description: 拉取电商订单数据，统计销量、转化、客单价等经营指标，生成日报周报。Use when need to get order data for analysis and reporting.
---

# 订单数据拉取与统计 Order Data Fetch

从电商平台API拉取订单数据，统计经营指标，生成日报周报。

## 功能

1. 定时拉取订单数据增量更新
2. 统计核心经营指标：
   - 销量 / GMV / 访客数
   - 转化率 / 客单价
   - 退款率
3. 生成日报/周报/月报
4. 发现数据异常自动告警

## API 接口

淘宝需要调用以下API：

- `taobao.trades.sold.get` - 获取已卖出订单
- `taobao.trade.fullinfo.get` - 获取订单详情
- `taobao.user.seller.get` - 获取店铺信息

## 数据存储

### 存储结构

```
data/orders/{shopId}/
├── daily-stats/
│   └── YYYY-MM-DD.csv    # 每日统计数据
├── orders-YYYY-MM.jsonl  # 当月原始订单
└── latest-stats.json    # 最新统计
```

### 每日统计CSV格式

| date | orders | gmv | units | visitors | conversionRate | averageOrderValue | refundRate |
| ---- | ------ | --- | ----- | -------- | -------------- | ----------------- | ---------- |
|      |        |     |       |          |                |                   |            |

## 工作流程

### 每日定时拉取

```
1. 获取上次拉取时间戳
2. 调用API增量拉取新订单
3. 保存原始订单数据
4. 计算每日统计指标
5. 对比历史数据，检测异常：
   • GMV骤降超过X% → 告警
   • 退款率骤升超过X% → 告警
6. 生成日报发送商家
```

## 告警规则

| 异常场景             | 阈值           | 动作     |
| -------------------- | -------------- | -------- |
| GMV同比下降 > 30%    | 单日           | 发送告警 |
| 退款率同比上升 > 10% | 单日           | 发送告警 |
| 订单量为0            | 单日（非预售） | 发送告警 |

## 报表输出

### 日报示例

```
# 经营日报 2025-01-15

## 今日数据
- 订单量：XXX 单（昨日XXX，同比昨日 +X% / -X%）
- GMV：¥XXXX （同比昨日 +X% / -X%）
- 客单价：¥XXX
- 转化率：X.X%
- 退款率：X.X%

## 趋势对比
近7日GMV趋势：↑上升 / ↓下降 / →平稳

## 异常提醒
✅ 无异常
❌ GMV较昨日下降35%，请关注
```

### 周报示例

汇总一周数据，对比上周，给出趋势分析。

## 配置

```json
{
  "fetchIntervalHours": 24,
  "alertGmvDropPercent": 30,
  "alertRefundRaisePercent": 10,
  "sendDailyReport": true,
  "sendWeeklyReport": true
}
```

## 依赖

- `taobao-shop-sync` - 店铺基本信息同步
- `cron` - 定时拉取
- `message` - 发送报表和告警
