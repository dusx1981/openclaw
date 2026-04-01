import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

describe("fetchCommand", () => {
  let fetchCommand: typeof import("../fetch-command.js").fetchCommand;
  let logs: string[];
  let errors: string[];
  let exitCode: number | undefined;
  let originalExit: typeof process.exit;

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
    const module = await import("../fetch-command.js");
    fetchCommand = module.fetchCommand;
  });

  afterEach(() => {
    process.exit = originalExit;
    vi.restoreAllMocks();
  });

  describe("successful fetch", () => {
    it("should fetch product and print JSON output", async () => {
      const mockUseCase = {
        execute: vi.fn().mockResolvedValue(mockFetchResult),
      };
      mocks.getFetchProductUseCase.mockReturnValue(mockUseCase);

      await fetchCommand("taobao", "12345", { json: true });

      expect(logs.length).toBe(1);
      const parsed = JSON.parse(logs[0]);
      expect(parsed.success).toBe(true);
      expect(parsed.data.platform).toBe("taobao");
      expect(parsed.data.platformId).toBe("12345");
    });

    it("should fetch product and print table output", async () => {
      const mockUseCase = {
        execute: vi.fn().mockResolvedValue(mockFetchResult),
      };
      mocks.getFetchProductUseCase.mockReturnValue(mockUseCase);

      await fetchCommand("taobao", "12345", { json: false });

      expect(logs.some((l) => l.includes("商品信息"))).toBe(true);
      expect(logs.some((l) => l.includes("平台") && l.includes("未知"))).toBe(true);
      expect(logs.some((l) => l.includes("标题") && l.includes("未知"))).toBe(true);
    });

    it("should initialize platform if not initialized", async () => {
      mocks.isPlatformInitialized.mockReturnValue(false);
      const mockUseCase = {
        execute: vi.fn().mockResolvedValue(mockFetchResult),
      };
      mocks.getFetchProductUseCase.mockReturnValue(mockUseCase);

      await fetchCommand("taobao", "12345", { json: true });

      expect(mocks.initializePlatform).toHaveBeenCalled();
    });
  });

  describe("platform validation", () => {
    it("should exit with error for unsupported platform", async () => {
      mocks.getPlatforms.mockReturnValue(["taobao", "amazon"]);

      await expect(fetchCommand("unsupported", "12345", { json: true })).rejects.toThrow(
        "process.exit(1)",
      );

      expect(exitCode).toBe(1);
      expect(errors.some((e) => e.includes("不支持的平台"))).toBe(true);
      expect(errors.some((e) => e.includes("支持的平台"))).toBe(true);
    });

    it("should show supported platforms list in error", async () => {
      mocks.getPlatforms.mockReturnValue(["taobao", "amazon", "douyin"]);

      await expect(fetchCommand("invalid", "12345", { json: true })).rejects.toThrow(
        "process.exit(1)",
      );

      expect(errors.some((e) => e.includes("taobao, amazon, douyin"))).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should exit with error when fetch fails (success=false)", async () => {
      const mockUseCase = {
        execute: vi.fn().mockResolvedValue({
          success: false,
          error: "Product not found",
          source: "taobao_api",
          latencyMs: 100,
          cached: false,
        }),
      };
      mocks.getFetchProductUseCase.mockReturnValue(mockUseCase);

      try {
        await fetchCommand("taobao", "12345", { json: true });
      } catch {
        expect(exitCode).toBe(1);
        expect(errors.some((e) => e.includes("获取商品失败"))).toBe(true);
      }
    });

    it("should handle useCase exceptions", async () => {
      const mockUseCase = {
        execute: vi.fn().mockRejectedValue(new Error("Network timeout")),
      };
      mocks.getFetchProductUseCase.mockReturnValue(mockUseCase);

      await expect(fetchCommand("taobao", "12345", { json: true })).rejects.toThrow(
        "process.exit(1)",
      );

      expect(exitCode).toBe(1);
      expect(errors.some((e) => e.includes("获取商品失败"))).toBe(true);
      expect(errors.some((e) => e.includes("Network timeout"))).toBe(true);
    });
  });

  describe("output formatting", () => {
    it("should show unknown for fields when result is passed directly", async () => {
      const mockUseCase = {
        execute: vi.fn().mockResolvedValue(mockFetchResult),
      };
      mocks.getFetchProductUseCase.mockReturnValue(mockUseCase);

      await fetchCommand("taobao", "12345", { json: false });

      expect(logs.some((l) => l.includes("商品信息"))).toBe(true);
      expect(logs.some((l) => l.includes("销量") && l.includes("未知"))).toBe(true);
    });

    it("should show unknown for missing fields in minimal product", async () => {
      const minimalProduct: ProductData = {
        platform: "taobao",
        platformId: "12345",
        title: "Minimal Product",
        sourceUrl: "https://item.taobao.com/item.htm?id=12345",
        price: 50,
        currency: "CNY",
        sales: 0,
        salesPeriod: "month",
        status: "active",
        priority: "P2",
        isTrending: false,
      };
      const mockUseCase = {
        execute: vi.fn().mockResolvedValue({
          success: true,
          data: minimalProduct,
          source: "taobao_api",
          latencyMs: 100,
          cached: false,
        }),
      };
      mocks.getFetchProductUseCase.mockReturnValue(mockUseCase);

      await fetchCommand("taobao", "12345", { json: false });

      expect(logs.some((l) => l.includes("销量") && l.includes("未知"))).toBe(true);
    });
  });
});
