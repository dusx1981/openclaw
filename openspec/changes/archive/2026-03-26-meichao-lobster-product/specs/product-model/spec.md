## ADDED Requirements

### Requirement: Products table schema
The system SHALL maintain a unified products table for all platforms.

#### Scenario: Create product record
- **WHEN** product data is collected from any platform
- **THEN** system creates record with platform, platform_id as unique identifier
- **AND** core fields are populated: title, price, sales, rating, reviews_count
- **AND** platform-specific data stored in extra_data JSONB

#### Scenario: Update product record
- **WHEN** product data is recollected
- **THEN** system updates existing record by (platform, platform_id)
- **AND** updated_at timestamp is updated
- **AND** previous values can be preserved in history tables

### Requirement: Core field normalization
The system SHALL normalize core fields across all platforms.

#### Scenario: Normalize platform identifier
- **WHEN** product from taobao has num_iid field
- **THEN** system stores as platform="taobao", platform_id=num_iid
- **WHEN** product from amazon has ASIN field
- **THEN** system stores as platform="amazon", platform_id=ASIN

#### Scenario: Normalize currency
- **WHEN** product price is collected
- **THEN** system stores price as decimal with currency code
- **AND** default currency is CNY for Chinese platforms
- **AND** USD for Amazon US, EUR for Amazon EU

#### Scenario: Normalize sales period
- **WHEN** sales count is collected
- **THEN** system stores with sales_period (day/week/month)
- **AND** default period is "month" for most platforms

### Requirement: Extra data JSONB schema
The system SHALL support platform-specific data in extra_data JSONB field.

#### Scenario: Taobao extra_data
- **WHEN** product is from taobao
- **THEN** extra_data may contain:
  - commission: {rate, amount}
  - coupon: {id, amount, condition, start_time, end_time}
  - live: {room_id, anchor_name, viewer_count}
  - tmall: boolean
  - brand: string
  - sku_count: integer

#### Scenario: Amazon extra_data
- **WHEN** product is from amazon
- **THEN** extra_data may contain:
  - asin: string
  - fulfillment: {fba, prime, shipping_time}
  - buy_box: {price, seller_id, seller_name}
  - ranking: {category, overall}
  - dimensions: {weight, size}
  - marketplace: string

#### Scenario: Douyin extra_data
- **WHEN** product is from douyin
- **THEN** extra_data may contain:
  - video: {id, views, likes, comments, shares}
  - live: {id, anchor_id, anchor_name}
  - commission: {rate, type}
  - promote_type: string
  - product_type: string

### Requirement: Status and priority management
The system SHALL support product status and priority classification.

#### Scenario: Set product status
- **WHEN** product is created
- **THEN** status defaults to "active"
- **WHEN** product is no longer available
- **THEN** status changes to "inactive", "deleted", or "sold_out"

#### Scenario: Set product priority
- **WHEN** product is trending or high-sales
- **THEN** priority set to "P0" (hot)
- **WHEN** product is competitor item
- **THEN** priority set to "P1" (normal)
- **WHEN** product is candidate for monitoring
- **THEN** priority set to "P2" (cold)

### Requirement: Merchant association
The system SHALL support merchant-level data isolation.

#### Scenario: Assign product to merchant
- **WHEN** product is added by merchant
- **THEN** merchant_id is set
- **AND** merchant can only see their own products

#### Scenario: Add merchant tags
- **WHEN** merchant wants to categorize products
- **THEN** tags array can be added in tags JSONB field
- **AND** tags are queryable via GIN index

### Requirement: Timestamp tracking
The system SHALL track timestamps for data freshness.

#### Scenario: Track first and last seen
- **WHEN** product is first collected
- **THEN** first_seen_at is set
- **WHEN** product is recollected successfully
- **THEN** last_seen_at is updated

#### Scenario: Track field update times
- **WHEN** price is updated
- **THEN** price_updated_at is set
- **WHEN** sales is updated
- **THEN** sales_updated_at is set