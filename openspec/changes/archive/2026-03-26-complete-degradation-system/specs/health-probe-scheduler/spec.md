## ADDED Requirements

### Requirement: Periodic health probing

The system SHALL periodically probe unhealthy data sources.

#### Scenario: Probe scheduling for unhealthy sources
- **WHEN** a data source is marked unhealthy
- **THEN** health probe SHALL be scheduled at `interval` (default: 60000ms)

#### Scenario: Skip healthy sources
- **WHEN** a data source is already healthy
- **THEN** no health probe SHALL be scheduled

#### Scenario: Probe timeout handling
- **WHEN** health probe exceeds `timeout` (default: 10000ms)
- **THEN** probe SHALL be considered failed

### Requirement: Health status tracking

The system SHALL track health status with threshold-based transitions.

#### Scenario: Mark unhealthy on threshold
- **WHEN** consecutive probe failures reach `unhealthyThreshold` (default: 3)
- **THEN** data source SHALL be marked unhealthy

#### Scenario: Mark healthy on recovery threshold
- **WHEN** consecutive probe successes reach `recoveryThreshold` (default: 2)
- **THEN** data source SHALL be marked healthy

### Requirement: Health probe configuration

The system SHALL support configurable health probe settings.

#### Scenario: Default configuration applied
- **WHEN** no custom config is provided
- **THEN** defaults SHALL be: interval=60000ms, timeout=10000ms, unhealthyThreshold=3, recoveryThreshold=2

#### Scenario: Initial delay before first probe
- **WHEN** scheduler starts
- **THEN** first probe SHALL be delayed by `initialDelay` (default: 5000ms)

### Requirement: Health probe start and stop

The system SHALL allow starting and stopping health probes.

#### Scenario: Start probing
- **WHEN** `start()` is called
- **THEN** periodic probes SHALL begin for all unhealthy sources

#### Scenario: Stop probing
- **WHEN** `stop()` is called
- **THEN** all scheduled probes SHALL be cancelled