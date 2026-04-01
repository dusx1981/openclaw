## ADDED Requirements

### Requirement: ecom-product-fetch tool

The system SHALL provide an `ecom-product-fetch` agent tool that fetches product data from e-commerce platforms.

#### Scenario: Fetch product from Taobao
- **WHEN** agent calls `ecom-product-fetch` with `platform="taobao"` and a valid `productId`
- **THEN** tool returns product data including title, price, description, and source

#### Scenario: Fetch product with fallback
- **WHEN** agent calls `ecom-product-fetch` and primary source fails
- **THEN** tool attempts fallback sources and returns data from first successful source

#### Scenario: Product not found
- **WHEN** agent calls `ecom-product-fetch` with non-existent `productId`
- **THEN** tool returns error with `not_found` status and platform message

#### Scenario: Platform not supported
- **WHEN** agent calls `ecom-product-fetch` with unsupported platform
- **THEN** tool returns error listing available platforms

### Requirement: ecom-product-search tool

The system SHALL provide an `ecom-product-search` agent tool that searches products by keyword.

#### Scenario: Search products by keyword
- **WHEN** agent calls `ecom-product-search` with `platform` and `keyword`
- **THEN** tool returns up to 50 matching products with titles, prices, and IDs

#### Scenario: Search with custom limit
- **WHEN** agent calls `ecom-product-search` with `limit` parameter
- **THEN** tool returns at most `limit` products

#### Scenario: Search with no results
- **WHEN** agent calls `ecom-product-search` with keyword that matches no products
- **THEN** tool returns empty results array with total=0

### Requirement: ecom-validate-platform tool

The system SHALL provide an `ecom-validate-platform` agent tool that validates platform data collection.

#### Scenario: Run platform validation
- **WHEN** agent calls `ecom-validate-platform` with `platform`
- **THEN** tool runs validation with 10 sample requests and returns success rate

#### Scenario: Validation with custom count
- **WHEN** agent calls `ecom-validate-platform` with `count` parameter
- **THEN** tool runs validation with specified number of requests

#### Scenario: Validation returns degradation info
- **WHEN** validation completes with fallbacks
- **THEN** report includes degradation path counts and fallback events

### Requirement: Tool parameter validation

All meichao tools SHALL validate parameters and return descriptive errors for invalid input.

#### Scenario: Missing required parameter
- **WHEN** agent calls any meichao tool without required parameter
- **THEN** tool returns error specifying which parameter is missing

#### Scenario: Invalid platform value
- **WHEN** agent calls tool with invalid `platform` value
- **THEN** tool returns error with list of supported platforms

### Requirement: Graceful infrastructure failure

Tools SHALL return helpful errors when infrastructure (PostgreSQL/Redis) is unavailable.

#### Scenario: Database unavailable
- **WHEN** tool requires database and connection fails
- **THEN** tool returns error with connection details and setup instructions

#### Scenario: Cache unavailable
- **WHEN** cache connection fails
- **THEN** tool continues without cache (degraded mode)