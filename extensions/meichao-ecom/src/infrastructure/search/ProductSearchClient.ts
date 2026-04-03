import type { ProductSearchProvider } from "./ProductSearchProvider.js";
import type {
  ProductSearchParams,
  ProductSearchResult,
  ProductSearchProviderConfig,
} from "./types.js";

export class ProductSearchClient {
  private providers: Map<string, ProductSearchProvider> = new Map();
  private defaultConfig: ProductSearchProviderConfig = {
    provider: "bing",
    fallback: ["tavily"],
  };

  registerProvider(provider: ProductSearchProvider): void {
    this.providers.set(provider.id, provider);
  }

  unregisterProvider(providerId: string): boolean {
    return this.providers.delete(providerId);
  }

  getProvider(providerId: string): ProductSearchProvider | undefined {
    return this.providers.get(providerId);
  }

  async search(
    params: ProductSearchParams,
    config?: ProductSearchProviderConfig,
  ): Promise<ProductSearchResult> {
    const searchConfig = config ?? this.defaultConfig;
    const providerIds = [searchConfig.provider, ...(searchConfig.fallback ?? [])];

    const lastErrors: Array<{ providerId: string; error: Error }> = [];

    for (const providerId of providerIds) {
      const provider = this.providers.get(providerId);

      if (!provider) {
        lastErrors.push({
          providerId,
          error: new Error(`Provider "${providerId}" not registered`),
        });
        continue;
      }

      if (!provider.isConfigured()) {
        lastErrors.push({
          providerId,
          error: new Error(
            `Provider "${providerId}" not configured. Configure at: ${provider.getConfigPath()}`,
          ),
        });
        continue;
      }

      try {
        const result = await provider.search(params);
        return result;
      } catch (error) {
        lastErrors.push({
          providerId,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }

    const errorMessages = lastErrors.map((e) => `${e.providerId}: ${e.error.message}`).join("; ");

    throw new Error(`All search providers failed: ${errorMessages}`);
  }

  setDefaultConfig(config: ProductSearchProviderConfig): void {
    this.defaultConfig = config;
  }

  getRegisteredProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  getConfiguredProviders(): string[] {
    return Array.from(this.providers.values())
      .filter((p) => p.isConfigured())
      .map((p) => p.id);
  }
}
