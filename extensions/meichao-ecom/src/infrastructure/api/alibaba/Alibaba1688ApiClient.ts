import * as crypto from "crypto";

export interface Alibaba1688ApiConfig {
  appKey: string;
  appSecret: string;
  accessToken?: string;
  apiUrl?: string;
  timeout?: number;
}

export interface Alibaba1688ApiRequest {
  method: string;
  params: Record<string, string | number>;
  needAuth?: boolean;
}

export interface Alibaba1688ApiResponse<T> {
  result?: T;
  error_code?: string;
  error_message?: string;
  sub_error_code?: string;
  sub_error_message?: string;
}

export class Alibaba1688ApiClient {
  private config: Required<Omit<Alibaba1688ApiConfig, "accessToken">> & { accessToken?: string };

  private static readonly DEFAULT_API_URL = "https://gw.open.1688.com/openapi";
  private static readonly DEFAULT_TIMEOUT = 30000;

  constructor(config: Alibaba1688ApiConfig) {
    this.config = {
      appKey: config.appKey,
      appSecret: config.appSecret,
      accessToken: config.accessToken,
      apiUrl: config.apiUrl ?? Alibaba1688ApiClient.DEFAULT_API_URL,
      timeout: config.timeout ?? Alibaba1688ApiClient.DEFAULT_TIMEOUT,
    };
  }

  static fromEnv(): Alibaba1688ApiClient {
    const appKey = process.env.ALIBABA_1688_APP_KEY;
    const appSecret = process.env.ALIBABA_1688_APP_SECRET;
    const accessToken = process.env.ALIBABA_1688_ACCESS_TOKEN;
    const apiUrl = process.env.ALIBABA_1688_API_URL;
    const timeout = process.env.ALIBABA_1688_API_TIMEOUT
      ? parseInt(process.env.ALIBABA_1688_API_TIMEOUT, 10)
      : undefined;

    if (!appKey || !appSecret) {
      throw new Error(
        "Missing 1688 API credentials. Set ALIBABA_1688_APP_KEY and ALIBABA_1688_APP_SECRET environment variables.",
      );
    }

    return new Alibaba1688ApiClient({
      appKey,
      appSecret,
      accessToken,
      apiUrl,
      timeout,
    });
  }

  async execute<T>(request: Alibaba1688ApiRequest): Promise<T> {
    const timestamp = Date.now();
    const commonParams = this.buildCommonParams(request.method, timestamp, request.needAuth);
    const allParams = { ...commonParams, ...request.params };

    const sign = Alibaba1688Signature.generate(allParams, this.config.appSecret);
    const signedParams = { ...allParams, sign };

    const response = await this.sendRequest<T>(signedParams);

    if (response.error_code) {
      throw new Alibaba1688ApiError(
        response.error_code,
        response.error_message ?? "Unknown error",
        response.sub_error_code,
        response.sub_error_message,
      );
    }

    return response.result as T;
  }

  private buildCommonParams(
    method: string,
    timestamp: number,
    needAuth?: boolean,
  ): Record<string, string | number> {
    const params: Record<string, string | number> = {
      app_key: this.config.appKey,
      format: "json",
      method,
      sign_method: "hmac-sha256",
      timestamp: new Date(timestamp).toISOString().replace(/\.\d{3}/, ""),
      v: "2.0",
    };

    if (needAuth && this.config.accessToken) {
      params.access_token = this.config.accessToken;
    }

    return params;
  }

  private async sendRequest<T>(
    params: Record<string, string | number>,
  ): Promise<Alibaba1688ApiResponse<T>> {
    const url = new URL(`${this.config.apiUrl}/${params.method}/${params.v}`);

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

      const data = (await response.json()) as Alibaba1688ApiResponse<T>;

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
        method: "alibaba.system.healthcheck",
        params: {},
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

export class Alibaba1688Signature {
  static generate(params: Record<string, string | number>, appSecret: string): string {
    const sortedParams = this.sortParams(params);
    const signString = this.buildSignString(sortedParams);
    return this.hmacSha256(signString, appSecret);
  }

  private static sortParams(params: Record<string, string | number>): [string, string][] {
    return Object.entries(params)
      .filter(([_, value]) => value !== undefined && value !== null && value !== "")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [key, String(value)]);
  }

  private static buildSignString(sortedParams: [string, string][]): string {
    return sortedParams.map(([key, value]) => `${key}${value}`).join("");
  }

  private static hmacSha256(data: string, secret: string): string {
    return crypto.createHmac("sha256", secret).update(data, "utf8").digest("hex").toUpperCase();
  }
}

export class Alibaba1688ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly subCode?: string,
    public readonly subMessage?: string,
  ) {
    super(message);
    this.name = "Alibaba1688ApiError";
  }

  isRetryable(): boolean {
    const retryableCodes = ["system.error", "service.unavailable", "rate.limit.exceeded"];
    return retryableCodes.includes(this.code);
  }

  isAuthError(): boolean {
    const authCodes = ["insufficient.permissions", "session.expired", "invalid.access.token"];
    return authCodes.includes(this.code);
  }
}
