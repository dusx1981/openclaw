## ADDED Requirements

### Requirement: Plugin receives configuration through OpenClaw config system

The plugin SHALL accept PostgreSQL and Redis connection parameters through `api.pluginConfig` during the `register()` phase.

#### Scenario: Configuration injected during plugin registration
- **WHEN** OpenClaw calls `register(api)` with `api.pluginConfig.postgres` and `api.pluginConfig.redis`
- **THEN** the plugin SHALL store these values for use by storage and cache modules

#### Scenario: Partial configuration accepted
- **WHEN** only some configuration fields are provided (e.g., only `port`)
- **THEN** the plugin SHALL merge provided values with defaults and environment variables

### Requirement: Configuration priority follows pluginConfig > env > defaults

The plugin SHALL resolve configuration values with the following priority: user-provided pluginConfig first, then environment variables, then hardcoded defaults.

#### Scenario: Plugin config overrides environment variable
- **WHEN** `api.pluginConfig.postgres.port` is 5434 and `process.env.POSTGRES_PORT` is 5432
- **THEN** the effective port SHALL be 5434

#### Scenario: Environment variable used when pluginConfig not provided
- **WHEN** `api.pluginConfig.postgres` is undefined and `process.env.POSTGRES_PORT` is 5434
- **THEN** the effective port SHALL be 5434

#### Scenario: Default used when neither provided
- **WHEN** neither `api.pluginConfig` nor environment variables are set
- **THEN** the default port SHALL be 5434 for PostgreSQL and 6380 for Redis

### Requirement: PostgreSQL connection uses injected configuration

The PostgreSQL storage module SHALL obtain connection parameters from the plugin configuration module.

#### Scenario: PostgreSQL connects with injected config
- **WHEN** `setPostgresConfig({ port: 5434, host: "localhost" })` is called
- **AND** `getPostgresConfig()` is called by the storage module
- **THEN** the returned config SHALL include `port: 5434` and `host: "localhost"`

### Requirement: Redis connection uses injected configuration

The Redis cache module SHALL obtain connection parameters from the plugin configuration module.

#### Scenario: Redis connects with injected config
- **WHEN** `setRedisConfig({ port: 6380, host: "localhost" })` is called
- **AND** `getRedisConfig()` is called by the cache module
- **THEN** the returned config SHALL include `port: 6380` and `host: "localhost"`

### Requirement: Backward compatibility maintained

The plugin SHALL continue to work when `api.pluginConfig` is not provided, falling back to environment variables and defaults.

#### Scenario: No pluginConfig provided
- **WHEN** `api.pluginConfig` is undefined or empty
- **THEN** the plugin SHALL still function using environment variables and default values
- **AND** no errors SHALL be thrown