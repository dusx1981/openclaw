import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import type { ShopeeClient } from "./ShopeeClient.js";
import { ShopeeProductApi } from "./ShopeeProductApi.js";

function createMockClient(): { client: ShopeeClient; execute: Mock } {
  const execute = vi.fn();
  const getRegion = vi.fn().mockReturnValue("SG");
  const getShopId = vi.fn().mockReturnValue("shop123");

  const client = {
    execute,
    getRegion,
    getShopId,
  } as unknown as ShopeeClient;

  return { client, execute };
}

describe("ShopeeProductApi", () => {
  let api: ShopeeProductApi;
  let mockClient: { client: ShopeeClient; execute: Mock };

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    api = new ShopeeProductApi(mockClient.client);
  });

  describe("getProductDetail", () => {
    it("should fetch and transform product data", async () => {
      const mockProduct = {
        item_id: 123456,
        item_name: "Test Product",
        price: 9.99,
        original_price: 12.99,
        image_url: "https://cf.shopee.sg/file/test.jpg",
        item_status: "NORMAL",
        stock_info: {
          total_stock: 1000,
        },
        category_id: 100,
        shop_info: {
          shop_id: 12345,
          shop_name: "Test Shop",
          shop_location: "SG",
          is_shopee_verified: true,
          is_official_shop: false,
        },
        currency: "SGD",
      };

      mockClient.execute.mockResolvedValue({ item: mockProduct });

      const result = await api.getProductDetail("123456");

      expect(result).toBeDefined();
      expect(result?.platform).toBe("shopee");
      expect(result?.platformId).toBe("123456");
      expect(result?.title).toBe("Test Product");
      expect(result?.price).toBe(9.99);
      expect(result?.originalPrice).toBe(12.99);
      expect(result?.currency).toBe("SGD");
    });

    it("should return null when product not found", async () => {
      mockClient.execute.mockResolvedValue({ item: null });

      const result = await api.getProductDetail("nonexistent");

      expect(result).toBeNull();
    });

    it("should handle discount rate", async () => {
      const mockProduct = {
        item_id: 123456,
        item_name: "Discount Product",
        price: 8.99,
        image_url: "img.jpg",
        item_status: "NORMAL",
        discount_rate: 0.3,
        currency: "SGD",
      };

      mockClient.execute.mockResolvedValue({ item: mockProduct });

      const result = await api.getProductDetail("123456");

      expect(result?.extraData?.discountRate).toBe(0.3);
      expect(result?.isTrending).toBe(true);
    });

    it("should handle shop location", async () => {
      const mockProduct = {
        item_id: 123456,
        item_name: "Cross-border Product",
        price: 9.99,
        image_url: "img.jpg",
        item_status: "NORMAL",
        shop_info: {
          shop_id: 12345,
          shop_name: "MY Shop",
          shop_location: "MY",
          is_shopee_verified: true,
          is_official_shop: true,
        },
        currency: "MYR",
      };

      mockClient.execute.mockResolvedValue({ item: mockProduct });

      const result = await api.getProductDetail("123456");

      expect(result?.extraData?.shopLocation).toBe("MY");
      expect(result?.extraData?.crossBorder).toBe(true);
      expect(result?.extraData?.isOfficialShop).toBe(true);
    });

    it("should map status correctly", async () => {
      const statuses = [
        { status: "NORMAL", expected: "active" },
        { status: "BANNED", expected: "inactive" },
        { status: "DELETED", expected: "deleted" },
        { status: "UNLISTED", expected: "sold_out" },
      ];

      for (const { status, expected } of statuses) {
        const mockProduct = {
          item_id: 123456,
          item_name: "Test",
          price: 9.99,
          image_url: "img.jpg",
          item_status: status,
          currency: "SGD",
        };

        mockClient.execute.mockResolvedValue({ item: mockProduct });
        const result = await api.getProductDetail("123456");
        expect(result?.status).toBe(expected);
      }
    });
  });

  describe("searchProducts", () => {
    it("should search and transform products", async () => {
      const mockResult = {
        item_list: [
          {
            item_id: 111,
            item_name: "Product 1",
            price: 5.0,
            image_url: "https://cf.shopee.sg/file/1.jpg",
            currency: "SGD",
            shop_location: "SG",
          },
          {
            item_id: 222,
            item_name: "Product 2",
            price: 10.0,
            image_url: "https://cf.shopee.sg/file/2.jpg",
            currency: "MYR",
            shop_location: "MY",
          },
        ],
        total_count: 50,
        has_more: true,
      };

      mockClient.execute.mockResolvedValue(mockResult);

      const result = await api.searchProducts("test keyword", 1, 20);

      expect(result.products).toHaveLength(2);
      expect(result.total).toBe(50);
      expect(result.page).toBe(1);
      expect(result.products[0].platform).toBe("shopee");
      expect(result.products[0].platformId).toBe("111");
      expect(result.products[0].extraData?.shopLocation).toBe("SG");
    });

    it("should handle empty search results", async () => {
      mockClient.execute.mockResolvedValue({
        item_list: [],
        total_count: 0,
        has_more: false,
      });

      const result = await api.searchProducts("nonexistent");

      expect(result.products).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("should use default page and pageSize", async () => {
      mockClient.execute.mockResolvedValue({
        item_list: [],
        total_count: 0,
        has_more: false,
      });

      await api.searchProducts("test");

      expect(mockClient.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/item/search",
          params: expect.objectContaining({
            search_text: "test",
            page_number: 1,
            page_size: 20,
          }),
        }),
      );
    });
  });

  describe("getProductList", () => {
    it("should get product list", async () => {
      const mockResult = {
        item_list: [
          {
            item_id: 123,
            item_name: "List Product 1",
            price: 9.99,
            image_url: "img.jpg",
            currency: "SGD",
          },
        ],
        total_count: 100,
        has_more: true,
      };

      mockClient.execute.mockResolvedValue(mockResult);

      const result = await api.getProductList(1, 20);

      expect(result.products).toHaveLength(1);
      expect(result.total).toBe(100);
      expect(result.page).toBe(1);
    });

    it("should use default pagination", async () => {
      mockClient.execute.mockResolvedValue({
        item_list: [],
        total_count: 0,
        has_more: false,
      });

      await api.getProductList();

      expect(mockClient.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "/item/get_item_list",
          params: expect.objectContaining({
            page_number: 1,
            page_size: 20,
          }),
        }),
      );
    });
  });

  describe("isTrending", () => {
    it("should mark trending products with discount > 20%", async () => {
      const mockProduct = {
        item_id: 123456,
        item_name: "Trending Product",
        price: 9.99,
        image_url: "img.jpg",
        item_status: "NORMAL",
        discount_rate: 0.3,
        currency: "SGD",
      };

      mockClient.execute.mockResolvedValue({ item: mockProduct });

      const result = await api.getProductDetail("123456");

      expect(result?.isTrending).toBe(true);
    });

    it("should not mark products with low discount", async () => {
      const mockProduct = {
        item_id: 123456,
        item_name: "Normal Product",
        price: 9.99,
        image_url: "img.jpg",
        item_status: "NORMAL",
        discount_rate: 0.1,
        currency: "SGD",
      };

      mockClient.execute.mockResolvedValue({ item: mockProduct });

      const result = await api.getProductDetail("123456");

      expect(result?.isTrending).toBe(false);
    });

    it("should handle products without discount", async () => {
      const mockProduct = {
        item_id: 123456,
        item_name: "No Discount Product",
        price: 9.99,
        image_url: "img.jpg",
        item_status: "NORMAL",
        currency: "SGD",
      };

      mockClient.execute.mockResolvedValue({ item: mockProduct });

      const result = await api.getProductDetail("123456");

      expect(result?.isTrending).toBe(false);
    });
  });
});
