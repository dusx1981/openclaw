## ADDED Requirements

### Requirement: Structured decision logging

The system SHALL log degradation decisions in structured JSON format.

#### Scenario: Log source failure decision
- **WHEN** a data source fails
- **THEN** log entry SHALL include: event, decision, runId, timestamp, platform, productId, source, error, latencyMs

#### Scenario: Log cooldown skip decision
- **WHEN** request is skipped due to cooldown
- **THEN** log entry SHALL include: decision="skip_cooldown_source", cooldown info

#### Scenario: Log circuit breaker open
- **WHEN** request is rejected by circuit breaker
- **THEN** log entry SHALL include: decision="circuit_open", circuitBreaker state

#### Scenario: Log stale cache fallback
- **WHEN** falling back to stale cache
- **THEN** log entry SHALL include: decision="fallback_to_stale", degradationLevel

### Requirement: Log retrieval

The system SHALL support retrieving logs by runId.

#### Scenario: Get logs by runId
- **WHEN** `getByRunId(runId)` is called
- **THEN** all log entries matching runId SHALL be returned

#### Scenario: Empty result for unknown runId
- **WHEN** `getByRunId(unknownId)` is called
- **THEN** empty array SHALL be returned

### Requirement: Recent logs retrieval

The system SHALL support retrieving most recent logs.

#### Scenario: Get recent logs
- **WHEN** `getRecent(limit)` is called
- **THEN** most recent `limit` log entries SHALL be returned

### Requirement: Log cleanup

The system SHALL support clearing logs.

#### Scenario: Clear all logs
- **WHEN** `clear()` is called
- **THEN** all stored logs SHALL be removed