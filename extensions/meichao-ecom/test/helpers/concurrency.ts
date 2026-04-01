export interface ConcurrencyResult<T> {
  results: T[];
  errors: Error[];
  duration: number;
  successCount: number;
  errorCount: number;
}

export interface RaceConditionTestOptions {
  iterations: number;
  concurrency: number;
  operation: () => Promise<unknown>;
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
}

export async function runConcurrent<T>(
  fn: () => Promise<T>,
  concurrency: number,
): Promise<ConcurrencyResult<T>> {
  const startTime = Date.now();
  const results: T[] = [];
  const errors: Error[] = [];

  const promises: Promise<void>[] = [];

  for (let i = 0; i < concurrency; i++) {
    promises.push(
      (async () => {
        try {
          const result = await fn();
          results.push(result);
        } catch (e) {
          errors.push(e instanceof Error ? e : new Error(String(e)));
        }
      })(),
    );
  }

  await Promise.all(promises);

  return {
    results,
    errors,
    duration: Date.now() - startTime,
    successCount: results.length,
    errorCount: errors.length,
  };
}

export async function runInBatches<T>(
  fn: () => Promise<T>,
  totalCount: number,
  batchSize: number,
): Promise<ConcurrencyResult<T>> {
  const startTime = Date.now();
  const results: T[] = [];
  const errors: Error[] = [];

  const batches = Math.ceil(totalCount / batchSize);

  for (let batch = 0; batch < batches; batch++) {
    const currentBatchSize = Math.min(batchSize, totalCount - batch * batchSize);
    const promises: Promise<void>[] = [];

    for (let i = 0; i < currentBatchSize; i++) {
      promises.push(
        (async () => {
          try {
            const result = await fn();
            results.push(result);
          } catch (e) {
            errors.push(e instanceof Error ? e : new Error(String(e)));
          }
        })(),
      );
    }

    await Promise.all(promises);
  }

  return {
    results,
    errors,
    duration: Date.now() - startTime,
    successCount: results.length,
    errorCount: errors.length,
  };
}

export async function detectRaceCondition(
  iterations: number,
  fn: () => Promise<number>,
): Promise<{ detected: boolean; inconsistencies: number }> {
  let inconsistencies = 0;

  for (let i = 0; i < iterations; i++) {
    const results = await Promise.all([fn(), fn(), fn(), fn(), fn()]);
    const unique = new Set(results);

    if (unique.size > 1) {
      inconsistencies++;
    }
  }

  return {
    detected: inconsistencies > 0,
    inconsistencies,
  };
}

export async function testAtomicIncrement(
  incrementFn: () => Promise<void>,
  getCountFn: () => Promise<number>,
  iterations: number,
): Promise<{ expected: number; actual: number; success: boolean }> {
  const initialCount = await getCountFn();

  await runConcurrent(incrementFn, iterations);

  const finalCount = await getCountFn();
  const expected = initialCount + iterations;
  const actual = finalCount;

  return {
    expected,
    actual,
    success: expected === actual,
  };
}

export async function measureThroughput(
  fn: () => Promise<unknown>,
  duration: number,
): Promise<{ operations: number; throughput: number }> {
  const startTime = Date.now();
  let operations = 0;

  const runUntil = async () => {
    while (Date.now() - startTime < duration) {
      await fn();
      operations++;
    }
  };

  await Promise.all([runUntil(), runUntil(), runUntil(), runUntil()]);

  return {
    operations,
    throughput: (operations / duration) * 1000,
  };
}

export function createSharedState<T>(initial: T): {
  get: () => T;
  set: (value: T) => void;
  update: (fn: (current: T) => T) => void;
} {
  let state = initial;
  return {
    get: () => state,
    set: (value: T) => {
      state = value;
    },
    update: (fn: (current: T) => T) => {
      state = fn(state);
    },
  };
}

export async function simulateContendedResource<T>(
  resource: { get: () => T; set: (v: T) => void },
  readers: number,
  writers: number,
  iterations: number,
): Promise<{ readErrors: number; writeErrors: number }> {
  let readErrors = 0;
  let writeErrors = 0;

  const readPromises = Array.from({ length: readers }, () =>
    (async () => {
      for (let i = 0; i < iterations; i++) {
        try {
          resource.get();
          await new Promise((r) => setTimeout(r, 1));
        } catch {
          readErrors++;
        }
      }
    })(),
  );

  const writePromises = Array.from({ length: writers }, () =>
    (async () => {
      for (let i = 0; i < iterations; i++) {
        try {
          resource.set({} as T);
          await new Promise((r) => setTimeout(r, 2));
        } catch {
          writeErrors++;
        }
      }
    })(),
  );

  await Promise.all([...readPromises, ...writePromises]);

  return { readErrors, writeErrors };
}
