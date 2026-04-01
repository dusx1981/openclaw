import type { FetchResult, ProductData, Platform } from "../types.js";

export interface FetchOptions {
  useCache?: boolean;
  preferredSource?: string;
  timeoutMs?: number;
}

export interface SearchOptions extends FetchOptions {
  pageSize?: number;
  page?: number;
  sortBy?: "sales" | "price" | "rating";
  sortOrder?: "asc" | "desc";
}

export interface SearchResult {
  products: ProductData[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdapterHealth {
  isHealthy: boolean;
  availableSources: number;
  totalSources: number;
  lastCheckAt: Date;
  errors: string[];
  latencyMs?: number;
}

export interface PlatformGateway {
  getPlatform(): Platform;

  fetchProduct(platformId: string, options?: FetchOptions): Promise<FetchResult<ProductData>>;

  fetchProducts(platformIds: string[], options?: FetchOptions): Promise<FetchResult<ProductData>[]>;

  searchProducts(keyword: string, options?: SearchOptions): Promise<FetchResult<SearchResult>>;

  healthCheck(): Promise<AdapterHealth>;

  getAvailableDataSources(): Promise<string[]>;
}
