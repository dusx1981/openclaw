import type { FetchOptions, SearchOptions } from "../../domain/ports/PlatformGateway.js";
import type { FetchResult, ProductData } from "../../domain/types.js";
import { DataSource } from "../../domain/value-objects/DataSource.js";
import { TmallClient, TmallProductApi } from "../api/tmall/TmallClient.js";
import { BasePlatformAdapter, type AdapterConfig } from "./BasePlatformAdapter.js";

export class TmallAdapter extends BasePlatformAdapter {
  private productApi?: TmallProductApi;
  private apiClient?: TmallClient;

  static create(): TmallAdapter {
    const dataSources = [
      DataSource.create({
        id: "tmall_taobao_api",
        platform: "tmall",
        type: "official_api",
        priority: 1,
        costPerCall: 0,
        dailyQuota: 100,
        usedQuota: 0,
        isAvailable: true,
      }),
      DataSource.create({
        id: "tmall_third_party",
        platform: "tmall",
        type: "third_party_api",
        priority: 2,
        costPerCall: 0.01,
        dailyQuota: 500,
        usedQuota: 0,
        isAvailable: true,
      }),
      DataSource.create({
        id: "tmall_crawler",
        platform: "tmall",
        type: "skill_crawler",
        priority: 3,
        costPerCall: 0.05,
        dailyQuota: 300,
        usedQuota: 0,
        isAvailable: true,
      }),
    ];
    return new TmallAdapter({
      platform: "tmall",
      dataSources,
      defaultTimeoutMs: 10000,
      retryCount: 3,
      retryDelayMs: 1000,
    });
  }

  private ensureApiInitialized(): TmallProductApi {
    if (!this.productApi) {
      this.apiClient = TmallClient.fromEnv();
      this.productApi = new TmallProductApi(this.apiClient);
    }
    return this.productApi;
  }

  getPlatform(): "tmall" {
    return "tmall";
  }

  async fetchProduct(
    platformId: string,
    options?: FetchOptions,
  ): Promise<FetchResult<ProductData>> {
    const start = Date.now();
    try {
      const result = await this.fetchWithFailover(async () => this.doFetchProduct(platformId), {
        maxSources: 2,
      });
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
        { maxSources: 2 },
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

  private async doFetchProduct(platformId: string): Promise<ProductData> {
    const api = this.ensureApiInitialized();
    const product = await api.getProductDetail(platformId);
    if (!product) throw new Error(`Product ${platformId} not found or not a Tmall product`);
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
