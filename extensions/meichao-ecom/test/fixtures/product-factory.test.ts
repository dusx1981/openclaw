import { describe, it, expect, beforeEach } from "vitest";
import { ProductFactory, DataSourceFactory, QuotaFactory } from "../../test/fixtures/index.js";

describe("ProductFactory", () => {
  describe("create", () => {
    it("should create a product with random values", () => {
      const product = ProductFactory.create();

      expect(product.platform).toBeDefined();
      expect(product.platformId).toBeDefined();
      expect(product.title).toBeDefined();
      expect(product.price).toBeGreaterThanOrEqual(0);
      expect(product.currency).toBeDefined();
      expect(product.status).toBeDefined();
    });

    it("should create a product with overrides", () => {
      const product = ProductFactory.create({
        platform: "amazon",
        price: 100,
        currency: "USD",
      });

      expect(product.platform).toBe("amazon");
      expect(product.price).toBe(100);
      expect(product.currency).toBe("USD");
    });
  });

  describe("createList", () => {
    it("should create multiple products", () => {
      const products = ProductFactory.createList(5);

      expect(products).toHaveLength(5);
      products.forEach((p) => {
        expect(p.platform).toBeDefined();
        expect(p.platformId).toBeDefined();
      });
    });
  });

  describe("forPlatform", () => {
    it("should create platform-specific product", () => {
      const taobaoProduct = ProductFactory.forPlatform("taobao");
      const amazonProduct = ProductFactory.forPlatform("amazon");

      expect(taobaoProduct.platform).toBe("taobao");
      expect(taobaoProduct.currency).toBe("CNY");

      expect(amazonProduct.platform).toBe("amazon");
      expect(amazonProduct.currency).toBe("USD");
    });
  });
});

describe("DataSourceFactory", () => {
  it("should create a data source", () => {
    const source = DataSourceFactory.create();

    expect(source.id).toBeDefined();
    expect(source.platform).toBeDefined();
    expect(source.type).toBeDefined();
    expect(source.priority).toBeGreaterThanOrEqual(1);
    expect(source.dailyQuota).toBeGreaterThan(0);
  });

  it("should create a list of data sources", () => {
    const sources = DataSourceFactory.createList(3);

    expect(sources).toHaveLength(3);
    expect(sources[0].priority).toBe(1);
    expect(sources[1].priority).toBe(2);
    expect(sources[2].priority).toBe(3);
  });
});

describe("QuotaFactory", () => {
  it("should create a quota", () => {
    const quota = QuotaFactory.create();

    expect(quota.sourceId).toBeDefined();
    expect(quota.platform).toBeDefined();
    expect(quota.total).toBeGreaterThan(0);
    expect(quota.used).toBeGreaterThanOrEqual(0);
  });

  it("should create quota with custom values", () => {
    const quota = QuotaFactory.create({ total: 100, used: 50 });

    expect(quota.total).toBe(100);
    expect(quota.used).toBe(50);
    expect(quota.remaining()).toBe(50);
    expect(quota.percentUsed()).toBe(50);
  });
});
