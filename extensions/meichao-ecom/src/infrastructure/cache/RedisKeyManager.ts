import { getClient } from "./redis.js";

export class RedisKeyManager {
  private readonly keySetKey: string;
  private readonly keySetTtl: number;

  constructor(keySetKey = "meichao:cache:keys", keySetTtl = 86400000) {
    this.keySetKey = keySetKey;
    this.keySetTtl = keySetTtl;
  }

  async addKey(key: string): Promise<void> {
    const client = getClient();
    await client.sAdd(this.keySetKey, key);
    await client.expire(this.keySetKey, Math.floor(this.keySetTtl / 1000));
  }

  async removeKey(key: string): Promise<void> {
    const client = getClient();
    await client.sRem(this.keySetKey, key);
  }

  async getAllKeys(): Promise<string[]> {
    const client = getClient();
    const exists = await client.exists(this.keySetKey);

    if (!exists) {
      return this.rebuildKeySet();
    }

    return client.sMembers(this.keySetKey);
  }

  async clearAll(): Promise<void> {
    const client = getClient();
    const keys = await this.getAllKeys();

    if (keys.length > 0) {
      await client.del(keys);
    }

    await client.del(this.keySetKey);
  }

  async getKeyCount(): Promise<number> {
    const client = getClient();
    const exists = await client.exists(this.keySetKey);

    if (!exists) {
      const keys = await this.rebuildKeySet();
      return keys.length;
    }

    return client.sCard(this.keySetKey);
  }

  private async rebuildKeySet(): Promise<string[]> {
    const client = getClient();
    const keys: string[] = [];

    const iterator = client.scanIterator({
      MATCH: "meichao:*",
      COUNT: 100,
    });

    for await (const key of iterator) {
      if (key !== this.keySetKey) {
        keys.push(key);
      }
    }

    if (keys.length > 0) {
      await client.sAdd(this.keySetKey, keys);
      await client.expire(this.keySetKey, Math.floor(this.keySetTtl / 1000));
    }

    console.warn(`RedisKeyManager: Rebuilt key set with ${keys.length} keys using SCAN`);

    return keys;
  }

  async cleanupExpiredKeys(): Promise<number> {
    const client = getClient();
    const keys = await this.getAllKeys();
    let removedCount = 0;

    const pipeline = client.multi();

    for (const key of keys) {
      pipeline.exists(key);
    }

    const results = await pipeline.exec();

    const keysToRemove: string[] = [];
    for (let i = 0; i < keys.length; i++) {
      const exists = results?.[i] as number;
      if (!exists) {
        keysToRemove.push(keys[i]);
        removedCount++;
      }
    }

    if (keysToRemove.length > 0) {
      await client.sRem(this.keySetKey, keysToRemove);
    }

    return removedCount;
  }

  async setKeySetTtl(ttlMs: number): Promise<void> {
    const client = getClient();
    await client.expire(this.keySetKey, Math.floor(ttlMs / 1000));
  }

  async validateKeySet(): Promise<{
    isValid: boolean;
    actualCount: number;
    reportedCount: number;
  }> {
    const client = getClient();
    const reportedCount = await client.sCard(this.keySetKey);
    const keys = await client.sMembers(this.keySetKey);

    let actualCount = 0;
    const pipeline = client.multi();

    for (const key of keys) {
      pipeline.exists(key);
    }

    const results = await pipeline.exec();

    for (const result of results ?? []) {
      if (result) {
        actualCount++;
      }
    }

    return {
      isValid: actualCount === reportedCount,
      actualCount,
      reportedCount,
    };
  }
}
