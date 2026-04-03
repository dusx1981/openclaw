import { describe, it, expect, beforeEach } from "vitest";
import { TaobaoAdapter } from "./adapters/TaobaoAdapter.js";

describe("TaobaoAdapter", () => {
  let adapter: TaobaoAdapter;

  beforeEach(() => {
    adapter = TaobaoAdapter.create();
  });

  describe("getPlatform", () => {
    it("should return taobao", () => {
      expect(adapter.getPlatform()).toBe("taobao");
    });
  });

  describe("fetchProduct", () => {
    it("should fetch a product", async () => {
      const result = await adapter.fetchProduct("12345");

      expect(result.success).toBe(true);
      expect(result.data?.platform).toBe("taobao");
      expect(result.data?.platformId).toBe("12345");
    });

    it("should include latency metrics", async () => {
      const result = await adapter.fetchProduct("12345");

      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("fetchProducts", () => {
    it("should fetch multiple products", async () => {
      const results = await adapter.fetchProducts(["1", "2", "3"]);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
    });
  });

  describe("searchProducts", () => {
    it("should search products", async () => {
      const result = await adapter.searchProducts("test keyword");

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty("products");
      expect(result.data).toHaveProperty("total");
      expect(result.data).toHaveProperty("page");
      expect(result.data).toHaveProperty("pageSize");
    });

    it("should respect pagination options", async () => {
      const result = await adapter.searchProducts("test", { page: 2, pageSize: 50 });

      expect(result.data!.page).toBe(2);
      expect(result.data!.pageSize).toBe(50);
    });

    it("should use fetchWithFailover for search", async () => {
      const result = await adapter.searchProducts("test keyword");

      expect(result.degradationLevel).toBeDefined();
      expect(result.attempts).toBeDefined();
    });

    it("should fallback to open_search when primary sources fail", async () => {
      adapter.updateDataSource("taobao_official_api", { isAvailable: false });
      adapter.updateDataSource("taobao_third_party", { isAvailable: false });
      adapter.updateDataSource("taobao_crawler", { isAvailable: false });

      const result = await adapter.searchProducts("test keyword");

      expect(result.success).toBe(true);
      expect(result.source).toBe("taobao_open_search");
      expect(result.degradationLevel).toBe("fallback_source");
      expect(result.isDegraded).toBe(true);
    });
  });

  describe("healthCheck", () => {
    it("should return healthy when data sources available", async () => {
      const health = await adapter.healthCheck();

      expect(health.isHealthy).toBe(true);
      expect(health.availableSources).toBeGreaterThan(0);
    });
  });

  describe("getAvailableDataSources", () => {
    it("should return available data sources sorted by priority", async () => {
      const sources = await adapter.getAvailableDataSources();

      expect(sources.length).toBeGreaterThan(0);
      expect(sources[0]).toBe("taobao_official_api");
    });
  });

  describe("fetchWithFailover", () => {
    it("should return degradationLevel for successful fetch", async () => {
      const result = await adapter.fetchProduct("12345");

      expect(result.success).toBe(true);
      expect(result.degradationLevel).toBe("primary_source");
      expect(result.isDegraded).toBe(false);
    });

    it("should include attempts array", async () => {
      const result = await adapter.fetchProduct("12345");

      expect(result.attempts).toBeDefined();
      expect(result.attempts!.length).toBeGreaterThan(0);
      expect(result.attempts![0].success).toBe(true);
    });

    it("should use primary source when available", async () => {
      const result = await adapter.fetchProduct("12345");

      expect(result.source).toBe("taobao_official_api");
      expect(result.degradationLevel).toBe("primary_source");
    });

    it("should respect preferredSource option", async () => {
      const result = await adapter.fetchProduct("12345", {
        preferredSource: "taobao_third_party",
      });

      expect(result.source).toBe("taobao_third_party");
    });

    it("should fallback to next source when primary fails", async () => {
      adapter.updateDataSource("taobao_official_api", { isAvailable: false });

      const result = await adapter.fetchProduct("12345");

      expect(result.success).toBe(true);
      expect(result.source).toBe("taobao_third_party");
      expect(result.degradationLevel).toBe("fallback_source");
      expect(result.isDegraded).toBe(true);
    });

    it("should mark isDegraded when using fallback source", async () => {
      adapter.updateDataSource("taobao_official_api", { isAvailable: false });
      adapter.updateDataSource("taobao_third_party", { isAvailable: false });

      const result = await adapter.fetchProduct("12345");

      expect(result.success).toBe(true);
      expect(result.source).toBe("taobao_crawler");
      expect(result.degradationLevel).toBe("fallback_source");
      expect(result.isDegraded).toBe(true);
    });

    it("should return error when all sources unavailable", async () => {
      adapter.updateDataSource("taobao_official_api", { isAvailable: false });
      adapter.updateDataSource("taobao_third_party", { isAvailable: false });
      adapter.updateDataSource("taobao_crawler", { isAvailable: false });
      adapter.updateDataSource("taobao_open_search", { isAvailable: false });

      const result = await adapter.fetchProduct("12345");

      expect(result.success).toBe(false);
      expect(result.error).toContain("No available data sources");
    });

    it("should skip specified sources", async () => {
      adapter.updateDataSource("taobao_official_api", { isAvailable: false });

      const result = await adapter.fetchProduct("12345");

      expect(result.source).not.toBe("taobao_official_api");
    });
  });

  describe("runtime degradation parameters", () => {
    it("should use preferredSource parameter", async () => {
      const result = await adapter.fetchProduct("12345", {
        degradation: {
          preferredSource: "taobao_third_party",
        },
      });

      expect(result.success).toBe(true);
      expect(result.source).toBe("taobao_third_party");
    });

    it("should use skipSources parameter", async () => {
      const result = await adapter.fetchProduct("12345", {
        degradation: {
          skipSources: ["taobao_official_api", "taobao_open_search"],
        },
      });

      expect(result.success).toBe(true);
      expect(result.source).toBe("taobao_third_party");
    });

    it("should use customOrder parameter", async () => {
      const result = await adapter.fetchProduct("12345", {
        degradation: {
          customOrder: ["third_party_api", "official_api"],
        },
      });

      expect(result.success).toBe(true);
      expect(result.source).toBe("taobao_third_party");
    });

    it("should combine multiple degradation parameters", async () => {
      const result = await adapter.fetchProduct("12345", {
        degradation: {
          preferredSource: "taobao_crawler",
          maxSources: 2,
        },
      });

      expect(result.success).toBe(true);
      expect(result.source).toBe("taobao_crawler");
    });
  });
});
