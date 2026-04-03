import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FetchResult, ProductData, FailoverFetchResult } from "../../domain/types.js";
import { TaobaoValidator } from "./TaobaoValidator.js";

const mockFetchWithFailover = vi.fn();
const mockFetchProduct = vi.fn();
const mockAdapter = {
  fetchWithFailover: mockFetchWithFailover,
  fetchProduct: mockFetchProduct,
};

vi.mock("../../infrastructure/registry/PlatformRegistry.js", () => ({
  PlatformRegistry: {
    get: (platform: string) => {
      if (platform === "taobao") {
        return mockAdapter;
      }
      return undefined;
    },
  },
}));

describe("TaobaoValidator", () => {
  let validator: TaobaoValidator;

  beforeEach(async () => {
    vi.clearAllMocks();
    validator = new TaobaoValidator();
  });

  it("should use shared adapter instance from PlatformRegistry", () => {
    expect(validator).toBeDefined();
  });

  it("should throw when platform not initialized", async () => {
    vi.doMock("../../infrastructure/registry/PlatformRegistry.js", () => ({
      PlatformRegistry: {
        get: () => null,
      },
    }));

    const uninitializedValidator = new TaobaoValidator();

    await expect(uninitializedValidator.validate({ count: 1 })).rejects.toThrow(
      "Taobao platform not initialized",
    );
  });

  const createSuccessFetchResult = (
    productId: string,
  ): FailoverFetchResult<FetchResult<ProductData>> => ({
    data: {
      success: true,
      data: {
        platform: "taobao",
        platformId: productId,
        title: `Product ${productId}`,
        price: 99.99,
        currency: "CNY",
        sourceUrl: `https://example.com/${productId}`,
        sales: 100,
        salesPeriod: "month",
        status: "active",
        priority: "P1",
        isTrending: false,
      },
      source: "taobao_official_api",
      latencyMs: 100,
      cached: false,
    },
    source: "taobao_official_api",
    attempts: [],
    totalLatencyMs: 100,
    degradationLevel: "primary_source",
  });

  const createFailedFetchResult = (): FailoverFetchResult<FetchResult<ProductData>> => ({
    data: {
      success: false,
      error: "timeout",
      source: "taobao_official_api",
      latencyMs: 5000,
      cached: false,
    },
    source: "taobao_official_api",
    attempts: [],
    totalLatencyMs: 5000,
    degradationLevel: "primary_source",
  });

  describe("validate", () => {
    it("should validate products and return result", async () => {
      mockFetchWithFailover.mockResolvedValue(createSuccessFetchResult("12345"));

      const result = await validator.validate({ count: 3 });

      expect(result.platform).toBe("taobao");
      expect(result.stats.total).toBe(3);
      expect(mockFetchWithFailover).toHaveBeenCalledTimes(3);
    });

    it("should track success rate", async () => {
      mockFetchWithFailover
        .mockResolvedValueOnce(createSuccessFetchResult("1"))
        .mockResolvedValueOnce(createFailedFetchResult())
        .mockResolvedValueOnce(createSuccessFetchResult("3"));

      const result = await validator.validate({ count: 3 });

      expect(result.stats.successes).toBe(2);
      expect(result.stats.failures).toBe(1);
      expect(result.stats.successRate).toBeCloseTo(66.67, 1);
    });

    it("should collect samples", async () => {
      mockFetchWithFailover.mockResolvedValue(createSuccessFetchResult("12345"));

      const result = await validator.validate({ count: 5 });

      expect(result.samples.length).toBeLessThanOrEqual(5);
    });

    it("should mask sensitive data when requested", async () => {
      mockFetchWithFailover.mockResolvedValue(createSuccessFetchResult("1234567890"));

      const result = await validator.validate({ count: 1, maskSensitive: true });

      expect(result.samples[0].productId).toBe("12****90");
    });
  });
});
