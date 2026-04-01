import { DegradationDecisionLog } from "../../domain/types.js";

export interface DecisionLogger {
  log(log: DegradationDecisionLog): void;
  getByRunId(runId: string): DegradationDecisionLog[];
  getRecent(limit: number): DegradationDecisionLog[];
  clear(): void;
}

export class InMemoryDecisionLogger implements DecisionLogger {
  private logs: DegradationDecisionLog[] = [];
  private maxSize: number;

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

  private outputLog(log: DegradationDecisionLog): void {
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

  getStats(): {
    total: number;
    byDecision: Record<string, number>;
    byPlatform: Record<string, number>;
  } {
    const byDecision: Record<string, number> = {};
    const byPlatform: Record<string, number> = {};

    for (const log of this.logs) {
      byDecision[log.decision] = (byDecision[log.decision] || 0) + 1;
      byPlatform[log.platform] = (byPlatform[log.platform] || 0) + 1;
    }

    return {
      total: this.logs.length,
      byDecision,
      byPlatform,
    };
  }
}
