import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BingShoppingProvider } from "./BingShoppingProvider.js";

describe("BingShoppingProvider", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("configuration", () => {
    it("should be configured when API key is set via environment", () => {
      process.env.BING_API_KEY = "test-api-key";
      const provider = new BingShoppingProvider();

      expect(provider.isConfigured()).toBe(true);
    });

    it("should be configured when API key is passed to constructor", () => {
      const provider = new BingShoppingProvider("test-api-key");

      expect(provider.isConfigured()).toBe(true);
    });

    it("should not be configured when API key is missing", () => {
      delete process.env.BING_API_KEY;
      delete process.env.BING_SEARCH_API_KEY;
      const provider = new BingShoppingProvider();

      expect(provider.isConfigured()).toBe(false);
    });

    it("should return correct config path", () => {
      const provider = new BingShoppingProvider();

      expect(provider.getConfigPath()).toBe(
        "plugins.entries.meichao-ecom.config.openSearch.bingApiKey",
      );
    });
  });

  describe("search", () => {
    it("should throw error when not configured", async () => {
      delete process.env.BING_API_KEY;
      delete process.env.BING_SEARCH_API_KEY;
      const provider = new BingShoppingProvider();

      await expect(provider.search({ keyword: "test" })).rejects.toThrow(
        "Bing API key not configured",
      );
    });

    it("should build query with platform filter", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          webPages: {
            value: [{ name: "Product", url: "https://taobao.com/item/123" }],
            totalEstimatedMatches: 1,
          },
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const provider = new BingShoppingProvider("test-key");
      await provider.search({ keyword: "手机", platform: "taobao" });

      const calledUrl = mockFetch.mock.calls[0][0];
      const decodedUrl = decodeURIComponent(calledUrl);
      expect(decodedUrl).toContain("site:taobao.com");
      expect(decodedUrl).toContain("site:tmall.com");
    });
  });

  describe("id and name", () => {
    it("should have correct id", () => {
      const provider = new BingShoppingProvider();
      expect(provider.id).toBe("bing");
    });

    it("should have correct name", () => {
      const provider = new BingShoppingProvider();
      expect(provider.name).toBe("Bing Shopping Search");
    });
  });
});
