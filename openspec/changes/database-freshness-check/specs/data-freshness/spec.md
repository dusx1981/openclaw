## ADDED Requirements

### Requirement: Database freshness threshold configuration

The system SHALL support configurable database freshness threshold via `databaseFreshnessThresholdMs` setting.

Default value SHALL be 14400000 (4 hours).

#### Scenario: Default threshold applied
- **WHEN** no `databaseFreshnessThresholdMs` is configured
- **THEN** system uses default threshold of 4 hours

#### Scenario: Custom threshold applied
- **WHEN** `databaseFreshnessThresholdMs` is set to 7200000 (2 hours)
- **THEN** system uses 2 hours as freshness threshold

### Requirement: Database data freshness check

The system SHALL check `last_seen_at` field when fetching product from database and skip data older than threshold.

#### Scenario: Fresh database data returned
- **WHEN** product exists in database with `last_seen_at` within threshold
- **THEN** system returns database data with `degradationLevel: "database"`

#### Scenario: Stale database data skipped
- **WHEN** product exists in database but `last_seen_at` exceeds threshold
- **THEN** system skips database layer and continues to next degradation layer

#### Scenario: Missing last_seen_at treated as stale
- **WHEN** product exists in database but `last_seen_at` is null
- **THEN** system treats data as stale and skips database layer

### Requirement: Freshness result metadata

The system SHALL include freshness metadata in `FetchProductUseCaseResult` when database layer is checked.

#### Scenario: Freshness age included for database result
- **WHEN** database data is returned
- **THEN** result includes `databaseDataAgeMs` field indicating data age

#### Scenario: Stale database data reason
- **WHEN** database data is skipped due to staleness
- **THEN** degradation flow continues with reason "database_data_stale"