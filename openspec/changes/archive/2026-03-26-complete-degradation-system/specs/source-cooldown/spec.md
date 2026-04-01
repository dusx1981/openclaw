## ADDED Requirements

### Requirement: Error classification

The system SHALL classify data source errors into standardized categories.

#### Scenario: HTTP status code mapping
- **WHEN** HTTP error 401 is received
- **THEN** reason SHALL be "auth"

#### Scenario: HTTP 403 mapped to blocked
- **WHEN** HTTP error 403 is received
- **THEN** reason SHALL be "blocked" and isSevere SHALL be true

#### Scenario: HTTP 429 mapped to rate limit
- **WHEN** HTTP error 429 is received
- **THEN** reason SHALL be "rate_limit"

#### Scenario: HTTP 503 mapped to overloaded
- **WHEN** HTTP error 503 is received
- **THEN** reason SHALL be "overloaded"

#### Scenario: Timeout classification
- **WHEN** request timeout occurs
- **THEN** reason SHALL be "timeout"

#### Scenario: Unknown error fallback
- **WHEN** error cannot be classified
- **THEN** reason SHALL be "unknown"

### Requirement: Cooldown calculation

The system SHALL calculate cooldown duration using exponential backoff.

#### Scenario: Normal error cooldown
- **WHEN** error is not severe and errorCount=1
- **THEN** cooldown duration SHALL be 5 minutes

#### Scenario: Exponential backoff for normal errors
- **WHEN** errorCount=3 and error is not severe
- **THEN** cooldown duration SHALL be min(60min, 125min) = 60 minutes

#### Scenario: Severe error cooldown
- **WHEN** error reason is "blocked" and errorCount=1
- **THEN** cooldown duration SHALL be 60 minutes (5min × 12)

#### Scenario: Severe error max cooldown
- **WHEN** error reason is "auth_permanent" and errorCount=2
- **THEN** cooldown duration SHALL be min(24h, 120min) = 120 minutes

### Requirement: Cooldown state management

The system SHALL manage cooldown state per data source.

#### Scenario: Record error updates cooldown
- **WHEN** error is recorded for a source
- **THEN** errorCount SHALL increment and cooldownUntil SHALL be set

#### Scenario: Success resets cooldown
- **WHEN** success is recorded for a source
- **THEN** errorCount SHALL be 0 and cooldownUntil SHALL be undefined

#### Scenario: Check if in cooldown
- **WHEN** `isInCooldown(sourceId)` is called and cooldownUntil > now
- **THEN** result SHALL be true

### Requirement: Probe eligibility check

The system SHALL determine if a cooldown source can be probed.

#### Scenario: Probe eligible for primary with fallback
- **WHEN** source is primary AND has fallback AND cooldown ending within 2 minutes
- **THEN** `canProbe()` SHALL return true

#### Scenario: Probe not eligible without fallback
- **WHEN** source has no fallback available
- **THEN** `canProbe()` SHALL return false

#### Scenario: Probe interval enforced
- **WHEN** last probe was less than 30 seconds ago
- **THEN** `canProbe()` SHALL return false