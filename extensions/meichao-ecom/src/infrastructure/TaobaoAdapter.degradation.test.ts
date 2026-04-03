import { describe, it, expect, beforeEach, vi } from "vitest";
import type { FetchResult, ProductData } from "../domain/types.js";
import { TaobaoAdapter } from "./adapters/TaobaoAdapter.js";

function logStage(stage: string, data: Record<string, unknown> = {}): void {
  console.log(`\n[STAGE] ${stage}`);
  if (Object.keys(data).length > 0) {
    console.log("  ", JSON.stringify(data, null, 2).replace(/\n/g, "\n   "));
  }
}

function logResult(result: FetchResult<ProductData>): void {
  console.log("\n[RESULT]");
  console.log(`  success: ${result.success}`);
  console.log(`  source: ${result.source}`);
  console.log(`  latencyMs: ${result.latencyMs}ms`);
  console.log(`  cached: ${result.cached}`);
  console.log(`  degradationLevel: ${result.degradationLevel}`);
  console.log(`  isDegraded: ${result.isDegraded}`);
  if (result.attempts && result.attempts.length > 0) {
    console.log("  attempts:");
    for (const attempt of result.attempts) {
      console.log(
        `    - ${attempt.sourceId}: ${attempt.success ? "SUCCESS" : "FAILED"} (${attempt.latencyMs}ms)`,
      );
      if (attempt.error) {
        console.log(`      error: ${attempt.error}`);
      }
    }
  }
  if (result.error) {
    console.log(`  error: ${result.error}`);
  }
  if (result.data) {
    console.log(`  product: ${result.data.title}`);
  }
}

async function logDataSourceStatus(adapter: TaobaoAdapter): Promise<void> {
  const sources = ["taobao_official_api", "taobao_third_party", "taobao_crawler"];
  const available = await adapter.getAvailableDataSources();
  console.log("\n[DATA SOURCES STATUS]");
  for (const id of sources) {
    const isAvailable = available.includes(id);
    console.log(`  ${id}: ${isAvailable ? "AVAILABLE" : "UNAVAILABLE"}`);
  }
}

describe("TaobaoAdapter - Detailed Degradation Flow", () => {
  let adapter: TaobaoAdapter;

  beforeEach(() => {
    adapter = TaobaoAdapter.create();
    vi.clearAllMocks();
  });

  describe("Scenario 1: All sources available - Primary source used", () => {
    it("should use taobao_official_api as primary source", async () => {
      logStage("INIT", { scenario: "All sources available" });
      await logDataSourceStatus(adapter);

      logStage("FETCH", { platformId: "12345", preferredSource: "none" });
      const result = await adapter.fetchProduct("12345");

      logStage("RESULT");
      logResult(result);

      expect(result.success).toBe(true);
      expect(result.source).toBe("taobao_official_api");
      expect(result.degradationLevel).toBe("primary_source");
      expect(result.isDegraded).toBe(false);
      expect(result.attempts).toHaveLength(1);
      expect(result.attempts![0].sourceId).toBe("taobao_official_api");
      expect(result.attempts![0].success).toBe(true);
    });
  });

  describe("Scenario 2: Primary source unavailable - Fallback to second source", () => {
    it("should fallback to taobao_third_party when official_api is down", async () => {
      logStage("INIT", { scenario: "Primary source unavailable" });

      adapter.updateDataSource("taobao_official_api", { isAvailable: false });
      await logDataSourceStatus(adapter);

      logStage("FETCH", { platformId: "12345" });
      const result = await adapter.fetchProduct("12345");

      logStage("RESULT");
      logResult(result);

      expect(result.success).toBe(true);
      expect(result.source).toBe("taobao_third_party");
      expect(result.degradationLevel).toBe("fallback_source");
      expect(result.isDegraded).toBe(true);
    });
  });

  describe("Scenario 3: Two sources unavailable - Fallback to crawler", () => {
    it("should fallback to taobao_crawler when official_api and third_party are down", async () => {
      logStage("INIT", { scenario: "Two sources unavailable" });

      adapter.updateDataSource("taobao_official_api", { isAvailable: false });
      adapter.updateDataSource("taobao_third_party", { isAvailable: false });
      await logDataSourceStatus(adapter);

      logStage("FETCH", { platformId: "12345" });
      const result = await adapter.fetchProduct("12345");

      logStage("RESULT");
      logResult(result);

      expect(result.success).toBe(true);
      expect(result.source).toBe("taobao_crawler");
      expect(result.degradationLevel).toBe("fallback_source");
      expect(result.isDegraded).toBe(true);
    });
  });

  describe("Scenario 4: All sources unavailable - Error result", () => {
    it("should return error when all sources are down", async () => {
      logStage("INIT", { scenario: "All sources unavailable" });

      adapter.updateDataSource("taobao_official_api", { isAvailable: false });
      adapter.updateDataSource("taobao_third_party", { isAvailable: false });
      adapter.updateDataSource("taobao_crawler", { isAvailable: false });
      adapter.updateDataSource("taobao_open_search", { isAvailable: false });
      await logDataSourceStatus(adapter);

      logStage("FETCH", { platformId: "12345" });
      const result = await adapter.fetchProduct("12345");

      logStage("RESULT");
      logResult(result);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No available data sources");
      expect(result.degradationLevel).toBeUndefined();
    });
  });

  describe("Scenario 5: Preferred source override", () => {
    it("should use preferredSource when specified", async () => {
      logStage("INIT", { scenario: "Preferred source override" });
      await logDataSourceStatus(adapter);

      logStage("FETCH", { platformId: "12345", preferredSource: "taobao_crawler" });
      const result = await adapter.fetchProduct("12345", {
        preferredSource: "taobao_crawler",
      });

      logStage("RESULT");
      logResult(result);

      expect(result.success).toBe(true);
      expect(result.source).toBe("taobao_crawler");
      expect(result.degradationLevel).toBe("primary_source");
    });

    it("should mark isDegraded=true when preferredSource fails and fallback used", async () => {
      logStage("INIT", { scenario: "Preferred source fails, fallback used" });

      adapter.updateDataSource("taobao_crawler", { isAvailable: false });
      await logDataSourceStatus(adapter);

      logStage("FETCH", { platformId: "12345", preferredSource: "taobao_crawler" });
      const result = await adapter.fetchProduct("12345", {
        preferredSource: "taobao_crawler",
      });

      logStage("RESULT");
      logResult(result);

      expect(result.success).toBe(true);
      expect(result.source).toBe("taobao_official_api");
      expect(result.degradationLevel).toBe("fallback_source");
      expect(result.isDegraded).toBe(true);
    });
  });

  describe("Scenario 6: Custom source via degradation parameters", () => {
    it("should use preferredSource parameter to select primary source", async () => {
      logStage("INIT", {
        scenario: "Custom source via preferredSource",
        preferredSource: "taobao_third_party",
      });

      await logDataSourceStatus(adapter);

      logStage("FETCH", { platformId: "12345", preferredSource: "taobao_third_party" });
      const result = await adapter.fetchProduct("12345", {
        degradation: {
          preferredSource: "taobao_third_party",
        },
      });

      logStage("RESULT");
      logResult(result);

      expect(result.success).toBe(true);
      expect(result.source).toBe("taobao_third_party");
    });

    it("should use skipSources to skip specific sources", async () => {
      logStage("INIT", {
        scenario: "Skip specific sources",
        skipSources: ["taobao_official_api", "taobao_open_search"],
      });

      await logDataSourceStatus(adapter);

      logStage("FETCH", {
        platformId: "12345",
        skipSources: ["taobao_official_api", "taobao_open_search"],
      });
      const result = await adapter.fetchProduct("12345", {
        degradation: {
          skipSources: ["taobao_official_api", "taobao_open_search"],
        },
      });

      logStage("RESULT");
      logResult(result);

      expect(result.success).toBe(true);
      expect(result.source).toBe("taobao_third_party");
    });

    it("should fail when all non-skipped sources are unavailable", async () => {
      logStage("INIT", {
        scenario: "All non-skipped sources fail",
        skipSources: ["taobao_third_party", "taobao_crawler", "taobao_open_search"],
      });

      adapter.updateDataSource("taobao_official_api", { isAvailable: false });
      await logDataSourceStatus(adapter);

      logStage("FETCH", {
        platformId: "12345",
        skipSources: ["taobao_third_party", "taobao_crawler", "taobao_open_search"],
      });
      const result = await adapter.fetchProduct("12345", {
        degradation: {
          skipSources: ["taobao_third_party", "taobao_crawler", "taobao_open_search"],
        },
      });

      logStage("RESULT");
      logResult(result);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No available data sources");
    });
  });

  describe("Scenario 7: Max sources limit via degradation parameter", () => {
    it("should respect maxSources degradation parameter", async () => {
      logStage("INIT", {
        scenario: "Max sources limit",
        maxSources: 2,
      });

      adapter.updateDataSource("taobao_official_api", { isAvailable: false });
      adapter.updateDataSource("taobao_third_party", { isAvailable: false });
      await logDataSourceStatus(adapter);

      logStage("FETCH", { platformId: "12345", note: "Should only try 2 sources" });
      const result = await adapter.fetchProduct("12345", {
        degradation: {
          maxSources: 2,
        },
      });

      logStage("RESULT");
      logResult(result);

      expect(result.success).toBe(true);
    });
  });

  describe("Scenario 9: Multiple fetch attempts with state changes", () => {
    it("should handle state changes between fetches", async () => {
      logStage("INIT", { scenario: "Multiple fetches with state changes" });

      logStage("FETCH_1", { note: "First fetch with all sources available" });
      const result1 = await adapter.fetchProduct("12345");
      logResult(result1);
      expect(result1.source).toBe("taobao_official_api");

      logStage("STATE_CHANGE", { action: "Disable official_api" });
      adapter.updateDataSource("taobao_official_api", { isAvailable: false });
      await logDataSourceStatus(adapter);

      logStage("FETCH_2", { note: "Second fetch should use fallback" });
      const result2 = await adapter.fetchProduct("67890");
      logResult(result2);
      expect(result2.source).toBe("taobao_third_party");

      logStage("STATE_CHANGE", { action: "Re-enable official_api" });
      adapter.updateDataSource("taobao_official_api", { isAvailable: true });
      await logDataSourceStatus(adapter);

      logStage("FETCH_3", { note: "Third fetch should use primary again" });
      const result3 = await adapter.fetchProduct("11111");
      logResult(result3);
      expect(result3.source).toBe("taobao_official_api");
    });
  });

  describe("Scenario 10: Batch fetch with mixed results", () => {
    it("should handle batch fetch correctly", async () => {
      logStage("INIT", { scenario: "Batch fetch" });

      const platformIds = ["1001", "1002", "1003"];
      logStage("FETCH_BATCH", { platformIds });

      const results = await adapter.fetchProducts(platformIds);

      logStage("RESULTS");
      console.log(`  Total results: ${results.length}`);
      for (const result of results) {
        console.log(`  - ${result.source}: ${result.success ? "SUCCESS" : "FAILED"}`);
      }

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
    });
  });

  describe("Scenario 11: Source failure callback", () => {
    it("should call onSourceFailure callback when source fails", async () => {
      logStage("INIT", { scenario: "Source failure callback" });

      const failureCallback = vi.fn();
      adapter.updateDataSource("taobao_official_api", { isAvailable: false });

      logStage("FETCH", { platformId: "12345", withCallback: true });

      const result = await adapter.fetchProduct("12345");

      logStage("RESULT");
      logResult(result);

      expect(result.success).toBe(true);
    });
  });

  describe("Scenario 12: Full degradation flow trace", () => {
    it("should trace complete degradation from primary to crawler", async () => {
      logStage("INIT", {
        scenario: "Full degradation trace",
        description: "Step by step degradation through all sources",
      });

      console.log("\n=== STEP 1: All sources available ===");
      await logDataSourceStatus(adapter);
      let result = await adapter.fetchProduct("step1");
      logResult(result);
      expect(result.source).toBe("taobao_official_api");

      console.log("\n=== STEP 2: Primary unavailable ===");
      adapter.updateDataSource("taobao_official_api", { isAvailable: false });
      await logDataSourceStatus(adapter);
      result = await adapter.fetchProduct("step2");
      logResult(result);
      expect(result.source).toBe("taobao_third_party");

      console.log("\n=== STEP 3: Secondary also unavailable ===");
      adapter.updateDataSource("taobao_third_party", { isAvailable: false });
      await logDataSourceStatus(adapter);
      result = await adapter.fetchProduct("step3");
      logResult(result);
      expect(result.source).toBe("taobao_crawler");

      console.log("\n=== STEP 4: All sources unavailable ===");
      adapter.updateDataSource("taobao_crawler", { isAvailable: false });
      adapter.updateDataSource("taobao_open_search", { isAvailable: false });
      await logDataSourceStatus(adapter);
      result = await adapter.fetchProduct("step4");
      logResult(result);
      expect(result.success).toBe(false);
      expect(result.error).toContain("No available data sources");

      console.log("\n=== STEP 5: Recovery - Primary back online ===");
      adapter.updateDataSource("taobao_official_api", { isAvailable: true });
      await logDataSourceStatus(adapter);
      result = await adapter.fetchProduct("step5");
      logResult(result);
      expect(result.source).toBe("taobao_official_api");
    });
  });
});
