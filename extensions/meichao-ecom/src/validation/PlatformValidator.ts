import type { Platform, ProductData } from "../domain/types.js";

export interface ValidationOptions {
  count: number;
  maskSensitive?: boolean;
  timeoutMs?: number;
}

export interface SourceStats {
  sourceId: string;
  sourceType: string;
  total: number;
  successes: number;
  failures: number;
  successRate: number;
}

export interface FailureReason {
  reason: string;
  count: number;
}

export interface ValidationStats {
  total: number;
  successes: number;
  failures: number;
  successRate: number;
  perSourceStats: SourceStats[];
  failureReasons: FailureReason[];
}

export interface FallbackEvent {
  fromSource: string;
  toSource: string;
  timestamp: number;
  productId: string;
}

export interface DegradationPath {
  path: string[];
  count: number;
}

export interface DegradationInfo {
  totalFallbacks: number;
  paths: DegradationPath[];
  events: FallbackEvent[];
}

export interface SampleProduct {
  platform: Platform;
  productId: string;
  title: string;
  price: number;
  currency: string;
  source: string;
  collectedAt: number;
}

export interface ValidationResult {
  platform: Platform;
  timestamp: number;
  duration: number;
  stats: ValidationStats;
  degradation: DegradationInfo;
  samples: SampleProduct[];
}

export abstract class PlatformValidator {
  protected platform: Platform;
  protected stats: ValidationStats;
  protected degradation: DegradationInfo;
  protected samples: SampleProduct[];

  constructor(platform: Platform) {
    this.platform = platform;
    this.stats = {
      total: 0,
      successes: 0,
      failures: 0,
      successRate: 0,
      perSourceStats: [],
      failureReasons: [],
    };
    this.degradation = {
      totalFallbacks: 0,
      paths: [],
      events: [],
    };
    this.samples = [];
  }

  abstract validate(options: ValidationOptions): Promise<ValidationResult>;

  protected createResult(duration: number): ValidationResult {
    return {
      platform: this.platform,
      timestamp: Date.now(),
      duration,
      stats: this.stats,
      degradation: this.degradation,
      samples: this.samples,
    };
  }

  protected addSuccess(sourceId: string, sourceType: string): void {
    this.stats.total++;
    this.stats.successes++;
    this.updateSuccessRate();
    this.updateSourceStats(sourceId, sourceType, true);
  }

  protected addFailure(sourceId: string, sourceType: string, reason: string): void {
    this.stats.total++;
    this.stats.failures++;
    this.updateSuccessRate();
    this.updateSourceStats(sourceId, sourceType, false);
    this.addFailureReason(reason);
  }

  private updateSuccessRate(): void {
    this.stats.successRate =
      this.stats.total > 0 ? (this.stats.successes / this.stats.total) * 100 : 0;
  }

  private updateSourceStats(sourceId: string, sourceType: string, success: boolean): void {
    let sourceStats = this.stats.perSourceStats.find((s) => s.sourceId === sourceId);
    if (!sourceStats) {
      sourceStats = {
        sourceId,
        sourceType,
        total: 0,
        successes: 0,
        failures: 0,
        successRate: 0,
      };
      this.stats.perSourceStats.push(sourceStats);
    }
    sourceStats.total++;
    if (success) {
      sourceStats.successes++;
    } else {
      sourceStats.failures++;
    }
    sourceStats.successRate =
      sourceStats.total > 0 ? (sourceStats.successes / sourceStats.total) * 100 : 0;
  }

  private addFailureReason(reason: string): void {
    const existing = this.stats.failureReasons.find((f) => f.reason === reason);
    if (existing) {
      existing.count++;
    } else {
      this.stats.failureReasons.push({ reason, count: 1 });
    }
  }

  protected addSample(product: ProductData, source: string): void {
    if (this.samples.length >= 5) return;
    this.samples.push({
      platform: product.platform,
      productId: product.platformId,
      title: product.title,
      price: product.price,
      currency: product.currency,
      source,
      collectedAt: Date.now(),
    });
  }

  protected recordFallback(fromSource: string, toSource: string, productId: string): void {
    this.degradation.totalFallbacks++;
    this.degradation.events.push({
      fromSource,
      toSource,
      timestamp: Date.now(),
      productId,
    });
    this.updateDegradationPaths(fromSource, toSource);
  }

  private updateDegradationPaths(fromSource: string, toSource: string): void {
    const pathStr = `${fromSource}→${toSource}`;
    const existing = this.degradation.paths.find((p) => p.path.join("→") === pathStr);
    if (existing) {
      existing.count++;
    } else {
      this.degradation.paths.push({
        path: [fromSource, toSource],
        count: 1,
      });
    }
  }

  protected maskProductId(productId: string): string {
    if (productId.length <= 4) return "****";
    return productId.slice(0, 2) + "****" + productId.slice(-2);
  }
}
