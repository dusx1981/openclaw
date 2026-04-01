import type { PlatformGateway } from "../../../domain/ports/PlatformGateway.js";
import type { FetchResult, ProductData } from "../../../domain/types.js";
import { fetchLog } from "../../../logging.js";
import type {
  PipelineFilter,
  PipelineContext,
  PipelineFilterInput,
  PipelineFilterOutput,
  PipelineError,
} from "../types.js";

export interface FetchFilterConfig {
  gateways: Map<string, PlatformGateway>;
  concurrency?: number;
}

export class FetchFilter implements PipelineFilter {
  readonly name = "fetch";
  private gateways: Map<string, PlatformGateway>;
  private concurrency: number;

  constructor(config: FetchFilterConfig) {
    this.gateways = config.gateways;
    this.concurrency = config.concurrency ?? 5;
  }

  async execute(
    context: PipelineContext,
    input: PipelineFilterInput,
  ): Promise<PipelineFilterOutput> {
    const errors: PipelineError[] = [];
    const products: ProductData[] = [];
    const fetchResults = new Map<string, FetchResult<ProductData>>();
    const gateway = this.gateways.get(context.platform);

    fetchLog.debug("Starting fetch", {
      platform: context.platform,
      count: context.platformIds.length,
      concurrency: this.concurrency,
      requestId: context.requestId,
    });

    if (!gateway) {
      fetchLog.error("No gateway for platform", {
        platform: context.platform,
        requestId: context.requestId,
      });
      errors.push({
        stage: "fetch",
        message: `No gateway registered for platform: ${context.platform}`,
        code: "GATEWAY_NOT_FOUND",
      });
      return { products, errors, stats: { fetched: 0, failed: input.products.length } };
    }

    const results = await this.fetchWithConcurrency(
      gateway,
      context.platformIds,
      context.options.useCache,
    );

    for (const [platformId, result] of results) {
      fetchResults.set(platformId, result);
      if (result.success && result.data) {
        products.push(result.data);
      } else {
        fetchLog.warn("Fetch failed for product", {
          platformId,
          error: result.error,
          requestId: context.requestId,
        });
        errors.push({
          stage: "fetch",
          platformId,
          message: result.error ?? "Unknown fetch error",
          code: "FETCH_FAILED",
        });
      }
    }

    fetchLog.info("Fetch complete", {
      fetched: products.length,
      failed: errors.length,
      requestId: context.requestId,
    });

    return {
      products,
      errors,
      stats: {
        fetched: products.length,
        failed: errors.length,
      },
    };
  }

  private async fetchWithConcurrency(
    gateway: PlatformGateway,
    platformIds: string[],
    useCache?: boolean,
  ): Promise<Map<string, FetchResult<ProductData>>> {
    const results = new Map<string, FetchResult<ProductData>>();
    const batches = this.chunk(platformIds, this.concurrency);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      fetchLog.debug(`Fetching batch ${i + 1}/${batches.length}`, {
        batchSize: batch.length,
        firstId: batch[0],
      });

      const batchResults = await gateway.fetchProducts(batch, { useCache });
      for (let j = 0; j < batch.length; j++) {
        results.set(batch[j], batchResults[j]);
      }
    }

    return results;
  }

  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
