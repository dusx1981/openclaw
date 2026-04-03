import type { PlatformDataSourceConfig } from "../../domain/data-source-config.js";
import type {
  DataSourceType,
  DataSourceFailoverReason,
  Platform,
  CircuitBreakerConfig,
  DegradationLevel,
  DegradationDecisionLog,
  ClassifiedError,
} from "../../domain/types.js";
import type { DataSource as DataSourceValueObject } from "../../domain/value-objects/DataSource.js";

/**
 * 降级选项
 */
export interface DegradationOptions {
  preferredSource?: string;
  preset?: "standard" | "cost-optimized" | "speed-optimized" | "reliability-first";
  skipTypes?: DataSourceType[];
  maxSources?: number;
  allowCrawler?: boolean;
  allowOpenSearch?: boolean;
  customOrder?: DataSourceType[];
  validateMode?: boolean;
  skipSources?: string[];
  onSourceFailure?: (sourceId: string, error: Error) => void;
}

/**
 * 冷却状态
 */
export interface CooldownState {
  sourceId: string;
  errorCount: number;
  cooldownUntil?: number;
  lastErrorAt?: number;
  lastErrorReason?: DataSourceFailoverReason;
  lastSuccessAt?: number;
}

/**
 * 冷却时间配置
 */
export interface CooldownSettings {
  normalDurations?: number[];
  severeDurations?: number[];
  enabled?: boolean;
}

/**
 * 数据源尝试记录
 */
export interface SourceAttempt {
  sourceId: string;
  success: boolean;
  latencyMs: number;
  error?: string;
}

/**
 * 降级结果
 */
export interface DegradationResult<T> {
  success: boolean;
  data?: T;
  source?: DataSourceValueObject;
  degradationLevel?: DegradationLevel;
  error?: Error;
  attempts?: SourceAttempt[];
  latencyMs?: number;
  cached?: boolean;
}

/**
 * 降级执行器配置
 */
export interface DegradationExecutorConfig {
  retryRunnerFactory: (platform: Platform) => RetryRunner;
  circuitBreakerConfig: import("../../domain/types.js").CircuitBreakerConfig;
  errorClassifier: (
    error: unknown,
    platform: Platform,
  ) => import("../../domain/types.js").ClassifiedError;
  cooldownManager: CooldownManager;
  decisionLogger: DecisionLogger;
  cooldownSettings?: CooldownSettings;
}

/**
 * 重试运行器（简化接口）
 */
export interface RetryRunner {
  <T>(fn: () => Promise<T>): Promise<T>;
}

export type {
  CircuitBreakerConfig,
  DegradationDecisionLog,
  ClassifiedError,
} from "../../domain/types.js";

/**
 * 决策日志记录器
 */
export interface DecisionLogger {
  log(entry: DegradationDecisionLog): void;
  getByRunId(runId: string): DegradationDecisionLog[];
  getRecent(limit: number): DegradationDecisionLog[];
  clear(): void;
}

/**
 * 冷却管理器接口
 */
export interface CooldownManager {
  isInCooldown(sourceId: string): boolean;
  getCooldownState(sourceId: string): CooldownState | undefined;
  recordFailure(sourceId: string, error: import("../../domain/types.js").ClassifiedError): void;
  recordSuccess(sourceId: string): void;
  clearCooldown(sourceId: string): void;
}
