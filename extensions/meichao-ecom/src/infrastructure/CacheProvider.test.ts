import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../cache/redis.js", () => ({
  getClient: vi.fn(),
  connectClient: vi.fn(),
}));

describe("RedisCacheProvider", () => {
  let provider: import("../cache/CacheProvider.js").RedisCacheProvider;
  let mockClient: {
    isOpen: boolean;
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
    keys: ReturnType<typeof vi.fn>;
  };
  let redis: typeof import("../cache/redis.js");

  beforeEach(async () => {
    vi.clearAllMocks();

    mockClient = {
      isOpen: true,
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      keys: vi.fn(),
    };

    redis = await import("../cache/redis.js");
    (redis.getClient as ReturnType<typeof vi.fn>).mockReturnValue(mockClient);

    const { RedisCacheProvider } = await import("../cache/CacheProvider.js");
    provider = new RedisCacheProvider();
  });

  describe("get", () => {
    it("should return null if key not found", async () => {
      mockClient.get.mockResolvedValue(null);

      const result = await provider.get<string>("nonexistent");

      expect(result).toBeNull();
    });

    it("should return data with isStale false for fresh entry", async () => {
      const entry = {
        data: "test value",
        cachedAt: Date.now(),
        ttlMs: 3600000,
      };
      mockClient.get.mockResolvedValue(JSON.stringify(entry));

      const result = await provider.get<string>("test-key");

      expect(result).toEqual({ data: "test value", isStale: false });
    });

    it("should return data with isStale true for expired entry", async () => {
      const entry = {
        data: "test value",
        cachedAt: Date.now() - 7200000,
        ttlMs: 3600000,
      };
      mockClient.get.mockResolvedValue(JSON.stringify(entry));

      const result = await provider.get<string>("test-key");

      expect(result).toEqual({ data: "test value", isStale: true });
    });
  });

  describe("set", () => {
    it("should set value with default TTL", async () => {
      await provider.set("test-key", "test value");

      expect(mockClient.set).toHaveBeenCalledWith(
        "test-key",
        expect.stringContaining("test value"),
        expect.objectContaining({ PX: 3600000 }),
      );
    });

    it("should set value with custom TTL", async () => {
      await provider.set("test-key", "test value", 60000, "api");

      expect(mockClient.set).toHaveBeenCalledWith(
        "test-key",
        expect.stringContaining("test value"),
        expect.objectContaining({ PX: 60000 }),
      );
    });
  });

  describe("delete", () => {
    it("should delete key and return true", async () => {
      mockClient.del.mockResolvedValue(1);

      const result = await provider.delete("test-key");

      expect(mockClient.del).toHaveBeenCalledWith("test-key");
      expect(result).toBe(true);
    });

    it("should return false if key not found", async () => {
      mockClient.del.mockResolvedValue(0);

      const result = await provider.delete("nonexistent");

      expect(result).toBe(false);
    });
  });

  describe("getJson / setJson", () => {
    it("should get JSON value", async () => {
      const entry = {
        data: { foo: "bar" },
        cachedAt: Date.now(),
        ttlMs: 3600000,
      };
      mockClient.get.mockResolvedValue(JSON.stringify(entry));

      const result = await provider.getJson<{ foo: string }>("test-key");

      expect(result).toEqual({ data: { foo: "bar" }, isStale: false });
    });

    it("should set JSON value", async () => {
      await provider.setJson("test-key", { foo: "bar" }, 1800);

      expect(mockClient.set).toHaveBeenCalledWith(
        "test-key",
        expect.stringContaining("bar"),
        expect.objectContaining({ PX: 1800000 }),
      );
    });
  });

  describe("getProduct / setProduct", () => {
    it("should get product by platform and id", async () => {
      const entry = {
        data: { title: "Test Product" },
        cachedAt: Date.now(),
        ttlMs: 1800000,
      };
      mockClient.get.mockResolvedValue(JSON.stringify(entry));

      const result = await provider.getProduct("taobao", "12345");

      expect(mockClient.get).toHaveBeenCalledWith("product:taobao:12345");
      expect(result).toEqual({ data: { title: "Test Product" }, isStale: false });
    });

    it("should set product", async () => {
      await provider.setProduct("taobao", "12345", { title: "Test Product" }, 600000, "api");

      expect(mockClient.set).toHaveBeenCalledWith(
        "product:taobao:12345",
        expect.stringContaining("Test Product"),
        expect.objectContaining({ PX: 600000 }),
      );
    });
  });

  describe("getPrice / setPrice", () => {
    it("should get price", async () => {
      const entry = {
        data: { price: 99.99, currency: "CNY" },
        cachedAt: Date.now(),
        ttlMs: 300000,
      };
      mockClient.get.mockResolvedValue(JSON.stringify(entry));

      const result = await provider.getPrice("taobao", "12345");

      expect(mockClient.get).toHaveBeenCalledWith("price:taobao:12345");
      expect(result).toEqual({ data: { price: 99.99, currency: "CNY" }, isStale: false });
    });

    it("should set price", async () => {
      await provider.setPrice("taobao", "12345", 99.99, "CNY", 60000, "api");

      expect(mockClient.set).toHaveBeenCalledWith(
        "price:taobao:12345",
        expect.stringContaining("99.99"),
        expect.objectContaining({ PX: 60000 }),
      );
    });
  });

  describe("clear", () => {
    it("should clear all keys", async () => {
      mockClient.keys.mockResolvedValue(["key1", "key2", "key3"]);
      mockClient.del.mockResolvedValue(3);

      await provider.clear();

      expect(mockClient.keys).toHaveBeenCalledWith("*");
      expect(mockClient.del).toHaveBeenCalledWith(["key1", "key2", "key3"]);
    });
  });

  describe("getStats", () => {
    it("should return cache stats", async () => {
      mockClient.keys.mockResolvedValue(["key1", "key2"]);
      mockClient.get.mockResolvedValue(null);

      const stats = await provider.getStats();

      expect(stats.entries).toBe(2);
      expect(stats.maxEntries).toBe(10000);
      expect(typeof stats.hitRate).toBe("number");
    });
  });
});
