import { describe, it, expect, beforeEach, vi } from "vitest";
import type { DataSource, Platform } from "../../../domain/types.js";
import { CooldownManager } from "./CooldownManager.js";
import { DegradationExecutor } from "./DegradationExecutor.js";
import { DegradationPath } from "./DegradationPath.js";
import type { ClassifiedError, DecisionLogger } from "./types.js";

function createMockSource(overrides: Partial<DataSource>): DataSource {
  return {
    id: overrides.id || "test_source",
    platform: overrides.platform || "taobao",
    type: overrides.type || "official_api",
    priority: overrides.priority ?? 1,
    costPerCall: overrides.costPerCall ?? 0,
    dailyQuota: overrides.dailyQuota ?? 1000,
    usedQuota: overrides.usedQuota ?? 0,
    isAvailable: overrides.isAvailable ?? true,
  };
}

function createMockLogger(): DecisionLogger {
  const logs: any[] = [];
  return {
    log: (entry: any) => logs.push(entry),
    getByRunId: (runId: string) => logs.filter((l) => l.runId === runId),
    getRecent: (limit: number) => logs.slice(-limit),
    clear: () => (logs.length = 0),
  };
}

function createMockClassifier(): (error: unknown, platform: Platform) => ClassifiedError {
  return (error: unknown, _platform: Platform) => {
    const message = error instanceof Error ? error.message : String(error);
    let reason: any = "unknown";

    if (message.includes("rate limit")) reason = "rate_limit";
    else if (message.includes("timeout")) reason = "timeout";
    else if (message.includes("billing")) reason = "billing";
    else if (message.includes("blocked")) reason = "blocked";

    return {
      reason,
      message,
      isSevere: reason === "billing" || reason === "blocked",
      originalError: error instanceof Error ? error : new Error(message),
    };
  };
}

describe("DegradationExecutor", () => {
  let executor: DegradationExecutor;
  let path: DegradationPath;
  let sources: DataSource[];
  let cooldownManager: CooldownManager;
  let logger: DecisionLogger;

  beforeEach(() => {
    sources = [
      createMockSource({ id: "taobao_official_api", type: "official_api" }),
      createMockSource({ id: "taobao_third_party_api", type: "third_party_api" }),
      createMockSource({ id: "taobao_skill_crawler", type: "skill_crawler" }),
    ];

    path = new DegradationPath("taobao", sources);
    cooldownManager = new CooldownManager();
    logger = createMockLogger();

    executor = new DegradationExecutor({
      retryRunnerFactory: () => async (fn) => fn(),
      circuitBreakerConfig: {
        enabled: true,
        failureThreshold: 5,
        openDuration: 60000,
        halfOpenMaxCalls: 10,
        successThreshold: 3,
      },
      errorClassifier: createMockClassifier(),
      cooldownManager,
      decisionLogger: logger,
    });
  });

  describe("successful execution", () => {
    it("should succeed with first source", async () => {
      const result = await executor.execute(path, async () => ({ data: "test" }));

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ data: "test" });
      expect(result.source?.id).toBe("taobao_official_api");
    });

    it("should record success in cooldown manager", async () => {
      await executor.execute(path, async () => "success");

      expect(cooldownManager.isInCooldown("taobao_official_api")).toBe(false);
    });

    it("should log decision", async () => {
      await executor.execute(path, async () => "success");

      const recent = logger.getRecent(1);
      expect(recent[0].decision).toBe("source_succeeded");
    });
  });

  describe("degradation", () => {
    it("should fallback to next source on failure", async () => {
      let callCount = 0;

      const result = await executor.execute(path, async (source) => {
        callCount++;
        if (source.type === "official_api") {
          throw new Error("rate limit exceeded");
        }
        return { data: "success" };
      });

      expect(result.success).toBe(true);
      expect(result.source?.type).toBe("third_party_api");
      expect(callCount).toBe(2);
    });

    it("should record failures in cooldown manager", async () => {
      await executor.execute(path, async (source) => {
        if (source.type === "official_api") {
          throw new Error("rate limit exceeded");
        }
        return "success";
      });

      expect(cooldownManager.isInCooldown("taobao_official_api")).toBe(true);
    });
  });

  describe("all sources fail", () => {
    it("should return failure when all sources fail", async () => {
      const result = await executor.execute(path, async () => {
        throw new Error("All failed");
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.attempts).toHaveLength(3);
    });

    it("should record all failures", async () => {
      await executor.execute(path, async () => {
        throw new Error("Failed");
      });

      const recent = logger.getRecent(10);
      const failures = recent.filter((l) => l.decision === "source_failed");
      expect(failures).toHaveLength(3);
    });
  });

  describe("cooldown skip", () => {
    it("should skip source in cooldown", async () => {
      const error = {
        reason: "rate_limit" as any,
        message: "Rate limit",
        isSevere: false,
        originalError: new Error("Rate limit"),
      };
      cooldownManager.recordFailure("taobao_official_api", error);

      const calledSources: string[] = [];
      await executor.execute(path, async (source) => {
        calledSources.push(source.id);
        return "success";
      });

      expect(calledSources).not.toContain("taobao_official_api");
      expect(calledSources[0]).toBe("taobao_third_party_api");
    });
  });

  describe("validateMode", () => {
    it("should test all sources in validateMode", async () => {
      const calledSources: string[] = [];

      const result = await executor.execute(
        path,
        async (source) => {
          calledSources.push(source.id);
          if (source.type === "skill_crawler") {
            throw new Error("Failed");
          }
          return "success";
        },
        { validateMode: true },
      );

      expect(calledSources).toHaveLength(3);
      expect(result.attempts).toHaveLength(3);
    });

    it("should ignore cooldown in validateMode", async () => {
      const error = {
        reason: "rate_limit" as any,
        message: "Rate limit",
        isSevere: false,
        originalError: new Error("Rate limit"),
      };
      cooldownManager.recordFailure("taobao_official_api", error);

      const calledSources: string[] = [];
      await executor.execute(
        path,
        async (source) => {
          calledSources.push(source.id);
          return "success";
        },
        { validateMode: true },
      );

      expect(calledSources).toContain("taobao_official_api");
    });
  });

  describe("error classification", () => {
    it("should classify errors correctly", async () => {
      await executor.execute(path, async (source) => {
        if (source.type === "official_api") {
          throw new Error("billing error");
        }
        return "success";
      });

      const state = cooldownManager.getCooldownState("taobao_official_api");
      expect(state?.lastErrorReason).toBe("billing");
    });
  });
});
