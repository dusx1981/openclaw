export { DegradationPath } from "./DegradationPath.js";
export { DegradationExecutor } from "./DegradationExecutor.js";
export { CooldownManager, type ProbeConfig } from "./CooldownManager.js";
export { SessionStickiness } from "./SessionStickiness.js";

export type {
  DegradationOptions,
  CooldownState,
  CooldownSettings,
  SourceAttempt,
  DegradationResult,
  DegradationExecutorConfig,
  DecisionLogger,
  CooldownManager as CooldownManagerInterface,
  RetryRunner,
  CircuitBreakerConfig,
  DegradationDecisionLog,
  ClassifiedError,
} from "./types.js";

export { InMemoryDecisionLogger, FileDecisionLogger } from "../logging/DecisionLogger.js";
export type { PersistedDecisionLoggerConfig } from "../logging/DecisionLogger.js";
