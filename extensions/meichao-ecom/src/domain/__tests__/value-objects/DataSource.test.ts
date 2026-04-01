import { describe, it, expect } from "vitest";
import { DataSource } from "../../value-objects/DataSource.js";
import type { DataSourceData } from "../../value-objects/DataSource.js";

function createValidDataSourceData(overrides: Partial<DataSourceData> = {}): DataSourceData {
  return {
    id: "taobao_official_api",
    platform: "taobao",
    type: "official_api",
    priority: 1,
    costPerCall: 0,
    dailyQuota: 100,
    usedQuota: 0,
    isAvailable: true,
    ...overrides,
  };
}

describe("DataSource", () => {
  describe("create", () => {
    it("should create data source with valid data", () => {
      const data = createValidDataSourceData();
      const source = DataSource.create(data);

      expect(source.id).toBe("taobao_official_api");
      expect(source.platform).toBe("taobao");
      expect(source.type).toBe("official_api");
      expect(source.priority).toBe(1);
      expect(source.costPerCall).toBe(0);
      expect(source.dailyQuota).toBe(100);
      expect(source.usedQuota).toBe(0);
      expect(source.isAvailable).toBe(true);
    });

    it("should throw error if id is missing", () => {
      const data = createValidDataSourceData({ id: "" });
      expect(() => DataSource.create(data)).toThrow("DataSource ID is required");
    });

    it("should throw error if platform is missing", () => {
      const data = createValidDataSourceData({ platform: "" as any });
      expect(() => DataSource.create(data)).toThrow("Platform is required");
    });

    it("should throw error if type is missing", () => {
      const data = createValidDataSourceData({ type: "" as any });
      expect(() => DataSource.create(data)).toThrow("DataSource type is required");
    });

    it("should throw error if priority is negative", () => {
      const data = createValidDataSourceData({ priority: -1 });
      expect(() => DataSource.create(data)).toThrow("Priority cannot be negative");
    });

    it("should throw error if costPerCall is negative", () => {
      const data = createValidDataSourceData({ costPerCall: -1 });
      expect(() => DataSource.create(data)).toThrow("Cost per call cannot be negative");
    });

    it("should throw error if dailyQuota is zero", () => {
      const data = createValidDataSourceData({ dailyQuota: 0 });
      expect(() => DataSource.create(data)).toThrow("Daily quota must be positive");
    });

    it("should throw error if usedQuota is negative", () => {
      const data = createValidDataSourceData({ usedQuota: -1 });
      expect(() => DataSource.create(data)).toThrow("Used quota cannot be negative");
    });
  });

  describe("hasRemainingQuota", () => {
    it("should return true if quota remaining", () => {
      const source = DataSource.create(
        createValidDataSourceData({ usedQuota: 50, dailyQuota: 100 }),
      );
      expect(source.hasRemainingQuota()).toBe(true);
    });

    it("should return false if quota exhausted", () => {
      const source = DataSource.create(
        createValidDataSourceData({ usedQuota: 100, dailyQuota: 100 }),
      );
      expect(source.hasRemainingQuota()).toBe(false);
    });

    it("should return true if under quota", () => {
      const source = DataSource.create(
        createValidDataSourceData({ usedQuota: 99, dailyQuota: 100 }),
      );
      expect(source.hasRemainingQuota()).toBe(true);
    });
  });

  describe("remainingQuota", () => {
    it("should return remaining quota", () => {
      const source = DataSource.create(
        createValidDataSourceData({ usedQuota: 30, dailyQuota: 100 }),
      );
      expect(source.remainingQuota()).toBe(70);
    });

    it("should return 0 if exhausted", () => {
      const source = DataSource.create(
        createValidDataSourceData({ usedQuota: 100, dailyQuota: 100 }),
      );
      expect(source.remainingQuota()).toBe(0);
    });
  });

  describe("quotaPercentUsed", () => {
    it("should return percent used", () => {
      const source = DataSource.create(
        createValidDataSourceData({ usedQuota: 50, dailyQuota: 100 }),
      );
      expect(source.quotaPercentUsed()).toBe(50);
    });

    it("should return 100 if exhausted", () => {
      const source = DataSource.create(
        createValidDataSourceData({ usedQuota: 100, dailyQuota: 100 }),
      );
      expect(source.quotaPercentUsed()).toBe(100);
    });
  });

  describe("incrementUsage", () => {
    it("should increment used quota", () => {
      const source = DataSource.create(createValidDataSourceData());
      const updated = source.incrementUsage();

      expect(updated.usedQuota).toBe(1);
    });

    it("should increment by custom amount", () => {
      const source = DataSource.create(createValidDataSourceData());
      const updated = source.incrementUsage(5);

      expect(updated.usedQuota).toBe(5);
    });

    it("should not exceed daily quota", () => {
      const source = DataSource.create(createValidDataSourceData({ dailyQuota: 100 }));
      const updated = source.incrementUsage(150);

      expect(updated.usedQuota).toBe(100);
    });
  });

  describe("markUnavailable", () => {
    it("should mark as unavailable", () => {
      const source = DataSource.create(createValidDataSourceData());
      const updated = source.markUnavailable("Connection timeout");

      expect(updated.isAvailable).toBe(false);
      expect(updated.lastError).toBe("Connection timeout");
    });
  });

  describe("markAvailable", () => {
    it("should mark as available", () => {
      const source = DataSource.create(createValidDataSourceData({ isAvailable: false }));
      const updated = source.markAvailable();

      expect(updated.isAvailable).toBe(true);
      expect(updated.lastError).toBeUndefined();
      expect(updated.lastSuccessAt).toBeDefined();
    });
  });

  describe("resetQuota", () => {
    it("should reset used quota to zero", () => {
      const source = DataSource.create(createValidDataSourceData({ usedQuota: 50 }));
      const updated = source.resetQuota();

      expect(updated.usedQuota).toBe(0);
    });
  });
});
