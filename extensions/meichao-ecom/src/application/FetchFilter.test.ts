import { describe, it, expect, beforeEach } from "vitest";
import type { ProductData } from "../domain/types.js";
import { MockPlatformGateway } from "../infrastructure/adapters/MockPlatformGateway.js";
import { FetchFilter } from "./pipeline/filters/FetchFilter.js";

describe("FetchFilter", () => {
  let filter: FetchFilter;
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
    gateway.setMockProduct("12345", mockProduct);

    const gateways = new Map([["taobao", gateway as never]]);
    filter = new FetchFilter({ gateways, concurrency: 5 });
  });

  describe("execute", () => {
    it("should fetch products from gateway", async () => {
      const context = {
        requestId: "test",
        platform: "taobao",
        platformIds: ["12345"],
        options: {},
        startTime: Date.now(),
        metadata: {},
      };

      const result = await filter.execute(context, { products: [] });

      expect(result.products).toHaveLength(1);
      expect(result.products[0].platformId).toBe("12345");
      expect(result.stats.fetched).toBe(1);
    });

    it("should handle missing gateway", async () => {
      const gateways = new Map();
      const filterWithoutGateway = new FetchFilter({ gateways });

      const context = {
        requestId: "test",
        platform: "taobao",
        platformIds: ["12345"],
        options: {},
        startTime: Date.now(),
        metadata: {},
      };

      const result = await filterWithoutGateway.execute(context, { products: [] });

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("GATEWAY_NOT_FOUND");
    });

    it("should handle fetch errors", async () => {
      const context = {
        requestId: "test",
        platform: "taobao",
        platformIds: ["nonexistent"],
        options: {},
        startTime: Date.now(),
        metadata: {},
      };

      const result = await filter.execute(context, { products: [] });

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("FETCH_FAILED");
    });

    it("should fetch multiple products", async () => {
      gateway.setMockProduct("1", { ...mockProduct, platformId: "1" });
      gateway.setMockProduct("2", { ...mockProduct, platformId: "2" });
      gateway.setMockProduct("3", { ...mockProduct, platformId: "3" });

      const context = {
        requestId: "test",
        platform: "taobao",
        platformIds: ["1", "2", "3"],
        options: {},
        startTime: Date.now(),
        metadata: {},
      };

      const result = await filter.execute(context, { products: [] });

      expect(result.products).toHaveLength(3);
    });
  });
});
