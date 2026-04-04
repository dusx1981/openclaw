import { describe, it, expect, beforeEach } from "vitest";
import type { DataSource, Platform } from "../../domain/types.js";
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

describe("DegradationPath", () => {
  let sources: DataSource[];

  beforeEach(() => {
    sources = [
      createMockSource({ id: "taobao_official_api", type: "official_api", priority: 1 }),
      createMockSource({ id: "taobao_third_party_api", type: "third_party_api", priority: 2 }),
      createMockSource({ id: "taobao_skill_crawler", type: "skill_crawler", priority: 3 }),
      createMockSource({ id: "taobao_open_search", type: "open_search", priority: 4 }),
    ];
  });

  describe("default path", () => {
    it("should return sources in CORE_ORDER by default", () => {
      const path = new DegradationPath("taobao", sources);
      const result = path.getPath();

      expect(result).toHaveLength(4);
      expect(result[0].type).toBe("official_api");
      expect(result[1].type).toBe("third_party_api");
      expect(result[2].type).toBe("skill_crawler");
      expect(result[3].type).toBe("open_search");
    });

    it("should skip unavailable sources", () => {
      sources[0].isAvailable = false;
      const path = new DegradationPath("taobao", sources);
      const result = path.getPath();

      expect(result).toHaveLength(3);
      expect(result[0].type).toBe("third_party_api");
    });

    it("should skip sources without remaining quota", () => {
      sources[1].usedQuota = sources[1].dailyQuota;
      const path = new DegradationPath("taobao", sources);
      const result = path.getPath();

      expect(result).toHaveLength(3);
      expect(result.find((s) => s.type === "third_party_api")).toBeUndefined();
    });
  });

  describe("preset templates", () => {
    it("should use cost-optimized preset", () => {
      const path = new DegradationPath("taobao", sources);
      const result = path.getPath({ preset: "cost-optimized" });

      expect(result).toHaveLength(3);
      expect(result.find((s) => s.type === "third_party_api")).toBeUndefined();
    });

    it("should use speed-optimized preset", () => {
      const path = new DegradationPath("taobao", sources);
      const result = path.getPath({ preset: "speed-optimized" });

      expect(result).toHaveLength(3);
      expect(result[0].type).toBe("third_party_api");
      expect(result[1].type).toBe("official_api");
    });

    it("should use reliability-first preset", () => {
      const path = new DegradationPath("taobao", sources);
      const result = path.getPath({ preset: "reliability-first" });

      expect(result).toHaveLength(2);
      expect(result.find((s) => s.type === "skill_crawler")).toBeUndefined();
      expect(result.find((s) => s.type === "open_search")).toBeUndefined();
    });
  });

  describe("custom options", () => {
    it("should skip specified types", () => {
      const path = new DegradationPath("taobao", sources);
      const result = path.getPath({ skipTypes: ["skill_crawler"] });

      expect(result).toHaveLength(3);
      expect(result.find((s) => s.type === "skill_crawler")).toBeUndefined();
    });

    it("should respect maxSources limit", () => {
      const path = new DegradationPath("taobao", sources);
      const result = path.getPath({ maxSources: 2 });

      expect(result).toHaveLength(2);
    });

    it("should skip crawler when allowCrawler is false", () => {
      const path = new DegradationPath("taobao", sources);
      const result = path.getPath({ allowCrawler: false });

      expect(result.find((s) => s.type === "skill_crawler")).toBeUndefined();
    });

    it("should skip open_search when allowOpenSearch is false", () => {
      const path = new DegradationPath("taobao", sources);
      const result = path.getPath({ allowOpenSearch: false });

      expect(result.find((s) => s.type === "open_search")).toBeUndefined();
    });
  });

  describe("custom order", () => {
    it("should use custom order when specified", () => {
      const path = new DegradationPath("taobao", sources);
      const result = path.getPath({
        customOrder: ["open_search", "skill_crawler"],
      });

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe("open_search");
      expect(result[1].type).toBe("skill_crawler");
    });
  });

  describe("platform with missing source types", () => {
    it("should automatically skip missing source types", () => {
      const amazonSources = [
        createMockSource({ id: "amazon_official_api", type: "official_api", platform: "amazon" }),
        createMockSource({
          id: "amazon_third_party_api",
          type: "third_party_api",
          platform: "amazon",
        }),
      ];

      const path = new DegradationPath("amazon", amazonSources);
      const result = path.getPath();

      expect(result).toHaveLength(2);
      expect(result.find((s) => s.type === "skill_crawler")).toBeUndefined();
      expect(result.find((s) => s.type === "open_search")).toBeUndefined();
    });
  });
});
