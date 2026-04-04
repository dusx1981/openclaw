import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import type { LazadaClient } from "./LazadaClient.js";
import { LazadaProductApi } from "./LazadaProductApi.js";

function createMockClient(): { client: LazadaClient; execute: Mock } {
  const execute = vi.fn();
  const getCountry = vi.fn().mockReturnValue("SG");

  const client = {
    execute,
    getCountry,
  } as unknown as LazadaClient;

  return { client, execute };
}

describe("LazadaProductApi", () => {
  let api: LazadaProductApi;
  let mockClient: { client: LazadaClient; execute: Mock };

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    api = new LazadaProductApi(mockClient.client);
  });

  describe("getProductDetail", () => {
    it("should fetch and transform product data", async () => {
      const mockProduct = {
        item_id: "item123",
        name: "Test Product",
        price: 29.99,
        special_price: 24.99,
        images: ["https://example.com/image.jpg"],
        url: "https://www.lazada.sg/products/i123",
        seller_id: "seller1",
        seller_name: "Test Seller",
        country: "SG",
        status: "active",
        rating_star: 4.8,
      };

      mockClient.execute.mockResolvedValue({ product: mockProduct });

      const result = await api.getProductDetail("item123");

      expect(result).toBeDefined();
      expect(result?.platform).toBe("lazada");
      expect(result?.platformId).toBe("item123");
      expect(result?.title).toBe("Test Product");
      expect(result?.price).toBe(24.99);
      expect(result?.originalPrice).toBe(29.99);
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
            item_id: "item1",
            name: "Product 1",
            price: 19.99,
            images: ["img1.jpg"],
          },
        ],
        total: 10,
      };

      mockClient.execute.mockResolvedValue(mockResult);

      const result = await api.searchProducts("test", 1, 20);

      expect(result.products).toHaveLength(1);
      expect(result.total).toBe(10);
      expect(result.products[0].platform).toBe("lazada");
    });
  });
});
