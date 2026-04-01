import { describe, it, expect, vi, beforeEach } from "vitest";
import { DegradationDecisionLog } from "../../domain/types.js";
import { InMemoryDecisionLogger } from "./DecisionLogger.js";

describe("DecisionLogger", () => {
  let logger: InMemoryDecisionLogger;

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    logger = new InMemoryDecisionLogger();
  });

  const createLog = (overrides: Partial<DegradationDecisionLog> = {}): DegradationDecisionLog => ({
    event: "degradation_decision",
    decision: "source_failed",
    runId: "run-1",
    timestamp: Date.now(),
    platform: "taobao",
    productId: "item-1",
    source: { id: "source1", type: "official_api", priority: 1 },
    latencyMs: 100,
    ...overrides,
  });

  describe("log()", () => {
    it("should store log entry", () => {
      const log = createLog();
      logger.log(log);
      expect(logger.getByRunId("run-1")).toHaveLength(1);
    });

    it("should output structured JSON to console", () => {
      const log = createLog();
      logger.log(log);
      expect(console.log).toHaveBeenCalledWith(JSON.stringify(log));
    });

    it("should trim logs when exceeding max size", () => {
      const smallLogger = new InMemoryDecisionLogger(5);
      for (let i = 0; i < 10; i++) {
        smallLogger.log(createLog({ runId: `run-${i}` }));
      }
      expect(smallLogger.getAll()).toHaveLength(5);
    });
  });

  describe("getByRunId()", () => {
    it("should return logs matching runId", () => {
      logger.log(createLog({ runId: "run-1" }));
      logger.log(createLog({ runId: "run-1" }));
      logger.log(createLog({ runId: "run-2" }));

      const logs = logger.getByRunId("run-1");
      expect(logs).toHaveLength(2);
    });

    it("should return empty array for unknown runId", () => {
      const logs = logger.getByRunId("unknown");
      expect(logs).toEqual([]);
    });
  });

  describe("getRecent()", () => {
    it("should return most recent logs", () => {
      for (let i = 0; i < 10; i++) {
        logger.log(createLog({ runId: `run-${i}` }));
      }
      const logs = logger.getRecent(3);
      expect(logs).toHaveLength(3);
      expect(logs[0].runId).toBe("run-7");
      expect(logs[2].runId).toBe("run-9");
    });
  });

  describe("clear()", () => {
    it("should remove all logs", () => {
      logger.log(createLog());
      logger.log(createLog());
      logger.clear();
      expect(logger.getAll()).toHaveLength(0);
    });
  });

  describe("getByDecision()", () => {
    it("should filter by decision type", () => {
      logger.log(createLog({ decision: "source_failed" }));
      logger.log(createLog({ decision: "circuit_open" }));
      logger.log(createLog({ decision: "source_failed" }));

      const logs = logger.getByDecision("source_failed");
      expect(logs).toHaveLength(2);
    });
  });

  describe("getByPlatform()", () => {
    it("should filter by platform", () => {
      logger.log(createLog({ platform: "taobao" }));
      logger.log(createLog({ platform: "amazon" }));
      logger.log(createLog({ platform: "taobao" }));

      const logs = logger.getByPlatform("taobao");
      expect(logs).toHaveLength(2);
    });
  });

  describe("getStats()", () => {
    it("should return statistics", () => {
      logger.log(createLog({ decision: "source_failed", platform: "taobao" }));
      logger.log(createLog({ decision: "circuit_open", platform: "taobao" }));
      logger.log(createLog({ decision: "source_failed", platform: "amazon" }));

      const stats = logger.getStats();
      expect(stats.total).toBe(3);
      expect(stats.byDecision["source_failed"]).toBe(2);
      expect(stats.byPlatform["taobao"]).toBe(2);
    });
  });
});
