import type { FetchOptions, SearchOptions } from "../../domain/ports/PlatformGateway.js";
import type { FetchResult, ProductData } from "../../domain/types.js";
import { DataSource } from "../../domain/value-objects/DataSource.js";
import { TikTokShopClient } from "../api/tiktok-shop/TikTokShopClient.js";
import { TikTokShopProductApi } from "../api/tiktok-shop/TikTokShopProductApi.js";
import { BasePlatformAdapter, type AdapterConfig } from "./BasePlatformAdapter.js";

export class TikTokShopAdapter extends BasePlatformAdapter {
  private productApi?: TikTokShopProductApi;
  private apiClient?: TikTokShopClient;

  static create(): TikTokShopAdapter {
    const dataSources = [
      DataSource.create({
        id: "tiktok_shop_official_api",
        platform: "tiktok_shop",
        type: "official_api",
        priority: 1,
        costPerCall: 0,
        dailyQuota: 100,
        usedQuota: 0,
        isAvailable: true,
      }),
      DataSource.create({
        id: "tiktok_shop_third_party",
        platform: "tiktok_shop",
        type: "third_party_api",
        priority: 2,
        costPerCall: 0.01,
        dailyQuota: 500,
        usedQuota: 0,
        isAvailable: true,
      }),
      DataSource.create({
        id: "tiktok_shop_crawler",
        platform: "tiktok_shop",
        type: "skill_crawler",
        priority: 3,
        costPerCall: 0.05,
        dailyQuota: 300,
        usedQuota: 0,
        isAvailable: true,
      }),
    ];

    const adapterConfig: AdapterConfig = {
      platform: "tiktok_shop",
      dataSources,
      defaultTimeoutMs: 20000,
      retryCount: 3,
      retryDelayMs: 2000,
    };

    return new TikTokShopAdapter(adapterConfig);
  }

  private ensureApiInitialized(): TikTokShopProductApi {
    if (!this.productApi) {
      this.apiClient = TikTokShopClient.fromEnv();
      this.productApi = new TikTokShopProductApi(this.apiClient);
    }
    return this.productApi;
  }

  getPlatform(): "tiktok_shop" {
    return "tiktok_shop";
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
            console.warn(`[TikTokShopAdapter] Source ${sourceId} failed: ${error.message}`);
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
            console.warn(`[TikTokShopAdapter] Search source ${sourceId} failed: ${error.message}`);
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
    const product = await api.getProductDetail(platformId);

    if (!product) {
      throw new Error(`Product ${platformId} not found`);
    }

    return product;
  }

  private async doSearchProducts(
    keyword: string,
    options?: SearchOptions,
  ): Promise<{ products: ProductData[]; total: number; page: number; pageSize: number }> {
    const api = this.ensureApiInitialized();
    const pageSize = options?.pageSize ?? 20;
    const result = await api.searchProducts(keyword, options?.page ?? 1, pageSize);

    return {
      ...result,
      pageSize,
    };
  }
}
