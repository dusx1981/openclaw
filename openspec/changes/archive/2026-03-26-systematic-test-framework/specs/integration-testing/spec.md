## ADDED Requirements

### Requirement: Docker test environment

The system SHALL support Docker-based test environments.

#### Scenario: Start PostgreSQL container
- **WHEN** `TestDatabase.startPostgres()` is called
- **THEN** PostgreSQL container SHALL be running on random port

#### Scenario: Start Redis container
- **WHEN** `TestCache.startRedis()` is called
- **THEN** Redis container SHALL be running on random port

#### Scenario: Cleanup containers
- **WHEN** test completes
- **THEN** containers SHALL be stopped and removed

### Requirement: Real PostgreSQL integration

The system SHALL test with real PostgreSQL.

#### Scenario: Real database operations
- **WHEN** integration tests run
- **THEN** operations SHALL use real PostgreSQL connection

#### Scenario: Transaction rollback
- **WHEN** each test completes
- **THEN** database state SHALL be rolled back

#### Scenario: Migration testing
- **WHEN** migrations are tested
- **THEN** schema changes SHALL be applied correctly

### Requirement: Real Redis integration

The system SHALL test with real Redis.

#### Scenario: Real cache operations
- **WHEN** integration tests run
- **THEN** operations SHALL use real Redis connection

#### Scenario: Cache isolation
- **WHEN** tests run in parallel
- **THEN** each test SHALL have isolated cache keys

#### Scenario: Redis persistence testing
- **WHEN** persistence is tested
- **THEN** data SHALL survive restart

### Requirement: Test data seeding

The system SHALL support test data seeding.

#### Scenario: Seed products
- **WHEN** `TestDatabase.seedProducts(count)` is called
- **THEN** specified number of products SHALL be inserted

#### Scenario: Clean database
- **WHEN** `TestDatabase.clean()` is called
- **THEN** all test data SHALL be removed

### Requirement: Integration test markers

The system SHALL support marking integration tests.

#### Scenario: Skip integration tests
- **WHEN** `SKIP_INTEGRATION=1` environment variable is set
- **THEN** integration tests SHALL be skipped

#### Scenario: Run only integration tests
- **WHEN** `ONLY_INTEGRATION=1` environment variable is set
- **THEN** only integration tests SHALL run