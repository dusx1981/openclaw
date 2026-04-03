export { ProductSearchClient } from "./ProductSearchClient.js";
export type { ProductSearchProvider } from "./ProductSearchProvider.js";
export type {
  ProductSearchParams,
  ProductSearchResult,
  ProductSearchItem,
  ProductSearchProviderConfig,
} from "./types.js";
export { PLATFORM_DOMAINS } from "./types.js";
export { BingShoppingProvider, TavilyProductProvider } from "./providers/index.js";
export {
  registerProviderFactory,
  unregisterProviderFactory,
  getProductSearchProvider,
  getConfiguredProviders,
  createProductSearchClient,
  resetProviderCache,
  getRegisteredFactoryIds,
} from "./ProductSearchRegistry.js";
export type { ProviderFactoryConfig, ProviderFactory } from "./ProductSearchRegistry.js";
