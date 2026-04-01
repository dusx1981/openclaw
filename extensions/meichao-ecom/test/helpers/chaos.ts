export type ChaosEffect = () => Promise<void> | void;

export interface ChaosConfig {
  seed?: number;
  enabled?: boolean;
}

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }
}

class ChaosImpl {
  private random: SeededRandom | null = null;
  private enabled = true;

  setSeed(seed: number): void {
    this.random = new SeededRandom(seed);
  }

  reset(): void {
    this.random = null;
    this.enabled = true;
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private get defaultRandom(): SeededRandom {
    return this.random ?? new SeededRandom(Date.now());
  }

  async injectLatency(ms: number): Promise<void> {
    if (!this.enabled) return;
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  async injectRandomLatency(minMs: number, maxMs: number): Promise<void> {
    if (!this.enabled) return;
    const ms = this.defaultRandom.nextInt(minMs, maxMs);
    await this.injectLatency(ms);
  }

  shouldFail(rate: number): boolean {
    if (!this.enabled) return false;
    return this.defaultRandom.next() < rate;
  }

  injectFailure(rate: number, error?: Error): void {
    if (!this.enabled) return;
    if (this.shouldFail(rate)) {
      throw error ?? new Error("Injected failure");
    }
  }

  injectPartialResponse<T extends Record<string, unknown>>(
    data: T,
    removeRate: number,
    preserveKeys?: string[],
  ): Partial<T> {
    if (!this.enabled) return data;

    const result: Partial<T> = {};
    const keys = Object.keys(data) as (keyof T)[];

    for (const key of keys) {
      if (preserveKeys?.includes(key as string) || this.defaultRandom.next() > removeRate) {
        result[key] = data[key];
      }
    }

    return result;
  }

  injectCorruptedResponse<T>(
    data: T,
    corruptionType: "null" | "undefined" | "wrong_type" = "null",
  ): T | null | undefined {
    if (!this.enabled) return data;

    switch (corruptionType) {
      case "null":
        return null;
      case "undefined":
        return undefined;
      case "wrong_type":
        return "CORRUPTED" as unknown as T;
    }
  }

  injectNetworkError(errorCode: string): never {
    if (!this.enabled) throw new Error("Chaos disabled");

    const error = new Error(`Network error: ${errorCode}`);
    (error as NodeJS.ErrnoException).code = errorCode;
    throw error;
  }

  async injectTimeout(ms: number, rate?: number): Promise<boolean> {
    if (!this.enabled) return true;

    if (rate !== undefined && !this.shouldFail(rate)) {
      return false;
    }

    await new Promise((resolve) => setTimeout(resolve, ms));

    if (rate === undefined) {
      const error = new Error(`Timeout after ${ms}ms`);
      (error as NodeJS.ErrnoException).code = "ETIMEDOUT";
      throw error;
    }

    return true;
  }

  sequence(effects: ChaosEffect[]): ChaosEffect {
    return async () => {
      for (const effect of effects) {
        await effect();
      }
    };
  }

  randomEffect(effects: ChaosEffect[]): ChaosEffect {
    return async () => {
      const index = this.defaultRandom.nextInt(0, effects.length - 1);
      await effects[index]();
    };
  }
}

export const Chaos = new ChaosImpl();
