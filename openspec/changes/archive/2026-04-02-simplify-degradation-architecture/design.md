# Design: Simplify Degradation Architecture

## Context

Current meichao-ecom implements three-layer degradation protection:

1. **Retry**: Simple exponential backoff (custom implementation, 17 lines)
2. **CircuitBreaker**: Three-state machine for fast failover (104 lines)
3. **Cooldown**: Long-term exponential backoff (132 lines)

This design violates the Single Responsibility Principle and creates coordination complexity:

```
┌─────────────────────────────────────────────┐
│  Current Architecture (Over-engineered)     │
├─────────────────────────────────────────────┤
│                                             │
│  Retry (seconds)                            │
│    ↓                                        │
│  CircuitBreaker (30s)                       │
│    ↓                                        │
│  Cooldown (5-60 min)                        │
│    ↓                                        │
│  DataSource Failover                        │
│                                             │
│  Problem: CB and Cooldown overlap          │
│  Problem: Coordination logic complex       │
│  Problem: No profile rotation need         │
│                                             │
└─────────────────────────────────────────────┘
```

OpenClaw core provides mature Retry infrastructure via `plugin-sdk/infra-runtime`:

- `retryAsync()` with exponential backoff + jitter
- `createRateLimitRetryRunner()` for platform-specific policies
- `retryAfterMs` support for server-recommended retry timing
- Used successfully by Discord and Telegram plugins

Resilience4j (industry standard) uses similar pattern: Retry + CircuitBreaker, no separate Cooldown mechanism.

## Goals / Non-Goals

**Goals:**

- Eliminate coordination complexity between CircuitBreaker and Cooldown
- Leverage existing OpenClaw infrastructure (`plugin-sdk/infra-runtime`)
- Align with industry best practices (Resilience4j)
- Reduce code complexity by ~180 lines
- Improve maintainability and testability

**Non-Goals:**

- Add new degradation features (capabilities remain the same)
- Change external API or behavior
- Modify error classification logic
- Implement profile rotation (not applicable to DataSource model)

## Decisions

### D1: Use plugin-sdk/infra-runtime Retry

**Decision:** Import and use `createRateLimitRetryRunner` from `openclaw/plugin-sdk/infra-runtime` instead of custom `withRetry()`.

**Rationale:**

- Provides battle-tested implementation with jitter and retry-after support
- Follows OpenClaw patterns (Discord, Telegram plugins)
- Eliminates need to maintain duplicate code
- 27 lines vs 17 lines custom implementation, but with more features

**Alternatives Considered:**

- Keep custom `withRetry()`: Lacks jitter, retry-after, and proper error classification
- Create new Retry implementation: Violates DRY, ignores existing infrastructure

**Implementation:**

```typescript
// Before: BasePlatformAdapter.ts
protected async withRetry<T>(fn: () => Promise<T>, retryCount?: number): Promise<T> {
  const maxRetries = retryCount ?? this.config.retryCount;
  let lastError: Error | null = null;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (i < maxRetries) {
        await this.delay(this.config.retryDelayMs * Math.pow(2, i));
      }
    }
  }
  throw lastError ?? new Error("Unknown error after retries");
}

// After: infrastructure/retry-policy.ts
import { createRateLimitRetryRunner, type RetryRunner } from "openclaw/plugin-sdk/infra-runtime";

export function createTaobaoRetryRunner(params?: { retry?: RetryConfig }): RetryRunner {
  return createRateLimitRetryRunner({
    retry: params?.retry,
    defaults: { attempts: 3, minDelayMs: 500, maxDelayMs: 30_000, jitter: 0.1 },
    logLabel: "taobao",
    shouldRetry: (err) => {
      const classified = classifyError(err, "taobao");
      return !isSevereError(classified.reason);
    },
  });
}
```

### D2: Remove CooldownManager

**Decision:** Delete `CooldownManager` and related coordination logic.

**Rationale:**

- No profile rotation need in DataSource model (OpenClaw uses Cooldown for multi-profile rotation)
- CircuitBreaker already provides failover protection (60s duration)
- Retry handles transient errors (seconds to minutes)
- Time scale mismatch: Cooldown (5-60 min) too long compared to CB (60s) and Retry (30s max)

**Alternatives Considered:**

- Keep for severe errors only: Adds complexity for marginal benefit; severe errors should be handled by disabling the source or manual intervention
- Coordinate CB and Cooldown (pause during OPEN): Adds even more complexity

**Why OpenClaw needs Cooldown but meichao-ecom doesn't:**

```
OpenClaw Profile Rotation:
  Provider: openai
    ├─ Profile 1 (key-1) ← Cooldown here
    ├─ Profile 2 (key-2) ← Cooldown here
    └─ Profile 3 (key-3) ← Cooldown here

  When Profile 1 fails → switch to Profile 2
  Multiple instances to rotate ✓

meichao-ecom DataSource Model:
  Platform: taobao
    └─ DataSource: taobao_official_api (single config)

  When DataSource fails → switch to taobao_third_party
  No instances to rotate ✗
```

### D3: Adjust CircuitBreaker Configuration

**Decision:** Update default configuration to match Resilience4j best practices.

**Changes:**

| Parameter          | Current | New | Rationale                                                |
| ------------------ | ------- | --- | -------------------------------------------------------- |
| `openDuration`     | 30s     | 60s | Longer recovery window, aligns with Resilience4j default |
| `halfOpenMaxCalls` | 1       | 10  | More probe attempts, reduces oscillation                 |
| `failureThreshold` | 5       | 5   | No change, appropriate value                             |
| `successThreshold` | 3       | 3   | No change, appropriate value                             |

**Rationale:**

- Resilience4j defaults: `waitDurationInOpenState: 60s`, `permittedNumberOfCallsInHalfOpenState: 10`
- Current `halfOpenMaxCalls: 1` causes oscillation (one failure → back to OPEN)
- 60s open duration provides better protection than 30s

**Impact:**

- Longer failover period, but more stable recovery
- Better protection against cascading failures
- No code logic changes, only configuration

### D4: Simplified fetchWithFailover

**Decision:** Remove Cooldown checks, use only CircuitBreaker + Retry.

**Implementation:**

```typescript
async fetchWithFailover<T>(
  fn: (source: DataSource) => Promise<T>,
  options?: FetchWithFailoverOptions,
): Promise<FailoverFetchResult<T>> {
  const sources = this.getConfiguredSourceCandidates(options);
  let lastError: Error | null = null;

  for (const source of sources) {
    // Step 1: Check CircuitBreaker
    const cb = this.circuitBreakers.get(source.id);
    if (cb && !cb.canExecute()) {
      continue; // Skip failed source
    }

    // Step 2: Execute with Retry
    const retryRunner = this.getRetryRunner(source);

    try {
      const data = await retryRunner(() => fn(source));
      cb?.recordSuccess();
      return { data, source: source.id };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      cb?.recordFailure();
      // Try next source
    }
  }

  throw lastError ?? new Error("No available data sources");
}
```

**Removed:**

- Cooldown state checks (~30 lines)
- Probe mechanism logic (~50 lines)
- Cooldown coordination in BasePlatformAdapter

## Risks / Trade-offs

### Risk 1: Loss of Long Cooldown Period

**Risk:** Severe errors (auth_permanent, blocked) previously had 12x multiplier (up to 24 hours).

**Mitigation:**

- CircuitBreaker with 60s open duration provides base protection
- Severe errors should be marked as `disabled` in DataSource (requires manual intervention)
- Add optional "severe error" flag to DataSource to skip it in future requests

**Trade-off:** Slightly faster retry of failed sources, but this is acceptable given:

- Retry's `shouldRetry` returns false for severe errors
- CircuitBreaker still provides 60s protection
- Most severe errors require manual intervention anyway

### Risk 2: Different Behavior from Current Implementation

**Risk:** Existing users might notice different retry patterns.

**Mitigation:**

- Behavior change is internal only (no API change)
- Retry with jitter actually improves behavior (avoids thundering herd)
- CircuitBreaker with 60s provides similar protection to 5min Cooldown for most cases

**Trade-off:** Shorter maximum wait time (60s vs 5-60min), but:

- 5-60min was likely too long anyway
- Users can still retry manually if needed
- Retry provides intelligent backoff (not just fixed time)

### Risk 3: Dependency on plugin-sdk

**Risk:** Coupling to OpenClaw plugin-sdk infrastructure.

**Mitigation:**

- This is the intended pattern for plugins (see Discord, Telegram)
- plugin-sdk is stable and versioned
- No new dependency added (already available via runtime)

**Trade-off:** Slight increase in coupling, but:

- Follows OpenClaw architecture correctly
- Reduces duplicate code
- Benefits from core improvements

## Migration Plan

### Phase 1: Add Retry Infrastructure (Low Risk)

1. Create `src/infrastructure/retry-policy.ts`
2. Implement platform-specific RetryRunners
3. Add tests for new retry policies
4. No behavior change yet

### Phase 2: Update CircuitBreaker Configuration (Low Risk)

1. Update `DEFAULT_CIRCUIT_BREAKER_CONFIG` in `data-source-config.ts`
2. Update related tests
3. No code logic changes

### Phase 3: Refactor fetchWithFailover (Medium Risk)

1. Modify `BasePlatformAdapter` to use RetryRunner
2. Remove `withRetry()` method
3. Update tests
4. Keep CooldownManager temporarily (but unused)

### Phase 4: Remove Cooldown (Low Risk)

1. Delete `CooldownManager.ts` and tests
2. Remove Cooldown imports from `BasePlatformAdapter`
3. Update documentation
4. Clean up configuration interfaces

### Rollback Strategy

- Each phase is independent and can be reverted individually
- No database or persistent state changes
- Configuration changes are trivial to revert
- Keep old code in comments initially if desired

## Open Questions

1. **Should we add a "disabled" flag for severe errors?**
   - Option A: Mark DataSource as `disabled: true` on severe errors (requires manual reset)
   - Option B: Rely on CircuitBreaker's 60s protection
   - Recommendation: Option B for now, add Option A later if needed

2. **Should retry configuration be per-platform or per-datasource?**
   - Option A: One RetryRunner per platform (taobao, amazon, etc.)
   - Option B: One RetryRunner per datasource type (official_api, third_party, etc.)
   - Recommendation: Option A (per-platform), as error patterns differ by platform

3. **How to handle retry-after headers?**
   - Taobao API may return retry-after in rate limit responses
   - Need to extract and pass to `retryAfterMs` parameter
   - Implementation detail, not blocking decision
