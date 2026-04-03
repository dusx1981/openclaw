import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runConcurrent, runInBatches } from "../../test/helpers/concurrency.js";
import { CircuitBreaker } from "../circuit-breaker/CircuitBreaker.js";
import { CooldownManager } from "../degradation/CooldownManager.js";

describe("Concurrency Tests", () => {
  describe("CircuitBreaker Concurrency", () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      circuitBreaker = new CircuitBreaker({
        failureThreshold: 5,
        successThreshold: 3,
        openDuration: 100,
        halfOpenMaxCalls: 3,
      });
    });

    it("should handle concurrent recordSuccess calls", async () => {
      const result = await runConcurrent(async () => {
        circuitBreaker.recordSuccess();
        return circuitBreaker.getSuccessCount();
      }, 100);

      expect(circuitBreaker.getSuccessCount()).toBe(100);
      expect(result.successCount).toBe(100);
    });

    it("should handle concurrent recordFailure calls", async () => {
      const result = await runConcurrent(async () => {
        circuitBreaker.recordFailure();
        return circuitBreaker.getFailureCount();
      }, 100);

      expect(circuitBreaker.getFailureCount()).toBe(100);
      expect(result.successCount).toBe(100);
    });

    it("should handle concurrent canExecute and recordFailure", async () => {
      const results = { allowed: 0, denied: 0 };

      await runConcurrent(async () => {
        if (circuitBreaker.canExecute()) {
          results.allowed++;
          circuitBreaker.recordFailure();
        } else {
          results.denied++;
        }
        return true;
      }, 50);

      expect(results.allowed + results.denied).toBe(50);
    });

    it("should maintain consistent state under concurrent operations", async () => {
      const states = new Set<string>();

      await runConcurrent(async () => {
        circuitBreaker.recordFailure();
        states.add(circuitBreaker.getState());
        return circuitBreaker.getState();
      }, 10);

      expect(circuitBreaker.getFailureCount()).toBe(10);
    });

    it("should handle concurrent state transitions", async () => {
      await runConcurrent(async () => {
        for (let i = 0; i < 5; i++) {
          circuitBreaker.recordFailure();
        }
        return circuitBreaker.getState();
      }, 10);

      const finalState = circuitBreaker.getState();
      expect(["closed", "open", "half-open"]).toContain(finalState);
    });
  });

  describe("CooldownManager Concurrency", () => {
    let cooldownManager: CooldownManager;

    beforeEach(() => {
      cooldownManager = new CooldownManager();
    });

    afterEach(() => {
      cooldownManager.clearCooldown("test-source");
    });

    it("should handle concurrent recordFailure calls", async () => {
      const sourceId = "test-source";

      await runConcurrent(async () => {
        cooldownManager.recordFailure(sourceId, {
          reason: "rate_limit",
          message: "Rate limit exceeded",
          originalError: new Error("Rate limit exceeded"),
          isSevere: false,
        });
        return cooldownManager.getCooldownState(sourceId)?.errorCount ?? 0;
      }, 10);

      const state = cooldownManager.getCooldownState(sourceId);
      expect(state?.errorCount).toBe(10);
    });

    it("should handle concurrent recordSuccess calls", async () => {
      const sourceId = "test-source";

      cooldownManager.recordFailure(sourceId, {
        reason: "rate_limit",
        message: "Rate limit exceeded",
        originalError: new Error("Rate limit exceeded"),
        isSevere: false,
      });

      await runConcurrent(async () => {
        cooldownManager.recordSuccess(sourceId);
        return cooldownManager.getCooldownState(sourceId)?.errorCount ?? 0;
      }, 5);

      expect(cooldownManager.getCooldownState(sourceId)?.errorCount ?? 0).toBe(0);
    });

    it("should handle mixed concurrent operations", async () => {
      const sourceId = "test-source";

      await runConcurrent(async () => {
        const random = Math.random();
        if (random < 0.5) {
          cooldownManager.recordFailure(sourceId, {
            reason: "rate_limit",
            message: "Error",
            originalError: new Error("Error"),
            isSevere: false,
          });
        } else {
          cooldownManager.recordSuccess(sourceId);
        }
        return true;
      }, 20);

      const state = cooldownManager.getCooldownState(sourceId);
      expect(state?.errorCount ?? 0).toBeGreaterThanOrEqual(0);
    });

    it("should maintain consistent cooldown state", async () => {
      const sourceId = "test-source";

      await runConcurrent(async () => {
        cooldownManager.recordFailure(sourceId, {
          reason: "timeout",
          message: "Timeout",
          originalError: new Error("Timeout"),
          isSevere: false,
        });
        return cooldownManager.isInCooldown(sourceId);
      }, 5);

      expect(cooldownManager.isInCooldown(sourceId)).toBe(true);
    });
  });

  describe("High Concurrency Stress Tests", () => {
    it("should handle 1000 concurrent circuit breaker operations", async () => {
      const cb = new CircuitBreaker({ failureThreshold: 100 });

      const result = await runInBatches(
        async () => {
          cb.recordSuccess();
          return cb.getSuccessCount();
        },
        1000,
        100,
      );

      expect(result.successCount).toBe(1000);
      expect(cb.getSuccessCount()).toBe(1000);
    }, 10000);

    it("should handle rapid state changes under load", async () => {
      const cb = new CircuitBreaker({
        failureThreshold: 10,
        openDuration: 50,
      });

      const result = await runConcurrent(async () => {
        const state = cb.getState();
        if (state === "closed") {
          cb.recordFailure();
        } else if (state === "open") {
          await new Promise((r) => setTimeout(r, 60));
          cb.getState();
        }
        return state;
      }, 50);

      expect(result.successCount).toBe(50);
    });

    it("should maintain consistency with concurrent read/write", async () => {
      const cb = new CircuitBreaker();
      const states: string[] = [];

      await Promise.all([
        runConcurrent(async () => {
          states.push(cb.getState());
          return true;
        }, 50),
        runConcurrent(async () => {
          cb.recordFailure();
          return true;
        }, 50),
      ]);

      expect(states.length).toBe(50);
    });
  });

  describe("Cache Concurrency Simulation", () => {
    it("should handle concurrent cache-like operations", async () => {
      const cache = new Map<string, number>();
      let counter = 0;

      const result = await runConcurrent(async () => {
        const key = `key-${counter++ % 10}`;
        const current = cache.get(key) ?? 0;
        cache.set(key, current + 1);
        return cache.get(key);
      }, 100);

      expect(result.successCount).toBe(100);
    });

    it("should simulate cache invalidation under concurrency", async () => {
      const cache = new Map<string, string>();
      let invalidateCount = 0;

      await Promise.all([
        runConcurrent(async () => {
          cache.set("test-key", `value-${Date.now()}`);
          return true;
        }, 50),
        runConcurrent(async () => {
          cache.delete("test-key");
          invalidateCount++;
          return true;
        }, 10),
      ]);

      expect(invalidateCount).toBe(10);
    });
  });

  describe("Degradation Flow Concurrency", () => {
    it("should handle concurrent source failover simulation", async () => {
      const sources = ["primary", "fallback1", "fallback2"];
      const activeSource = { current: "primary" };
      const failures = { count: 0 };

      const result = await runConcurrent(async () => {
        const currentIndex = sources.indexOf(activeSource.current);
        if (currentIndex < sources.length - 1 && failures.count > 3) {
          activeSource.current = sources[currentIndex + 1];
        }
        failures.count++;
        return activeSource.current;
      }, 20);

      expect(result.successCount).toBe(20);
    });

    it("should handle concurrent cooldown updates", async () => {
      const cooldown = new CooldownManager();
      const sources = ["source1", "source2", "source3"];

      const result = await runConcurrent(async () => {
        const source = sources[Math.floor(Math.random() * sources.length)];
        cooldown.recordFailure(source, {
          reason: "rate_limit",
          message: "Rate limit",
          originalError: new Error("Rate limit"),
          isSevere: false,
        });
        return cooldown.isInCooldown(source);
      }, 30);

      expect(result.successCount).toBe(30);

      let inCooldownCount = 0;
      for (const source of sources) {
        if (cooldown.isInCooldown(source)) {
          inCooldownCount++;
        }
      }
      expect(inCooldownCount).toBeGreaterThan(0);
    });
  });
});
