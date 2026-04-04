import * as crypto from "crypto";

export interface JDApiConfig {
  appKey: string;
  appSecret: string;
  accessToken?: string;
  apiUrl?: string;
  timeout?: number;
}

export interface JDApiRequest {
  method: string;
  params: Record<string, string | number>;
  needAuth?: boolean;
}

export interface JDApiResponse<T> {
  code: string;
  message?: string;
  data?: T;
  result?: T;
}

export class JDClient {
  private config: Required<Omit<JDApiConfig, "accessToken">> & { accessToken?: string };

  private static readonly DEFAULT_API_URL = "https://api.jd.com/routerjson";
  private static readonly DEFAULT_TIMEOUT = 30000;

  constructor(config: JDApiConfig) {
    this.config = {
      appKey: config.appKey,
      appSecret: config.appSecret,
      accessToken: config.accessToken,
      apiUrl: config.apiUrl ?? JDClient.DEFAULT_API_URL,
      timeout: config.timeout ?? JDClient.DEFAULT_TIMEOUT,
    };
  }

  static fromEnv(): JDClient {
    const appKey = process.env.JD_APP_KEY;
    const appSecret = process.env.JD_APP_SECRET;
    const accessToken = process.env.JD_ACCESS_TOKEN;
    const apiUrl = process.env.JD_API_URL;
    const timeout = process.env.JD_API_TIMEOUT
      ? parseInt(process.env.JD_API_TIMEOUT, 10)
      : undefined;

    if (!appKey || !appSecret) {
      throw new Error(
        "Missing JD API credentials. Set JD_APP_KEY and JD_APP_SECRET environment variables.",
      );
    }

    return new JDClient({
      appKey,
      appSecret,
      accessToken,
      apiUrl,
      timeout,
    });
  }

  async execute<T>(request: JDApiRequest): Promise<T> {
    const timestamp = Date.now();
    const commonParams = this.buildCommonParams(request.method, timestamp, request.needAuth);
    const allParams = { ...commonParams, ...request.params };

    const sign = JDSignature.generate(allParams, this.config.appSecret);
    const signedParams = { ...allParams, sign };

    const response = await this.sendRequest<T>(signedParams);

    if (response.code && response.code !== "0" && response.code !== "200") {
      throw new JDApiError(response.code, response.message ?? "Unknown error");
    }

    return (response.data ?? response.result) as T;
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
      sign_method: "md5",
      timestamp: new Date(timestamp).toISOString().replace(/[-:T]/g, "").split(".")[0],
      v: "1.0",
    };

    if (needAuth && this.config.accessToken) {
      params.access_token = this.config.accessToken;
    }

    return params;
  }

  private async sendRequest<T>(params: Record<string, string | number>): Promise<JDApiResponse<T>> {
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

      const data = (await response.json()) as JDApiResponse<T>;

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
        method: "jingdong.system.healthcheck",
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

export class JDSignature {
  static generate(params: Record<string, string | number>, appSecret: string): string {
    const sortedParams = this.sortParams(params);
    const signString = this.buildSignString(sortedParams, appSecret);
    return this.md5(signString);
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

  private static md5(data: string): string {
    return crypto.createHash("md5").update(data, "utf8").digest("hex").toUpperCase();
  }
}

export class JDApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "JDApiError";
  }

  isRetryable(): boolean {
    const retryableCodes = ["500", "503", "520", "429"];
    return retryableCodes.includes(this.code);
  }

  isAuthError(): boolean {
    const authCodes = ["401", "403", "40001"];
    return authCodes.includes(this.code);
  }
}
