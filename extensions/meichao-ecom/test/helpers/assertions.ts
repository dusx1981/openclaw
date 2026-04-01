import type { DegradationLevel } from "../../src/domain/types.js";
import type { CircuitBreaker } from "../../src/infrastructure/circuit-breaker/CircuitBreaker.js";
import type { PerformanceMetrics, Thresholds } from "./stress.js";

export function assertDegradationLevel(
  actual: DegradationLevel | undefined,
  expected: DegradationLevel,
  message?: string,
): void {
  if (actual !== expected) {
    throw new Error(message ?? `Expected degradation level "${expected}", got "${actual}"`);
  }
}

export function assertCircuitState(
  breaker: CircuitBreaker,
  expected: "closed" | "open" | "half-open",
  message?: string,
): void {
  const actual = breaker.getState();
  if (actual !== expected) {
    throw new Error(message ?? `Expected circuit breaker state "${expected}", got "${actual}"`);
  }
}

export function assertQuotaUsage(
  used: number,
  total: number,
  expectedUsed: number,
  message?: string,
): void {
  if (used !== expectedUsed) {
    throw new Error(message ?? `Expected quota usage ${expectedUsed}, got ${used}`);
  }
}

export function assertPerformanceMetrics(
  metrics: PerformanceMetrics,
  thresholds: Thresholds,
): void {
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

  if (violations.length > 0) {
    throw new Error(`Performance threshold violations:\n${violations.join("\n")}`);
  }
}

export function assertNoMemoryLeak(
  initialMemoryMB: number,
  finalMemoryMB: number,
  maxGrowthPercent: number = 50,
): void {
  const growth = ((finalMemoryMB - initialMemoryMB) / initialMemoryMB) * 100;
  if (growth > maxGrowthPercent) {
    throw new Error(
      `Potential memory leak: memory grew ${growth.toFixed(2)}% (from ${initialMemoryMB}MB to ${finalMemoryMB}MB)`,
    );
  }
}
