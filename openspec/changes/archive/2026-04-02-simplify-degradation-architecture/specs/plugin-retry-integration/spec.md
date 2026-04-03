# Specification: Plugin Retry Integration

## ADDED Requirements

### Requirement: Retry runner creation for platforms

The system SHALL provide platform-specific retry runners using `openclaw/plugin-sdk/infra-runtime`.

#### Scenario: Create Taobao retry runner

- **WHEN** `createTaobaoRetryRunner()` is called
- **THEN** system SHALL return a `RetryRunner` configured with Taobao-specific defaults (attempts: 3, minDelay: 500ms, maxDelay: 30s, jitter: 0.1)
- **AND** the runner SHALL use error classification to determine retry eligibility

#### Scenario: Create Amazon retry runner

- **WHEN** `createAmazonRetryRunner()` is called
- **THEN** system SHALL return a `RetryRunner` configured with Amazon-specific defaults (attempts: 3, minDelay: 1000ms, maxDelay: 60s, jitter: 0.1)
- **AND** the runner SHALL use error classification to determine retry eligibility

### Requirement: Error classification for retry decisions

The system SHALL classify errors to determine retry eligibility based on severity.

#### Scenario: Retry transient errors

- **WHEN** error is classified as `rate_limit`, `timeout`, or `overloaded`
- **THEN** `shouldRetry` SHALL return `true`

#### Scenario: No retry for severe errors

- **WHEN** error is classified as `auth_permanent`, `blocked`, or `billing`
- **THEN** `shouldRetry` SHALL return `false`

### Requirement: Exponential backoff with jitter

The retry mechanism SHALL use exponential backoff with configurable jitter.

#### Scenario: Backoff timing

- **WHEN** retry attempt N fails
- **THEN** system SHALL wait `minDelayMs * 2^(N-1)` milliseconds before next attempt
- **AND** apply jitter within configured range (default 10%)

#### Scenario: Maximum delay cap

- **WHEN** calculated backoff exceeds `maxDelayMs`
- **THEN** system SHALL wait exactly `maxDelayMs` milliseconds

### Requirement: Retry-after header support

The retry mechanism SHALL respect server-provided retry-after timing when available.

#### Scenario: Use retry-after from response

- **WHEN** API response includes retry-after timing
- **THEN** system SHALL wait the specified duration instead of calculated backoff
- **AND** ensure wait time is at least `minDelayMs`

### Requirement: Integration with CircuitBreaker

The retry runner SHALL be used in conjunction with CircuitBreaker in the failover flow.

#### Scenario: Retry within CircuitBreaker guard

- **WHEN** executing a data source call with failover
- **THEN** system SHALL first check CircuitBreaker state
- **AND** if CircuitBreaker allows execution, use retry runner for the call
- **AND** record success/failure to CircuitBreaker after retry completes
