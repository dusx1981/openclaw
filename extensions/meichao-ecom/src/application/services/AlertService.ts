import type { Platform } from "../../domain/types.js";

export interface AlertConfig {
  enabled: boolean;
  channels: AlertChannel[];
  cooldownMinutes: number;
}

export interface AlertChannel {
  type: "feishu" | "email" | "webhook";
  config: Record<string, unknown>;
}

export interface AlertMessage {
  id: string;
  type: "quota_warning" | "quota_critical" | "fetch_error" | "health_check";
  platform?: Platform;
  message: string;
  details: Record<string, unknown>;
  createdAt: Date;
}

class AlertServiceImpl {
  private config: AlertConfig = {
    enabled: true,
    channels: [],
    cooldownMinutes: 5,
  };
  private recentAlerts: Map<string, Date> = new Map();

  configure(config: Partial<AlertConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async sendQuotaAlert(
    platform: Platform,
    sourceId: string,
    percentUsed: number,
    severity: "warning" | "critical",
  ): Promise<void> {
    if (!this.config.enabled) return;

    const alertKey = `quota:${sourceId}`;
    if (this.isInCooldown(alertKey)) return;

    const message: AlertMessage = {
      id: this.generateId(),
      type: severity === "critical" ? "quota_critical" : "quota_warning",
      platform,
      message:
        severity === "critical"
          ? `Critical: ${sourceId} quota at ${percentUsed.toFixed(1)}%`
          : `Warning: ${sourceId} quota at ${percentUsed.toFixed(1)}%`,
      details: { sourceId, percentUsed },
      createdAt: new Date(),
    };

    await this.deliverAlert(message);
    this.recentAlerts.set(alertKey, new Date());
  }

  async sendFetchErrorAlert(platform: Platform, platformId: string, error: string): Promise<void> {
    if (!this.config.enabled) return;

    const alertKey = `fetch:${platform}:${platformId}`;
    if (this.isInCooldown(alertKey)) return;

    const message: AlertMessage = {
      id: this.generateId(),
      type: "fetch_error",
      platform,
      message: `Failed to fetch product ${platformId}: ${error}`,
      details: { platformId, error },
      createdAt: new Date(),
    };

    await this.deliverAlert(message);
    this.recentAlerts.set(alertKey, new Date());
  }

  async sendHealthCheckAlert(platform: Platform, errors: string[]): Promise<void> {
    if (!this.config.enabled) return;

    const alertKey = `health:${platform}`;
    if (this.isInCooldown(alertKey)) return;

    const message: AlertMessage = {
      id: this.generateId(),
      type: "health_check",
      platform,
      message: `Health check failed for ${platform}: ${errors.length} errors`,
      details: { errors },
      createdAt: new Date(),
    };

    await this.deliverAlert(message);
    this.recentAlerts.set(alertKey, new Date());
  }

  private isInCooldown(key: string): boolean {
    const lastAlert = this.recentAlerts.get(key);
    if (!lastAlert) return false;

    const cooldownMs = this.config.cooldownMinutes * 60 * 1000;
    return Date.now() - lastAlert.getTime() < cooldownMs;
  }

  private async deliverAlert(message: AlertMessage): Promise<void> {
    for (const channel of this.config.channels) {
      try {
        await this.sendToChannel(channel, message);
      } catch (error) {
        console.error(`Failed to send alert to ${channel.type}:`, error);
      }
    }
  }

  private async sendToChannel(channel: AlertChannel, message: AlertMessage): Promise<void> {
    switch (channel.type) {
      case "webhook":
        await fetch(channel.config.url as string, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(message),
        });
        break;
      case "feishu":
      case "email":
        console.log(`[Alert] ${channel.type}: ${message.message}`);
        break;
    }
  }

  private generateId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  clearRecentAlerts(): void {
    this.recentAlerts.clear();
  }
}

export const AlertService = new AlertServiceImpl();
