import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "../../runtime-api.js";
import {
  initializePlatform,
  getFetchProductUseCase,
  isPlatformInitialized,
} from "../application/bootstrap.js";
import type { Platform, ProductData } from "../domain/types.js";
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
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const platform = typeof params.platform === "string" ? params.platform.trim() : "";
      const productId = typeof params.productId === "string" ? params.productId.trim() : "";

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

      try {
        const useCase = getFetchProductUseCase(platform);
        const result = await useCase.execute(platform as Platform, productId);

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
