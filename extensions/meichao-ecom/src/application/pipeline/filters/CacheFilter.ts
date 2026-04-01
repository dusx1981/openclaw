import type { CacheProvider } from "../../../domain/ports/CacheProvider.js";
import type { ProductData } from "../../../domain/types.js";
import type {
  PipelineFilter,
  PipelineContext,
  PipelineFilterInput,
  PipelineFilterOutput,
  PipelineError,
} from "../types.js";

export interface CacheFilterConfig {
  cacheProvider: CacheProvider;
  ttlMs?: number;
}

export class CacheFilter implements PipelineFilter {
  readonly name = "cache";
  private cacheProvider: CacheProvider;
  private ttlMs: number;

  constructor(config: CacheFilterConfig) {
    this.cacheProvider = config.cacheProvider;
    this.ttlMs = config.ttlMs ?? 1800000;
  }

  async execute(
    context: PipelineContext,
    input: PipelineFilterInput,
  ): Promise<PipelineFilterOutput> {
    if (context.options.skipStore) {
      return { products: input.products, errors: [], stats: { cached: 0 } };
    }

    const errors: PipelineError[] = [];
    let cached = 0;

    for (const product of input.products) {
      try {
        await this.cacheProvider.setProduct(
          product.platform,
          product.platformId,
          product,
          this.ttlMs,
          "pipeline",
        );
        cached++;
      } catch (error) {
        errors.push({
          stage: "cache",
          platformId: product.platformId,
          message: error instanceof Error ? error.message : "Cache error",
          code: "CACHE_ERROR",
        });
      }
    }

    return {
      products: input.products,
      errors,
      stats: { cached },
    };
  }
}
