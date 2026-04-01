import type {
  CacheProvider,
  CacheStats,
  CacheEntryWithAge,
} from "../../domain/ports/CacheProvider.js";
import { getClient, connectClient } from "./redis.js";

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

  private getKey(...parts: string[]): string {
    return parts.join(":");
  }

  private async ensureConnected(): Promise<void> {
    const client = getClient();
    if (!client.isOpen) {
      await connectClient();
    }
  }

  async get<T>(key: string): Promise<{ data: T; isStale: boolean } | null> {
    await this.ensureConnected();
    const client = getClient();
    const raw = await client.get(key);

    if (!raw) {
      this.misses++;
      return null;
    }

    this.hits++;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    const now = Date.now();
    const isStale = now > entry.cachedAt + entry.ttlMs;

    return { data: entry.data, isStale };
  }

  async getWithFallback<T>(key: string): Promise<CacheEntryWithAge<T> | null> {
    await this.ensureConnected();
    const client = getClient();
    const raw = await client.get(key);

    if (!raw) {
      this.misses++;
      return null;
    }

    this.hits++;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    const now = Date.now();
    const isStale = now > entry.cachedAt + entry.ttlMs;
    const age = now - entry.cachedAt;

    return { data: entry.data, isStale, age };
  }

  async set<T>(key: string, data: T, ttlMs?: number, source?: string): Promise<void> {
    await this.ensureConnected();
    const client = getClient();

    const entry: CacheEntry<T> = {
      data,
      source,
      cachedAt: Date.now(),
      ttlMs: ttlMs ?? DEFAULT_TTL_MS,
    };

    await client.set(key, JSON.stringify(entry), { PX: entry.ttlMs });
  }

  async delete(key: string): Promise<boolean> {
    await this.ensureConnected();
    const client = getClient();
    const result = await client.del(key);
    return result > 0;
  }

  async getJson<T>(key: string): Promise<{ data: T; isStale: boolean } | null> {
    return this.get<T>(key);
  }

  async setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.set(key, value, (ttlSeconds ?? 3600) * 1000);
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
    await this.ensureConnected();
    const client = getClient();
    const keys = await client.keys("*");
    if (keys.length > 0) {
      await client.del(keys);
    }
    this.hits = 0;
    this.misses = 0;
  }

  async clearExpired(): Promise<number> {
    await this.ensureConnected();
    const client = getClient();
    const keys = await client.keys("*");
    let expiredCount = 0;

    const now = Date.now();
    for (const key of keys) {
      const raw = await client.get(key);
      if (raw) {
        try {
          const entry = JSON.parse(raw) as CacheEntry<unknown>;
          if (now > entry.cachedAt + entry.ttlMs) {
            await client.del(key);
            expiredCount++;
          }
        } catch {
          // Skip invalid entries
        }
      }
    }

    return expiredCount;
  }

  async getStats(): Promise<CacheStats> {
    await this.ensureConnected();
    const client = getClient();
    const keys = await client.keys("*");

    return {
      entries: keys.length,
      maxEntries: this.maxEntries,
      hitRate: this.hits + this.misses > 0 ? this.hits / (this.hits + this.misses) : 0,
      hits: this.hits,
      misses: this.misses,
      expiredEntries: await this.clearExpired(),
    };
  }
}
