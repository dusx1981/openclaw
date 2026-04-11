# taobao-shop-sync - 淘宝店铺数据同步技能

## Frontmatter

```yaml
---
name: taobao-shop-sync
description: 同步淘宝店铺商品、价格、库存数据到本地，支持定时增量同步。Use when need to get shop product data for e-commerce analysis.
---
```

## 功能说明

- 全量同步：首次同步拉取店铺所有商品
- 增量同步：定时只拉取更新过的商品
- 数据校验：检查价格/库存异常
- 异常告警：数据异常立即通知商家

## API 使用

### 调用淘宝 API

需要淘宝开放平台权限：

1. `taobao.items.onsale.get` - 获取在售商品列表
2. `taobao.item.get` - 获取商品详情
3. `taobao.inventory.quantity.get` - 获取库存信息

## 数据存储

### 本地存储格式

```
data/taobao-shop-{shopId}/
├── items_{timestamp}.jsonl      # 商品列表快照
├── prices_{date}.csv            # 价格历史
├── inventory_{date}.csv        # 库存历史
└── sync_state.json              # 同步状态
```

### sync_state.json 结构

```json
{
  "lastSyncTime": "2025-01-15T10:30:00Z",
  "lastItemId": 12345678,
  "totalItemsSynced": 156,
  "errors": []
}
```

## 工作流程

### 完整同步流程

```
1. 检查配置是否完整 (appKey, appSecret, shopId)
2. 获取上次同步时间戳
3. 调用 API 获取增量更新商品
4. 对比历史数据，检测价格/库存突变
5. 保存新数据快照
6. 如果检测到异常，发送通知
7. 更新同步状态
```

## 异常处理

| 异常场景         | 处理策略                     |
| ---------------- | ---------------------------- |
| API 调用限流     | 等待后重试，最多 3 次        |
| 部分商品获取失败 | 记录失败ID，跳过后续继续同步 |
| 网络超时         | 记录错误，下次同步重试       |
| 价格波动 > 50%   | 立即通知商家人工确认         |

## 配置示例

在 openclaw.json plugins 配置：

```json
"plugins": {
  "entries": {
    "taobao-shop-sync": {
      "enabled": true,
      "appKey": "your_app_key",
      "appSecret": "your_app_secret",
      "shopId": "your_shop_id",
      "syncIntervalHours": 24,
      "priceChangeAlertThreshold": 0.3,
      "inventoryAlertThreshold": 10
    }
  }
}
```

## 触发方式

1. **定时触发**：通过 cron job 按配置间隔自动执行
2. **手动触发**：`openclaw skill run taobao-shop-sync sync-now`
3. **API触发**：Webhook 接收淘宝商品变更推送后触发同步

## 依赖工具

- `ecom-product-fetch` - 补充获取商品详情
- `message` - 异常通知商家
