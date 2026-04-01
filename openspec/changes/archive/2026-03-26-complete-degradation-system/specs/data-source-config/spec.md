## MODIFIED Requirements

### Requirement: Data source configuration format

The system SHALL support both shorthand and full configuration formats for data sources.

#### Scenario: Shorthand configuration
- **WHEN** configuration is a string "taobao_official_api"
- **THEN** it SHALL be parsed as primary source with no fallbacks and default settings

#### Scenario: Full configuration
- **WHEN** configuration is an object with primary, fallbacks, strategy, cooldown
- **THEN** all fields SHALL be parsed and defaults applied for missing fields

## ADDED Requirements

### Requirement: Cooldown configuration support

The system SHALL support cooldown settings in data source configuration.

#### Scenario: Default cooldown settings
- **WHEN** no cooldown config is provided
- **THEN** defaults SHALL be: baseMinutes=5, maxMinutes=60, severeMultiplier=12

#### Scenario: Custom cooldown settings
- **WHEN** cooldown config is provided
- **THEN** custom values SHALL override defaults

### Requirement: Circuit breaker configuration support

The system SHALL support circuit breaker settings in data source configuration.

#### Scenario: Default circuit breaker settings
- **WHEN** no circuitBreaker config is provided
- **THEN** defaults SHALL be: enabled=true, failureThreshold=5, openDuration=30000, halfOpenMaxCalls=1, successThreshold=3

#### Scenario: Circuit breaker disabled
- **WHEN** circuitBreaker.enabled=false
- **THEN** circuit breaker SHALL NOT be used for this data source

### Requirement: Health probe configuration support

The system SHALL support health probe settings in data source configuration.

#### Scenario: Default health probe settings
- **WHEN** no healthProbe config is provided
- **THEN** defaults SHALL be: interval=60000, timeout=10000, unhealthyThreshold=3, recoveryThreshold=2

#### Scenario: Custom health probe settings
- **WHEN** healthProbe config is provided
- **THEN** custom values SHALL override defaults