import type {
  Platform,
  CircuitBreakerConfig,
  CooldownSettings,
  HealthProbeConfig,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  DEFAULT_COOLDOWN_SETTINGS,
  DEFAULT_HEALTH_PROBE_CONFIG,
} from "./types.js";

export type DataSourceType = "official_api" | "third_party_api" | "skill_crawler";

export type DataSourceId = string;

export type PlatformDataSourceConfig =
  | DataSourceId
  | {
      primary?: DataSourceId;
      fallbacks?: DataSourceId[];
    };

export interface DataCollectionSettings {
  maxFallbackSources?: number;
  enableStaleCache?: boolean;
  staleCacheMaxAge?: number;
  circuitBreaker?: Partial<CircuitBreakerConfig>;
  cooldown?: Partial<CooldownSettings>;
  healthProbe?: Partial<HealthProbeConfig>;
}

export interface DataCollectionConfig {
  default?: PlatformDataSourceConfig;
  platforms?: Partial<Record<Platform, PlatformDataSourceConfig>>;
  settings?: DataCollectionSettings;
}

export const DEFAULT_DATA_COLLECTION_SETTINGS: Required<
  Omit<DataCollectionSettings, "circuitBreaker" | "cooldown" | "healthProbe">
> & {
  circuitBreaker: CircuitBreakerConfig;
  cooldown: CooldownSettings;
  healthProbe: HealthProbeConfig;
} = {
  maxFallbackSources: 3,
  enableStaleCache: true,
  staleCacheMaxAge: 3600000,
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,
    openDuration: 30000,
    halfOpenMaxCalls: 1,
    successThreshold: 3,
  },
  cooldown: {
    baseMinutes: 5,
    maxMinutes: 60,
    severeMultiplier: 12,
    probeWindowMinutes: 2,
    probeMinIntervalSeconds: 30,
  },
  healthProbe: {
    interval: 60000,
    initialDelay: 5000,
    timeout: 10000,
    unhealthyThreshold: 3,
    recoveryThreshold: 2,
  },
};

export function resolvePrimaryDataSource(config?: PlatformDataSourceConfig): string | undefined {
  if (typeof config === "string") {
    const trimmed = config.trim();
    return trimmed || undefined;
  }
  if (!config || typeof config !== "object") {
    return undefined;
  }
  const primary = config.primary?.trim();
  return primary || undefined;
}

export function resolveFallbackDataSources(config?: PlatformDataSourceConfig): string[] {
  if (!config || typeof config !== "object") {
    return [];
  }
  return Array.isArray(config.fallbacks) ? config.fallbacks : [];
}

export function buildDataSourceCandidates(
  config?: PlatformDataSourceConfig,
  defaultConfig?: PlatformDataSourceConfig,
  maxSources = 3,
): string[] {
  const primary = resolvePrimaryDataSource(config) || resolvePrimaryDataSource(defaultConfig);

  const fallbacks =
    resolveFallbackDataSources(config).length > 0
      ? resolveFallbackDataSources(config)
      : resolveFallbackDataSources(defaultConfig);

  const candidates: string[] = [];
  if (primary) {
    candidates.push(primary);
  }

  for (const fallback of fallbacks) {
    if (!candidates.includes(fallback)) {
      candidates.push(fallback);
    }
    if (candidates.length >= maxSources) {
      break;
    }
  }

  return candidates;
}

export function parseDataSourceId(id: string): {
  platform: Platform;
  sourceType: string;
} | null {
  const parts = id.split("/");
  if (parts.length !== 2) {
    return null;
  }

  const [platform, sourceType] = parts;
  const validPlatforms: Platform[] = [
    "taobao",
    "amazon",
    "douyin",
    "1688",
    "shopee",
    "pinduoduo",
    "jd",
    "aliexpress",
  ];

  if (!validPlatforms.includes(platform as Platform)) {
    return null;
  }

  return {
    platform: platform as Platform,
    sourceType,
  };
}

export function createDefaultDataCollectionConfig(): DataCollectionConfig {
  return {
    default: {
      primary: "taobao/official_api" as DataSourceId,
      fallbacks: ["taobao/third_party_api" as DataSourceId, "taobao/skill_crawler" as DataSourceId],
    },
    platforms: {
      taobao: {
        primary: "taobao/official_api" as DataSourceId,
        fallbacks: [
          "taobao/third_party_api" as DataSourceId,
          "taobao/skill_crawler" as DataSourceId,
        ],
      },
      amazon: {
        primary: "amazon/official_api" as DataSourceId,
        fallbacks: ["amazon/third_party_api" as DataSourceId],
      },
      douyin: "douyin/skill_crawler" as DataSourceId,
    },
    settings: DEFAULT_DATA_COLLECTION_SETTINGS,
  };
}
