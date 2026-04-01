import type { Platform } from "../../domain/types.js";
import type { DataSource } from "../../domain/value-objects/DataSource.js";

export interface QuotaStatus {
  sourceId: string;
  platform: Platform;
  used: number;
  total: number;
  remaining: number;
  percentUsed: number;
  isOverBudget: boolean;
}

export interface QuotaAlert {
  sourceId: string;
  platform: Platform;
  percentUsed: number;
  message: string;
  severity: "warning" | "critical";
}

class QuotaServiceImpl {
  private quotas: Map<string, DataSource> = new Map();
  private alertThresholds = {
    warning: 80,
    critical: 95,
  };

  registerDataSource(dataSource: DataSource): void {
    this.quotas.set(dataSource.id, dataSource);
  }

  unregisterDataSource(sourceId: string): boolean {
    return this.quotas.delete(sourceId);
  }

  getQuotaStatus(sourceId: string): QuotaStatus | null {
    const ds = this.quotas.get(sourceId);
    if (!ds) return null;

    return {
      sourceId: ds.id,
      platform: ds.platform,
      used: ds.usedQuota,
      total: ds.dailyQuota,
      remaining: ds.remainingQuota(),
      percentUsed: ds.quotaPercentUsed(),
      isOverBudget: ds.quotaPercentUsed() >= 100,
    };
  }

  getAllQuotaStatuses(): QuotaStatus[] {
    return Array.from(this.quotas.values()).map((ds) => ({
      sourceId: ds.id,
      platform: ds.platform,
      used: ds.usedQuota,
      total: ds.dailyQuota,
      remaining: ds.remainingQuota(),
      percentUsed: ds.quotaPercentUsed(),
      isOverBudget: ds.quotaPercentUsed() >= 100,
    }));
  }

  incrementUsage(sourceId: string, amount = 1): boolean {
    const ds = this.quotas.get(sourceId);
    if (!ds) return false;

    const updated = ds.incrementUsage(amount);
    this.quotas.set(sourceId, updated);
    return true;
  }

  resetDailyQuotas(): void {
    for (const [id, ds] of this.quotas) {
      this.quotas.set(id, ds.resetQuota());
    }
  }

  checkAlerts(): QuotaAlert[] {
    const alerts: QuotaAlert[] = [];

    for (const ds of this.quotas.values()) {
      const percentUsed = ds.quotaPercentUsed();

      if (percentUsed >= this.alertThresholds.critical) {
        alerts.push({
          sourceId: ds.id,
          platform: ds.platform,
          percentUsed,
          message: `Critical: ${ds.id} quota at ${percentUsed.toFixed(1)}%`,
          severity: "critical",
        });
      } else if (percentUsed >= this.alertThresholds.warning) {
        alerts.push({
          sourceId: ds.id,
          platform: ds.platform,
          percentUsed,
          message: `Warning: ${ds.id} quota at ${percentUsed.toFixed(1)}%`,
          severity: "warning",
        });
      }
    }

    return alerts;
  }

  setAlertThresholds(warning: number, critical: number): void {
    this.alertThresholds = { warning, critical };
  }
}

export const QuotaService = new QuotaServiceImpl();
