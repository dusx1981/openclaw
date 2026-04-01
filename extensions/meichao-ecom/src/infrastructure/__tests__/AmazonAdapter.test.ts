import { describe, it, expect, beforeEach } from "vitest";
import { AmazonAdapter } from "../adapters/AmazonAdapter.js";

describe("AmazonAdapter", () => {
  let adapter: AmazonAdapter;

  beforeEach(() => {
    adapter = AmazonAdapter.create();
  });

  describe("getPlatform", () => {
    it("should return amazon", () => {
      expect(adapter.getPlatform()).toBe("amazon");
    });
  });

  describe("fetchProduct", () => {
    it("should fetch a product", async () => {
      const result = await adapter.fetchProduct("B012345678");

      expect(result.success).toBe(true);
      expect(result.data?.platform).toBe("amazon");
      expect(result.data?.platformId).toBe("B012345678");
      expect(result.data?.currency).toBe("USD");
    });

    it("should include latency metrics", async () => {
      const result = await adapter.fetchProduct("B012345678");

      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("fetchProducts", () => {
    it("should fetch multiple products", async () => {
      const results = await adapter.fetchProducts(["B01", "B02"]);

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.success)).toBe(true);
    });
  });

  describe("searchProducts", () => {
    it("should search products", async () => {
      const result = await adapter.searchProducts("test keyword");

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty("products");
      expect(result.data).toHaveProperty("total");
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
      expect(sources[0]).toBe("amazon_sp_api");
    });
  });
});
