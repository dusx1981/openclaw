import * as crypto from "crypto";

export interface TaobaoApiConfig {
  appKey: string;
  appSecret: string;
  accessToken?: string;
  endpoint?: string;
  timeout?: number;
}

export interface TaobaoApiRequest {
  method: string;
  params: Record<string, string | number>;
  needAuth?: boolean;
}

export interface TaobaoApiResponse<T> {
  [method: string]: {
    result?: T;
    error_code?: string;
    msg?: string;
    sub_code?: string;
    sub_msg?: string;
  };
}

export class TaobaoApiClient {
  private config: Required<Omit<TaobaoApiConfig, "accessToken">> & { accessToken?: string };

  private static readonly DEFAULT_ENDPOINT = "https://eco.taobao.com/router/rest";
  private static readonly DEFAULT_TIMEOUT = 30000;

  constructor(config: TaobaoApiConfig) {
    this.config = {
      appKey: config.appKey,
      appSecret: config.appSecret,
      accessToken: config.accessToken,
      endpoint: config.endpoint ?? TaobaoApiClient.DEFAULT_ENDPOINT,
      timeout: config.timeout ?? TaobaoApiClient.DEFAULT_TIMEOUT,
    };
  }

  static fromEnv(): TaobaoApiClient {
    const appKey = process.env.TAOBAO_APP_KEY;
    const appSecret = process.env.TAOBAO_APP_SECRET;
    const accessToken = process.env.TAOBAO_ACCESS_TOKEN;
    const endpoint = process.env.TAOBAO_API_ENDPOINT;
    const timeout = process.env.TAOBAO_API_TIMEOUT
      ? parseInt(process.env.TAOBAO_API_TIMEOUT, 10)
      : undefined;

    if (!appKey || !appSecret) {
      throw new Error(
        "Missing Taobao API credentials. Set TAOBAO_APP_KEY and TAOBAO_APP_SECRET environment variables.",
      );
    }

    return new TaobaoApiClient({
      appKey,
      appSecret,
      accessToken,
      endpoint,
      timeout,
    });
  }

  async execute<T>(request: TaobaoApiRequest): Promise<T> {
    const timestamp = Date.now();
    const commonParams = this.buildCommonParams(request.method, timestamp, request.needAuth);
    const allParams = { ...commonParams, ...request.params };

    const sign = TaobaoSignature.generate(allParams, this.config.appSecret);
    const signedParams = { ...allParams, sign };

    const response = await this.sendRequest<T>(signedParams);

    if (response.error_code) {
      throw new TaobaoApiError(
        response.error_code,
        response.msg ?? "Unknown error",
        response.sub_code,
        response.sub_msg,
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
      params.session = this.config.accessToken;
    }

    return params;
  }

  private async sendRequest<T>(
    params: Record<string, string | number>,
  ): Promise<TaobaoApiResponse<T>[string]> {
    const url = new URL(this.config.endpoint);

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

      const data = (await response.json()) as TaobaoApiResponse<T>;
      const methodKey = params.method as string;

      return data[methodKey] ?? { result: undefined };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Request timeout after ${this.config.timeout}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export class TaobaoSignature {
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

export class TaobaoApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly subCode?: string,
    public readonly subMessage?: string,
  ) {
    super(message);
    this.name = "TaobaoApiError";
  }

  isRetryable(): boolean {
    const retryableCodes = [
      "7", // 限流
      "8", // 服务不可用
      "50", // 服务繁忙
      "520", // 系统异常
    ];
    return retryableCodes.includes(this.code);
  }

  isAuthError(): boolean {
    const authCodes = [
      "27", // 无效sessionkey
      "28", // 无效appKey
      "29", // 无效timestamp
      "30", // 无效sign
    ];
    return authCodes.includes(this.code);
  }
}
