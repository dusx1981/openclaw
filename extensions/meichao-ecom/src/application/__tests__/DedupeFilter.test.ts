import { describe, it, expect, beforeEach } from "vitest";
import type { ProductData } from "../../domain/types.js";
import { DedupeFilter } from "../pipeline/filters/DedupeFilter.js";

describe("DedupeFilter", () => {
  let filter: DedupeFilter;

  const product1: ProductData = {
    platform: "taobao",
    platformId: "1",
    title: "Product 1",
    sourceUrl: "https://item.taobao.com/1",
    price: 100,
    currency: "CNY",
    sales: 1000,
    salesPeriod: "month",
    status: "active",
    priority: "P1",
    isTrending: false,
  };

  const product2: ProductData = {
    platform: "taobao",
    platformId: "2",
    title: "Product 2",
    sourceUrl: "https://item.taobao.com/2",
    price: 200,
    currency: "CNY",
    sales: 500,
    salesPeriod: "month",
    status: "active",
    priority: "P1",
    isTrending: false,
  };

  beforeEach(() => {
    filter = new DedupeFilter();
  });

  describe("execute", () => {
    it("should keep unique products", async () => {
      const context = {
        requestId: "test",
        platform: "taobao",
        platformIds: [],
        options: {},
        startTime: Date.now(),
        metadata: {},
      };

      const result = await filter.execute(context, { products: [product1, product2] });

      expect(result.products).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    it("should remove duplicates", async () => {
      const duplicate = { ...product1 };

      const context = {
        requestId: "test",
        platform: "taobao",
        platformIds: [],
        options: {},
        startTime: Date.now(),
        metadata: {},
      };

      const result = await filter.execute(context, { products: [product1, duplicate] });

      expect(result.products).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("DUPLICATE");
    });

    it("should handle same platformId on different platforms", async () => {
      const amazonProduct: ProductData = {
        platform: "amazon",
        platformId: "1",
        title: "Amazon Product",
        sourceUrl: "https://amazon.com/dp/1",
        price: 50,
        currency: "USD",
        sales: 200,
        salesPeriod: "month",
        status: "active",
        priority: "P1",
        isTrending: false,
      };

      const context = {
        requestId: "test",
        platform: "taobao",
        platformIds: [],
        options: {},
        startTime: Date.now(),
        metadata: {},
      };

      const result = await filter.execute(context, { products: [product1, amazonProduct] });

      expect(result.products).toHaveLength(2);
    });

    it("should skip dedupe when skipDedupe is true", async () => {
      const duplicate = { ...product1 };

      const context = {
        requestId: "test",
        platform: "taobao",
        platformIds: [],
        options: { skipDedupe: true },
        startTime: Date.now(),
        metadata: {},
      };

      const result = await filter.execute(context, { products: [product1, duplicate] });

      expect(result.products).toHaveLength(2);
    });
  });
});
