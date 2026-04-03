## Why

The `ProductSearchClient` and its providers are instantiated inside `TaobaoAdapter`, creating tight coupling between the adapter and specific provider implementations. This makes testing difficult (cannot inject mocks) and prevents extension (adding new providers requires modifying adapter code).

Now is the right time to fix this because:

- We just implemented the open search feature and it works
- The pattern will be reused by `AmazonAdapter` and future adapters
- The current hardcoded registration violates the Open-Closed Principle

## What Changes

- Create `ProductSearchRegistry` module with provider factory registration
- Provider factories can be registered at bootstrap or by plugins
- Registry creates providers on-demand with caching
- `TaobaoAdapter` and `AmazonAdapter` use `createProductSearchClient()` from registry
- Remove hardcoded `new BingShoppingProvider()` and `new TavilyProductProvider()` from adapters

## Capabilities

### New Capabilities

- `product-search-registry`: Registry for product search providers with factory pattern, caching, and configuration-driven instantiation

### Modified Capabilities

- `platform-adapter`: Adapters now use `createProductSearchClient()` instead of hardcoded provider instantiation

## Impact

**New files:**

- `extensions/meichao-ecom/src/infrastructure/search/ProductSearchRegistry.ts`
- `extensions/meichao-ecom/src/infrastructure/search/__tests__/ProductSearchRegistry.test.ts`

**Modified files:**

- `extensions/meichao-ecom/src/infrastructure/adapters/TaobaoAdapter.ts`
- `extensions/meichao-ecom/src/infrastructure/adapters/AmazonAdapter.ts`

**No breaking changes** - existing behavior is preserved, only the wiring changes.
