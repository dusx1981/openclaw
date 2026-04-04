import { describe, it, expect, beforeEach, vi } from "vitest";
import type { CacheProvider } from "../domain/ports/CacheProvider.js";
import type { ProductRepository } from "../domain/ports/ProductRepository.js";
import type { ProductData } from "../domain/types.js";
import { MockPlatformGateway } from "../infrastructure/adapters/MockPlatformGateway.js";
import { FetchProductUseCase } from "./use-cases/FetchProductUseCase.js";

describe("FetchProductUseCase", () => {
  let useCase: FetchProductUseCase;
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
      createMany: vi.fn(),
      findById: vi.fn(),
      findByPlatformId: vi.fn().mockResolvedValue(null),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
      updatePrice: vi.fn(),
      updateSales: vi.fn(),
      markTrending: vi.fn(),
    };

    mockCacheProvider = {
      get: vi.fn().mockResolvedValue(null),
      getWithFallback: vi.fn().mockResolvedValue(null),
      set: vi.fn(),
      delete: vi.fn(),
      getMany: vi.fn(),
      setMany: vi.fn(),
      deleteMany: vi.fn(),
      getJson: vi.fn(),
      setJson: vi.fn(),
      getProduct: vi.fn().mockResolvedValue(null),
      getProductWithFallback: vi.fn().mockResolvedValue(null),
      setProduct: vi.fn(),
      getPrice: vi.fn(),
      setPrice: vi.fn(),
      clear: vi.fn(),
      clearExpired: vi.fn(),
      getStats: vi.fn(),
      getMetrics: vi.fn(),
    };

    useCase = new FetchProductUseCase(gateway, mockRepository, mockCacheProvider);
  });

  describe("execute", () => {
    it("should fetch product from gateway", async () => {
      const result = await useCase.execute("taobao", "12345");

      expect(result.data).not.toBeNull();
      expect(result.data?.platformId).toBe("12345");
      expect(result.cached).toBe(false);
    });

    it("should return cached product when available", async () => {
      (mockCacheProvider.getProductWithFallback as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: mockProduct,
        isStale: false,
        age: 1000,
      });

      const result = await useCase.execute("taobao", "12345");

      expect(result.cached).toBe(true);
      expect(result.source).toBe("cache");
    });

    it("should return null for non-existent product", async () => {
      const result = await useCase.execute("taobao", "nonexistent");

      expect(result.data).toBeNull();
    });

    it("should track latency", async () => {
      const result = await useCase.execute("taobao", "12345");

      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("should skip cache when useCache is false", async () => {
      await useCase.execute("taobao", "12345", false);

      expect(mockCacheProvider.getProduct).not.toHaveBeenCalled();
    });

    it("should return degradationLevel for successful fetch", async () => {
      const result = await useCase.execute("taobao", "12345");

      expect(result.degradationLevel).toBe("primary_source");
      expect(result.isDegraded).toBe(false);
    });

    it("should return fresh_cache degradationLevel for cache hit", async () => {
      (mockCacheProvider.getProductWithFallback as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: mockProduct,
        isStale: false,
        age: 1000,
      });

      const result = await useCase.execute("taobao", "12345");

      expect(result.degradationLevel).toBe("fresh_cache");
      expect(result.isDegraded).toBe(false);
    });

    it("should return database degradationLevel for database hit", async () => {
      (mockCacheProvider.getProductWithFallback as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );
      (mockRepository.findByPlatformId as ReturnType<typeof vi.fn>).mockResolvedValue({
        toData: () => mockProduct,
      });

      const result = await useCase.execute("taobao", "12345");

      expect(result.degradationLevel).toBe("database");
      expect(result.isDegraded).toBe(false);
    });

    it("should return stale_cache degradationLevel when all sources fail but stale cache exists", async () => {
      (mockCacheProvider.getProductWithFallback as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: mockProduct,
        isStale: true,
        age: 3600000,
      });
      (mockRepository.findByPlatformId as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      gateway.setMockProduct("12345", null as unknown as ProductData);

      const result = await useCase.execute("taobao", "12345");

      expect(result.degradationLevel).toBe("stale_cache");
      expect(result.isDegraded).toBe(true);
      expect(result.staleCacheAge).toBe(3600000);
    });

    it("should return error degradationLevel when all layers fail", async () => {
      (mockCacheProvider.getProductWithFallback as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );
      (mockRepository.findByPlatformId as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      gateway.setMockProduct("12345", null as unknown as ProductData);

      const result = await useCase.execute("taobao", "12345");

      expect(result.degradationLevel).toBe("error");
      expect(result.isDegraded).toBe(true);
    });
  });

  describe("executeMany", () => {
    it("should fetch multiple products", async () => {
      gateway.setMockProduct("1", { ...mockProduct, platformId: "1" });
      gateway.setMockProduct("2", { ...mockProduct, platformId: "2" });

      const results = await useCase.executeMany("taobao", ["1", "2"]);

      expect(results.size).toBe(2);
      expect(results.get("1")?.data).not.toBeNull();
      expect(results.get("2")?.data).not.toBeNull();
    });
  });
});
