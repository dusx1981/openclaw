import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import type { JDClient } from "./JDClient.js";
import { JDProductApi } from "./JDProductApi.js";

function createMockClient(): { client: JDClient; execute: Mock } {
  const execute = vi.fn();

  const client = {
    execute,
  } as unknown as JDClient;

  return { client, execute };
}

describe("JDProductApi", () => {
  let api: JDProductApi;
  let mockClient: { client: JDClient; execute: Mock };

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    api = new JDProductApi(mockClient.client);
  });

  describe("getProductDetail", () => {
    it("should fetch and transform product data", async () => {
      const mockProduct = {
        skuId: "100012345",
        skuName: "Test Product",
        price: "199.00",
        imageUrl: "https://img.jd.com/test.jpg",
        detailUrl: "https://item.jd.com/100012345.html",
        sales: 500,
        shopName: "JD Official Store",
        status: 1,
      };

      mockClient.execute.mockResolvedValue({ sku: mockProduct });

      const result = await api.getProductDetail("100012345");

      expect(result).toBeDefined();
      expect(result?.platform).toBe("jd");
      expect(result?.platformId).toBe("100012345");
      expect(result?.title).toBe("Test Product");
      expect(result?.price).toBe(199);
      expect(result?.currency).toBe("CNY");
      expect(result?.sales).toBe(500);
      expect(result?.shopName).toBe("JD Official Store");
    });

    it("should return null when product not found", async () => {
      mockClient.execute.mockResolvedValue({ sku: null });

      const result = await api.getProductDetail("nonexistent");

      expect(result).toBeNull();
    });

    it("should handle commission info", async () => {
      const mockProduct = {
        skuId: "100012345",
        skuName: "Commission Product",
        price: "299.00",
        commissionInfo: {
          commission: 30,
          commissionRate: 10,
        },
        plusPrice: "279.00",
        imageUrl: "https://img.jd.com/test.jpg",
        sales: 100,
        status: 1,
      };

      mockClient.execute.mockResolvedValue({ sku: mockProduct });

      const result = await api.getProductDetail("100012345");

      expect(result?.extraData?.commissionInfo?.commission).toBe(30);
      expect(result?.extraData?.plusPrice).toBe(279);
    });
  });

  describe("searchProducts", () => {
    it("should search and transform products", async () => {
      const mockResult = {
        data: {
          productList: [
            {
              skuId: "111",
              skuName: "Product 1",
              price: "99.00",
              imageUrl: "https://img.jd.com/1.jpg",
              sales: 50,
            },
            {
              skuId: "222",
              skuName: "Product 2",
              price: "199.00",
              imageUrl: "https://img.jd.com/2.jpg",
              sales: 80,
            },
          ],
          totalCount: 200,
        },
      };

      mockClient.execute.mockResolvedValue(mockResult);

      const result = await api.searchProducts("test keyword", 1, 20);

      expect(result.products).toHaveLength(2);
      expect(result.total).toBe(200);
      expect(result.page).toBe(1);
      expect(result.products[0].platform).toBe("jd");
      expect(result.products[0].platformId).toBe("111");
    });

    it("should handle empty search results", async () => {
      mockClient.execute.mockResolvedValue({
        data: {
          productList: [],
          totalCount: 0,
        },
      });

      const result = await api.searchProducts("nonexistent");

      expect(result.products).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe("getJingFenProducts", () => {
    it("should get featured products", async () => {
      const mockResult = {
        data: {
          productList: [
            {
              skuId: "333",
              skuName: "Featured Product",
              price: "149.00",
              imageUrl: "https://img.jd.com/3.jpg",
              sales: 200,
            },
          ],
          totalCount: 50,
        },
      };

      mockClient.execute.mockResolvedValue(mockResult);

      const result = await api.getJingFenProducts(1, 1, 20);

      expect(result.products).toHaveLength(1);
      expect(result.total).toBe(50);
    });
  });
});
