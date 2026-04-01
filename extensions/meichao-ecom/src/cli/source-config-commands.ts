import type {
  DataCollectionConfig,
  PlatformDataSourceConfig,
} from "../domain/data-source-config.js";
import {
  resolvePrimaryDataSource,
  resolveFallbackDataSources,
  createDefaultDataCollectionConfig,
} from "../domain/data-source-config.js";
import type { Platform } from "../domain/types.js";

export interface SourceConfigCommandOptions {
  platform?: Platform;
  json?: boolean;
}

export interface SourceConfigRuntime {
  loadConfig(): Promise<DataCollectionConfig>;
  saveConfig(config: DataCollectionConfig): Promise<void>;
  log(message: string): void;
  error(message: string): void;
}

export async function listSourcesCommand(
  opts: SourceConfigCommandOptions,
  runtime: SourceConfigRuntime,
): Promise<void> {
  const config = await runtime.loadConfig();

  if (opts.json) {
    runtime.log(JSON.stringify(config, null, 2));
    return;
  }

  if (opts.platform) {
    const platformConfig = config.platforms?.[opts.platform];
    if (!platformConfig) {
      runtime.log(`Platform ${opts.platform}: using default config`);
      return;
    }

    const primary = resolvePrimaryDataSource(platformConfig);
    const fallbacks = resolveFallbackDataSources(platformConfig);

    runtime.log(`Platform: ${opts.platform}`);
    runtime.log(`  Primary: ${primary ?? "none"}`);
    runtime.log(`  Fallbacks (${fallbacks.length}):`);
    if (fallbacks.length === 0) {
      runtime.log("    - none");
    } else {
      for (const fb of fallbacks) {
        runtime.log(`    - ${fb}`);
      }
    }
    return;
  }

  runtime.log("Data Source Configuration:");
  runtime.log("");

  if (config.default) {
    const primary = resolvePrimaryDataSource(config.default);
    const fallbacks = resolveFallbackDataSources(config.default);
    runtime.log("Default:");
    runtime.log(`  Primary: ${primary ?? "none"}`);
    runtime.log(`  Fallbacks: ${fallbacks.join(", ") || "none"}`);
    runtime.log("");
  }

  if (config.platforms) {
    runtime.log("Platforms:");
    for (const [platform, platformConfig] of Object.entries(config.platforms)) {
      const primary = resolvePrimaryDataSource(platformConfig);
      const fallbacks = resolveFallbackDataSources(platformConfig);
      runtime.log(`  ${platform}:`);
      runtime.log(`    Primary: ${primary ?? "none"}`);
      runtime.log(`    Fallbacks: ${fallbacks.join(", ") || "none"}`);
    }
  }

  if (config.settings) {
    runtime.log("");
    runtime.log("Settings:");
    runtime.log(`  Max Fallback Sources: ${config.settings.maxFallbackSources ?? 3}`);
    runtime.log(`  Enable Stale Cache: ${config.settings.enableStaleCache ?? true}`);
    runtime.log(`  Stale Cache Max Age: ${config.settings.staleCacheMaxAge ?? 3600000}ms`);
  }
}

export async function setPrimarySourceCommand(
  platform: Platform,
  sourceId: string,
  runtime: SourceConfigRuntime,
): Promise<void> {
  const config = await runtime.loadConfig();

  const platforms = { ...config.platforms };
  const existing = platforms[platform];

  if (typeof existing === "object" && existing !== null) {
    platforms[platform] = {
      ...existing,
      primary: sourceId,
    };
  } else if (typeof existing === "string") {
    platforms[platform] = {
      primary: sourceId,
      fallbacks: [],
    };
  } else {
    platforms[platform] = {
      primary: sourceId,
      fallbacks: [],
    };
  }

  const updated: DataCollectionConfig = {
    ...config,
    platforms,
  };

  await runtime.saveConfig(updated);
  runtime.log(`Set primary source for ${platform}: ${sourceId}`);
}

export async function addFallbackSourceCommand(
  platform: Platform,
  sourceId: string,
  runtime: SourceConfigRuntime,
): Promise<void> {
  const config = await runtime.loadConfig();

  const platforms = { ...config.platforms };
  const existing = platforms[platform];
  const existingFallbacks = resolveFallbackDataSources(existing);

  if (existingFallbacks.includes(sourceId)) {
    runtime.log(`Fallback source ${sourceId} already exists for ${platform}`);
    return;
  }

  const primary = resolvePrimaryDataSource(existing);

  platforms[platform] = {
    primary: primary ?? undefined,
    fallbacks: [...existingFallbacks, sourceId],
  };

  const updated: DataCollectionConfig = {
    ...config,
    platforms,
  };

  await runtime.saveConfig(updated);
  runtime.log(`Added fallback source for ${platform}: ${sourceId}`);
  runtime.log(`Current fallbacks: ${[...existingFallbacks, sourceId].join(", ")}`);
}

export async function removeFallbackSourceCommand(
  platform: Platform,
  sourceId: string,
  runtime: SourceConfigRuntime,
): Promise<void> {
  const config = await runtime.loadConfig();

  const platforms = { ...config.platforms };
  const existing = platforms[platform];
  const existingFallbacks = resolveFallbackDataSources(existing);

  const filtered = existingFallbacks.filter((fb: string) => fb !== sourceId);

  if (filtered.length === existingFallbacks.length) {
    runtime.error(`Fallback source ${sourceId} not found for ${platform}`);
    return;
  }

  const primary = resolvePrimaryDataSource(existing);

  platforms[platform] = {
    primary: primary ?? undefined,
    fallbacks: filtered,
  };

  const updated: DataCollectionConfig = {
    ...config,
    platforms,
  };

  await runtime.saveConfig(updated);
  runtime.log(`Removed fallback source for ${platform}: ${sourceId}`);
  runtime.log(`Current fallbacks: ${filtered.join(", ") || "none"}`);
}

export async function resetPlatformConfigCommand(
  platform: Platform,
  runtime: SourceConfigRuntime,
): Promise<void> {
  const config = await runtime.loadConfig();

  const defaultConfig = createDefaultDataCollectionConfig();
  const platforms = { ...config.platforms };

  if (defaultConfig.platforms?.[platform]) {
    platforms[platform] = defaultConfig.platforms[platform];
  } else {
    delete platforms[platform];
  }

  const updated: DataCollectionConfig = {
    ...config,
    platforms,
  };

  await runtime.saveConfig(updated);
  runtime.log(`Reset configuration for ${platform} to default`);
}
