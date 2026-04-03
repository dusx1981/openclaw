import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "../../runtime-api.js";
import {
  initializePlatform,
  getSearchProductsUseCase,
  isPlatformInitialized,
} from "../application/bootstrap.js";
import type { Platform, DegradationPreset, DataSourceType } from "../domain/types.js";
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

export function createProductSearchTool(api: OpenClawPluginApi) {
  return {
    name: "ecom-product-search",
    label: "E-commerce Product Search",
    description:
      "Search for products on an e-commerce platform (Taobao, Amazon) by keyword. Use for market research, product discovery, or finding trending items. Returns list with title, price, sales, rating, shop name, and source URL. Default limit 50, max 100. Results sorted by relevance.",
    parameters: Type.Object({
      platform: Type.String({
        description: `Platform to search. Supported: ${PLATFORMS.join(", ")}`,
      }),
      keyword: Type.String({
        description: "Search keyword or product name",
      }),
      limit: Type.Optional(
        Type.Number({
          description: "Maximum number of results (default 50, max 100)",
          minimum: 1,
          maximum: 100,
        }),
      ),
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
              description: "Maximum number of data sources to try (default: 4)",
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
      const keyword = typeof params.keyword === "string" ? params.keyword.trim() : "";
      const limitRaw = typeof params.limit === "number" ? params.limit : 50;
      const limit = Math.min(Math.max(1, limitRaw), 100);
      const degradation = params.degradation as Record<string, unknown> | undefined;

      if (!platform) {
        throw new Error("platform is required");
      }
      if (!keyword) {
        throw new Error("keyword is required");
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
      logger?.info?.(`Searching products on ${platform} with keyword: ${keyword}`);

      if (degradation?.preset) {
        logger?.info?.(`Using degradation preset: ${degradation.preset}`);
      }

      try {
        const useCase = getSearchProductsUseCase(platform);
        const result = await useCase.execute(platform as Platform, keyword, {
          pageSize: limit,
          page: 1,
          degradation,
        });

        logger?.info?.(`Found ${result.products.length} products from ${result.source}`);

        const products = result.products.map((p) => ({
          platform: p.platform,
          platformId: p.platformId,
          title: p.title,
          price: p.price,
          currency: p.currency,
          sales: p.sales,
          rating: p.rating,
          shopName: p.shopName,
          categoryName: p.categoryName,
          isTrending: p.isTrending,
          sourceUrl: p.sourceUrl,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  search: {
                    platform,
                    keyword,
                    limit,
                  },
                  results: {
                    total: result.total,
                    count: products.length,
                    page: result.page,
                    pageSize: result.pageSize,
                  },
                  source: result.source,
                  degradationLevel: result.degradationLevel,
                  latencyMs: result.latencyMs,
                  products,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger?.error?.(`Failed to search products: ${message}`);
        throw new Error(`Failed to search products on ${platform}: ${message}`);
      }
    },
  };
}
