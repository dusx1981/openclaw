import {
  type DataCollectionSettings,
  DEFAULT_DATA_COLLECTION_SETTINGS,
} from "../../domain/data-source-config.js";
import type {
  PlatformGateway,
  FetchOptions,
  SearchOptions,
  AdapterHealth,
} from "../../domain/ports/PlatformGateway.js";
import type {
  FetchResult,
  ProductData,
  Platform,
  FetchWithFailoverOptions,
  FailoverFetchResult,
  SourceAttempt,
  DegradationLevel,
} from "../../domain/types.js";
import type { DataSource as DataSourceEntity } from "../../domain/types.js";
import type { DataSource as DataSourceVO } from "../../domain/value-objects/DataSource.js";
import { DataSource } from "../../domain/value-objects/DataSource.js";
import { classifyError } from "../classification/ErrorClassifier.js";
import { DegradationPath, DegradationExecutor, CooldownManager } from "../degradation/index.js";
import type { DegradationOptions, DegradationResult } from "../degradation/types.js";
import { InMemoryDecisionLogger } from "../logging/DecisionLogger.js";
import { createPlatformRetryRunner } from "../retry-policy.js";

export interface AdapterConfig {
  platform: Platform;
  dataSources: DataSource[];
  defaultTimeoutMs: number;
  retryCount: number;
  retryDelayMs: number;
  settings?: DataCollectionSettings;
}

export abstract class BasePlatformAdapter implements PlatformGateway {
  protected config: AdapterConfig;
  protected dataSources: Map<string, DataSource> = new Map();
  protected settings: DataCollectionSettings;
  protected degradationExecutor: DegradationExecutor;
  protected cooldownManager: CooldownManager;
  protected decisionLogger: InMemoryDecisionLogger;

  constructor(config: AdapterConfig) {
    this.config = config;
    this.settings = { ...DEFAULT_DATA_COLLECTION_SETTINGS, ...config.settings };

    for (const ds of config.dataSources) {
      this.dataSources.set(ds.id, ds);
    }

    this.cooldownManager = new CooldownManager();
    this.decisionLogger = new InMemoryDecisionLogger();

    this.degradationExecutor = new DegradationExecutor({
      retryRunnerFactory: (platform) => createPlatformRetryRunner(platform),
      circuitBreakerConfig: {
        enabled: this.settings.circuitBreaker?.enabled ?? true,
        failureThreshold: this.settings.circuitBreaker?.failureThreshold ?? 5,
        openDuration: this.settings.circuitBreaker?.openDuration ?? 60000,
        halfOpenMaxCalls: this.settings.circuitBreaker?.halfOpenMaxCalls ?? 10,
        successThreshold: this.settings.circuitBreaker?.successThreshold ?? 3,
      },
      errorClassifier: (error, platform) => classifyError(error, platform),
      cooldownManager: this.cooldownManager,
      decisionLogger: this.decisionLogger,
    });
  }

  abstract getPlatform(): Platform;

  abstract fetchProduct(
    platformId: string,
    options?: FetchOptions,
  ): Promise<FetchResult<ProductData>>;

  abstract fetchProducts(
    platformIds: string[],
    options?: FetchOptions,
  ): Promise<FetchResult<ProductData>[]>;

  abstract searchProducts(
    keyword: string,
    options?: SearchOptions,
  ): Promise<
    FetchResult<{ products: ProductData[]; total: number; page: number; pageSize: number }>
  >;

  async healthCheck(): Promise<AdapterHealth> {
    const sources = Array.from(this.dataSources.values());
    const availableSources = sources.filter((ds) => ds.isAvailable && ds.hasRemainingQuota());
    const errors: string[] = [];

    for (const ds of sources) {
      if (!ds.isAvailable && ds.lastError) {
        errors.push(`${ds.id}: ${ds.lastError}`);
      }
    }

    return {
      isHealthy: availableSources.length > 0,
      availableSources: availableSources.length,
      totalSources: sources.length,
      lastCheckAt: new Date(),
      errors,
    };
  }

  async getAvailableDataSources(): Promise<string[]> {
    const sources = Array.from(this.dataSources.values());
    return sources
      .filter((ds) => ds.isAvailable && ds.hasRemainingQuota())
      .sort((a, b) => a.priority - b.priority)
      .map((ds) => ds.id);
  }

  protected getDataSource(sourceId?: string): DataSource | null {
    if (sourceId) {
      return this.dataSources.get(sourceId) ?? null;
    }
    const sources = Array.from(this.dataSources.values())
      .filter((ds) => ds.isAvailable && ds.hasRemainingQuota())
      .sort((a, b) => a.priority - b.priority);
    return sources[0] ?? null;
  }

  protected createSuccessResult<T>(
    data: T,
    source: string,
    latencyMs: number,
    cached: boolean,
  ): FetchResult<T> {
    return {
      success: true,
      data,
      source,
      latencyMs,
      cached,
    };
  }

  protected createErrorResult<T>(error: string, source: string, latencyMs: number): FetchResult<T> {
    return {
      success: false,
      error,
      source,
      latencyMs,
      cached: false,
    };
  }

  addDataSource(dataSource: DataSource): void {
    this.dataSources.set(dataSource.id, dataSource);
  }

  removeDataSource(sourceId: string): boolean {
    return this.dataSources.delete(sourceId);
  }

  updateDataSource(sourceId: string, updates: Partial<DataSource>): boolean {
    const existing = this.dataSources.get(sourceId);
    if (!existing) return false;

    const updated = DataSource.create({
      ...existing.toData(),
      ...updates,
    } as Parameters<typeof DataSource.create>[0]);
    this.dataSources.set(sourceId, updated);
    return true;
  }

  setSettings(settings: DataCollectionSettings): void {
    this.settings = { ...DEFAULT_DATA_COLLECTION_SETTINGS, ...settings };
  }

  protected getAvailableSources(): DataSource[] {
    return Array.from(this.dataSources.values())
      .filter((ds) => ds.isAvailable && ds.hasRemainingQuota())
      .sort((a, b) => a.priority - b.priority);
  }

  protected buildDegradationPath(): DegradationPath {
    const sourceEntities: DataSourceEntity[] = Array.from(this.dataSources.values()).map((ds) => ({
      id: ds.id,
      platform: ds.platform,
      type: ds.type,
      priority: ds.priority,
      costPerCall: ds.costPerCall,
      dailyQuota: ds.dailyQuota,
      usedQuota: ds.usedQuota,
      isAvailable: ds.isAvailable,
      lastError: ds.lastError,
      lastSuccessAt: ds.lastSuccessAt,
    }));

    return new DegradationPath(this.getPlatform(), sourceEntities);
  }

  protected buildDegradationOptions(options?: FetchWithFailoverOptions): DegradationOptions {
    return {
      preferredSource: options?.preferredSource ?? this.getPrimarySourceId(),
      maxSources: options?.maxSources ?? this.settings.maxFallbackSources,
      skipSources: options?.skipSources,
      onSourceFailure: options?.onSourceFailure,
      preset: options?.preset,
      skipTypes: options?.skipTypes,
      allowCrawler: options?.allowCrawler ?? false,
      allowOpenSearch: options?.allowOpenSearch,
    };
  }

  async fetchWithFailover<T>(
    fn: (source: DataSource) => Promise<T>,
    options?: FetchWithFailoverOptions,
  ): Promise<FailoverFetchResult<T>> {
    const path = this.buildDegradationPath();
    const degradationOptions = this.buildDegradationOptions(options);

    const result = await this.degradationExecutor.execute(
      path,
      async (sourceEntity) => {
        const ds = this.dataSources.get(sourceEntity.id);
        if (!ds) {
          throw new Error(`DataSource ${sourceEntity.id} not found`);
        }
        return fn(ds);
      },
      degradationOptions,
    );

    return this.convertToFailoverResult(result);
  }

  protected convertToFailoverResult<T>(result: DegradationResult<T>): FailoverFetchResult<T> {
    if (!result.success || !result.data) {
      throw result.error ?? new Error("All sources failed");
    }

    return {
      data: result.data,
      source: result.source?.id ?? "unknown",
      attempts: result.attempts ?? [],
      totalLatencyMs: result.latencyMs ?? 0,
      degradationLevel: result.degradationLevel ?? "primary_source",
    };
  }

  protected getPrimarySourceId(): string | undefined {
    return undefined;
  }
}
