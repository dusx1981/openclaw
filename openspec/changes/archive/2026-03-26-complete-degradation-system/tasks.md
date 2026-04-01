## 1. Types and Interfaces

- [x] 1.1 Add DataSourceFailoverReason type to domain/types.ts
- [x] 1.2 Add CircuitBreakerState and CircuitBreakerConfig types to domain/types.ts
- [x] 1.3 Add CooldownSettings and SourceCooldownState types to domain/types.ts
- [x] 1.4 Add HealthProbeConfig type to domain/types.ts
- [x] 1.5 Add DegradationDecisionLog type to domain/types.ts
- [x] 1.6 Add DegradationResult interface to domain/types.ts

## 2. Error Classification

- [x] 2.1 Create ErrorClassifier.ts with classifyError function
- [x] 2.2 Implement HTTP status code to reason mapping
- [x] 2.3 Implement platform-specific error code mapping
- [x] 2.4 Implement isSevereError helper function
- [x] 2.5 Add ErrorClassifier.test.ts with all classification scenarios

## 3. Circuit Breaker

- [x] 3.1 Create CircuitBreaker.ts with state management
- [x] 3.2 Implement Closed state behavior (allow requests, count failures)
- [x] 3.3 Implement Open state behavior (reject requests, track timeout)
- [x] 3.4 Implement HalfOpen state behavior (allow limited probes)
- [x] 3.5 Implement state transitions (Closed→Open→HalfOpen→Closed)
- [x] 3.6 Implement reset() method for manual recovery
- [x] 3.7 Add CircuitBreaker.test.ts with all state scenarios

## 4. Source Cooldown

- [x] 4.1 Create CooldownManager.ts interface and in-memory implementation
- [x] 4.2 Implement calculateCooldownDuration with exponential backoff
- [x] 4.3 Implement isInCooldown check
- [x] 4.4 Implement recordError with cooldown calculation
- [x] 4.5 Implement recordSuccess with reset
- [x] 4.6 Implement canProbe eligibility check
- [x] 4.7 Add CooldownManager.test.ts with all cooldown scenarios

## 5. Health Probe Scheduler

- [x] 5.1 Create HealthProbeScheduler.ts with timer-based scheduling
- [x] 5.2 Implement start() with initial delay and interval scheduling
- [x] 5.3 Implement stop() to cancel all scheduled probes
- [x] 5.4 Implement probe execution with timeout handling
- [x] 5.5 Implement unhealthy threshold tracking
- [x] 5.6 Implement recovery threshold tracking
- [x] 5.7 Add HealthProbeScheduler.test.ts with all probe scenarios

## 6. Decision Logger

- [x] 6.1 Create DecisionLogger.ts interface and in-memory implementation
- [x] 6.2 Implement log() with structured JSON output
- [x] 6.3 Implement getByRunId() retrieval
- [x] 6.4 Implement getRecent() retrieval
- [x] 6.5 Implement clear() cleanup
- [x] 6.6 Add DecisionLogger.test.ts with all logging scenarios

## 7. Data Source Config Extension

- [x] 7.1 Add cooldown config to DataSourceConfig type
- [x] 7.2 Add circuitBreaker config to DataSourceConfig type
- [x] 7.3 Add healthProbe config to DataSourceConfig type
- [x] 7.4 Update parseDataSourceConfig to handle new configs
- [x] 7.5 Update data-source-config.test.ts with new config scenarios

## 8. Platform Adapter Integration

- [x] 8.1 Add CircuitBreaker instance to BasePlatformAdapter
- [x] 8.2 Add CooldownManager to BasePlatformAdapter
- [x] 8.3 Add DecisionLogger to BasePlatformAdapter
- [x] 8.4 Integrate circuit breaker check in fetchWithFailover
- [x] 8.5 Integrate cooldown check in fetchWithFailover
- [x] 8.6 Add error classification on failure
- [x] 8.7 Add decision logging for all transitions
- [x] 8.8 Update BasePlatformAdapter.test.ts with integration tests

## 9. Unified Degradation Flow

- [x] 9.1 Update FetchProductUseCase to use new degradation result
- [x] 9.2 Implement Layer 1: Fresh cache with degradation metadata
- [x] 9.3 Implement Layer 2: Database with freshness check
- [x] 9.4 Implement Layer 3: Sources with circuit breaker + cooldown
- [x] 9.5 Implement Layer 4: Stale cache fallback
- [x] 9.6 Implement Layer 5: Error handling
- [x] 9.7 Add FetchProductUseCase.integration.test.ts with full flow tests

## 10. Configuration and Wiring

- [x] 10.1 Create degradation.config.ts with default settings
- [x] 10.2 Add environment variable support for degradation settings
- [x] 10.3 Wire up all components in dependency injection
- [x] 10.4 Add configuration validation

## 11. Documentation

- [x] 11.1 Update docs/dev/数据采集/架构设计.md with new architecture
- [x] 11.2 Add degradation flow diagram
- [x] 11.3 Add configuration reference documentation

## Summary

- **Total Tasks**: 58
- **Phase 1-2**: Foundation (types, error classification)
- **Phase 3-6**: Core mechanisms (circuit breaker, cooldown, health probe, logging)
- **Phase 7-9**: Integration (config extension, adapter integration, unified flow)
- **Phase 10-11**: Configuration and documentation