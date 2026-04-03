import type { CircuitBreakerConfig, HealthProbeConfig } from "../../domain/types.js";
import { DEFAULT_CIRCUIT_BREAKER_CONFIG, DEFAULT_HEALTH_PROBE_CONFIG } from "../../domain/types.js";
import type { CooldownSettings } from "../degradation/types.js";

export interface DegradationConfig {
  circuitBreaker: CircuitBreakerConfig;
  cooldown: CooldownSettings;
  healthProbe: HealthProbeConfig;
}

export function loadDegradationConfig(): DegradationConfig {
  return {
    circuitBreaker: {
      enabled: parseEnvBool(
        "DEGRADATION_CIRCUIT_BREAKER_ENABLED",
        DEFAULT_CIRCUIT_BREAKER_CONFIG.enabled,
      ),
      failureThreshold: parseEnvNumber(
        "DEGRADATION_CIRCUIT_BREAKER_FAILURE_THRESHOLD",
        DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold,
      ),
      openDuration: parseEnvNumber(
        "DEGRADATION_CIRCUIT_BREAKER_OPEN_DURATION",
        DEFAULT_CIRCUIT_BREAKER_CONFIG.openDuration,
      ),
      halfOpenMaxCalls: parseEnvNumber(
        "DEGRADATION_CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS",
        DEFAULT_CIRCUIT_BREAKER_CONFIG.halfOpenMaxCalls,
      ),
      successThreshold: parseEnvNumber(
        "DEGRADATION_CIRCUIT_BREAKER_SUCCESS_THRESHOLD",
        DEFAULT_CIRCUIT_BREAKER_CONFIG.successThreshold,
      ),
    },
    cooldown: {
      enabled: parseEnvBool("DEGRADATION_COOLDOWN_ENABLED", true),
      normalDurations: parseEnvArray(
        "DEGRADATION_COOLDOWN_NORMAL_DURATIONS",
        [60000, 300000, 900000, 1800000],
      ),
      severeDurations: parseEnvArray(
        "DEGRADATION_COOLDOWN_SEVERE_DURATIONS",
        [3600000, 7200000, 14400000, 86400000],
      ),
    },
    healthProbe: {
      interval: parseEnvNumber(
        "DEGRADATION_HEALTH_PROBE_INTERVAL",
        DEFAULT_HEALTH_PROBE_CONFIG.interval,
      ),
      initialDelay: parseEnvNumber(
        "DEGRADATION_HEALTH_PROBE_INITIAL_DELAY",
        DEFAULT_HEALTH_PROBE_CONFIG.initialDelay,
      ),
      timeout: parseEnvNumber(
        "DEGRADATION_HEALTH_PROBE_TIMEOUT",
        DEFAULT_HEALTH_PROBE_CONFIG.timeout,
      ),
      unhealthyThreshold: parseEnvNumber(
        "DEGRADATION_HEALTH_PROBE_UNHEALTHY_THRESHOLD",
        DEFAULT_HEALTH_PROBE_CONFIG.unhealthyThreshold,
      ),
      recoveryThreshold: parseEnvNumber(
        "DEGRADATION_HEALTH_PROBE_RECOVERY_THRESHOLD",
        DEFAULT_HEALTH_PROBE_CONFIG.recoveryThreshold,
      ),
    },
  };
}

function parseEnvBool(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  return value === "true" || value === "1";
}

function parseEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseEnvArray(key: string, defaultValue: number[]): number[] {
  const value = process.env[key];
  if (value === undefined) return defaultValue;
  try {
    return JSON.parse(value);
  } catch {
    return defaultValue;
  }
}
