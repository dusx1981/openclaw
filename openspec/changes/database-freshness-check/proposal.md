## Why

数据库层降级时没有检查数据时效性，可能返回过期数据导致业务决策错误。例如：商品价格昨天是 ¥199，今天涨到 ¥299，但用户看到的仍是旧价格。

目标：简单、稳定、准确的获取最新数据。

## What Changes

- 数据库查询时检查 `last_seen_at` 字段，过期数据不返回
- 添加可配置的数据新鲜度阈值（默认 4 小时）
- 过期数据库数据标记为不可用，继续降级到下一层

## Capabilities

### New Capabilities

- `data-freshness`: 数据新鲜度检查能力，确保返回的数据在可接受的时间范围内

### Modified Capabilities

- None

## Impact

- `FetchProductUseCase`: 添加数据库数据新鲜度检查逻辑
- `ProductRepository`: 新增带新鲜度过滤的查询方法
- `DataCollectionSettings`: 添加 `databaseFreshnessThresholdMs` 配置项