import { describe, it, expect } from "vitest";
import { CircuitBreaker } from "../../src/infrastructure/circuit-breaker/CircuitBreaker.js";
import {
  assertDegradationLevel,
  assertCircuitState,
  assertQuotaUsage,
  assertPerformanceMetrics,
  assertNoMemoryLeak,
} from "./assertions.js";
import type { PerformanceMetrics } from "./stress.js";

describe("Assertion Helpers", () => {
  describe("assertDegradationLevel", () => {
    it("should not throw when levels match", () => {
      expect(() => assertDegradationLevel("fresh_cache", "fresh_cache")).not.toThrow();
      expect(() => assertDegradationLevel("database", "database")).not.toThrow();
      expect(() => assertDegradationLevel("primary_source", "primary_source")).not.toThrow();
      expect(() => assertDegradationLevel("fallback_source", "fallback_source")).not.toThrow();
      expect(() => assertDegradationLevel("stale_cache", "stale_cache")).not.toThrow();
    });

    it("should throw when levels do not match", () => {
      expect(() => assertDegradationLevel("fresh_cache", "primary_source")).toThrow(
        'Expected degradation level "primary_source", got "fresh_cache"',
      );
      expect(() => assertDegradationLevel("stale_cache", "fresh_cache")).toThrow(
        'Expected degradation level "fresh_cache", got "stale_cache"',
      );
    });

    it("should include custom message when provided", () => {
      expect(() => assertDegradationLevel("fresh_cache", "stale_cache", "Custom error")).toThrow(
        "Custom error",
      );
    });
  });

  describe("assertCircuitState", () => {
    it("should not throw when circuit breaker is in expected state", () => {
      const breaker = new CircuitBreaker();
      expect(() => assertCircuitState(breaker, "closed")).not.toThrow();
    });

    it("should throw when circuit breaker is not in expected state", () => {
      const breaker = new CircuitBreaker({ failureThreshold: 1 });
      breaker.recordFailure();

      expect(() => assertCircuitState(breaker, "closed")).toThrow(
        'Expected circuit breaker state "closed", got "open"',
      );
    });

    it("should detect half-open state", async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 1, openDuration: 10 });
      breaker.recordFailure();

      await new Promise((r) => setTimeout(r, 20));

      expect(() => assertCircuitState(breaker, "half-open")).not.toThrow();
    });
  });

  describe("assertQuotaUsage", () => {
    it("should not throw when usage matches expected", () => {
      expect(() => assertQuotaUsage(50, 100, 50)).not.toThrow();
      expect(() => assertQuotaUsage(0, 100, 0)).not.toThrow();
      expect(() => assertQuotaUsage(100, 100, 100)).not.toThrow();
    });

    it("should throw when usage does not match expected", () => {
      expect(() => assertQuotaUsage(30, 100, 50)).toThrow("Expected quota usage 50, got 30");
    });

    it("should include custom message when provided", () => {
      expect(() => assertQuotaUsage(10, 100, 50, "API quota exceeded")).toThrow(
        "API quota exceeded",
      );
    });
  });

  describe("assertPerformanceMetrics", () => {
    const createMetrics = (overrides: Partial<PerformanceMetrics> = {}): PerformanceMetrics => ({
      totalRequests: 100,
      successfulRequests: 100,
      failedRequests: 0,
      throughput: 100,
      latencies: [],
      p50: 10,
      p95: 20,
      p99: 50,
      errorRate: 0,
      duration: 1000,
      ...overrides,
    });

    it("should not throw when all thresholds are met", () => {
      const metrics = createMetrics();
      expect(() =>
        assertPerformanceMetrics(metrics, {
          maxP99Ms: 100,
          maxP95Ms: 50,
          maxErrorRate: 0.1,
          minThroughput: 50,
        }),
      ).not.toThrow();
    });

    it("should throw when p99 exceeds threshold", () => {
      const metrics = createMetrics({ p99: 200 });
      expect(() => assertPerformanceMetrics(metrics, { maxP99Ms: 100 })).toThrow(
        "p99 latency 200ms exceeds threshold 100ms",
      );
    });

    it("should throw when p95 exceeds threshold", () => {
      const metrics = createMetrics({ p95: 150 });
      expect(() => assertPerformanceMetrics(metrics, { maxP95Ms: 100 })).toThrow(
        "p95 latency 150ms exceeds threshold 100ms",
      );
    });

    it("should throw when error rate exceeds threshold", () => {
      const metrics = createMetrics({ errorRate: 0.2 });
      expect(() => assertPerformanceMetrics(metrics, { maxErrorRate: 0.1 })).toThrow(
        "error rate 20.00% exceeds threshold 10%",
      );
    });

    it("should throw when throughput below threshold", () => {
      const metrics = createMetrics({ throughput: 30 });
      expect(() => assertPerformanceMetrics(metrics, { minThroughput: 50 })).toThrow(
        "throughput 30.00 rps below threshold 50 rps",
      );
    });

    it("should report multiple violations", () => {
      const metrics = createMetrics({ p99: 200, errorRate: 0.5 });
      expect(() => assertPerformanceMetrics(metrics, { maxP99Ms: 100, maxErrorRate: 0.1 })).toThrow(
        "p99 latency 200ms exceeds threshold 100ms",
      );
    });
  });

  describe("assertNoMemoryLeak", () => {
    it("should not throw when memory growth is acceptable", () => {
      expect(() => assertNoMemoryLeak(100, 120, 50)).not.toThrow();
      expect(() => assertNoMemoryLeak(100, 150, 50)).not.toThrow();
    });

    it("should throw when memory growth exceeds threshold", () => {
      expect(() => assertNoMemoryLeak(100, 200, 50)).toThrow(
        "Potential memory leak: memory grew 100.00% (from 100MB to 200MB)",
      );
    });

    it("should use default threshold of 50%", () => {
      expect(() => assertNoMemoryLeak(100, 140)).not.toThrow();
      expect(() => assertNoMemoryLeak(100, 160)).toThrow();
    });

    it("should not throw when memory decreases", () => {
      expect(() => assertNoMemoryLeak(100, 50, 50)).not.toThrow();
    });
  });
});
