import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import { AmazonSPApiClient, createAmazonClientFromEnv } from "./AmazonSPApiClient.js";

vi.mock("amazon-sp-api", () => {
  return {
    SellingPartner: class MockSellingPartner {
      callAPI = vi.fn();
      constructor() {}
    },
  };
});

describe("AmazonSPApiClient", () => {
  let client: AmazonSPApiClient;

  const validConfig = {
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    refreshToken: "test-refresh-token",
    region: "na" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new AmazonSPApiClient(validConfig);
  });

  describe("constructor", () => {
    it("should create client with valid config", () => {
      expect(client).toBeDefined();
    });

    it("should throw error when clientId is missing", () => {
      expect(
        () =>
          new AmazonSPApiClient({
            ...validConfig,
            clientId: "",
          }),
      ).toThrow("Missing required Amazon SP-API configuration fields: clientId");
    });

    it("should throw error when clientSecret is missing", () => {
      expect(
        () =>
          new AmazonSPApiClient({
            ...validConfig,
            clientSecret: "",
          }),
      ).toThrow("Missing required Amazon SP-API configuration fields: clientSecret");
    });

    it("should throw error when refreshToken is missing", () => {
      expect(
        () =>
          new AmazonSPApiClient({
            ...validConfig,
            refreshToken: "",
          }),
      ).toThrow("Missing required Amazon SP-API configuration fields: refreshToken");
    });

    it("should throw error when region is invalid", () => {
      expect(
        () =>
          new AmazonSPApiClient({
            ...validConfig,
            region: "invalid" as any,
          }),
      ).toThrow("Invalid Amazon region: invalid. Must be one of: eu, na, fe");
    });

    it("should use default marketplace ID for na region", () => {
      const naClient = new AmazonSPApiClient({ ...validConfig, region: "na" });
      expect(naClient.getMarketplaceId()).toBe("ATVPDKIKX0DER");
    });

    it("should use default marketplace ID for eu region", () => {
      const euClient = new AmazonSPApiClient({ ...validConfig, region: "eu" });
      expect(euClient.getMarketplaceId()).toBe("A1PA6795UKMFR9");
    });

    it("should use default marketplace ID for fe region", () => {
      const feClient = new AmazonSPApiClient({ ...validConfig, region: "fe" });
      expect(feClient.getMarketplaceId()).toBe("A1VC38T7YXB528");
    });

    it("should use custom marketplace ID when provided", () => {
      const customClient = new AmazonSPApiClient({
        ...validConfig,
        marketplaceId: "CUSTOM_MP_ID",
      });
      expect(customClient.getMarketplaceId()).toBe("CUSTOM_MP_ID");
    });
  });

  describe("getMarketplaceId", () => {
    it("should return configured marketplace ID", () => {
      expect(client.getMarketplaceId()).toBe("ATVPDKIKX0DER");
    });
  });
});

describe("createAmazonClientFromEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should create client from environment variables", () => {
    process.env.AMAZON_CLIENT_ID = "env-client-id";
    process.env.AMAZON_CLIENT_SECRET = "env-client-secret";
    process.env.AMAZON_REFRESH_TOKEN = "env-refresh-token";
    process.env.AMAZON_REGION = "eu";
    process.env.AMAZON_MARKETPLACE_ID = "CUSTOM_MP";

    const envClient = createAmazonClientFromEnv();

    expect(envClient).toBeDefined();
    expect(envClient.getMarketplaceId()).toBe("CUSTOM_MP");
  });

  it("should use default region when not set", () => {
    process.env.AMAZON_CLIENT_ID = "env-client-id";
    process.env.AMAZON_CLIENT_SECRET = "env-client-secret";
    process.env.AMAZON_REFRESH_TOKEN = "env-refresh-token";
    delete process.env.AMAZON_REGION;

    const envClient = createAmazonClientFromEnv();

    expect(envClient.getMarketplaceId()).toBe("ATVPDKIKX0DER");
  });

  it("should throw error when env vars are missing", () => {
    delete process.env.AMAZON_CLIENT_ID;
    delete process.env.AMAZON_CLIENT_SECRET;
    delete process.env.AMAZON_REFRESH_TOKEN;

    expect(() => createAmazonClientFromEnv()).toThrow(
      "Missing required Amazon SP-API configuration fields",
    );
  });
});
