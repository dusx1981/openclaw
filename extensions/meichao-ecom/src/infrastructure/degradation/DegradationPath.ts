import type { DataSource, DataSourceType, Platform } from "../../domain/types.js";
import type { DegradationOptions } from "./types.js";

export class DegradationPath {
  static readonly CORE_ORDER: DataSourceType[] = [
    "official_api",
    "third_party_api",
    "skill_crawler",
    "open_search",
  ];

  static readonly PRESETS: Record<string, DataSourceType[]> = {
    standard: ["official_api", "third_party_api", "skill_crawler", "open_search"],
    "cost-optimized": ["official_api", "skill_crawler", "open_search"],
    "speed-optimized": ["third_party_api", "official_api", "open_search"],
    "reliability-first": ["official_api", "third_party_api"],
  };

  private platform: Platform;
  private sources: Map<string, DataSource>;

  constructor(platform: Platform, sources: DataSource[]) {
    this.platform = platform;
    this.sources = new Map(sources.map((s) => [s.id, s]));
  }

  getPath(options?: DegradationOptions): DataSource[] {
    return this.getTypeBasedPath(options);
  }

  private getTypeBasedPath(options?: DegradationOptions): DataSource[] {
    let typeOrder: DataSourceType[];

    if (options?.customOrder) {
      if (!this.validateCustomOrder(options.customOrder)) {
        console.warn(
          `[DegradationPath] Invalid custom order: ${options.customOrder.join(", ")}. Falling back to CORE_ORDER.`,
        );
        typeOrder = DegradationPath.CORE_ORDER;
      } else {
        typeOrder = options.customOrder;
      }
    } else if (options?.preset) {
      typeOrder = DegradationPath.PRESETS[options.preset];
    } else {
      typeOrder = DegradationPath.CORE_ORDER;
    }

    if (!typeOrder) {
      typeOrder = DegradationPath.CORE_ORDER;
    }

    let filteredTypes = typeOrder.filter((type) => !options?.skipTypes?.includes(type));

    if (options?.allowCrawler === false) {
      filteredTypes = filteredTypes.filter((t) => t !== "skill_crawler");
    }
    if (options?.allowOpenSearch === false) {
      filteredTypes = filteredTypes.filter((t) => t !== "open_search");
    }

    const result: DataSource[] = [];
    const preferredSource = options?.preferredSource;

    if (preferredSource) {
      const source = this.sources.get(preferredSource);
      if (source && source.isAvailable && this.hasRemainingQuota(source)) {
        result.push(source);
      }
    }

    for (const type of filteredTypes) {
      const source = this.findSourceByType(type);

      if (
        source &&
        source.id !== preferredSource &&
        source.isAvailable &&
        this.hasRemainingQuota(source)
      ) {
        if (options?.skipSources?.includes(source.id)) continue;
        result.push(source);
      }

      if (options?.maxSources && result.length >= options.maxSources) {
        break;
      }
    }

    return result;
  }

  private validateCustomOrder(order: DataSourceType[]): boolean {
    const validTypes = new Set<DataSourceType>(DegradationPath.CORE_ORDER);

    for (const type of order) {
      if (!validTypes.has(type)) {
        return false;
      }
    }

    const uniqueTypes = new Set(order);
    if (uniqueTypes.size !== order.length) {
      return false;
    }

    return true;
  }

  getPrimarySourceId(): string | undefined {
    const firstType = DegradationPath.CORE_ORDER[0];
    const source = this.findSourceByType(firstType);
    return source?.id;
  }

  private findSourceByType(type: DataSourceType): DataSource | null {
    for (const source of Array.from(this.sources.values())) {
      if (source.type === type) {
        return source;
      }
    }
    return null;
  }

  private hasRemainingQuota(source: DataSource): boolean {
    return source.usedQuota < source.dailyQuota;
  }
}
