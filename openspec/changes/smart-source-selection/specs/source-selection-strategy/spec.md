## ADDED Requirements

### Requirement: Strategy-based source selection

The system SHALL support pluggable source selection strategies that determine which data source to use.

#### Scenario: Priority strategy selects by priority
- **WHEN** `strategy: "priority"` is configured
- **THEN** system selects available source with lowest priority number

#### Scenario: Cost-first strategy selects cheapest
- **WHEN** `strategy: "cost-first"` is configured
- **THEN** system selects available source with lowest costPerCall

#### Scenario: Reliability strategy selects most reliable
- **WHEN** `strategy: "reliability"` is configured
- **THEN** system selects available source with highest healthScore

### Requirement: Strategy configuration

The system SHALL allow strategy configuration per platform.

#### Scenario: Default strategy applied
- **WHEN** no strategy is configured for a platform
- **THEN** system uses "priority" strategy as default

#### Scenario: Platform-specific strategy
- **WHEN** `strategy: "cost-first"` is set for taobao platform
- **THEN** only taobao uses cost-first strategy, other platforms use default

### Requirement: Source type in result

The system SHALL include `sourceType` in FetchResult to indicate which type of source was used.

#### Scenario: Official API source type
- **WHEN** data is fetched from official API
- **THEN** result includes `sourceType: "official_api"`

#### Scenario: Third-party API source type
- **WHEN** data is fetched from third-party API
- **THEN** result includes `sourceType: "third_party_api"`

#### Scenario: Crawler source type
- **WHEN** data is fetched from crawler
- **THEN** result includes `sourceType: "crawler"`