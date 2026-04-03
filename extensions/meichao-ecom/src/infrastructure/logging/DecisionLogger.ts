import * as fs from "fs";
import * as path from "path";
import type { DegradationDecisionLog } from "../../domain/types.js";

export interface DecisionLogger {
  log(log: DegradationDecisionLog): void;
  getByRunId(runId: string): DegradationDecisionLog[];
  getRecent(limit: number): DegradationDecisionLog[];
  clear(): void;
}

export interface PersistedDecisionLoggerConfig {
  logDir?: string;
  maxFileSize?: number;
  maxFiles?: number;
  flushIntervalMs?: number;
}

export class InMemoryDecisionLogger implements DecisionLogger {
  protected logs: DegradationDecisionLog[] = [];
  protected maxSize: number;

  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize;
  }

  log(log: DegradationDecisionLog): void {
    this.logs.push(log);

    if (this.logs.length > this.maxSize) {
      this.logs = this.logs.slice(-this.maxSize);
    }

    this.outputLog(log);
  }

  getByRunId(runId: string): DegradationDecisionLog[] {
    return this.logs.filter((log) => log.runId === runId);
  }

  getRecent(limit: number): DegradationDecisionLog[] {
    return this.logs.slice(-limit);
  }

  clear(): void {
    this.logs = [];
  }

  protected outputLog(log: DegradationDecisionLog): void {
    console.log(JSON.stringify(log));
  }

  getAll(): DegradationDecisionLog[] {
    return [...this.logs];
  }

  getByDecision(decision: DegradationDecisionLog["decision"]): DegradationDecisionLog[] {
    return this.logs.filter((log) => log.decision === decision);
  }

  getByPlatform(platform: string): DegradationDecisionLog[] {
    return this.logs.filter((log) => log.platform === platform);
  }

  getBySourceId(sourceId: string): DegradationDecisionLog[] {
    return this.logs.filter((log) => log.source?.id === sourceId);
  }

  getByTimeRange(startTime: number, endTime: number): DegradationDecisionLog[] {
    return this.logs.filter((log) => log.timestamp >= startTime && log.timestamp <= endTime);
  }

  getStats(): {
    total: number;
    byDecision: Record<string, number>;
    byPlatform: Record<string, number>;
    bySource: Record<string, number>;
  } {
    const byDecision: Record<string, number> = {};
    const byPlatform: Record<string, number> = {};
    const bySource: Record<string, number> = {};

    for (const log of this.logs) {
      byDecision[log.decision] = (byDecision[log.decision] || 0) + 1;
      byPlatform[log.platform] = (byPlatform[log.platform] || 0) + 1;
      if (log.source?.id) {
        bySource[log.source.id] = (bySource[log.source.id] || 0) + 1;
      }
    }

    return {
      total: this.logs.length,
      byDecision,
      byPlatform,
      bySource,
    };
  }
}

export class FileDecisionLogger extends InMemoryDecisionLogger {
  private logDir: string;
  private currentLogFile: string;
  private maxFileSize: number;
  private maxFiles: number;
  private flushBuffer: DegradationDecisionLog[] = [];
  private flushIntervalMs: number;
  private flushTimer?: ReturnType<typeof setInterval>;
  private writePromise: Promise<void> = Promise.resolve();

  constructor(config: PersistedDecisionLoggerConfig = {}) {
    super(config.maxFileSize ? 100000 : 10000);
    this.logDir = config.logDir ?? "./logs/degradation";
    this.maxFileSize = config.maxFileSize ?? 10 * 1024 * 1024; // 10MB
    this.maxFiles = config.maxFiles ?? 10;
    this.flushIntervalMs = config.flushIntervalMs ?? 1000;
    this.currentLogFile = this.getLogFileName();

    this.ensureLogDir();
    this.startFlushTimer();
  }

  private ensureLogDir(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private getLogFileName(): string {
    const date = new Date().toISOString().split("T")[0];
    return path.join(this.logDir, `degradation-${date}.jsonl`);
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushIntervalMs);
  }

  log(log: DegradationDecisionLog): void {
    super.log(log);
    this.flushBuffer.push(log);
  }

  private async flush(): Promise<void> {
    if (this.flushBuffer.length === 0) return;

    const logsToWrite = [...this.flushBuffer];
    this.flushBuffer = [];

    await this.writePromise;

    this.writePromise = this.writeLogs(logsToWrite);
  }

  private async writeLogs(logs: DegradationDecisionLog[]): Promise<void> {
    try {
      await this.rotateIfNeeded();

      const lines = logs.map((log) => JSON.stringify(log)).join("\n") + "\n";
      await fs.promises.appendFile(this.currentLogFile, lines);
    } catch (error) {
      console.error("Failed to write decision logs:", error);
    }
  }

  private async rotateIfNeeded(): Promise<void> {
    try {
      const stats = await fs.promises.stat(this.currentLogFile).catch(() => null);

      if (stats && stats.size >= this.maxFileSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const rotatedFile = path.join(this.logDir, `degradation-${timestamp}.jsonl`);

        await fs.promises.rename(this.currentLogFile, rotatedFile);
        this.currentLogFile = this.getLogFileName();

        await this.cleanupOldFiles();
      }
    } catch {
      // File doesn't exist yet, no rotation needed
    }
  }

  private async cleanupOldFiles(): Promise<void> {
    const files = await fs.promises.readdir(this.logDir);
    const logFiles = files
      .filter((f) => f.startsWith("degradation-") && f.endsWith(".jsonl"))
      .sort()
      .reverse();

    for (let i = this.maxFiles; i < logFiles.length; i++) {
      await fs.promises.unlink(path.join(this.logDir, logFiles[i]));
    }
  }

  async loadFromFile(filePath: string): Promise<number> {
    try {
      const content = await fs.promises.readFile(filePath, "utf-8");
      const lines = content.trim().split("\n");
      let loaded = 0;

      for (const line of lines) {
        try {
          const log = JSON.parse(line) as DegradationDecisionLog;
          this.logs.push(log);
          loaded++;
        } catch {
          // Skip malformed lines
        }
      }

      return loaded;
    } catch {
      return 0;
    }
  }

  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flush();
  }

  clear(): void {
    super.clear();
    this.flushBuffer = [];
  }
}
