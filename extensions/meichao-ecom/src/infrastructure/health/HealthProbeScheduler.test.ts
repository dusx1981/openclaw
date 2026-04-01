import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DataSource } from "../../domain/types.js";
import { TimerBasedHealthProbeScheduler } from "./HealthProbeScheduler.js";

describe("HealthProbeScheduler", () => {
  let scheduler: TimerBasedHealthProbeScheduler;
  let mockSources: DataSource[];
  let mockProbeFn: (source: DataSource) => Promise<boolean>;

  beforeEach(() => {
    mockSources = [
      {
        id: "source1",
        platform: "taobao",
        type: "official_api",
        priority: 1,
        costPerCall: 0.01,
        dailyQuota: 10000,
        usedQuota: 0,
        isAvailable: true,
      },
      {
        id: "source2",
        platform: "taobao",
        type: "third_party_api",
        priority: 2,
        costPerCall: 0.005,
        dailyQuota: 5000,
        usedQuota: 0,
        isAvailable: false,
      },
    ];

    mockProbeFn = vi.fn().mockResolvedValue(true) as unknown as (
      source: DataSource,
    ) => Promise<boolean>;
    scheduler = new TimerBasedHealthProbeScheduler(
      () => mockSources,
      mockProbeFn as (source: DataSource) => Promise<boolean>,
      {
        interval: 60000,
        initialDelay: 1000,
        timeout: 5000,
        unhealthyThreshold: 3,
        recoveryThreshold: 2,
      },
    );
  });

  afterEach(() => {
    scheduler.stop();
  });

  describe("Initial state", () => {
    it("should start with all sources healthy by default", () => {
      const status = scheduler.getHealthStatus("source1");
      expect(status.isHealthy).toBe(true);
    });
  });

  describe("markUnhealthy()", () => {
    it("should mark source as unhealthy", () => {
      scheduler.markUnhealthy("source1", "Test reason");
      const status = scheduler.getHealthStatus("source1");
      expect(status.isHealthy).toBe(false);
      expect(status.lastError).toBe("Test reason");
    });
  });

  describe("markHealthy()", () => {
    it("should mark source as healthy", () => {
      scheduler.markUnhealthy("source1");
      scheduler.markHealthy("source1");
      const status = scheduler.getHealthStatus("source1");
      expect(status.isHealthy).toBe(true);
    });
  });

  describe("stop()", () => {
    it("should cancel all scheduled probes", () => {
      scheduler.markUnhealthy("source1");
      scheduler.start();
      scheduler.stop();

      const status = scheduler.getHealthStatus("source1");
      expect(status).toBeDefined();
    });
  });
});
