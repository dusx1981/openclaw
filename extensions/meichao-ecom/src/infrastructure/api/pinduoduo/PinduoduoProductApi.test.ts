import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import type { PinduoduoClient } from "./PinduoduoClient.js";
import { PinduoduoProductApi } from "./PinduoduoProductApi.js";

function createMockClient(): { client: PinduoduoClient; execute: Mock } {
  const execute = vi.fn();

  const client = {
    execute,
  } as unknown as PinduoduoClient;

  return { client, execute };
}

describe("PinduoduoProductApi", () => {
  let api: PinduoduoProductApi;
  let mockClient: { client: PinduoduoClient; execute: Mock };

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    api = new PinduoduoProductApi(mockClient.client);
  });

  describe("getGoodsDetail", () => {
    it("should fetch and transform product data", async () => {
      const mockProduct = {
        goods_id: 123456,
        goods_name: "Test Product",
        min_group_price: 9900,
        min_normal_price: 12900,
        goods_image_url: "https://img.pinduoduo.com/test.jpg",
        sales_tip: "已拼10万+件",
        mall_name: "Pinduoduo Official",
        category_id: 100,
        category_name: "Electronics",
      };

      mockClient.execute.mockResolvedValue({ goods_detail: mockProduct });

      const result = await api.getGoodsDetail("123456");

      expect(result).toBeDefined();
      expect(result?.platform).toBe("pinduoduo");
      expect(result?.platformId).toBe("123456");
      expect(result?.title).toBe("Test Product");
      expect(result?.price).toBe(99);
      expect(result?.originalPrice).toBe(129);
      expect(result?.currency).toBe("CNY");
      expect(result?.sales).toBe(100000);
    });

    it("should return null when product not found", async () => {
      mockClient.execute.mockResolvedValue({ goods_detail: null });

      const result = await api.getGoodsDetail("nonexistent");

      expect(result).toBeNull();
    });

    it("should handle group price", async () => {
      const mockProduct = {
        goods_id: 123456,
        goods_name: "Group Product",
        min_group_price: 8900,
        min_normal_price: 9900,
        group_required_num: 2,
        goods_image_url: "https://img.pinduoduo.com/test.jpg",
        sales_tip: "500",
      };

      mockClient.execute.mockResolvedValue({ goods_detail: mockProduct });

      const result = await api.getGoodsDetail("123456");

      expect(result?.extraData?.groupPrice).toBe(89);
      expect(result?.extraData?.normalPrice).toBe(99);
      expect(result?.extraData?.groupRequiredNum).toBe(2);
    });
  });

  describe("searchGoods", () => {
    it("should search and transform products", async () => {
      const mockResult = {
        goods_list: [
          {
            goods_id: 111,
            goods_name: "Product 1",
            min_group_price: 5000,
            goods_image_url: "https://img.pinduoduo.com/1.jpg",
            sales_tip: "100",
          },
          {
            goods_id: 222,
            goods_name: "Product 2",
            min_group_price: 10000,
            goods_image_url: "https://img.pinduoduo.com/2.jpg",
            sales_tip: "200",
          },
        ],
        total_count: 50,
      };

      mockClient.execute.mockResolvedValue(mockResult);

      const result = await api.searchGoods("test keyword", 1, 20);

      expect(result.products).toHaveLength(2);
      expect(result.total).toBe(50);
      expect(result.page).toBe(1);
      expect(result.products[0].platform).toBe("pinduoduo");
      expect(result.products[0].platformId).toBe("111");
    });

    it("should handle empty search results", async () => {
      mockClient.execute.mockResolvedValue({
        goods_list: [],
        total_count: 0,
      });

      const result = await api.searchGoods("nonexistent");

      expect(result.products).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe("parseSalesTip", () => {
    it("should parse '10万+' format", async () => {
      const mockProduct = {
        goods_id: 123,
        goods_name: "Test",
        min_group_price: 1000,
        sales_tip: "已拼10万+件",
      };

      mockClient.execute.mockResolvedValue({ goods_detail: mockProduct });

      const result = await api.getGoodsDetail("123");

      expect(result?.sales).toBe(100000);
    });

    it("should parse plain number format", async () => {
      const mockProduct = {
        goods_id: 123,
        goods_name: "Test",
        min_group_price: 1000,
        sales_tip: "500",
      };

      mockClient.execute.mockResolvedValue({ goods_detail: mockProduct });

      const result = await api.getGoodsDetail("123");

      expect(result?.sales).toBe(500);
    });
  });
});
