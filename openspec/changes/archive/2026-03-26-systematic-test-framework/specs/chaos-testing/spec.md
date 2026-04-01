## ADDED Requirements

### Requirement: Latency injection

The system SHALL support injecting configurable latency into operations.

#### Scenario: Inject fixed latency
- **WHEN** `Chaos.injectLatency(1000)` is called
- **THEN** the operation SHALL take at least 1000ms

#### Scenario: Inject random latency
- **WHEN** `Chaos.injectRandomLatency(min, max)` is called
- **THEN** the operation SHALL take between min and max ms

### Requirement: Failure injection

The system SHALL support injecting random failures.

#### Scenario: Inject failure with rate
- **WHEN** `Chaos.injectFailure(0.5)` is called
- **THEN** 50% of calls SHALL fail

#### Scenario: Inject failure with specific error
- **WHEN** `Chaos.injectFailure(0.3, new TimeoutError())` is called
- **THEN** 30% of calls SHALL fail with TimeoutError

### Requirement: Partial response injection

The system SHALL support injecting incomplete responses.

#### Scenario: Inject partial response
- **WHEN** `Chaos.injectPartialResponse(data, 0.5)` is called
- **THEN** 50% of fields SHALL be removed from response

#### Scenario: Inject corrupted response
- **WHEN** `Chaos.injectCorruptedResponse()` is called
- **THEN** response SHALL have malformed data

### Requirement: Network error injection

The system SHALL support simulating network errors.

#### Scenario: Inject connection refused
- **WHEN** `Chaos.injectNetworkError("ECONNREFUSED")` is called
- **THEN** operation SHALL fail with connection refused error

#### Scenario: Inject timeout
- **WHEN** `Chaos.injectTimeout(5000)` is called
- **THEN** operation SHALL timeout after 5000ms

### Requirement: Chaos scenario composition

The system SHALL support composing multiple chaos effects.

#### Scenario: Sequential chaos
- **WHEN** `Chaos.sequence([latency, failure])` is configured
- **THEN** effects SHALL be applied in order

#### Scenario: Random chaos
- **WHEN** `Chaos.random([latency, failure, timeout])` is configured
- **THEN** one effect SHALL be randomly selected

### Requirement: Chaos seed control

The system SHALL support deterministic chaos with seed.

#### Scenario: Reproducible chaos
- **WHEN** `Chaos.setSeed(12345)` is called
- **THEN** chaos effects SHALL be reproducible with same seed