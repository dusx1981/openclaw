import type { ProductData } from "../../../domain/types.js";
import type {
  PipelineFilter,
  PipelineContext,
  PipelineFilterInput,
  PipelineFilterOutput,
  PipelineError,
} from "../types.js";

export class ValidateFilter implements PipelineFilter {
  readonly name = "validate";

  async execute(
    context: PipelineContext,
    input: PipelineFilterInput,
  ): Promise<PipelineFilterOutput> {
    if (context.options.skipValidation) {
      return { products: input.products, errors: [], stats: { validated: input.products.length } };
    }

    const errors: PipelineError[] = [];
    const validProducts: ProductData[] = [];

    for (const product of input.products) {
      const validation = this.validateProduct(product);
      if (validation.valid) {
        validProducts.push(product);
      } else {
        errors.push({
          stage: "validate",
          platformId: product.platformId,
          message: validation.errors.join("; "),
          code: "VALIDATION_FAILED",
        });
      }
    }

    return {
      products: validProducts,
      errors,
      stats: {
        validated: validProducts.length,
        failed: input.products.length - validProducts.length,
      },
    };
  }

  private validateProduct(product: ProductData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!product.platformId || product.platformId.trim() === "") {
      errors.push("Platform ID is required");
    }

    if (!product.title || product.title.trim() === "") {
      errors.push("Title is required");
    }

    if (product.price < 0) {
      errors.push("Price cannot be negative");
    }

    if (product.originalPrice !== undefined && product.originalPrice < 0) {
      errors.push("Original price cannot be negative");
    }

    if (product.rating !== undefined && (product.rating < 0 || product.rating > 5)) {
      errors.push("Rating must be between 0 and 5");
    }

    if (!product.sourceUrl || product.sourceUrl.trim() === "") {
      errors.push("Source URL is required");
    }

    if (!product.currency || product.currency.trim() === "") {
      errors.push("Currency is required");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
