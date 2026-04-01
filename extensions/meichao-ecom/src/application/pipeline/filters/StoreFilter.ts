import type { ProductRepository } from "../../../domain/ports/ProductRepository.js";
import type { ProductData } from "../../../domain/types.js";
import type {
  PipelineFilter,
  PipelineContext,
  PipelineFilterInput,
  PipelineFilterOutput,
  PipelineError,
} from "../types.js";

export interface StoreFilterConfig {
  repository: ProductRepository;
}

export class StoreFilter implements PipelineFilter {
  readonly name = "store";
  private repository: ProductRepository;

  constructor(config: StoreFilterConfig) {
    this.repository = config.repository;
  }

  async execute(
    context: PipelineContext,
    input: PipelineFilterInput,
  ): Promise<PipelineFilterOutput> {
    if (context.options.skipStore) {
      return { products: input.products, errors: [], stats: { stored: 0 } };
    }

    const errors: PipelineError[] = [];
    const stored: ProductData[] = [];
    let storedCount = 0;

    for (const product of input.products) {
      try {
        await this.repository.upsert({
          platform: product.platform,
          platformId: product.platformId,
          title: product.title,
          mainImage: product.mainImage,
          images: product.images,
          sourceUrl: product.sourceUrl,
          price: product.price,
          originalPrice: product.originalPrice,
          currency: product.currency,
          sales: product.sales,
          salesUnit: product.salesUnit,
          salesPeriod: product.salesPeriod,
          rating: product.rating,
          reviewsCount: product.reviewsCount,
          shopId: product.shopId,
          shopName: product.shopName,
          shopUrl: product.shopUrl,
          categoryId: product.categoryId,
          categoryName: product.categoryName,
          categoryPath: product.categoryPath,
          status: product.status,
          priority: product.priority,
          isTrending: product.isTrending,
          merchantId: product.merchantId,
          tags: product.tags,
          extraData: product.extraData,
        });
        stored.push(product);
        storedCount++;
      } catch (error) {
        errors.push({
          stage: "store",
          platformId: product.platformId,
          message: error instanceof Error ? error.message : "Store error",
          code: "STORE_ERROR",
        });
      }
    }

    return {
      products: stored,
      errors,
      stats: { stored: storedCount },
    };
  }
}
