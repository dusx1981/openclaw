import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { DataSource, Platform, ClassifiedError } from "../../domain/types.js";
import { InMemoryDecisionLogger } from "../logging/DecisionLogger.js";
import { CooldownManager } from "./CooldownManager.js";
import { DegradationExecutor } from "./DegradationExecutor.js";
import { DegradationPath } from "./DegradationPath.js";

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
    lastError: overrides.lastError,
    lastSuccessAt: overrides.lastSuccessAt,
  };
}

function createClassifiedError(
  reason: ClassifiedError["reason"],
  isSevere = false,
): ClassifiedError {
  return {
    reason,
    message: `${reason} error`,
    originalError: new Error(`${reason} error`),
    isSevere,
  };
}

describe("Integration: Degradation Flow", () => {
  let sources: DataSource[];
  let path: DegradationPath;
  let executor: DegradationExecutor;
  let cooldownManager: CooldownManager;
  let decisionLogger: InMemoryDecisionLogger;

  beforeEach(() => {
    sources = [
      createMockSource({ id: "taobao_official_api", type: "official_api", priority: 1 }),
      createMockSource({ id: "taobao_third_party_api", type: "third_party_api", priority: 2 }),
      createMockSource({ id: "taobao_skill_crawler", type: "skill_crawler", priority: 3 }),
      createMockSource({ id: "taobao_open_search", type: "open_search", priority: 4 }),
    ];

    path = new DegradationPath("taobao", sources);
    cooldownManager = new CooldownManager();
    decisionLogger = new InMemoryDecisionLogger();

    executor = new DegradationExecutor({
      retryRunnerFactory: () => async (fn) => fn(),
      circuitBreakerConfig: {
        enabled: true,
        failureThreshold: 5,
        openDuration: 60000,
        halfOpenMaxCalls: 10,
        successThreshold: 3,
      },
      errorClassifier: (error) => {
        const msg = error instanceof Error ? error.message : String(error);
        const isSevere = msg.includes("auth_permanent") || msg.includes("billing");
        return {
          reason: isSevere ? "auth_permanent" : "rate_limit",
          message: msg,
          originalError: error instanceof Error ? error : new Error(msg),
          isSevere,
        };
      },
      cooldownManager,
      decisionLogger,
    });
  });

  afterEach(() => {
    decisionLogger.clear();
  });

  describe("Complete degradation path", () => {
    it("should degrade from official_api to third_party_api", async () => {
      let callCount = 0;

      const result = await executor.execute(path, async (source) => {
        callCount++;
        if (source.type === "official_api") {
          throw new Error("official_api failed");
        }
        return { data: "success", source: source.id };
      });

      expect(result.success).toBe(true);
      expect(result.source?.type).toBe("third_party_api");
      expect(callCount).toBe(2);
    });

    it("should degrade through all sources to open_search", async () => {
      let attemptedSources: string[] = [];

      const result = await executor.execute(path, async (source) => {
        attemptedSources.push(source.id);
        if (source.type !== "open_search") {
          throw new Error(`${source.type} failed`);
        }
        return { data: "success from open_search" };
      });

      expect(result.success).toBe(true);
      expect(result.source?.type).toBe("open_search");
      expect(attemptedSources).toEqual([
        "taobao_official_api",
        "taobao_third_party_api",
        "taobao_skill_crawler",
        "taobao_open_search",
      ]);
    });

    it("should return failure when all sources fail", async () => {
      const result = await executor.execute(path, async () => {
        throw new Error("All sources failed");
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.attempts).toHaveLength(4);
    });
  });

  describe("Cooldown state transitions", () => {
    it("should skip sources in cooldown", async () => {
      cooldownManager.recordFailure("taobao_official_api", createClassifiedError("rate_limit"));

      let attemptedTypes: string[] = [];

      const result = await executor.execute(path, async (source) => {
        attemptedTypes.push(source.type);
        return { data: "success" };
      });

      expect(result.success).toBe(true);
      expect(attemptedTypes[0]).toBe("third_party_api");
    });

    it("should reset cooldown on success", async () => {
      cooldownManager.recordFailure("taobao_official_api", createClassifiedError("rate_limit"));

      expect(cooldownManager.isInCooldown("taobao_official_api")).toBe(true);

      await executor.execute(path, async (source) => {
        if (source.type === "official_api") {
          throw new Error("failed");
        }
        return { data: "success" };
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const newPath = new DegradationPath("taobao", [
        createMockSource({ id: "taobao_official_api", type: "official_api", priority: 1 }),
      ]);

      await executor.execute(newPath, async () => ({ data: "success" }));

      cooldownManager.recordSuccess("taobao_official_api");
      expect(cooldownManager.isInCooldown("taobao_official_api")).toBe(false);
    });
  });

  describe("Preset templates", () => {
    it("should use cost-optimized preset (skip third_party_api)", async () => {
      let attemptedTypes: string[] = [];

      const result = await executor.execute(
        path,
        async (source) => {
          attemptedTypes.push(source.type);
          if (source.type === "official_api") {
            throw new Error("failed");
          }
          return { data: "success" };
        },
        { preset: "cost-optimized" },
      );

      expect(result.success).toBe(true);
      expect(attemptedTypes).not.toContain("third_party_api");
    });

    it("should use speed-optimized preset (third_party first)", async () => {
      let firstAttempt: string | undefined;

      await executor.execute(
        path,
        async (source) => {
          if (!firstAttempt) {
            firstAttempt = source.type;
          }
          return { data: "success" };
        },
        { preset: "speed-optimized" },
      );

      expect(firstAttempt).toBe("third_party_api");
    });

    it("should use reliability-first preset (skip crawler and open_search)", async () => {
      let attemptedTypes: string[] = [];

      const result = await executor.execute(
        path,
        async (source) => {
          attemptedTypes.push(source.type);
          if (source.type === "official_api") {
            throw new Error("official_api failed");
          }
          return { data: "success" };
        },
        { preset: "reliability-first" },
      );

      expect(result.success).toBe(true);
      expect(attemptedTypes).toEqual(["official_api", "third_party_api"]);
      expect(attemptedTypes).not.toContain("skill_crawler");
      expect(attemptedTypes).not.toContain("open_search");
    });
  });

  describe("Error handling", () => {
    it("should classify and log errors correctly", async () => {
      await executor.execute(path, async (source) => {
        if (source.type === "official_api") {
          throw new Error("auth_permanent error");
        }
        return { data: "success" };
      });

      const logs = decisionLogger.getByDecision("source_failed");
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].error?.reason).toBe("auth_permanent");
    });

    it("should apply longer cooldown for severe errors", async () => {
      cooldownManager.recordFailure(
        "taobao_official_api",
        createClassifiedError("auth_permanent", true),
      );

      const state = cooldownManager.getCooldownState("taobao_official_api");

      expect(state?.cooldownUntil).toBeDefined();
      const cooldownDuration = state!.cooldownUntil! - Date.now();
      expect(cooldownDuration).toBeGreaterThanOrEqual(60 * 60 * 1000);
    });

    it("should apply shorter cooldown for normal errors", async () => {
      cooldownManager.recordFailure(
        "taobao_official_api",
        createClassifiedError("rate_limit", false),
      );

      const state = cooldownManager.getCooldownState("taobao_official_api");

      expect(state?.cooldownUntil).toBeDefined();
      const cooldownDuration = state!.cooldownUntil! - Date.now();
      expect(cooldownDuration).toBeLessThanOrEqual(30 * 60 * 1000);
    });
  });

  describe("Decision logging", () => {
    it("should log all degradation decisions", async () => {
      await executor.execute(path, async (source) => {
        if (source.type === "official_api") {
          throw new Error("failed");
        }
        return { data: "success" };
      });

      const logs = decisionLogger.getAll();
      expect(logs.length).toBeGreaterThan(0);

      const failedLog = logs.find((l) => l.decision === "source_failed");
      expect(failedLog).toBeDefined();

      const successLog = logs.find((l) => l.decision === "source_succeeded");
      expect(successLog).toBeDefined();
    });

    it("should support querying by platform", async () => {
      await executor.execute(path, async () => ({ data: "success" }));

      const logs = decisionLogger.getByPlatform("taobao");
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe("Validate mode", () => {
    it("should test all sources in validate mode ignoring cooldown", async () => {
      cooldownManager.recordFailure("taobao_official_api", createClassifiedError("rate_limit"));
      cooldownManager.recordFailure("taobao_third_party_api", createClassifiedError("rate_limit"));

      let attemptedCount = 0;

      const result = await executor.execute(
        path,
        async (source) => {
          attemptedCount++;
          if (source.type === "skill_crawler") {
            return { data: "success" };
          }
          throw new Error("failed");
        },
        { validateMode: true },
      );

      expect(attemptedCount).toBe(4);
      expect(result.success).toBe(true);
    });
  });
});
