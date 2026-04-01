import type { Platform } from "../types.js";

export interface QuotaData {
  sourceId: string;
  platform: Platform;
  used: number;
  total: number;
}

export class Quota {
  private readonly _sourceId: string;
  private readonly _platform: Platform;
  private readonly _total: number;
  private _used: number;

  private constructor(data: QuotaData) {
    this._sourceId = data.sourceId;
    this._platform = data.platform;
    this._total = data.total;
    this._used = data.used;
  }

  static create(data: QuotaData): Quota {
    Quota.validate(data);
    return new Quota(data);
  }

  static validate(data: QuotaData): void {
    if (!data.sourceId || data.sourceId.trim() === "") {
      throw new Error("Source ID is required");
    }
    if (!data.platform) {
      throw new Error("Platform is required");
    }
    if (data.total <= 0) {
      throw new Error("Total quota must be positive");
    }
    if (data.used < 0) {
      throw new Error("Used quota cannot be negative");
    }
    if (data.used > data.total) {
      throw new Error("Used quota cannot exceed total quota");
    }
  }

  get sourceId(): string {
    return this._sourceId;
  }

  get platform(): Platform {
    return this._platform;
  }

  get total(): number {
    return this._total;
  }

  get used(): number {
    return this._used;
  }

  remaining(): number {
    return this._total - this._used;
  }

  percentUsed(): number {
    return (this._used / this._total) * 100;
  }

  isOverLimit(): boolean {
    return this._used >= this._total;
  }

  isNearLimit(threshold = 80): boolean {
    return this.percentUsed() >= threshold;
  }

  canUse(amount = 1): boolean {
    return this._used + amount <= this._total;
  }

  increment(amount = 1): Quota {
    return new Quota({
      sourceId: this._sourceId,
      platform: this._platform,
      total: this._total,
      used: Math.min(this._used + amount, this._total),
    });
  }

  reset(): Quota {
    return new Quota({
      sourceId: this._sourceId,
      platform: this._platform,
      total: this._total,
      used: 0,
    });
  }

  toData(): QuotaData {
    return {
      sourceId: this._sourceId,
      platform: this._platform,
      used: this._used,
      total: this._total,
    };
  }

  toJSON(): Record<string, unknown> {
    return {
      ...this.toData(),
      remaining: this.remaining(),
      percentUsed: this.percentUsed(),
      isOverLimit: this.isOverLimit(),
      isNearLimit: this.isNearLimit(),
    };
  }
}
