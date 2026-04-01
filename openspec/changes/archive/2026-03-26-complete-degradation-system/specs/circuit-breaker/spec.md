## ADDED Requirements

### Requirement: Circuit breaker state management

The system SHALL implement a three-state circuit breaker (Closed, Open, HalfOpen) for each data source.

#### Scenario: Initial state is Closed
- **WHEN** circuit breaker is created
- **THEN** state SHALL be Closed and allow all requests

#### Scenario: Transition to Open on failure threshold
- **WHEN** consecutive failures reach `failureThreshold` (default: 5)
- **THEN** state SHALL transition to Open and reject all requests

#### Scenario: Transition to HalfOpen after timeout
- **WHEN** Open state duration exceeds `openDuration` (default: 30000ms)
- **THEN** state SHALL transition to HalfOpen and allow probe requests

#### Scenario: HalfOpen to Closed on success threshold
- **WHEN** consecutive successes in HalfOpen reach `successThreshold` (default: 3)
- **THEN** state SHALL transition to Closed

#### Scenario: HalfOpen to Open on failure
- **WHEN** any failure occurs in HalfOpen state
- **THEN** state SHALL transition back to Open

### Requirement: Circuit breaker request handling

The system SHALL handle requests according to circuit breaker state.

#### Scenario: Closed state allows requests
- **WHEN** state is Closed
- **THEN** request SHALL be forwarded to data source

#### Scenario: Open state rejects requests
- **WHEN** state is Open
- **THEN** request SHALL be rejected immediately without calling data source

#### Scenario: HalfOpen allows limited requests
- **WHEN** state is HalfOpen
- **THEN** up to `halfOpenMaxCalls` requests SHALL be allowed

### Requirement: Circuit breaker configuration

The system SHALL support configurable circuit breaker settings.

#### Scenario: Default configuration applied
- **WHEN** no custom config is provided
- **THEN** defaults SHALL be: failureThreshold=5, openDuration=30000ms, halfOpenMaxCalls=1, successThreshold=3

#### Scenario: Custom configuration applied
- **WHEN** custom config is provided
- **THEN** custom values SHALL override defaults

### Requirement: Circuit breaker manual reset

The system SHALL allow manual reset of circuit breaker state.

#### Scenario: Manual reset to Closed
- **WHEN** `reset()` is called
- **THEN** state SHALL be reset to Closed and failure count SHALL be zero