import { SellingPartner } from "amazon-sp-api";

export interface AmazonConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  region: "eu" | "na" | "fe";
  marketplaceId?: string;
  timeout?: number;
}

export class AmazonSPApiClient {
  private client: SellingPartner;
  private config: AmazonConfig;

  constructor(config: AmazonConfig) {
    this.validateConfig(config);
    this.config = config;

    this.client = new SellingPartner({
      region: config.region,
      refresh_token: config.refreshToken,
      options: {
        credentials: {
          client_id: config.clientId,
          client_secret: config.clientSecret,
        },
        timeout: config.timeout ?? 30000,
      },
    });
  }

  private validateConfig(config: AmazonConfig): void {
    const requiredFields = ["clientId", "clientSecret", "refreshToken", "region"] as const;

    const missingFields = requiredFields.filter(
      (field) => !config[field] || config[field].trim() === "",
    );

    if (missingFields.length > 0) {
      throw new Error(
        `Missing required Amazon SP-API configuration fields: ${missingFields.join(", ")}`,
      );
    }

    if (!["eu", "na", "fe"].includes(config.region)) {
      throw new Error(`Invalid Amazon region: ${config.region}. Must be one of: eu, na, fe`);
    }
  }

  async callAPI(options: {
    operation: string;
    endpoint: string;
    query?: Record<string, any>;
    path?: Record<string, string>;
    body?: Record<string, any>;
  }): Promise<any> {
    return this.client.callAPI({
      operation: options.operation,
      endpoint: options.endpoint,
      query: options.query,
      path: options.path,
      body: options.body,
    });
  }

  getMarketplaceId(): string {
    return this.config.marketplaceId ?? this.getDefaultMarketplaceId();
  }

  private getDefaultMarketplaceId(): string {
    switch (this.config.region) {
      case "na":
        return "ATVPDKIKX0DER";
      case "eu":
        return "A1PA6795UKMFR9";
      case "fe":
        return "A1VC38T7YXB528";
      default:
        return "ATVPDKIKX0DER";
    }
  }

  async healthCheck(): Promise<{
    status: "healthy" | "unhealthy";
    latency?: number;
    error?: string;
  }> {
    const start = Date.now();
    try {
      await this.callAPI({
        operation: "getMarketplaceParticipations",
        endpoint: "sellers",
      });
      return {
        status: "healthy",
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export function createAmazonClientFromEnv(): AmazonSPApiClient {
  const config: AmazonConfig = {
    clientId: process.env.AMAZON_CLIENT_ID ?? "",
    clientSecret: process.env.AMAZON_CLIENT_SECRET ?? "",
    refreshToken: process.env.AMAZON_REFRESH_TOKEN ?? "",
    region: (process.env.AMAZON_REGION as "eu" | "na" | "fe") ?? "na",
    marketplaceId: process.env.AMAZON_MARKETPLACE_ID,
    timeout: process.env.AMAZON_API_TIMEOUT ? parseInt(process.env.AMAZON_API_TIMEOUT, 10) : 30000,
  };

  return new AmazonSPApiClient(config);
}
