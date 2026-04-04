# Storage Transaction Fix Specification

## ADDED Requirements

### Requirement: Transaction Manager Must Use Client

The system SHALL execute all multi-statement database operations within a transaction using a dedicated PostgreSQL client.

#### Scenario: Successful transaction execution

- **WHEN** calling `transactionManager.runInTransaction(fn)` with a function that performs multiple database operations
- **THEN** the system acquires a dedicated client from the pool
- **AND** executes `BEGIN` before the function
- **AND** executes `COMMIT` after successful completion
- **AND** releases the client back to the pool

#### Scenario: Transaction rollback on error

- **WHEN** an error occurs within a transaction function
- **THEN** the system executes `ROLLBACK`
- **AND** the error is re-thrown to the caller
- **AND** no partial changes are committed to the database
- **AND** the client is released back to the pool

#### Scenario: Transaction timeout

- **WHEN** a transaction exceeds the configured timeout (default 30 seconds)
- **THEN** the system cancels the transaction
- **AND** executes `ROLLBACK`
- **AND** throws a `TransactionTimeoutError`

### Requirement: ProductRepository Must Use Transactions for Batch Operations

The system SHALL wrap batch operations in transactions to ensure atomicity.

#### Scenario: Create multiple products atomically

- **WHEN** calling `productRepository.createMany(items)` with an array of items
- **THEN** all items are created within a single transaction
- **AND** if any item fails to create, no items are persisted
- **AND** all items are persisted successfully on success

#### Scenario: Update multiple products atomically

- **WHEN** calling `productRepository.updateMany(updates)` with an array of updates
- **THEN** all updates are applied within a single transaction
- **AND** if any update fails, no changes are applied
- **AND** all updates are applied successfully on success

#### Scenario: Delete multiple products atomically

- **WHEN** calling `productRepository.deleteMany(ids)` with an array of IDs
- **THEN** all products are deleted within a single transaction
- **AND** if any deletion fails, no products are deleted
- **AND** all products are deleted successfully on success

### Requirement: Transaction Isolation Level

The system SHALL use READ COMMITTED isolation level for all transactions.

#### Scenario: Default isolation level

- **WHEN** starting a transaction without specifying isolation level
- **THEN** the transaction uses READ COMMITTED isolation level
- **AND** uncommitted changes from other transactions are not visible
- **AND** committed changes from other transactions are visible

#### Scenario: Custom isolation level

- **WHEN** calling `transactionManager.runInTransaction(fn, { isolationLevel: 'SERIALIZABLE' })`
- **THEN** the transaction uses the specified isolation level
- **AND** the behavior matches PostgreSQL's isolation level semantics

### Requirement: Connection Pool Health Check

The system SHALL monitor the connection pool health and report metrics.

#### Scenario: Pool status check

- **WHEN** calling `poolHealthCheck()`
- **THEN** the system returns an object with `total`, `idle`, `waiting` connection counts
- **AND** the status reflects the current pool state

#### Scenario: Pool exhaustion detection

- **WHEN** all connections are in use and a new connection is requested
- **THEN** the request waits up to `connectionTimeout` milliseconds
- **AND** throws `ConnectionPoolExhaustedError` if timeout is exceeded
- **AND** logs a warning with pool metrics

#### Scenario: Automatic reconnection

- **WHEN** a connection is lost due to network error
- **THEN** the pool automatically creates a new connection
- **AND** subsequent operations succeed without manual intervention

### Requirement: Transaction Error Handling

The system SHALL properly classify and handle transaction errors.

#### Scenario: Unique constraint violation

- **WHEN** a transaction violates a unique constraint
- **THEN** the system throws `UniqueConstraintViolationError`
- **AND** includes the constraint name and conflicting value
- **AND** the transaction is rolled back

#### Scenario: Deadlock detection

- **WHEN** a deadlock is detected by PostgreSQL
- **THEN** the system throws `DeadlockError`
- **AND** includes the deadlock details
- **AND** the transaction is rolled back automatically

#### Scenario: Retry on serialization failure

- **WHEN** a serialization failure occurs (error code 40001)
- **THEN** the system retries the transaction up to 3 times
- **AND** uses exponential backoff between retries
- **AND** throws `SerializationFailureError` after max retries
