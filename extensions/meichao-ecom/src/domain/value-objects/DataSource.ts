import type { Platform, DataSourceType } from "../types.js";

export interface DataSourceData {
  id: string;
  platform: Platform;
  type: DataSourceType;
  priority: number;
  costPerCall: number;
  dailyQuota: number;
  usedQuota: number;
  isAvailable: boolean;
  lastError?: string;
  lastSuccessAt?: Date;
}

export class DataSource {
  private readonly _id: string;
  private readonly _platform: Platform;
  private readonly _type: DataSourceType;
  private readonly _priority: number;
  private readonly _costPerCall: number;
  private readonly _dailyQuota: number;
  private _usedQuota: number;
  private _isAvailable: boolean;
  private _lastError?: string;
  private _lastSuccessAt?: Date;

  private constructor(data: DataSourceData) {
    this._id = data.id;
    this._platform = data.platform;
    this._type = data.type;
    this._priority = data.priority;
    this._costPerCall = data.costPerCall;
    this._dailyQuota = data.dailyQuota;
    this._usedQuota = data.usedQuota;
    this._isAvailable = data.isAvailable;
    this._lastError = data.lastError;
    this._lastSuccessAt = data.lastSuccessAt;
  }

  static create(data: DataSourceData): DataSource {
    DataSource.validate(data);
    return new DataSource(data);
  }

  static validate(data: DataSourceData): void {
    if (!data.id || data.id.trim() === "") {
      throw new Error("DataSource ID is required");
    }
    if (!data.platform) {
      throw new Error("Platform is required");
    }
    if (!data.type) {
      throw new Error("DataSource type is required");
    }
    if (data.priority < 0) {
      throw new Error("Priority cannot be negative");
    }
    if (data.costPerCall < 0) {
      throw new Error("Cost per call cannot be negative");
    }
    if (data.dailyQuota <= 0) {
      throw new Error("Daily quota must be positive");
    }
    if (data.usedQuota < 0) {
      throw new Error("Used quota cannot be negative");
    }
  }

  get id(): string {
    return this._id;
  }

  get platform(): Platform {
    return this._platform;
  }

  get type(): DataSourceType {
    return this._type;
  }

  get priority(): number {
    return this._priority;
  }

  get costPerCall(): number {
    return this._costPerCall;
  }

  get dailyQuota(): number {
    return this._dailyQuota;
  }

  get usedQuota(): number {
    return this._usedQuota;
  }

  get isAvailable(): boolean {
    return this._isAvailable;
  }

  get lastError(): string | undefined {
    return this._lastError;
  }

  get lastSuccessAt(): Date | undefined {
    return this._lastSuccessAt;
  }

  hasRemainingQuota(): boolean {
    return this._usedQuota < this._dailyQuota;
  }

  remainingQuota(): number {
    return Math.max(0, this._dailyQuota - this._usedQuota);
  }

  quotaPercentUsed(): number {
    return (this._usedQuota / this._dailyQuota) * 100;
  }

  incrementUsage(amount = 1): DataSource {
    const data = this.toData();
    data.usedQuota = Math.min(data.usedQuota + amount, data.dailyQuota);
    return new DataSource(data);
  }

  markUnavailable(error: string): DataSource {
    const data = this.toData();
    data.isAvailable = false;
    data.lastError = error;
    return new DataSource(data);
  }

  markAvailable(): DataSource {
    const data = this.toData();
    data.isAvailable = true;
    data.lastError = undefined;
    data.lastSuccessAt = new Date();
    return new DataSource(data);
  }

  resetQuota(): DataSource {
    const data = this.toData();
    data.usedQuota = 0;
    return new DataSource(data);
  }

  toData(): DataSourceData {
    return {
      id: this._id,
      platform: this._platform,
      type: this._type,
      priority: this._priority,
      costPerCall: this._costPerCall,
      dailyQuota: this._dailyQuota,
      usedQuota: this._usedQuota,
      isAvailable: this._isAvailable,
      lastError: this._lastError,
      lastSuccessAt: this._lastSuccessAt,
    };
  }

  toJSON(): Record<string, unknown> {
    return {
      ...this.toData(),
      remainingQuota: this.remainingQuota(),
      quotaPercentUsed: this.quotaPercentUsed(),
    };
  }
}
