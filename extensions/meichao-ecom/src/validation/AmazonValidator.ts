import type { DataSource, FetchResult, ProductData } from "../domain/types.js";
import { AmazonAdapter } from "../infrastructure/adapters/AmazonAdapter.js";
import { DegradationTracker } from "./DegradationTracker.js";
import {
  PlatformValidator,
  type ValidationOptions,
  type ValidationResult,
} from "./PlatformValidator.js";
import { SampleCollector } from "./SampleCollector.js";
import { StatsCollector, categorizeFailure } from "./ValidationStats.js";

export class AmazonValidator extends PlatformValidator {
  private adapter: AmazonAdapter;
  private statsCollector: StatsCollector;
  private sampleCollector: SampleCollector;
  private degradationTracker: DegradationTracker;

  constructor() {
    super("amazon");
    this.adapter = AmazonAdapter.create();
    this.statsCollector = new StatsCollector();
    this.sampleCollector = new SampleCollector(5);
    this.degradationTracker = new DegradationTracker();
  }

  async validate(options: ValidationOptions): Promise<ValidationResult> {
    const startTime = Date.now();
    this.statsCollector.reset();
    this.sampleCollector.reset();
    this.degradationTracker.reset();

    const productIds = this.generateProductIds(options.count);
    let lastSource: string | null = null;

    for (const productId of productIds) {
      try {
        const result = await this.adapter.fetchWithFailover(async (_source: DataSource) => {
          return this.adapter.fetchProduct(productId);
        });

        const fetchResult = result.data as FetchResult<ProductData>;
        const sourceId = result.source;
        const sourceType = this.getSourceType(sourceId);

        if (fetchResult.success && fetchResult.data) {
          this.statsCollector.recordSuccess(sourceId, sourceType);
          this.sampleCollector.add(fetchResult.data, sourceId);

          if (lastSource && lastSource !== sourceId) {
            this.degradationTracker.recordFallback(lastSource, sourceId, productId);
          }
          lastSource = sourceId;
        } else {
          const reason = fetchResult.error ?? "unknown";
          this.statsCollector.recordFailure(sourceId, sourceType, reason);
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        const reason = categorizeFailure(err);
        this.statsCollector.recordFailure("unknown", "unknown", reason);
      }
    }

    const duration = Date.now() - startTime;
    const stats = this.statsCollector.getStats();

    return {
      platform: this.platform,
      timestamp: Date.now(),
      duration,
      stats,
      degradation: this.degradationTracker.getInfo(),
      samples: options.maskSensitive
        ? this.sampleCollector.getMaskedSamples()
        : this.sampleCollector.getSamples(),
    };
  }

  private getSourceType(sourceId: string): string {
    if (sourceId.includes("sp_api")) return "official_api";
    if (sourceId.includes("product_api")) return "third_party_api";
    return "unknown";
  }

  private generateProductIds(count: number): string[] {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      ids.push(this.generateAmazonAsin());
    }
    return ids;
  }

  private generateAmazonAsin(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let asin = "";
    for (let i = 0; i < 10; i++) {
      asin += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return asin;
  }
}
