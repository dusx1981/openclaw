import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import type { Alibaba1688ApiClient } from "./Alibaba1688ApiClient.js";
import { Alibaba1688ProductApi } from "./Alibaba1688ProductApi.js";

function createMockClient(): { client: Alibaba1688ApiClient; execute: Mock } {
  const execute = vi.fn();

  const client = {
    execute,
  } as unknown as Alibaba1688ApiClient;

  return { client, execute };
}

describe("Alibaba1688ProductApi", () => {
  let api: Alibaba1688ProductApi;
  let mockClient: { client: Alibaba1688ApiClient; execute: Mock };

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    api = new Alibaba1688ProductApi(mockClient.client);
  });

  describe("getProductDetail", () => {
    it("should fetch and transform product data", async () => {
      const mockProduct = {
        productId: "123456",
        subject: "Test Product",
        price: "99.00",
        imageUrl: "https://example.com/image.jpg",
        detailUrl: "https://detail.1688.com/offer/123456.html",
        saleCount: 100,
        sellerCompany: "Test Company",
        status: "published",
      };

      mockClient.execute.mockResolvedValue({ product: mockProduct });

      const result = await api.getProductDetail("123456");

      expect(result).toBeDefined();
      expect(result?.platform).toBe("1688");
      expect(result?.platformId).toBe("123456");
      expect(result?.title).toBe("Test Product");
      expect(result?.price).toBe(99);
      expect(result?.currency).toBe("CNY");
      expect(result?.sales).toBe(100);
      expect(result?.shopName).toBe("Test Company");
    });

    it("should return null when product not found", async () => {
      mockClient.execute.mockResolvedValue({ product: null });

      const result = await api.getProductDetail("nonexistent");

      expect(result).toBeNull();
    });

    it("should handle wholesale price", async () => {
      const mockProduct = {
        productId: "123456",
        subject: "Wholesale Product",
        price: "99.00",
        wholesalePrice: "89.00",
        minOrderQuantity: 10,
        imageUrl: "https://example.com/image.jpg",
        saleCount: 50,
        status: "published",
      };

      mockClient.execute.mockResolvedValue({ product: mockProduct });

      const result = await api.getProductDetail("123456");

      expect(result?.extraData?.wholesalePrice).toBe(89);
      expect(result?.extraData?.minOrderQuantity).toBe(10);
    });
  });

  describe("searchProducts", () => {
    it("should search and transform products", async () => {
      const mockResult = {
        products: {
          product: [
            {
              productId: "111",
              subject: "Product 1",
              price: "10.00",
              imageUrl: "https://example.com/1.jpg",
              saleCount: 20,
            },
            {
              productId: "222",
              subject: "Product 2",
              price: "20.00",
              imageUrl: "https://example.com/2.jpg",
              saleCount: 30,
            },
          ],
          totalCount: 100,
        },
      };

      mockClient.execute.mockResolvedValue(mockResult);

      const result = await api.searchProducts("test keyword", 1, 20);

      expect(result.products).toHaveLength(2);
      expect(result.total).toBe(100);
      expect(result.page).toBe(1);
      expect(result.products[0].platform).toBe("1688");
      expect(result.products[0].platformId).toBe("111");
    });

    it("should handle empty search results", async () => {
      mockClient.execute.mockResolvedValue({
        products: {
          product: [],
          totalCount: 0,
        },
      });

      const result = await api.searchProducts("nonexistent");

      expect(result.products).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });
});
