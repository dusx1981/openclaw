import * as crypto from "crypto";

export interface DouyinApiConfig {
  appId: string;
  appSecret: string;
  accessToken?: string;
  apiUrl?: string;
  timeout?: number;
}

export interface DouyinApiRequest {
  method: string;
  params?: Record<string, string | number | boolean>;
}

export interface DouyinApiResponse<T> {
  data?: T;
  err_no?: number;
  err_msg?: string;
  log_id?: string;
}

export class DouyinClient {
  private config: Required<Omit<DouyinApiConfig, "accessToken">> & { accessToken?: string };

  private static readonly DEFAULT_API_URL = "https://developer.toutiao.com/api";
  private static readonly DEFAULT_TIMEOUT = 30000;

  constructor(config: DouyinApiConfig) {
    this.config = {
      appId: config.appId,
      appSecret: config.appSecret,
      accessToken: config.accessToken,
      apiUrl: config.apiUrl ?? DouyinClient.DEFAULT_API_URL,
      timeout: config.timeout ?? DouyinClient.DEFAULT_TIMEOUT,
    };
  }

  static fromEnv(): DouyinClient {
    const appId = process.env.DOUYIN_APP_ID;
    const appSecret = process.env.DOUYIN_APP_SECRET;
    const accessToken = process.env.DOUYIN_ACCESS_TOKEN;
    const apiUrl = process.env.DOUYIN_API_URL;
    const timeout = process.env.DOUYIN_API_TIMEOUT
      ? parseInt(process.env.DOUYIN_API_TIMEOUT, 10)
      : undefined;

    if (!appId || !appSecret) {
      throw new Error(
        "Missing Douyin API credentials. Set DOUYIN_APP_ID and DOUYIN_APP_SECRET environment variables.",
      );
    }

    return new DouyinClient({
      appId,
      appSecret,
      accessToken,
      apiUrl,
      timeout,
    });
  }

  async execute<T>(request: DouyinApiRequest): Promise<T> {
    const timestamp = Date.now();
    const commonParams = this.buildCommonParams(request.method, timestamp);
    const allParams = this.mergeParams(commonParams, request.params);

    const sign = DouyinSignature.generate(allParams, this.config.appSecret);
    const signedParams = { ...allParams, sign };

    const response = await this.sendRequest<T>(signedParams);

    if (response.err_no !== undefined && response.err_no !== 0) {
      throw new DouyinApiError(
        response.err_no,
        response.err_msg ?? "Unknown error",
        response.log_id,
      );
    }

    return response.data as T;
  }

  private buildCommonParams(method: string, timestamp: number): Record<string, string | number> {
    const params: Record<string, string | number> = {
      app_id: this.config.appId,
      method,
      timestamp: Math.floor(timestamp / 1000),
      version: "2.0",
    };

    if (this.config.accessToken) {
      params.access_token = this.config.accessToken;
    }

    return params;
  }

  private mergeParams(
    common: Record<string, string | number>,
    extra?: Record<string, string | number | boolean>,
  ): Record<string, string | number> {
    if (!extra) return common;

    const merged: Record<string, string | number> = { ...common };
    for (const [key, value] of Object.entries(extra)) {
      if (typeof value === "boolean") {
        merged[key] = value ? 1 : 0;
      } else {
        merged[key] = value;
      }
    }
    return merged;
  }

  private async sendRequest<T>(
    params: Record<string, string | number>,
  ): Promise<DouyinApiResponse<T>> {
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
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as DouyinApiResponse<T>;
      return data;
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
      await this.execute({
        method: "product.list",
        params: { page: 0, size: 1 },
      });
      return {
        healthy: true,
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export class DouyinSignature {
  static generate(params: Record<string, string | number>, appSecret: string): string {
    const sortedParams = this.sortParams(params);
    const signString = this.buildSignString(sortedParams, appSecret);
    return this.sha256(signString);
  }

  private static sortParams(params: Record<string, string | number>): [string, string][] {
    return Object.entries(params)
      .filter(([_, value]) => value !== undefined && value !== null && value !== "")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [key, String(value)]);
  }

  private static buildSignString(sortedParams: [string, string][], appSecret: string): string {
    const paramString = sortedParams.map(([key, value]) => `${key}${value}`).join("");
    return `${appSecret}${paramString}${appSecret}`;
  }

  private static sha256(data: string): string {
    return crypto.createHash("sha256").update(data, "utf8").digest("hex");
  }
}

export class DouyinApiError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly logId?: string,
  ) {
    super(message);
    this.name = "DouyinApiError";
  }

  isRetryable(): boolean {
    const retryableCodes = [10001, 10003, 10010];
    return retryableCodes.includes(this.code);
  }

  isAuthError(): boolean {
    const authCodes = [10002, 10004, 10005];
    return authCodes.includes(this.code);
  }
}
