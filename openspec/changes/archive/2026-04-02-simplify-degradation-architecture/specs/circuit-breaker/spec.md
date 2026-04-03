# Specification: Circuit Breaker Configuration

## MODIFIED Requirements

### Requirement: Default configuration values

The system SHALL use updated default CircuitBreaker configuration values aligned with industry best practices.

Default configuration SHALL be:

- `enabled`: true
- `failureThreshold`: 5 (unchanged)
- `openDuration`: 60000ms (changed from 30000ms)
- `halfOpenMaxCalls`: 10 (changed from 1)
- `successThreshold`: 3 (unchanged)

#### Scenario: Increased open duration

- **WHEN** CircuitBreaker transitions to OPEN state
- **THEN** it SHALL remain OPEN for 60 seconds before transitioning to HALF-OPEN
- **AND** all requests during OPEN state SHALL be rejected immediately

#### Scenario: Multiple half-open probes

- **WHEN** CircuitBreaker is in HALF-OPEN state
- **THEN** it SHALL allow up to 10 calls to test service recovery
- **AND** if any call fails, transition back to OPEN immediately

#### Scenario: Recovery to closed state

- **WHEN** CircuitBreaker is in HALF-OPEN state
- **AND** 3 consecutive calls succeed
- **THEN** CircuitBreaker SHALL transition to CLOSED state

### Requirement: Configuration override

The system SHALL allow custom configuration to override defaults.

#### Scenario: Custom open duration

- **WHEN** `circuitBreaker.openDuration` is specified in configuration
- **THEN** system SHALL use the specified value instead of 60000ms default

#### Scenario: Custom half-open max calls

- **WHEN** `circuitBreaker.halfOpenMaxCalls` is specified in configuration
- **THEN** system SHALL use the specified value instead of 10 default
