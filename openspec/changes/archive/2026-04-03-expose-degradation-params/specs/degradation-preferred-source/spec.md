# degradation-preferred-source Spec

## ADDED Requirements

### Requirement: User can specify preferred data source

The system SHALL allow users to specify a preferred data source ID via the `preferredSource` parameter, which will be tried first before following the degradation path.

#### Scenario: Valid preferred source

- **WHEN** user provides `preferredSource: "taobao_third_party"` and that source is available
- **THEN** the system SHALL try `taobao_third_party` first, then continue with degradation path

#### Scenario: Preferred source not found

- **WHEN** user provides `preferredSource: "non_existent_source"`
- **THEN** the system SHALL skip the preferred source and continue with degradation path

#### Scenario: Preferred source in cooldown

- **WHEN** user provides `preferredSource: "taobao_official_api"` but that source is in cooldown
- **THEN** the system SHALL skip the preferred source and continue with degradation path

#### Scenario: Preferred source has no quota

- **WHEN** user provides `preferredSource: "taobao_crawler"` but that source has exhausted daily quota
- **THEN** the system SHALL skip the preferred source and continue with degradation path

### Requirement: preferredSource parameter is optional

The system SHALL treat `preferredSource` as an optional parameter.

#### Scenario: No preferredSource provided

- **WHEN** user does not provide `preferredSource` parameter
- **THEN** the system SHALL start with the first source in the degradation path

### Requirement: preferredSource integrates with customOrder

The system SHALL honor preferredSource even when customOrder is specified.

#### Scenario: preferredSource with customOrder

- **WHEN** user provides `preferredSource: "taobao_third_party"` and `customOrder: ["official_api", "open_search"]`
- **THEN** the system SHALL try `taobao_third_party` first, then `official_api`, then `open_search`
