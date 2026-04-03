import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "../../runtime-api.js";
import {
  initializePlatform,
  getFetchProductUseCase,
  isPlatformInitialized,
} from "../application/bootstrap.js";
import type { Platform, ProductData, DegradationPreset, DataSourceType } from "../domain/types.js";
import { PlatformRegistry } from "../infrastructure/registry/PlatformRegistry.js";

const PLATFORMS = [
  "taobao",
  "amazon",
  "douyin",
  "1688",
  "shopee",
  "pinduoduo",
  "jd",
  "aliexpress",
] as const;

const DEGRADATION_PRESETS: DegradationPreset[] = [
  "standard",
  "cost-optimized",
  "speed-optimized",
  "reliability-first",
];

const DATA_SOURCE_TYPES: DataSourceType[] = [
  "official_api",
  "third_party_api",
  "skill_crawler",
  "open_search",
];

export function createProductFetchTool(api: OpenClawPluginApi) {
  return {
    name: "ecom-product-fetch",
    label: "E-commerce Product Fetch",
    description:
      "Fetch detailed product data from an e-commerce platform (Taobao, Amazon). Use when you need specific product information by ID. Returns title, price, sales, rating, shop details, and source URL. Supports multiple data sources with automatic fallback. Platform IDs: Taobao uses item ID (e.g., '12345'), Amazon uses ASIN (e.g., 'B0ABC123').",
    parameters: Type.Object({
      platform: Type.String({
        description: `Platform to fetch from. Supported: ${PLATFORMS.join(", ")}`,
      }),
      productId: Type.String({
        description: "Platform-specific product ID (e.g., Taobao item ID, Amazon ASIN)",
      }),
      degradation: Type.Optional(
        Type.Object({
          preset: Type.Optional(
            Type.String({
              description: `Preset template for degradation path. Options: ${DEGRADATION_PRESETS.join(", ")}. standard=full path, cost-optimized=skip paid APIs, speed-optimized=prioritize fast sources, reliability-first=only reliable sources`,
            }),
          ),
          skipTypes: Type.Optional(
            Type.Array(Type.String(), {
              description: `Data source types to skip. Options: ${DATA_SOURCE_TYPES.join(", ")}`,
            }),
          ),
          maxSources: Type.Optional(
            Type.Number({
              description: "Maximum number of data sources to try (default: 3)",
              minimum: 1,
              maximum: 4,
            }),
          ),
          allowCrawler: Type.Optional(
            Type.Boolean({
              description: "Whether to allow skill_crawler in degradation path (default: true)",
            }),
          ),
          allowOpenSearch: Type.Optional(
            Type.Boolean({
              description: "Whether to allow open_search in degradation path (default: true)",
            }),
          ),
          customOrder: Type.Optional(
            Type.Array(Type.String(), {
              description: `Custom order of data source types. Options: ${DATA_SOURCE_TYPES.join(", ")}`,
            }),
          ),
          preferredSource: Type.Optional(
            Type.String({
              description: "Preferred data source ID to use first (e.g., taobao_official_api)",
            }),
          ),
          skipSources: Type.Optional(
            Type.Array(Type.String(), {
              description: "Data source IDs to skip in degradation path",
            }),
          ),
        }),
      ),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const platform = typeof params.platform === "string" ? params.platform.trim() : "";
      const productId = typeof params.productId === "string" ? params.productId.trim() : "";
      const degradation = params.degradation as Record<string, unknown> | undefined;

      if (!platform) {
        throw new Error("platform is required");
      }
      if (!productId) {
        throw new Error("productId is required");
      }

      if (!isPlatformInitialized()) {
        await initializePlatform();
      }

      const supportedPlatforms = PlatformRegistry.getPlatforms();
      if (!supportedPlatforms.includes(platform as Platform)) {
        throw new Error(
          `Unsupported platform: ${platform}. Supported platforms: ${supportedPlatforms.join(", ")}`,
        );
      }

      const logger = api.logger;
      logger?.info?.(`Fetching product ${productId} from ${platform}`);

      if (degradation?.preset) {
        logger?.info?.(`Using degradation preset: ${degradation.preset}`);
      }

      try {
        const useCase = getFetchProductUseCase(platform);
        const result = await useCase.execute(platform as Platform, productId, true, degradation);

        if (!result.data) {
          throw new Error(result.error ?? "Failed to fetch product");
        }

        const product = result.data;
        logger?.info?.(`Successfully fetched product: ${product.title}`);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  product: {
                    platform: product.platform,
                    platformId: product.platformId,
                    title: product.title,
                    price: product.price,
                    currency: product.currency,
                    originalPrice: product.originalPrice,
                    sales: product.sales,
                    rating: product.rating,
                    reviewsCount: product.reviewsCount,
                    shopName: product.shopName,
                    shopId: product.shopId,
                    categoryId: product.categoryId,
                    categoryName: product.categoryName,
                    status: product.status,
                    isTrending: product.isTrending,
                    sourceUrl: product.sourceUrl,
                  },
                  source: result.source,
                  degradationLevel: result.degradationLevel,
                  cached: result.cached,
                  latencyMs: result.latencyMs,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger?.error?.(`Failed to fetch product: ${message}`);
        throw new Error(`Failed to fetch product from ${platform}: ${message}`);
      }
    },
  };
}
