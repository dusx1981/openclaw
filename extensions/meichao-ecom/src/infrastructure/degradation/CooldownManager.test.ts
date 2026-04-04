import { describe, it, expect, beforeEach } from "vitest";
import type { ClassifiedError, DataSourceFailoverReason } from "../../domain/types.js";
import { CooldownManager } from "./CooldownManager.js";

function createClassifiedError(
  reason: DataSourceFailoverReason,
  message = "Test error",
): ClassifiedError {
  return {
    reason,
    message,
    isSevere: reason === "auth_permanent" || reason === "billing" || reason === "blocked",
    originalError: new Error(message),
  };
}

describe("CooldownManager", () => {
  let manager: CooldownManager;

  beforeEach(() => {
    manager = new CooldownManager();
  });

  describe("isInCooldown", () => {
    it("should return false for sources not in cooldown", () => {
      expect(manager.isInCooldown("source_1")).toBe(false);
    });

    it("should return true after recording failure", () => {
      const error = createClassifiedError("rate_limit");
      manager.recordFailure("source_1", error);

      expect(manager.isInCooldown("source_1")).toBe(true);
    });

    it("should return false after cooldown expires", async () => {
      const error = createClassifiedError("rate_limit");
      manager.recordFailure("source_1", error);

      expect(manager.isInCooldown("source_1")).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 100));
    });
  });

  describe("recordFailure", () => {
    it("should calculate cooldown time for normal errors", () => {
      const error = createClassifiedError("rate_limit");
      manager.recordFailure("source_1", error);

      const state = manager.getCooldownState("source_1");
      expect(state?.errorCount).toBe(1);
      expect(state?.cooldownUntil).toBeDefined();
      expect(state?.lastErrorReason).toBe("rate_limit");
    });

    it("should calculate longer cooldown for severe errors", () => {
      const normalError = createClassifiedError("rate_limit");
      const severeError = createClassifiedError("billing");

      manager.recordFailure("source_1", normalError);
      const normalState = manager.getCooldownState("source_1");

      manager.clearCooldown("source_1");
      manager.recordFailure("source_1", severeError);
      const severeState = manager.getCooldownState("source_1");

      expect(severeState?.cooldownUntil! - Date.now()).toBeGreaterThan(
        normalState?.cooldownUntil! - Date.now(),
      );
    });

    it("should increment error count for subsequent failures", () => {
      const error = createClassifiedError("rate_limit");

      manager.recordFailure("source_1", error);
      expect(manager.getCooldownState("source_1")?.errorCount).toBe(1);

      manager.recordFailure("source_1", error);
      expect(manager.getCooldownState("source_1")?.errorCount).toBe(2);
    });

    it("should NOT extend cooldown window when already in cooldown", () => {
      const error = createClassifiedError("rate_limit");
      manager.recordFailure("source_1", error);

      const firstState = manager.getCooldownState("source_1");
      const firstCooldownUntil = firstState?.cooldownUntil;

      manager.recordFailure("source_1", error);

      const secondState = manager.getCooldownState("source_1");
      expect(secondState?.errorCount).toBe(2);
      expect(secondState?.cooldownUntil).toBe(firstCooldownUntil);
    });
  });

  describe("recordSuccess", () => {
    it("should reset cooldown state on success", () => {
      const error = createClassifiedError("rate_limit");
      manager.recordFailure("source_1", error);

      expect(manager.isInCooldown("source_1")).toBe(true);

      manager.recordSuccess("source_1");

      expect(manager.isInCooldown("source_1")).toBe(false);
      const state = manager.getCooldownState("source_1");
      expect(state?.errorCount).toBe(0);
      expect(state?.cooldownUntil).toBeUndefined();
    });

    it("should track lastSuccessAt", () => {
      const before = Date.now();
      manager.recordSuccess("source_1");
      const after = Date.now();

      const state = manager.getCooldownState("source_1");
      expect(state?.lastSuccessAt).toBeGreaterThanOrEqual(before);
      expect(state?.lastSuccessAt).toBeLessThanOrEqual(after);
    });
  });

  describe("clearCooldown", () => {
    it("should remove cooldown state", () => {
      const error = createClassifiedError("rate_limit");
      manager.recordFailure("source_1", error);

      expect(manager.isInCooldown("source_1")).toBe(true);

      manager.clearCooldown("source_1");

      expect(manager.isInCooldown("source_1")).toBe(false);
      expect(manager.getCooldownState("source_1")).toBeUndefined();
    });
  });

  describe("custom settings", () => {
    it("should use custom normal durations", () => {
      const customManager = new CooldownManager({
        normalDurations: [2, 10, 30],
      });

      const error = createClassifiedError("rate_limit");
      customManager.recordFailure("source_1", error);

      const state = customManager.getCooldownState("source_1");
      expect(state?.cooldownUntil).toBeDefined();
    });

    it("should disable cooldown when enabled is false", () => {
      const disabledManager = new CooldownManager({
        enabled: false,
      });

      const error = createClassifiedError("rate_limit");
      disabledManager.recordFailure("source_1", error);

      expect(disabledManager.isInCooldown("source_1")).toBe(false);
    });
  });

  describe("cooldown time progression", () => {
    it("should increase cooldown time with error count (when cooldown expires)", () => {
      const manager = new CooldownManager();
      const error = createClassifiedError("rate_limit");

      manager.recordFailure("source_1", error);
      let state = manager.getCooldownState("source_1");
      expect(state?.errorCount).toBe(1);
      expect(state?.cooldownUntil! - Date.now()).toBeCloseTo(60000, -2);

      manager.recordFailure("source_1", error);
      state = manager.getCooldownState("source_1");
      expect(state?.errorCount).toBe(2);

      manager.clearCooldown("source_1");
      manager.recordFailure("source_1", error);
      state = manager.getCooldownState("source_1");
      expect(state?.errorCount).toBe(1);
      expect(state?.cooldownUntil! - Date.now()).toBeCloseTo(60000, -2);
    });

    it("should cap at max duration", () => {
      const manager = new CooldownManager();
      const error = createClassifiedError("rate_limit");

      for (let i = 0; i < 10; i++) {
        manager.clearCooldown("source_1");
        manager.recordFailure("source_1", error);
      }

      const state = manager.getCooldownState("source_1");
      expect(state?.errorCount).toBe(1);
    });
  });
});
