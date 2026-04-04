import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import type { AliExpressClient } from "./AliExpressClient.js";
import { AliExpressProductApi } from "./AliExpressProductApi.js";

function createMockClient(): { client: AliExpressClient; execute: Mock } {
  const execute = vi.fn();
  const getLanguage = vi.fn().mockReturnValue("en");

  const client = {
    execute,
    getLanguage,
  } as unknown as AliExpressClient;

  return { client, execute };
}

describe("AliExpressProductApi", () => {
  let api: AliExpressProductApi;
  let mockClient: { client: AliExpressClient; execute: Mock };

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    api = new AliExpressProductApi(mockClient.client);
  });

  describe("getProductDetail", () => {
    it("should fetch and transform product data", async () => {
      const mockProduct = {
        product_id: "prod123",
        product_title: "Test Product",
        sale_price: 9.99,
        original_price: 12.99,
        product_image_url: "https://ae01.alicdn.com/test.jpg",
        product_detail_url: "https://www.aliexpress.com/item/prod123.html",
        product_status: "onShelf",
        category_id: 100,
        shop_name: "AliExpress Shop",
      };

      mockClient.execute.mockResolvedValue({ product: mockProduct });

      const result = await api.getProductDetail("prod123");

      expect(result).toBeDefined();
      expect(result?.platform).toBe("aliexpress");
      expect(result?.platformId).toBe("prod123");
      expect(result?.title).toBe("Test Product");
      expect(result?.price).toBe(9.99);
      expect(result?.originalPrice).toBe(12.99);
      expect(result?.currency).toBe("USD");
    });

    it("should return null when product not found", async () => {
      mockClient.execute.mockResolvedValue({ product: null });

      const result = await api.getProductDetail("nonexistent");

      expect(result).toBeNull();
    });

    it("should handle ship to countries", async () => {
      const mockProduct = {
        product_id: "prod123",
        product_title: "Cross-border Product",
        sale_price: 9.99,
        product_image_url: "img.jpg",
        product_detail_url: "url",
        product_status: "onShelf",
        ship_to_countries: ["US", "UK", "DE"],
        delivery_time: 15,
      };

      mockClient.execute.mockResolvedValue({ product: mockProduct });

      const result = await api.getProductDetail("prod123");

      expect(result?.extraData?.shipToCountries).toEqual(["US", "UK", "DE"]);
      expect(result?.extraData?.deliveryTime).toBe(15);
    });

    it("should handle discount rate", async () => {
      const mockProduct = {
        product_id: "prod123",
        product_title: "Discount Product",
        sale_price: 7.99,
        original_price: 12.99,
        product_image_url: "img.jpg",
        product_detail_url: "url",
        product_status: "onShelf",
        discount_rate: 0.4,
      };

      mockClient.execute.mockResolvedValue({ product: mockProduct });

      const result = await api.getProductDetail("prod123");

      expect(result?.extraData?.discountRate).toBe(0.4);
      expect(result?.isTrending).toBe(true);
    });

    it("should handle original language", async () => {
      const mockProduct = {
        product_id: "prod123",
        product_title: "Multi-language Product",
        sale_price: 9.99,
        product_image_url: "img.jpg",
        product_detail_url: "url",
        product_status: "onShelf",
        original_language: "zh",
      };

      mockClient.execute.mockResolvedValue({ product: mockProduct });

      const result = await api.getProductDetail("prod123");

      expect(result?.extraData?.originalLanguage).toBe("zh");
    });

    it("should handle commission rate", async () => {
      const mockProduct = {
        product_id: "prod123",
        product_title: "Affiliate Product",
        sale_price: 9.99,
        product_image_url: "img.jpg",
        product_detail_url: "url",
        product_status: "onShelf",
        commission_rate: "5%",
      };

      mockClient.execute.mockResolvedValue({ product: mockProduct });

      const result = await api.getProductDetail("prod123");

      expect(result?.extraData?.commissionRate).toBe("5%");
    });

    it("should map status correctly", async () => {
      const statuses = [
        { status: "onShelf", expected: "active" },
        { status: "offShelf", expected: "inactive" },
        { status: "deleted", expected: "deleted" },
        { status: "soldOut", expected: "sold_out" },
      ];

      for (const { status, expected } of statuses) {
        const mockProduct = {
          product_id: "prod123",
          product_title: "Test",
          sale_price: 9.99,
          product_image_url: "img.jpg",
          product_detail_url: "url",
          product_status: status,
        };

        mockClient.execute.mockResolvedValue({ product: mockProduct });
        const result = await api.getProductDetail("prod123");
        expect(result?.status).toBe(expected);
      }
    });
  });

  describe("searchProducts", () => {
    it("should search and transform products", async () => {
      const mockResult = {
        products: [
          {
            product_id: "prod111",
            product_title: "Product 1",
            sale_price: 5.0,
            product_image_url: "https://ae01.alicdn.com/1.jpg",
            ship_to_countries: ["US"],
          },
          {
            product_id: "prod222",
            product_title: "Product 2",
            sale_price: 10.0,
            product_image_url: "https://ae01.alicdn.com/2.jpg",
            ship_to_countries: ["UK", "DE"],
          },
        ],
        total_count: 50,
        current_page_no: 1,
      };

      mockClient.execute.mockResolvedValue(mockResult);

      const result = await api.searchProducts("test keyword", 1, 20);

      expect(result.products).toHaveLength(2);
      expect(result.total).toBe(50);
      expect(result.page).toBe(1);
      expect(result.products[0].platform).toBe("aliexpress");
      expect(result.products[0].platformId).toBe("prod111");
      expect(result.products[0].extraData?.shipToCountries).toEqual(["US"]);
    });

    it("should handle empty search results", async () => {
      mockClient.execute.mockResolvedValue({
        products: [],
        total_count: 0,
        current_page_no: 1,
      });

      const result = await api.searchProducts("nonexistent");

      expect(result.products).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("should use default page and pageSize", async () => {
      mockClient.execute.mockResolvedValue({
        products: [],
        total_count: 0,
        current_page_no: 1,
      });

      await api.searchProducts("test");

      expect(mockClient.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "aliexpress.affiliate.product.query",
          params: expect.objectContaining({
            keywords: "test",
            page_no: 1,
            page_size: 20,
          }),
        }),
      );
    });
  });

  describe("getFeaturedPromo", () => {
    it("should get featured promo products", async () => {
      const mockResult = {
        products: [
          {
            product_id: "feat1",
            product_title: "Featured Product 1",
            sale_price: 9.99,
            product_image_url: "img.jpg",
          },
        ],
        total_count: 100,
        current_page_no: 1,
      };

      mockClient.execute.mockResolvedValue(mockResult);

      const result = await api.getFeaturedPromo(1, 20);

      expect(result.products).toHaveLength(1);
      expect(result.total).toBe(100);
      expect(result.page).toBe(1);
    });

    it("should use default pagination", async () => {
      mockClient.execute.mockResolvedValue({
        products: [],
        total_count: 0,
        current_page_no: 1,
      });

      await api.getFeaturedPromo();

      expect(mockClient.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "aliexpress.affiliate.featured.promo.get",
          params: expect.objectContaining({
            page_no: 1,
            page_size: 20,
          }),
        }),
      );
    });
  });

  describe("isTrending", () => {
    it("should mark trending products with discount > 30%", async () => {
      const mockProduct = {
        product_id: "prod123",
        product_title: "Trending Product",
        sale_price: 9.99,
        product_image_url: "img.jpg",
        product_detail_url: "url",
        product_status: "onShelf",
        discount_rate: 0.5,
      };

      mockClient.execute.mockResolvedValue({ product: mockProduct });

      const result = await api.getProductDetail("prod123");

      expect(result?.isTrending).toBe(true);
    });

    it("should not mark products with low discount", async () => {
      const mockProduct = {
        product_id: "prod123",
        product_title: "Normal Product",
        sale_price: 9.99,
        product_image_url: "img.jpg",
        product_detail_url: "url",
        product_status: "onShelf",
        discount_rate: 0.2,
      };

      mockClient.execute.mockResolvedValue({ product: mockProduct });

      const result = await api.getProductDetail("prod123");

      expect(result?.isTrending).toBe(false);
    });

    it("should handle products without discount", async () => {
      const mockProduct = {
        product_id: "prod123",
        product_title: "No Discount Product",
        sale_price: 9.99,
        product_image_url: "img.jpg",
        product_detail_url: "url",
        product_status: "onShelf",
      };

      mockClient.execute.mockResolvedValue({ product: mockProduct });

      const result = await api.getProductDetail("prod123");

      expect(result?.isTrending).toBe(false);
    });
  });
});
