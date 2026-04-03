import { describe, it, expect, beforeEach } from "vitest";
import type { ProductData } from "../domain/types.js";
import { MockPlatformGateway } from "./adapters/MockPlatformGateway.js";

describe("MockPlatformGateway", () => {
  let gateway: MockPlatformGateway;
  const mockProduct: ProductData = {
    platform: "taobao",
    platformId: "12345",
    title: "Test Product",
    sourceUrl: "https://item.taobao.com/12345",
    price: 99.99,
    currency: "CNY",
    sales: 1000,
    salesPeriod: "month",
    status: "active",
    priority: "P1",
    isTrending: false,
  };

  beforeEach(() => {
    gateway = new MockPlatformGateway("taobao");
  });

  describe("getPlatform", () => {
    it("should return the platform", () => {
      expect(gateway.getPlatform()).toBe("taobao");
    });
  });

  describe("fetchProduct", () => {
    it("should return error if product not found", async () => {
      const result = await gateway.fetchProduct("nonexistent");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should return product if found", async () => {
      gateway.setMockProduct("12345", mockProduct);

      const result = await gateway.fetchProduct("12345");

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProduct);
    });

    it("should use preferred source", async () => {
      gateway.setMockProduct("12345", mockProduct);

      const result = await gateway.fetchProduct("12345", { preferredSource: "custom_api" });

      expect(result.source).toBe("custom_api");
    });
  });

  describe("fetchProducts", () => {
    it("should fetch multiple products", async () => {
      gateway.setMockProduct("1", mockProduct);
      gateway.setMockProduct("2", { ...mockProduct, platformId: "2" });

      const results = await gateway.fetchProducts(["1", "2"]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it("should return mixed results for existing and non-existing products", async () => {
      gateway.setMockProduct("1", mockProduct);

      const results = await gateway.fetchProducts(["1", "nonexistent"]);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });
  });

  describe("searchProducts", () => {
    it("should search products by keyword", async () => {
      gateway.setMockProduct("1", mockProduct);
      gateway.setMockProduct("2", { ...mockProduct, platformId: "2", title: "Another Product" });

      const result = await gateway.searchProducts("Test");

      expect(result.success).toBe(true);
      expect(result.data!.products).toHaveLength(1);
      expect(result.data!.total).toBe(1);
    });

    it("should paginate results", async () => {
      for (let i = 0; i < 30; i++) {
        gateway.setMockProduct(String(i), {
          ...mockProduct,
          platformId: String(i),
          title: `Test Product ${i}`,
        });
      }

      const result = await gateway.searchProducts("Test", { pageSize: 10, page: 1 });

      expect(result.success).toBe(true);
      expect(result.data!.products).toHaveLength(10);
      expect(result.data!.total).toBe(30);
      expect(result.data!.page).toBe(1);
      expect(result.data!.pageSize).toBe(10);
    });
  });

  describe("healthCheck", () => {
    it("should return healthy by default", async () => {
      const health = await gateway.healthCheck();

      expect(health.isHealthy).toBe(true);
      expect(health.availableSources).toBe(1);
    });

    it("should return unhealthy when set", async () => {
      gateway.setHealthy(false);

      const health = await gateway.healthCheck();

      expect(health.isHealthy).toBe(false);
      expect(health.availableSources).toBe(0);
      expect(health.errors).toHaveLength(1);
    });
  });

  describe("getAvailableDataSources", () => {
    it("should return available sources when healthy", async () => {
      gateway.setAvailableSources(["api1", "api2"]);

      const sources = await gateway.getAvailableDataSources();

      expect(sources).toEqual(["api1", "api2"]);
    });

    it("should return empty when unhealthy", async () => {
      gateway.setHealthy(false);

      const sources = await gateway.getAvailableDataSources();

      expect(sources).toHaveLength(0);
    });
  });
});
