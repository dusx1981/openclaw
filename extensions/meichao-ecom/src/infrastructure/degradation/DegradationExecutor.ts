import type {
  DataSource,
  Platform,
  DegradationLevel,
  ClassifiedError,
  DegradationDecisionLog,
} from "../../domain/types.js";
import type { DataSource as DataSourceVO } from "../../domain/value-objects/DataSource.js";
import type { DegradationPath } from "./DegradationPath.js";
import type {
  DegradationExecutorConfig,
  DegradationOptions,
  DegradationResult,
  SourceAttempt,
  RetryRunner,
  DecisionLogger,
  CooldownManager as CooldownManagerInterface,
} from "./types.js";

export class DegradationExecutor {
  private retryRunnerFactory: (platform: Platform) => RetryRunner;
  private errorClassifier: (error: unknown, platform: Platform) => ClassifiedError;
  private cooldownManager: CooldownManagerInterface;
  private decisionLogger: DecisionLogger;
  private runId: string;

  constructor(config: DegradationExecutorConfig) {
    this.retryRunnerFactory = config.retryRunnerFactory;
    this.errorClassifier = config.errorClassifier;
    this.cooldownManager = config.cooldownManager;
    this.decisionLogger = config.decisionLogger;
    this.runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  async execute<T>(
    path: DegradationPath,
    fn: (source: DataSource) => Promise<T>,
    options?: DegradationOptions,
  ): Promise<DegradationResult<T>> {
    const sources = path.getPath(options);
    const attempts: SourceAttempt[] = [];
    const startTime = Date.now();

    let filteredSources = sources;
    if (options?.skipSources?.length) {
      filteredSources = sources.filter((s) => !options.skipSources!.includes(s.id));
    }

    const maxSources = options?.maxSources ?? filteredSources.length;
    filteredSources = filteredSources.slice(0, maxSources);

    const configuredPrimary = path.getPrimarySourceId();
    const primarySourceId = options?.preferredSource ?? configuredPrimary;

    let lastError: Error | null = null;

    for (const source of filteredSources) {
      const attemptStart = Date.now();

      if (!options?.validateMode && this.cooldownManager.isInCooldown(source.id)) {
        this.decisionLogger.log({
          event: "degradation_decision",
          decision: "source_failed",
          runId: this.runId,
          timestamp: Date.now(),
          platform: source.platform,
          productId: "",
          source: {
            id: source.id,
            type: source.type,
            priority: source.priority,
          },
          latencyMs: 0,
        });
        continue;
      }

      const retryRunner = this.retryRunnerFactory(source.platform);

      try {
        const data = await retryRunner(() => fn(source));

        attempts.push({
          sourceId: source.id,
          success: true,
          latencyMs: Date.now() - attemptStart,
        });

        this.cooldownManager.recordSuccess(source.id);
        this.decisionLogger.log({
          event: "degradation_decision",
          decision: "source_succeeded",
          runId: this.runId,
          timestamp: Date.now(),
          platform: source.platform,
          productId: "",
          source: {
            id: source.id,
            type: source.type,
            priority: source.priority,
          },
          latencyMs: Date.now() - attemptStart,
        });

        if (!options?.validateMode) {
          const degradationLevel: DegradationLevel =
            source.id === primarySourceId ? "primary_source" : "fallback_source";

          return {
            success: true,
            data,
            source: source as DataSourceVO,
            attempts,
            latencyMs: Date.now() - startTime,
            degradationLevel,
          };
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const classifiedError = this.errorClassifier(error, source.platform);

        attempts.push({
          sourceId: source.id,
          success: false,
          latencyMs: Date.now() - attemptStart,
          error: classifiedError.message,
        });

        this.cooldownManager.recordFailure(source.id, classifiedError);
        this.decisionLogger.log({
          event: "degradation_decision",
          decision: "source_failed",
          runId: this.runId,
          timestamp: Date.now(),
          platform: source.platform,
          productId: "",
          source: {
            id: source.id,
            type: source.type,
            priority: source.priority,
          },
          error: {
            reason: classifiedError.reason,
            message: classifiedError.message,
          },
          latencyMs: Date.now() - attemptStart,
        });

        options?.onSourceFailure?.(source.id, lastError);
      }
    }

    if (options?.validateMode) {
      const successAttempts = attempts.filter((a) => a.success);
      return {
        success: successAttempts.length > 0,
        attempts,
        latencyMs: Date.now() - startTime,
        degradationLevel: successAttempts.length > 0 ? "primary_source" : "error",
      };
    }

    return {
      success: false,
      attempts,
      error: lastError ?? new Error("No available data sources"),
      latencyMs: Date.now() - startTime,
      degradationLevel: "error",
    };
  }
}
