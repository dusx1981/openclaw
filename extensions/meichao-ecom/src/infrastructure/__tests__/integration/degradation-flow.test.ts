import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { CircuitBreakerConfig } from "../../../domain/types.js";
import { CircuitBreaker } from "../../circuit-breaker/CircuitBreaker.js";
import { createTaobaoRetryRunner } from "../../retry-policy.js";

describe("Integration: Retry + CircuitBreaker", () => {
  let circuitBreaker: CircuitBreaker;
  const config: CircuitBreakerConfig = {
    enabled: true,
    failureThreshold: 3,
    openDuration: 1000,
    halfOpenMaxCalls: 2,
    successThreshold: 2,
  };

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker(config);
  });

  describe("Retry + CircuitBreaker Flow", () => {
    it("should succeed when retry recovers from transient error", async () => {
      const retryRunner = createTaobaoRetryRunner();
      let attempts = 0;

      const result = await retryRunner(async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error("rate_limit: Temporary rate limit");
        }
        return "success";
      });

      expect(result).toBe("success");
      expect(attempts).toBe(2);
    });

    it("should record success to CircuitBreaker after successful retry", async () => {
      const retryRunner = createTaobaoRetryRunner();

      const result = await retryRunner(async () => "success");

      expect(result).toBe("success");
      circuitBreaker.recordSuccess();
      expect(circuitBreaker.canExecute()).toBe(true);
      expect(circuitBreaker.getState()).toBe("closed");
    });

    it("should record failure to CircuitBreaker after all retries fail", async () => {
      const retryRunner = createTaobaoRetryRunner();

      await expect(
        retryRunner(async () => {
          throw new Error("rate_limit: Persistent rate limit");
        }),
      ).rejects.toThrow();

      circuitBreaker.recordFailure();
      expect(circuitBreaker.getFailureCount()).toBe(1);
    });
  });

  describe("CircuitBreaker State Transitions", () => {
    it("should transition to OPEN after reaching failure threshold", () => {
      expect(circuitBreaker.getState()).toBe("closed");

      for (let i = 0; i < config.failureThreshold; i++) {
        circuitBreaker.recordFailure();
      }

      expect(circuitBreaker.getState()).toBe("open");
      expect(circuitBreaker.canExecute()).toBe(false);
    });

    it("should transition to HALF-OPEN after openDuration", async () => {
      for (let i = 0; i < config.failureThreshold; i++) {
        circuitBreaker.recordFailure();
      }
      expect(circuitBreaker.getState()).toBe("open");

      await new Promise((resolve) => setTimeout(resolve, config.openDuration + 100));

      expect(circuitBreaker.getState()).toBe("half-open");
      expect(circuitBreaker.canExecute()).toBe(true);
    });

    it("should transition back to CLOSED after successThreshold successes", async () => {
      for (let i = 0; i < config.failureThreshold; i++) {
        circuitBreaker.recordFailure();
      }
      await new Promise((resolve) => setTimeout(resolve, config.openDuration + 100));
      expect(circuitBreaker.getState()).toBe("half-open");

      for (let i = 0; i < config.successThreshold; i++) {
        circuitBreaker.recordSuccess();
      }

      expect(circuitBreaker.getState()).toBe("closed");
    });
  });

  describe("Severe Error Handling", () => {
    it("should not retry severe errors", async () => {
      const retryRunner = createTaobaoRetryRunner();
      let attempts = 0;

      await expect(
        retryRunner(async () => {
          attempts++;
          const error = new Error("Authentication failed permanently");
          (error as any).code = "isp.insufficient-isv-permissions";
          throw error;
        }),
      ).rejects.toThrow();

      expect(attempts).toBe(1);
    });
  });
});
