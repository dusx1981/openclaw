import type { CacheProvider } from "../../domain/ports/CacheProvider.js";
import type { PlatformGateway } from "../../domain/ports/PlatformGateway.js";
import type { ProductRepository } from "../../domain/ports/ProductRepository.js";
import type { ProductData } from "../../domain/types.js";
import { pipelineLog } from "../../logging.js";
import { CacheFilter } from "./filters/CacheFilter.js";
import { DedupeFilter } from "./filters/DedupeFilter.js";
import { FetchFilter } from "./filters/FetchFilter.js";
import { StoreFilter } from "./filters/StoreFilter.js";
import { ValidateFilter } from "./filters/ValidateFilter.js";
import type {
  PipelineContext,
  PipelineOptions,
  PipelineResult,
  PipelineStats,
  PipelineFilter,
  PipelineFilterInput,
} from "./types.js";

export interface DataPipelineConfig {
  gateways: Map<string, PlatformGateway>;
  repository: ProductRepository;
  cacheProvider: CacheProvider;
  concurrency?: number;
  cacheTtlMs?: number;
}

export class DataPipeline {
  private filters: PipelineFilter[] = [];

  constructor(private config: DataPipelineConfig) {
    this.setupDefaultFilters();
  }

  private setupDefaultFilters(): void {
    this.filters = [
      new FetchFilter({
        gateways: this.config.gateways,
        concurrency: this.config.concurrency,
      }),
      new ValidateFilter(),
      new DedupeFilter(),
      new StoreFilter({ repository: this.config.repository }),
      new CacheFilter({
        cacheProvider: this.config.cacheProvider,
        ttlMs: this.config.cacheTtlMs,
      }),
    ];
  }

  addFilter(filter: PipelineFilter): void {
    this.filters.push(filter);
  }

  removeFilter(name: string): boolean {
    const index = this.filters.findIndex((f) => f.name === name);
    if (index >= 0) {
      this.filters.splice(index, 1);
      return true;
    }
    return false;
  }

  async execute(
    platform: string,
    platformIds: string[],
    options?: PipelineOptions,
  ): Promise<PipelineResult> {
    const startTime = Date.now();
    const requestId = this.generateRequestId();

    pipelineLog.info("Pipeline starting", { platform, count: platformIds.length, requestId });

    const context: PipelineContext = {
      requestId,
      platform,
      platformIds,
      options: options ?? {},
      startTime,
      metadata: {},
    };

    let currentInput: PipelineFilterInput = { products: [] };
    const allErrors = context.platformIds.length === 0 ? [] : undefined;
    let finalProducts: ProductData[] = [];
    const stats: PipelineStats = {
      totalRequested: platformIds.length,
      fetched: 0,
      validated: 0,
      deduplicated: 0,
      cached: 0,
      stored: 0,
      failed: 0,
      durationMs: 0,
    };

    try {
      for (const filter of this.filters) {
        pipelineLog.debug(`Running filter: ${filter.name}`, { requestId });
        const filterStart = Date.now();
        const output = await filter.execute(context, currentInput);
        const filterDuration = Date.now() - filterStart;

        pipelineLog.debug(`Filter complete: ${filter.name}`, {
          requestId,
          durationMs: filterDuration,
          productsOut: output.products.length,
          errors: output.errors.length,
        });

        currentInput = { products: output.products };
        finalProducts = output.products;

        if (output.stats.fetched !== undefined) stats.fetched = output.stats.fetched;
        if (output.stats.validated !== undefined) stats.validated = output.stats.validated;
        if (output.stats.deduplicated !== undefined) stats.deduplicated = output.stats.deduplicated;
        if (output.stats.cached !== undefined) stats.cached = output.stats.cached;
        if (output.stats.stored !== undefined) stats.stored = output.stats.stored;
        if (output.stats.failed !== undefined) stats.failed += output.stats.failed;

        if (output.errors.length > 0) {
          stats.failed += output.errors.length;
          pipelineLog.warn(`Filter ${filter.name} has errors`, {
            requestId,
            errorCount: output.errors.length,
            sampleErrors: output.errors.slice(0, 3),
          });
        }
      }
    } catch (error) {
      stats.failed++;
      pipelineLog.error("Pipeline failed with exception", {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    stats.durationMs = Date.now() - startTime;

    pipelineLog.info("Pipeline complete", {
      requestId,
      success: stats.failed === 0,
      durationMs: stats.durationMs,
      fetched: stats.fetched,
      validated: stats.validated,
      stored: stats.stored,
      cached: stats.cached,
      failed: stats.failed,
    });

    return {
      success: stats.failed === 0,
      products: finalProducts,
      errors: allErrors ?? [],
      stats,
    };
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getFilterNames(): string[] {
    return this.filters.map((f) => f.name);
  }
}
