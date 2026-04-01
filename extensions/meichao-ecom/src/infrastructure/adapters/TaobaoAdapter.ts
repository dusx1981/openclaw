import type {
  PlatformDataSourceConfig,
  DataCollectionSettings,
} from "../../domain/data-source-config.js";
import type { FetchOptions, SearchOptions } from "../../domain/ports/PlatformGateway.js";
import type { FetchResult, ProductData } from "../../domain/types.js";
import { DataSource } from "../../domain/value-objects/DataSource.js";
import { TaobaoApiClient, TaobaoApiError } from "../api/taobao/index.js";
import { TaobaoProductApi } from "../api/taobao/TaobaoProductApi.js";
import { BasePlatformAdapter, type AdapterConfig } from "./BasePlatformAdapter.js";

export interface TaobaoAdapterConfig {
  sourceConfig?: PlatformDataSourceConfig;
  settings?: DataCollectionSettings;
}

export class TaobaoAdapter extends BasePlatformAdapter {
  private apiClient: TaobaoApiClient;
  private productApi: TaobaoProductApi;

  static create(config?: TaobaoAdapterConfig): TaobaoAdapter {
    const dataSources = [
      DataSource.create({
        id: "taobao_official_api",
        platform: "taobao",
        type: "official_api",
        priority: 1,
        costPerCall: 0,
        dailyQuota: 100,
        usedQuota: 0,
        isAvailable: true,
      }),
      DataSource.create({
        id: "taobao_third_party",
        platform: "taobao",
        type: "third_party_api",
        priority: 2,
        costPerCall: 0.01,
        dailyQuota: 1000,
        usedQuota: 0,
        isAvailable: true,
      }),
      DataSource.create({
        id: "taobao_crawler",
        platform: "taobao",
        type: "skill_crawler",
        priority: 3,
        costPerCall: 0.05,
        dailyQuota: 500,
        usedQuota: 0,
        isAvailable: true,
      }),
    ];

    const adapterConfig: AdapterConfig = {
      platform: "taobao",
      dataSources,
      defaultTimeoutMs: 10000,
      retryCount: 3,
      retryDelayMs: 1000,
      sourceConfig: config?.sourceConfig,
      settings: config?.settings,
    };

    return new TaobaoAdapter(adapterConfig);
  }

  private constructor(config: AdapterConfig) {
    super(config);

    try {
      this.apiClient = TaobaoApiClient.fromEnv();
      this.productApi = new TaobaoProductApi(this.apiClient);
    } catch (error) {
      console.warn("Taobao API client initialization failed, using fallback:", error);
      this.apiClient = null as unknown as TaobaoApiClient;
      this.productApi = null as unknown as TaobaoProductApi;
    }
  }

  getPlatform(): "taobao" {
    return "taobao";
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
          maxSources: 3,
          onSourceFailure: (sourceId, error) => {
            console.warn(`[TaobaoAdapter] Source ${sourceId} failed: ${error.message}`);
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
    if (!this.productApi) {
      throw new Error(
        "Taobao API client not initialized. Set TAOBAO_APP_KEY and TAOBAO_APP_SECRET environment variables.",
      );
    }

    const product = await this.productApi.getProductDetail(platformId);

    if (!product) {
      throw new Error(`Product ${platformId} not found`);
    }

    return product;
  }

  private async doSearchProducts(
    keyword: string,
    options?: SearchOptions,
  ): Promise<{ products: ProductData[]; total: number; page: number; pageSize: number }> {
    if (!this.productApi) {
      throw new Error(
        "Taobao API client not initialized. Set TAOBAO_APP_KEY and TAOBAO_APP_SECRET environment variables.",
      );
    }

    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;

    const result = await this.productApi.searchProducts(keyword, page, pageSize);

    return {
      products: result.products,
      total: result.total,
      page: result.page,
      pageSize,
    };
  }
}
