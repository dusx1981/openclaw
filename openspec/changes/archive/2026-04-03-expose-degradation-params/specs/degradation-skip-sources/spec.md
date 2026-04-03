# degradation-skip-sources Spec

## ADDED Requirements

### Requirement: User can skip specific data sources

The system SHALL allow users to specify data source IDs to skip via the `skipSources` parameter.

#### Scenario: Skip single source

- **WHEN** user provides `skipSources: ["taobao_crawler"]`
- **THEN** the system SHALL not include `taobao_crawler` in the degradation path

#### Scenario: Skip multiple sources

- **WHEN** user provides `skipSources: ["taobao_crawler", "taobao_open_search"]`
- **THEN** the system SHALL not include either source in the degradation path

#### Scenario: Skip non-existent source

- **WHEN** user provides `skipSources: ["non_existent_source"]`
- **THEN** the system SHALL ignore the non-existent source ID

### Requirement: skipSources parameter is optional

The system SHALL treat `skipSources` as an optional parameter with empty array as default.

#### Scenario: No skipSources provided

- **WHEN** user does not provide `skipSources` parameter
- **THEN** the system SHALL not skip any sources (except those filtered by other parameters)

### Requirement: skipSources integrates with other parameters

The system SHALL apply `skipSources` in combination with other degradation parameters.

#### Scenario: skipSources with skipTypes

- **WHEN** user provides `skipSources: ["taobao_third_party"]` and `skipTypes: ["skill_crawler"]`
- **THEN** the system SHALL skip both `taobao_third_party` and all skill_crawler type sources

#### Scenario: skipSources with preferredSource conflict

- **WHEN** user provides `preferredSource: "taobao_crawler"` and `skipSources: ["taobao_crawler"]`
- **THEN** the system SHALL skip `taobao_crawler` (skipSources takes precedence)

#### Scenario: skipSources with preset

- **WHEN** user provides `skipSources: ["taobao_third_party"]` and `preset: "standard"`
- **THEN** the system SHALL use standard preset order but skip `taobao_third_party`

### Requirement: skipSources filters by exact ID match

The system SHALL match skipSources values against data source IDs exactly.

#### Scenario: Partial ID match

- **WHEN** user provides `skipSources: ["taobao"]`
- **THEN** the system SHALL only skip a source with ID exactly "taobao", not "taobao_official_api" or "taobao_crawler"
