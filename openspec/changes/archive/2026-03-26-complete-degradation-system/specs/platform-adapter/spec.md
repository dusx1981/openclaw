## MODIFIED Requirements

### Requirement: Fetch with failover

The system SHALL fetch data from sources with automatic failover.

#### Scenario: Primary source success
- **WHEN** primary source succeeds
- **THEN** result SHALL be returned without trying fallbacks

#### Scenario: Primary fail fallback success
- **WHEN** primary source fails and fallback succeeds
- **THEN** fallback result SHALL be returned with isDegraded=true

#### Scenario: All sources fail
- **WHEN** all sources fail
- **THEN** error result SHALL be returned

## ADDED Requirements

### Requirement: Circuit breaker integration

The system SHALL integrate circuit breaker into fetchWithFailover.

#### Scenario: Skip source with open circuit breaker
- **WHEN** source circuit breaker is Open
- **THEN** source SHALL be skipped and next source attempted

#### Scenario: Update circuit breaker on success
- **WHEN** source request succeeds
- **THEN** circuit breaker success count SHALL be incremented

#### Scenario: Update circuit breaker on failure
- **WHEN** source request fails
- **THEN** circuit breaker failure count SHALL be incremented

### Requirement: Cooldown integration

The system SHALL integrate cooldown into fetchWithFailover.

#### Scenario: Skip cooldown source
- **WHEN** source is in cooldown and cannot probe
- **THEN** source SHALL be skipped

#### Scenario: Probe cooldown source
- **WHEN** source is in cooldown and can probe
- **THEN** probe request SHALL be attempted

#### Scenario: Record source error
- **WHEN** source request fails
- **THEN** error SHALL be recorded with classified reason

#### Scenario: Record source success
- **WHEN** source request succeeds
- **THEN** success SHALL be recorded and cooldown reset

### Requirement: Decision logging integration

The system SHALL log degradation decisions during fetchWithFailover.

#### Scenario: Log source skip decision
- **WHEN** source is skipped due to circuit breaker or cooldown
- **THEN** decision SHALL be logged with reason

#### Scenario: Log source attempt result
- **WHEN** source request completes (success or failure)
- **THEN** result SHALL be logged with latency

#### Scenario: Log fallback decision
- **WHEN** falling back to next source
- **THEN** fallback decision SHALL be logged