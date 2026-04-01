## ADDED Requirements

### Requirement: Unified product data model
The system SHALL store product data in a unified schema with platform-specific extensions.

#### Scenario: Store product from different platforms
- **WHEN** product data is collected from taobao, amazon, or douyin
- **THEN** system stores in unified products table
- **AND** core fields are normalized (title, price, sales, rating)
- **AND** platform-specific data stored in extra_data JSONB field

#### Scenario: Query products across platforms
- **WHEN** user queries products without platform filter
- **THEN** system returns unified results from all platforms
- **AND** fields are consistently named and typed

### Requirement: Data normalization
The system SHALL normalize data from different platforms into a unified data model.

#### Scenario: Normalize price formats
- **WHEN** scraping data from different platforms with varying price formats
- **THEN** system converts all prices to standard decimal format
- **AND** stores currency code for multi-currency support

#### Scenario: Normalize product attributes
- **WHEN** extracting product attributes from platform-specific formats
- **THEN** system maps to unified attribute schema
- **AND** preserves platform-specific metadata in extra_data JSONB field

### Requirement: Platform extension data
The system SHALL support platform-specific data through JSONB extra_data field.

#### Scenario: Store taobao-specific data
- **WHEN** product from taobao has commission and coupon info
- **THEN** system stores in extra_data.commission and extra_data.coupon
- **AND** data is queryable via JSONB operators

#### Scenario: Store amazon-specific data
- **WHEN** product from amazon has FBA and Buy Box info
- **THEN** system stores in extra_data.fulfillment and extra_data.buy_box
- **AND** ASIN stored in extra_data.asin

#### Scenario: Query platform-specific fields
- **WHEN** user queries products with platform-specific filters
- **THEN** system uses JSONB GIN index for efficient queries
- **AND** returns matching products

### Requirement: Data deduplication
The system SHALL detect and handle duplicate data entries across platforms.

#### Scenario: Detect duplicate products
- **WHEN** same product is scraped from multiple sources
- **THEN** system identifies duplicates by product ID and platform
- **AND** merges data with latest timestamp

#### Scenario: Handle conflicting data
- **WHEN** duplicate products have conflicting attribute values
- **THEN** system applies conflict resolution rules (latest wins, or manual review)
- **AND** logs conflict for audit trail

### Requirement: ETL pipeline
The system SHALL provide scheduled ETL (Extract-Transform-Load) processing for data pipeline.

#### Scenario: Run scheduled ETL
- **WHEN** scheduled ETL time is reached
- **THEN** system extracts raw data from staging area
- **AND** applies transformation rules
- **AND** loads into target data store

#### Scenario: Handle ETL failures
- **WHEN** ETL pipeline encounters data validation errors
- **THEN** system logs error details with affected records
- **AND** quarantines invalid data for review
- **AND** continues processing valid records

### Requirement: Schema extensibility
The system SHALL support extending data model without breaking existing data.

#### Scenario: Add new platform field
- **WHEN** new platform requires additional fields
- **THEN** system adds to extra_data JSONB without schema migration
- **AND** existing products remain unchanged

#### Scenario: Add new common field
- **WHEN** field becomes common across all platforms
- **THEN** system adds column to products table with default value
- **AND** existing products get default value

### Requirement: Historical data tracking
The system SHALL track historical changes for price and sales data.

#### Scenario: Record price change
- **WHEN** product price changes
- **THEN** system records previous price in price_history table
- **AND** timestamps the change

#### Scenario: Query price trend
- **WHEN** user requests price history for a product
- **THEN** system returns price points with timestamps
- **AND** calculates price change percentage