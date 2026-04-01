import {
  type DataCollectionConfig,
  type PlatformDataSourceConfig,
  type DataCollectionSettings,
  DEFAULT_DATA_COLLECTION_SETTINGS,
} from "./data-source-config.js";
import type { Platform } from "./types.js";

export interface ConfigLoader {
  load(): Promise<DataCollectionConfig>;
  loadSync(): DataCollectionConfig;
}

export function mergeSettings(
  base: DataCollectionSettings,
  override?: Partial<DataCollectionSettings>,
): DataCollectionSettings {
  if (!override) return base;

  const baseCircuitBreaker = base.circuitBreaker ?? DEFAULT_DATA_COLLECTION_SETTINGS.circuitBreaker;

  return {
    maxFallbackSources: override.maxFallbackSources ?? base.maxFallbackSources,
    enableStaleCache: override.enableStaleCache ?? base.enableStaleCache,
    staleCacheMaxAge: override.staleCacheMaxAge ?? base.staleCacheMaxAge,
    circuitBreaker: {
      enabled: override.circuitBreaker?.enabled ?? baseCircuitBreaker.enabled,
      failureThreshold:
        override.circuitBreaker?.failureThreshold ?? baseCircuitBreaker.failureThreshold,
      openDuration: override.circuitBreaker?.openDuration ?? baseCircuitBreaker.openDuration,
    },
  };
}

export function mergeConfigs(
  base: DataCollectionConfig,
  override?: Partial<DataCollectionConfig>,
): DataCollectionConfig {
  if (!override) return base;

  const platforms: Partial<Record<Platform, PlatformDataSourceConfig>> = {
    ...base.platforms,
  };

  if (override.platforms) {
    for (const [platform, config] of Object.entries(override.platforms)) {
      platforms[platform as Platform] = config;
    }
  }

  return {
    default: override.default ?? base.default,
    platforms,
    settings: mergeSettings(base.settings ?? DEFAULT_DATA_COLLECTION_SETTINGS, override.settings),
  };
}

export function validateConfig(config: unknown): config is DataCollectionConfig {
  if (typeof config !== "object" || config === null) {
    return false;
  }

  const cfg = config as Record<string, unknown>;

  if (cfg.default !== undefined && !isValidSourceConfig(cfg.default)) {
    return false;
  }

  if (cfg.platforms !== undefined) {
    if (typeof cfg.platforms !== "object" || cfg.platforms === null) {
      return false;
    }
    for (const config of Object.values(cfg.platforms)) {
      if (!isValidSourceConfig(config)) {
        return false;
      }
    }
  }

  if (cfg.settings !== undefined) {
    if (typeof cfg.settings !== "object" || cfg.settings === null) {
      return false;
    }
  }

  return true;
}

function isValidSourceConfig(config: unknown): boolean {
  if (typeof config === "string") {
    return config.length > 0;
  }

  if (typeof config === "object" && config !== null) {
    const cfg = config as Record<string, unknown>;
    if (cfg.primary !== undefined && typeof cfg.primary !== "string") {
      return false;
    }
    if (cfg.fallbacks !== undefined && !Array.isArray(cfg.fallbacks)) {
      return false;
    }
    return true;
  }

  return false;
}
