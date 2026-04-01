## ADDED Requirements

### Requirement: Source health tracking

The system SHALL track the health of each data source using a sliding window of recent attempts.

#### Scenario: Record successful attempt
- **WHEN** a source request succeeds
- **THEN** system increments `recentAttempts` and `recentSuccesses` for that source

#### Scenario: Record failed attempt
- **WHEN** a source request fails
- **THEN** system increments `recentAttempts` and records `lastError` for that source

#### Scenario: Health score calculation
- **WHEN** health score is calculated
- **THEN** score equals `recentSuccesses / recentAttempts` (0.0 to 1.0)

### Requirement: Unhealthy source filtering

The system SHALL filter out sources with low health scores from selection.

#### Scenario: Skip severely unhealthy source
- **WHEN** a source has `healthScore < 0.3`
- **THEN** system skips that source during selection

#### Scenario: Include healthy source
- **WHEN** a source has `healthScore >= 0.3`
- **THEN** system includes that source in selection candidates

### Requirement: Health score reset

The system SHALL reset health scores when requested.

#### Scenario: Reset specific source health
- **WHEN** `resetHealth(sourceId)` is called
- **THEN** that source's `recentAttempts` and `recentSuccesses` are reset to 0

#### Scenario: Reset all sources health
- **WHEN** `resetAllHealth()` is called
- **THEN** all sources' health stats are reset