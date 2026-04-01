## ADDED Requirements

### Requirement: API client initialization

The system SHALL provide a TaobaoApiClient that can be initialized with credentials.

#### Scenario: Initialize with environment variables
- **WHEN** TaobaoApiClient is created without explicit credentials
- **THEN** it SHALL read TAOBAO_APP_KEY and TAOBAO_APP_SECRET from environment

#### Scenario: Initialize with explicit credentials
- **WHEN** TaobaoApiClient is created with appKey and appSecret parameters
- **THEN** it SHALL use the provided credentials for all API calls

### Requirement: API signature generation

The system SHALL generate valid signatures for Taobao API requests.

#### Scenario: Generate HMAC-SHA256 signature
- **WHEN** a request is prepared with method, timestamp, and parameters
- **THEN** the system SHALL generate a valid HMAC-SHA256 signature

#### Scenario: Include signature in request
- **WHEN** an API request is sent
- **THEN** the sign parameter SHALL be included in the request

### Requirement: Product detail query

The system SHALL support querying product details from Taobao API.

#### Scenario: Query product by ID
- **WHEN** fetchProduct(productId) is called with a valid Taobao product ID
- **THEN** the system SHALL call taobao.item.seller.get API and return product data

#### Scenario: Handle invalid product ID
- **WHEN** fetchProduct is called with an invalid or non-existent product ID
- **THEN** the system SHALL return an appropriate error

#### Scenario: Handle API rate limit
- **WHEN** API returns rate limit error (error code 7)
- **THEN** the system SHALL throw a rate limit error that triggers fallback

### Requirement: Product search

The system SHALL support searching products on Taobao.

#### Scenario: Search products by keyword
- **WHEN** searchProducts(keyword) is called
- **THEN** the system SHALL call taobao.items.search API and return matching products

#### Scenario: Paginated search results
- **WHEN** searchProducts is called with page and pageSize options
- **THEN** the system SHALL return paginated results

### Requirement: Error handling

The system SHALL properly handle Taobao API errors.

#### Scenario: Parse API error response
- **WHEN** Taobao API returns an error response
- **THEN** the system SHALL parse error code and message

#### Scenario: Classify retryable errors
- **WHEN** error code indicates temporary failure (rate limit, service busy)
- **THEN** the system SHALL mark error as retryable

### Requirement: Request configuration

The system SHALL support configurable request options.

#### Scenario: Set request timeout
- **WHEN** a custom timeout is configured
- **THEN** API requests SHALL timeout after the specified duration

#### Scenario: Configure API endpoint
- **WHEN** TAOBAO_API_ENDPOINT is set
- **THEN** requests SHALL be sent to the configured endpoint