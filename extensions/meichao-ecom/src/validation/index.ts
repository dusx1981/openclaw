export {
  PlatformValidator,
  type ValidationOptions,
  type ValidationResult,
  type ValidationStats,
  type SourceStats,
  type FailureReason,
  type FallbackEvent,
  type DegradationPath,
  type DegradationInfo,
  type SampleProduct,
} from "./PlatformValidator.js";

export { StatsCollector, categorizeFailure } from "./ValidationStats.js";
export { SampleCollector } from "./SampleCollector.js";
export { DegradationTracker } from "./DegradationTracker.js";
export { ValidationReport, formatDuration } from "./ValidationReport.js";
export { TaobaoValidator } from "./TaobaoValidator.js";
export { AmazonValidator } from "./AmazonValidator.js";
export { ValidatorRegistry } from "./ValidatorRegistry.js";
