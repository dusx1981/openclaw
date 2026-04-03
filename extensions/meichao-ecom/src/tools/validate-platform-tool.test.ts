import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  ValidationResult,
  ValidationStats,
  DegradationInfo,
  SampleProduct,
} from "../../validation/PlatformValidator.js";

const mocks = vi.hoisted(() => ({
  initializePlatform: vi.fn(),
  isPlatformInitialized: vi.fn().mockReturnValue(true),
  getPlatforms: vi.fn().mockReturnValue(["taobao", "amazon"]),
  validatorGet: vi.fn(),
  validatorGetAllPlatforms: vi.fn().mockReturnValue(["taobao", "amazon"]),
}));

vi.mock("../../application/bootstrap.js", () => ({
  initializePlatform: mocks.initializePlatform,
  isPlatformInitialized: mocks.isPlatformInitialized,
}));

vi.mock("../../infrastructure/registry/PlatformRegistry.js", () => ({
  PlatformRegistry: {
    getPlatforms: mocks.getPlatforms,
  },
}));

vi.mock("../../validation/ValidatorRegistry.js", () => ({
  ValidatorRegistry: {
    get: mocks.validatorGet,
    getAllPlatforms: mocks.validatorGetAllPlatforms,
  },
}));

function createMockValidationResult(platform: string, successRate = 85.5): ValidationResult {
  const stats: ValidationStats = {
    total: 10,
    successes: Math.round((10 * successRate) / 100),
    failures: Math.round((10 * (100 - successRate)) / 100),
    successRate,
    perSourceStats: [
      {
        sourceId: `${platform}_api`,
        sourceType: "api",
        total: 8,
        successes: 7,
        failures: 1,
        successRate: 87.5,
      },
      {
        sourceId: `${platform}_scrape`,
        sourceType: "scrape",
        total: 2,
        successes: 2,
        failures: 0,
        successRate: 100,
      },
    ],
    failureReasons: [{ reason: "timeout", count: 1 }],
  };

  const degradation: DegradationInfo = {
    totalFallbacks: 1,
    paths: [{ path: [`${platform}_api`, `${platform}_scrape`], count: 1 }],
    events: [],
  };

  const samples: SampleProduct[] = [
    {
      platform: platform as "taobao" | "amazon",
      productId: "prod-001",
      title: "Sample Product",
      price: 99.99,
      currency: "CNY",
      source: `${platform}_api`,
      collectedAt: Date.now(),
    },
  ];

  return {
    platform: platform as "taobao" | "amazon",
    timestamp: Date.now(),
    duration: 1500,
    stats,
    degradation,
    samples,
  };
}

describe("createValidatePlatformTool", () => {
  let createValidatePlatformTool: typeof import("./validate-platform-tool.js").createValidatePlatformTool;
  let tool: ReturnType<typeof createValidatePlatformTool>;
  let logs: string[];
  let errors: string[];

  beforeEach(async () => {
    vi.clearAllMocks();

    logs = [];
    errors = [];

    mocks.isPlatformInitialized.mockReturnValue(true);
    mocks.getPlatforms.mockReturnValue(["taobao", "amazon"]);
    mocks.validatorGetAllPlatforms.mockReturnValue(["taobao", "amazon"]);

    const mockLogger = {
      info: (msg: string) => logs.push(msg),
      error: (msg: string) => errors.push(msg),
    };

    const api = { logger: mockLogger } as unknown as Parameters<
      typeof createValidatePlatformTool
    >[0];

    const module = await import("./validate-platform-tool.js");
    createValidatePlatformTool = module.createValidatePlatformTool;
    tool = createValidatePlatformTool(api);
  });

  describe("tool definition", () => {
    it("should have correct name and label", () => {
      expect(tool.name).toBe("ecom-validate-platform");
      expect(tool.label).toBe("E-commerce Platform Validation");
    });

    it("should have description", () => {
      expect(tool.description).toContain("Validate data collection capability");
      expect(tool.description).toContain("e-commerce platform");
    });

    it("should have parameters schema", () => {
      expect(tool.parameters).toBeDefined();
    });
  });

  describe("execute - single platform", () => {
    it("should validate a specific platform successfully", async () => {
      const mockResult = createMockValidationResult("taobao");
      const mockValidator = {
        validate: vi.fn().mockResolvedValue(mockResult),
      };
      mocks.validatorGet.mockReturnValue(mockValidator);

      const result = await tool.execute("call-1", {
        platform: "taobao",
        count: 10,
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe("text");

      const text = result.content[0].text;
      const parsed = JSON.parse(text as string);
      expect(parsed.success).toBe(true);
      expect(parsed.validation.platform).toBe("taobao");
      expect(parsed.stats.total).toBe(10);
      expect(parsed.stats.successRate).toBe("85.50");
    });

    it("should initialize platform if not initialized", async () => {
      mocks.isPlatformInitialized.mockReturnValue(false);
      const mockResult = createMockValidationResult("taobao");
      const mockValidator = {
        validate: vi.fn().mockResolvedValue(mockResult),
      };
      mocks.validatorGet.mockReturnValue(mockValidator);

      await tool.execute("call-2", {
        platform: "taobao",
        count: 10,
      });

      expect(mocks.initializePlatform).toHaveBeenCalled();
    });

    it("should use default count of 10 if not specified", async () => {
      const mockResult = createMockValidationResult("taobao");
      const mockValidator = {
        validate: vi.fn().mockResolvedValue(mockResult),
      };
      mocks.validatorGet.mockReturnValue(mockValidator);

      await tool.execute("call-3", { platform: "taobao" });

      expect(mockValidator.validate).toHaveBeenCalledWith({
        count: 10,
        maskSensitive: true,
      });
    });

    it("should clamp count to minimum 1", async () => {
      const mockResult = createMockValidationResult("taobao");
      const mockValidator = {
        validate: vi.fn().mockResolvedValue(mockResult),
      };
      mocks.validatorGet.mockReturnValue(mockValidator);

      await tool.execute("call-4", { platform: "taobao", count: 0 });

      expect(mockValidator.validate).toHaveBeenCalledWith({
        count: 1,
        maskSensitive: true,
      });
    });

    it("should clamp count to maximum 100", async () => {
      const mockResult = createMockValidationResult("taobao");
      const mockValidator = {
        validate: vi.fn().mockResolvedValue(mockResult),
      };
      mocks.validatorGet.mockReturnValue(mockValidator);

      await tool.execute("call-5", { platform: "taobao", count: 200 });

      expect(mockValidator.validate).toHaveBeenCalledWith({
        count: 100,
        maskSensitive: true,
      });
    });

    it("should log info messages during validation", async () => {
      const mockResult = createMockValidationResult("taobao");
      const mockValidator = {
        validate: vi.fn().mockResolvedValue(mockResult),
      };
      mocks.validatorGet.mockReturnValue(mockValidator);

      await tool.execute("call-6", { platform: "taobao", count: 5 });

      expect(logs.some((l) => l.includes("Validating platform taobao"))).toBe(true);
      expect(logs.some((l) => l.includes("Validation complete for taobao"))).toBe(true);
    });

    it("should throw error for unsupported platform", async () => {
      mocks.getPlatforms.mockReturnValue(["taobao", "amazon"]);

      await expect(tool.execute("call-7", { platform: "unsupported" })).rejects.toThrow(
        "Unsupported platform: unsupported",
      );
    });

    it("should throw error when no validator registered for platform", async () => {
      mocks.validatorGet.mockReturnValue(undefined);

      await expect(tool.execute("call-8", { platform: "taobao" })).rejects.toThrow(
        "No validator registered for platform: taobao",
      );
    });

    it("should handle validation errors", async () => {
      const mockValidator = {
        validate: vi.fn().mockRejectedValue(new Error("Validation failed")),
      };
      mocks.validatorGet.mockReturnValue(mockValidator);

      await expect(tool.execute("call-9", { platform: "taobao" })).rejects.toThrow(
        "Failed to validate platform taobao: Validation failed",
      );

      expect(errors.some((e) => e.includes("Validation failed for taobao"))).toBe(true);
    });

    it("should trim whitespace from platform parameter", async () => {
      const mockResult = createMockValidationResult("taobao");
      const mockValidator = {
        validate: vi.fn().mockResolvedValue(mockResult),
      };
      mocks.validatorGet.mockReturnValue(mockValidator);

      await tool.execute("call-10", { platform: "  taobao  " });

      expect(mocks.validatorGet).toHaveBeenCalledWith("taobao");
    });

    it("should include degradation info in result", async () => {
      const mockResult = createMockValidationResult("taobao");
      const mockValidator = {
        validate: vi.fn().mockResolvedValue(mockResult),
      };
      mocks.validatorGet.mockReturnValue(mockValidator);

      const result = await tool.execute("call-11", { platform: "taobao" });
      const parsed = JSON.parse(result.content[0].text as string);

      expect(parsed.degradation).toBeDefined();
      expect(parsed.degradation.totalFallbacks).toBe(1);
      expect(parsed.degradation.paths).toHaveLength(1);
    });

    it("should include sample products in result", async () => {
      const mockResult = createMockValidationResult("taobao");
      const mockValidator = {
        validate: vi.fn().mockResolvedValue(mockResult),
      };
      mocks.validatorGet.mockReturnValue(mockValidator);

      const result = await tool.execute("call-12", { platform: "taobao" });
      const parsed = JSON.parse(result.content[0].text as string);

      expect(parsed.samples).toBeDefined();
      expect(parsed.samples).toHaveLength(1);
      expect(parsed.samples[0].productId).toBe("prod-001");
    });
  });

  describe("execute - all platforms", () => {
    it("should validate all platforms when no platform specified", async () => {
      const taobaoResult = createMockValidationResult("taobao", 90);
      const amazonResult = createMockValidationResult("amazon", 80);

      mocks.validatorGet.mockImplementation((platform: string) => ({
        validate: vi.fn().mockResolvedValue(platform === "taobao" ? taobaoResult : amazonResult),
      }));

      const result = await tool.execute("call-all-1", {});

      expect(mocks.validatorGetAllPlatforms).toHaveBeenCalled();

      const parsed = JSON.parse(result.content[0].text as string);
      expect(parsed.success).toBe(true);
      expect(parsed.validation.platformsValidated).toBe(2);
      expect(parsed.summary).toHaveLength(2);
    });

    it("should log info when validating all platforms", async () => {
      const mockResult = createMockValidationResult("taobao");
      mocks.validatorGet.mockReturnValue({
        validate: vi.fn().mockResolvedValue(mockResult),
      });

      await tool.execute("call-all-2", {});

      expect(logs.some((l) => l.includes("Validating all platforms"))).toBe(true);
    });

    it("should handle partial failures when validating all platforms", async () => {
      const taobaoResult = createMockValidationResult("taobao", 90);
      mocks.validatorGet.mockImplementation((platform: string) => {
        if (platform === "taobao") {
          return { validate: vi.fn().mockResolvedValue(taobaoResult) };
        }
        if (platform === "amazon") {
          return { validate: vi.fn().mockRejectedValue(new Error("Amazon API error")) };
        }
        return undefined;
      });

      const result = await tool.execute("call-all-3", {});

      const parsed = JSON.parse(result.content[0].text as string);
      expect(parsed.success).toBe(true);
      expect(parsed.validation.platformsValidated).toBe(1);

      expect(errors.some((e) => e.includes("Validation failed for amazon"))).toBe(true);
    });

    it("should skip platforms with no validator", async () => {
      mocks.validatorGet.mockReturnValue(undefined);

      const result = await tool.execute("call-all-4", {});

      const parsed = JSON.parse(result.content[0].text as string);
      expect(parsed.validation.platformsValidated).toBe(0);
    });

    it("should include per-platform details in result", async () => {
      const taobaoResult = createMockValidationResult("taobao", 90);
      const amazonResult = createMockValidationResult("amazon", 75);

      mocks.validatorGet.mockImplementation((platform: string) => ({
        validate: vi.fn().mockResolvedValue(platform === "taobao" ? taobaoResult : amazonResult),
      }));

      const result = await tool.execute("call-all-5", {});
      const parsed = JSON.parse(result.content[0].text as string);

      expect(parsed.details).toHaveLength(2);
      expect(parsed.details[0].stats.successRate).toBe("90.00");
      expect(parsed.details[1].stats.successRate).toBe("75.00");
    });
  });
});
