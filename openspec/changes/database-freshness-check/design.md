## Context

当前 `FetchProductUseCase` 的降级流程：

```
Layer 1: Redis 缓存 (有 TTL)
Layer 2: 数据库 (无时效检查) ← 问题点
Layer 3: 数据源 API/爬虫
Layer 4: 过期 Redis 缓存
Layer 5: 错误
```

数据库已有 `last_seen_at` 字段记录最后更新时间，但查询时未使用。

## Goals / Non-Goals

**Goals:**
- 数据库层添加时效性检查，过期数据不返回
- 配置化新鲜度阈值
- 保持现有降级流程不变

**Non-Goals:**
- 不做分字段时效性（价格/销量不同阈值）
- 不做后台异步刷新
- 不改变降级层级顺序

## Decisions

### Decision 1: 新鲜度检查位置

**选择**: 在 `FetchProductUseCase.execute()` 中检查，而非 Repository 层

**理由**:
- UseCase 已有降级逻辑，添加检查最简单
- Repository 保持简单查询职责
- 避免改动 Repository 接口

**备选方案**:
- 在 Repository 添加 `findFresh()` 方法 → 需要改接口，影响面大

### Decision 2: 默认阈值

**选择**: 4 小时

**理由**:
- 商品数据通常不会频繁变化
- 与 Redis 缓存 TTL (1小时) 形成梯度
- 可通过配置覆盖

### Decision 3: 过期数据处理

**选择**: 跳过数据库层，继续降级到下一层

**理由**:
- 简单明确
- 避免返回错误数据
- 与"稳定、准确获取最新数据"目标一致

## Risks / Trade-offs

**Risk 1**: 数据库有数据但仍去调用 API → 成本增加
→ Mitigation: 4 小时阈值足够宽松，大多数情况命中数据库

**Risk 2**: 高频商品频繁刷新
→ Mitigation: 可针对特定商品调整阈值（未来扩展）