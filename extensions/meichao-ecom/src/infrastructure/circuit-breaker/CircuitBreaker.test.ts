import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CircuitBreaker } from "./CircuitBreaker.js";

describe("CircuitBreaker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Initial state", () => {
    it("should start in Closed state", () => {
      const cb = new CircuitBreaker();
      expect(cb.getState()).toBe("closed");
      expect(cb.canExecute()).toBe(true);
    });

    it("should apply default configuration", () => {
      const cb = new CircuitBreaker();
      expect(cb.canExecute()).toBe(true);
    });

    it("should apply custom configuration", () => {
      const cb = new CircuitBreaker({ failureThreshold: 3 });
      for (let i = 0; i < 3; i++) {
        cb.recordFailure();
      }
      expect(cb.getState()).toBe("open");
    });
  });

  describe("Closed state behavior", () => {
    it("should allow all requests in Closed state", () => {
      const cb = new CircuitBreaker();
      expect(cb.canExecute()).toBe(true);
      cb.recordSuccess();
      expect(cb.canExecute()).toBe(true);
    });

    it("should count failures", () => {
      const cb = new CircuitBreaker({ failureThreshold: 3 });
      cb.recordFailure();
      expect(cb.getFailureCount()).toBe(1);
      expect(cb.getState()).toBe("closed");
    });

    it("should reset failure count on success", () => {
      const cb = new CircuitBreaker();
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.getFailureCount()).toBe(2);
      cb.recordSuccess();
      expect(cb.getFailureCount()).toBe(0);
    });
  });

  describe("Transition to Open", () => {
    it("should transition to Open on failure threshold", () => {
      const cb = new CircuitBreaker({ failureThreshold: 5 });
      for (let i = 0; i < 5; i++) {
        cb.recordFailure();
      }
      expect(cb.getState()).toBe("open");
    });

    it("should reject all requests in Open state", () => {
      const cb = new CircuitBreaker({ failureThreshold: 2 });
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.getState()).toBe("open");
      expect(cb.canExecute()).toBe(false);
    });
  });

  describe("Transition to HalfOpen", () => {
    it("should transition to HalfOpen after timeout", () => {
      const cb = new CircuitBreaker({
        failureThreshold: 2,
        openDuration: 30000,
      });
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.getState()).toBe("open");

      vi.advanceTimersByTime(30000);
      expect(cb.getState()).toBe("half-open");
    });

    it("should allow limited requests in HalfOpen state", () => {
      const cb = new CircuitBreaker({
        failureThreshold: 2,
        openDuration: 30000,
        halfOpenMaxCalls: 1,
      });
      cb.recordFailure();
      cb.recordFailure();
      vi.advanceTimersByTime(30000);
      expect(cb.getState()).toBe("half-open");
      expect(cb.canExecute()).toBe(true);
    });
  });

  describe("HalfOpen to Closed transition", () => {
    it("should transition to Closed on success threshold", () => {
      const cb = new CircuitBreaker({
        failureThreshold: 2,
        openDuration: 30000,
        successThreshold: 2,
      });
      cb.recordFailure();
      cb.recordFailure();
      vi.advanceTimersByTime(30000);
      expect(cb.getState()).toBe("half-open");

      cb.recordSuccess();
      expect(cb.getState()).toBe("half-open");
      cb.recordSuccess();
      expect(cb.getState()).toBe("closed");
    });
  });

  describe("HalfOpen to Open transition", () => {
    it("should transition back to Open on failure", () => {
      const cb = new CircuitBreaker({
        failureThreshold: 2,
        openDuration: 30000,
      });
      cb.recordFailure();
      cb.recordFailure();
      vi.advanceTimersByTime(30000);
      expect(cb.getState()).toBe("half-open");

      cb.recordFailure();
      expect(cb.getState()).toBe("open");
      expect(cb.canExecute()).toBe(false);
    });
  });

  describe("Manual reset", () => {
    it("should reset to Closed state", () => {
      const cb = new CircuitBreaker({ failureThreshold: 2 });
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.getState()).toBe("open");

      cb.reset();
      expect(cb.getState()).toBe("closed");
      expect(cb.getFailureCount()).toBe(0);
      expect(cb.canExecute()).toBe(true);
    });
  });
});
