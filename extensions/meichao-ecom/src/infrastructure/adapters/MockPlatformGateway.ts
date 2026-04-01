import type { PlatformGateway, AdapterHealth } from "../../domain/ports/PlatformGateway.js";
import type { FetchOptions, SearchOptions } from "../../domain/ports/PlatformGateway.js";
import type { FetchResult, ProductData, Platform } from "../../domain/types.js";

export class MockPlatformGateway implements PlatformGateway {
  private platform: Platform;
  private mockProducts: Map<string, ProductData> = new Map();
  private isHealthy = true;
  private availableSources = ["mock_api"];

  constructor(platform: Platform) {
    this.platform = platform;
  }

  getPlatform(): Platform {
    return this.platform;
  }

  setMockProduct(platformId: string, product: ProductData): void {
    this.mockProducts.set(platformId, product);
  }

  setHealthy(healthy: boolean): void {
    this.isHealthy = healthy;
  }

  setAvailableSources(sources: string[]): void {
    this.availableSources = sources;
  }

  async fetchProduct(
    platformId: string,
    options?: FetchOptions,
  ): Promise<FetchResult<ProductData>> {
    const start = Date.now();
    const product = this.mockProducts.get(platformId);

    if (!product) {
      return {
        success: false,
        error: `Product ${platformId} not found`,
        source: "mock_api",
        latencyMs: Date.now() - start,
        cached: false,
        degradationLevel: "error",
        isDegraded: true,
      };
    }

    return {
      success: true,
      data: product,
      source: options?.preferredSource ?? "mock_api",
      latencyMs: Date.now() - start,
      cached: false,
      degradationLevel: "primary_source",
      isDegraded: false,
    };
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
    const allProducts = Array.from(this.mockProducts.values());
    const filtered = allProducts.filter((p) =>
      p.title.toLowerCase().includes(keyword.toLowerCase()),
    );
    const pageSize = options?.pageSize ?? 20;
    const page = options?.page ?? 1;
    const offset = (page - 1) * pageSize;
    const paginated = filtered.slice(offset, offset + pageSize);

    return {
      success: true,
      data: {
        products: paginated,
        total: filtered.length,
        page,
        pageSize,
      },
      source: options?.preferredSource ?? "mock_api",
      latencyMs: Date.now() - start,
      cached: false,
    };
  }

  async healthCheck(): Promise<AdapterHealth> {
    return {
      isHealthy: this.isHealthy,
      availableSources: this.isHealthy ? this.availableSources.length : 0,
      totalSources: this.availableSources.length,
      lastCheckAt: new Date(),
      errors: this.isHealthy ? [] : ["Mock adapter set to unhealthy"],
    };
  }

  async getAvailableDataSources(): Promise<string[]> {
    return this.isHealthy ? this.availableSources : [];
  }
}
