import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ProductData } from "../../domain/types.js";

const mocks = vi.hoisted(() => ({
  initializePlatform: vi.fn(),
  isPlatformInitialized: vi.fn().mockReturnValue(true),
  getSearchProductsUseCase: vi.fn(),
  getPlatforms: vi.fn().mockReturnValue(["taobao", "amazon"]),
}));

vi.mock("../../application/bootstrap.js", () => ({
  initializePlatform: mocks.initializePlatform,
  isPlatformInitialized: mocks.isPlatformInitialized,
  getSearchProductsUseCase: mocks.getSearchProductsUseCase,
}));

vi.mock("../../infrastructure/registry/PlatformRegistry.js", () => ({
  PlatformRegistry: {
    getPlatforms: mocks.getPlatforms,
  },
}));

describe("createProductSearchTool", () => {
  let createProductSearchTool: typeof import("../product-search-tool.js").createProductSearchTool;
  let tool: ReturnType<typeof createProductSearchTool>;
  let logs: string[];
  let errors: string[];

  const mockProducts: ProductData[] = [
    {
      platform: "taobao",
      platformId: "12345",
      title: "Test Product 1",
      sourceUrl: "https://item.taobao.com/item.htm?id=12345",
      price: 99.99,
      currency: "CNY",
      sales: 1000,
      salesPeriod: "month",
      status: "active",
      priority: "P1",
      isTrending: true,
    },
    {
      platform: "taobao",
      platformId: "67890",
      title: "Test Product 2",
      sourceUrl: "https://item.taobao.com/item.htm?id=67890",
      price: 199.99,
      currency: "CNY",
      sales: 500,
      salesPeriod: "month",
      status: "active",
      priority: "P2",
      isTrending: false,
    },
  ];

  const mockSearchResult = {
    products: mockProducts,
    total: 2,
    page: 1,
    pageSize: 50,
    source: "taobao_api",
    latencyMs: 200,
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

    const api = { logger: mockLogger } as unknown as Parameters<typeof createProductSearchTool>[0];

    const module = await import("../product-search-tool.js");
    createProductSearchTool = module.createProductSearchTool;
    tool = createProductSearchTool(api);
  });

  describe("tool definition", () => {
    it("should have correct name and label", () => {
      expect(tool.name).toBe("ecom-product-search");
      expect(tool.label).toBe("E-commerce Product Search");
    });

    it("should have description", () => {
      expect(tool.description).toContain("Search for products");
      expect(tool.description).toContain("keyword");
    });

    it("should have parameters schema", () => {
      expect(tool.parameters).toBeDefined();
    });
  });

  describe("execute", () => {
    it("should search products successfully", async () => {
      const mockUseCase = {
        execute: vi.fn().mockResolvedValue(mockSearchResult),
      };
      mocks.getSearchProductsUseCase.mockReturnValue(mockUseCase);

      const result = await tool.execute("call-1", {
        platform: "taobao",
        keyword: "龙虾",
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe("text");

      const text = result.content[0].text;
      const parsed = JSON.parse(text as string);
      expect(parsed.success).toBe(true);
      expect(parsed.search.platform).toBe("taobao");
      expect(parsed.search.keyword).toBe("龙虾");
      expect(parsed.products).toHaveLength(2);
      expect(parsed.results.total).toBe(2);
    });

    it("should apply default limit of 50", async () => {
      const mockUseCase = {
        execute: vi.fn().mockResolvedValue(mockSearchResult),
      };
      mocks.getSearchProductsUseCase.mockReturnValue(mockUseCase);

      await tool.execute("call-2", {
        platform: "taobao",
        keyword: "test",
      });

      expect(mockUseCase.execute).toHaveBeenCalledWith(
        "taobao",
        "test",
        expect.objectContaining({ pageSize: 50 }),
      );
    });

    it("should apply custom limit", async () => {
      const mockUseCase = {
        execute: vi.fn().mockResolvedValue(mockSearchResult),
      };
      mocks.getSearchProductsUseCase.mockReturnValue(mockUseCase);

      await tool.execute("call-3", {
        platform: "taobao",
        keyword: "test",
        limit: 20,
      });

      expect(mockUseCase.execute).toHaveBeenCalledWith(
        "taobao",
        "test",
        expect.objectContaining({ pageSize: 20 }),
      );
    });

    it("should cap limit at 100", async () => {
      const mockUseCase = {
        execute: vi.fn().mockResolvedValue(mockSearchResult),
      };
      mocks.getSearchProductsUseCase.mockReturnValue(mockUseCase);

      await tool.execute("call-4", {
        platform: "taobao",
        keyword: "test",
        limit: 200,
      });

      expect(mockUseCase.execute).toHaveBeenCalledWith(
        "taobao",
        "test",
        expect.objectContaining({ pageSize: 100 }),
      );
    });

    it("should initialize platform if not initialized", async () => {
      mocks.isPlatformInitialized.mockReturnValue(false);
      const mockUseCase = {
        execute: vi.fn().mockResolvedValue(mockSearchResult),
      };
      mocks.getSearchProductsUseCase.mockReturnValue(mockUseCase);

      await tool.execute("call-5", {
        platform: "taobao",
        keyword: "test",
      });

      expect(mocks.initializePlatform).toHaveBeenCalled();
    });

    it("should log info messages", async () => {
      const mockUseCase = {
        execute: vi.fn().mockResolvedValue(mockSearchResult),
      };
      mocks.getSearchProductsUseCase.mockReturnValue(mockUseCase);

      await tool.execute("call-6", {
        platform: "taobao",
        keyword: "test",
      });

      expect(logs.some((l) => l.includes("Searching products"))).toBe(true);
      expect(logs.some((l) => l.includes("Found"))).toBe(true);
    });

    it("should throw error when platform is missing", async () => {
      await expect(tool.execute("call-7", { keyword: "test" })).rejects.toThrow(
        "platform is required",
      );
    });

    it("should throw error when keyword is missing", async () => {
      await expect(tool.execute("call-8", { platform: "taobao" })).rejects.toThrow(
        "keyword is required",
      );
    });

    it("should throw error for unsupported platform", async () => {
      mocks.getPlatforms.mockReturnValue(["taobao", "amazon"]);

      await expect(
        tool.execute("call-9", { platform: "unsupported", keyword: "test" }),
      ).rejects.toThrow("Unsupported platform: unsupported");
    });

    it("should handle and log errors", async () => {
      const mockUseCase = {
        execute: vi.fn().mockRejectedValue(new Error("Network error")),
      };
      mocks.getSearchProductsUseCase.mockReturnValue(mockUseCase);

      await expect(
        tool.execute("call-10", { platform: "taobao", keyword: "test" }),
      ).rejects.toThrow();

      expect(errors.some((e) => e.includes("Failed to search products"))).toBe(true);
    });

    it("should trim whitespace from parameters", async () => {
      const mockUseCase = {
        execute: vi.fn().mockResolvedValue(mockSearchResult),
      };
      mocks.getSearchProductsUseCase.mockReturnValue(mockUseCase);

      await tool.execute("call-11", {
        platform: "  taobao  ",
        keyword: "  test  ",
      });

      expect(mockUseCase.execute).toHaveBeenCalledWith("taobao", "test", expect.any(Object));
    });

    it("should return source and latencyMs in result", async () => {
      const mockUseCase = {
        execute: vi.fn().mockResolvedValue(mockSearchResult),
      };
      mocks.getSearchProductsUseCase.mockReturnValue(mockUseCase);

      const result = await tool.execute("call-12", {
        platform: "taobao",
        keyword: "test",
      });

      const parsed = JSON.parse(result.content[0].text as string);
      expect(parsed.source).toBe("taobao_api");
      expect(parsed.latencyMs).toBe(200);
    });
  });
});
