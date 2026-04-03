import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ProductSearchProvider } from "./ProductSearchProvider.js";
import {
  registerProviderFactory,
  unregisterProviderFactory,
  getProductSearchProvider,
  getConfiguredProviders,
  createProductSearchClient,
  resetProviderCache,
  getRegisteredFactoryIds,
} from "./ProductSearchRegistry.js";

const originalEnv = process.env;

class MockProvider implements ProductSearchProvider {
  id: string;
  name: string;
  private configured: boolean;

  constructor(id: string, configured: boolean = true) {
    this.id = id;
    this.name = `Mock ${id}`;
    this.configured = configured;
  }

  isConfigured(): boolean {
    return this.configured;
  }

  getConfigPath(): string {
    return `mock.${this.id}.config`;
  }

  async search() {
    return {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      provider: this.id,
      dataQuality: "medium" as const,
    };
  }
}

describe("ProductSearchRegistry", () => {
  beforeEach(() => {
    resetProviderCache();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("registerProviderFactory", () => {
    it("should register a custom provider factory", () => {
      const factory = vi.fn(() => new MockProvider("custom"));
      registerProviderFactory("custom", factory);

      expect(getRegisteredFactoryIds()).toContain("custom");
    });

    it("should overwrite existing factory", () => {
      const factory1 = vi.fn(() => new MockProvider("custom1"));
      const factory2 = vi.fn(() => new MockProvider("custom2"));

      registerProviderFactory("custom", factory1);
      registerProviderFactory("custom", factory2);

      const provider = getProductSearchProvider("custom");
      expect(provider?.id).toBe("custom2");
    });
  });

  describe("unregisterProviderFactory", () => {
    it("should remove a registered factory", () => {
      const factory = vi.fn(() => new MockProvider("custom"));
      registerProviderFactory("custom", factory);

      const result = unregisterProviderFactory("custom");

      expect(result).toBe(true);
      expect(getRegisteredFactoryIds()).not.toContain("custom");
    });

    it("should return false for unknown factory", () => {
      expect(unregisterProviderFactory("unknown")).toBe(false);
    });
  });

  describe("getProductSearchProvider", () => {
    it("should return undefined for unknown provider", () => {
      expect(getProductSearchProvider("unknown")).toBeUndefined();
    });

    it("should create provider using factory", () => {
      const factory = vi.fn(() => new MockProvider("test"));
      registerProviderFactory("test", factory);

      const provider = getProductSearchProvider("test");

      expect(provider).toBeDefined();
      expect(provider?.id).toBe("test");
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it("should cache provider instance", () => {
      const factory = vi.fn(() => new MockProvider("cached"));
      registerProviderFactory("cached", factory);

      const provider1 = getProductSearchProvider("cached");
      const provider2 = getProductSearchProvider("cached");

      expect(provider1).toBe(provider2);
      expect(factory).toHaveBeenCalledTimes(1);
    });

    it("should create new instance after cache reset", () => {
      const factory = vi.fn(() => new MockProvider("reset-test"));
      registerProviderFactory("reset-test", factory);

      getProductSearchProvider("reset-test");
      resetProviderCache();
      getProductSearchProvider("reset-test");

      expect(factory).toHaveBeenCalledTimes(2);
    });
  });

  describe("getConfiguredProviders", () => {
    it("should return only configured providers", () => {
      const configuredFactory = vi.fn(() => new MockProvider("configured", true));
      const unconfiguredFactory = vi.fn(() => new MockProvider("unconfigured", false));

      registerProviderFactory("configured", configuredFactory);
      registerProviderFactory("unconfigured", unconfiguredFactory);

      const providers = getConfiguredProviders();

      expect(providers.map((p) => p.id)).toContain("configured");
      expect(providers.map((p) => p.id)).not.toContain("unconfigured");
    });
  });

  describe("createProductSearchClient", () => {
    it("should create client with configured providers", () => {
      const factory = vi.fn(() => new MockProvider("client-test", true));
      registerProviderFactory("client-test", factory);

      const client = createProductSearchClient();

      expect(client).toBeDefined();
      expect(client.getRegisteredProviders()).toContain("client-test");
    });

    it("should skip unconfigured providers", () => {
      const factory = vi.fn(() => new MockProvider("unconfigured-client", false));
      registerProviderFactory("unconfigured-client", factory);

      const client = createProductSearchClient();

      expect(client.getRegisteredProviders()).not.toContain("unconfigured-client");
    });
  });

  describe("built-in providers", () => {
    it("should have bing factory registered", () => {
      expect(getRegisteredFactoryIds()).toContain("bing");
    });

    it("should have tavily factory registered", () => {
      expect(getRegisteredFactoryIds()).toContain("tavily");
    });

    it("should create bing provider when API key is set", () => {
      process.env.BING_API_KEY = "test-key";

      resetProviderCache();
      const provider = getProductSearchProvider("bing");

      expect(provider).toBeDefined();
      expect(provider?.id).toBe("bing");
      expect(provider?.isConfigured()).toBe(true);
    });

    it("should create tavily provider when API key is set", () => {
      process.env.TAVILY_API_KEY = "test-key";

      resetProviderCache();
      const provider = getProductSearchProvider("tavily");

      expect(provider).toBeDefined();
      expect(provider?.id).toBe("tavily");
      expect(provider?.isConfigured()).toBe(true);
    });
  });
});
