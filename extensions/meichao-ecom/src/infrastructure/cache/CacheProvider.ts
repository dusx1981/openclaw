import type {
  CacheProvider,
  CacheStats,
  CacheEntryWithAge,
} from "../../domain/ports/CacheProvider.js";
import { getClient, connectClient } from "./redis.js";
import { RedisKeyManager } from "./RedisKeyManager.js";

interface CacheEntry<T> {
  data: T;
  source?: string;
  cachedAt: number;
  ttlMs: number;
}

const DEFAULT_TTL_MS = 3600000;
const PRODUCT_TTL_MS = 1800000;
const PRICE_TTL_MS = 300000;

export class RedisCacheProvider implements CacheProvider {
  private hits = 0;
  private misses = 0;
  private maxEntries = 10000;
  private keyManager: RedisKeyManager;
  private totalLatency = 0;
  private operationCount = 0;

  constructor() {
    this.keyManager = new RedisKeyManager("meichao:cache:keys", 86400000);
  }

  private getKey(...parts: string[]): string {
    return ["meichao", ...parts].join(":");
  }

  private async ensureConnected(): Promise<void> {
    const client = getClient();
    if (!client.isOpen) {
      await connectClient();
    }
  }

  private async recordLatency(start: number): Promise<void> {
    const latency = Date.now() - start;
    this.totalLatency += latency;
    this.operationCount++;
  }

  async get<T>(key: string): Promise<{ data: T; isStale: boolean } | null> {
    const start = Date.now();
    await this.ensureConnected();
    const client = getClient();
    const fullKey = key.startsWith("meichao:") ? key : this.getKey(key);
    const raw = await client.get(fullKey);

    if (!raw) {
      this.misses++;
      await this.recordLatency(start);
      return null;
    }

    this.hits++;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    const now = Date.now();
    const isStale = now > entry.cachedAt + entry.ttlMs;

    await this.recordLatency(start);
    return { data: entry.data, isStale };
  }

  async getWithFallback<T>(key: string): Promise<CacheEntryWithAge<T> | null> {
    const start = Date.now();
    await this.ensureConnected();
    const client = getClient();
    const fullKey = key.startsWith("meichao:") ? key : this.getKey(key);
    const raw = await client.get(fullKey);

    if (!raw) {
      this.misses++;
      await this.recordLatency(start);
      return null;
    }

    this.hits++;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    const now = Date.now();
    const isStale = now > entry.cachedAt + entry.ttlMs;
    const age = now - entry.cachedAt;

    await this.recordLatency(start);
    return { data: entry.data, isStale, age };
  }

  async set<T>(key: string, data: T, ttlMs?: number, source?: string): Promise<void> {
    const start = Date.now();
    await this.ensureConnected();
    const client = getClient();
    const fullKey = key.startsWith("meichao:") ? key : this.getKey(key);

    const entry: CacheEntry<T> = {
      data,
      source,
      cachedAt: Date.now(),
      ttlMs: ttlMs ?? DEFAULT_TTL_MS,
    };

    await client.set(fullKey, JSON.stringify(entry), { PX: entry.ttlMs });
    await this.keyManager.addKey(fullKey);
    await this.recordLatency(start);
  }

  async delete(key: string): Promise<boolean> {
    const start = Date.now();
    await this.ensureConnected();
    const client = getClient();
    const fullKey = key.startsWith("meichao:") ? key : this.getKey(key);
    const result = await client.del(fullKey);

    if (result > 0) {
      await this.keyManager.removeKey(fullKey);
    }

    await this.recordLatency(start);
    return result > 0;
  }

  async getJson<T>(key: string): Promise<{ data: T; isStale: boolean } | null> {
    return this.get<T>(key);
  }

  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(key, value, (ttlSeconds ?? 3600) * 1000);
  }

  async getMany<T>(keys: string[]): Promise<Record<string, { data: T; isStale: boolean }>> {
    const start = Date.now();
    await this.ensureConnected();
    const client = getClient();

    const fullKeys = keys.map((k) => (k.startsWith("meichao:") ? k : this.getKey(k)));
    const values = await client.mGet(fullKeys);

    const results: Record<string, { data: T; isStale: boolean }> = {};

    for (let i = 0; i < keys.length; i++) {
      const raw = values[i];
      if (raw) {
        this.hits++;
        const entry = JSON.parse(raw) as CacheEntry<T>;
        const now = Date.now();
        const isStale = now > entry.cachedAt + entry.ttlMs;
        results[keys[i]] = { data: entry.data, isStale };
      } else {
        this.misses++;
      }
    }

    await this.recordLatency(start);
    return results;
  }

  async setMany<T>(
    entries: Record<string, { data: T; ttlMs?: number; source?: string }>,
  ): Promise<void> {
    const start = Date.now();
    await this.ensureConnected();
    const client = getClient();

    const pipeline = client.multi();
    const keys: string[] = [];

    for (const [key, { data, ttlMs, source }] of Object.entries(entries)) {
      const fullKey = key.startsWith("meichao:") ? key : this.getKey(key);
      const entry: CacheEntry<T> = {
        data,
        source,
        cachedAt: Date.now(),
        ttlMs: ttlMs ?? DEFAULT_TTL_MS,
      };

      pipeline.set(fullKey, JSON.stringify(entry), { PX: entry.ttlMs });
      keys.push(fullKey);
    }

    await pipeline.exec();

    for (const key of keys) {
      await this.keyManager.addKey(key);
    }

    await this.recordLatency(start);
  }

  async deleteMany(keys: string[]): Promise<number> {
    const start = Date.now();
    await this.ensureConnected();
    const client = getClient();

    const fullKeys = keys.map((k) => (k.startsWith("meichao:") ? k : this.getKey(k)));
    const result = await client.del(fullKeys);

    for (const key of fullKeys) {
      await this.keyManager.removeKey(key);
    }

    await this.recordLatency(start);
    return result;
  }

  async getProduct(
    platform: string,
    platformId: string,
  ): Promise<{ data: unknown; isStale: boolean } | null> {
    const key = this.getKey("product", platform, platformId);
    return this.get(key);
  }

  async getProductWithFallback(
    platform: string,
    platformId: string,
  ): Promise<CacheEntryWithAge<unknown> | null> {
    const key = this.getKey("product", platform, platformId);
    return this.getWithFallback(key);
  }

  async setProduct(
    platform: string,
    platformId: string,
    data: unknown,
    ttlMs?: number,
    source?: string,
  ): Promise<void> {
    const key = this.getKey("product", platform, platformId);
    await this.set(key, data, ttlMs ?? PRODUCT_TTL_MS, source);
  }

  async getPrice(
    platform: string,
    platformId: string,
  ): Promise<{ data: { price: number; currency: string }; isStale: boolean } | null> {
    const key = this.getKey("price", platform, platformId);
    return this.get<{ price: number; currency: string }>(key);
  }

  async setPrice(
    platform: string,
    platformId: string,
    price: number,
    currency: string,
    ttlMs?: number,
    source?: string,
  ): Promise<void> {
    const key = this.getKey("price", platform, platformId);
    await this.set(key, { price, currency }, ttlMs ?? PRICE_TTL_MS, source);
  }

  async clear(): Promise<void> {
    const start = Date.now();
    await this.ensureConnected();
    await this.keyManager.clearAll();
    this.hits = 0;
    this.misses = 0;
    this.totalLatency = 0;
    this.operationCount = 0;
    await this.recordLatency(start);
  }

  async clearExpired(): Promise<number> {
    const start = Date.now();
    await this.ensureConnected();
    const expiredCount = await this.keyManager.cleanupExpiredKeys();
    await this.recordLatency(start);
    return expiredCount;
  }

  async getStats(): Promise<CacheStats> {
    const start = Date.now();
    await this.ensureConnected();

    const keyCount = await this.keyManager.getKeyCount();
    const averageLatency = this.operationCount > 0 ? this.totalLatency / this.operationCount : 0;

    await this.recordLatency(start);

    return {
      entries: keyCount,
      maxEntries: this.maxEntries,
      hitRate: this.hits + this.misses > 0 ? this.hits / (this.hits + this.misses) : 0,
      hits: this.hits,
      misses: this.misses,
      expiredEntries: 0,
      averageLatency,
    };
  }

  getMetrics(): { hits: number; misses: number; hitRate: number; averageLatency: number } {
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits + this.misses > 0 ? this.hits / (this.hits + this.misses) : 0,
      averageLatency: this.operationCount > 0 ? this.totalLatency / this.operationCount : 0,
    };
  }
}
