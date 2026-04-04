import pg from "pg";
import { getPool } from "./postgres.js";

export interface PoolStatus {
  total: number;
  idle: number;
  waiting: number;
  healthy: boolean;
  lastCheck: Date;
  error?: string;
}

export interface PoolMetrics {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
  maxConnections: number;
  connectionUsage: number;
  waitQueueLength: number;
}

export interface HealthCheckConfig {
  warningThreshold: number;
  criticalThreshold: number;
  checkInterval: number;
  autoReconnect: boolean;
  maxReconnectAttempts: number;
  reconnectDelay: number;
}

const DEFAULT_CONFIG: HealthCheckConfig = {
  warningThreshold: 0.8,
  criticalThreshold: 0.9,
  checkInterval: 30000,
  autoReconnect: true,
  maxReconnectAttempts: 3,
  reconnectDelay: 1000,
};

export class PoolHealthCheck {
  private config: HealthCheckConfig;
  private lastStatus: PoolStatus | null = null;
  private reconnectAttempts = 0;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<HealthCheckConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async getPoolStatus(): Promise<PoolStatus> {
    try {
      const pool = getPool();

      const status: PoolStatus = {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
        healthy: this.isHealthy(pool),
        lastCheck: new Date(),
      };

      this.lastStatus = status;
      this.reconnectAttempts = 0;

      return status;
    } catch (error) {
      const status: PoolStatus = {
        total: 0,
        idle: 0,
        waiting: 0,
        healthy: false,
        lastCheck: new Date(),
        error: error instanceof Error ? error.message : "Unknown error",
      };

      this.lastStatus = status;

      if (this.config.autoReconnect) {
        await this.handleReconnect();
      }

      return status;
    }
  }

  getMetrics(): PoolMetrics | null {
    try {
      const pool = getPool();

      const metrics: PoolMetrics = {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
        maxConnections: pool.options.max ?? 10,
        connectionUsage: pool.totalCount / (pool.options.max ?? 10),
        waitQueueLength: pool.waitingCount,
      };

      return metrics;
    } catch {
      return null;
    }
  }

  async checkAndAlert(): Promise<{ status: PoolStatus; alert?: "warning" | "critical" }> {
    const status = await this.getPoolStatus();

    const metrics = this.getMetrics();
    if (!metrics) {
      return { status, alert: "critical" };
    }

    if (metrics.connectionUsage >= this.config.criticalThreshold) {
      console.error(
        `CRITICAL: Connection pool usage at ${(metrics.connectionUsage * 100).toFixed(2)}%`,
      );
      console.error(
        `Total: ${metrics.totalCount}, Idle: ${metrics.idleCount}, Waiting: ${metrics.waitingCount}`,
      );
      return { status, alert: "critical" };
    }

    if (metrics.connectionUsage >= this.config.warningThreshold) {
      console.warn(
        `WARNING: Connection pool usage at ${(metrics.connectionUsage * 100).toFixed(2)}%`,
      );
      console.warn(
        `Total: ${metrics.totalCount}, Idle: ${metrics.idleCount}, Waiting: ${metrics.waitingCount}`,
      );
      return { status, alert: "warning" };
    }

    return { status };
  }

  async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error(`Failed to reconnect after ${this.reconnectAttempts} attempts`);
      return;
    }

    this.reconnectAttempts++;
    console.log(
      `Attempting to reconnect (${this.reconnectAttempts}/${this.config.maxReconnectAttempts})...`,
    );

    await new Promise((resolve) =>
      setTimeout(resolve, this.config.reconnectDelay * this.reconnectAttempts),
    );

    try {
      const pool = getPool();

      try {
        await pool.query("SELECT 1");
        console.log("Reconnect successful");
        this.reconnectAttempts = 0;
      } catch (queryError) {
        console.log("Pool query failed, connection may be lost");
        throw queryError;
      }
    } catch (error) {
      console.error(`Reconnect attempt ${this.reconnectAttempts} failed:`, error);

      if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
        await this.handleReconnect();
      }
    }
  }

  startPeriodicCheck(callback?: (status: PoolStatus) => void): void {
    if (this.checkInterval) {
      this.stopPeriodicCheck();
    }

    this.checkInterval = setInterval(async () => {
      const { status, alert } = await this.checkAndAlert();

      if (callback) {
        callback(status);
      }
    }, this.config.checkInterval);

    console.log(`Started periodic pool health check (interval: ${this.config.checkInterval}ms)`);
  }

  stopPeriodicCheck(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log("Stopped periodic pool health check");
    }
  }

  getLastStatus(): PoolStatus | null {
    return this.lastStatus;
  }

  private isHealthy(pool: pg.Pool): boolean {
    const maxConnections = pool.options.max ?? 10;
    const usage = pool.totalCount / maxConnections;

    return (
      pool.totalCount < maxConnections &&
      pool.waitingCount < maxConnections * 0.5 &&
      usage < this.config.criticalThreshold
    );
  }

  async waitForHealthy(timeout = 30000): Promise<boolean> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const status = await this.getPoolStatus();

      if (status.healthy) {
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return false;
  }
}
