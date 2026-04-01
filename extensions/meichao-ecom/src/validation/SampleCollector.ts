import type { ProductData, Platform } from "../domain/types.js";
import type { SampleProduct } from "./PlatformValidator.js";

export class SampleCollector {
  private samples: SampleProduct[] = [];
  private maxSamples: number;

  constructor(maxSamples: number = 5) {
    this.maxSamples = maxSamples;
  }

  add(product: ProductData, source: string): boolean {
    if (this.samples.length >= this.maxSamples) {
      return false;
    }
    this.samples.push({
      platform: product.platform,
      productId: product.platformId,
      title: product.title,
      price: product.price,
      currency: product.currency,
      source,
      collectedAt: Date.now(),
    });
    return true;
  }

  getSamples(): SampleProduct[] {
    return [...this.samples];
  }

  getMaskedSamples(): SampleProduct[] {
    return this.samples.map((sample) => ({
      ...sample,
      productId: this.maskString(sample.productId),
    }));
  }

  reset(): void {
    this.samples = [];
  }

  private maskString(str: string): string {
    if (str.length <= 4) return "****";
    return str.slice(0, 2) + "****" + str.slice(-2);
  }
}
