import { describe, it, expect, beforeEach } from "vitest";
import { Chaos } from "./chaos.js";

describe("Chaos", () => {
  beforeEach(() => {
    Chaos.enable();
    Chaos.setSeed(12345);
  });

  describe("injectLatency", () => {
    it("should inject fixed latency", async () => {
      const start = Date.now();
      await Chaos.injectLatency(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(40);
    });
  });

  describe("shouldFail", () => {
    it("should return true with given rate", () => {
      Chaos.setSeed(12345);
      const results = Array.from({ length: 100 }, () => Chaos.shouldFail(0.5));
      const failures = results.filter(Boolean).length;
      expect(failures).toBeGreaterThan(30);
      expect(failures).toBeLessThan(70);
    });

    it("should be reproducible with same seed", () => {
      Chaos.setSeed(12345);
      const first = Array.from({ length: 10 }, () => Chaos.shouldFail(0.5));

      Chaos.setSeed(12345);
      const second = Array.from({ length: 10 }, () => Chaos.shouldFail(0.5));

      expect(first).toEqual(second);
    });
  });

  describe("injectFailure", () => {
    it("should throw error when failure is triggered", () => {
      Chaos.setSeed(1);
      expect(() => Chaos.injectFailure(1.0, new Error("Test error"))).toThrow("Test error");
    });

    it("should not throw when chaos is disabled", () => {
      Chaos.disable();
      expect(() => Chaos.injectFailure(1.0, new Error("Test error"))).not.toThrow();
    });
  });

  describe("injectPartialResponse", () => {
    it("should remove some fields", () => {
      Chaos.setSeed(12345);
      const data = { a: 1, b: 2, c: 3, d: 4, e: 5 };
      const partial = Chaos.injectPartialResponse(data, 0.5);

      expect(Object.keys(partial).length).toBeLessThanOrEqual(5);
    });

    it("should return full data when disabled", () => {
      Chaos.disable();
      const data = { a: 1, b: 2, c: 3 };
      const partial = Chaos.injectPartialResponse(data, 0.5);

      expect(partial).toEqual(data);
    });
  });

  describe("injectNetworkError", () => {
    it("should throw network error", () => {
      expect(() => Chaos.injectNetworkError("ECONNREFUSED")).toThrow("ECONNREFUSED");
    });
  });

  describe("sequence", () => {
    it("should apply effects in order", async () => {
      const order: number[] = [];

      const effect = Chaos.sequence([
        () => {
          order.push(1);
        },
        () => {
          order.push(2);
        },
        () => {
          order.push(3);
        },
      ]);

      await effect();
      expect(order).toEqual([1, 2, 3]);
    });
  });

  describe("randomEffect", () => {
    it("should apply one random effect", async () => {
      Chaos.setSeed(12345);
      const counts = { a: 0, b: 0, c: 0 };

      const effect = Chaos.randomEffect([
        () => {
          counts.a++;
        },
        () => {
          counts.b++;
        },
        () => {
          counts.c++;
        },
      ]);

      await effect();
      const total = counts.a + counts.b + counts.c;
      expect(total).toBe(1);
    });
  });
});
