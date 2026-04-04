import * as crypto from "crypto";

export interface TikTokShopApiConfig {
  appKey: string;
  appSecret: string;
  accessToken?: string;
  apiUrl?: string;
  region?: string;
  timeout?: number;
}

export interface TikTokShopApiRequest {
  method: string;
  path: string;
  params?: Record<string, string | number | boolean>;
}

export interface TikTokShopApiResponse<T> {
  code: number;
  message?: string;
  request_id?: string;
  data?: T;
}

export class TikTokShopClient {
  private config: Required<Omit<TikTokShopApiConfig, "accessToken">> & { accessToken?: string };

  private static readonly DEFAULT_API_URL = "https://open-api.tiktokglobalshop.com";
  private static readonly DEFAULT_TIMEOUT = 30000;
  private static readonly DEFAULT_REGION = "US";

  constructor(config: TikTokShopApiConfig) {
    this.config = {
      appKey: config.appKey,
      appSecret: config.appSecret,
      accessToken: config.accessToken,
      apiUrl: config.apiUrl ?? TikTokShopClient.DEFAULT_API_URL,
      region: config.region ?? TikTokShopClient.DEFAULT_REGION,
      timeout: config.timeout ?? TikTokShopClient.DEFAULT_TIMEOUT,
    };
  }

  static fromEnv(): TikTokShopClient {
    const appKey = process.env.TIKTOK_SHOP_APP_KEY;
    const appSecret = process.env.TIKTOK_SHOP_APP_SECRET;
    const accessToken = process.env.TIKTOK_SHOP_ACCESS_TOKEN;
    const apiUrl = process.env.TIKTOK_SHOP_API_URL;
    const region = process.env.TIKTOK_SHOP_REGION;
    const timeout = process.env.TIKTOK_SHOP_API_TIMEOUT
      ? parseInt(process.env.TIKTOK_SHOP_API_TIMEOUT, 10)
      : undefined;

    if (!appKey || !appSecret) {
      throw new Error(
        "Missing TikTok Shop API credentials. Set TIKTOK_SHOP_APP_KEY and TIKTOK_SHOP_APP_SECRET environment variables.",
      );
    }

    return new TikTokShopClient({
      appKey,
      appSecret,
      accessToken,
      apiUrl,
      region,
      timeout,
    });
  }

  async execute<T>(request: TikTokShopApiRequest): Promise<T> {
    const timestamp = Math.floor(Date.now() / 1000);
    const commonParams = this.buildCommonParams(request.path, timestamp);
    const allParams = this.mergeParams(commonParams, request.params);

    const sign = TikTokShopSignature.generate(
      request.path,
      timestamp,
      this.config.appKey,
      this.config.appSecret,
      this.config.accessToken,
    );

    const signedParams = { ...allParams, sign };

    const response = await this.sendRequest<T>(request.path, signedParams);

    if (response.code !== 0) {
      throw new TikTokShopApiError(
        response.code,
        response.message ?? "Unknown error",
        response.request_id,
      );
    }

    return response.data as T;
  }

  private buildCommonParams(path: string, timestamp: number): Record<string, string | number> {
    const params: Record<string, string | number> = {
      app_key: this.config.appKey,
      timestamp,
      path,
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
    path: string,
    params: Record<string, string | number>,
  ): Promise<TikTokShopApiResponse<T>> {
    const url = new URL(`${this.config.apiUrl}${path}`);

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.append(key, String(value));
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as TikTokShopApiResponse<T>;
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
        method: "GET",
        path: "/api/products/search",
        params: { page_number: 1, page_size: 1 },
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

  getRegion(): string {
    return this.config.region;
  }
}

export class TikTokShopSignature {
  static generate(
    path: string,
    timestamp: number,
    appKey: string,
    appSecret: string,
    accessToken?: string,
  ): string {
    const baseString = `${appKey}${path}${timestamp}`;
    let signString = baseString;

    if (accessToken) {
      signString += accessToken;
    }

    return this.hmacSha256(signString, appSecret);
  }

  private static hmacSha256(data: string, key: string): string {
    return crypto.createHmac("sha256", key).update(data, "utf8").digest("hex");
  }
}

export class TikTokShopApiError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "TikTokShopApiError";
  }

  isRetryable(): boolean {
    const retryableCodes = [10000, 10002, 50000];
    return retryableCodes.includes(this.code);
  }

  isAuthError(): boolean {
    const authCodes = [10001, 10005, 10006];
    return authCodes.includes(this.code);
  }
}
