import type { CacheProvider } from "../../domain/ports/CacheProvider.js";
import type { PlatformGateway } from "../../domain/ports/PlatformGateway.js";
import type { ProductRepository } from "../../domain/ports/ProductRepository.js";
import type {
  ProductData,
  FetchResult,
  Platform,
  DegradationLevel,
  CircuitBreakerState,
} from "../../domain/types.js";

export interface FetchProductUseCaseResult {
  data: ProductData | null;
  sourceType: string;
  degradationLevel: DegradationLevel;
  levelNumber: number;
  isDegraded: boolean;
  age?: number;
  circuitBreakerState?: CircuitBreakerState;
  cooldownRemaining?: number;
  cached: boolean;
  source: string;
  latencyMs: number;
  staleCacheAge?: number;
  error?: string;
}

export class FetchProductUseCase {
  private gateway: PlatformGateway;
  private repository: ProductRepository;
  private cacheProvider: CacheProvider;

  constructor(
    gateway: PlatformGateway,
    repository: ProductRepository,
    cacheProvider: CacheProvider,
  ) {
    this.gateway = gateway;
    this.repository = repository;
    this.cacheProvider = cacheProvider;
  }

  async execute(
    platform: Platform,
    platformId: string,
    useCache = true,
  ): Promise<FetchProductUseCaseResult> {
    const start = Date.now();
    let staleFallback: { data: ProductData; age: number } | null = null;

    if (useCache) {
      const cached = await this.cacheProvider.getProductWithFallback(platform, platformId);

      if (cached) {
        if (cached.isStale) {
          staleFallback = {
            data: cached.data as ProductData,
            age: cached.age,
          };
        } else {
          return {
            data: cached.data as ProductData,
            sourceType: "fresh_cache",
            degradationLevel: "fresh_cache",
            levelNumber: 1,
            isDegraded: false,
            age: cached.age,
            cached: true,
            source: "cache",
            latencyMs: Date.now() - start,
          };
        }
      }
    }

    const existing = await this.repository.findByPlatformId(platform, platformId);
    if (existing) {
      const data = existing.toData();
      return {
        data,
        sourceType: "database",
        degradationLevel: "database",
        levelNumber: 2,
        isDegraded: false,
        cached: true,
        source: "database",
        latencyMs: Date.now() - start,
      };
    }

    const result = await this.gateway.fetchProduct(platformId, { useCache });

    if (result.success && result.data) {
      const isFallback = result.degradationLevel === "fallback_source";
      return {
        data: result.data,
        sourceType: isFallback ? "fallback_source" : "primary_source",
        degradationLevel: result.degradationLevel ?? "primary_source",
        levelNumber: 3,
        isDegraded: isFallback,
        cached: false,
        source: result.source,
        latencyMs: Date.now() - start,
        staleCacheAge: staleFallback?.age,
      };
    }

    if (staleFallback) {
      return {
        data: staleFallback.data,
        sourceType: "stale_cache",
        degradationLevel: "stale_cache",
        levelNumber: 4,
        isDegraded: true,
        age: staleFallback.age,
        cached: true,
        source: "cache-stale",
        latencyMs: Date.now() - start,
        staleCacheAge: staleFallback.age,
      };
    }

    return {
      data: null,
      sourceType: "error",
      degradationLevel: "error",
      levelNumber: 5,
      isDegraded: true,
      cached: false,
      source: "error",
      latencyMs: Date.now() - start,
      error: result.error ?? "Unknown error",
    };
  }

  async executeMany(
    platform: Platform,
    platformIds: string[],
    useCache = true,
  ): Promise<Map<string, FetchProductUseCaseResult>> {
    const results = new Map<string, FetchProductUseCaseResult>();

    for (const platformId of platformIds) {
      const result = await this.execute(platform, platformId, useCache);
      results.set(platformId, result);
    }

    return results;
  }
}
