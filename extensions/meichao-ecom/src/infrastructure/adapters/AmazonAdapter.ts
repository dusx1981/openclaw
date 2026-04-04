import type { FetchOptions, SearchOptions } from "../../domain/ports/PlatformGateway.js";
import type { FetchResult, ProductData } from "../../domain/types.js";
import { DataSource } from "../../domain/value-objects/DataSource.js";
import { AmazonProductApi } from "../api/amazon/AmazonProductApi.js";
import { createAmazonClientFromEnv, AmazonSPApiClient } from "../api/amazon/AmazonSPApiClient.js";
import { BasePlatformAdapter, type AdapterConfig } from "./BasePlatformAdapter.js";

export class AmazonAdapter extends BasePlatformAdapter {
  private productApi?: AmazonProductApi;
  private apiClient?: AmazonSPApiClient;

  static create(): AmazonAdapter {
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
    };

    return new AmazonAdapter(adapterConfig);
  }

  private ensureApiInitialized(): AmazonProductApi {
    if (!this.productApi) {
      this.apiClient = createAmazonClientFromEnv();
      this.productApi = new AmazonProductApi(this.apiClient, this.apiClient.getMarketplaceId());
    }
    return this.productApi;
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
          preferredSource: options?.preferredSource ?? options?.degradation?.preferredSource,
          maxSources: options?.degradation?.maxSources ?? 2,
          preset: options?.degradation?.preset,
          skipTypes: options?.degradation?.skipTypes,
          allowCrawler: options?.degradation?.allowCrawler,
          allowOpenSearch: options?.degradation?.allowOpenSearch,
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

    try {
      const result = await this.fetchWithFailover(
        async (source) => {
          return this.doSearchProducts(keyword, options);
        },
        {
          preferredSource: options?.preferredSource ?? options?.degradation?.preferredSource,
          maxSources: options?.degradation?.maxSources ?? 2,
          preset: options?.degradation?.preset,
          skipTypes: options?.degradation?.skipTypes,
          allowCrawler: options?.degradation?.allowCrawler,
          allowOpenSearch: options?.degradation?.allowOpenSearch,
          onSourceFailure: (sourceId, error) => {
            console.warn(`[AmazonAdapter] Search source ${sourceId} failed: ${error.message}`);
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

  private async doFetchProduct(
    platformId: string,
    sourceId: string,
    options?: FetchOptions,
  ): Promise<ProductData> {
    const api = this.ensureApiInitialized();
    return await api.getProduct(platformId);
  }

  private async doSearchProducts(
    keyword: string,
    options?: SearchOptions,
  ): Promise<{ products: ProductData[]; total: number; page: number; pageSize: number }> {
    throw new Error(
      "Amazon product search is not supported by SP-API. Use fetchProduct to retrieve specific products by ASIN.",
    );
  }
}
