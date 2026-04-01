import type {
  SourceStats,
  FailureReason,
  ValidationStats as IValidationStats,
} from "./PlatformValidator.js";

export class StatsCollector {
  private total = 0;
  private successes = 0;
  private failures = 0;
  private perSourceStats: SourceStats[] = [];
  private failureReasons: FailureReason[] = [];

  recordSuccess(sourceId: string, sourceType: string): void {
    this.total++;
    this.successes++;
    this.updateSourceStats(sourceId, sourceType, true);
  }

  recordFailure(sourceId: string, sourceType: string, reason: string): void {
    this.total++;
    this.failures++;
    this.updateSourceStats(sourceId, sourceType, false);
    this.addFailureReason(reason);
  }

  getStats(): IValidationStats {
    return {
      total: this.total,
      successes: this.successes,
      failures: this.failures,
      successRate: this.total > 0 ? (this.successes / this.total) * 100 : 0,
      perSourceStats: [...this.perSourceStats],
      failureReasons: [...this.failureReasons],
    };
  }

  reset(): void {
    this.total = 0;
    this.successes = 0;
    this.failures = 0;
    this.perSourceStats = [];
    this.failureReasons = [];
  }

  private updateSourceStats(sourceId: string, sourceType: string, success: boolean): void {
    let stats = this.perSourceStats.find((s) => s.sourceId === sourceId);
    if (!stats) {
      stats = {
        sourceId,
        sourceType,
        total: 0,
        successes: 0,
        failures: 0,
        successRate: 0,
      };
      this.perSourceStats.push(stats);
    }
    stats.total++;
    if (success) {
      stats.successes++;
    } else {
      stats.failures++;
    }
    stats.successRate = stats.total > 0 ? (stats.successes / stats.total) * 100 : 0;
  }

  private addFailureReason(reason: string): void {
    const existing = this.failureReasons.find((f) => f.reason === reason);
    if (existing) {
      existing.count++;
    } else {
      this.failureReasons.push({ reason, count: 1 });
    }
  }
}

export function categorizeFailure(error: Error): string {
  const message = error.message.toLowerCase();

  if (message.includes("timeout") || message.includes("etimedout")) {
    return "timeout";
  }
  if (message.includes("econnrefused") || message.includes("connection refused")) {
    return "connection_refused";
  }
  if (message.includes("enotfound") || message.includes("dns")) {
    return "dns_failure";
  }
  if (message.includes("rate") || message.includes("limit") || message.includes("429")) {
    return "rate_limited";
  }
  if (message.includes("unauthorized") || message.includes("401") || message.includes("403")) {
    return "auth_error";
  }
  if (message.includes("not found") || message.includes("404")) {
    return "not_found";
  }
  if (message.includes("network") || message.includes("enetwork")) {
    return "network_error";
  }

  return "unknown";
}
