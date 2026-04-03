import { describe, it, expect, beforeEach } from "vitest";
import type { ProductData } from "../domain/types.js";
import { ValidateFilter } from "./pipeline/filters/ValidateFilter.js";

describe("ValidateFilter", () => {
  let filter: ValidateFilter;

  const validProduct: ProductData = {
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
    filter = new ValidateFilter();
  });

  describe("execute", () => {
    it("should pass valid products", async () => {
      const context = {
        requestId: "test",
        platform: "taobao",
        platformIds: [],
        options: {},
        startTime: Date.now(),
        metadata: {},
      };

      const result = await filter.execute(context, { products: [validProduct] });

      expect(result.products).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject product without platformId", async () => {
      const invalidProduct = { ...validProduct, platformId: "" };

      const context = {
        requestId: "test",
        platform: "taobao",
        platformIds: [],
        options: {},
        startTime: Date.now(),
        metadata: {},
      };

      const result = await filter.execute(context, { products: [invalidProduct] });

      expect(result.products).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe("VALIDATION_FAILED");
    });

    it("should reject product without title", async () => {
      const invalidProduct = { ...validProduct, title: "" };

      const context = {
        requestId: "test",
        platform: "taobao",
        platformIds: [],
        options: {},
        startTime: Date.now(),
        metadata: {},
      };

      const result = await filter.execute(context, { products: [invalidProduct] });

      expect(result.products).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
    });

    it("should reject product with negative price", async () => {
      const invalidProduct = { ...validProduct, price: -10 };

      const context = {
        requestId: "test",
        platform: "taobao",
        platformIds: [],
        options: {},
        startTime: Date.now(),
        metadata: {},
      };

      const result = await filter.execute(context, { products: [invalidProduct] });

      expect(result.products).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
    });

    it("should reject product with invalid rating", async () => {
      const invalidProduct = { ...validProduct, rating: 6 };

      const context = {
        requestId: "test",
        platform: "taobao",
        platformIds: [],
        options: {},
        startTime: Date.now(),
        metadata: {},
      };

      const result = await filter.execute(context, { products: [invalidProduct] });

      expect(result.products).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
    });

    it("should skip validation when skipValidation is true", async () => {
      const invalidProduct = { ...validProduct, title: "" };

      const context = {
        requestId: "test",
        platform: "taobao",
        platformIds: [],
        options: { skipValidation: true },
        startTime: Date.now(),
        metadata: {},
      };

      const result = await filter.execute(context, { products: [invalidProduct] });

      expect(result.products).toHaveLength(1);
    });
  });
});
