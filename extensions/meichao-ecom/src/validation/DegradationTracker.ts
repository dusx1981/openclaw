import type { FallbackEvent, DegradationPath, DegradationInfo } from "./PlatformValidator.js";

export class DegradationTracker {
  private events: FallbackEvent[] = [];
  private paths: Map<string, number> = new Map();

  recordFallback(fromSource: string, toSource: string, productId: string): void {
    const event: FallbackEvent = {
      fromSource,
      toSource,
      timestamp: Date.now(),
      productId,
    };
    this.events.push(event);

    const pathKey = `${fromSource}→${toSource}`;
    const currentCount = this.paths.get(pathKey) ?? 0;
    this.paths.set(pathKey, currentCount + 1);
  }

  getTotalFallbacks(): number {
    return this.events.length;
  }

  getPaths(): DegradationPath[] {
    return Array.from(this.paths.entries()).map(([pathStr, count]) => ({
      path: pathStr.split("→"),
      count,
    }));
  }

  getEvents(): FallbackEvent[] {
    return [...this.events];
  }

  getInfo(): DegradationInfo {
    return {
      totalFallbacks: this.events.length,
      paths: this.getPaths(),
      events: this.getEvents(),
    };
  }

  reset(): void {
    this.events = [];
    this.paths.clear();
  }
}
