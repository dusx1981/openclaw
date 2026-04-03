import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProductSearchClient } from "./ProductSearchClient.js";
import type { ProductSearchProvider } from "./ProductSearchProvider.js";
import type { ProductSearchParams, ProductSearchResult } from "./types.js";

class MockProvider implements ProductSearchProvider {
  id: string;
  name: string;
  private configured: boolean;
  private shouldFail: boolean;
  private results: ProductSearchResult;

  constructor(
    id: string,
    configured: boolean = true,
    shouldFail: boolean = false,
    results?: ProductSearchResult,
  ) {
    this.id = id;
    this.name = `Mock ${id}`;
    this.configured = configured;
    this.shouldFail = shouldFail;
    this.results = results ?? {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      provider: id,
      dataQuality: "medium",
    };
  }

  isConfigured(): boolean {
    return this.configured;
  }

  getConfigPath(): string {
    return `mock.${this.id}.config`;
  }

  async search(params: ProductSearchParams): Promise<ProductSearchResult> {
    if (this.shouldFail) {
      throw new Error(`${this.id} search failed`);
    }
    return this.results;
  }
}

describe("ProductSearchClient", () => {
  let client: ProductSearchClient;

  beforeEach(() => {
    client = new ProductSearchClient();
  });

  describe("provider registration", () => {
    it("should register and retrieve providers", () => {
      const provider = new MockProvider("test");
      client.registerProvider(provider);

      expect(client.getProvider("test")).toBe(provider);
      expect(client.getRegisteredProviders()).toContain("test");
    });

    it("should unregister providers", () => {
      const provider = new MockProvider("test");
      client.registerProvider(provider);
      client.unregisterProvider("test");

      expect(client.getProvider("test")).toBeUndefined();
      expect(client.getRegisteredProviders()).not.toContain("test");
    });
  });

  describe("fallback logic", () => {
    it("should try primary provider first", async () => {
      const primary = new MockProvider("primary", true, false, {
        items: [{ title: "Test Product", url: "https://example.com", provider: "primary" }],
        total: 1,
        page: 1,
        pageSize: 20,
        provider: "primary",
        dataQuality: "medium",
      });
      const fallback = new MockProvider("fallback");

      client.registerProvider(primary);
      client.registerProvider(fallback);

      const result = await client.search(
        { keyword: "test" },
        { provider: "primary", fallback: ["fallback"] },
      );

      expect(result.provider).toBe("primary");
    });

    it("should fallback to next provider on failure", async () => {
      const primary = new MockProvider("primary", true, true);
      const fallback = new MockProvider("fallback", true, false, {
        items: [{ title: "Fallback Product", url: "https://example.com", provider: "fallback" }],
        total: 1,
        page: 1,
        pageSize: 20,
        provider: "fallback",
        dataQuality: "medium",
      });

      client.registerProvider(primary);
      client.registerProvider(fallback);

      const result = await client.search(
        { keyword: "test" },
        { provider: "primary", fallback: ["fallback"] },
      );

      expect(result.provider).toBe("fallback");
    });

    it("should skip unconfigured providers", async () => {
      const unconfigured = new MockProvider("unconfigured", false);
      const configured = new MockProvider("configured", true, false, {
        items: [
          { title: "Configured Product", url: "https://example.com", provider: "configured" },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
        provider: "configured",
        dataQuality: "medium",
      });

      client.registerProvider(unconfigured);
      client.registerProvider(configured);

      const result = await client.search(
        { keyword: "test" },
        { provider: "unconfigured", fallback: ["configured"] },
      );

      expect(result.provider).toBe("configured");
    });

    it("should throw error when all providers fail", async () => {
      const primary = new MockProvider("primary", true, true);
      const fallback = new MockProvider("fallback", true, true);

      client.registerProvider(primary);
      client.registerProvider(fallback);

      await expect(
        client.search({ keyword: "test" }, { provider: "primary", fallback: ["fallback"] }),
      ).rejects.toThrow("All search providers failed");
    });

    it("should throw error when no providers configured", async () => {
      const unconfigured = new MockProvider("unconfigured", false);
      client.registerProvider(unconfigured);

      await expect(
        client.search({ keyword: "test" }, { provider: "unconfigured" }),
      ).rejects.toThrow("All search providers failed");
    });
  });

  describe("getConfiguredProviders", () => {
    it("should return only configured providers", () => {
      const configured1 = new MockProvider("configured1", true);
      const configured2 = new MockProvider("configured2", true);
      const unconfigured = new MockProvider("unconfigured", false);

      client.registerProvider(configured1);
      client.registerProvider(configured2);
      client.registerProvider(unconfigured);

      const configured = client.getConfiguredProviders();

      expect(configured).toContain("configured1");
      expect(configured).toContain("configured2");
      expect(configured).not.toContain("unconfigured");
    });
  });
});
