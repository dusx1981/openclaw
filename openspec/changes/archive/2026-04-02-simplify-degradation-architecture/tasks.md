# Implementation Tasks

## 1. Retry Infrastructure Setup

- [x] 1.1 Create `extensions/meichao-ecom/src/infrastructure/retry-policy.ts` with platform retry runners
- [x] 1.2 Implement `createTaobaoRetryRunner()` with Taobao-specific defaults and error classification
- [x] 1.3 Implement `createAmazonRetryRunner()` with Amazon-specific defaults and error classification
- [x] 1.4 Add unit tests for retry policy functions

## 2. CircuitBreaker Configuration Update

- [x] 2.1 Update `DEFAULT_CIRCUIT_BREAKER_CONFIG` in `data-source-config.ts` (openDuration: 60000, halfOpenMaxCalls: 10)
- [x] 2.2 Add configuration comments referencing Resilience4j best practices
- [x] 2.3 Update CircuitBreaker tests to verify new configuration values

## 3. BasePlatformAdapter Refactor

- [x] 3.1 Add `retryRunners` Map property to BasePlatformAdapter
- [x] 3.2 Implement `getRetryRunner(source: DataSource)` method
- [x] 3.3 Modify `fetchWithFailover()` to use RetryRunner instead of `withRetry()`
- [x] 3.4 Remove `withRetry()` method from BasePlatformAdapter
- [x] 3.5 Remove `cooldownManager` property and related imports
- [x] 3.6 Remove Cooldown checks from `fetchWithFailover()` (isInCooldown, canProbe, etc.)
- [x] 3.7 Remove probe mechanism logic (recordProbeAttempt, etc.)
- [x] 3.8 Update BasePlatformAdapter tests to use new retry flow

## 4. CooldownManager Removal

- [x] 4.1 Delete `src/infrastructure/cooldown/CooldownManager.ts`
- [x] 4.2 Delete `src/infrastructure/cooldown/CooldownManager.test.ts`
- [x] 4.3 Remove CooldownSettings from `domain/types.ts`
- [x] 4.4 Remove cooldown field from `DEFAULT_DATA_COLLECTION_SETTINGS` in `data-source-config.ts`
- [x] 4.5 Remove cooldown-related types (SourceCooldownState, etc.) from `domain/types.ts`

## 5. Decision Logger Update

- [x] 5.1 Remove cooldown-related fields from DegradationDecisionLog interface
- [x] 5.2 Remove cooldown decision types (skip_cooldown_source, probe_source) from DegradationDecision type
- [x] 5.3 Update DecisionLogger tests to remove cooldown scenarios

## 6. Documentation Update

- [x] 6.1 Update `docs/集成/meichao-ecom-熔断与冷却机制设计.md` to reflect simplified architecture
- [x] 6.2 Update `docs/集成/meichao-ecom-降级策略.md` to remove Cooldown references
- [x] 6.3 Add note about using plugin-sdk/infra-runtime in architecture docs

## 7. Integration Testing

- [x] 7.1 Add integration test for Retry + CircuitBreaker flow
- [x] 7.2 Test severe error handling (no retry)
- [x] 7.3 Test rate limit retry with exponential backoff
- [x] 7.4 Test CircuitBreaker state transitions with new configuration
- [x] 7.5 Run existing degradation chaos tests to verify behavior
