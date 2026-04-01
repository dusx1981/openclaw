## ADDED Requirements

### Requirement: meichao fetch command

The system SHALL provide a `openclaw meichao fetch` CLI command for fetching products.

#### Scenario: Fetch product by ID
- **WHEN** user runs `openclaw meichao fetch taobao 123456789`
- **THEN** command outputs product details in formatted table

#### Scenario: Fetch with JSON output
- **WHEN** user runs `openclaw meichao fetch taobao 123456789 --json`
- **THEN** command outputs product as JSON to stdout

#### Scenario: Fetch with error
- **WHEN** fetch fails due to invalid ID or API error
- **THEN** command exits with code 1 and prints error message

### Requirement: meichao search command

The system SHALL provide a `openclaw meichao search` CLI command for searching products.

#### Scenario: Search products by keyword
- **WHEN** user runs `openclaw meichao search taobao "龙虾"`
- **THEN** command outputs matching products with IDs, titles, and prices

#### Scenario: Search with limit
- **WHEN** user runs `openclaw meichao search taobao "龙虾" --limit 20`
- **THEN** command outputs at most 20 products

#### Scenario: Search with JSON output
- **WHEN** user runs `openclaw meichao search taobao "龙虾" --json`
- **THEN** command outputs results as JSON array

### Requirement: meichao validate command

The system SHALL provide a `openclaw meichao validate` CLI command for platform validation.

#### Scenario: Validate platform
- **WHEN** user runs `openclaw meichao validate taobao`
- **THEN** command runs validation and outputs success rate, failure reasons, sample products

#### Scenario: Validate with custom count
- **WHEN** user runs `openclaw meichao validate taobao --count 50`
- **THEN** command runs 50 validation requests

#### Scenario: Validate all platforms
- **WHEN** user runs `openclaw meichao validate --all`
- **THEN** command validates all registered platforms and outputs summary

#### Scenario: Validate with JSON output
- **WHEN** user runs `openclaw meichao validate taobao --json`
- **THEN** command outputs validation report as JSON

### Requirement: meichao platforms command

The system SHALL provide a `openclaw meichao platforms` CLI command to list supported platforms.

#### Scenario: List platforms
- **WHEN** user runs `openclaw meichao platforms`
- **THEN** command outputs list of supported platforms with their data source counts

### Requirement: Command help text

All meichao commands SHALL provide helpful usage text via `--help`.

#### Scenario: Show help for fetch
- **WHEN** user runs `openclaw meichao fetch --help`
- **THEN** command shows usage, required arguments, and options

#### Scenario: Show help for parent command
- **WHEN** user runs `openclaw meichao --help`
- **THEN** command shows available subcommands