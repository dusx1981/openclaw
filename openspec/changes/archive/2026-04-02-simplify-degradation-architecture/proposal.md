# Simplify Degradation Architecture

## Why

Current meichao-ecom degradation mechanisms are over-engineered and duplicate functionality. The custom `CooldownManager` (132 lines) overlaps with both `CircuitBreaker` and existing retry logic, creating coordination problems and violating OpenClaw's design principle of "simple, focused, decoupled."

OpenClaw already provides mature Retry implementations through `plugin-sdk/infra-runtime` (used by Discord and Telegram plugins), but meichao-ecom reimplements this functionality poorly. The current design adds unnecessary complexity without providing value.

## What Changes

- **Remove** `CooldownManager` and related coordination logic (~230 lines)
- **Replace** custom `withRetry()` with `openclaw/plugin-sdk/infra-runtime` Retry
- **Adjust** CircuitBreaker configuration (increase `openDuration` to 60s, `halfOpenMaxCalls` to 10)
- **Add** retry policy files for each platform (taobao, amazon, etc.)
- **Simplify** `fetchWithFailover()` to use only CircuitBreaker + Retry

**BREAKING**: None - internal refactoring only, no API changes

## Capabilities

### New Capabilities

- `plugin-retry-integration`: Use `openclaw/plugin-sdk/infra-runtime` retry utilities for exponential backoff with jitter and retry-after support

### Modified Capabilities

- `circuit-breaker`: Update default configuration to match Resilience4j best practices (60s open duration, 10 half-open max calls)

## Impact

**Code Changes:**

- Remove `src/infrastructure/cooldown/CooldownManager.ts` (132 lines)
- Remove `src/infrastructure/cooldown/CooldownManager.test.ts` (~100 lines)
- Remove coordination logic from `BasePlatformAdapter.ts` (~80 lines)
- Add `src/infrastructure/retry-policy.ts` (~60 lines)
- Update `BasePlatformAdapter.ts` to use RetryRunner

**Dependencies:**

- Add dependency on `openclaw/plugin-sdk/infra-runtime` (already available, no package.json change needed)

**Architecture:**

- Simplify from 3-layer protection (Retry + CircuitBreaker + Cooldown) to 2-layer (Retry + CircuitBreaker)
- Align with OpenClaw patterns used by Discord and Telegram plugins
- Eliminate coordination problems between mechanisms

**Testing:**

- Remove Cooldown tests
- Add Retry integration tests
- Update existing tests to use new flow

**Documentation:**

- Update design docs to reflect simplified architecture
- Remove Cooldown references from degradation strategy docs
