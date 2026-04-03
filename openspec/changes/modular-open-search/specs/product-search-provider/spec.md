## ADDED Requirements

### Requirement: ProductSearchProvider defines open search contract

The system SHALL provide a `ProductSearchProvider` interface that defines the contract for open search providers.

#### Scenario: Provider interface has required methods

- **WHEN** a class implements `ProductSearchProvider`
- **THEN** it MUST provide `id`, `name`, `search()`, `isConfigured()`, and `getConfigPath()` methods

#### Scenario: Provider supports platform filtering

- **WHEN** `search()` is called with a `platform` parameter
- **THEN** the provider SHALL limit results to that platform's domains (e.g., `site:taobao.com`)

### Requirement: ProductSearchClient manages multiple providers

The system SHALL provide a `ProductSearchClient` that manages multiple `ProductSearchProvider` instances and handles fallback.

#### Scenario: Client tries providers in order

- **WHEN** `search()` is called with `{ provider: "bing", fallback: ["tavily"] }`
- **THEN** the client SHALL try "bing" first
- **AND** if "bing" fails, try "tavily"
- **AND** if all fail, throw an error

#### Scenario: Client skips unconfigured providers

- **WHEN** a provider's `isConfigured()` returns `false`
- **THEN** the client SHALL skip that provider and try the next one

### Requirement: BingShoppingProvider implements Bing Shopping API

The system SHALL provide a `BingShoppingProvider` that searches products via Bing Shopping API.

#### Scenario: Search with platform filter

- **WHEN** `search({ keyword: "华为手机", platform: "taobao" })` is called
- **THEN** the provider SHALL search with `site:taobao.com OR site:tmall.com 华为手机`

#### Scenario: API key from environment

- **WHEN** `BingShoppingProvider` is instantiated
- **THEN** it SHALL read `BING_API_KEY` from environment variables

#### Scenario: Configuration path

- **WHEN** `getConfigPath()` is called
- **THEN** it SHALL return `"plugins.entries.meichao-ecom.config.openSearch.bingApiKey"`

### Requirement: TavilyProductProvider implements Tavily search

The system SHALL provide a `TavilyProductProvider` that searches products via Tavily API.

#### Scenario: Search with domain filtering

- **WHEN** `search({ keyword: "华为手机", platform: "taobao" })` is called
- **THEN** the provider SHALL set `includeDomains: ["taobao.com", "tmall.com"]`

#### Scenario: Reuse OpenClaw Tavily infrastructure

- **WHEN** `TavilyProductProvider` searches
- **THEN** it SHALL reuse the existing `runTavilySearch` function from OpenClaw's tavily extension

### Requirement: Search results have consistent format

All `ProductSearchProvider` implementations SHALL return results in a consistent format.

#### Scenario: Result includes required fields

- **WHEN** a provider returns search results
- **THEN** each result SHALL include `title`, `url`, and `provider` fields
- **AND** MAY include `price`, `currency`, `shopName`, `platform`, `platformId`

#### Scenario: Result indicates data quality

- **WHEN** results come from open search
- **THEN** the result SHALL include `dataQuality: "medium"` to indicate lower quality than official API
