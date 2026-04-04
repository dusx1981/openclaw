import { describe, it, expect, beforeEach, vi } from "vitest";
import { Product } from "../domain/entities/Product.js";
import type { ProductRepository } from "../domain/ports/ProductRepository.js";
import type { ProductData } from "../domain/types.js";
import { MockPlatformGateway } from "../infrastructure/adapters/MockPlatformGateway.js";
import { SearchProductsUseCase } from "./use-cases/SearchProductsUseCase.js";

describe("SearchProductsUseCase", () => {
  let useCase: SearchProductsUseCase;
  let gateway: MockPlatformGateway;
  let mockRepository: ProductRepository;

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
      findByPlatformId: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
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

    useCase = new SearchProductsUseCase(gateway, mockRepository);
  });

  describe("execute", () => {
    it("should search products from gateway", async () => {
      gateway.setMockProduct("1", { ...mockProduct, platformId: "1", title: "Test Item" });
      gateway.setMockProduct("2", { ...mockProduct, platformId: "2", title: "Test Product" });

      const result = await useCase.execute("taobao", "Test");

      expect(result.products).toBeDefined();
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.page).toBe(1);
    });

    it("should respect pagination options", async () => {
      const result = await useCase.execute("taobao", "test", {
        page: 2,
        pageSize: 50,
      });

      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(50);
    });

    it("should track latency", async () => {
      const result = await useCase.execute("taobao", "test");

      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("should return results from gateway", async () => {
      const result = await useCase.execute("taobao", "test");

      expect(result.source).toBe("mock_api");
    });
  });
});
