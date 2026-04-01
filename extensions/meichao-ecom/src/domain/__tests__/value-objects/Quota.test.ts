import { describe, it, expect } from "vitest";
import { Quota } from "../../value-objects/Quota.js";
import type { QuotaData } from "../../value-objects/Quota.js";

function createValidQuotaData(overrides: Partial<QuotaData> = {}): QuotaData {
  return {
    sourceId: "taobao_official_api",
    platform: "taobao",
    used: 0,
    total: 100,
    ...overrides,
  };
}

describe("Quota", () => {
  describe("create", () => {
    it("should create quota with valid data", () => {
      const data = createValidQuotaData();
      const quota = Quota.create(data);

      expect(quota.sourceId).toBe("taobao_official_api");
      expect(quota.platform).toBe("taobao");
      expect(quota.total).toBe(100);
      expect(quota.used).toBe(0);
    });

    it("should throw error if sourceId is missing", () => {
      const data = createValidQuotaData({ sourceId: "" });
      expect(() => Quota.create(data)).toThrow("Source ID is required");
    });

    it("should throw error if platform is missing", () => {
      const data = createValidQuotaData({ platform: "" as any });
      expect(() => Quota.create(data)).toThrow("Platform is required");
    });

    it("should throw error if total is zero", () => {
      const data = createValidQuotaData({ total: 0 });
      expect(() => Quota.create(data)).toThrow("Total quota must be positive");
    });

    it("should throw error if total is negative", () => {
      const data = createValidQuotaData({ total: -1 });
      expect(() => Quota.create(data)).toThrow("Total quota must be positive");
    });

    it("should throw error if used is negative", () => {
      const data = createValidQuotaData({ used: -1 });
      expect(() => Quota.create(data)).toThrow("Used quota cannot be negative");
    });

    it("should throw error if used exceeds total", () => {
      const data = createValidQuotaData({ used: 150, total: 100 });
      expect(() => Quota.create(data)).toThrow("Used quota cannot exceed total quota");
    });
  });

  describe("remaining", () => {
    it("should return remaining quota", () => {
      const quota = Quota.create(createValidQuotaData({ used: 30, total: 100 }));
      expect(quota.remaining()).toBe(70);
    });

    it("should return 0 if exhausted", () => {
      const quota = Quota.create(createValidQuotaData({ used: 100, total: 100 }));
      expect(quota.remaining()).toBe(0);
    });
  });

  describe("percentUsed", () => {
    it("should return percent used", () => {
      const quota = Quota.create(createValidQuotaData({ used: 50, total: 100 }));
      expect(quota.percentUsed()).toBe(50);
    });

    it("should return 100 if exhausted", () => {
      const quota = Quota.create(createValidQuotaData({ used: 100, total: 100 }));
      expect(quota.percentUsed()).toBe(100);
    });

    it("should return 0 if not used", () => {
      const quota = Quota.create(createValidQuotaData({ used: 0, total: 100 }));
      expect(quota.percentUsed()).toBe(0);
    });
  });

  describe("isOverLimit", () => {
    it("should return true if at limit", () => {
      const quota = Quota.create(createValidQuotaData({ used: 100, total: 100 }));
      expect(quota.isOverLimit()).toBe(true);
    });

    it("should return false if under limit", () => {
      const quota = Quota.create(createValidQuotaData({ used: 99, total: 100 }));
      expect(quota.isOverLimit()).toBe(false);
    });
  });

  describe("isNearLimit", () => {
    it("should return true if near limit (default 80%)", () => {
      const quota = Quota.create(createValidQuotaData({ used: 80, total: 100 }));
      expect(quota.isNearLimit()).toBe(true);
    });

    it("should return false if not near limit", () => {
      const quota = Quota.create(createValidQuotaData({ used: 79, total: 100 }));
      expect(quota.isNearLimit()).toBe(false);
    });

    it("should use custom threshold", () => {
      const quota = Quota.create(createValidQuotaData({ used: 70, total: 100 }));
      expect(quota.isNearLimit(70)).toBe(true);
      expect(quota.isNearLimit(80)).toBe(false);
    });
  });

  describe("canUse", () => {
    it("should return true if can use", () => {
      const quota = Quota.create(createValidQuotaData({ used: 50, total: 100 }));
      expect(quota.canUse(10)).toBe(true);
    });

    it("should return false if cannot use", () => {
      const quota = Quota.create(createValidQuotaData({ used: 95, total: 100 }));
      expect(quota.canUse(10)).toBe(false);
    });

    it("should use default amount of 1", () => {
      const quota = Quota.create(createValidQuotaData({ used: 99, total: 100 }));
      expect(quota.canUse()).toBe(true);
    });
  });

  describe("increment", () => {
    it("should increment used quota", () => {
      const quota = Quota.create(createValidQuotaData());
      const updated = quota.increment();

      expect(updated.used).toBe(1);
    });

    it("should increment by custom amount", () => {
      const quota = Quota.create(createValidQuotaData());
      const updated = quota.increment(5);

      expect(updated.used).toBe(5);
    });

    it("should not exceed total", () => {
      const quota = Quota.create(createValidQuotaData());
      const updated = quota.increment(150);

      expect(updated.used).toBe(100);
    });
  });

  describe("reset", () => {
    it("should reset used to zero", () => {
      const quota = Quota.create(createValidQuotaData({ used: 50 }));
      const updated = quota.reset();

      expect(updated.used).toBe(0);
    });
  });

  describe("toJSON", () => {
    it("should include computed fields", () => {
      const quota = Quota.create(createValidQuotaData({ used: 80, total: 100 }));
      const json = quota.toJSON();

      expect(json.remaining).toBe(20);
      expect(json.percentUsed).toBe(80);
      expect(json.isOverLimit).toBe(false);
      expect(json.isNearLimit).toBe(true);
    });
  });
});
