import { describe, it, expect, beforeEach } from "vitest";
import { DataSource } from "../../domain/value-objects/DataSource.js";
import { QuotaService } from "../services/QuotaService.js";

describe("QuotaService", () => {
  beforeEach(() => {
    QuotaService.resetDailyQuotas();
  });

  describe("registerDataSource", () => {
    it("should register a data source", () => {
      const ds = DataSource.create({
        id: "test_api",
        platform: "taobao",
        type: "official_api",
        priority: 1,
        costPerCall: 0,
        dailyQuota: 100,
        usedQuota: 0,
        isAvailable: true,
      });

      QuotaService.registerDataSource(ds);

      const status = QuotaService.getQuotaStatus("test_api");
      expect(status).not.toBeNull();
      expect(status?.sourceId).toBe("test_api");
    });
  });

  describe("getQuotaStatus", () => {
    it("should return null for unregistered source", () => {
      const status = QuotaService.getQuotaStatus("nonexistent");
      expect(status).toBeNull();
    });

    it("should return correct quota status", () => {
      const ds = DataSource.create({
        id: "test_api",
        platform: "taobao",
        type: "official_api",
        priority: 1,
        costPerCall: 0,
        dailyQuota: 100,
        usedQuota: 50,
        isAvailable: true,
      });

      QuotaService.registerDataSource(ds);

      const status = QuotaService.getQuotaStatus("test_api");

      expect(status?.used).toBe(50);
      expect(status?.total).toBe(100);
      expect(status?.remaining).toBe(50);
      expect(status?.percentUsed).toBe(50);
      expect(status?.isOverBudget).toBe(false);
    });
  });

  describe("incrementUsage", () => {
    it("should increment usage", () => {
      const ds = DataSource.create({
        id: "test_api",
        platform: "taobao",
        type: "official_api",
        priority: 1,
        costPerCall: 0,
        dailyQuota: 100,
        usedQuota: 0,
        isAvailable: true,
      });

      QuotaService.registerDataSource(ds);
      QuotaService.incrementUsage("test_api", 5);

      const status = QuotaService.getQuotaStatus("test_api");
      expect(status?.used).toBe(5);
    });

    it("should return false for unregistered source", () => {
      const result = QuotaService.incrementUsage("nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("checkAlerts", () => {
    it("should return warning alert at 80%", () => {
      const ds = DataSource.create({
        id: "test_api",
        platform: "taobao",
        type: "official_api",
        priority: 1,
        costPerCall: 0,
        dailyQuota: 100,
        usedQuota: 80,
        isAvailable: true,
      });

      QuotaService.registerDataSource(ds);

      const alerts = QuotaService.checkAlerts();

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].severity).toBe("warning");
    });

    it("should return critical alert at 95%", () => {
      const ds = DataSource.create({
        id: "test_api",
        platform: "taobao",
        type: "official_api",
        priority: 1,
        costPerCall: 0,
        dailyQuota: 100,
        usedQuota: 95,
        isAvailable: true,
      });

      QuotaService.registerDataSource(ds);

      const alerts = QuotaService.checkAlerts();

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].severity).toBe("critical");
    });
  });

  describe("resetDailyQuotas", () => {
    it("should reset all quotas", () => {
      const ds = DataSource.create({
        id: "test_api",
        platform: "taobao",
        type: "official_api",
        priority: 1,
        costPerCall: 0,
        dailyQuota: 100,
        usedQuota: 50,
        isAvailable: true,
      });

      QuotaService.registerDataSource(ds);
      QuotaService.resetDailyQuotas();

      const status = QuotaService.getQuotaStatus("test_api");
      expect(status?.used).toBe(0);
    });
  });
});
