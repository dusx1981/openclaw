import {
  DataSourceFailoverReason,
  CooldownSettings,
  SourceCooldownState,
  DEFAULT_COOLDOWN_SETTINGS,
} from "../../domain/types.js";
import { isSevereError } from "../classification/ErrorClassifier.js";

export interface CooldownManager {
  isInCooldown(sourceId: string): boolean;
  getCooldownState(sourceId: string): SourceCooldownState;
  canProbe(sourceId: string, hasFallback: boolean, isPrimary: boolean): boolean;
  recordSuccess(sourceId: string): void;
  recordError(sourceId: string, reason: DataSourceFailoverReason): void;
  recordProbeAttempt(sourceId: string): void;
  setCooldownSettings(settings: Partial<CooldownSettings>): void;
  getCooldownRemaining(sourceId: string): number | undefined;
}

export function calculateCooldownDuration(
  errorCount: number,
  reason: DataSourceFailoverReason,
  settings: CooldownSettings,
): number {
  const isSevere = isSevereError(reason);
  const base = isSevere ? settings.baseMinutes * settings.severeMultiplier : settings.baseMinutes;
  const maxMinutes = isSevere ? 24 * 60 : settings.maxMinutes;

  const duration = base * Math.pow(5, errorCount - 1);
  return Math.min(maxMinutes, duration) * 60 * 1000;
}

export class InMemoryCooldownManager implements CooldownManager {
  private states: Map<string, SourceCooldownState> = new Map();
  private settings: CooldownSettings;

  constructor(settings: Partial<CooldownSettings> = {}) {
    this.settings = { ...DEFAULT_COOLDOWN_SETTINGS, ...settings };
  }

  isInCooldown(sourceId: string): boolean {
    const state = this.getCooldownState(sourceId);
    if (!state.cooldownUntil) return false;
    return Date.now() < state.cooldownUntil;
  }

  getCooldownState(sourceId: string): SourceCooldownState {
    return (
      this.states.get(sourceId) || {
        sourceId,
        errorCount: 0,
      }
    );
  }

  getCooldownRemaining(sourceId: string): number | undefined {
    const state = this.getCooldownState(sourceId);
    if (!state.cooldownUntil) return undefined;
    const remaining = state.cooldownUntil - Date.now();
    return remaining > 0 ? remaining : undefined;
  }

  canProbe(sourceId: string, hasFallback: boolean, isPrimary: boolean): boolean {
    const state = this.getCooldownState(sourceId);

    if (!state.cooldownUntil) return false;

    if (!isPrimary || !hasFallback) return false;

    const now = Date.now();
    if (
      state.lastProbeAt &&
      now - state.lastProbeAt < this.settings.probeMinIntervalSeconds * 1000
    ) {
      return false;
    }

    const timeToCooldownEnd = state.cooldownUntil - now;
    if (timeToCooldownEnd > this.settings.probeWindowMinutes * 60 * 1000) {
      return false;
    }

    return true;
  }

  recordSuccess(sourceId: string): void {
    this.states.set(sourceId, {
      sourceId,
      errorCount: 0,
      lastSuccessAt: Date.now(),
      cooldownUntil: undefined,
      lastErrorAt: undefined,
      lastErrorReason: undefined,
      lastProbeAt: undefined,
    });
  }

  recordError(sourceId: string, reason: DataSourceFailoverReason): void {
    const currentState = this.getCooldownState(sourceId);
    const newErrorCount = currentState.errorCount + 1;
    const cooldownDuration = calculateCooldownDuration(newErrorCount, reason, this.settings);

    this.states.set(sourceId, {
      sourceId,
      errorCount: newErrorCount,
      lastErrorAt: Date.now(),
      lastErrorReason: reason,
      cooldownUntil: Date.now() + cooldownDuration,
      lastSuccessAt: currentState.lastSuccessAt,
    });
  }

  setCooldownSettings(settings: Partial<CooldownSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  recordProbeAttempt(sourceId: string): void {
    const state = this.getCooldownState(sourceId);
    this.states.set(sourceId, {
      ...state,
      lastProbeAt: Date.now(),
    });
  }

  clear(sourceId?: string): void {
    if (sourceId) {
      this.states.delete(sourceId);
    } else {
      this.states.clear();
    }
  }
}
