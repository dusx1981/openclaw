## ADDED Requirements

### Requirement: Platform hot list collection
The system SHALL collect hot product lists from multiple e-commerce platforms.

#### Scenario: Collect Taobao hot list
- **WHEN** scheduled collection time is reached (default every 4 hours)
- **THEN** system scrapes Taobao hot sales list
- **AND** stores products with ranking, category, and metrics

#### Scenario: Collect Amazon Best Sellers
- **WHEN** scheduled collection time is reached
- **THEN** system scrapes Amazon Best Sellers by category
- **AND** normalizes data into unified format

#### Scenario: Collect Douyin trending products
- **WHEN** scheduled collection time is reached
- **THEN** system collects Douyin good product list
- **AND** extracts video engagement metrics

### Requirement: Incremental update
The system SHALL perform incremental updates to minimize redundant data collection.

#### Scenario: Detect new hot products
- **WHEN** comparing current hot list with previous
- **THEN** system identifies newly added products
- **AND** flags for priority analysis

#### Scenario: Track ranking changes
- **WHEN** product ranking changes on hot list
- **THEN** system records ranking movement
- **AND** calculates velocity of change

### Requirement: Third-party data integration
The system SHALL integrate with third-party data platforms for enhanced coverage.

#### Scenario: Integrate Chanmama data
- **WHEN** third-party API is configured
- **THEN** system fetches hot product data from Chanmama
- **AND** merges with internally collected data