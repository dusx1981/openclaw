## ADDED Requirements

### Requirement: Third-party API data source support

The system SHALL support third-party API data sources for product data collection.

#### Scenario: Register third-party API data source

- **WHEN** a third-party API executor is registered with the adapter
- **THEN** it SHALL be included in the data source fallback chain
- **AND** it SHALL be used when official API fails

#### Scenario: Jushutan API integration

- **WHEN** the Jushutan data source is configured with valid API credentials
- **THEN** it SHALL be marked as available
- **AND** `execute()` SHALL return product data from Jushutan API

#### Scenario: Chanmama API integration

- **WHEN** the Chanmama data source is configured with valid API credentials
- **THEN** it SHALL be marked as available
- **AND** `execute()` SHALL return product data from Chanmama API

### Requirement: Data source executor interface

The system SHALL provide a common interface for all data source executors.

#### Scenario: Executor availability check

- **WHEN** `isAvailable()` is called on an executor
- **THEN** it SHALL return true if credentials are valid and quota remains
- **AND** it SHALL return false otherwise

#### Scenario: Executor quota tracking

- **WHEN** `getQuota()` is called on an executor
- **THEN** it SHALL return current quota usage information
- **AND** it SHALL include used, remaining, and total quota

### Requirement: Error handling for third-party APIs

The system SHALL properly handle errors from third-party API services.

#### Scenario: Rate limit error

- **WHEN** a third-party API returns a rate limit error
- **THEN** the error SHALL be classified as "rate_limit"
- **AND** the data source SHALL enter cooldown

#### Scenario: Authentication error

- **WHEN** a third-party API returns an authentication error
- **THEN** the error SHALL be classified as "auth"
- **AND** the data source SHALL be marked as unavailable
