import * as crypto from "crypto";

export interface TumeApiConfig {
  appKey: string;
  appSecret: string;
  apiUrl?: string;
  timeout?: number;
}

export interface TumeApiRequest {
  method: string;
  params?: Record<string, string | number>;
}

export interface TumeApiResponse<T> {
  code: number;
  msg?: string;
  data?: T;
}

export class TumeClient {
  private config: Required<TumeApiConfig>;

  private static readonly DEFAULT_API_URL = "https://api.tume.com";
  private static readonly DEFAULT_TIMEOUT = 30000;

  constructor(config: TumeApiConfig) {
    this.config = {
      appKey: config.appKey,
      appSecret: config.appSecret,
      apiUrl: config.apiUrl ?? TumeClient.DEFAULT_API_URL,
      timeout: config.timeout ?? TumeClient.DEFAULT_TIMEOUT,
    };
  }

  static fromEnv(): TumeClient {
    const appKey = process.env.TUME_APP_KEY;
    const appSecret = process.env.TUME_APP_SECRET;
    const apiUrl = process.env.TUME_API_URL;
    const timeout = process.env.TUME_API_TIMEOUT
      ? parseInt(process.env.TUME_API_TIMEOUT, 10)
      : undefined;

    if (!appKey || !appSecret) {
      throw new Error(
        "Missing TUME API credentials. Set TUME_APP_KEY and TUME_APP_SECRET environment variables.",
      );
    }

    return new TumeClient({ appKey, appSecret, apiUrl, timeout });
  }

  async execute<T>(request: TumeApiRequest): Promise<T> {
    const timestamp = Date.now();
    const commonParams = { app_key: this.config.appKey, timestamp, method: request.method };
    const allParams = { ...commonParams, ...request.params };

    const sign = TumeSignature.generate(allParams, this.config.appSecret);
    const signedParams = { ...allParams, sign };

    const response = await this.sendRequest<T>(signedParams);

    if (response.code !== 0) {
      throw new TumeApiError(response.code, response.msg ?? "Unknown error");
    }

    return response.data as T;
  }

  private async sendRequest<T>(
    params: Record<string, string | number>,
  ): Promise<TumeApiResponse<T>> {
    const url = new URL(this.config.apiUrl);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.append(key, String(value));
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url.toString(), {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()) as TumeApiResponse<T>;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request timeout after ${this.config.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    const start = Date.now();
    try {
      await this.execute({ method: "product.list", params: { page: 1, size: 1 } });
      return { healthy: true, latency: Date.now() - start };
    } catch (error) {
      return { healthy: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
}

export class TumeSignature {
  static generate(params: Record<string, string | number>, appSecret: string): string {
    const sortedParams = Object.entries(params)
      .filter(([_, v]) => v !== undefined && v !== null && v !== "")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}${v}`);
    const signString = `${appSecret}${sortedParams.join("")}${appSecret}`;
    return crypto.createHash("md5").update(signString, "utf8").digest("hex").toUpperCase();
  }
}

export class TumeApiError extends Error {
  constructor(
    public readonly code: number,
    message: string,
  ) {
    super(message);
    this.name = "TumeApiError";
  }
  isRetryable(): boolean {
    return [1000, 3000].includes(this.code);
  }
  isAuthError(): boolean {
    return [2000].includes(this.code);
  }
}
