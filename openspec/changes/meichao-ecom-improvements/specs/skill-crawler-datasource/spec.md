## ADDED Requirements

### Requirement: Skill crawler data source support

The system SHALL support browser automation-based data collection as a fallback data source.

#### Scenario: Register skill crawler data source

- **WHEN** a skill crawler executor is registered with the adapter
- **THEN** it SHALL be included in the data source fallback chain after API sources
- **AND** it SHALL have lower priority than API-based sources

#### Scenario: Product detail crawling

- **WHEN** `execute()` is called with a product ID
- **THEN** the crawler SHALL navigate to the product page
- **AND** it SHALL extract product data (title, price, sales, etc.)

#### Scenario: Search result crawling

- **WHEN** `execute()` is called with search keywords
- **THEN** the crawler SHALL navigate to the search page
- **AND** it SHALL extract product listings from search results

### Requirement: Crawler error handling

The system SHALL handle browser automation errors gracefully.

#### Scenario: Page load timeout

- **WHEN** a page fails to load within the timeout period
- **THEN** the error SHALL be classified as "timeout"
- **AND** the operation SHALL be retried with exponential backoff

#### Scenario: Element not found

- **WHEN** a required element is not found on the page
- **THEN** the error SHALL be classified as "not_found"
- **AND** partial data SHALL be returned if available

#### Scenario: Anti-bot detection

- **WHEN** anti-bot measures are detected (captcha, login required)
- **THEN** the error SHALL be classified as "blocked"
- **AND** the crawler SHALL enter extended cooldown

### Requirement: Crawler resource management

The system SHALL manage browser instances efficiently.

#### Scenario: Browser instance pooling

- **WHEN** multiple crawl requests are made concurrently
- **THEN** browser instances SHALL be reused from a pool
- **AND** idle instances SHALL be terminated after a timeout

#### Scenario: Memory limit enforcement

- **WHEN** browser memory usage exceeds the configured limit
- **THEN** the browser instance SHALL be restarted
- **AND** pending requests SHALL be rerouted to other instances
