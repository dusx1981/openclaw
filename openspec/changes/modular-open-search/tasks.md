## 1. Infrastructure - Search Module

- [x] 1.1 Create `src/infrastructure/search/` directory structure
- [x] 1.2 Create `types.ts` with `ProductSearchParams`, `ProductSearchResult`, `ProductSearchItem` types
- [x] 1.3 Create `ProductSearchProvider.ts` interface with `id`, `name`, `search()`, `isConfigured()`, `getConfigPath()` methods
- [x] 1.4 Create `ProductSearchClient.ts` with provider registration and fallback logic

## 2. Providers Implementation

- [x] 2.1 Create `providers/BingShoppingProvider.ts` implementing `ProductSearchProvider`
- [x] 2.2 Implement `buildQuery()` method with `site:` filter for platform restriction
- [x] 2.3 Implement Bing API call using `postTrustedWebToolsJson` from OpenClaw SDK
- [x] 2.4 Create `providers/TavilyProductProvider.ts` implementing `ProductSearchProvider`
- [x] 2.5 Implement Tavily provider using `runTavilySearch` from OpenClaw's tavily extension
- [x] 2.6 Create `providers/index.ts` barrel export

## 3. Domain Types Update

- [x] 3.1 Update `src/domain/types.ts` to add `"open_search"` to `DataSourceType` union
- [x] 3.2 Verify TypeScript compilation after type change

## 4. TaobaoAdapter Integration

- [x] 4.1 Add `taobao_open_search` data source in `TaobaoAdapter.create()` with `type: "open_search"` and `priority: 4`
- [x] 4.2 Add `ProductSearchClient` instance to `TaobaoAdapter`
- [x] 4.3 Modify `searchProducts()` to use `fetchWithFailover()` instead of single source
- [x] 4.4 Implement `doSearchViaOpenSearch()` method that calls `ProductSearchClient.search()`
- [x] 4.5 Add `transformSearchResult()` method to convert open search results to `ProductData` format

## 5. Shared Instance Fix

- [x] 5.1 Modify `TaobaoValidator` constructor to use `PlatformRegistry.get("taobao")` instead of `TaobaoAdapter.create()`
- [x] 5.2 Add null check for case when platform not yet initialized
- [x] 5.3 Remove unused `TaobaoAdapter` import if no longer needed

## 6. Configuration

- [x] 6.1 Add `BING_API_KEY` to `.env.example`
- [x] 6.2 Update `openclaw.plugin.json` configSchema with `openSearch.bingApiKey` field
- [x] 6.3 Add config resolution in `plugin-config.ts` for Bing API key

## 7. Tests

- [x] 7.1 Create `search/__tests__/ProductSearchClient.test.ts` with fallback tests
- [x] 7.2 Create `search/providers/__tests__/BingShoppingProvider.test.ts` with mock API responses
- [x] 7.3 Create `search/providers/__tests__/TavilyProductProvider.test.ts`
- [x] 7.4 Update `TaobaoAdapter.test.ts` to test `searchProducts()` with failover
- [x] 7.5 Add test for `TaobaoValidator` using shared instance

## 8. Documentation

- [x] 8.1 Update `SKILL.md` with open search degradation information
- [x] 8.2 Update `README.md` with Bing API key setup instructions
