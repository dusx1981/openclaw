import type { ProductData } from "../../../domain/types.js";
import type {
  PipelineFilter,
  PipelineContext,
  PipelineFilterInput,
  PipelineFilterOutput,
  PipelineError,
} from "../types.js";

export class DedupeFilter implements PipelineFilter {
  readonly name = "dedupe";

  async execute(
    context: PipelineContext,
    input: PipelineFilterInput,
  ): Promise<PipelineFilterOutput> {
    if (context.options.skipDedupe) {
      return {
        products: input.products,
        errors: [],
        stats: { deduplicated: input.products.length },
      };
    }

    const seen = new Set<string>();
    const unique: ProductData[] = [];
    const duplicates: ProductData[] = [];

    for (const product of input.products) {
      const key = `${product.platform}:${product.platformId}`;
      if (seen.has(key)) {
        duplicates.push(product);
      } else {
        seen.add(key);
        unique.push(product);
      }
    }

    const errors: PipelineError[] = duplicates.map((p) => ({
      stage: "dedupe",
      platformId: p.platformId,
      message: "Duplicate product",
      code: "DUPLICATE",
    }));

    return {
      products: unique,
      errors,
      stats: {
        deduplicated: unique.length,
        failed: duplicates.length,
      },
    };
  }
}
