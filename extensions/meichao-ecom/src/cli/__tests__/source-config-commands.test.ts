import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DataCollectionConfig } from "../../domain/data-source-config.js";
import {
  listSourcesCommand,
  setPrimarySourceCommand,
  addFallbackSourceCommand,
  removeFallbackSourceCommand,
  resetPlatformConfigCommand,
  type SourceConfigRuntime,
} from "../source-config-commands.js";

describe("source-config-commands", () => {
  let runtime: SourceConfigRuntime;
  let config: DataCollectionConfig;
  let logs: string[];
  let errors: string[];

  beforeEach(() => {
    logs = [];
    errors = [];

    config = {
      default: {
        primary: "taobao/official_api",
        fallbacks: ["taobao/third_party_api", "taobao/skill_crawler"],
      },
      platforms: {
        taobao: {
          primary: "taobao_official_api",
          fallbacks: ["taobao_third_party", "taobao_crawler"],
        },
        amazon: {
          primary: "amazon_sp_api",
          fallbacks: ["amazon_product_api"],
        },
      },
      settings: {
        maxFallbackSources: 3,
        enableStaleCache: true,
        staleCacheMaxAge: 3600000,
      },
    };

    runtime = {
      loadConfig: vi.fn().mockResolvedValue(config),
      saveConfig: vi.fn().mockResolvedValue(undefined),
      log: vi.fn((msg: string) => logs.push(msg)),
      error: vi.fn((msg: string) => errors.push(msg)),
    };
  });

  describe("listSourcesCommand", () => {
    it("should list all config in json format", async () => {
      await listSourcesCommand({ json: true }, runtime);

      expect(logs.length).toBe(1);
      const parsed = JSON.parse(logs[0]);
      expect(parsed.default).toBeDefined();
      expect(parsed.platforms).toBeDefined();
    });

    it("should list specific platform config", async () => {
      await listSourcesCommand({ platform: "taobao" }, runtime);

      expect(logs.some((l) => l.includes("Platform: taobao"))).toBe(true);
      expect(logs.some((l) => l.includes("taobao_official_api"))).toBe(true);
    });

    it("should show default config for unconfigured platform", async () => {
      await listSourcesCommand({ platform: "douyin" }, runtime);

      expect(logs.some((l) => l.includes("using default config"))).toBe(true);
    });

    it("should list all platforms when no platform specified", async () => {
      await listSourcesCommand({}, runtime);

      expect(logs.some((l) => l.includes("Data Source Configuration"))).toBe(true);
      expect(logs.some((l) => l.includes("taobao"))).toBe(true);
      expect(logs.some((l) => l.includes("amazon"))).toBe(true);
    });
  });

  describe("setPrimarySourceCommand", () => {
    it("should set primary source for platform", async () => {
      await setPrimarySourceCommand("taobao", "taobao_crawler", runtime);

      expect(runtime.saveConfig).toHaveBeenCalled();
      expect(logs.some((l) => l.includes("Set primary source for taobao"))).toBe(true);
    });

    it("should create new platform config if not exists", async () => {
      await setPrimarySourceCommand("douyin", "douyin_crawler", runtime);

      const savedConfig = (runtime.saveConfig as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(savedConfig.platforms.douyin).toBeDefined();
      expect(savedConfig.platforms.douyin.primary).toBe("douyin_crawler");
    });
  });

  describe("addFallbackSourceCommand", () => {
    it("should add fallback source for platform", async () => {
      await addFallbackSourceCommand("taobao", "taobao_new_api", runtime);

      const savedConfig = (runtime.saveConfig as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(savedConfig.platforms.taobao.fallbacks).toContain("taobao_new_api");
    });

    it("should not add duplicate fallback", async () => {
      await addFallbackSourceCommand("taobao", "taobao_third_party", runtime);

      expect(runtime.saveConfig).not.toHaveBeenCalled();
      expect(logs.some((l) => l.includes("already exists"))).toBe(true);
    });
  });

  describe("removeFallbackSourceCommand", () => {
    it("should remove fallback source for platform", async () => {
      await removeFallbackSourceCommand("taobao", "taobao_third_party", runtime);

      const savedConfig = (runtime.saveConfig as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(savedConfig.platforms.taobao.fallbacks).not.toContain("taobao_third_party");
    });

    it("should show error when fallback not found", async () => {
      await removeFallbackSourceCommand("taobao", "nonexistent", runtime);

      expect(errors.some((e) => e.includes("not found"))).toBe(true);
      expect(runtime.saveConfig).not.toHaveBeenCalled();
    });
  });

  describe("resetPlatformConfigCommand", () => {
    it("should reset platform config to default", async () => {
      await resetPlatformConfigCommand("taobao", runtime);

      expect(runtime.saveConfig).toHaveBeenCalled();
      expect(logs.some((l) => l.includes("Reset configuration for taobao"))).toBe(true);
    });
  });
});
