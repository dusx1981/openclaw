import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { AmazonProductApi } from "./AmazonProductApi.js";
import type { AmazonSPApiClient } from "./AmazonSPApiClient.js";

function createMockClient(): { client: AmazonSPApiClient; callAPI: Mock } {
  const callAPI = vi.fn();

  const client = {
    callAPI,
    getMarketplaceId: vi.fn().mockReturnValue("ATVPDKIKX0DER"),
  } as unknown as AmazonSPApiClient;

  return { client, callAPI };
}

describe("AmazonProductApi", () => {
  let api: AmazonProductApi;
  let mockClient: { client: AmazonSPApiClient; callAPI: Mock };

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    api = new AmazonProductApi(mockClient.client, "ATVPDKIKX0DER");
  });

  describe("getProduct", () => {
    it("should fetch and transform product data", async () => {
      const mockPricing = {
        offers: [
          {
            Price: {
              LandedPrice: { Amount: 29.99, CurrencyCode: "USD" },
              ListingPrice: { Amount: 39.99, CurrencyCode: "USD" },
            },
          },
        ],
      };

      const mockCatalog = {
        identifiers: [
          {
            identifiers: {
              ASIN: "B0TEST123",
            },
          },
        ],
        attributes: [
          { name: "item_name", value: "Test Product Name" },
          { name: "brand", value: "Test Brand" },
        ],
        images: [
          { url: "https://example.com/image1.jpg" },
          { url: "https://example.com/image2.jpg" },
        ],
      };

      mockClient.callAPI
        .mockResolvedValueOnce({ payload: [mockPricing] })
        .mockResolvedValueOnce(mockCatalog);

      const result = await api.getProduct("B0TEST123");

      expect(result.platform).toBe("amazon");
      expect(result.platformId).toBe("B0TEST123");
      expect(result.title).toBe("Test Product Name");
      expect(result.price).toBe(29.99);
      expect(result.originalPrice).toBe(39.99);
      expect(result.currency).toBe("USD");
      expect(result.mainImage).toBe("https://example.com/image1.jpg");
      expect(result.images).toHaveLength(2);
      expect(result.shopName).toBe("Test Brand");
      expect(result.sourceUrl).toBe("https://www.amazon.com/dp/B0TEST123");
    });

    it("should handle missing pricing data", async () => {
      const mockCatalog = {
        identifiers: [{ identifiers: { ASIN: "B0TEST123" } }],
        attributes: [{ name: "item_name", value: "Test Product" }],
        images: [],
      };

      mockClient.callAPI.mockResolvedValueOnce({ payload: [] }).mockResolvedValueOnce(mockCatalog);

      const result = await api.getProduct("B0TEST123");

      expect(result.price).toBe(0);
      expect(result.title).toBe("Test Product");
    });

    it("should handle API errors", async () => {
      mockClient.callAPI.mockRejectedValue(new Error("API Error"));

      await expect(api.getProduct("B0TEST123")).rejects.toThrow(
        "Failed to fetch Amazon product B0TEST123",
      );
    });
  });

  describe("getProducts", () => {
    it("should fetch multiple products", async () => {
      mockClient.callAPI.mockImplementation(async (req: any) => {
        if (req.operation === "getPricing") {
          return { payload: [{ offers: [] }] };
        }
        if (req.operation === "getCatalogItem") {
          const asin = req.path.asin;
          return {
            identifiers: [{ identifiers: { ASIN: asin } }],
            attributes: [{ name: "item_name", value: `Product ${asin}` }],
            images: [],
          };
        }
      });

      const results = await api.getProducts(["B0TEST1", "B0TEST2"]);

      expect(results).toHaveLength(2);
      const platformIds = results.map((r) => r.platformId).sort();
      expect(platformIds).toEqual(["B0TEST1", "B0TEST2"]);
    });
  });

  describe("getPricing", () => {
    it("should call Pricing API with correct parameters", async () => {
      mockClient.callAPI.mockResolvedValue({ payload: [] });

      await api.getProduct("B0TEST123");

      expect(mockClient.callAPI).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "getPricing",
          endpoint: "productPricing",
          query: expect.objectContaining({
            Asins: ["B0TEST123"],
            ItemType: "Asin",
          }),
        }),
      );
    });

    it("should extract price from offers", async () => {
      const mockPricing = {
        offers: [
          {
            Price: {
              LandedPrice: { Amount: 19.99 },
              ListingPrice: { Amount: 24.99 },
            },
          },
        ],
      };

      mockClient.callAPI.mockResolvedValueOnce({ payload: [mockPricing] }).mockResolvedValueOnce({
        identifiers: [{ identifiers: { ASIN: "B0TEST" } }],
        attributes: [{ name: "item_name", value: "Test" }],
        images: [],
      });

      const result = await api.getProduct("B0TEST");

      expect(result.price).toBe(19.99);
      expect(result.originalPrice).toBe(24.99);
    });
  });

  describe("getCatalogItem", () => {
    it("should call Catalog API with correct parameters", async () => {
      mockClient.callAPI.mockResolvedValueOnce({ payload: [] }).mockResolvedValueOnce({
        identifiers: [{ identifiers: { ASIN: "B0TEST" } }],
        attributes: [],
        images: [],
      });

      await api.getProduct("B0TEST");

      expect(mockClient.callAPI).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "getCatalogItem",
          endpoint: "catalogItems",
          path: { asin: "B0TEST" },
        }),
      );
    });

    it("should extract title from attributes", async () => {
      mockClient.callAPI.mockResolvedValueOnce({ payload: [] }).mockResolvedValueOnce({
        identifiers: [{ identifiers: { ASIN: "B0TEST" } }],
        attributes: [
          { name: "item_name", value: "Product Title" },
          { name: "brand", value: "Brand Name" },
        ],
        images: [],
      });

      const result = await api.getProduct("B0TEST");

      expect(result.title).toBe("Product Title");
      expect(result.shopName).toBe("Brand Name");
    });

    it("should extract images", async () => {
      mockClient.callAPI.mockResolvedValueOnce({ payload: [] }).mockResolvedValueOnce({
        identifiers: [{ identifiers: { ASIN: "B0TEST" } }],
        attributes: [{ name: "item_name", value: "Test" }],
        images: [{ url: "https://example.com/img1.jpg" }, { url: "https://example.com/img2.jpg" }],
      });

      const result = await api.getProduct("B0TEST");

      expect(result.images).toEqual([
        "https://example.com/img1.jpg",
        "https://example.com/img2.jpg",
      ]);
      expect(result.mainImage).toBe("https://example.com/img1.jpg");
    });
  });

  describe("data transformation", () => {
    it("should set correct platform", async () => {
      mockClient.callAPI.mockResolvedValueOnce({ payload: [] }).mockResolvedValueOnce({
        identifiers: [{ identifiers: { ASIN: "B0TEST" } }],
        attributes: [{ name: "item_name", value: "Test" }],
        images: [],
      });

      const result = await api.getProduct("B0TEST");

      expect(result.platform).toBe("amazon");
    });

    it("should generate correct source URL", async () => {
      mockClient.callAPI.mockResolvedValueOnce({ payload: [] }).mockResolvedValueOnce({
        identifiers: [{ identifiers: { ASIN: "B0ABCDEF" } }],
        attributes: [{ name: "item_name", value: "Test" }],
        images: [],
      });

      const result = await api.getProduct("B0ABCDEF");

      expect(result.sourceUrl).toBe("https://www.amazon.com/dp/B0ABCDEF");
    });

    it("should include extra data with raw responses", async () => {
      const mockPricing = { ASIN: "B0TEST", test: "pricing" };
      const mockCatalog = { test: "catalog" };

      mockClient.callAPI.mockResolvedValueOnce({ payload: [mockPricing] }).mockResolvedValueOnce({
        identifiers: [{ identifiers: { ASIN: "B0TEST" } }],
        attributes: [{ name: "item_name", value: "Test" }],
        images: [],
        ...mockCatalog,
      });

      const result = await api.getProduct("B0TEST");

      expect(result.extraData?.amazonPricing).toBeDefined();
      expect(result.extraData?.amazonCatalog).toBeDefined();
    });
  });
});
