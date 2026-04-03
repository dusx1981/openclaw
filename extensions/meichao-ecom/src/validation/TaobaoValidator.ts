import type { DataSource, FetchResult, ProductData } from "../domain/types.js";
import { PlatformRegistry } from "../infrastructure/registry/PlatformRegistry.js";
import { DegradationTracker } from "./DegradationTracker.js";
import {
  PlatformValidator,
  type ValidationOptions,
  type ValidationResult,
} from "./PlatformValidator.js";
import { SampleCollector } from "./SampleCollector.js";
import { StatsCollector, categorizeFailure } from "./ValidationStats.js";

export class TaobaoValidator extends PlatformValidator {
  private adapter: import("../infrastructure/adapters/TaobaoAdapter.js").TaobaoAdapter | null;
  private statsCollector: StatsCollector;
  private sampleCollector: SampleCollector;
  private degradationTracker: DegradationTracker;

  constructor() {
    super("taobao");
    this.adapter = PlatformRegistry.get("taobao") as
      | import("../infrastructure/adapters/TaobaoAdapter.js").TaobaoAdapter
      | null;
    this.statsCollector = new StatsCollector();
    this.sampleCollector = new SampleCollector(5);
    this.degradationTracker = new DegradationTracker();
  }

  async validate(options: ValidationOptions): Promise<ValidationResult> {
    if (!this.adapter) {
      throw new Error("Taobao platform not initialized. Run bootstrap first.");
    }

    const startTime = Date.now();
    this.statsCollector.reset();
    this.sampleCollector.reset();
    this.degradationTracker.reset();

    const productIds = this.generateProductIds(options.count);
    let lastSource: string | null = null;

    for (const productId of productIds) {
      try {
        const result = await this.adapter.fetchWithFailover(async (_source: DataSource) => {
          return this.adapter!.fetchProduct(productId);
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
    if (sourceId.includes("official")) return "official_api";
    if (sourceId.includes("third")) return "third_party_api";
    if (sourceId.includes("crawler")) return "skill_crawler";
    if (sourceId.includes("open_search")) return "open_search";
    return "unknown";
  }

  private generateProductIds(count: number): string[] {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      ids.push(this.generateTaobaoId());
    }
    return ids;
  }

  private generateTaobaoId(): string {
    const length = Math.floor(Math.random() * 5) + 10;
    let id = "";
    for (let i = 0; i < length; i++) {
      id += Math.floor(Math.random() * 10).toString();
    }
    return id;
  }
}
