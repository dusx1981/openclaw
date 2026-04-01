## 1. Type Definitions

- [ ] 1.1 Add `databaseFreshnessThresholdMs` to `DataCollectionSettings` in `src/domain/data-source-config.ts`
- [ ] 1.2 Add `databaseDataAgeMs` field to `FetchProductUseCaseResult` in `src/application/use-cases/FetchProductUseCase.ts`

## 2. Core Implementation

- [ ] 2.1 Implement freshness check logic in `FetchProductUseCase.execute()` - check `last_seen_at` against threshold
- [ ] 2.2 Skip database layer when data is stale, continue to next degradation layer
- [ ] 2.3 Add `databaseDataAgeMs` to result when database data is used

## 3. Tests

- [ ] 3.1 Test fresh database data is returned (within threshold)
- [ ] 3.2 Test stale database data is skipped (exceeds threshold)
- [ ] 3.3 Test null `last_seen_at` is treated as stale
- [ ] 3.4 Test custom threshold configuration works

## 4. Documentation

- [ ] 4.1 Update `docs/dev/数据采集/失败降级机制设计.md` with freshness check documentation