import { describe, it, expect } from "vitest";
import {
  resolvePrimaryDataSource,
  resolveFallbackDataSources,
  buildDataSourceCandidates,
  parseDataSourceId,
  createDefaultDataCollectionConfig,
  DEFAULT_DATA_COLLECTION_SETTINGS,
} from "./data-source-config.js";

describe("data-source-config", () => {
  describe("resolvePrimaryDataSource", () => {
    it("should resolve string config", () => {
      const result = resolvePrimaryDataSource("taobao/official_api");
      expect(result).toBe("taobao/official_api");
    });

    it("should resolve object config with primary", () => {
      const result = resolvePrimaryDataSource({
        primary: "taobao/official_api",
        fallbacks: ["taobao/third_party_api"],
      });
      expect(result).toBe("taobao/official_api");
    });

    it("should return undefined for empty trimmed string", () => {
      const result = resolvePrimaryDataSource("   " as never);
      expect(result).toBeUndefined();
    });

    it("should return undefined for undefined config", () => {
      const result = resolvePrimaryDataSource(undefined);
      expect(result).toBeUndefined();
    });

    it("should return undefined for object without primary", () => {
      const result = resolvePrimaryDataSource({ fallbacks: ["taobao/third_party_api"] });
      expect(result).toBeUndefined();
    });
  });

  describe("resolveFallbackDataSources", () => {
    it("should resolve fallbacks from object config", () => {
      const result = resolveFallbackDataSources({
        primary: "taobao/official_api",
        fallbacks: ["taobao/third_party_api", "taobao/skill_crawler"],
      });
      expect(result).toEqual(["taobao/third_party_api", "taobao/skill_crawler"]);
    });

    it("should return empty array for string config", () => {
      const result = resolveFallbackDataSources("taobao/official_api");
      expect(result).toEqual([]);
    });

    it("should return empty array for undefined config", () => {
      const result = resolveFallbackDataSources(undefined);
      expect(result).toEqual([]);
    });

    it("should return empty array for object without fallbacks", () => {
      const result = resolveFallbackDataSources({ primary: "taobao/official_api" });
      expect(result).toEqual([]);
    });
  });

  describe("buildDataSourceCandidates", () => {
    it("should build candidates from config", () => {
      const result = buildDataSourceCandidates({
        primary: "taobao/official_api",
        fallbacks: ["taobao/third_party_api", "taobao/skill_crawler"],
      });

      expect(result).toEqual([
        "taobao/official_api",
        "taobao/third_party_api",
        "taobao/skill_crawler",
      ]);
    });

    it("should use config fallbacks when config has primary", () => {
      const result = buildDataSourceCandidates(
        { primary: "taobao/official_api", fallbacks: ["taobao/third_party_api"] },
        { primary: "taobao/third_party_api", fallbacks: ["taobao/skill_crawler"] },
      );

      expect(result).toEqual(["taobao/official_api", "taobao/third_party_api"]);
    });

    it("should use default when config has no primary", () => {
      const result = buildDataSourceCandidates(undefined, { primary: "taobao/official_api" });

      expect(result).toEqual(["taobao/official_api"]);
    });

    it("should deduplicate sources", () => {
      const result = buildDataSourceCandidates(
        {
          primary: "taobao/official_api",
          fallbacks: ["taobao/official_api", "taobao/third_party_api"],
        },
        {
          primary: "taobao/official_api",
          fallbacks: ["taobao/third_party_api"],
        },
      );

      expect(result).toEqual(["taobao/official_api", "taobao/third_party_api"]);
    });

    it("should respect maxSources limit", () => {
      const result = buildDataSourceCandidates(
        {
          primary: "taobao/official_api",
          fallbacks: ["taobao/third_party_api", "taobao/skill_crawler"],
        },
        undefined,
        2,
      );

      expect(result).toHaveLength(2);
      expect(result).toEqual(["taobao/official_api", "taobao/third_party_api"]);
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

    it("should parse custom source ID", () => {
      const result = parseDataSourceId("amazon/sp_api");
      expect(result).toEqual({
        platform: "amazon",
        sourceType: "sp_api",
      });
    });

    it("should return null for invalid format", () => {
      const result = parseDataSourceId("invalid");
      expect(result).toBeNull();
    });

    it("should return null for invalid platform", () => {
      const result = parseDataSourceId("invalid/source");
      expect(result).toBeNull();
    });

    it("should return null for empty string", () => {
      const result = parseDataSourceId("");
      expect(result).toBeNull();
    });
  });

  describe("createDefaultDataCollectionConfig", () => {
    it("should create valid default config", () => {
      const config = createDefaultDataCollectionConfig();

      expect(config.default).toBeDefined();
      expect(config.platforms).toBeDefined();
      expect(config.settings).toBeDefined();
    });

    it("should have taobao platform configured", () => {
      const config = createDefaultDataCollectionConfig();

      expect(config.platforms?.taobao).toBeDefined();
    });

    it("should have amazon platform configured", () => {
      const config = createDefaultDataCollectionConfig();

      expect(config.platforms?.amazon).toBeDefined();
    });
  });

  describe("DEFAULT_DATA_COLLECTION_SETTINGS", () => {
    it("should have default values", () => {
      expect(DEFAULT_DATA_COLLECTION_SETTINGS.maxFallbackSources).toBe(3);
      expect(DEFAULT_DATA_COLLECTION_SETTINGS.enableStaleCache).toBe(true);
      expect(DEFAULT_DATA_COLLECTION_SETTINGS.staleCacheMaxAge).toBe(3600000);
      expect(DEFAULT_DATA_COLLECTION_SETTINGS.circuitBreaker.enabled).toBe(true);
    });
  });
});
