import type { FetchOptions, SearchOptions } from "../../domain/ports/PlatformGateway.js";
import type { FetchResult, ProductData } from "../../domain/types.js";
import { DataSource } from "../../domain/value-objects/DataSource.js";
import {
  TaoGongChangClient,
  TaoGongChangProductApi,
} from "../api/taogongchang/TaoGongChangClient.js";
import { BasePlatformAdapter, type AdapterConfig } from "./BasePlatformAdapter.js";

export class TaoGongChangAdapter extends BasePlatformAdapter {
  private productApi?: TaoGongChangProductApi;
  private apiClient?: TaoGongChangClient;

  static create(): TaoGongChangAdapter {
    const dataSources = [
      DataSource.create({
        id: "taogongchang_1688_api",
        platform: "taogongchang",
        type: "official_api",
        priority: 1,
        costPerCall: 0,
        dailyQuota: 100,
        usedQuota: 0,
        isAvailable: true,
      }),
      DataSource.create({
        id: "taogongchang_third_party",
        platform: "taogongchang",
        type: "third_party_api",
        priority: 2,
        costPerCall: 0.01,
        dailyQuota: 500,
        usedQuota: 0,
        isAvailable: true,
      }),
      DataSource.create({
        id: "taogongchang_crawler",
        platform: "taogongchang",
        type: "skill_crawler",
        priority: 3,
        costPerCall: 0.05,
        dailyQuota: 300,
        usedQuota: 0,
        isAvailable: true,
      }),
    ];
    return new TaoGongChangAdapter({
      platform: "taogongchang",
      dataSources,
      defaultTimeoutMs: 10000,
      retryCount: 3,
      retryDelayMs: 1000,
    });
  }

  private ensureApiInitialized(): TaoGongChangProductApi {
    if (!this.productApi) {
      this.apiClient = TaoGongChangClient.fromEnv();
      this.productApi = new TaoGongChangProductApi(this.apiClient);
    }
    return this.productApi;
  }

  getPlatform(): "taogongchang" {
    return "taogongchang";
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
    if (!product) throw new Error(`Product ${platformId} not found or not a TaoGongChang product`);
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
