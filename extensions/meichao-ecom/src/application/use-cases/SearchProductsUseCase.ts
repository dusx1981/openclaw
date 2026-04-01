import type { PlatformGateway } from "../../domain/ports/PlatformGateway.js";
import type { SearchOptions } from "../../domain/ports/PlatformGateway.js";
import type { ProductRepository } from "../../domain/ports/ProductRepository.js";
import type { ProductData, Platform } from "../../domain/types.js";

export interface SearchProductsUseCaseResult {
  products: ProductData[];
  total: number;
  page: number;
  pageSize: number;
  source: string;
  latencyMs: number;
}

export class SearchProductsUseCase {
  private gateway: PlatformGateway;
  private repository: ProductRepository;

  constructor(gateway: PlatformGateway, repository: ProductRepository) {
    this.gateway = gateway;
    this.repository = repository;
  }

  async execute(
    platform: Platform,
    keyword: string,
    options?: SearchOptions,
  ): Promise<SearchProductsUseCaseResult> {
    const start = Date.now();

    const result = await this.gateway.searchProducts(keyword, options);

    if (result.success && result.data) {
      return {
        products: result.data.products,
        total: result.data.total,
        page: result.data.page,
        pageSize: result.data.pageSize,
        source: result.source,
        latencyMs: Date.now() - start,
      };
    }

    const products = await this.repository.findMany({
      platform,
      limit: options?.pageSize ?? 20,
      offset: ((options?.page ?? 1) - 1) * (options?.pageSize ?? 20),
    });

    return {
      products: products.map((p) => p.toData()),
      total: products.length,
      page: options?.page ?? 1,
      pageSize: options?.pageSize ?? 20,
      source: "database",
      latencyMs: Date.now() - start,
    };
  }
}
