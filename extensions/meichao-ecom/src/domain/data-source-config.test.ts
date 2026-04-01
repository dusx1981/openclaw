import { describe, it, expect } from "vitest";
import {
  DEFAULT_DATA_COLLECTION_SETTINGS,
  resolvePrimaryDataSource,
  resolveFallbackDataSources,
  buildDataSourceCandidates,
  parseDataSourceId,
} from "./data-source-config.js";

describe("data-source-config", () => {
  describe("DEFAULT_DATA_COLLECTION_SETTINGS", () => {
    it("should have circuitBreaker config with all required fields", () => {
      expect(DEFAULT_DATA_COLLECTION_SETTINGS.circuitBreaker).toEqual({
        enabled: true,
        failureThreshold: 5,
        openDuration: 30000,
        halfOpenMaxCalls: 1,
        successThreshold: 3,
      });
    });

    it("should have cooldown config with all required fields", () => {
      expect(DEFAULT_DATA_COLLECTION_SETTINGS.cooldown).toEqual({
        baseMinutes: 5,
        maxMinutes: 60,
        severeMultiplier: 12,
        probeWindowMinutes: 2,
        probeMinIntervalSeconds: 30,
      });
    });

    it("should have healthProbe config with all required fields", () => {
      expect(DEFAULT_DATA_COLLECTION_SETTINGS.healthProbe).toEqual({
        interval: 60000,
        initialDelay: 5000,
        timeout: 10000,
        unhealthyThreshold: 3,
        recoveryThreshold: 2,
      });
    });
  });

  describe("resolvePrimaryDataSource", () => {
    it("should resolve string config", () => {
      expect(resolvePrimaryDataSource("taobao/official_api")).toBe("taobao/official_api");
    });

    it("should resolve object config", () => {
      expect(resolvePrimaryDataSource({ primary: "taobao/official_api" })).toBe(
        "taobao/official_api",
      );
    });

    it("should return undefined for empty config", () => {
      expect(resolvePrimaryDataSource(undefined)).toBeUndefined();
      expect(resolvePrimaryDataSource("")).toBeUndefined();
    });
  });

  describe("resolveFallbackDataSources", () => {
    it("should resolve fallbacks from object config", () => {
      const fallbacks = resolveFallbackDataSources({
        primary: "taobao/official_api",
        fallbacks: ["taobao/third_party_api", "taobao/skill_crawler"],
      });
      expect(fallbacks).toEqual(["taobao/third_party_api", "taobao/skill_crawler"]);
    });

    it("should return empty array for string config", () => {
      expect(resolveFallbackDataSources("taobao/official_api")).toEqual([]);
    });
  });

  describe("buildDataSourceCandidates", () => {
    it("should build candidates with primary first", () => {
      const candidates = buildDataSourceCandidates({
        primary: "taobao/official_api",
        fallbacks: ["taobao/third_party_api"],
      });
      expect(candidates[0]).toBe("taobao/official_api");
    });

    it("should respect maxSources limit", () => {
      const candidates = buildDataSourceCandidates(
        {
          primary: "taobao/official_api",
          fallbacks: ["taobao/third_party_api", "taobao/skill_crawler"],
        },
        undefined,
        2,
      );
      expect(candidates).toHaveLength(2);
    });
  });

  describe("parseDataSourceId", () => {
    it("should parse valid data source ID", () => {
      const result = parseDataSourceId("taobao/official_api");
      expect(result).toEqual({
        platform: "taobao",
        sourceType: "official_api",
      });
    });

    it("should return null for invalid format", () => {
      expect(parseDataSourceId("invalid")).toBeNull();
    });

    it("should return null for invalid platform", () => {
      expect(parseDataSourceId("invalid/source")).toBeNull();
    });
  });
});
