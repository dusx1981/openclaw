## ADDED Requirements

### Requirement: Platform validator abstraction

The system SHALL provide an abstract PlatformValidator class defining the validation flow.

#### Scenario: Define validation template
- **WHEN** a new platform validator is created
- **THEN** it SHALL implement the abstract validate() method

#### Scenario: Extensible validator registration
- **WHEN** a new platform is added
- **THEN** a new validator class SHALL be registered without modifying existing code

### Requirement: Platform-specific validators

The system SHALL provide platform-specific validator implementations.

#### Scenario: Taobao validator
- **WHEN** `openclaw meichao validate taobao` is executed
- **THEN** TaobaoValidator SHALL be used with TaobaoAdapter

#### Scenario: Amazon validator
- **WHEN** `openclaw meichao validate amazon` is executed
- **THEN** AmazonValidator SHALL be used with AmazonAdapter

#### Scenario: Unknown platform error
- **WHEN** `openclaw meichao validate unknown` is executed
- **THEN** system SHALL return error "Unknown platform: unknown"

### Requirement: Real data collection

The system SHALL collect real data using platform adapters.

#### Scenario: Call real adapter
- **WHEN** validation runs
- **THEN** real platform adapter fetch() SHALL be called with real product IDs

#### Scenario: Track collection results
- **WHEN** collection completes
- **THEN** success/failure status SHALL be recorded per product

#### Scenario: Handle adapter errors
- **WHEN** adapter throws error
- **THEN** error SHALL be caught and recorded without stopping validation

### Requirement: Validation statistics

The system SHALL collect and calculate validation statistics.

#### Scenario: Overall success rate
- **WHEN** validation completes
- **THEN** overall success rate SHALL be calculated as (successes / total) * 100

#### Scenario: Per-source statistics
- **WHEN** multiple data sources are used
- **THEN** success rate SHALL be tracked per data source

#### Scenario: Failure reason breakdown
- **WHEN** failures occur
- **THEN** failure reasons SHALL be categorized and counted

### Requirement: Sample collection

The system SHALL collect data samples during validation.

#### Scenario: Collect product samples
- **WHEN** validation runs
- **THEN** up to 5 successful products SHALL be collected as samples

#### Scenario: Sample data fields
- **WHEN** samples are collected
- **THEN** each sample SHALL include: platform, productId, title, price, source

#### Scenario: Mask sensitive data
- **WHEN** --mask-sensitive option is used
- **THEN** productId and sourceUrl SHALL be partially masked

### Requirement: Degradation tracking

The system SHALL track degradation flow during validation.

#### Scenario: Record fallback events
- **WHEN** primary source fails and fallback succeeds
- **THEN** fallback event SHALL be recorded with source names

#### Scenario: Degradation path summary
- **WHEN** validation completes
- **THEN** degradation paths used SHALL be summarized in report

### Requirement: Validation report

The system SHALL generate validation reports.

#### Scenario: Text report output
- **WHEN** validation completes without --json
- **THEN** report SHALL be formatted as human-readable text

#### Scenario: JSON report output
- **WHEN** validation completes with --json
- **THEN** report SHALL be valid JSON

#### Scenario: Report content
- **WHEN** report is generated
- **THEN** report SHALL include: platform, timestamp, statistics, samples, degradation info

### Requirement: CLI command interface

The system SHALL provide CLI command for validation.

#### Scenario: Single platform validation
- **WHEN** `openclaw meichao validate taobao --count 10` is executed
- **THEN** 10 products SHALL be validated and results displayed

#### Scenario: Batch validation
- **WHEN** `openclaw meichao validate --all` is executed
- **THEN** all registered platforms SHALL be validated

#### Scenario: Custom options
- **WHEN** validation is executed with options
- **THEN** options SHALL include: --count, --json, --mask-sensitive