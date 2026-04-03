import type { DataSourceFailoverReason } from "../../domain/types.js";
import type { ClassifiedError, CooldownState, CooldownSettings } from "./types.js";

const DEFAULT_NORMAL_DURATIONS = [1, 5, 15, 30];
const DEFAULT_SEVERE_DURATIONS = [1, 2, 4, 24];
const DEFAULT_PROBE_WINDOW_MS = 60 * 1000; // 1 minute before cooldown ends
const DEFAULT_PROBE_MIN_INTERVAL_MS = 30 * 1000; // 30 seconds between probes

export interface ProbeConfig {
  probeWindowMs?: number;
  probeMinIntervalMs?: number;
  maxProbeAttempts?: number;
}

export class CooldownManager {
  private cooldowns: Map<string, CooldownState> = new Map();
  private probeAttempts: Map<string, number> = new Map();
  private lastProbeTime: Map<string, number> = new Map();
  private settings: {
    normalDurations: number[];
    severeDurations: number[];
    enabled: boolean;
    probeWindowMs: number;
    probeMinIntervalMs: number;
    maxProbeAttempts: number;
  };

  constructor(settings?: CooldownSettings & ProbeConfig) {
    this.settings = {
      normalDurations: settings?.normalDurations ?? DEFAULT_NORMAL_DURATIONS,
      severeDurations: settings?.severeDurations ?? DEFAULT_SEVERE_DURATIONS,
      enabled: settings?.enabled ?? true,
      probeWindowMs: settings?.probeWindowMs ?? DEFAULT_PROBE_WINDOW_MS,
      probeMinIntervalMs: settings?.probeMinIntervalMs ?? DEFAULT_PROBE_MIN_INTERVAL_MS,
      maxProbeAttempts: settings?.maxProbeAttempts ?? 3,
    };
  }

  isInCooldown(sourceId: string): boolean {
    if (!this.settings.enabled) {
      return false;
    }

    const state = this.cooldowns.get(sourceId);
    if (!state?.cooldownUntil) {
      return false;
    }
    return Date.now() < state.cooldownUntil;
  }

  canProbe(sourceId: string): boolean {
    if (!this.settings.enabled) {
      return false;
    }

    const state = this.cooldowns.get(sourceId);
    if (!state?.cooldownUntil) {
      return false;
    }

    const now = Date.now();

    // Not in probe window yet
    const probeWindowStart = state.cooldownUntil - this.settings.probeWindowMs;
    if (now < probeWindowStart) {
      return false;
    }

    // Already past cooldown
    if (now >= state.cooldownUntil) {
      return false;
    }

    // Check probe attempt limit
    const probeAttempts = this.probeAttempts.get(sourceId) ?? 0;
    if (probeAttempts >= this.settings.maxProbeAttempts) {
      return false;
    }

    // Check minimum interval since last probe
    const lastProbe = this.lastProbeTime.get(sourceId) ?? 0;
    if (now - lastProbe < this.settings.probeMinIntervalMs) {
      return false;
    }

    return true;
  }

  recordProbeAttempt(sourceId: string): void {
    const currentAttempts = this.probeAttempts.get(sourceId) ?? 0;
    this.probeAttempts.set(sourceId, currentAttempts + 1);
    this.lastProbeTime.set(sourceId, Date.now());
  }

  recordProbeSuccess(sourceId: string): void {
    this.recordSuccess(sourceId);
    this.probeAttempts.delete(sourceId);
    this.lastProbeTime.delete(sourceId);
  }

  recordProbeFailure(sourceId: string): void {
    this.recordProbeAttempt(sourceId);
  }

  getCooldownState(sourceId: string): CooldownState | undefined {
    return this.cooldowns.get(sourceId);
  }

  getProbeAttempts(sourceId: string): number {
    return this.probeAttempts.get(sourceId) ?? 0;
  }

  getTimeUntilProbeWindow(sourceId: string): number | null {
    const state = this.cooldowns.get(sourceId);
    if (!state?.cooldownUntil) {
      return null;
    }

    const probeWindowStart = state.cooldownUntil - this.settings.probeWindowMs;
    const remaining = probeWindowStart - Date.now();

    return Math.max(0, remaining);
  }

  recordFailure(sourceId: string, error: ClassifiedError): void {
    if (!this.settings.enabled) {
      return;
    }

    const currentState = this.cooldowns.get(sourceId);
    const now = Date.now();

    // Reset probe attempts on new failure
    this.probeAttempts.delete(sourceId);
    this.lastProbeTime.delete(sourceId);

    if (currentState?.cooldownUntil && now < currentState.cooldownUntil) {
      this.cooldowns.set(sourceId, {
        ...currentState,
        errorCount: currentState.errorCount + 1,
        lastErrorAt: now,
        lastErrorReason: error.reason,
      });
      return;
    }

    const errorCount = (currentState?.errorCount ?? 0) + 1;
    const duration = this.calculateCooldown(error, errorCount);

    this.cooldowns.set(sourceId, {
      sourceId,
      errorCount,
      cooldownUntil: now + duration,
      lastErrorAt: now,
      lastErrorReason: error.reason,
    });
  }

  recordSuccess(sourceId: string): void {
    this.cooldowns.set(sourceId, {
      sourceId,
      errorCount: 0,
      cooldownUntil: undefined,
      lastSuccessAt: Date.now(),
      lastErrorAt: undefined,
      lastErrorReason: undefined,
    });

    this.probeAttempts.delete(sourceId);
    this.lastProbeTime.delete(sourceId);
  }

  clearCooldown(sourceId: string): void {
    this.cooldowns.delete(sourceId);
    this.probeAttempts.delete(sourceId);
    this.lastProbeTime.delete(sourceId);
  }

  private calculateCooldown(error: ClassifiedError, errorCount: number): number {
    const isSevere = this.isSevereError(error.reason);
    const durations = isSevere
      ? this.settings.severeDurations.map((h) => h * 60 * 60 * 1000)
      : this.settings.normalDurations.map((m) => m * 60 * 1000);

    const index = Math.min(errorCount - 1, durations.length - 1);
    return durations[index];
  }

  private isSevereError(reason: DataSourceFailoverReason): boolean {
    return reason === "auth_permanent" || reason === "billing" || reason === "blocked";
  }
}
