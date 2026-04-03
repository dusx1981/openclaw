import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TavilyProductProvider } from "./TavilyProductProvider.js";

describe("TavilyProductProvider", () => {
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
      process.env.TAVILY_API_KEY = "test-api-key";
      const provider = new TavilyProductProvider();

      expect(provider.isConfigured()).toBe(true);
    });

    it("should be configured when API key is passed to constructor", () => {
      const provider = new TavilyProductProvider("test-api-key");

      expect(provider.isConfigured()).toBe(true);
    });

    it("should not be configured when API key is missing", () => {
      delete process.env.TAVILY_API_KEY;
      const provider = new TavilyProductProvider();

      expect(provider.isConfigured()).toBe(false);
    });

    it("should return correct config path", () => {
      const provider = new TavilyProductProvider();

      expect(provider.getConfigPath()).toBe("plugins.entries.tavily.config.webSearch.apiKey");
    });
  });

  describe("search", () => {
    it("should throw error when not configured", async () => {
      delete process.env.TAVILY_API_KEY;
      const provider = new TavilyProductProvider();

      await expect(provider.search({ keyword: "test" })).rejects.toThrow(
        "Tavily API key not configured",
      );
    });

    it("should send include_domains when platform is specified", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [{ title: "Product", url: "https://taobao.com/item/123" }],
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const provider = new TavilyProductProvider("test-key");
      await provider.search({ keyword: "手机", platform: "taobao" });

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody.include_domains).toContain("taobao.com");
      expect(requestBody.include_domains).toContain("tmall.com");
    });
  });

  describe("id and name", () => {
    it("should have correct id", () => {
      const provider = new TavilyProductProvider();
      expect(provider.id).toBe("tavily");
    });

    it("should have correct name", () => {
      const provider = new TavilyProductProvider();
      expect(provider.name).toBe("Tavily Product Search");
    });
  });
});
