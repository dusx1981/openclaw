## Context

The current implementation has provider registration hardcoded in adapter constructors:

```
TaobaoAdapter.constructor() {
  this.searchClient = new ProductSearchClient();
  this.searchClient.registerProvider(new BingShoppingProvider());  // hardcoded
  this.searchClient.registerProvider(new TavilyProductProvider()); // hardcoded
}
```

This violates the Open-Closed Principle and makes:

- Testing difficult (cannot inject mocks)
- Extension impossible without modifying adapters
- Configuration scattered (providers read their own env vars)

## Goals / Non-Goals

**Goals:**

- Create a registry pattern for product search providers
- Support provider factory registration for extensibility
- Cache provider instances to avoid repeated instantiation
- Make adapters agnostic to specific provider implementations
- Enable testing with mock providers

**Non-Goals:**

- Not creating a plugin system (providers remain in meichao-ecom)
- Not changing the ProductSearchProvider interface
- Not changing ProductSearchClient behavior
- Not adding new providers (just refactoring existing ones)

## Decisions

### 1. Registry as stateless functions with internal cache

**Decision:** Registry exports functions (`getProductSearchProvider`, `createProductSearchClient`) rather than a class instance.

**Rationale:**

- Matches OpenClaw's pattern (see `src/tts/provider-registry.ts`, `src/media-understanding/provider-registry.ts`)
- No global class instance to manage
- Functions can be imported directly
- Cache is module-level, shared across all callers

**Alternative:** Singleton class with methods

- More verbose
- No clear benefit for this use case

### 2. Provider factory registration

**Decision:** Support `registerProviderFactory(id, factory)` for extensibility.

**Rationale:**

- Future providers can be registered without modifying registry code
- Plugins could potentially register their own providers
- Matches OpenClaw's provider registration pattern

**Alternative:** Hardcoded factory switch statement

- Simpler but not extensible
- Adding providers requires modifying registry

### 3. Configuration from existing plugin-config

**Decision:** Use `getOpenSearchConfig()` for Bing, `process.env.TAVILY_API_KEY` for Tavily.

**Rationale:**

- Reuses existing configuration infrastructure
- No new config schema needed
- Consistent with current provider implementations

## Risks / Trade-offs

### [Risk] Cache invalidation on config change

→ **Mitigation:** Cache is per-process; config changes require restart. This matches OpenClaw's model.

### [Risk] Test isolation with shared cache

→ **Mitigation:** Export `resetProviderCache()` for tests to call in `beforeEach`.

### [Risk] Breaking change if adapters create their own providers

→ **Mitigation:** No adapters currently do this. Internal change only.
