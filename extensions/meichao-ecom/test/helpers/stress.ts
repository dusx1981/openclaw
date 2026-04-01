export interface StressTestOptions {
  duration: number;
  rate: number;
  fn: () => Promise<unknown>;
}

export interface RampUpOptions {
  startRate: number;
  endRate: number;
  duration: number;
  fn: () => Promise<unknown>;
}

export interface PerformanceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  throughput: number;
  latencies: number[];
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  duration: number;
}

export interface Thresholds {
  maxP99Ms?: number;
  maxP95Ms?: number;
  maxErrorRate?: number;
  minThroughput?: number;
}

export interface MemoryPressureOptions {
  targetMB: number;
  fn: () => Promise<unknown>;
  duration?: number;
}

export interface ConnectionExhaustionOptions {
  pool: "postgres" | "redis" | "http";
  limit: number;
  fn: () => Promise<unknown>;
}

export interface MemoryLeakResult {
  initialHeapMB: number;
  finalHeapMB: number;
  growthMB: number;
  growthPercent: number;
  potentialLeak: boolean;
  samples: { time: number; heapMB: number }[];
}

export interface MemoryLeakOptions {
  duration: number;
  sampleInterval?: number;
  growthThresholdPercent?: number;
}

class PerformanceCollector {
  private latencies: number[] = [];
  private errors: number = 0;
  private successes: number = 0;
  private startTime: number = 0;

  start(): void {
    this.latencies = [];
    this.errors = 0;
    this.successes = 0;
    this.startTime = Date.now();
  }

  recordLatency(ms: number, success: boolean): void {
    this.latencies.push(ms);
    if (success) {
      this.successes++;
    } else {
      this.errors++;
    }
  }

  getMetrics(): PerformanceMetrics {
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const total = this.successes + this.errors;
    const duration = Date.now() - this.startTime;

    return {
      totalRequests: total,
      successfulRequests: this.successes,
      failedRequests: this.errors,
      throughput: total / (duration / 1000),
      latencies: sorted,
      p50: this.percentile(sorted, 50),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99),
      errorRate: total > 0 ? this.errors / total : 0,
      duration,
    };
  }

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] ?? 0;
  }

  validateThresholds(
    metrics: PerformanceMetrics,
    thresholds: Thresholds,
  ): { passed: boolean; violations: string[] } {
    const violations: string[] = [];

    if (thresholds.maxP99Ms !== undefined && metrics.p99 > thresholds.maxP99Ms) {
      violations.push(`p99 latency ${metrics.p99}ms exceeds threshold ${thresholds.maxP99Ms}ms`);
    }

    if (thresholds.maxP95Ms !== undefined && metrics.p95 > thresholds.maxP95Ms) {
      violations.push(`p95 latency ${metrics.p95}ms exceeds threshold ${thresholds.maxP95Ms}ms`);
    }

    if (thresholds.maxErrorRate !== undefined && metrics.errorRate > thresholds.maxErrorRate) {
      violations.push(
        `error rate ${(metrics.errorRate * 100).toFixed(2)}% exceeds threshold ${thresholds.maxErrorRate * 100}%`,
      );
    }

    if (thresholds.minThroughput !== undefined && metrics.throughput < thresholds.minThroughput) {
      violations.push(
        `throughput ${metrics.throughput.toFixed(2)} rps below threshold ${thresholds.minThroughput} rps`,
      );
    }

    return { passed: violations.length === 0, violations };
  }
}

class StressTestImpl {
  private collector = new PerformanceCollector();
  private memoryPressureBlocks: Buffer[] = [];

  async run(options: StressTestOptions): Promise<PerformanceMetrics> {
    this.collector.start();
    const intervalMs = 1000 / options.rate;
    const iterations = Math.floor(options.duration / intervalMs);

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      try {
        await options.fn();
        this.collector.recordLatency(Date.now() - start, true);
      } catch {
        this.collector.recordLatency(Date.now() - start, false);
      }
      await this.delay(Math.max(0, intervalMs - (Date.now() - start)));
    }

    return this.collector.getMetrics();
  }

  async rampUp(options: RampUpOptions): Promise<PerformanceMetrics> {
    this.collector.start();
    const steps = 10;
    const stepDuration = options.duration / steps;
    const rateStep = (options.endRate - options.startRate) / (steps - 1);

    for (let step = 0; step < steps; step++) {
      const currentRate = options.startRate + rateStep * step;
      const intervalMs = 1000 / currentRate;
      const iterations = Math.floor(stepDuration / intervalMs);

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        try {
          await options.fn();
          this.collector.recordLatency(Date.now() - start, true);
        } catch {
          this.collector.recordLatency(Date.now() - start, false);
        }
        await this.delay(Math.max(0, intervalMs - (Date.now() - start)));
      }
    }

    return this.collector.getMetrics();
  }

  async memoryPressure(options: MemoryPressureOptions): Promise<PerformanceMetrics> {
    this.collector.start();
    const bytesPerMB = 1024 * 1024;
    const blockSize = 10 * bytesPerMB;
    const targetBytes = options.targetMB * bytesPerMB;

    this.memoryPressureBlocks = [];
    let allocated = 0;

    while (allocated < targetBytes) {
      const block = Buffer.alloc(Math.min(blockSize, targetBytes - allocated));
      this.memoryPressureBlocks.push(block);
      allocated += block.length;
    }

    try {
      if (options.duration) {
        const intervalMs = 100;
        const iterations = Math.floor(options.duration / intervalMs);
        for (let i = 0; i < iterations; i++) {
          const start = Date.now();
          try {
            await options.fn();
            this.collector.recordLatency(Date.now() - start, true);
          } catch {
            this.collector.recordLatency(Date.now() - start, false);
          }
          await this.delay(Math.max(0, intervalMs - (Date.now() - start)));
        }
      } else {
        const start = Date.now();
        try {
          await options.fn();
          this.collector.recordLatency(Date.now() - start, true);
        } catch {
          this.collector.recordLatency(Date.now() - start, false);
        }
      }

      return this.collector.getMetrics();
    } finally {
      this.releaseMemoryPressure();
    }
  }

  releaseMemoryPressure(): void {
    this.memoryPressureBlocks = [];
    if (global.gc) {
      global.gc();
    }
  }

  async exhaustConnections(
    options: ConnectionExhaustionOptions,
  ): Promise<{ metrics: PerformanceMetrics; exhaustedCount: number }> {
    this.collector.start();
    const connections: unknown[] = [];
    let exhaustedCount = 0;

    const createConnection = async (): Promise<unknown> => {
      switch (options.pool) {
        case "postgres":
          return { query: async () => {}, end: async () => {} };
        case "redis":
          return { get: async () => null, set: async () => {} };
        case "http":
          return { request: async () => ({ status: 200 }) };
        default:
          return {};
      }
    };

    for (let i = 0; i < options.limit; i++) {
      connections.push(await createConnection());
    }

    const promises: Promise<void>[] = [];
    const start = Date.now();

    for (let i = 0; i < options.limit + 5; i++) {
      promises.push(
        (async () => {
          const opStart = Date.now();
          try {
            await options.fn();
            this.collector.recordLatency(Date.now() - opStart, true);
          } catch {
            exhaustedCount++;
            this.collector.recordLatency(Date.now() - opStart, false);
          }
        })(),
      );
    }

    await Promise.all(promises);
    this.collector.recordLatency(Date.now() - start, true);

    return {
      metrics: this.collector.getMetrics(),
      exhaustedCount,
    };
  }

  async detectMemoryLeak(
    options: MemoryLeakOptions,
    fn: () => Promise<unknown>,
  ): Promise<MemoryLeakResult> {
    const samples: { time: number; heapMB: number }[] = [];
    const sampleInterval = options.sampleInterval ?? 1000;
    const growthThreshold = options.growthThresholdPercent ?? 50;

    const getHeapMB = (): number => {
      const usage = process.memoryUsage();
      return Math.round(usage.heapUsed / (1024 * 1024));
    };

    if (global.gc) {
      global.gc();
    }

    const initialHeapMB = getHeapMB();
    samples.push({ time: 0, heapMB: initialHeapMB });

    const iterations = Math.floor(options.duration / sampleInterval);
    for (let i = 1; i <= iterations; i++) {
      await fn();

      if (global.gc) {
        global.gc();
      }

      const heapMB = getHeapMB();
      samples.push({ time: i * sampleInterval, heapMB });

      if (i < iterations) {
        await this.delay(sampleInterval);
      }
    }

    const finalHeapMB = samples[samples.length - 1]?.heapMB ?? initialHeapMB;
    const growthMB = finalHeapMB - initialHeapMB;
    const growthPercent = initialHeapMB > 0 ? (growthMB / initialHeapMB) * 100 : 0;

    return {
      initialHeapMB,
      finalHeapMB,
      growthMB,
      growthPercent,
      potentialLeak: growthPercent > growthThreshold,
      samples,
    };
  }

  getCollector(): PerformanceCollector {
    return this.collector;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const StressTest = new StressTestImpl();
export { PerformanceCollector };
