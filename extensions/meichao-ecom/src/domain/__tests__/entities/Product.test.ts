import { describe, it, expect } from "vitest";
import { Product } from "../../entities/Product.js";
import type { ProductData } from "../../types.js";

function createValidProductData(overrides: Partial<ProductData> = {}): ProductData {
  return {
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
    ...overrides,
  };
}

describe("Product", () => {
  describe("create", () => {
    it("should create product with valid data", () => {
      const data = createValidProductData();
      const product = Product.create(data);

      expect(product.platform).toBe("taobao");
      expect(product.platformId).toBe("12345");
      expect(product.title).toBe("Test Product");
      expect(product.price).toBe(99.99);
      expect(product.sales).toBe(100);
      expect(product.status).toBe("active");
      expect(product.priority).toBe("P1");
      expect(product.isTrending).toBe(false);
    });

    it("should throw error if platform is missing", () => {
      const data = createValidProductData({ platform: "" as any });
      expect(() => Product.create(data)).toThrow("Platform is required");
    });

    it("should throw error if platformId is missing", () => {
      const data = createValidProductData({ platformId: "" });
      expect(() => Product.create(data)).toThrow("Platform ID is required");
    });

    it("should throw error if title is missing", () => {
      const data = createValidProductData({ title: "" });
      expect(() => Product.create(data)).toThrow("Title is required");
    });

    it("should throw error if price is negative", () => {
      const data = createValidProductData({ price: -10 });
      expect(() => Product.create(data)).toThrow("Price cannot be negative");
    });

    it("should throw error if originalPrice is negative", () => {
      const data = createValidProductData({ originalPrice: -10 });
      expect(() => Product.create(data)).toThrow("Original price cannot be negative");
    });

    it("should throw error if rating is out of range", () => {
      const data = createValidProductData({ rating: 6 });
      expect(() => Product.create(data)).toThrow("Rating must be between 0 and 5");
    });

    it("should throw error if rating is negative", () => {
      const data = createValidProductData({ rating: -1 });
      expect(() => Product.create(data)).toThrow("Rating must be between 0 and 5");
    });

    it("should accept valid rating", () => {
      const data = createValidProductData({ rating: 4.5 });
      const product = Product.create(data);
      expect(product.toData().rating).toBe(4.5);
    });
  });

  describe("updatePrice", () => {
    it("should update price", () => {
      const product = Product.create(createValidProductData());
      const updated = product.updatePrice(199.99);

      expect(updated.price).toBe(199.99);
      expect(updated.platform).toBe("taobao");
      expect(updated.platformId).toBe("12345");
    });

    it("should throw error if new price is negative", () => {
      const product = Product.create(createValidProductData());
      expect(() => product.updatePrice(-10)).toThrow("Price cannot be negative");
    });

    it("should update originalPrice", () => {
      const product = Product.create(createValidProductData());
      const updated = product.updatePrice(99.99, 199.99);

      expect(updated.price).toBe(99.99);
      expect(updated.toData().originalPrice).toBe(199.99);
    });
  });

  describe("updateSales", () => {
    it("should update sales", () => {
      const product = Product.create(createValidProductData());
      const updated = product.updateSales(500);

      expect(updated.sales).toBe(500);
    });

    it("should throw error if sales is negative", () => {
      const product = Product.create(createValidProductData());
      expect(() => product.updateSales(-10)).toThrow("Sales cannot be negative");
    });

    it("should update salesUnit", () => {
      const product = Product.create(createValidProductData());
      const updated = product.updateSales(500, "件");

      expect(updated.sales).toBe(500);
      expect(updated.toData().salesUnit).toBe("件");
    });
  });

  describe("markAsTrending", () => {
    it("should mark product as trending", () => {
      const product = Product.create(createValidProductData());
      const updated = product.markAsTrending();

      expect(updated.isTrending).toBe(true);
      expect(updated.priority).toBe("P0");
    });
  });

  describe("markAsInactive", () => {
    it("should mark product as inactive", () => {
      const product = Product.create(createValidProductData());
      const updated = product.markAsInactive();

      expect(updated.status).toBe("inactive");
    });
  });

  describe("setPriority", () => {
    it("should set priority", () => {
      const product = Product.create(createValidProductData());
      const updated = product.setPriority("P0");

      expect(updated.priority).toBe("P0");
    });
  });

  describe("toData", () => {
    it("should return all product data", () => {
      const data = createValidProductData({
        mainImage: "https://example.com/image.jpg",
        images: ["https://example.com/image1.jpg", "https://example.com/image2.jpg"],
        rating: 4.5,
        reviewsCount: 100,
        shopId: "shop123",
        shopName: "Test Shop",
        extraData: { commission: { rate: 0.1, amount: 10 } },
      });

      const product = Product.create(data);
      const productData = product.toData();

      expect(productData.mainImage).toBe("https://example.com/image.jpg");
      expect(productData.images).toHaveLength(2);
      expect(productData.rating).toBe(4.5);
      expect(productData.reviewsCount).toBe(100);
      expect(productData.shopId).toBe("shop123");
      expect(productData.extraData).toEqual({ commission: { rate: 0.1, amount: 10 } });
    });
  });

  describe("setId", () => {
    it("should set id", () => {
      const product = Product.create(createValidProductData());
      const withId = product.setId(1);

      expect(withId.id).toBe(1);
      expect(withId.platform).toBe("taobao");
    });
  });
});
