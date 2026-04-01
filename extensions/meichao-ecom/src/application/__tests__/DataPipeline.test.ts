import { describe, it, expect, beforeEach, vi } from "vitest";
import type { CacheProvider } from "../../domain/ports/CacheProvider.js";
import type { ProductRepository } from "../../domain/ports/ProductRepository.js";
import type { ProductData } from "../../domain/types.js";
import { MockPlatformGateway } from "../../infrastructure/adapters/MockPlatformGateway.js";
import { DataPipeline } from "../pipeline/DataPipeline.js";

describe("DataPipeline", () => {
  let pipeline: DataPipeline;
  let gateway: MockPlatformGateway;
  let mockRepository: ProductRepository;
  let mockCacheProvider: CacheProvider;

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
    gateway.setMockProduct("12345", mockProduct);

    mockRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByPlatformId: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn().mockResolvedValue({ id: 1, ...mockProduct }),
      delete: vi.fn(),
      count: vi.fn(),
      updatePrice: vi.fn(),
      updateSales: vi.fn(),
      markTrending: vi.fn(),
    };

    mockCacheProvider = {
      get: vi.fn(),
      getWithFallback: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      getJson: vi.fn(),
      setJson: vi.fn(),
      getProduct: vi.fn(),
      getProductWithFallback: vi.fn(),
      setProduct: vi.fn(),
      getPrice: vi.fn(),
      setPrice: vi.fn(),
      clear: vi.fn(),
      clearExpired: vi.fn(),
      getStats: vi.fn(),
    };

    const gateways = new Map([["taobao", gateway as never]]);

    pipeline = new DataPipeline({
      gateways,
      repository: mockRepository,
      cacheProvider: mockCacheProvider,
    });
  });

  describe("execute", () => {
    it("should execute pipeline and return results", async () => {
      const result = await pipeline.execute("taobao", ["12345"]);

      expect(result.success).toBe(true);
      expect(result.products).toHaveLength(1);
      expect(result.stats.fetched).toBe(1);
      expect(result.stats.validated).toBe(1);
    });

    it("should store products", async () => {
      await pipeline.execute("taobao", ["12345"]);

      expect(mockRepository.upsert).toHaveBeenCalled();
    });

    it("should cache products", async () => {
      await pipeline.execute("taobao", ["12345"]);

      expect(mockCacheProvider.setProduct).toHaveBeenCalled();
    });

    it("should handle empty platformIds", async () => {
      const result = await pipeline.execute("taobao", []);

      expect(result.products).toHaveLength(0);
      expect(result.stats.fetched).toBe(0);
    });

    it("should track duration", async () => {
      const result = await pipeline.execute("taobao", ["12345"]);

      expect(result.stats.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("addFilter", () => {
    it("should add custom filter", async () => {
      const customFilter = {
        name: "custom",
        execute: vi.fn().mockResolvedValue({ products: [], errors: [], stats: {} }),
      };

      pipeline.addFilter(customFilter);

      await pipeline.execute("taobao", ["12345"]);

      expect(customFilter.execute).toHaveBeenCalled();
    });
  });

  describe("removeFilter", () => {
    it("should remove filter by name", () => {
      const result = pipeline.removeFilter("validate");

      expect(result).toBe(true);
    });

    it("should return false if filter not found", () => {
      const result = pipeline.removeFilter("nonexistent");

      expect(result).toBe(false);
    });
  });
});
