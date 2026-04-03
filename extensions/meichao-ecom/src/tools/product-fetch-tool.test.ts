import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FetchResult, ProductData } from "../../domain/types.js";

const mocks = vi.hoisted(() => ({
  initializePlatform: vi.fn(),
  isPlatformInitialized: vi.fn().mockReturnValue(true),
  getFetchProductUseCase: vi.fn(),
  getPlatforms: vi.fn().mockReturnValue(["taobao", "amazon"]),
}));

vi.mock("../../application/bootstrap.js", () => ({
  initializePlatform: mocks.initializePlatform,
  isPlatformInitialized: mocks.isPlatformInitialized,
  getFetchProductUseCase: mocks.getFetchProductUseCase,
}));

vi.mock("../../infrastructure/registry/PlatformRegistry.js", () => ({
  PlatformRegistry: {
    getPlatforms: mocks.getPlatforms,
  },
}));

describe("createProductFetchTool", () => {
  let createProductFetchTool: typeof import("../product-fetch-tool.js").createProductFetchTool;
  let tool: ReturnType<typeof createProductFetchTool>;
  let logs: string[];
  let errors: string[];

  const mockProduct: ProductData = {
    platform: "taobao",
    platformId: "12345",
    title: "Test Product",
    sourceUrl: "https://item.taobao.com/item.htm?id=12345",
    price: 99.99,
    currency: "CNY",
    sales: 1000,
    salesPeriod: "month",
    status: "active",
    priority: "P1",
    isTrending: false,
    rating: 4.5,
    reviewsCount: 100,
    shopName: "Test Shop",
    shopId: "shop-001",
    categoryName: "Food",
  };

  const mockFetchResult: FetchResult<ProductData> = {
    success: true,
    data: mockProduct,
    source: "taobao_api",
    latencyMs: 150,
    cached: false,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    logs = [];
    errors = [];

    mocks.isPlatformInitialized.mockReturnValue(true);
    mocks.getPlatforms.mockReturnValue(["taobao", "amazon"]);

    const mockLogger = {
      info: (msg: string) => logs.push(msg),
      error: (msg: string) => errors.push(msg),
    };

    const api = { logger: mockLogger } as unknown as Parameters<typeof createProductFetchTool>[0];

    const module = await import("../product-fetch-tool.js");
    createProductFetchTool = module.createProductFetchTool;
    tool = createProductFetchTool(api);
  });

  describe("tool definition", () => {
    it("should have correct name and label", () => {
      expect(tool.name).toBe("ecom-product-fetch");
      expect(tool.label).toBe("E-commerce Product Fetch");
    });

    it("should have description", () => {
      expect(tool.description).toContain("Fetch detailed product data");
      expect(tool.description).toContain("e-commerce platform");
    });

    it("should have parameters schema", () => {
      expect(tool.parameters).toBeDefined();
    });
  });

  describe("execute", () => {
    it("should fetch product successfully", async () => {
      const mockUseCase = {
        execute: vi.fn().mockResolvedValue(mockFetchResult),
      };
      mocks.getFetchProductUseCase.mockReturnValue(mockUseCase);

      const result = await tool.execute("call-1", {
        platform: "taobao",
        productId: "12345",
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe("text");

      const text = result.content[0].text;
      const parsed = JSON.parse(text as string);
      expect(parsed.success).toBe(true);
      expect(parsed.product.platform).toBe("taobao");
      expect(parsed.product.platformId).toBe("12345");
      expect(parsed.product.title).toBe("Test Product");
      expect(parsed.source).toBe("taobao_api");
      expect(parsed.latencyMs).toBe(150);
    });

    it("should initialize platform if not initialized", async () => {
      mocks.isPlatformInitialized.mockReturnValue(false);
      const mockUseCase = {
        execute: vi.fn().mockResolvedValue(mockFetchResult),
      };
      mocks.getFetchProductUseCase.mockReturnValue(mockUseCase);

      await tool.execute("call-2", {
        platform: "taobao",
        productId: "12345",
      });

      expect(mocks.initializePlatform).toHaveBeenCalled();
    });

    it("should log info messages", async () => {
      const mockUseCase = {
        execute: vi.fn().mockResolvedValue(mockFetchResult),
      };
      mocks.getFetchProductUseCase.mockReturnValue(mockUseCase);

      await tool.execute("call-3", {
        platform: "taobao",
        productId: "12345",
      });

      expect(logs.some((l) => l.includes("Fetching product"))).toBe(true);
      expect(logs.some((l) => l.includes("Successfully fetched"))).toBe(true);
    });

    it("should throw error when platform is missing", async () => {
      await expect(tool.execute("call-4", { productId: "12345" })).rejects.toThrow(
        "platform is required",
      );
    });

    it("should throw error when productId is missing", async () => {
      await expect(tool.execute("call-5", { platform: "taobao" })).rejects.toThrow(
        "productId is required",
      );
    });

    it("should throw error for unsupported platform", async () => {
      mocks.getPlatforms.mockReturnValue(["taobao", "amazon"]);

      await expect(
        tool.execute("call-6", { platform: "unsupported", productId: "12345" }),
      ).rejects.toThrow("Unsupported platform: unsupported");
    });

    it("should throw error when fetch fails", async () => {
      const mockUseCase = {
        execute: vi.fn().mockResolvedValue({
          success: false,
          error: "API error",
          source: "taobao_api",
          latencyMs: 100,
          cached: false,
        }),
      };
      mocks.getFetchProductUseCase.mockReturnValue(mockUseCase);

      await expect(
        tool.execute("call-7", { platform: "taobao", productId: "12345" }),
      ).rejects.toThrow("Failed to fetch product");
    });

    it("should handle and log errors", async () => {
      const mockUseCase = {
        execute: vi.fn().mockRejectedValue(new Error("Network error")),
      };
      mocks.getFetchProductUseCase.mockReturnValue(mockUseCase);

      await expect(
        tool.execute("call-8", { platform: "taobao", productId: "12345" }),
      ).rejects.toThrow();

      expect(errors.some((e) => e.includes("Failed to fetch product"))).toBe(true);
    });

    it("should trim whitespace from parameters", async () => {
      const mockUseCase = {
        execute: vi.fn().mockResolvedValue(mockFetchResult),
      };
      mocks.getFetchProductUseCase.mockReturnValue(mockUseCase);

      await tool.execute("call-9", {
        platform: "  taobao  ",
        productId: "  12345  ",
      });

      expect(mockUseCase.execute).toHaveBeenCalledWith("taobao", "12345");
    });

    it("should return cached flag in result", async () => {
      const cachedResult: FetchResult<ProductData> = {
        ...mockFetchResult,
        cached: true,
        source: "cache",
      };
      const mockUseCase = {
        execute: vi.fn().mockResolvedValue(cachedResult),
      };
      mocks.getFetchProductUseCase.mockReturnValue(mockUseCase);

      const result = await tool.execute("call-10", {
        platform: "taobao",
        productId: "12345",
      });

      const parsed = JSON.parse(result.content[0].text as string);
      expect(parsed.cached).toBe(true);
    });
  });
});
