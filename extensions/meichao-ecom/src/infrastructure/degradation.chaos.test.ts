import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Chaos } from "../../test/helpers/chaos.js";
import { runConcurrent } from "../../test/helpers/concurrency.js";
import { CircuitBreaker } from "./circuit-breaker/CircuitBreaker.js";
import { CooldownManager } from "./degradation/CooldownManager.js";

describe("Degradation System Chaos Tests", () => {
  describe("Random Source Failures", () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 5,
        openDuration: 100,
        successThreshold: 3,
      });
      Chaos.setSeed(12345);
    });

    afterEach(() => {
      Chaos.reset();
    });

    it("should handle random failures with circuit breaker", async () => {
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < 100; i++) {
        if (circuitBreaker.canExecute()) {
          if (Chaos.shouldFail(0.3)) {
            circuitBreaker.recordFailure();
            failureCount++;
          } else {
            circuitBreaker.recordSuccess();
            successCount++;
          }
        }
      }

      expect(successCount + failureCount).toBeGreaterThan(0);
      expect(failureCount).toBeGreaterThan(0);
    });

    it("should maintain circuit breaker state under random failures", async () => {
      Chaos.setSeed(42);

      for (let i = 0; i < 20; i++) {
        if (circuitBreaker.canExecute()) {
          if (Chaos.shouldFail(0.5)) {
            circuitBreaker.recordFailure();
          } else {
            circuitBreaker.recordSuccess();
          }
        }
        await new Promise((r) => setTimeout(r, 1));
      }

      const finalState = circuitBreaker.getState();
      expect(["closed", "open", "half-open"]).toContain(finalState);
    });

    it("should recover from failures after cooldown", async () => {
      const cb = new CircuitBreaker({ failureThreshold: 3, openDuration: 50 });

      for (let i = 0; i < 5; i++) {
        cb.recordFailure();
      }

      expect(cb.getState()).toBe("open");

      await new Promise((r) => setTimeout(r, 60));

      expect(cb.canExecute()).toBe(true);
    });
  });

  describe("Network Latency Injection", () => {
    beforeEach(() => {
      Chaos.setSeed(12345);
    });

    afterEach(() => {
      Chaos.reset();
    });

    it("should handle delayed operations with timeout", async () => {
      const operation = async () => {
        await Chaos.injectLatency(50);
        return { data: "success" };
      };

      const start = Date.now();
      const result = await operation();
      const duration = Date.now() - start;

      expect(result.data).toBe("success");
      expect(duration).toBeGreaterThanOrEqual(45);
    });

    it("should handle random latency within bounds", async () => {
      Chaos.setSeed(12345);
      const durations: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await Chaos.injectRandomLatency(10, 30);
        durations.push(Date.now() - start);
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      expect(avgDuration).toBeGreaterThanOrEqual(8);
      expect(avgDuration).toBeLessThanOrEqual(35);
    });

    it("should not block circuit breaker on latency", async () => {
      const cb = new CircuitBreaker({ failureThreshold: 5 });

      const results = await runConcurrent(async () => {
        await Chaos.injectLatency(5);
        if (cb.canExecute()) {
          cb.recordSuccess();
          return true;
        }
        return false;
      }, 20);

      expect(results.successCount).toBe(20);
    });
  });

  describe("Partial Response Handling", () => {
    beforeEach(() => {
      Chaos.setSeed(12345);
    });

    afterEach(() => {
      Chaos.reset();
    });

    it("should handle partial product data", () => {
      const fullProduct = {
        id: "123",
        title: "Product",
        price: 99.99,
        currency: "USD",
        sales: 100,
        status: "active",
        rating: 4.5,
        reviews: 50,
      };

      const partial = Chaos.injectPartialResponse(fullProduct, 0.5);

      expect(Object.keys(partial).length).toBeLessThan(Object.keys(fullProduct).length);
      expect(Object.keys(partial).length).toBeGreaterThan(0);
    });

    it("should handle missing required fields gracefully", () => {
      const data = {
        id: "123",
        title: "Test",
        price: null,
      };

      const result = Chaos.injectPartialResponse(data, 0.3);

      expect(result).toBeDefined();
    });

    it("should preserve critical fields when specified", () => {
      const data = {
        id: "123",
        title: "Product",
        price: 99.99,
        sales: 100,
      };

      const partial = Chaos.injectPartialResponse(data, 0.5, ["id"]);

      expect(partial.id).toBe("123");
    });
  });

  describe("Connection Drops", () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      Chaos.setSeed(12345);
      circuitBreaker = new CircuitBreaker({ failureThreshold: 3, openDuration: 50 });
    });

    afterEach(() => {
      Chaos.reset();
    });

    it("should handle connection refused errors", async () => {
      const operation = async () => {
        if (Chaos.shouldFail(0.3)) {
          throw Chaos.injectNetworkError("ECONNREFUSED");
        }
        return { connected: true };
      };

      let successes = 0;
      let failures = 0;

      for (let i = 0; i < 20; i++) {
        try {
          await operation();
          successes++;
        } catch {
          failures++;
        }
      }

      expect(failures).toBeGreaterThan(0);
      expect(successes).toBeGreaterThan(0);
    });

    it("should trigger circuit breaker on connection drops", async () => {
      for (let i = 0; i < 5; i++) {
        if (circuitBreaker.canExecute()) {
          try {
            if (Chaos.shouldFail(0.8)) {
              throw new Error("Connection dropped");
            }
            circuitBreaker.recordSuccess();
          } catch {
            circuitBreaker.recordFailure();
          }
        }
      }

      expect(circuitBreaker.getState()).toBe("open");
    });

    it("should handle DNS failures", async () => {
      const operation = async () => {
        if (Chaos.shouldFail(0.2)) {
          throw Chaos.injectNetworkError("ENOTFOUND");
        }
        return { resolved: true };
      };

      let dnsFailures = 0;

      for (let i = 0; i < 50; i++) {
        try {
          await operation();
        } catch (e) {
          if (e instanceof Error && e.message.includes("ENOTFOUND")) {
            dnsFailures++;
          }
        }
      }

      expect(dnsFailures).toBeGreaterThan(0);
    });
  });

  describe("Timeout Scenarios", () => {
    beforeEach(() => {
      Chaos.setSeed(12345);
    });

    afterEach(() => {
      Chaos.reset();
    });

    it("should handle timeout errors", async () => {
      Chaos.setSeed(12345);

      let timeouts = 0;

      for (let i = 0; i < 20; i++) {
        if (Chaos.shouldFail(0.5)) {
          try {
            await Chaos.injectTimeout(10);
          } catch (e) {
            if (e instanceof Error && e.message.includes("Timeout")) {
              timeouts++;
            }
          }
        }
      }

      expect(timeouts).toBeGreaterThan(0);
    });

    it("should respect timeout rate configuration", async () => {
      Chaos.setSeed(42);

      let triggered = 0;
      let notTriggered = 0;

      for (let i = 0; i < 50; i++) {
        const result = await Chaos.injectTimeout(5, 0.3);
        if (result) {
          triggered++;
        } else {
          notTriggered++;
        }
      }

      expect(triggered).toBeGreaterThan(0);
      expect(notTriggered).toBeGreaterThan(0);
    });

    it("should integrate timeout with circuit breaker", async () => {
      const cb = new CircuitBreaker({ failureThreshold: 3, openDuration: 30 });
      Chaos.setSeed(12345);

      for (let i = 0; i < 50; i++) {
        if (cb.canExecute()) {
          if (Chaos.shouldFail(0.5)) {
            try {
              await Chaos.injectTimeout(5);
            } catch {
              cb.recordFailure();
            }
          } else {
            cb.recordSuccess();
          }
        }
      }

      expect(cb.getFailureCount()).toBeGreaterThan(0);
    });
  });

  describe("Memory Pressure During Degradation", () => {
    it("should handle memory pressure with circuit breaker", async () => {
      const cb = new CircuitBreaker({ failureThreshold: 5 });
      const largeData: number[][] = [];

      for (let i = 0; i < 100; i++) {
        if (cb.canExecute()) {
          largeData.push(new Array(100).fill(i));
          cb.recordSuccess();
        }
      }

      expect(cb.getSuccessCount()).toBe(100);
      expect(largeData.length).toBe(100);
    });

    it("should maintain cooldown state under memory pressure", () => {
      const cooldown = new CooldownManager();
      const sources = Array.from({ length: 100 }, (_, i) => `source-${i}`);

      const largeData: Buffer[] = [];
      for (let i = 0; i < 50; i++) {
        largeData.push(Buffer.alloc(1024 * 100));
      }

      for (const source of sources) {
        cooldown.recordFailure(source, {
          reason: "rate_limit",
          message: "Rate limit",
          originalError: new Error("Rate limit"),
          isSevere: false,
        });
      }

      let inCooldownCount = 0;
      for (const source of sources) {
        if (cooldown.isInCooldown(source)) {
          inCooldownCount++;
        }
      }

      expect(inCooldownCount).toBe(100);
    });
  });
});
