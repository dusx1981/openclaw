export interface CacheEntryWithAge<T> {
  data: T;
  isStale: boolean;
  age: number;
}

export interface CacheStats {
  entries: number;
  maxEntries: number;
  hitRate: number;
  hits: number;
  misses: number;
  expiredEntries: number;
  averageLatency?: number;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  averageLatency: number;
}

export interface CacheProvider {
  get<T>(key: string): Promise<{ data: T; isStale: boolean } | null>;

  getWithFallback<T>(key: string): Promise<CacheEntryWithAge<T> | null>;

  set<T>(key: string, data: T, ttlMs?: number, source?: string): Promise<void>;

  delete(key: string): Promise<boolean>;

  getMany<T>(keys: string[]): Promise<Record<string, { data: T; isStale: boolean }>>;

  setMany<T>(entries: Record<string, { data: T; ttlMs?: number; source?: string }>): Promise<void>;

  deleteMany(keys: string[]): Promise<number>;

  getJson<T>(key: string): Promise<{ data: T; isStale: boolean } | null>;

  setJson<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;

  getProduct(
    platform: string,
    platformId: string,
  ): Promise<{ data: unknown; isStale: boolean } | null>;

  getProductWithFallback(
    platform: string,
    platformId: string,
  ): Promise<CacheEntryWithAge<unknown> | null>;

  setProduct(
    platform: string,
    platformId: string,
    data: unknown,
    ttlMs?: number,
    source?: string,
  ): Promise<void>;

  getPrice(
    platform: string,
    platformId: string,
  ): Promise<{ data: { price: number; currency: string }; isStale: boolean } | null>;

  setPrice(
    platform: string,
    platformId: string,
    price: number,
    currency: string,
    ttlMs?: number,
    source?: string,
  ): Promise<void>;

  clear(): Promise<void>;

  clearExpired(): Promise<number>;

  getStats(): Promise<CacheStats>;

  getMetrics(): CacheMetrics;
}
