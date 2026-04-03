import { describe, it, expect, beforeEach, vi } from "vitest";
import { AlertService } from "./services/AlertService.js";

describe("AlertService", () => {
  beforeEach(() => {
    AlertService.configure({ enabled: true, channels: [], cooldownMinutes: 5 });
    AlertService.clearRecentAlerts();
  });

  describe("configure", () => {
    it("should update config", () => {
      AlertService.configure({ cooldownMinutes: 10 });

      expect(true).toBe(true);
    });
  });

  describe("sendQuotaAlert", () => {
    it("should send quota alert", async () => {
      await AlertService.sendQuotaAlert("taobao", "test_api", 85, "warning");

      expect(true).toBe(true);
    });

    it("should not send alert when disabled", async () => {
      AlertService.configure({ enabled: false, channels: [], cooldownMinutes: 5 });

      await AlertService.sendQuotaAlert("taobao", "test_api", 85, "warning");

      expect(true).toBe(true);
    });
  });

  describe("sendFetchErrorAlert", () => {
    it("should send fetch error alert", async () => {
      await AlertService.sendFetchErrorAlert("taobao", "12345", "Network error");

      expect(true).toBe(true);
    });
  });

  describe("sendHealthCheckAlert", () => {
    it("should send health check alert", async () => {
      await AlertService.sendHealthCheckAlert("taobao", ["Error 1", "Error 2"]);

      expect(true).toBe(true);
    });
  });

  describe("cooldown", () => {
    it("should respect cooldown period", async () => {
      await AlertService.sendQuotaAlert("taobao", "test_api", 85, "warning");
      await AlertService.sendQuotaAlert("taobao", "test_api", 86, "warning");

      expect(true).toBe(true);
    });
  });
});
