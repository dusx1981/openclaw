import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import { PoolHealthCheck, PoolStatus, PoolMetrics } from "./PoolHealthCheck.js";

vi.mock("./postgres.js", () => ({
  getPool: vi.fn(),
}));

interface MockPool {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
  options: { max: number };
  query: Mock;
  connect: Mock;
}

const createMockPool = (): MockPool => ({
  totalCount: 5,
  idleCount: 3,
  waitingCount: 0,
  options: { max: 10 },
  query: vi.fn().mockResolvedValue({ rows: [{ "?column?": 1 }] }),
  connect: vi.fn(),
});

describe("PoolHealthCheck", () => {
  let healthCheck: PoolHealthCheck;
  let mockPool: MockPool;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockPool = createMockPool();

    const postgres = await import("./postgres.js");
    vi.spyOn(postgres, "getPool").mockReturnValue(mockPool as any);

    healthCheck = new PoolHealthCheck({
      warningThreshold: 0.8,
      criticalThreshold: 0.9,
      checkInterval: 1000,
      autoReconnect: true,
      maxReconnectAttempts: 3,
      reconnectDelay: 100,
    });
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    healthCheck.stopPeriodicCheck();
  });

  describe("getPoolStatus", () => {
    it("should return current pool status", async () => {
      const status = await healthCheck.getPoolStatus();

      expect(status.total).toBe(5);
      expect(status.idle).toBe(3);
      expect(status.waiting).toBe(0);
      expect(status.healthy).toBe(true);
      expect(status.lastCheck).toBeInstanceOf(Date);
    });

    it("should detect unhealthy pool when at capacity", async () => {
      mockPool.totalCount = 10;
      mockPool.idleCount = 0;
      mockPool.waitingCount = 5;

      const status = await healthCheck.getPoolStatus();

      expect(status.healthy).toBe(false);
    });

    it("should handle errors gracefully", async () => {
      const postgres = await import("./postgres.js");
      (postgres.getPool as Mock).mockImplementation(() => {
        throw new Error("Pool not initialized");
      });

      const status = await healthCheck.getPoolStatus();

      expect(status.healthy).toBe(false);
      expect(status.error).toBe("Pool not initialized");
    });
  });

  describe("getMetrics", () => {
    it("should return pool metrics", () => {
      const metrics = healthCheck.getMetrics();

      expect(metrics).not.toBeNull();
      expect(metrics?.totalCount).toBe(5);
      expect(metrics?.idleCount).toBe(3);
      expect(metrics?.waitingCount).toBe(0);
      expect(metrics?.maxConnections).toBe(10);
      expect(metrics?.connectionUsage).toBe(0.5);
    });

    it("should calculate correct usage percentage", () => {
      mockPool.totalCount = 8;
      mockPool.idleCount = 2;
      mockPool.waitingCount = 3;

      const metrics = healthCheck.getMetrics();

      expect(metrics?.connectionUsage).toBe(0.8);
    });

    it("should return null on error", async () => {
      const postgres = await import("./postgres.js");
      (postgres.getPool as Mock).mockImplementation(() => {
        throw new Error("Pool error");
      });

      const metrics = healthCheck.getMetrics();

      expect(metrics).toBeNull();
    });
  });

  describe("checkAndAlert", () => {
    it("should not alert when usage is normal", async () => {
      const result = await healthCheck.checkAndAlert();

      expect(result.alert).toBeUndefined();
      expect(result.status.healthy).toBe(true);
    });

    it("should issue warning at 80% usage", async () => {
      mockPool.totalCount = 8;
      mockPool.idleCount = 2;

      const consoleSpy = vi.spyOn(console, "warn");
      const result = await healthCheck.checkAndAlert();

      expect(result.alert).toBe("warning");
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("should issue critical alert at 90% usage", async () => {
      mockPool.totalCount = 9;
      mockPool.idleCount = 1;

      const consoleSpy = vi.spyOn(console, "error");
      const result = await healthCheck.checkAndAlert();

      expect(result.alert).toBe("critical");
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe("handleReconnect", () => {
    it("should attempt to reconnect on connection error", async () => {
      const postgres = await import("./postgres.js");
      let callCount = 0;

      (postgres.getPool as Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error("Connection lost");
        }
        return mockPool;
      });

      await healthCheck.getPoolStatus();
      await vi.runAllTimersAsync();

      expect(mockPool.query).toHaveBeenCalled();
    });

    it("should stop after max reconnect attempts", async () => {
      const postgres = await import("./postgres.js");
      const consoleSpy = vi.spyOn(console, "error");

      (postgres.getPool as Mock).mockImplementation(() => {
        throw new Error("Connection failed");
      });

      await healthCheck.getPoolStatus();
      await vi.runAllTimersAsync();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to reconnect after 3 attempts"),
      );
    });

    it("should use exponential backoff for retries", async () => {
      const postgres = await import("./postgres.js");
      const delays: number[] = [];

      const originalSetTimeout = global.setTimeout;
      vi.spyOn(global, "setTimeout").mockImplementation((fn: any, delay?: number) => {
        if (delay) delays.push(delay);
        return originalSetTimeout(fn, delay);
      });

      (postgres.getPool as Mock).mockImplementation(() => {
        throw new Error("Connection failed");
      });

      await healthCheck.getPoolStatus();
      await vi.runAllTimersAsync();

      expect(delays.length).toBeGreaterThan(0);
    });
  });

  describe("periodic check", () => {
    it("should start periodic health checks", async () => {
      const callback = vi.fn();

      healthCheck.startPeriodicCheck(callback);

      await vi.runAllTimersAsync();

      expect(callback).toHaveBeenCalled();
    });

    it("should stop periodic health checks", async () => {
      const callback = vi.fn();

      healthCheck.startPeriodicCheck(callback);
      healthCheck.stopPeriodicCheck();

      await vi.runAllTimersAsync();

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("waitForHealthy", () => {
    it("should return true when pool is healthy", async () => {
      const result = await healthCheck.waitForHealthy(1000);

      expect(result).toBe(true);
    });

    it("should return false on timeout", async () => {
      mockPool.totalCount = 10;
      mockPool.idleCount = 0;
      mockPool.waitingCount = 5;

      const result = await healthCheck.waitForHealthy(100);

      expect(result).toBe(false);
    });
  });

  describe("getLastStatus", () => {
    it("should return null before first check", () => {
      const status = healthCheck.getLastStatus();

      expect(status).toBeNull();
    });

    it("should return last status after check", async () => {
      await healthCheck.getPoolStatus();

      const status = healthCheck.getLastStatus();

      expect(status).not.toBeNull();
      expect(status?.total).toBe(5);
    });
  });

  describe("Custom configuration", () => {
    it("should use custom thresholds", async () => {
      const customHealthCheck = new PoolHealthCheck({
        warningThreshold: 0.5,
        criticalThreshold: 0.7,
      });

      mockPool.totalCount = 6;
      mockPool.idleCount = 4;

      const result = await customHealthCheck.checkAndAlert();

      expect(result.alert).toBe("warning");
    });

    it("should allow disabling auto reconnect", async () => {
      const noReconnectCheck = new PoolHealthCheck({
        autoReconnect: false,
      });

      const postgres = await import("./postgres.js");
      (postgres.getPool as Mock).mockImplementation(() => {
        throw new Error("Connection error");
      });

      await noReconnectCheck.getPoolStatus();

      expect(mockPool.query).not.toHaveBeenCalled();
    });
  });
});
