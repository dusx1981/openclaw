import { describe, it, expect, beforeEach } from "vitest";
import { DegradationTracker } from "./DegradationTracker.js";

describe("DegradationTracker", () => {
  let tracker: DegradationTracker;

  beforeEach(() => {
    tracker = new DegradationTracker();
  });

  describe("recordFallback", () => {
    it("should record fallback events", () => {
      tracker.recordFallback("source-1", "source-2", "product-1");
      tracker.recordFallback("source-1", "source-2", "product-2");

      const events = tracker.getEvents();
      expect(events).toHaveLength(2);
      expect(events[0].fromSource).toBe("source-1");
      expect(events[0].toSource).toBe("source-2");
    });

    it("should track total fallbacks", () => {
      tracker.recordFallback("source-1", "source-2", "product-1");
      tracker.recordFallback("source-2", "source-3", "product-2");

      expect(tracker.getTotalFallbacks()).toBe(2);
    });
  });

  describe("getPaths", () => {
    it("should group fallbacks by path", () => {
      tracker.recordFallback("source-1", "source-2", "product-1");
      tracker.recordFallback("source-1", "source-2", "product-2");
      tracker.recordFallback("source-2", "source-3", "product-3");

      const paths = tracker.getPaths();
      expect(paths).toHaveLength(2);

      const path1 = paths.find((p) => p.path.join("→") === "source-1→source-2");
      expect(path1?.count).toBe(2);

      const path2 = paths.find((p) => p.path.join("→") === "source-2→source-3");
      expect(path2?.count).toBe(1);
    });
  });

  describe("getInfo", () => {
    it("should return complete degradation info", () => {
      tracker.recordFallback("source-1", "source-2", "product-1");

      const info = tracker.getInfo();

      expect(info.totalFallbacks).toBe(1);
      expect(info.paths).toHaveLength(1);
      expect(info.events).toHaveLength(1);
    });
  });

  describe("reset", () => {
    it("should clear all tracking data", () => {
      tracker.recordFallback("source-1", "source-2", "product-1");

      tracker.reset();

      expect(tracker.getTotalFallbacks()).toBe(0);
      expect(tracker.getEvents()).toHaveLength(0);
      expect(tracker.getPaths()).toHaveLength(0);
    });
  });
});
