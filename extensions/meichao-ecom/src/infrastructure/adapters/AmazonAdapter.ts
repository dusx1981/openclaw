import type {
  PlatformDataSourceConfig,
  DataCollectionSettings,
} from "../../domain/data-source-config.js";
import type { FetchOptions, SearchOptions } from "../../domain/ports/PlatformGateway.js";
import type { FetchResult, ProductData } from "../../domain/types.js";
import { DataSource } from "../../domain/value-objects/DataSource.js";
import { BasePlatformAdapter, type AdapterConfig } from "./BasePlatformAdapter.js";

export interface AmazonAdapterConfig {
  sourceConfig?: PlatformDataSourceConfig;
  settings?: DataCollectionSettings;
}

export class AmazonAdapter extends BasePlatformAdapter {
  static create(config?: AmazonAdapterConfig): AmazonAdapter {
    const dataSources = [
      DataSource.create({
        id: "amazon_sp_api",
        platform: "amazon",
        type: "official_api",
        priority: 1,
        costPerCall: 0,
        dailyQuota: 200,
        usedQuota: 0,
        isAvailable: true,
      }),
      DataSource.create({
        id: "amazon_product_api",
        platform: "amazon",
        type: "third_party_api",
        priority: 2,
        costPerCall: 0.02,
        dailyQuota: 500,
        usedQuota: 0,
        isAvailable: true,
      }),
    ];

    const adapterConfig: AdapterConfig = {
      platform: "amazon",
      dataSources,
      defaultTimeoutMs: 15000,
      retryCount: 3,
      retryDelayMs: 1000,
      sourceConfig: config?.sourceConfig,
      settings: config?.settings,
    };

    return new AmazonAdapter(adapterConfig);
  }

  getPlatform(): "amazon" {
    return "amazon";
  }

  async fetchProduct(
    platformId: string,
    options?: FetchOptions,
  ): Promise<FetchResult<ProductData>> {
    const start = Date.now();

    try {
      const result = await this.fetchWithFailover(
        async (source) => {
          return this.doFetchProduct(platformId, source.id, options);
        },
        {
          preferredSource: options?.preferredSource,
          maxSources: 2,
          onSourceFailure: (sourceId, error) => {
            console.warn(`[AmazonAdapter] Source ${sourceId} failed: ${error.message}`);
          },
        },
      );

      return {
        success: true,
        data: result.data,
        source: result.source,
        latencyMs: result.totalLatencyMs,
        cached: false,
        degradationLevel: result.degradationLevel,
        attempts: result.attempts,
        isDegraded: result.degradationLevel === "fallback_source",
      };
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : "Unknown error",
        "none",
        Date.now() - start,
      );
    }
  }

  async fetchProducts(
    platformIds: string[],
    options?: FetchOptions,
  ): Promise<FetchResult<ProductData>[]> {
    return Promise.all(platformIds.map((id) => this.fetchProduct(id, options)));
  }

  async searchProducts(
    keyword: string,
    options?: SearchOptions,
  ): Promise<
    FetchResult<{ products: ProductData[]; total: number; page: number; pageSize: number }>
  > {
    const start = Date.now();
    const source = this.getDataSource(options?.preferredSource);

    if (!source) {
      return this.createErrorResult("No available data source", "none", Date.now() - start);
    }

    try {
      const result = await this.withRetry(async () => {
        return this.doSearchProducts(keyword, options);
      });

      return this.createSuccessResult(result, source.id, Date.now() - start, false);
    } catch (error) {
      return this.createErrorResult(
        error instanceof Error ? error.message : "Unknown error",
        source.id,
        Date.now() - start,
      );
    }
  }

  private async doFetchProduct(
    platformId: string,
    sourceId: string,
    options?: FetchOptions,
  ): Promise<ProductData> {
    return {
      platform: "amazon",
      platformId,
      title: `Amazon Product ${platformId}`,
      sourceUrl: `https://www.amazon.com/dp/${platformId}`,
      price: 29.99,
      currency: "USD",
      sales: 500,
      salesPeriod: "month",
      status: "active",
      priority: "P1",
      isTrending: false,
    };
  }

  private async doSearchProducts(
    keyword: string,
    options?: SearchOptions,
  ): Promise<{ products: ProductData[]; total: number; page: number; pageSize: number }> {
    const pageSize = options?.pageSize ?? 20;
    const page = options?.page ?? 1;

    return {
      products: [],
      total: 0,
      page,
      pageSize,
    };
  }
}
