import { describe, it, expect } from "vitest";
import type {
  Platform,
  ProductStatus,
  ProductPriority,
  SalesPeriod,
  ProductData,
} from "./types.js";
import { DEFAULT_CURRENCY, PLATFORM_NAMES, PLATFORM_CURRENCIES } from "./types.js";

describe("types", () => {
  describe("Platform type", () => {
    it("should have correct platform values", () => {
      const platforms: Platform[] = [
        "taobao",
        "amazon",
        "douyin",
        "1688",
        "shopee",
        "pinduoduo",
        "jd",
        "aliexpress",
      ];
      expect(platforms).toHaveLength(8);
    });
  });

  describe("ProductStatus type", () => {
    it("should have correct status values", () => {
      const statuses: ProductStatus[] = ["active", "inactive", "deleted", "sold_out"];
      expect(statuses).toHaveLength(4);
    });
  });

  describe("ProductPriority type", () => {
    it("should have correct priority values", () => {
      const priorities: ProductPriority[] = ["P0", "P1", "P2"];
      expect(priorities).toHaveLength(3);
    });
  });

  describe("SalesPeriod type", () => {
    it("should have correct period values", () => {
      const periods: SalesPeriod[] = ["day", "week", "month"];
      expect(periods).toHaveLength(3);
    });
  });

  describe("ProductData interface", () => {
    it("should create valid product data", () => {
      const data: ProductData = {
        platform: "taobao",
        platformId: "12345",
        title: "Test Product",
        sourceUrl: "https://example.com/product/12345",
        price: 99.99,
        currency: "CNY",
        sales: 100,
        salesPeriod: "month",
        status: "active",
        priority: "P1",
        isTrending: false,
      };

      expect(data.platform).toBe("taobao");
      expect(data.price).toBe(99.99);
      expect(data.sales).toBe(100);
    });
  });

  describe("DEFAULT_CURRENCY", () => {
    it("should be CNY", () => {
      expect(DEFAULT_CURRENCY).toBe("CNY");
    });
  });

  describe("PLATFORM_NAMES", () => {
    it("should have names for all platforms", () => {
      expect(PLATFORM_NAMES.taobao).toBe("淘宝");
      expect(PLATFORM_NAMES.amazon).toBe("Amazon");
      expect(PLATFORM_NAMES.douyin).toBe("抖音");
      expect(PLATFORM_NAMES["1688"]).toBe("1688");
      expect(PLATFORM_NAMES.shopee).toBe("Shopee");
    });
  });

  describe("PLATFORM_CURRENCIES", () => {
    it("should have currencies for all platforms", () => {
      expect(PLATFORM_CURRENCIES.taobao).toBe("CNY");
      expect(PLATFORM_CURRENCIES.amazon).toBe("USD");
      expect(PLATFORM_CURRENCIES.shopee).toBe("SGD");
    });
  });
});
