## 1. Registry Module

- [x] 1.1 Create `ProductSearchRegistry.ts` with provider factory types
- [x] 1.2 Implement `registerProviderFactory(id, factory)` function
- [x] 1.3 Implement provider cache with `getProductSearchProvider(id)`
- [x] 1.4 Implement `getConfiguredProviders()` to filter configured providers
- [x] 1.5 Implement `createProductSearchClient()` convenience function
- [x] 1.6 Implement `resetProviderCache()` for test isolation
- [x] 1.7 Register built-in factories for "bing" and "tavily" providers
- [x] 1.8 Update `search/index.ts` to export registry functions

## 2. Adapter Refactoring

- [x] 2.1 Remove hardcoded provider imports from `TaobaoAdapter.ts`
- [x] 2.2 Update `TaobaoAdapter` to use `createProductSearchClient()`
- [x] 2.3 Remove hardcoded provider imports from `AmazonAdapter.ts` (N/A - no hardcoded imports)
- [x] 2.4 Update `AmazonAdapter` to use `createProductSearchClient()` (N/A - uses mock data)

## 3. Tests

- [x] 3.1 Create `ProductSearchRegistry.test.ts` with factory registration tests
- [x] 3.2 Add cache behavior tests (singleton, reset)
- [x] 3.3 Add `getConfiguredProviders()` filtering tests
- [x] 3.4 Add `createProductSearchClient()` integration tests
- [x] 3.5 Update `TaobaoAdapter.test.ts` if needed for registry integration (no changes needed)
- [x] 3.6 Run full test suite to verify no regressions

## 4. Verification

- [x] 4.1 Verify TypeScript compilation
- [x] 4.2 Verify lint passes
- [x] 4.3 Manual test: searchProducts with open_search fallback still works
