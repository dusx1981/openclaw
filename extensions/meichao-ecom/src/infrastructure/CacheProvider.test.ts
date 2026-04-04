import { describe, it, expect, vi, beforeEach, Mock } from "vitest";

vi.mock("./cache/redis.js", () => ({
  getClient: vi.fn(),
  connectClient: vi.fn(),
}));

vi.mock("./cache/RedisKeyManager.js", () => ({
  RedisKeyManager: vi.fn().mockImplementation(() => ({
    addKey: vi.fn().mockResolvedValue(undefined),
    removeKey: vi.fn().mockResolvedValue(undefined),
    getAllKeys: vi.fn().mockResolvedValue([]),
    clearAll: vi.fn().mockResolvedValue(undefined),
    getKeyCount: vi.fn().mockResolvedValue(0),
    cleanupExpiredKeys: vi.fn().mockResolvedValue(0),
  })),
}));

describe("RedisCacheProvider", () => {
  let provider: import("./cache/CacheProvider.js").RedisCacheProvider;
  let mockClient: {
    isOpen: boolean;
    get: Mock;
    set: Mock;
    del: Mock;
    mGet: Mock;
    multi: Mock;
  };
  let redis: typeof import("./cache/redis.js");
  let RedisKeyManager: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockClient = {
      isOpen: true,
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      mGet: vi.fn(),
      multi: vi.fn(),
    };

    redis = await import("./cache/redis.js");
    (redis.getClient as Mock).mockReturnValue(mockClient);

    const redisKeyManagerModule = await import("./cache/RedisKeyManager.js");
    RedisKeyManager = redisKeyManagerModule.RedisKeyManager;

    const { RedisCacheProvider } = await import("./cache/CacheProvider.js");
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
    it("should set value with default TTL and add to key manager", async () => {
      await provider.set("test-key", "test value");

      expect(mockClient.set).toHaveBeenCalledWith(
        "meichao:test-key",
        expect.stringContaining("test value"),
        expect.objectContaining({ PX: 3600000 }),
      );

      const keyManager = RedisKeyManager.mock.results[0].value;
      expect(keyManager.addKey).toHaveBeenCalledWith("meichao:test-key");
    });

    it("should set value with custom TTL", async () => {
      await provider.set("test-key", "test value", 60000, "api");

      expect(mockClient.set).toHaveBeenCalledWith(
        "meichao:test-key",
        expect.stringContaining("test value"),
        expect.objectContaining({ PX: 60000 }),
      );
    });
  });

  describe("delete", () => {
    it("should delete key and return true", async () => {
      mockClient.del.mockResolvedValue(1);

      const result = await provider.delete("test-key");

      expect(mockClient.del).toHaveBeenCalledWith("meichao:test-key");
      expect(result).toBe(true);

      const keyManager = RedisKeyManager.mock.results[0].value;
      expect(keyManager.removeKey).toHaveBeenCalledWith("meichao:test-key");
    });

    it("should return false if key not found", async () => {
      mockClient.del.mockResolvedValue(0);

      const result = await provider.delete("nonexistent");

      expect(result).toBe(false);
    });
  });

  describe("getMany", () => {
    it("should get multiple keys in one operation", async () => {
      const entries = [
        JSON.stringify({ data: "value1", cachedAt: Date.now(), ttlMs: 3600000 }),
        JSON.stringify({ data: "value2", cachedAt: Date.now(), ttlMs: 3600000 }),
        null,
      ];
      mockClient.mGet.mockResolvedValue(entries);

      const result = await provider.getMany<string>(["key1", "key2", "key3"]);

      expect(result["key1"]).toEqual({ data: "value1", isStale: false });
      expect(result["key2"]).toEqual({ data: "value2", isStale: false });
      expect(result["key3"]).toBeUndefined();
      expect(mockClient.mGet).toHaveBeenCalledWith([
        "meichao:key1",
        "meichao:key2",
        "meichao:key3",
      ]);
    });

    it("should handle empty array", async () => {
      mockClient.mGet.mockResolvedValue([]);

      const result = await provider.getMany<string>([]);

      expect(result).toEqual({});
    });
  });

  describe("setMany", () => {
    it("should set multiple keys in one operation", async () => {
      const mockPipeline = {
        set: vi.fn(),
        exec: vi.fn().mockResolvedValue([]),
      };
      mockClient.multi.mockReturnValue(mockPipeline);

      await provider.setMany({
        key1: { data: "value1" },
        key2: { data: "value2", ttlMs: 60000 },
      });

      expect(mockClient.multi).toHaveBeenCalled();
      expect(mockPipeline.set).toHaveBeenCalledTimes(2);

      const keyManager = RedisKeyManager.mock.results[0].value;
      expect(keyManager.addKey).toHaveBeenCalledTimes(2);
    });
  });

  describe("deleteMany", () => {
    it("should delete multiple keys in one operation", async () => {
      mockClient.del.mockResolvedValue(3);

      const result = await provider.deleteMany(["key1", "key2", "key3"]);

      expect(result).toBe(3);
      expect(mockClient.del).toHaveBeenCalledWith(["meichao:key1", "meichao:key2", "meichao:key3"]);

      const keyManager = RedisKeyManager.mock.results[0].value;
      expect(keyManager.removeKey).toHaveBeenCalledTimes(3);
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
        "meichao:test-key",
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

      expect(mockClient.get).toHaveBeenCalledWith("meichao:product:taobao:12345");
      expect(result).toEqual({ data: { title: "Test Product" }, isStale: false });
    });

    it("should set product", async () => {
      await provider.setProduct("taobao", "12345", { title: "Test Product" }, 600000, "api");

      expect(mockClient.set).toHaveBeenCalledWith(
        "meichao:product:taobao:12345",
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

      expect(mockClient.get).toHaveBeenCalledWith("meichao:price:taobao:12345");
      expect(result).toEqual({ data: { price: 99.99, currency: "CNY" }, isStale: false });
    });

    it("should set price", async () => {
      await provider.setPrice("taobao", "12345", 99.99, "CNY", 60000, "api");

      expect(mockClient.set).toHaveBeenCalledWith(
        "meichao:price:taobao:12345",
        expect.stringContaining("99.99"),
        expect.objectContaining({ PX: 60000 }),
      );
    });
  });

  describe("clear", () => {
    it("should clear all keys using key manager", async () => {
      await provider.clear();

      const keyManager = RedisKeyManager.mock.results[0].value;
      expect(keyManager.clearAll).toHaveBeenCalled();
    });
  });

  describe("getStats", () => {
    it("should return cache stats", async () => {
      const keyManager = RedisKeyManager.mock.results[0].value;
      keyManager.getKeyCount.mockResolvedValue(5);

      const stats = await provider.getStats();

      expect(stats.entries).toBe(5);
      expect(stats.maxEntries).toBe(10000);
      expect(typeof stats.hitRate).toBe("number");
    });
  });

  describe("getMetrics", () => {
    it("should return performance metrics", async () => {
      mockClient.get.mockResolvedValue(
        JSON.stringify({
          data: "test",
          cachedAt: Date.now(),
          ttlMs: 3600000,
        }),
      );

      await provider.get("test-key");

      const metrics = provider.getMetrics();

      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(0);
      expect(metrics.hitRate).toBe(1);
      expect(typeof metrics.averageLatency).toBe("number");
    });
  });

  describe("Performance", () => {
    it("should not use keys() command", async () => {
      await provider.getStats();
      await provider.clear();

      expect(mockClient.get).not.toHaveBeenCalledWith("*");
      expect(mockClient.del).not.toHaveBeenCalledWith("*");
    });

    it("should use mGet for batch operations", async () => {
      mockClient.mGet.mockResolvedValue([
        JSON.stringify({ data: "v1", cachedAt: Date.now(), ttlMs: 3600000 }),
        JSON.stringify({ data: "v2", cachedAt: Date.now(), ttlMs: 3600000 }),
      ]);

      const start = Date.now();
      await provider.getMany(["key1", "key2"]);
      const duration = Date.now() - start;

      expect(mockClient.mGet).toHaveBeenCalled();
      expect(mockClient.get).not.toHaveBeenCalledTimes(2);
      expect(duration).toBeLessThan(100);
    });
  });

  describe("Key naming convention", () => {
    it("should prefix all keys with meichao:", async () => {
      await provider.set("test-key", "value");

      expect(mockClient.set).toHaveBeenCalledWith(
        expect.stringMatching(/^meichao:/),
        expect.any(String),
        expect.any(Object),
      );
    });

    it("should not double-prefix keys already starting with meichao:", async () => {
      await provider.set("meichao:custom-key", "value");

      expect(mockClient.set).toHaveBeenCalledWith(
        "meichao:custom-key",
        expect.any(String),
        expect.any(Object),
      );
    });
  });
});
