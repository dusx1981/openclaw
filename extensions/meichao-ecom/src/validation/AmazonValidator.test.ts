import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FetchResult, ProductData, FailoverFetchResult } from "../../domain/types.js";
import { AmazonValidator } from "./AmazonValidator.js";

vi.mock("../../infrastructure/adapters/AmazonAdapter.js", () => {
  const mockFetchWithFailover = vi.fn();
  const mockFetchProduct = vi.fn();

  return {
    AmazonAdapter: {
      create: () => ({
        fetchWithFailover: mockFetchWithFailover,
        fetchProduct: mockFetchProduct,
      }),
    },
  };
});

describe("AmazonValidator", () => {
  let validator: AmazonValidator;
  let mockFetchWithFailover: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    validator = new AmazonValidator();

    const adapter = await import("../../infrastructure/adapters/AmazonAdapter.js");
    mockFetchWithFailover = (adapter.AmazonAdapter.create() as any).fetchWithFailover;
  });

  const createSuccessFetchResult = (
    productId: string,
  ): FailoverFetchResult<FetchResult<ProductData>> => ({
    data: {
      success: true,
      data: {
        platform: "amazon",
        platformId: productId,
        title: `Amazon Product ${productId}`,
        price: 29.99,
        currency: "USD",
        sourceUrl: `https://amazon.com/dp/${productId}`,
        sales: 500,
        salesPeriod: "month",
        status: "active",
        priority: "P1",
        isTrending: false,
      },
      source: "amazon_sp_api",
      latencyMs: 150,
      cached: false,
    },
    source: "amazon_sp_api",
    attempts: [],
    totalLatencyMs: 150,
    degradationLevel: "primary_source",
  });

  const createFailedFetchResult = (): FailoverFetchResult<FetchResult<ProductData>> => ({
    data: {
      success: false,
      error: "rate_limit",
      source: "amazon_sp_api",
      latencyMs: 200,
      cached: false,
    },
    source: "amazon_sp_api",
    attempts: [],
    totalLatencyMs: 200,
    degradationLevel: "primary_source",
  });

  describe("validate", () => {
    it("should validate products and return result", async () => {
      mockFetchWithFailover.mockResolvedValue(createSuccessFetchResult("B0ABCDEFGH"));

      const result = await validator.validate({ count: 3 });

      expect(result.platform).toBe("amazon");
      expect(result.stats.total).toBe(3);
      expect(mockFetchWithFailover).toHaveBeenCalledTimes(3);
    });

    it("should track success rate", async () => {
      mockFetchWithFailover
        .mockResolvedValueOnce(createSuccessFetchResult("B001"))
        .mockResolvedValueOnce(createFailedFetchResult())
        .mockResolvedValueOnce(createSuccessFetchResult("B003"));

      const result = await validator.validate({ count: 3 });

      expect(result.stats.successes).toBe(2);
      expect(result.stats.failures).toBe(1);
    });

    it("should collect samples", async () => {
      mockFetchWithFailover.mockResolvedValue(createSuccessFetchResult("B0TEST1234"));

      const result = await validator.validate({ count: 5 });

      expect(result.samples.length).toBeLessThanOrEqual(5);
    });

    it("should generate Amazon ASINs", async () => {
      mockFetchWithFailover.mockResolvedValue(createSuccessFetchResult("B0TEST1234"));

      await validator.validate({ count: 1 });

      const callArg = mockFetchWithFailover.mock.calls[0];
      expect(callArg).toBeDefined();
    });
  });
});
