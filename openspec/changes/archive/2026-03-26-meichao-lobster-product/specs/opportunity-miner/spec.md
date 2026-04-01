## ADDED Requirements

### Requirement: Supply-demand ratio analysis
The system SHALL analyze supply-demand ratios for product categories.

#### Scenario: Calculate supply-demand ratio
- **WHEN** analyzing a product category
- **THEN** system calculates search volume / product count ratio
- **AND** identifies high-opportunity categories (high demand, low supply)

#### Scenario: Track ratio changes
- **WHEN** ratio changes significantly over time
- **THEN** system flags category for opportunity or saturation alert

### Requirement: Price band analysis
The system SHALL identify optimal price bands for product categories.

#### Scenario: Identify optimal price range
- **WHEN** analyzing category sales data
- **THEN** system identifies price ranges with highest sales velocity
- **AND** recommends optimal pricing strategy

#### Scenario: Detect price gaps
- **WHEN** analyzing competitor pricing
- **THEN** system identifies under-served price segments
- **AND** suggests pricing opportunities

### Requirement: Trend prediction
The system SHALL predict product trends using time series analysis.

#### Scenario: Predict rising trends
- **WHEN** analyzing historical search and sales data
- **THEN** system applies ARIMA model for trend prediction
- **AND** identifies products with predicted growth

#### Scenario: Predict declining trends
- **WHEN** detecting downward trend signals
- **THEN** system warns of declining product categories
- **AND** suggests alternative opportunities

### Requirement: Risk filtering
The system SHALL filter products with potential risks.

#### Scenario: Filter IP-infringing products
- **WHEN** product matches known IP patterns
- **THEN** system flags for IP risk
- **AND** excludes from recommendations

#### Scenario: Filter low-margin products
- **WHEN** product has margin below threshold (default 15%)
- **THEN** system flags for low profitability
- **AND** adjusts recommendation score