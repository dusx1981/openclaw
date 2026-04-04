import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
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
  multi: Mock;
  keys: Mock;
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
  multi: vi.fn(),
  keys: vi.fn(),
});

describe("RedisKeyManager", () => {
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

  describe("addKey", () => {
    it("should add key to set", async () => {
      mockClient.sAdd.mockResolvedValue(1);
      mockClient.expire.mockResolvedValue(true);

      await manager.addKey("test:key1");

      expect(mockClient.sAdd).toHaveBeenCalledWith("test:keys", "test:key1");
      expect(mockClient.expire).toHaveBeenCalledWith("test:keys", 3600);
    });
  });

  describe("removeKey", () => {
    it("should remove key from set", async () => {
      mockClient.sRem.mockResolvedValue(1);

      await manager.removeKey("test:key1");

      expect(mockClient.sRem).toHaveBeenCalledWith("test:keys", "test:key1");
    });
  });

  describe("getAllKeys", () => {
    it("should return all keys from set", async () => {
      mockClient.exists.mockResolvedValue(1);
      mockClient.sMembers.mockResolvedValue(["key1", "key2", "key3"]);

      const keys = await manager.getAllKeys();

      expect(keys).toEqual(["key1", "key2", "key3"]);
      expect(mockClient.sMembers).toHaveBeenCalledWith("test:keys");
    });

    it("should rebuild key set if it does not exist", async () => {
      mockClient.exists.mockResolvedValue(0);

      const mockIterator = {
        async *[Symbol.asyncIterator]() {
          yield "meichao:key1";
          yield "meichao:key2";
          yield "test:keys";
        },
      };
      mockClient.scanIterator.mockReturnValue(mockIterator);
      mockClient.sAdd.mockResolvedValue(2);
      mockClient.expire.mockResolvedValue(true);

      const keys = await manager.getAllKeys();

      expect(keys).toEqual(["meichao:key1", "meichao:key2"]);
      expect(mockClient.scanIterator).toHaveBeenCalledWith({
        MATCH: "meichao:*",
        COUNT: 100,
      });
    });
  });

  describe("clearAll", () => {
    it("should delete all keys and the key set", async () => {
      mockClient.exists.mockResolvedValue(1);
      mockClient.sMembers.mockResolvedValue(["key1", "key2"]);
      mockClient.del.mockResolvedValue(1);

      await manager.clearAll();

      expect(mockClient.del).toHaveBeenCalledWith(["key1", "key2"]);
      expect(mockClient.del).toHaveBeenCalledWith("test:keys");
    });

    it("should handle empty key set", async () => {
      mockClient.exists.mockResolvedValue(1);
      mockClient.sMembers.mockResolvedValue([]);

      await manager.clearAll();

      expect(mockClient.del).not.toHaveBeenCalledWith(expect.any(Array));
      expect(mockClient.del).toHaveBeenCalledWith("test:keys");
    });
  });

  describe("getKeyCount", () => {
    it("should return count from SCARD", async () => {
      mockClient.exists.mockResolvedValue(1);
      mockClient.sCard.mockResolvedValue(5);

      const count = await manager.getKeyCount();

      expect(count).toBe(5);
      expect(mockClient.sCard).toHaveBeenCalledWith("test:keys");
    });

    it("should rebuild and return count if key set missing", async () => {
      mockClient.exists.mockResolvedValue(0);

      const mockIterator = {
        async *[Symbol.asyncIterator]() {
          yield "meichao:key1";
          yield "meichao:key2";
        },
      };
      mockClient.scanIterator.mockReturnValue(mockIterator);
      mockClient.sAdd.mockResolvedValue(2);
      mockClient.expire.mockResolvedValue(true);

      const count = await manager.getKeyCount();

      expect(count).toBe(2);
    });
  });

  describe("cleanupExpiredKeys", () => {
    it("should remove keys that no longer exist", async () => {
      mockClient.exists.mockResolvedValueOnce(1);
      mockClient.sMembers.mockResolvedValue(["key1", "key2", "key3"]);

      const mockPipeline = {
        exists: vi.fn(),
        exec: vi.fn().mockResolvedValue([1, 0, 1]),
      };
      mockClient.multi.mockReturnValue(mockPipeline);
      mockClient.sRem.mockResolvedValue(1);

      const removedCount = await manager.cleanupExpiredKeys();

      expect(removedCount).toBe(1);
      expect(mockClient.sRem).toHaveBeenCalledWith("test:keys", ["key2"]);
    });
  });

  describe("validateKeySet", () => {
    it("should validate key set integrity", async () => {
      mockClient.sCard.mockResolvedValue(3);
      mockClient.sMembers.mockResolvedValue(["key1", "key2", "key3"]);

      const mockPipeline = {
        exists: vi.fn(),
        exec: vi.fn().mockResolvedValue([1, 1, 1]),
      };
      mockClient.multi.mockReturnValue(mockPipeline);

      const result = await manager.validateKeySet();

      expect(result.isValid).toBe(true);
      expect(result.actualCount).toBe(3);
      expect(result.reportedCount).toBe(3);
    });

    it("should detect invalid key set", async () => {
      mockClient.sCard.mockResolvedValue(3);
      mockClient.sMembers.mockResolvedValue(["key1", "key2", "key3"]);

      const mockPipeline = {
        exists: vi.fn(),
        exec: vi.fn().mockResolvedValue([1, 0, 1]),
      };
      mockClient.multi.mockReturnValue(mockPipeline);

      const result = await manager.validateKeySet();

      expect(result.isValid).toBe(false);
      expect(result.actualCount).toBe(2);
      expect(result.reportedCount).toBe(3);
    });
  });

  describe("SCAN fallback", () => {
    it("should use SCAN when key set is missing", async () => {
      mockClient.exists.mockResolvedValue(0);

      const keys = ["meichao:product:1", "meichao:product:2", "meichao:price:1"];
      const mockIterator = {
        async *[Symbol.asyncIterator]() {
          for (const key of keys) {
            yield key;
          }
        },
      };
      mockClient.scanIterator.mockReturnValue(mockIterator);
      mockClient.sAdd.mockResolvedValue(3);
      mockClient.expire.mockResolvedValue(true);

      const result = await manager.getAllKeys();

      expect(result).toEqual(keys);
      expect(mockClient.scanIterator).toHaveBeenCalledWith({
        MATCH: "meichao:*",
        COUNT: 100,
      });
      expect(mockClient.sAdd).toHaveBeenCalledWith("test:keys", keys);
    });

    it("should handle empty SCAN result", async () => {
      mockClient.exists.mockResolvedValue(0);

      const mockIterator = {
        async *[Symbol.asyncIterator]() {},
      };
      mockClient.scanIterator.mockReturnValue(mockIterator);

      const result = await manager.getAllKeys();

      expect(result).toEqual([]);
    });
  });

  describe("Performance characteristics", () => {
    it("should use O(1) operations for key management", async () => {
      mockClient.sAdd.mockResolvedValue(1);
      mockClient.expire.mockResolvedValue(true);

      const start = Date.now();
      await manager.addKey("test:key1");
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10);
      expect(mockClient.sAdd).toHaveBeenCalledTimes(1);
    });

    it("should not block on getAllKeys", async () => {
      mockClient.exists.mockResolvedValue(1);
      mockClient.sMembers.mockResolvedValue(["key1"]);

      const start = Date.now();
      await manager.getAllKeys();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10);
      expect(mockClient.sMembers).toHaveBeenCalledTimes(1);
      expect(mockClient.keys).not.toHaveBeenCalled();
    });
  });
});
