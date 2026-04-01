import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DEFAULT_COOLDOWN_SETTINGS } from "../../domain/types.js";
import { InMemoryCooldownManager, calculateCooldownDuration } from "./CooldownManager.js";

describe("CooldownManager", () => {
  let manager: InMemoryCooldownManager;

  beforeEach(() => {
    manager = new InMemoryCooldownManager();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("calculateCooldownDuration", () => {
    it("should calculate 5 minutes for first normal error", () => {
      const duration = calculateCooldownDuration(1, "rate_limit", DEFAULT_COOLDOWN_SETTINGS);
      expect(duration).toBe(5 * 60 * 1000);
    });

    it("should calculate exponential backoff for normal errors", () => {
      const duration3 = calculateCooldownDuration(3, "rate_limit", DEFAULT_COOLDOWN_SETTINGS);
      expect(duration3).toBe(60 * 60 * 1000);
    });

    it("should cap normal error at max (60 minutes)", () => {
      const duration = calculateCooldownDuration(10, "rate_limit", DEFAULT_COOLDOWN_SETTINGS);
      expect(duration).toBe(60 * 60 * 1000);
    });

    it("should calculate severe error cooldown (blocked)", () => {
      const duration = calculateCooldownDuration(1, "blocked", DEFAULT_COOLDOWN_SETTINGS);
      expect(duration).toBe(60 * 60 * 1000);
    });

    it("should cap severe error at max (24 hours)", () => {
      const duration = calculateCooldownDuration(10, "auth_permanent", DEFAULT_COOLDOWN_SETTINGS);
      expect(duration).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe("isInCooldown", () => {
    it("should return false for source with no errors", () => {
      expect(manager.isInCooldown("source1")).toBe(false);
    });

    it("should return true when in cooldown period", () => {
      manager.recordError("source1", "rate_limit");
      expect(manager.isInCooldown("source1")).toBe(true);
    });

    it("should return false after cooldown expires", () => {
      manager.recordError("source1", "rate_limit");
      vi.advanceTimersByTime(6 * 60 * 1000);
      expect(manager.isInCooldown("source1")).toBe(false);
    });
  });

  describe("recordError", () => {
    it("should increment error count and set cooldown", () => {
      manager.recordError("source1", "rate_limit");
      const state = manager.getCooldownState("source1");
      expect(state.errorCount).toBe(1);
      expect(state.cooldownUntil).toBeDefined();
      expect(state.lastErrorReason).toBe("rate_limit");
    });

    it("should increment error count on consecutive errors", () => {
      manager.recordError("source1", "rate_limit");
      manager.recordError("source1", "timeout");
      const state = manager.getCooldownState("source1");
      expect(state.errorCount).toBe(2);
    });
  });

  describe("recordSuccess", () => {
    it("should reset cooldown state on success", () => {
      manager.recordError("source1", "rate_limit");
      manager.recordSuccess("source1");
      const state = manager.getCooldownState("source1");
      expect(state.errorCount).toBe(0);
      expect(state.cooldownUntil).toBeUndefined();
      expect(state.lastSuccessAt).toBeDefined();
    });
  });

  describe("canProbe", () => {
    it("should return true for primary with fallback in cooldown window", () => {
      manager.recordError("source1", "rate_limit");
      vi.advanceTimersByTime(4 * 60 * 1000);
      expect(manager.canProbe("source1", true, true)).toBe(true);
    });

    it("should return false without fallback", () => {
      manager.recordError("source1", "rate_limit");
      vi.advanceTimersByTime(4 * 60 * 1000);
      expect(manager.canProbe("source1", false, true)).toBe(false);
    });

    it("should return false for non-primary source", () => {
      manager.recordError("source1", "rate_limit");
      vi.advanceTimersByTime(4 * 60 * 1000);
      expect(manager.canProbe("source1", true, false)).toBe(false);
    });

    it("should return false if last probe was recent", () => {
      manager.recordError("source1", "rate_limit");
      vi.advanceTimersByTime(4 * 60 * 1000);
      manager.recordProbeAttempt("source1");
      expect(manager.canProbe("source1", true, true)).toBe(false);
    });

    it("should return false if not near cooldown end", () => {
      manager.recordError("source1", "rate_limit");
      expect(manager.canProbe("source1", true, true)).toBe(false);
    });
  });

  describe("getCooldownRemaining", () => {
    it("should return undefined for source not in cooldown", () => {
      expect(manager.getCooldownRemaining("source1")).toBeUndefined();
    });

    it("should return remaining time for source in cooldown", () => {
      manager.recordError("source1", "rate_limit");
      const remaining = manager.getCooldownRemaining("source1");
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(5 * 60 * 1000);
    });
  });

  describe("clear", () => {
    it("should clear specific source", () => {
      manager.recordError("source1", "rate_limit");
      manager.recordError("source2", "timeout");
      manager.clear("source1");
      expect(manager.isInCooldown("source1")).toBe(false);
      expect(manager.isInCooldown("source2")).toBe(true);
    });

    it("should clear all sources", () => {
      manager.recordError("source1", "rate_limit");
      manager.recordError("source2", "timeout");
      manager.clear();
      expect(manager.isInCooldown("source1")).toBe(false);
      expect(manager.isInCooldown("source2")).toBe(false);
    });
  });
});
