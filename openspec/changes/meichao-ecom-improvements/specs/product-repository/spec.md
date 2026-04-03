## MODIFIED Requirements

### Requirement: Transaction support in repository

The `TransactionalProductRepository` SHALL use the provided transaction client for all database operations.

#### Scenario: Create product in transaction

- **WHEN** `create()` is called within a transaction
- **THEN** it SHALL use the transaction's client for the INSERT query
- **AND** changes SHALL NOT be visible outside the transaction until committed

#### Scenario: Update product in transaction

- **WHEN** `update()` is called within a transaction
- **THEN** it SHALL use the transaction's client for the UPDATE query
- **AND** changes SHALL be rollbackable if the transaction fails

#### Scenario: Find product in transaction

- **WHEN** `findByPlatformId()` is called within a transaction
- **THEN** it SHALL use the transaction's client for the SELECT query
- **AND** it SHALL see uncommitted changes from the same transaction

### Requirement: Connection pool health monitoring

The PostgreSQL connection pool SHALL monitor and report its health status.

#### Scenario: Pool health check

- **WHEN** `healthCheck()` is called on the pool
- **THEN** it SHALL return the current connection count
- **AND** it SHALL return the number of idle connections
- **AND** it SHALL return the number of waiting requests

#### Scenario: Connection recovery

- **WHEN** a database connection is lost
- **THEN** the pool SHALL automatically reconnect
- **AND** pending queries SHALL be retried once
