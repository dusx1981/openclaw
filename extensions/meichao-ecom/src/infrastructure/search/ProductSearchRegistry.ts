import { getOpenSearchConfig } from "../config/plugin-config.js";
import { ProductSearchClient } from "./ProductSearchClient.js";
import type { ProductSearchProvider } from "./ProductSearchProvider.js";
import { BingShoppingProvider } from "./providers/BingShoppingProvider.js";
import { TavilyProductProvider } from "./providers/TavilyProductProvider.js";

export interface ProviderFactoryConfig {
  bingApiKey?: string;
  bingCustomConfigId?: string;
  tavilyApiKey?: string;
}

export type ProviderFactory = (config: ProviderFactoryConfig) => ProductSearchProvider;

const providerFactories = new Map<string, ProviderFactory>();
const providerCache = new Map<string, ProductSearchProvider>();

providerFactories.set(
  "bing",
  (config) => new BingShoppingProvider(config.bingApiKey, config.bingCustomConfigId),
);

providerFactories.set("tavily", (config) => new TavilyProductProvider(config.tavilyApiKey));

export function registerProviderFactory(id: string, factory: ProviderFactory): void {
  providerFactories.set(id, factory);
}

export function unregisterProviderFactory(id: string): boolean {
  providerCache.delete(id);
  return providerFactories.delete(id);
}

export function getProviderFactory(id: string): ProviderFactory | undefined {
  return providerFactories.get(id);
}

export function getProductSearchProvider(id: string): ProductSearchProvider | undefined {
  if (providerCache.has(id)) {
    return providerCache.get(id);
  }

  const factory = providerFactories.get(id);
  if (!factory) {
    return undefined;
  }

  const openSearchConfig = getOpenSearchConfig();
  const config: ProviderFactoryConfig = {
    bingApiKey: openSearchConfig.bingApiKey,
    bingCustomConfigId: openSearchConfig.bingCustomConfigId,
    tavilyApiKey: process.env.TAVILY_API_KEY,
  };

  const provider = factory(config);
  providerCache.set(id, provider);
  return provider;
}

export function getConfiguredProviders(): ProductSearchProvider[] {
  const providers: ProductSearchProvider[] = [];

  for (const [id] of providerFactories) {
    const provider = getProductSearchProvider(id);
    if (provider?.isConfigured()) {
      providers.push(provider);
    }
  }

  return providers;
}

export function createProductSearchClient(): ProductSearchClient {
  const client = new ProductSearchClient();

  for (const provider of getConfiguredProviders()) {
    client.registerProvider(provider);
  }

  return client;
}

export function resetProviderCache(): void {
  providerCache.clear();
}

export function getRegisteredFactoryIds(): string[] {
  return Array.from(providerFactories.keys());
}
