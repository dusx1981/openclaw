## 1. Type Definitions

- [ ] 1.1 Add `SourceSelectionStrategy` type to `domain/types.ts` (`"priority" | "cost-first" | "reliability-first"`)
- [ ] 1.2 Add `SourceType` type to `domain/types.ts` (`"official_api" | "third_party_api" | "crawler"`)
- [ ] 1.3 Add `SourceHealth` interface to `domain/types.ts`
- [ ] 1.4 Add `sourceType` field to `FetchResult` interface
- [ ] 1.5 Add `strategy` field to `DataCollectionSettings`

## 2. Health Tracker Implementation

- [ ] 2.1 Create `SourceHealthTracker` class in `infrastructure/SourceHealthTracker.ts`
- [ ] 2.2 Implement `recordSuccess(sourceId)` method
- [ ] 2.3 Implement `recordFailure(sourceId, error)` method
- [ ] 2.4 Implement `getHealthScore(sourceId)` method
- [ ] 2.5 Implement `shouldSkipSource(sourceId)` method (healthScore < 0.3)

## 3. Strategy Implementations

- [ ] 3.1 Create `SourceSelectionStrategy` interface in `domain/ports/SourceSelectionStrategy.ts`
- [ ] 3.2 Implement `PriorityStrategy` class
- [ ] 3.3 Implement `CostFirstStrategy` class
- [ ] 3.4 Implement `ReliabilityStrategy` class
- [ ] 3.5 Create `createStrategy(type)` factory function

## 4. Adapter Integration

- [ ] 4.1 Add `healthTracker` property to `BasePlatformAdapter`
- [ ] 4.2 Add `strategy` property to `BasePlatformAdapter`
- [ ] 4.3 Modify `fetchWithFailover()` to use strategy for selection
- [ ] 4.4 Modify `fetchWithFailover()` to filter unhealthy sources
- [ ] 4.5 Modify `fetchWithFailover()` to record health after each attempt
- [ ] 4.6 Modify `fetchWithFailover()` to set `sourceType` in result

## 5. Configuration

- [ ] 5.1 Update `TaobaoAdapter.create()` to accept strategy config
- [ ] 5.2 Update `AmazonAdapter.create()` to accept strategy config
- [ ] 5.3 Update default config to use `"priority"` strategy

## 6. Tests

- [ ] 6.1 Test PriorityStrategy selects by priority
- [ ] 6.2 Test CostFirstStrategy selects cheapest source
- [ ] 6.3 Test ReliabilityStrategy selects highest health score
- [ ] 6.4 Test unhealthy sources (score < 0.3) are skipped
- [ ] 6.5 Test health is recorded after success/failure
- [ ] 6.6 Test sourceType is included in result

## 7. Documentation

- [ ] 7.1 Update `docs/dev/数据采集/可配置降级设计.md` with strategy documentation