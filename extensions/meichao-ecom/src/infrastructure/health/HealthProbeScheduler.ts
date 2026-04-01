import { HealthProbeConfig, DEFAULT_HEALTH_PROBE_CONFIG, DataSource } from "../../domain/types.js";

export interface HealthStatus {
  sourceId: string;
  isHealthy: boolean;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastProbeAt?: number;
  lastError?: string;
}

export interface HealthProbeScheduler {
  start(): void;
  stop(): void;
  getHealthStatus(sourceId: string): HealthStatus;
  markUnhealthy(sourceId: string, reason?: string): void;
  markHealthy(sourceId: string): void;
}

type ProbeFunction = (source: DataSource) => Promise<boolean>;

export class TimerBasedHealthProbeScheduler implements HealthProbeScheduler {
  private healthStatuses: Map<string, HealthStatus> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private readonly config: HealthProbeConfig;
  private readonly getSources: () => DataSource[];
  private readonly probeFn: ProbeFunction;
  private running = false;

  constructor(
    getSources: () => DataSource[],
    probeFn: ProbeFunction,
    config: Partial<HealthProbeConfig> = {},
  ) {
    this.getSources = getSources;
    this.probeFn = probeFn;
    this.config = { ...DEFAULT_HEALTH_PROBE_CONFIG, ...config };
  }

  start(): void {
    this.running = true;
    setTimeout(() => {
      this.scheduleProbes();
    }, this.config.initialDelay);
  }

  stop(): void {
    this.running = false;
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  getHealthStatus(sourceId: string): HealthStatus {
    return (
      this.healthStatuses.get(sourceId) || {
        sourceId,
        isHealthy: true,
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
      }
    );
  }

  markUnhealthy(sourceId: string, reason?: string): void {
    const current = this.getHealthStatus(sourceId);
    this.healthStatuses.set(sourceId, {
      ...current,
      isHealthy: false,
      consecutiveFailures: current.consecutiveFailures + 1,
      consecutiveSuccesses: 0,
      lastError: reason,
    });
  }

  markHealthy(sourceId: string): void {
    const current = this.getHealthStatus(sourceId);
    this.healthStatuses.set(sourceId, {
      ...current,
      isHealthy: true,
      consecutiveFailures: 0,
      consecutiveSuccesses: current.consecutiveSuccesses + 1,
      lastError: undefined,
    });
  }

  private scheduleProbes(): void {
    if (!this.running) return;

    const sources = this.getSources();
    for (const source of sources) {
      const status = this.getHealthStatus(source.id);
      if (!status.isHealthy) {
        this.scheduleProbe(source);
      }
    }

    setTimeout(() => {
      this.scheduleProbes();
    }, this.config.interval);
  }

  private scheduleProbe(source: DataSource): void {
    const existingTimer = this.timers.get(source.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    this.executeProbe(source);
  }

  private async executeProbe(source: DataSource): Promise<void> {
    const status = this.getHealthStatus(source.id);
    this.healthStatuses.set(source.id, {
      ...status,
      lastProbeAt: Date.now(),
    });

    try {
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        setTimeout(() => {
          reject(new Error("Probe timeout"));
        }, this.config.timeout);
      });

      const isHealthy = await Promise.race([this.probeFn(source), timeoutPromise]);

      if (isHealthy) {
        this.recordProbeSuccess(source.id);
      } else {
        this.recordProbeFailure(source.id, "Probe returned unhealthy");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown probe error";
      this.recordProbeFailure(source.id, message);
    }
  }

  private recordProbeSuccess(sourceId: string): void {
    const current = this.getHealthStatus(sourceId);
    const newSuccessCount = current.consecutiveSuccesses + 1;

    if (newSuccessCount >= this.config.recoveryThreshold) {
      this.healthStatuses.set(sourceId, {
        sourceId,
        isHealthy: true,
        consecutiveFailures: 0,
        consecutiveSuccesses: newSuccessCount,
        lastProbeAt: Date.now(),
      });
    } else {
      this.healthStatuses.set(sourceId, {
        ...current,
        consecutiveSuccesses: newSuccessCount,
        lastProbeAt: Date.now(),
      });
    }
  }

  private recordProbeFailure(sourceId: string, reason: string): void {
    const current = this.getHealthStatus(sourceId);
    const newFailureCount = current.consecutiveFailures + 1;

    if (newFailureCount >= this.config.unhealthyThreshold) {
      this.healthStatuses.set(sourceId, {
        sourceId,
        isHealthy: false,
        consecutiveFailures: newFailureCount,
        consecutiveSuccesses: 0,
        lastProbeAt: Date.now(),
        lastError: reason,
      });
    } else {
      this.healthStatuses.set(sourceId, {
        ...current,
        consecutiveFailures: newFailureCount,
        consecutiveSuccesses: 0,
        lastProbeAt: Date.now(),
        lastError: reason,
      });
    }
  }
}
