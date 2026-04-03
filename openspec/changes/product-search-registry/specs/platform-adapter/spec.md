## MODIFIED Requirements

### Requirement: Adapters use registry for search client

Platform adapters SHALL use the ProductSearchRegistry to create their search client instead of hardcoding provider instantiation.

#### Scenario: TaobaoAdapter uses registry

- **WHEN** `TaobaoAdapter` is instantiated
- **THEN** it SHALL use `createProductSearchClient()` from the registry
- **AND** it SHALL NOT directly instantiate `BingShoppingProvider` or `TavilyProductProvider`

#### Scenario: AmazonAdapter uses registry

- **WHEN** `AmazonAdapter` is instantiated
- **THEN** it SHALL use `createProductSearchClient()` from the registry
- **AND** it SHALL NOT directly instantiate provider classes

#### Scenario: Registry creates providers lazily

- **WHEN** an adapter calls `createProductSearchClient()`
- **THEN** only configured providers SHALL be included
- **AND** providers without valid API keys SHALL be skipped
