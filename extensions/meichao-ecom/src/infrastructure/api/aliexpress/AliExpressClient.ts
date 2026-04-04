import * as crypto from "crypto";

export interface AliExpressApiConfig {
  appKey: string;
  appSecret: string;
  accessToken?: string;
  apiUrl?: string;
  language?: string;
  timeout?: number;
}

export interface AliExpressApiRequest {
  method: string;
  params?: Record<string, string | number>;
}

export interface AliExpressApiResponse<T> {
  result?: T;
  error_code?: string;
  error_msg?: string;
}

export class AliExpressClient {
  private config: Required<Omit<AliExpressApiConfig, "accessToken">> & { accessToken?: string };

  private static readonly DEFAULT_API_URL = "https://api.aliexpress.com";
  private static readonly DEFAULT_TIMEOUT = 30000;
  private static readonly DEFAULT_LANGUAGE = "en";

  constructor(config: AliExpressApiConfig) {
    this.config = {
      appKey: config.appKey,
      appSecret: config.appSecret,
      accessToken: config.accessToken,
      apiUrl: config.apiUrl ?? AliExpressClient.DEFAULT_API_URL,
      language: config.language ?? AliExpressClient.DEFAULT_LANGUAGE,
      timeout: config.timeout ?? AliExpressClient.DEFAULT_TIMEOUT,
    };
  }

  static fromEnv(): AliExpressClient {
    const appKey = process.env.ALIEXPRESS_APP_KEY;
    const appSecret = process.env.ALIEXPRESS_APP_SECRET;
    const accessToken = process.env.ALIEXPRESS_ACCESS_TOKEN;
    const apiUrl = process.env.ALIEXPRESS_API_URL;
    const language = process.env.ALIEXPRESS_LANGUAGE;
    const timeout = process.env.ALIEXPRESS_API_TIMEOUT
      ? parseInt(process.env.ALIEXPRESS_API_TIMEOUT, 10)
      : undefined;

    if (!appKey || !appSecret) {
      throw new Error(
        "Missing AliExpress API credentials. Set ALIEXPRESS_APP_KEY and ALIEXPRESS_APP_SECRET environment variables.",
      );
    }

    return new AliExpressClient({
      appKey,
      appSecret,
      accessToken,
      apiUrl,
      language,
      timeout,
    });
  }

  async execute<T>(request: AliExpressApiRequest): Promise<T> {
    const timestamp = Date.now();
    const commonParams = this.buildCommonParams(request.method, timestamp);
    const allParams = { ...commonParams, ...request.params };

    const sign = AliExpressSignature.generate(allParams, this.config.appSecret);
    const signedParams = { ...allParams, sign };

    const response = await this.sendRequest<T>(signedParams);

    if (response.error_code) {
      throw new AliExpressApiError(response.error_code, response.error_msg ?? "Unknown error");
    }

    return response.result as T;
  }

  private buildCommonParams(method: string, timestamp: number): Record<string, string | number> {
    const params: Record<string, string | number> = {
      app_key: this.config.appKey,
      format: "json",
      method,
      sign_method: "hmac-sha256",
      timestamp: new Date(timestamp).toISOString().replace(/\.\d{3}/, ""),
      v: "2.0",
      language: this.config.language,
    };

    if (this.config.accessToken) {
      params.access_token = this.config.accessToken;
    }

    return params;
  }

  private async sendRequest<T>(
    params: Record<string, string | number>,
  ): Promise<AliExpressApiResponse<T>> {
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

      const data = (await response.json()) as AliExpressApiResponse<T>;
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
        method: "aliexpress.affiliate.product.query",
        params: { page_no: 1, page_size: 1 },
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

  getLanguage(): string {
    return this.config.language;
  }
}

export class AliExpressSignature {
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

export class AliExpressApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AliExpressApiError";
  }

  isRetryable(): boolean {
    const retryableCodes = ["500", "520", "521"];
    return retryableCodes.includes(this.code);
  }

  isAuthError(): boolean {
    const authCodes = ["2001", "2002", "2003"];
    return authCodes.includes(this.code);
  }
}
