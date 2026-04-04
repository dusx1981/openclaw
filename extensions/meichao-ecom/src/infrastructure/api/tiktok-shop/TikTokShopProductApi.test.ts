import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import type { TikTokShopClient } from "./TikTokShopClient.js";
import { TikTokShopProductApi } from "./TikTokShopProductApi.js";

function createMockClient(): { client: TikTokShopClient; execute: Mock } {
  const execute = vi.fn();
  const getRegion = vi.fn().mockReturnValue("US");

  const client = {
    execute,
    getRegion,
  } as unknown as TikTokShopClient;

  return { client, execute };
}

describe("TikTokShopProductApi", () => {
  let api: TikTokShopProductApi;
  let mockClient: { client: TikTokShopClient; execute: Mock };

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    api = new TikTokShopProductApi(mockClient.client);
  });

  describe("getProductDetail", () => {
    it("should fetch and transform product data", async () => {
      const mockProduct = {
        product_id: "prod123",
        title: "Test Product",
        price: 29.99,
        original_price: 39.99,
        main_image: "https://example.com/image.jpg",
        category_id: "cat1",
        shop_id: "shop123",
        shop_name: "Test Shop",
        status: "active",
        sales: 5000,
      };

      mockClient.execute.mockResolvedValue({ product: mockProduct });

      const result = await api.getProductDetail("prod123");

      expect(result).toBeDefined();
      expect(result?.platform).toBe("tiktok_shop");
      expect(result?.platformId).toBe("prod123");
      expect(result?.title).toBe("Test Product");
      expect(result?.price).toBe(29.99);
      expect(result?.originalPrice).toBe(39.99);
      expect(result?.currency).toBe("USD");
      expect(result?.sales).toBe(5000);
    });

    it("should return null when product not found", async () => {
      mockClient.execute.mockResolvedValue({ product: null });

      const result = await api.getProductDetail("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("searchProducts", () => {
    it("should search and transform products", async () => {
      const mockResult = {
        products: [
          {
            product_id: "prod1",
            title: "Product 1",
            price: 19.99,
            main_image: "img1.jpg",
            sales: 100,
          },
        ],
        total: 10,
        has_more: true,
      };

      mockClient.execute.mockResolvedValue(mockResult);

      const result = await api.searchProducts("test", 1, 20);

      expect(result.products).toHaveLength(1);
      expect(result.total).toBe(10);
      expect(result.page).toBe(1);
      expect(result.products[0].platform).toBe("tiktok_shop");
    });
  });
});
