export type Platform =
  | "taobao"
  | "amazon"
  | "douyin"
  | "1688"
  | "shopee"
  | "pinduoduo"
  | "jd"
  | "aliexpress";

export type ProductStatus = "active" | "inactive" | "deleted" | "sold_out";

export type ProductPriority = "P0" | "P1" | "P2";

export type SalesPeriod = "day" | "week" | "month";

export type DataSourceType = "official_api" | "third_party_api" | "skill_crawler";

export interface ProductData {
  platform: Platform;
  platformId: string;
  title: string;
  mainImage?: string;
  images?: string[];
  sourceUrl: string;
  price: number;
  originalPrice?: number;
  currency: string;
  sales: number;
  salesUnit?: string;
  salesPeriod: SalesPeriod;
  rating?: number;
  reviewsCount?: number;
  shopId?: string;
  shopName?: string;
  shopUrl?: string;
  categoryId?: string;
  categoryName?: string;
  categoryPath?: string[];
  status: ProductStatus;
  priority: ProductPriority;
  isTrending: boolean;
  merchantId?: string;
  tags?: string[];
  extraData?: Record<string, unknown>;
}

export interface DataSource {
  id: string;
  platform: Platform;
  type: DataSourceType;
  priority: number;
  costPerCall: number;
  dailyQuota: number;
  usedQuota: number;
  isAvailable: boolean;
  lastError?: string;
  lastSuccessAt?: Date;
}

export interface FetchResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  source: string;
  latencyMs: number;
  cached: boolean;
  degradationLevel?: DegradationLevel;
  attempts?: SourceAttempt[];
  isDegraded?: boolean;
}

export interface QuotaInfo {
  sourceId: string;
  platform: Platform;
  used: number;
  total: number;
  remaining: number;
  percentUsed: number;
  isOverBudget: boolean;
}

export interface CacheEntry<T> {
  data: T;
  createdAt: Date;
  expiresAt: Date;
  source: string;
  isStale: boolean;
}

export const DEFAULT_CURRENCY = "CNY";

export const PLATFORM_NAMES: Record<Platform, string> = {
  taobao: "淘宝",
  amazon: "Amazon",
  douyin: "抖音",
  "1688": "1688",
  shopee: "Shopee",
  pinduoduo: "拼多多",
  jd: "京东",
  aliexpress: "AliExpress",
};

export const PLATFORM_CURRENCIES: Record<Platform, string> = {
  taobao: "CNY",
  amazon: "USD",
  douyin: "CNY",
  "1688": "CNY",
  shopee: "SGD",
  pinduoduo: "CNY",
  jd: "CNY",
  aliexpress: "USD",
};

export type DegradationLevel =
  | "fresh_cache"
  | "database"
  | "primary_source"
  | "fallback_source"
  | "stale_cache"
  | "error";

export interface SourceAttempt {
  sourceId: string;
  success: boolean;
  error?: string;
  latencyMs: number;
}

export interface FetchWithFailoverOptions {
  preferredSource?: string;
  maxSources?: number;
  skipSources?: string[];
  onSourceFailure?: (sourceId: string, error: Error) => void;
}

export interface FailoverFetchResult<T> {
  data: T;
  source: string;
  attempts: SourceAttempt[];
  totalLatencyMs: number;
  degradationLevel: DegradationLevel;
}

export type DataSourceFailoverReason =
  | "auth"
  | "auth_permanent"
  | "rate_limit"
  | "overloaded"
  | "billing"
  | "timeout"
  | "not_found"
  | "blocked"
  | "captcha"
  | "unknown";

export type CircuitBreakerState = "closed" | "open" | "half-open";

export interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number;
  openDuration: number;
  halfOpenMaxCalls: number;
  successThreshold: number;
}

export interface CooldownSettings {
  baseMinutes: number;
  maxMinutes: number;
  severeMultiplier: number;
  probeWindowMinutes: number;
  probeMinIntervalSeconds: number;
}

export interface SourceCooldownState {
  sourceId: string;
  errorCount: number;
  lastErrorAt?: number;
  lastErrorReason?: DataSourceFailoverReason;
  cooldownUntil?: number;
  lastSuccessAt?: number;
  lastProbeAt?: number;
}

export interface HealthProbeConfig {
  interval: number;
  initialDelay: number;
  timeout: number;
  unhealthyThreshold: number;
  recoveryThreshold: number;
}

export type DegradationDecision =
  | "skip_cooldown_source"
  | "probe_source"
  | "source_failed"
  | "source_succeeded"
  | "circuit_open"
  | "fallback_to_stale";

export interface DegradationDecisionLog {
  event: "degradation_decision";
  decision: DegradationDecision;
  runId: string;
  timestamp: number;
  platform: string;
  productId: string;
  source: {
    id: string;
    type: DataSourceType;
    priority: number;
  };
  error?: {
    reason: DataSourceFailoverReason;
    message: string;
    status?: number;
    code?: string;
  };
  cooldown?: {
    errorCount: number;
    cooldownUntil: number;
    willProbe: boolean;
  };
  circuitBreaker?: {
    state: CircuitBreakerState;
    failureCount: number;
  };
  latencyMs: number;
  degradationLevel?: number;
}

export type DegradationSourceType =
  | "fresh_cache"
  | "database"
  | "primary_source"
  | "fallback_source"
  | "stale_cache";

export interface DegradationResult<T> {
  data: T;
  sourceType: DegradationSourceType;
  degradationLevel: number;
  isDegraded: boolean;
  age?: number;
  circuitBreakerState?: CircuitBreakerState;
  cooldownRemaining?: number;
}

export interface ClassifiedError {
  reason: DataSourceFailoverReason;
  originalError: Error;
  message: string;
  status?: number;
  code?: string;
  isSevere: boolean;
}

export const SEVERE_FAILOVER_REASONS: DataSourceFailoverReason[] = [
  "auth_permanent",
  "billing",
  "blocked",
];

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  enabled: true,
  failureThreshold: 5,
  openDuration: 30000,
  halfOpenMaxCalls: 1,
  successThreshold: 3,
};

export const DEFAULT_COOLDOWN_SETTINGS: CooldownSettings = {
  baseMinutes: 5,
  maxMinutes: 60,
  severeMultiplier: 12,
  probeWindowMinutes: 2,
  probeMinIntervalSeconds: 30,
};

export const DEFAULT_HEALTH_PROBE_CONFIG: HealthProbeConfig = {
  interval: 60000,
  initialDelay: 5000,
  timeout: 10000,
  unhealthyThreshold: 3,
  recoveryThreshold: 2,
};
