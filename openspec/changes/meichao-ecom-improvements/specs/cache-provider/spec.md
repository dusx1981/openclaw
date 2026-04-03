## MODIFIED Requirements

### Requirement: Non-blocking cache operations

The cache provider SHALL NOT use Redis blocking commands.

#### Scenario: List all keys without blocking

- **WHEN** `clear()` or `clearExpired()` needs to list all keys
- **THEN** it SHALL use SCAN command instead of KEYS
- **AND** it SHALL process keys in batches of 100

#### Scenario: Scan iteration

- **WHEN** scanning for keys
- **THEN** each SCAN call SHALL return a cursor and batch of keys
- **AND** iteration SHALL continue until cursor returns 0

### Requirement: Cache performance metrics

The cache provider SHALL track and report performance metrics.

#### Scenario: Operation timing

- **WHEN** a cache operation completes
- **THEN** the latency SHALL be recorded
- **AND** average latency SHALL be available via `getStats()`

#### Scenario: Hit rate tracking

- **WHEN** `getStats()` is called
- **THEN** it SHALL return the current hit rate
- **AND** it SHALL NOT modify any cached data (remove clearExpired side effect)

### Requirement: Redis connection resilience

The cache provider SHALL handle Redis connection failures gracefully.

#### Scenario: Connection retry

- **WHEN** a Redis operation fails due to connection loss
- **THEN** it SHALL attempt to reconnect up to 3 times
- **AND** it SHALL use exponential backoff between retries

#### Scenario: Circuit breaker for Redis

- **WHEN** Redis has failed 5 consecutive times
- **THEN** the cache provider SHALL enter a failed state
- **AND** subsequent operations SHALL fail fast for 30 seconds
- **AND** after 30 seconds, it SHALL attempt recovery
