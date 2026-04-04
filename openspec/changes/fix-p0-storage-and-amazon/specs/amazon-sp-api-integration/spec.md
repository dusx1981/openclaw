# Amazon SP-API Integration Specification

## ADDED Requirements

### Requirement: SP-API Authentication

The system SHALL authenticate with Amazon SP-API using LWA (Login with Amazon) and AWS Signature V4.

#### Scenario: Initial authentication

- **WHEN** initializing `AmazonSPApiClient` with valid credentials
- **THEN** the system exchanges refresh token for access token
- **AND** stores access token with expiration time
- **AND** access token is valid for 1 hour

#### Scenario: Token refresh

- **WHEN** access token is expired or about to expire (within 5 minutes)
- **THEN** the system automatically refreshes the token
- **AND** continues the operation without interruption
- **AND** logs the token refresh event

#### Scenario: Invalid credentials

- **WHEN** authentication fails due to invalid credentials
- **THEN** the system throws `AmazonAuthError`
- **AND** includes error code and message from Amazon
- **AND** does not retry authentication

### Requirement: Product Pricing API

The system SHALL retrieve product pricing information from Amazon Product Pricing API.

#### Scenario: Get pricing for single ASIN

- **WHEN** calling `getProductPricing(asin)`
- **THEN** the system returns `{ asin, price, currency, competitivePrice, offers }`
- **AND** price is the current selling price
- **AND** includes competitive pricing data if available
- **AND** respects Amazon rate limits

#### Scenario: Get pricing for multiple ASINs

- **WHEN** calling `getProductPricing([asin1, asin2])`
- **THEN** the system batches ASINs (max 20 per request)
- **AND** makes multiple requests if necessary
- **AND** returns pricing for all ASINs
- **AND** handles partial failures gracefully

#### Scenario: Pricing not available

- **WHEN** pricing is not available for an ASIN
- **THEN** the system returns `null` for that ASIN
- **AND** does not throw an error
- **AND** logs the unavailability

### Requirement: Catalog Items API

The system SHALL retrieve product catalog information from Amazon Catalog Items API.

#### Scenario: Get catalog item by ASIN

- **WHEN** calling `getCatalogItem(asin)`
- **THEN** the system returns `{ asin, title, brand, images, category, attributes }`
- **AND** includes all product attributes
- **AND** images array includes all product images
- **AND** category includes full category path

#### Scenario: Catalog item not found

- **WHEN** ASIN does not exist in Amazon catalog
- **THEN** the system throws `CatalogItemNotFoundError`
- **AND** includes the ASIN in the error
- **AND** does not retry the request

#### Scenario: Get multiple catalog items

- **WHEN** calling `getCatalogItems([asin1, asin2])`
- **THEN** the system makes parallel requests (max 10 concurrent)
- **AND** returns catalog items for all ASINs
- **AND** handles rate limiting automatically

### Requirement: Rate Limiting

The system SHALL respect Amazon SP-API rate limits and implement retry logic.

#### Scenario: Rate limit exceeded

- **WHEN** API returns 429 Too Many Requests
- **THEN** the system waits for the time specified in `x-amzn-RateLimit-Limit` header
- **AND** retries the request
- **AND** logs the rate limit event

#### Scenario: Retry with exponential backoff

- **WHEN** a request fails due to temporary issues
- **THEN** the system retries with exponential backoff
- **AND** initial delay is 1 second
- **AND** max delay is 32 seconds
- **AND** max retries is 5

#### Scenario: Max retries exceeded

- **WHEN** all retry attempts fail
- **THEN** the system throws `AmazonAPIError`
- **AND** includes all error details
- **AND** marks the operation as failed

### Requirement: Data Transformation

The system SHALL transform Amazon API responses to internal ProductData format.

#### Scenario: Transform pricing data

- **WHEN** receiving Amazon pricing response
- **THEN** the system maps to `ProductData` format
- **AND** converts currency to standard format
- **AND** normalizes price values
- **AND** extracts offer details

#### Scenario: Transform catalog data

- **WHEN** receiving Amazon catalog response
- **THEN** the system maps to `ProductData` format
- **AND** extracts all images
- **AND** normalizes category path
- **AND** maps attributes to standard fields

#### Scenario: Data validation

- **WHEN** transformed data does not meet validation rules
- **THEN** the system throws `DataValidationError`
- **AND** includes validation errors
- **AND** logs the invalid data

### Requirement: Error Classification

The system SHALL classify Amazon API errors and provide actionable information.

#### Scenario: Authentication errors

- **WHEN** authentication fails
- **THEN** the system throws `AmazonAuthError`
- **AND** error code is `AUTH_ERROR`
- **AND** includes remediation steps

#### Scenario: Resource not found errors

- **WHEN** requested resource does not exist
- **THEN** the system throws `AmazonNotFoundError`
- **AND** error code is `NOT_FOUND`
- **AND** includes resource identifier

#### Scenario: Throttling errors

- **WHEN** rate limit is exceeded
- **THEN** the system throws `AmazonThrottlingError`
- **AND** error code is `THROTTLED`
- **AND** includes retry-after time

#### Scenario: Server errors

- **WHEN** Amazon server returns 5xx error
- **THEN** the system throws `AmazonServerError`
- **AND** error code is `SERVER_ERROR`
- **AND** includes request ID for support

### Requirement: Configuration Management

The system SHALL support configurable Amazon API settings.

#### Scenario: Required configuration

- **WHEN** initializing Amazon integration
- **THEN** the following configuration is required:
  - `clientId`
  - `clientSecret`
  - `refreshToken`
  - `region`
  - `marketplaceId`

#### Scenario: Optional configuration

- **WHEN** optional configuration is provided
- **THEN** the system applies:
  - `timeout` (default: 30000ms)
  - `maxRetries` (default: 5)
  - `rateLimitBuffer` (default: 10%)

#### Scenario: Configuration validation

- **WHEN** configuration is invalid or missing required fields
- **THEN** the system throws `ConfigurationError`
- **AND** lists all missing/invalid fields
- **AND** does not initialize the client

### Requirement: Health Check

The system SHALL provide health check for Amazon API connectivity.

#### Scenario: Successful health check

- **WHEN** calling `amazonClient.healthCheck()`
- **THEN** the system verifies:
  - Authentication is working
  - Can make API calls
  - Rate limits are not exceeded
- **AND** returns `{ status: 'healthy', latency, rateLimitRemaining }`

#### Scenario: Unhealthy state

- **WHEN** health check fails
- **THEN** the system returns `{ status: 'unhealthy', error, lastSuccess }`
- **AND** includes error details
- **AND** includes timestamp of last successful call
