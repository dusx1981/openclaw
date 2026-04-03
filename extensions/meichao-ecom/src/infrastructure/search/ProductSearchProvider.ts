import type { ProductSearchParams, ProductSearchResult } from "./types.js";

export interface ProductSearchProvider {
  id: string;
  name: string;
  search(params: ProductSearchParams): Promise<ProductSearchResult>;
  isConfigured(): boolean;
  getConfigPath(): string;
}
