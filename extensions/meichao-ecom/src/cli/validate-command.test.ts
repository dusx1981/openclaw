import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => ({
  initializePlatform: vi.fn(),
  isPlatformInitialized: vi.fn().mockReturnValue(true),
  getValidatorRegistry: vi.fn(),
  getPlatforms: vi.fn().mockReturnValue(["taobao", "amazon"]),
}));

vi.mock("../application/bootstrap.js", () => ({
  initializePlatform: mocks.initializePlatform,
  isPlatformInitialized: mocks.isPlatformInitialized,
  getValidatorRegistry: mocks.getValidatorRegistry,
}));

vi.mock("../infrastructure/registry/PlatformRegistry.js", () => ({
  PlatformRegistry: {
    getPlatforms: mocks.getPlatforms,
  },
}));

describe("validateCommand", () => {
  let validateCommand: typeof import("./validate-command.js").validateCommand;
  let logs: string[];
  let errors: string[];
  let exitCode: number | undefined;
  let originalExit: typeof process.exit;

  function createMockReport(successRate = 0.85) {
    return {
      stats: {
        successRate,
        totalRequests: 10,
        successfulRequests: Math.round(10 * successRate),
        failedRequests: Math.round(10 * (1 - successRate)),
      },
      degradation: {
        count: 1,
        paths: [["taobao_api", "taobao_scrape"]],
      },
      samples: [
        { productId: "prod-001", source: "taobao_api" },
        { productId: "prod-002", source: "taobao_scrape" },
      ],
    };
  }

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
    const module = await import("./validate-command.js");
    validateCommand = module.validateCommand;
  });

  afterEach(() => {
    process.exit = originalExit;
    vi.restoreAllMocks();
  });

  describe("single platform validation", () => {
    it("should validate platform and print JSON output", async () => {
      const mockReport = createMockReport();
      const mockValidator = {
        validate: vi.fn().mockResolvedValue(mockReport),
      };
      const mockRegistry = {
        getValidator: vi.fn().mockReturnValue(mockValidator),
      };
      mocks.getValidatorRegistry.mockReturnValue(mockRegistry);

      await validateCommand("taobao", { json: true });

      expect(logs.length).toBe(1);
      const parsed = JSON.parse(logs[0]);
      expect(parsed.stats.successRate).toBe(0.85);
      expect(parsed.stats.totalRequests).toBe(10);
    });

    it("should validate platform and print report", async () => {
      const mockReport = createMockReport(0.9);
      const mockValidator = {
        validate: vi.fn().mockResolvedValue(mockReport),
      };
      const mockRegistry = {
        getValidator: vi.fn().mockReturnValue(mockValidator),
      };
      mocks.getValidatorRegistry.mockReturnValue(mockRegistry);

      await validateCommand("taobao", { json: false });

      expect(logs.some((l) => l.includes("taobao 平台验证报告"))).toBe(true);
      expect(logs.some((l) => l.includes("成功率"))).toBe(true);
      expect(logs.some((l) => l.includes("90%"))).toBe(true);
    });

    it("should initialize platform if not initialized", async () => {
      mocks.isPlatformInitialized.mockReturnValue(false);
      const mockReport = createMockReport();
      const mockValidator = {
        validate: vi.fn().mockResolvedValue(mockReport),
      };
      const mockRegistry = {
        getValidator: vi.fn().mockReturnValue(mockValidator),
      };
      mocks.getValidatorRegistry.mockReturnValue(mockRegistry);

      await validateCommand("taobao", { json: true });

      expect(mocks.initializePlatform).toHaveBeenCalled();
    });

    it("should use default count of 10", async () => {
      const mockReport = createMockReport();
      const mockValidator = {
        validate: vi.fn().mockResolvedValue(mockReport),
      };
      const mockRegistry = {
        getValidator: vi.fn().mockReturnValue(mockValidator),
      };
      mocks.getValidatorRegistry.mockReturnValue(mockRegistry);

      await validateCommand("taobao", {});

      expect(mockValidator.validate).toHaveBeenCalledWith(10);
    });

    it("should clamp count to max 100", async () => {
      const mockReport = createMockReport();
      const mockValidator = {
        validate: vi.fn().mockResolvedValue(mockReport),
      };
      const mockRegistry = {
        getValidator: vi.fn().mockReturnValue(mockValidator),
      };
      mocks.getValidatorRegistry.mockReturnValue(mockRegistry);

      await validateCommand("taobao", { count: 200 });

      expect(mockValidator.validate).toHaveBeenCalledWith(100);
    });

    it("should use specified count when under max", async () => {
      const mockReport = createMockReport();
      const mockValidator = {
        validate: vi.fn().mockResolvedValue(mockReport),
      };
      const mockRegistry = {
        getValidator: vi.fn().mockReturnValue(mockValidator),
      };
      mocks.getValidatorRegistry.mockReturnValue(mockRegistry);

      await validateCommand("taobao", { count: 25 });

      expect(mockValidator.validate).toHaveBeenCalledWith(25);
    });

    it("should exit with error for unsupported platform", async () => {
      mocks.getPlatforms.mockReturnValue(["taobao", "amazon"]);

      try {
        await validateCommand("unsupported", { json: true });
      } catch {
        expect(exitCode).toBe(1);
        expect(errors.some((e) => e.includes("不支持的平台"))).toBe(true);
      }
    });

    it("should exit with error when no validator registered", async () => {
      const mockRegistry = {
        getValidator: vi.fn().mockReturnValue(undefined),
      };
      mocks.getValidatorRegistry.mockReturnValue(mockRegistry);

      try {
        await validateCommand("taobao", { json: true });
      } catch {
        expect(exitCode).toBe(1);
        expect(errors.some((e) => e.includes("没有注册验证器"))).toBe(true);
      }
    });

    it("should exit with error when validation fails", async () => {
      const mockValidator = {
        validate: vi.fn().mockRejectedValue(new Error("Validation API error")),
      };
      const mockRegistry = {
        getValidator: vi.fn().mockReturnValue(mockValidator),
      };
      mocks.getValidatorRegistry.mockReturnValue(mockRegistry);

      try {
        await validateCommand("taobao", { json: true });
      } catch {
        expect(exitCode).toBe(1);
        expect(errors.some((e) => e.includes("验证平台失败"))).toBe(true);
      }
    });

    it("should exit with error when platform not specified and --all not used", async () => {
      try {
        await validateCommand(undefined, { json: true });
      } catch {
        expect(exitCode).toBe(1);
        expect(errors.some((e) => e.includes("请指定平台"))).toBe(true);
      }
    });
  });

  describe("--all flag validation", () => {
    it("should validate all platforms with --all flag", async () => {
      const mockReport1 = createMockReport(0.85);
      const mockReport2 = createMockReport(0.95);
      const mockValidator1 = {
        validate: vi.fn().mockResolvedValue(mockReport1),
      };
      const mockValidator2 = {
        validate: vi.fn().mockResolvedValue(mockReport2),
      };
      const mockRegistry = {
        getValidator: vi.fn().mockImplementation((platform: string) => {
          return platform === "taobao" ? mockValidator1 : mockValidator2;
        }),
      };
      mocks.getValidatorRegistry.mockReturnValue(mockRegistry);
      mocks.getPlatforms.mockReturnValue(["taobao", "amazon"]);

      await validateCommand(undefined, { all: true, json: true });

      expect(logs.length).toBe(1);
      const parsed = JSON.parse(logs[0]);
      expect(parsed.taobao).toBeDefined();
      expect(parsed.amazon).toBeDefined();
    });

    it("should validate all platforms and print table output", async () => {
      const mockReport = createMockReport(0.9);
      const mockValidator = {
        validate: vi.fn().mockResolvedValue(mockReport),
      };
      const mockRegistry = {
        getValidator: vi.fn().mockReturnValue(mockValidator),
      };
      mocks.getValidatorRegistry.mockReturnValue(mockRegistry);
      mocks.getPlatforms.mockReturnValue(["taobao", "amazon"]);

      await validateCommand(undefined, { all: true, json: false });

      expect(logs.some((l) => l.includes("平台验证报告"))).toBe(true);
      expect(logs.some((l) => l.includes("taobao"))).toBe(true);
      expect(logs.some((l) => l.includes("amazon"))).toBe(true);
    });

    it("should handle errors for individual platforms when --all", async () => {
      const mockReport = createMockReport(0.9);
      const successValidator = {
        validate: vi.fn().mockResolvedValue(mockReport),
      };
      const failValidator = {
        validate: vi.fn().mockRejectedValue(new Error("API error")),
      };
      const mockRegistry = {
        getValidator: vi.fn().mockImplementation((platform: string) => {
          return platform === "taobao" ? successValidator : failValidator;
        }),
      };
      mocks.getValidatorRegistry.mockReturnValue(mockRegistry);
      mocks.getPlatforms.mockReturnValue(["taobao", "amazon"]);

      await validateCommand(undefined, { all: true, json: true });

      const parsed = JSON.parse(logs[0]);
      expect(parsed.taobao.stats).toBeDefined();
      expect(parsed.amazon.error).toBeDefined();
    });

    it("should skip platforms without validator when --all", async () => {
      const mockReport = createMockReport(0.9);
      const mockValidator = {
        validate: vi.fn().mockResolvedValue(mockReport),
      };
      const mockRegistry = {
        getValidator: vi.fn().mockImplementation((platform: string) => {
          return platform === "taobao" ? mockValidator : undefined;
        }),
      };
      mocks.getValidatorRegistry.mockReturnValue(mockRegistry);
      mocks.getPlatforms.mockReturnValue(["taobao", "amazon"]);

      await validateCommand(undefined, { all: true, json: true });

      const parsed = JSON.parse(logs[0]);
      expect(parsed.taobao).toBeDefined();
    });

    it("should use count for all platform validations", async () => {
      const mockReport = createMockReport();
      const mockValidator = {
        validate: vi.fn().mockResolvedValue(mockReport),
      };
      const mockRegistry = {
        getValidator: vi.fn().mockReturnValue(mockValidator),
      };
      mocks.getValidatorRegistry.mockReturnValue(mockRegistry);
      mocks.getPlatforms.mockReturnValue(["taobao"]);

      await validateCommand(undefined, { all: true, count: 25 });

      expect(mockValidator.validate).toHaveBeenCalledWith(25);
    });
  });

  describe("report formatting", () => {
    it("should show degradation info in report", async () => {
      const mockReport = createMockReport();
      const mockValidator = {
        validate: vi.fn().mockResolvedValue(mockReport),
      };
      const mockRegistry = {
        getValidator: vi.fn().mockReturnValue(mockValidator),
      };
      mocks.getValidatorRegistry.mockReturnValue(mockRegistry);

      await validateCommand("taobao", { json: false });

      expect(logs.some((l) => l.includes("降级信息"))).toBe(true);
      expect(logs.some((l) => l.includes("降级次数"))).toBe(true);
    });

    it("should show sample data in report", async () => {
      const mockReport = createMockReport();
      const mockValidator = {
        validate: vi.fn().mockResolvedValue(mockReport),
      };
      const mockRegistry = {
        getValidator: vi.fn().mockReturnValue(mockValidator),
      };
      mocks.getValidatorRegistry.mockReturnValue(mockRegistry);

      await validateCommand("taobao", { json: false });

      expect(logs.some((l) => l.includes("样本数据"))).toBe(true);
      expect(logs.some((l) => l.includes("prod-001"))).toBe(true);
    });

    it("should not show samples when empty", async () => {
      const mockReport = {
        ...createMockReport(),
        samples: [],
      };
      const mockValidator = {
        validate: vi.fn().mockResolvedValue(mockReport),
      };
      const mockRegistry = {
        getValidator: vi.fn().mockReturnValue(mockValidator),
      };
      mocks.getValidatorRegistry.mockReturnValue(mockRegistry);

      await validateCommand("taobao", { json: false });

      expect(logs.some((l) => l.includes("样本数据"))).toBe(false);
    });
  });
});
