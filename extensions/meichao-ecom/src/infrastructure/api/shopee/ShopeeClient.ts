import * as crypto from "crypto";

export interface ShopeeApiConfig {
  partnerId: string;
  partnerKey: string;
  accessToken?: string;
  shopId?: string;
  apiUrl?: string;
  region?: string;
  timeout?: number;
}

export interface ShopeeApiRequest {
  path: string;
  params?: Record<string, string | number>;
  method?: "GET" | "POST";
}

export interface ShopeeApiResponse<T> {
  error?: string;
  message?: string;
  request_id?: string;
  data?: T;
}

export class ShopeeClient {
  private config: Required<Omit<ShopeeApiConfig, "accessToken" | "shopId">> & {
    accessToken?: string;
    shopId?: string;
  };

  private static readonly DEFAULT_API_URL = "https://partner.shopeemobile.com/api/v2";
  private static readonly DEFAULT_TIMEOUT = 30000;
  private static readonly DEFAULT_REGION = "SG";

  constructor(config: ShopeeApiConfig) {
    this.config = {
      partnerId: config.partnerId,
      partnerKey: config.partnerKey,
      accessToken: config.accessToken,
      shopId: config.shopId,
      apiUrl: config.apiUrl ?? ShopeeClient.DEFAULT_API_URL,
      region: config.region ?? ShopeeClient.DEFAULT_REGION,
      timeout: config.timeout ?? ShopeeClient.DEFAULT_TIMEOUT,
    };
  }

  static fromEnv(): ShopeeClient {
    const partnerId = process.env.SHOPEE_PARTNER_ID;
    const partnerKey = process.env.SHOPEE_PARTNER_KEY;
    const accessToken = process.env.SHOPEE_ACCESS_TOKEN;
    const shopId = process.env.SHOPEE_SHOP_ID;
    const apiUrl = process.env.SHOPEE_API_URL;
    const region = process.env.SHOPEE_REGION;
    const timeout = process.env.SHOPEE_API_TIMEOUT
      ? parseInt(process.env.SHOPEE_API_TIMEOUT, 10)
      : undefined;

    if (!partnerId || !partnerKey) {
      throw new Error(
        "Missing Shopee API credentials. Set SHOPEE_PARTNER_ID and SHOPEE_PARTNER_KEY environment variables.",
      );
    }

    return new ShopeeClient({
      partnerId,
      partnerKey,
      accessToken,
      shopId,
      apiUrl,
      region,
      timeout,
    });
  }

  async execute<T>(request: ShopeeApiRequest): Promise<T> {
    const timestamp = Math.floor(Date.now() / 1000);
    const commonParams = this.buildCommonParams(request.path, timestamp);

    const sign = ShopeeSignature.generate(
      this.config.partnerId,
      request.path,
      timestamp,
      this.config.partnerKey,
      this.config.accessToken,
      this.config.shopId,
    );

    const allParams = { ...commonParams, sign, ...request.params };

    const response = await this.sendRequest<T>(
      `${this.config.apiUrl}${request.path}`,
      allParams,
      request.method ?? "GET",
    );

    if (response.error) {
      throw new ShopeeApiError(
        response.error,
        response.message ?? "Unknown error",
        response.request_id,
      );
    }

    return response.data as T;
  }

  private buildCommonParams(path: string, timestamp: number): Record<string, string | number> {
    const params: Record<string, string | number> = {
      partner_id: this.config.partnerId,
      timestamp,
    };

    if (this.config.accessToken) {
      params.access_token = this.config.accessToken;
    }

    if (this.config.shopId) {
      params.shop_id = this.config.shopId;
    }

    return params;
  }

  private async sendRequest<T>(
    url: string,
    params: Record<string, string | number>,
    method: "GET" | "POST",
  ): Promise<ShopeeApiResponse<T>> {
    const fullUrl = new URL(url);

    if (method === "GET") {
      for (const [key, value] of Object.entries(params)) {
        fullUrl.searchParams.append(key, String(value));
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(fullUrl.toString(), {
        method,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
        body: method === "POST" ? JSON.stringify(params) : undefined,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as ShopeeApiResponse<T>;
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
        path: "/shop/get_shop_info",
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

  getShopId(): string | undefined {
    return this.config.shopId;
  }
}

export class ShopeeSignature {
  static generate(
    partnerId: string,
    path: string,
    timestamp: number,
    partnerKey: string,
    accessToken?: string,
    shopId?: string,
  ): string {
    const baseString = `${partnerId}${path}${timestamp}`;
    let signString = baseString;

    if (accessToken) {
      signString += accessToken;
    }

    if (shopId) {
      signString += shopId;
    }

    return this.hmacSha256(signString, partnerKey);
  }

  private static hmacSha256(data: string, key: string): string {
    return crypto.createHmac("sha256", key).update(data, "utf8").digest("hex");
  }
}

export class ShopeeApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "ShopeeApiError";
  }

  isRetryable(): boolean {
    const retryableCodes = ["error_server", "error_rate_limit", "5"];
    return retryableCodes.includes(this.code);
  }

  isAuthError(): boolean {
    const authCodes = ["error_auth", "error_invalid_access_token", "7"];
    return authCodes.includes(this.code);
  }
}
