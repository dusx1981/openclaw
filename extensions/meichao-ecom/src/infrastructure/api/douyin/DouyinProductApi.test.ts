import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import type { DouyinClient } from "./DouyinClient.js";
import { DouyinProductApi } from "./DouyinProductApi.js";

function createMockClient(): { client: DouyinClient; execute: Mock } {
  const execute = vi.fn();

  const client = {
    execute,
  } as unknown as DouyinClient;

  return { client, execute };
}

describe("DouyinProductApi", () => {
  let api: DouyinProductApi;
  let mockClient: { client: DouyinClient; execute: Mock };

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    api = new DouyinProductApi(mockClient.client);
  });

  describe("getProductDetail", () => {
    it("should fetch and transform product data", async () => {
      const mockProduct = {
        product_id: "prod123",
        title: "Test Product",
        price: 99,
        original_price: 129,
        main_image: "https://img.douyin.com/test.jpg",
        detail_url: "https://haohuo.jinritemai.com/views/product?id=prod123",
        sales: 1000,
        category_id: "cat1",
        category_name: "Electronics",
        status: 1,
      };

      mockClient.execute.mockResolvedValue({ product: mockProduct });

      const result = await api.getProductDetail("prod123");

      expect(result).toBeDefined();
      expect(result?.platform).toBe("douyin");
      expect(result?.platformId).toBe("prod123");
      expect(result?.title).toBe("Test Product");
      expect(result?.price).toBe(99);
      expect(result?.originalPrice).toBe(129);
      expect(result?.currency).toBe("CNY");
      expect(result?.sales).toBe(1000);
    });

    it("should return null when product not found", async () => {
      mockClient.execute.mockResolvedValue({ product: null });

      const result = await api.getProductDetail("nonexistent");

      expect(result).toBeNull();
    });

    it("should handle live price", async () => {
      const mockProduct = {
        product_id: "prod123",
        title: "Live Product",
        price: 99,
        live_price: 89,
        main_image: "https://img.douyin.com/test.jpg",
        detail_url: "https://haohuo.jinritemai.com/views/product?id=prod123",
        sales: 500,
        status: 1,
      };

      mockClient.execute.mockResolvedValue({ product: mockProduct });

      const result = await api.getProductDetail("prod123");

      expect(result?.extraData?.livePrice).toBe(89);
    });

    it("should handle influencer info", async () => {
      const mockProduct = {
        product_id: "prod123",
        title: "Influencer Product",
        price: 99,
        main_image: "https://img.douyin.com/test.jpg",
        detail_url: "https://haohuo.jinritemai.com/views/product?id=prod123",
        sales: 10000,
        influencer_id: "inf123",
        influencer_name: "Test Influencer",
        commission_rate: 0.15,
        status: 1,
      };

      mockClient.execute.mockResolvedValue({ product: mockProduct });

      const result = await api.getProductDetail("prod123");

      expect(result?.extraData?.influencerInfo).toEqual({
        id: "inf123",
        name: "Test Influencer",
      });
      expect(result?.extraData?.commissionRate).toBe(0.15);
    });

    it("should handle video URL", async () => {
      const mockProduct = {
        product_id: "prod123",
        title: "Video Product",
        price: 99,
        main_image: "https://img.douyin.com/test.jpg",
        detail_url: "https://haohuo.jinritemai.com/views/product?id=prod123",
        sales: 5000,
        video_url: "https://v.douyin.com/test",
        status: 1,
      };

      mockClient.execute.mockResolvedValue({ product: mockProduct });

      const result = await api.getProductDetail("prod123");

      expect(result?.extraData?.videoUrl).toBe("https://v.douyin.com/test");
    });

    it("should map status correctly", async () => {
      const statuses = [
        { status: 1, expected: "active" },
        { status: 0, expected: "inactive" },
        { status: 2, expected: "sold_out" },
        { status: 3, expected: "deleted" },
      ];

      for (const { status, expected } of statuses) {
        const mockProduct = {
          product_id: "prod123",
          title: "Test",
          price: 99,
          main_image: "img.jpg",
          detail_url: "url",
          sales: 100,
          status,
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
            title: "Product 1",
            price: 50,
            main_image: "https://img.douyin.com/1.jpg",
            sales: 100,
            commission_rate: 0.1,
          },
          {
            product_id: "prod222",
            title: "Product 2",
            price: 100,
            main_image: "https://img.douyin.com/2.jpg",
            sales: 200,
          },
        ],
        total: 50,
        page: 1,
      };

      mockClient.execute.mockResolvedValue(mockResult);

      const result = await api.searchProducts("test keyword", 1, 20);

      expect(result.products).toHaveLength(2);
      expect(result.total).toBe(50);
      expect(result.page).toBe(1);
      expect(result.products[0].platform).toBe("douyin");
      expect(result.products[0].platformId).toBe("prod111");
      expect(result.products[0].extraData?.commissionRate).toBe(0.1);
    });

    it("should handle empty search results", async () => {
      mockClient.execute.mockResolvedValue({
        products: [],
        total: 0,
        page: 1,
      });

      const result = await api.searchProducts("nonexistent");

      expect(result.products).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("should use default page and pageSize", async () => {
      mockClient.execute.mockResolvedValue({
        products: [],
        total: 0,
        page: 1,
      });

      await api.searchProducts("test");

      expect(mockClient.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "product.search",
          params: expect.objectContaining({
            keyword: "test",
            page: 1,
            size: 20,
          }),
        }),
      );
    });
  });

  describe("getProductList", () => {
    it("should get product list", async () => {
      const mockResult = {
        products: [
          {
            product_id: "prod1",
            title: "List Product 1",
            price: 99,
            main_image: "img.jpg",
            sales: 500,
          },
        ],
        total: 100,
        page: 1,
      };

      mockClient.execute.mockResolvedValue(mockResult);

      const result = await api.getProductList(1, 20);

      expect(result.products).toHaveLength(1);
      expect(result.total).toBe(100);
      expect(result.page).toBe(1);
    });

    it("should use default pagination", async () => {
      mockClient.execute.mockResolvedValue({
        products: [],
        total: 0,
        page: 1,
      });

      await api.getProductList();

      expect(mockClient.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "product.list",
          params: expect.objectContaining({
            page: 1,
            size: 20,
          }),
        }),
      );
    });
  });

  describe("isTrending", () => {
    it("should mark trending products with sales > 1000", async () => {
      const mockProduct = {
        product_id: "prod123",
        title: "Trending Product",
        price: 99,
        main_image: "img.jpg",
        detail_url: "url",
        sales: 5000,
        status: 1,
      };

      mockClient.execute.mockResolvedValue({ product: mockProduct });

      const result = await api.getProductDetail("prod123");

      expect(result?.isTrending).toBe(true);
    });

    it("should not mark non-trending products", async () => {
      const mockProduct = {
        product_id: "prod123",
        title: "Normal Product",
        price: 99,
        main_image: "img.jpg",
        detail_url: "url",
        sales: 500,
        status: 1,
      };

      mockClient.execute.mockResolvedValue({ product: mockProduct });

      const result = await api.getProductDetail("prod123");

      expect(result?.isTrending).toBe(false);
    });
  });
});
