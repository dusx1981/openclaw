import * as crypto from "crypto";

export interface PinduoduoApiConfig {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  apiUrl?: string;
  timeout?: number;
}

export interface PinduoduoApiRequest {
  type: string;
  params?: Record<string, string | number>;
}

export interface PinduoduoApiResponse<T> {
  error_response?: {
    error_code: number;
    error_msg: string;
  };
  [key: string]: unknown;
}

export class PinduoduoClient {
  private config: Required<Omit<PinduoduoApiConfig, "accessToken">> & { accessToken?: string };

  private static readonly DEFAULT_API_URL = "https://gw-api.pinduoduo.com/api/router";
  private static readonly DEFAULT_TIMEOUT = 30000;

  constructor(config: PinduoduoApiConfig) {
    this.config = {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      accessToken: config.accessToken,
      apiUrl: config.apiUrl ?? PinduoduoClient.DEFAULT_API_URL,
      timeout: config.timeout ?? PinduoduoClient.DEFAULT_TIMEOUT,
    };
  }

  static fromEnv(): PinduoduoClient {
    const clientId = process.env.PINDUODUO_CLIENT_ID;
    const clientSecret = process.env.PINDUODUO_CLIENT_SECRET;
    const accessToken = process.env.PINDUODUO_ACCESS_TOKEN;
    const apiUrl = process.env.PINDUODUO_API_URL;
    const timeout = process.env.PINDUODUO_API_TIMEOUT
      ? parseInt(process.env.PINDUODUO_API_TIMEOUT, 10)
      : undefined;

    if (!clientId || !clientSecret) {
      throw new Error(
        "Missing Pinduoduo API credentials. Set PINDUODUO_CLIENT_ID and PINDUODUO_CLIENT_SECRET environment variables.",
      );
    }

    return new PinduoduoClient({
      clientId,
      clientSecret,
      accessToken,
      apiUrl,
      timeout,
    });
  }

  async execute<T>(request: PinduoduoApiRequest): Promise<T> {
    const timestamp = Date.now();
    const commonParams = this.buildCommonParams(request.type, timestamp);
    const allParams = { ...commonParams, ...request.params };

    const sign = PinduoduoSignature.generate(allParams, this.config.clientSecret);
    const signedParams = { ...allParams, sign };

    const response = await this.sendRequest<T>(signedParams);

    if (response.error_response) {
      throw new PinduoduoApiError(
        response.error_response.error_code,
        response.error_response.error_msg,
      );
    }

    const typeKey = Object.keys(response).find((k) => k !== "error_response");
    return response[typeKey ?? ""] as T;
  }

  private buildCommonParams(type: string, timestamp: number): Record<string, string | number> {
    const params: Record<string, string | number> = {
      client_id: this.config.clientId,
      data_type: "JSON",
      timestamp: Math.floor(timestamp / 1000),
      type,
    };

    if (this.config.accessToken) {
      params.access_token = this.config.accessToken;
    }

    return params;
  }

  private async sendRequest<T>(
    params: Record<string, string | number>,
  ): Promise<PinduoduoApiResponse<T>> {
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

      const data = (await response.json()) as PinduoduoApiResponse<T>;
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
        type: "pdd.time.get",
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

export class PinduoduoSignature {
  static generate(params: Record<string, string | number>, clientSecret: string): string {
    const sortedParams = this.sortParams(params);
    const signString = this.buildSignString(sortedParams, clientSecret);
    return this.md5(signString);
  }

  private static sortParams(params: Record<string, string | number>): [string, string][] {
    return Object.entries(params)
      .filter(([_, value]) => value !== undefined && value !== null && value !== "")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [key, String(value)]);
  }

  private static buildSignString(sortedParams: [string, string][], clientSecret: string): string {
    const paramString = sortedParams.map(([key, value]) => `${key}${value}`).join("");
    return `${clientSecret}${paramString}${clientSecret}`;
  }

  private static md5(data: string): string {
    return crypto.createHash("md5").update(data, "utf8").digest("hex").toUpperCase();
  }
}

export class PinduoduoApiError extends Error {
  constructor(
    public readonly code: number,
    message: string,
  ) {
    super(message);
    this.name = "PinduoduoApiError";
  }

  isRetryable(): boolean {
    const retryableCodes = [50000, 52001, 52002];
    return retryableCodes.includes(this.code);
  }

  isAuthError(): boolean {
    const authCodes = [40001, 40002];
    return authCodes.includes(this.code);
  }
}
