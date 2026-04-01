import {
  type PlatformDataSourceConfig,
  type DataCollectionSettings,
  buildDataSourceCandidates,
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
  DataSourceFailoverReason,
} from "../../domain/types.js";
import { DataSource } from "../../domain/value-objects/DataSource.js";
import { CircuitBreaker } from "../circuit-breaker/CircuitBreaker.js";
import { classifyError } from "../classification/ErrorClassifier.js";
import { InMemoryCooldownManager, type CooldownManager } from "../cooldown/CooldownManager.js";
import { InMemoryDecisionLogger, type DecisionLogger } from "../logging/DecisionLogger.js";

export interface AdapterConfig {
  platform: Platform;
  dataSources: DataSource[];
  defaultTimeoutMs: number;
  retryCount: number;
  retryDelayMs: number;
  sourceConfig?: PlatformDataSourceConfig;
  settings?: DataCollectionSettings;
}

export abstract class BasePlatformAdapter implements PlatformGateway {
  protected config: AdapterConfig;
  protected dataSources: Map<string, DataSource> = new Map();
  protected sourceConfig?: PlatformDataSourceConfig;
  protected settings: DataCollectionSettings;
  protected circuitBreakers: Map<string, CircuitBreaker> = new Map();
  protected cooldownManager: CooldownManager;
  protected decisionLogger: DecisionLogger;
  protected runId: string;

  constructor(config: AdapterConfig) {
    this.config = config;
    this.sourceConfig = config.sourceConfig;
    this.settings = { ...DEFAULT_DATA_COLLECTION_SETTINGS, ...config.settings };
    for (const ds of config.dataSources) {
      this.dataSources.set(ds.id, ds);
      this.circuitBreakers.set(ds.id, new CircuitBreaker(this.settings.circuitBreaker));
    }
    this.cooldownManager = new InMemoryCooldownManager(this.settings.cooldown);
    this.decisionLogger = new InMemoryDecisionLogger();
    this.runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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

  protected async withRetry<T>(fn: () => Promise<T>, retryCount?: number): Promise<T> {
    const maxRetries = retryCount ?? this.config.retryCount;
    let lastError: Error | null = null;

    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (i < maxRetries) {
          await this.delay(this.config.retryDelayMs * Math.pow(2, i));
        }
      }
    }

    throw lastError ?? new Error("Unknown error after retries");
  }

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

  setSourceConfig(config: PlatformDataSourceConfig): void {
    this.sourceConfig = config;
  }

  setSettings(settings: DataCollectionSettings): void {
    this.settings = { ...DEFAULT_DATA_COLLECTION_SETTINGS, ...settings };
  }

  protected getAvailableSources(): DataSource[] {
    return Array.from(this.dataSources.values())
      .filter((ds) => ds.isAvailable && ds.hasRemainingQuota())
      .sort((a, b) => a.priority - b.priority);
  }

  protected getConfiguredSourceCandidates(options?: FetchWithFailoverOptions): DataSource[] {
    let candidateIds: string[];

    if (this.sourceConfig) {
      candidateIds = buildDataSourceCandidates(
        this.sourceConfig,
        undefined,
        this.settings.maxFallbackSources,
      );
    } else {
      candidateIds = this.getAvailableSources().map((ds) => ds.id);
    }

    const preferredSource = options?.preferredSource ?? this.getPrimarySourceId();
    if (preferredSource) {
      candidateIds = candidateIds.filter((id) => id !== preferredSource);
      candidateIds.unshift(preferredSource);
    }

    return candidateIds
      .map((id) => this.dataSources.get(id))
      .filter((ds): ds is DataSource => ds != null && ds.isAvailable && ds.hasRemainingQuota());
  }

  protected recordSourceFailure(sourceId: string, error: string): void {
    this.updateDataSource(sourceId, {
      lastError: error,
    });
  }

  async fetchWithFailover<T>(
    fn: (source: DataSource) => Promise<T>,
    options?: FetchWithFailoverOptions,
  ): Promise<FailoverFetchResult<T>> {
    const attempts: SourceAttempt[] = [];
    const start = Date.now();

    let sources = this.getConfiguredSourceCandidates(options);

    if (options?.skipSources?.length) {
      sources = sources.filter((s) => !options.skipSources!.includes(s.id));
    }

    const maxSources = options?.maxSources ?? this.settings.maxFallbackSources;
    sources = sources.slice(0, maxSources);

    const configuredPrimaryId = this.getPrimarySourceId();
    const primarySourceId = options?.preferredSource ?? configuredPrimaryId ?? sources[0]?.id;

    let lastError: Error | null = null;

    for (const source of sources) {
      const circuitBreaker = this.circuitBreakers.get(source.id);
      if (circuitBreaker && !circuitBreaker.canExecute()) {
        this.decisionLogger.log({
          event: "degradation_decision",
          decision: "circuit_open",
          runId: this.runId,
          timestamp: Date.now(),
          platform: this.getPlatform(),
          productId: "",
          source: {
            id: source.id,
            type: source.type,
            priority: source.priority,
          },
          circuitBreaker: {
            state: circuitBreaker.getState(),
            failureCount: circuitBreaker.getFailureCount(),
          },
          latencyMs: 0,
        });
        continue;
      }

      const isPrimary = source.id === primarySourceId;
      const hasFallback = sources.some((s) => s.id !== source.id);

      if (this.cooldownManager.isInCooldown(source.id)) {
        if (this.cooldownManager.canProbe(source.id, hasFallback, isPrimary)) {
          this.cooldownManager.recordProbeAttempt(source.id);
          this.decisionLogger.log({
            event: "degradation_decision",
            decision: "probe_source",
            runId: this.runId,
            timestamp: Date.now(),
            platform: this.getPlatform(),
            productId: "",
            source: {
              id: source.id,
              type: source.type,
              priority: source.priority,
            },
            cooldown: {
              errorCount: this.cooldownManager.getCooldownState(source.id).errorCount,
              cooldownUntil: this.cooldownManager.getCooldownState(source.id).cooldownUntil ?? 0,
              willProbe: true,
            },
            latencyMs: 0,
          });
        } else {
          this.decisionLogger.log({
            event: "degradation_decision",
            decision: "skip_cooldown_source",
            runId: this.runId,
            timestamp: Date.now(),
            platform: this.getPlatform(),
            productId: "",
            source: {
              id: source.id,
              type: source.type,
              priority: source.priority,
            },
            cooldown: {
              errorCount: this.cooldownManager.getCooldownState(source.id).errorCount,
              cooldownUntil: this.cooldownManager.getCooldownState(source.id).cooldownUntil ?? 0,
              willProbe: false,
            },
            latencyMs: 0,
          });
          continue;
        }
      }

      const attemptStart = Date.now();

      try {
        const data = await this.withRetry(() => fn(source));

        attempts.push({
          sourceId: source.id,
          success: true,
          latencyMs: Date.now() - attemptStart,
        });

        circuitBreaker?.recordSuccess();
        this.cooldownManager.recordSuccess(source.id);
        this.updateDataSource(source.id, source.markAvailable().toData());

        this.decisionLogger.log({
          event: "degradation_decision",
          decision: "source_succeeded",
          runId: this.runId,
          timestamp: Date.now(),
          platform: this.getPlatform(),
          productId: "",
          source: {
            id: source.id,
            type: source.type,
            priority: source.priority,
          },
          latencyMs: Date.now() - attemptStart,
        });

        const degradationLevel: DegradationLevel =
          source.id === primarySourceId ? "primary_source" : "fallback_source";

        return {
          data,
          source: source.id,
          attempts,
          totalLatencyMs: Date.now() - start,
          degradationLevel,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        attempts.push({
          sourceId: source.id,
          success: false,
          error: lastError.message,
          latencyMs: Date.now() - attemptStart,
        });

        const classified = classifyError(lastError, this.getPlatform());
        circuitBreaker?.recordFailure();
        this.cooldownManager.recordError(source.id, classified.reason);

        this.decisionLogger.log({
          event: "degradation_decision",
          decision: "source_failed",
          runId: this.runId,
          timestamp: Date.now(),
          platform: this.getPlatform(),
          productId: "",
          source: {
            id: source.id,
            type: source.type,
            priority: source.priority,
          },
          error: {
            reason: classified.reason,
            message: lastError.message,
          },
          cooldown: {
            errorCount: this.cooldownManager.getCooldownState(source.id).errorCount,
            cooldownUntil: this.cooldownManager.getCooldownState(source.id).cooldownUntil ?? 0,
            willProbe: false,
          },
          latencyMs: Date.now() - attemptStart,
        });

        options?.onSourceFailure?.(source.id, lastError);
        this.recordSourceFailure(source.id, lastError.message);
      }
    }

    throw lastError ?? new Error("No available data sources");
  }

  protected getPrimarySourceId(): string | undefined {
    if (this.sourceConfig) {
      if (typeof this.sourceConfig === "string") {
        return this.sourceConfig;
      }
      return this.sourceConfig.primary;
    }
    return undefined;
  }
}
