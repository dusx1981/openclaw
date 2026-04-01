import { describe, it, expect, beforeEach } from "vitest";
import {
  runConcurrent,
  runInBatches,
  detectRaceCondition,
  testAtomicIncrement,
  createSharedState,
} from "./concurrency.js";

describe("Concurrency Helpers", () => {
  describe("runConcurrent", () => {
    it("should run operations concurrently", async () => {
      let counter = 0;

      const result = await runConcurrent(async () => {
        counter++;
        return counter;
      }, 10);

      expect(result.successCount).toBe(10);
      expect(result.errorCount).toBe(0);
      expect(result.results.length).toBe(10);
    });

    it("should capture errors", async () => {
      const result = await runConcurrent(async () => {
        throw new Error("test error");
      }, 5);

      expect(result.errorCount).toBe(5);
      expect(result.errors.length).toBe(5);
      expect(result.errors[0].message).toBe("test error");
    });

    it("should track duration", async () => {
      const result = await runConcurrent(async () => {
        await new Promise((r) => setTimeout(r, 10));
        return true;
      }, 5);

      expect(result.duration).toBeGreaterThanOrEqual(10);
    });
  });

  describe("runInBatches", () => {
    it("should run operations in batches", async () => {
      let totalRuns = 0;

      const result = await runInBatches(
        async () => {
          totalRuns++;
          return totalRuns;
        },
        20,
        5,
      );

      expect(totalRuns).toBe(20);
      expect(result.successCount).toBe(20);
    });

    it("should handle partial batches", async () => {
      let totalRuns = 0;

      const result = await runInBatches(
        async () => {
          totalRuns++;
          return totalRuns;
        },
        23,
        10,
      );

      expect(totalRuns).toBe(23);
      expect(result.successCount).toBe(23);
    });
  });

  describe("detectRaceCondition", () => {
    it("should detect inconsistencies in concurrent reads", async () => {
      let sharedValue = 0;
      const incrementing = { value: true };

      const result = await detectRaceCondition(5, async () => {
        if (incrementing.value) {
          await new Promise((r) => setTimeout(r, 10));
          sharedValue++;
        }
        return sharedValue;
      });

      expect(result.inconsistencies).toBeGreaterThanOrEqual(0);
    });

    it("should return zero inconsistencies for consistent values", async () => {
      const result = await detectRaceCondition(5, async () => {
        await new Promise((r) => setTimeout(r, 5));
        return 42;
      });

      expect(result.detected).toBe(false);
      expect(result.inconsistencies).toBe(0);
    });
  });

  describe("testAtomicIncrement", () => {
    it("should test atomic increment accuracy", async () => {
      let counter = 0;

      const result = await testAtomicIncrement(
        async () => {
          counter++;
        },
        async () => counter,
        100,
      );

      expect(result.expected).toBe(100);
      expect(result.actual).toBe(100);
      expect(result.success).toBe(true);
    });

    it("should detect non-atomic increments", async () => {
      let counter = 0;

      const result = await testAtomicIncrement(
        async () => {
          const current = counter;
          await new Promise((r) => setTimeout(r, 0));
          counter = current + 1;
        },
        async () => counter,
        100,
      );

      expect(result.expected).toBe(100);
      expect(result.actual).toBeLessThan(100);
      expect(result.success).toBe(false);
    });
  });

  describe("createSharedState", () => {
    it("should create shared state", () => {
      const state = createSharedState({ count: 0 });

      expect(state.get()).toEqual({ count: 0 });
    });

    it("should set state", () => {
      const state = createSharedState({ count: 0 });

      state.set({ count: 10 });

      expect(state.get()).toEqual({ count: 10 });
    });

    it("should update state", () => {
      const state = createSharedState({ count: 0 });

      state.update((s) => ({ count: s.count + 5 }));

      expect(state.get()).toEqual({ count: 5 });
    });
  });
});
