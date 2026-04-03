# degradation-custom-order Spec

## ADDED Requirements

### Requirement: User can specify custom degradation order

The system SHALL allow users to specify a custom order of data source types for degradation path via the `customOrder` parameter.

#### Scenario: Valid custom order

- **WHEN** user provides `customOrder: ["third_party_api", "official_api", "open_search"]`
- **THEN** the system SHALL attempt data sources in the specified order

#### Scenario: Invalid data source type in custom order

- **WHEN** user provides `customOrder: ["invalid_type", "official_api"]`
- **THEN** the system SHALL ignore the custom order and use CORE_ORDER default

#### Scenario: Empty custom order

- **WHEN** user provides `customOrder: []`
- **THEN** the system SHALL use CORE_ORDER default

#### Scenario: Duplicate types in custom order

- **WHEN** user provides `customOrder: ["official_api", "official_api", "third_party_api"]`
- **THEN** the system SHALL ignore the custom order and use CORE_ORDER default

### Requirement: customOrder parameter is optional

The system SHALL treat `customOrder` as an optional parameter with no default value.

#### Scenario: No customOrder provided

- **WHEN** user does not provide `customOrder` parameter
- **THEN** the system SHALL use preset or CORE_ORDER based on other parameters

### Requirement: customOrder integrates with other parameters

The system SHALL apply `customOrder` in combination with other degradation parameters.

#### Scenario: customOrder with skipTypes

- **WHEN** user provides `customOrder: ["third_party_api", "skill_crawler"]` and `skipTypes: ["skill_crawler"]`
- **THEN** the system SHALL use order `["third_party_api"]` (skill_crawler filtered out)

#### Scenario: customOrder with allowCrawler

- **WHEN** user provides `customOrder: ["official_api", "skill_crawler"]` and `allowCrawler: false`
- **THEN** the system SHALL use order `["official_api"]` (skill_crawler filtered out)

#### Scenario: customOrder with maxSources

- **WHEN** user provides `customOrder: ["official_api", "third_party_api", "skill_crawler"]` and `maxSources: 2`
- **THEN** the system SHALL only try first 2 sources from the custom order
