import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SearchProductsUseCaseResult } from "../../application/use-cases/SearchProductsUseCase.js";
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

describe("searchCommand", () => {
  let searchCommand: typeof import("../search-command.js").searchCommand;
  let logs: string[];
  let errors: string[];
  let exitCode: number | undefined;
  let originalExit: typeof process.exit;

  const mockProducts: ProductData[] = [
    {
      platform: "taobao",
      platformId: "prod-001",
      title: "Test Product One",
      sourceUrl: "https://item.taobao.com/item.htm?id=prod-001",
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
      platformId: "prod-002",
      title: "Test Product Two",
      sourceUrl: "https://item.taobao.com/item.htm?id=prod-002",
      price: 50,
      currency: "CNY",
      sales: 500,
      salesPeriod: "month",
      status: "active",
      priority: "P2",
      isTrending: false,
    },
  ];

  const mockSearchResult: SearchProductsUseCaseResult = {
    products: mockProducts,
    total: 2,
    page: 1,
    pageSize: 50,
    source: "taobao_api",
    latencyMs: 150,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    logs = [];
    errors = [];
    exitCode = undefined;

    originalExit = process.exit;
    process.exit = vi.fn((code: number) => {
      exitCode = code;
      throw new Error(`process.exit(${code})`);
    }) as unknown as typeof process.exit;

    console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));
    console.error = (...args: unknown[]) => errors.push(args.map(String).join(" "));

    mocks.isPlatformInitialized.mockReturnValue(true);
    mocks.getPlatforms.mockReturnValue(["taobao", "amazon"]);

    vi.resetModules();
    const module = await import("../search-command.js");
    searchCommand = module.searchCommand;
  });

  afterEach(() => {
    process.exit = originalExit;
    vi.restoreAllMocks();
  });

  describe("successful search", () => {
    it("should search products and print JSON output", async () => {
      const mockUseCase = {
        execute: vi.fn().mockResolvedValue(mockSearchResult),
      };
      mocks.getSearchProductsUseCase.mockReturnValue(mockUseCase);

      await searchCommand("taobao", "test", { json: true });

      expect(logs.length).toBe(1);
      const parsed = JSON.parse(logs[0]);
      expect(parsed.products).toHaveLength(2);
      expect(parsed.total).toBe(2);
      expect(parsed.source).toBe("taobao_api");
    });

    it("should search products and print table output", async () => {
      const mockUseCase = {
        execute: vi.fn().mockResolvedValue(mockSearchResult),
      };
      mocks.getSearchProductsUseCase.mockReturnValue(mockUseCase);

      await searchCommand("taobao", "test", { json: false });

      expect(logs.some((l) => l.includes("搜索"))).toBe(true);
      expect(logs.some((l) => l.includes("test"))).toBe(true);
      expect(logs.some((l) => l.includes("共 2 条"))).toBe(true);
    });

    it("should initialize platform if not initialized", async () => {
      mocks.isPlatformInitialized.mockReturnValue(false);
      const mockUseCase = {
        execute: vi.fn().mockResolvedValue(mockSearchResult),
      };
      mocks.getSearchProductsUseCase.mockReturnValue(mockUseCase);

      await searchCommand("taobao", "test", { json: true });

      expect(mocks.initializePlatform).toHaveBeenCalled();
    });

    it("should use default limit of 50", async () => {
      const mockUseCase = {
        execute: vi.fn().mockResolvedValue(mockSearchResult),
      };
      mocks.getSearchProductsUseCase.mockReturnValue(mockUseCase);

      await searchCommand("taobao", "test", {});

      expect(mockUseCase.execute).toHaveBeenCalledWith("taobao", "test", {
        pageSize: 50,
      });
    });

    it("should clamp limit to max 100", async () => {
      const mockUseCase = {
        execute: vi.fn().mockResolvedValue(mockSearchResult),
      };
      mocks.getSearchProductsUseCase.mockReturnValue(mockUseCase);

      await searchCommand("taobao", "test", { limit: 200 });

      expect(mockUseCase.execute).toHaveBeenCalledWith("taobao", "test", {
        pageSize: 100,
      });
    });

    it("should use specified limit when under max", async () => {
      const mockUseCase = {
        execute: vi.fn().mockResolvedValue(mockSearchResult),
      };
      mocks.getSearchProductsUseCase.mockReturnValue(mockUseCase);

      await searchCommand("taobao", "test", { limit: 25 });

      expect(mockUseCase.execute).toHaveBeenCalledWith("taobao", "test", {
        pageSize: 25,
      });
    });
  });

  describe("platform validation", () => {
    it("should exit with error for unsupported platform", async () => {
      mocks.getPlatforms.mockReturnValue(["taobao", "amazon"]);

      try {
        await searchCommand("unsupported", "test", { json: true });
      } catch {
        expect(exitCode).toBe(1);
        expect(errors.some((e) => e.includes("不支持的平台"))).toBe(true);
        expect(errors.some((e) => e.includes("支持的平台"))).toBe(true);
      }
    });

    it("should show supported platforms list in error", async () => {
      mocks.getPlatforms.mockReturnValue(["taobao", "amazon", "douyin"]);

      try {
        await searchCommand("invalid", "test", { json: true });
      } catch {
        expect(errors.some((e) => e.includes("taobao, amazon, douyin"))).toBe(true);
      }
    });
  });

  describe("error handling", () => {
    it("should exit with error when search fails", async () => {
      const mockUseCase = {
        execute: vi.fn().mockRejectedValue(new Error("Search API error")),
      };
      mocks.getSearchProductsUseCase.mockReturnValue(mockUseCase);

      try {
        await searchCommand("taobao", "test", { json: true });
      } catch {
        expect(exitCode).toBe(1);
        expect(errors.some((e) => e.includes("搜索商品失败"))).toBe(true);
        expect(errors.some((e) => e.includes("Search API error"))).toBe(true);
      }
    });
  });

  describe("output formatting", () => {
    it("should show empty results message when no products", async () => {
      const emptyResult: SearchProductsUseCaseResult = {
        products: [],
        total: 0,
        page: 1,
        pageSize: 50,
        source: "taobao_api",
        latencyMs: 100,
      };
      const mockUseCase = {
        execute: vi.fn().mockResolvedValue(emptyResult),
      };
      mocks.getSearchProductsUseCase.mockReturnValue(mockUseCase);

      await searchCommand("taobao", "nonexistent", { json: false });

      expect(logs.some((l) => l.includes("未找到匹配的商品"))).toBe(true);
    });

    it("should truncate long titles", async () => {
      const longTitleResult: SearchProductsUseCaseResult = {
        products: [
          {
            platform: "taobao",
            platformId: "prod-001",
            title:
              "This is a very long product title that should be truncated in the output display",
            sourceUrl: "https://item.taobao.com/item.htm?id=prod-001",
            price: 99.99,
            currency: "CNY",
            sales: 1000,
            salesPeriod: "month",
            status: "active",
            priority: "P1",
            isTrending: false,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 50,
        source: "taobao_api",
        latencyMs: 150,
      };
      const mockUseCase = {
        execute: vi.fn().mockResolvedValue(longTitleResult),
      };
      mocks.getSearchProductsUseCase.mockReturnValue(mockUseCase);

      await searchCommand("taobao", "test", { json: false });

      expect(logs.some((l) => l.includes("标题"))).toBe(true);
      expect(logs.some((l) => l.includes("..."))).toBe(true);
    });

    it("should show product details for each item", async () => {
      const mockUseCase = {
        execute: vi.fn().mockResolvedValue(mockSearchResult),
      };
      mocks.getSearchProductsUseCase.mockReturnValue(mockUseCase);

      await searchCommand("taobao", "test", { json: false });

      expect(logs.some((l) => l.includes("prod-001"))).toBe(true);
      expect(logs.some((l) => l.includes("Test Product One"))).toBe(true);
      expect(logs.some((l) => l.includes("99.99"))).toBe(true);
    });

    it("should show unknown for missing fields", async () => {
      const incompleteResult: SearchProductsUseCaseResult = {
        products: [
          {
            platform: "taobao",
            platformId: "prod-001",
            title: "Incomplete Product",
            sourceUrl: "https://item.taobao.com/item.htm?id=prod-001",
            price: 50,
            currency: "CNY",
            sales: 0,
            salesPeriod: "month",
            status: "active",
            priority: "P2",
            isTrending: false,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 50,
        source: "taobao_api",
        latencyMs: 100,
      };
      const mockUseCase = {
        execute: vi.fn().mockResolvedValue(incompleteResult),
      };
      mocks.getSearchProductsUseCase.mockReturnValue(mockUseCase);

      await searchCommand("taobao", "test", { json: false });

      expect(logs.some((l) => l.includes("销量") && l.includes("0"))).toBe(true);
    });
  });
});
