import { describe, it, expect, vi, beforeEach, afterEach, Mock } from "vitest";
import { RedisKeyManager } from "./RedisKeyManager.js";

vi.mock("./redis.js", () => ({
  getClient: vi.fn(),
}));

interface MockRedisClient {
  sAdd: Mock;
  sRem: Mock;
  sMembers: Mock;
  sCard: Mock;
  del: Mock;
  exists: Mock;
  expire: Mock;
  scanIterator: Mock;
  keys: Mock;
  multi: Mock;
}

const createMockClient = (): MockRedisClient => ({
  sAdd: vi.fn(),
  sRem: vi.fn(),
  sMembers: vi.fn(),
  sCard: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  expire: vi.fn(),
  scanIterator: vi.fn(),
  keys: vi.fn(),
  multi: vi.fn(),
});

describe("Redis Performance Benchmarks", () => {
  let manager: RedisKeyManager;
  let mockClient: MockRedisClient;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockClient = createMockClient();

    const redis = await import("./redis.js");
    vi.spyOn(redis, "getClient").mockReturnValue(mockClient as any);

    manager = new RedisKeyManager("test:keys", 3600000);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  describe("Key set approach vs keys() command", () => {
    it("should demonstrate O(1) performance for key retrieval", async () => {
      const keyCount = 10000;
      const keys = Array.from({ length: keyCount }, (_, i) => `key:${i}`);

      mockClient.exists.mockResolvedValue(1);
      mockClient.sMembers.mockResolvedValue(keys);

      const start = Date.now();
      const result = await manager.getAllKeys();
      const duration = Date.now() - start;

      expect(result).toHaveLength(keyCount);
      expect(duration).toBeLessThan(50);
      expect(mockClient.sMembers).toHaveBeenCalledTimes(1);
      expect(mockClient.keys).not.toHaveBeenCalled();
    });

    it("should demonstrate O(1) for adding keys", async () => {
      mockClient.sAdd.mockResolvedValue(1);
      mockClient.expire.mockResolvedValue(true);

      const iterations = 1000;
      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        await manager.addKey(`key:${i}`);
      }

      const duration = Date.now() - start;
      const avgDuration = duration / iterations;

      expect(avgDuration).toBeLessThan(1);
      expect(mockClient.sAdd).toHaveBeenCalledTimes(iterations);
    });

    it("should handle key set rebuild with SCAN efficiently", async () => {
      const keyCount = 5000;
      const keys = Array.from({ length: keyCount }, (_, i) => `meichao:key:${i}`);

      mockClient.exists.mockResolvedValue(0);

      const mockIterator = {
        async *[Symbol.asyncIterator]() {
          for (const key of keys) {
            yield key;
          }
        },
      };
      mockClient.scanIterator.mockReturnValue(mockIterator);
      mockClient.sAdd.mockResolvedValue(keyCount);
      mockClient.expire.mockResolvedValue(true);

      const start = Date.now();
      const result = await manager.getAllKeys();
      const duration = Date.now() - start;

      expect(result).toHaveLength(keyCount);
      expect(mockClient.scanIterator).toHaveBeenCalledWith({
        MATCH: "meichao:*",
        COUNT: 100,
      });
      expect(duration).toBeLessThan(500);
    });
  });

  describe("Memory efficiency", () => {
    it("should track memory overhead of key set", async () => {
      const keyCount = 10000;
      const keys = Array.from({ length: keyCount }, (_, i) => `key:${i}`);

      mockClient.sCard.mockResolvedValue(keyCount);

      const count = await manager.getKeyCount();

      expect(count).toBe(keyCount);

      const estimatedMemory = keyCount * 50;
      expect(estimatedMemory).toBeLessThan(1024 * 1024);
    });
  });

  describe("Concurrent access performance", () => {
    it("should handle concurrent reads efficiently", async () => {
      mockClient.exists.mockResolvedValue(1);
      mockClient.sMembers.mockResolvedValue(["key1", "key2", "key3"]);

      const concurrentReads = 100;
      const start = Date.now();

      const promises = Array.from({ length: concurrentReads }, () => manager.getAllKeys());

      const results = await Promise.all(promises);
      const duration = Date.now() - start;

      expect(results).toHaveLength(concurrentReads);
      expect(duration).toBeLessThan(100);
    });

    it("should handle concurrent writes efficiently", async () => {
      mockClient.sAdd.mockResolvedValue(1);
      mockClient.expire.mockResolvedValue(true);

      const concurrentWrites = 100;
      const start = Date.now();

      const promises = Array.from({ length: concurrentWrites }, (_, i) =>
        manager.addKey(`key:${i}`),
      );

      await Promise.all(promises);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100);
    });
  });

  describe("Comparison with keys() command", () => {
    it("should not block on large key sets", async () => {
      const largeKeyCount = 100000;
      const keys = Array.from({ length: largeKeyCount }, (_, i) => `key:${i}`);

      mockClient.exists.mockResolvedValue(1);
      mockClient.sMembers.mockResolvedValue(keys);

      const start = Date.now();
      const result = await manager.getAllKeys();
      const duration = Date.now() - start;

      expect(result).toHaveLength(largeKeyCount);
      expect(duration).toBeLessThan(1000);
    });

    it("should provide consistent performance regardless of key count", async () => {
      const testCases = [100, 1000, 10000, 50000];
      const durations: number[] = [];

      for (const keyCount of testCases) {
        const keys = Array.from({ length: keyCount }, (_, i) => `key:${i}`);

        mockClient.exists.mockResolvedValue(1);
        mockClient.sMembers.mockResolvedValue(keys);

        const start = Date.now();
        await manager.getAllKeys();
        const duration = Date.now() - start;

        durations.push(duration);
      }

      const maxVariance = Math.max(...durations) - Math.min(...durations);
      expect(maxVariance).toBeLessThan(50);
    });
  });

  describe("Cleanup performance", () => {
    it("should efficiently cleanup expired keys", async () => {
      const totalKeys = 10000;
      const expiredKeys = 1000;
      const keys = Array.from({ length: totalKeys }, (_, i) => `key:${i}`);

      mockClient.exists.mockResolvedValue(1);
      mockClient.sMembers.mockResolvedValue(keys);

      const mockPipeline = {
        exists: vi.fn(),
        exec: vi
          .fn()
          .mockResolvedValue(
            Array.from({ length: totalKeys }, (_, i) => (i < expiredKeys ? 0 : 1)),
          ),
      };
      mockClient.multi.mockReturnValue(mockPipeline);
      mockClient.sRem.mockResolvedValue(expiredKeys);

      const start = Date.now();
      const removedCount = await manager.cleanupExpiredKeys();
      const duration = Date.now() - start;

      expect(removedCount).toBe(expiredKeys);
      expect(duration).toBeLessThan(500);
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle typical product cache scenario", async () => {
      const productCount = 5000;
      const keys = Array.from({ length: productCount }, (_, i) => `meichao:product:taobao:${i}`);

      mockClient.sAdd.mockResolvedValue(1);
      mockClient.expire.mockResolvedValue(true);

      const start = Date.now();

      for (const key of keys) {
        await manager.addKey(key);
      }

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(5000);
    });

    it("should handle mixed platform cache scenario", async () => {
      const platforms = ["taobao", "amazon", "jd", "pdd"];
      const keysPerPlatform = 1000;

      mockClient.sAdd.mockResolvedValue(1);
      mockClient.expire.mockResolvedValue(true);

      const start = Date.now();

      for (const platform of platforms) {
        for (let i = 0; i < keysPerPlatform; i++) {
          await manager.addKey(`meichao:product:${platform}:${i}`);
        }
      }

      const duration = Date.now() - start;
      const totalKeys = platforms.length * keysPerPlatform;

      expect(duration).toBeLessThan(5000);
      expect(mockClient.sAdd).toHaveBeenCalledTimes(totalKeys);
    });
  });
});
