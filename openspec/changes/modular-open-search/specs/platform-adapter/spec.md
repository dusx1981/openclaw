## ADDED Requirements

### Requirement: searchProducts uses fetchWithFailover for degradation

The `BasePlatformAdapter.searchProducts()` method SHALL use `fetchWithFailover()` to support multi-source degradation.

#### Scenario: Primary source fails, fallback succeeds

- **WHEN** primary data source fails with a recoverable error
- **THEN** the adapter SHALL try the next available data source
- **AND** return results from the successful source

#### Scenario: All sources fail

- **WHEN** all data sources fail
- **THEN** the adapter SHALL throw an error with the last error message

#### Scenario: Degradation level tracked

- **WHEN** results come from a fallback source
- **THEN** the result SHALL include `degradationLevel: "fallback_source"`
- **AND** `isDegraded: true`

### Requirement: open_search data source type supported

The `DataSourceType` type SHALL include `"open_search"` as a valid source type.

#### Scenario: open_search in type union

- **WHEN** `DataSourceType` is used
- **THEN** it SHALL accept `"official_api" | "third_party_api" | "skill_crawler" | "open_search"`

### Requirement: TaobaoAdapter includes open_search data source

`TaobaoAdapter` SHALL include an `open_search` type data source in its data source list.

#### Scenario: open_search source registered

- **WHEN** `TaobaoAdapter.create()` is called
- **THEN** a data source with `type: "open_search"` SHALL be registered
- **AND** its priority SHALL be lower than official API and crawler sources

#### Scenario: open_search uses ProductSearchClient

- **WHEN** the `open_search` source is selected in `fetchWithFailover`
- **THEN** the adapter SHALL call `ProductSearchClient.search()`
- **AND** transform results to `ProductData` format

### Requirement: TaobaoValidator uses shared adapter instance

`TaobaoValidator` SHALL use the shared `TaobaoAdapter` instance from `PlatformRegistry`.

#### Scenario: Validator gets shared instance

- **WHEN** `TaobaoValidator` is instantiated
- **THEN** it SHALL get the `TaobaoAdapter` from `PlatformRegistry.get("taobao")`
- **AND** NOT create a new instance with `TaobaoAdapter.create()`

#### Scenario: Validator sees current circuit breaker state

- **WHEN** `ecom-product-fetch` has triggered circuit breaker on a source
- **AND** `ecom-validate-platform` runs validation
- **THEN** the validator SHALL see the same circuit breaker state
