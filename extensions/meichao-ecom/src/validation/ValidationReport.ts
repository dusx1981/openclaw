import type { Platform } from "../domain/types.js";
import type { ValidationResult, SampleProduct } from "./PlatformValidator.js";

export class ValidationReport {
  constructor(private result: ValidationResult) {}

  static fromResult(result: ValidationResult): ValidationReport {
    return new ValidationReport(result);
  }

  toText(maskSensitive: boolean = false): string {
    const lines: string[] = [];
    const { platform, timestamp, duration, stats, degradation, samples } = this.result;

    lines.push("═".repeat(60));
    lines.push(`Platform Validation Report: ${platform.toUpperCase()}`);
    lines.push("═".repeat(60));
    lines.push("");

    lines.push("## Summary");
    lines.push(`- Timestamp: ${new Date(timestamp).toISOString()}`);
    lines.push(`- Duration: ${(duration / 1000).toFixed(2)}s`);
    lines.push(`- Total Requests: ${stats.total}`);
    lines.push(`- Success Rate: ${stats.successRate.toFixed(2)}%`);
    lines.push(`- Successes: ${stats.successes}`);
    lines.push(`- Failures: ${stats.failures}`);
    lines.push("");

    if (stats.perSourceStats.length > 0) {
      lines.push("## Per-Source Statistics");
      for (const source of stats.perSourceStats) {
        lines.push(`- ${source.sourceId} (${source.sourceType}):`);
        lines.push(`  - Total: ${source.total}`);
        lines.push(`  - Success Rate: ${source.successRate.toFixed(2)}%`);
      }
      lines.push("");
    }

    if (stats.failureReasons.length > 0) {
      lines.push("## Failure Reasons");
      for (const fr of stats.failureReasons.sort((a, b) => b.count - a.count)) {
        lines.push(`- ${fr.reason}: ${fr.count}`);
      }
      lines.push("");
    }

    if (degradation.totalFallbacks > 0) {
      lines.push("## Degradation Flow");
      lines.push(`- Total Fallbacks: ${degradation.totalFallbacks}`);
      for (const path of degradation.paths) {
        lines.push(`- Path: ${path.path.join(" → ")} (${path.count} times)`);
      }
      lines.push("");
    }

    if (samples.length > 0) {
      lines.push("## Sample Products");
      for (let i = 0; i < samples.length; i++) {
        const sample = maskSensitive
          ? { ...samples[i], productId: this.maskString(samples[i].productId) }
          : samples[i];
        lines.push(`${i + 1}. ${sample.title}`);
        lines.push(`   - ID: ${sample.productId}`);
        lines.push(`   - Price: ${sample.price} ${sample.currency}`);
        lines.push(`   - Source: ${sample.source}`);
      }
      lines.push("");
    }

    lines.push("═".repeat(60));
    return lines.join("\n");
  }

  toJSON(maskSensitive: boolean = false): string {
    const result = { ...this.result };

    if (maskSensitive) {
      result.samples = result.samples.map((sample) => ({
        ...sample,
        productId: this.maskString(sample.productId),
      }));
    }

    return JSON.stringify(result, null, 2);
  }

  private maskString(str: string): string {
    if (str.length <= 4) return "****";
    return str.slice(0, 2) + "****" + str.slice(-2);
  }
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}
