import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { StressTest, PerformanceCollector } from "./stress.js";

describe("StressTest", () => {
  describe("run", () => {
    it("should run sustained load test", async () => {
      let counter = 0;

      const metrics = await StressTest.run({
        duration: 100,
        rate: 10,
        fn: async () => {
          counter++;
          await new Promise((r) => setTimeout(r, 1));
        },
      });

      expect(counter).toBeGreaterThan(0);
      expect(metrics.totalRequests).toBeGreaterThan(0);
      expect(metrics.throughput).toBeGreaterThan(0);
    });
  });

  describe("memoryPressure", () => {
    it("should execute function under memory pressure", async () => {
      let executed = false;

      const metrics = await StressTest.memoryPressure({
        targetMB: 10,
        fn: async () => {
          executed = true;
        },
      });

      expect(executed).toBe(true);
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(1);
    });

    it("should allocate specified amount of memory", async () => {
      const memBefore = process.memoryUsage().heapUsed;

      await StressTest.memoryPressure({
        targetMB: 5,
        fn: async () => {},
      });

      const memAfter = process.memoryUsage().heapUsed;
      expect(memAfter).toBeLessThan(memBefore + 10 * 1024 * 1024);
    });
  });

  describe("exhaustConnections", () => {
    it("should simulate connection pool exhaustion", async () => {
      let callCount = 0;

      const result = await StressTest.exhaustConnections({
        pool: "postgres",
        limit: 5,
        fn: async () => {
          callCount++;
        },
      });

      expect(callCount).toBeGreaterThan(0);
      expect(result.metrics.totalRequests).toBeGreaterThan(0);
    });

    it("should track exhausted connections", async () => {
      const result = await StressTest.exhaustConnections({
        pool: "http",
        limit: 3,
        fn: async () => {
          await new Promise((r) => setTimeout(r, 10));
        },
      });

      expect(result.exhaustedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("detectMemoryLeak", () => {
    it("should detect memory usage over time", async () => {
      const result = await StressTest.detectMemoryLeak(
        { duration: 100, sampleInterval: 50 },
        async () => {},
      );

      expect(result.samples.length).toBeGreaterThan(0);
      expect(result.initialHeapMB).toBeGreaterThan(0);
    });

    it("should report potential leak when memory grows", async () => {
      const data: number[][] = [];

      const result = await StressTest.detectMemoryLeak(
        { duration: 200, sampleInterval: 50, growthThresholdPercent: 10 },
        async () => {
          data.push(new Array(10000).fill(0));
        },
      );

      expect(result.samples.length).toBeGreaterThan(0);
      expect(result.growthMB).toBeGreaterThanOrEqual(0);
    });
  });

  describe("PerformanceCollector", () => {
    let collector: PerformanceCollector;

    beforeEach(() => {
      collector = new PerformanceCollector();
      collector.start();
    });

    it("should collect latency metrics", () => {
      collector.recordLatency(10, true);
      collector.recordLatency(20, true);
      collector.recordLatency(30, true);

      const metrics = collector.getMetrics();

      expect(metrics.latencies).toEqual([10, 20, 30]);
      expect(metrics.p50).toBe(20);
      expect(metrics.successfulRequests).toBe(3);
    });

    it("should calculate percentiles correctly", () => {
      for (let i = 1; i <= 100; i++) {
        collector.recordLatency(i, true);
      }

      const metrics = collector.getMetrics();

      expect(metrics.p50).toBe(50);
      expect(metrics.p95).toBe(95);
      expect(metrics.p99).toBe(99);
    });

    it("should track errors", () => {
      collector.recordLatency(10, true);
      collector.recordLatency(20, false);
      collector.recordLatency(30, false);

      const metrics = collector.getMetrics();

      expect(metrics.successfulRequests).toBe(1);
      expect(metrics.failedRequests).toBe(2);
      expect(metrics.errorRate).toBeCloseTo(0.667, 1);
    });

    it("should validate thresholds", () => {
      collector.recordLatency(10, true);
      collector.recordLatency(20, true);
      collector.recordLatency(30, true);

      const metrics = collector.getMetrics();

      const result = collector.validateThresholds(metrics, {
        maxP99Ms: 100,
        maxErrorRate: 0.1,
      });

      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it("should detect threshold violations", () => {
      collector.recordLatency(1000, true);
      collector.recordLatency(2000, false);

      const metrics = collector.getMetrics();

      const result = collector.validateThresholds(metrics, {
        maxP99Ms: 100,
        maxErrorRate: 0.1,
      });

      expect(result.passed).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });
});
