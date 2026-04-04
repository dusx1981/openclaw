import * as crypto from "crypto";

export interface LazadaApiConfig {
  appKey: string;
  appSecret: string;
  accessToken?: string;
  apiUrl?: string;
  country?: string;
  timeout?: number;
}

export interface LazadaApiRequest {
  action: string;
  params?: Record<string, string | number>;
}

export interface LazadaApiResponse<T> {
  code: string;
  message?: string;
  request_id?: string;
  data?: T;
}

export class LazadaClient {
  private config: Required<Omit<LazadaApiConfig, "accessToken">> & { accessToken?: string };

  private static readonly DEFAULT_API_URL = "https://api.lazada.com.my/rest";
  private static readonly DEFAULT_TIMEOUT = 30000;
  private static readonly DEFAULT_COUNTRY = "SG";

  constructor(config: LazadaApiConfig) {
    this.config = {
      appKey: config.appKey,
      appSecret: config.appSecret,
      accessToken: config.accessToken,
      apiUrl: config.apiUrl ?? LazadaClient.DEFAULT_API_URL,
      country: config.country ?? LazadaClient.DEFAULT_COUNTRY,
      timeout: config.timeout ?? LazadaClient.DEFAULT_TIMEOUT,
    };
  }

  static fromEnv(): LazadaClient {
    const appKey = process.env.LAZADA_APP_KEY;
    const appSecret = process.env.LAZADA_APP_SECRET;
    const accessToken = process.env.LAZADA_ACCESS_TOKEN;
    const apiUrl = process.env.LAZADA_API_URL;
    const country = process.env.LAZADA_COUNTRY;
    const timeout = process.env.LAZADA_API_TIMEOUT
      ? parseInt(process.env.LAZADA_API_TIMEOUT, 10)
      : undefined;

    if (!appKey || !appSecret) {
      throw new Error(
        "Missing Lazada API credentials. Set LAZADA_APP_KEY and LAZADA_APP_SECRET environment variables.",
      );
    }

    return new LazadaClient({
      appKey,
      appSecret,
      accessToken,
      apiUrl,
      country,
      timeout,
    });
  }

  async execute<T>(request: LazadaApiRequest): Promise<T> {
    const timestamp = Date.now();
    const commonParams = this.buildCommonParams(request.action, timestamp);
    const allParams = { ...commonParams, ...request.params };

    const sign = LazadaSignature.generate(allParams, this.config.appSecret);
    const signedParams = { ...allParams, sign };

    const response = await this.sendRequest<T>(signedParams);

    if (response.code !== "0") {
      throw new LazadaApiError(
        response.code,
        response.message ?? "Unknown error",
        response.request_id,
      );
    }

    return response.data as T;
  }

  private buildCommonParams(action: string, timestamp: number): Record<string, string | number> {
    const params: Record<string, string | number> = {
      app_key: this.config.appKey,
      timestamp,
      sign_method: "sha256",
      action,
    };

    if (this.config.accessToken) {
      params.access_token = this.config.accessToken;
    }

    return params;
  }

  private async sendRequest<T>(
    params: Record<string, string | number>,
  ): Promise<LazadaApiResponse<T>> {
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

      const data = (await response.json()) as LazadaApiResponse<T>;
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
        action: "GetProducts",
        params: { limit: 1, offset: 0 },
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

  getCountry(): string {
    return this.config.country;
  }
}

export class LazadaSignature {
  static generate(params: Record<string, string | number>, appSecret: string): string {
    const sortedParams = this.sortParams(params);
    const signString = this.buildSignString(sortedParams, appSecret);
    return this.hmacSha256(signString, appSecret);
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

  private static hmacSha256(data: string, key: string): string {
    return crypto.createHmac("sha256", key).update(data, "utf8").digest("hex").toUpperCase();
  }
}

export class LazadaApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "LazadaApiError";
  }

  isRetryable(): boolean {
    const retryableCodes = ["InternalError", "RateLimitExceeded", "5"];
    return retryableCodes.includes(this.code);
  }

  isAuthError(): boolean {
    const authCodes = ["InvalidAccessKeyId", "SignatureMismatch", "7"];
    return authCodes.includes(this.code);
  }
}
