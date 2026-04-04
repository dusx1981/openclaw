import type { FetchOptions, SearchOptions } from "../../domain/ports/PlatformGateway.js";
import type { FetchResult, ProductData } from "../../domain/types.js";
import { DataSource } from "../../domain/value-objects/DataSource.js";
import { LazadaClient } from "../api/lazada/LazadaClient.js";
import { LazadaProductApi } from "../api/lazada/LazadaProductApi.js";
import { BasePlatformAdapter, type AdapterConfig } from "./BasePlatformAdapter.js";

export class LazadaAdapter extends BasePlatformAdapter {
  private productApi?: LazadaProductApi;
  private apiClient?: LazadaClient;

  static create(): LazadaAdapter {
    const dataSources = [
      DataSource.create({
        id: "lazada_official_api",
        platform: "lazada",
        type: "official_api",
        priority: 1,
        costPerCall: 0,
        dailyQuota: 100,
        usedQuota: 0,
        isAvailable: true,
      }),
      DataSource.create({
        id: "lazada_third_party",
        platform: "lazada",
        type: "third_party_api",
        priority: 2,
        costPerCall: 0.01,
        dailyQuota: 500,
        usedQuota: 0,
        isAvailable: true,
      }),
      DataSource.create({
        id: "lazada_crawler",
        platform: "lazada",
        type: "skill_crawler",
        priority: 3,
        costPerCall: 0.05,
        dailyQuota: 300,
        usedQuota: 0,
        isAvailable: true,
      }),
    ];

    return new LazadaAdapter({
      platform: "lazada",
      dataSources,
      defaultTimeoutMs: 20000,
      retryCount: 3,
      retryDelayMs: 2000,
    });
  }

  private ensureApiInitialized(): LazadaProductApi {
    if (!this.productApi) {
      this.apiClient = LazadaClient.fromEnv();
      this.productApi = new LazadaProductApi(this.apiClient);
    }
    return this.productApi;
  }

  getPlatform(): "lazada" {
    return "lazada";
  }

  async fetchProduct(
    platformId: string,
    options?: FetchOptions,
  ): Promise<FetchResult<ProductData>> {
    const start = Date.now();
    try {
      const result = await this.fetchWithFailover(
        async (source) => this.doFetchProduct(platformId, source.id, options),
        {
          preferredSource: options?.preferredSource,
          maxSources: options?.degradation?.maxSources ?? 2,
          onSourceFailure: (sourceId, error) => {
            console.warn(`[LazadaAdapter] Source ${sourceId} failed: ${error.message}`);
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
        async () => this.doSearchProducts(keyword, options),
        { maxSources: options?.degradation?.maxSources ?? 2 },
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
    if (!product) throw new Error(`Product ${platformId} not found`);
    return product;
  }

  private async doSearchProducts(
    keyword: string,
    options?: SearchOptions,
  ): Promise<{ products: ProductData[]; total: number; page: number; pageSize: number }> {
    const api = this.ensureApiInitialized();
    const pageSize = options?.pageSize ?? 20;
    const result = await api.searchProducts(keyword, options?.page ?? 1, pageSize);
    return { ...result, pageSize };
  }
}
