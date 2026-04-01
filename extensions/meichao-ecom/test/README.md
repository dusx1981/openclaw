# Meichao-Ecom Test Framework

## Overview

This directory contains the test infrastructure for the meichao-ecom extension, including data factories, chaos testing, stress testing, and integration testing utilities.

## Directory Structure

```
test/
├── fixtures/           # Test data factories
│   ├── index.ts       # Export all factories
│   ├── product-factory.ts
│   ├── data-source-factory.ts
│   └── quota-factory.ts
├── helpers/            # Test utilities
│   ├── index.ts       # Export all helpers
│   ├── chaos.ts       # Chaos testing utilities
│   ├── stress.ts      # Stress testing utilities
│   ├── assertions.ts  # Custom assertions
│   └── database.ts    # Database test utilities
├── mocks/              # Mock implementations
└── setup.ts            # Global test setup
```

## Test Data Factories

### ProductFactory

```typescript
import { ProductFactory } from "./fixtures/index.js";

// Create a single product with random data
const product = ProductFactory.create();

// Create with overrides
const product = ProductFactory.create({ price: 100, platform: "amazon" });

// Create a list of products
const products = ProductFactory.createList(10);

// Create platform-specific product
const taobaoProduct = ProductFactory.forPlatform("taobao");
```

### DataSourceFactory

```typescript
import { DataSourceFactory } from "./fixtures/index.js";

const source = DataSourceFactory.create();
const sources = DataSourceFactory.createList(3);
```

### QuotaFactory

```typescript
import { QuotaFactory } from "./fixtures/index.js";

const quota = QuotaFactory.create({ total: 1000, used: 500 });
```

## Chaos Testing

The `Chaos` helper provides chaos engineering utilities:

```typescript
import { Chaos } from "./helpers/index.js";

// Inject latency
await Chaos.injectLatency(1000);

// Inject random latency
await Chaos.injectRandomLatency(100, 500);

// Inject failure with rate
if (Chaos.shouldFail(0.5)) {
  throw new Error("Injected failure");
}

// Inject partial response
const partial = Chaos.injectPartialResponse(data, 0.3);

// Inject network error
Chaos.injectNetworkError("ECONNREFUSED");

// Seed for reproducibility
Chaos.setSeed(12345);

// Compose effects
const effect = Chaos.sequence([() => Chaos.injectLatency(100), () => Chaos.injectFailure(0.3)]);
```

## Stress Testing

```typescript
import { StressTest, PerformanceCollector } from "./helpers/index.js";

// Run sustained load test
const metrics = await StressTest.run({
  duration: 60000,
  rate: 100,
  fn: async () => {
    /* operation */
  },
});

// Ramp up load
const metrics = await StressTest.run({
  startRate: 10,
  endRate: 1000,
  duration: 60000,
  fn: async () => {
    /* operation */
  },
});

// Check metrics
console.log(`P99: ${metrics.p99}ms`);
console.log(`Throughput: ${metrics.throughput} rps`);
```

## Assertions

```typescript
import {
  assertDegradationLevel,
  assertCircuitState,
  assertQuotaUsage,
  assertPerformanceMetrics,
} from "./helpers/index.js";

// Assert degradation level
assertDegradationLevel(result.degradationLevel, "primary_source");

// Assert circuit breaker state
assertCircuitState(breaker, "closed");

// Assert performance metrics
assertPerformanceMetrics(metrics, { maxP99Ms: 1000, maxErrorRate: 0.01 });
```

## Integration Testing

```typescript
import {
  shouldRunIntegrationTest,
  getTestPool,
  cleanupTestData,
  seedTestProducts,
  startPostgres,
  startRedis,
  stopContainers,
} from "./helpers/index.js";

if (!shouldRunIntegrationTest()) {
  test.skip("Integration tests skipped");
}

// Start test containers
await startPostgres();
await startRedis();

// Use container pool
const pool = getContainerPool();
await seedProducts(100);

// Cleanup
await stopContainers();
```

## Concurrency Testing

```typescript
import {
  runConcurrent,
  runInBatches,
  detectRaceCondition,
  testAtomicIncrement,
} from "./helpers/index.js";

// Run concurrent operations
const result = await runConcurrent(async () => {
  return await fetchData();
}, 100);

// Run in batches (for high concurrency)
const result = await runInBatches(
  async () => {
    return await processData();
  },
  1000,
  100,
);

// Test atomic increment
const result = await testAtomicIncrement(
  async () => counter.increment(),
  async () => counter.get(),
  100,
);
```

## Mock Server

```typescript
import { MockServer, createMockServer } from "./mocks/mock-server.js";

// Create and start server
const { server, url } = await createMockServer();

// Configure responses
server.respond("/api/products", { status: 200, body: { products: [] } });
server.respond("/api/products/:id", { status: 200, body: { id: "123" } });

// Simulate errors
server.error("/api/fail", 500);

// Simulate latency
server.delay(100);

// Check request log
const requests = server.getRequests();

// Cleanup
await server.stop();
```

## Running Tests

```bash
# Run all tests
pnpm test

# Run integration tests only
pnpm test:integration

# Run stress tests only
pnpm test:stress

# Run chaos tests only
pnpm test:chaos
```

## Docker Compose

For integration tests, start the test databases:

```bash
docker-compose -f docker-compose.test.yml up -d
```

This starts:

- PostgreSQL on port 5433
- Redis on port 6380
