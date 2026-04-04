# Redis Performance Optimization Specification

## ADDED Requirements

### Requirement: Eliminate keys() Usage

The system SHALL NOT use the Redis `KEYS` command in any production code path.

#### Scenario: Clear all cache keys

- **WHEN** calling `cacheProvider.clear()`
- **THEN** the system uses a maintained key set OR `SCAN` command
- **AND** the operation does not block Redis
- **AND** the operation completes in O(N) iterations with O(1) per iteration

#### Scenario: List all cache keys

- **WHEN** calling `cacheProvider.listKeys()`
- **THEN** the system uses a maintained key set
- **AND** the operation is O(1) for the Redis SET operation
- **AND** returns an array of all cached keys

#### Scenario: Get cache statistics

- **WHEN** calling `cacheProvider.getStats()`
- **THEN** the system returns `{ totalKeys, memoryUsage, hitRate, missRate }`
- **AND** the operation does not use `KEYS` command
- **AND** uses `SCARD` for key set size

### Requirement: Key Set Maintenance

The system SHALL maintain a Redis SET of all active cache keys for O(1) key management.

#### Scenario: Add key to set on cache write

- **WHEN** calling `cacheProvider.set(key, value)`
- **THEN** the system adds the key to the key set
- **AND** sets the cache value with TTL
- **AND** the key set is updated atomically

#### Scenario: Remove key from set on cache delete

- **WHEN** calling `cacheProvider.delete(key)`
- **THEN** the system removes the key from the key set
- **AND** deletes the cache value
- **AND** the key set is updated atomically

#### Scenario: Key set cleanup on expiration

- **WHEN** a cache key expires naturally via TTL
- **THEN** the system lazily removes expired keys from the key set
- **AND** on next `listKeys()` call, expired keys are not included
- **AND** uses `SCAN` with `MATCH` to rebuild key set if inconsistencies detected

### Requirement: Batch Operations Support

The system SHALL support batch cache operations with single round-trip efficiency.

#### Scenario: Batch set multiple keys

- **WHEN** calling `cacheProvider.setMany({ key1: value1, key2: value2 })`
- **THEN** the system uses Redis `MSET` command
- **AND** adds all keys to the key set atomically
- **AND** completes in O(1) network round-trips

#### Scenario: Batch get multiple keys

- **WHEN** calling `cacheProvider.getMany([key1, key2])`
- **THEN** the system uses Redis `MGET` command
- **AND** returns an object `{ key1: value1, key2: value2 }`
- **AND** completes in O(1) network round-trips

#### Scenario: Batch delete multiple keys

- **WHEN** calling `cacheProvider.deleteMany([key1, key2])`
- **THEN** the system uses Redis `DEL` with multiple keys
- **AND** removes all keys from the key set atomically
- **AND** completes in O(1) network round-trips

### Requirement: Cache Key Naming Convention

The system SHALL use a consistent naming convention for cache keys.

#### Scenario: Standard key format

- **WHEN** creating a cache key
- **THEN** the key follows format: `{prefix}:{entity}:{identifier}:{version}`
- **AND** prefix is `meichao`
- **AND** entity is the resource type (e.g., `product`, `shop`)
- **AND** identifier is the unique ID
- **AND** version is optional for versioning

#### Scenario: Key examples

```
Valid keys:
- meichao:product:taobao:12345:v1
- meichao:shop:amazon:67890
- meichao:category:jd:electronics

Invalid keys:
- product:12345  (missing prefix)
- meichao_product_12345  (wrong separator)
```

### Requirement: Memory Usage Monitoring

The system SHALL monitor Redis memory usage and alert on high usage.

#### Scenario: Memory usage check

- **WHEN** calling `cacheProvider.getMemoryUsage()`
- **THEN** the system uses Redis `INFO memory` command
- **AND** returns `{ usedMemory, maxMemory, usagePercentage }`
- **AND** does not affect cache performance

#### Scenario: High memory alert

- **WHEN** Redis memory usage exceeds 80% of max memory
- **THEN** the system logs a warning
- **AND** includes current memory usage
- **AND** suggests clearing old keys

#### Scenario: Automatic cleanup trigger

- **WHEN** Redis memory usage exceeds 90% of max memory
- **THEN** the system triggers automatic cleanup
- **AND** removes expired keys from key set
- **AND** logs cleanup action

### Requirement: Performance Metrics

The system SHALL track and report cache performance metrics.

#### Scenario: Cache hit rate tracking

- **WHEN** calling `cacheProvider.getMetrics()`
- **THEN** the system returns `{ hits, misses, hitRate, averageLatency }`
- **AND** metrics are updated on every cache operation
- **AND** metrics are stored in Redis with TTL

#### Scenario: Latency tracking

- **WHEN** any cache operation is executed
- **THEN** the system records operation latency
- **AND** updates average latency metric
- **AND** alerts if latency exceeds threshold (default 100ms)

### Requirement: Fallback to SCAN

The system SHALL fall back to SCAN if key set is corrupted or missing.

#### Scenario: Key set missing

- **WHEN** the key set does not exist or is corrupted
- **THEN** the system uses `SCAN` command to rebuild the key set
- **AND** logs a warning about the fallback
- **AND** continues operation normally

#### Scenario: Key set inconsistency detection

- **WHEN** `SCARD` (key set size) does not match actual key count
- **THEN** the system triggers key set rebuild
- **AND** uses `SCAN` to enumerate all keys
- **AND** updates the key set
- **AND** logs the inconsistency
