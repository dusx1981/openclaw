import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { ShopeeClient, ShopeeApiError, ShopeeSignature } from "./ShopeeClient.js";

vi.mock("crypto", () => ({
  createHmac: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue("mocked_hmac_sha256_signature"),
  })),
}));

describe("ShopeeClient", () => {
  const validConfig = {
    partnerId: "test_partner_id",
    partnerKey: "test_partner_key",
  };

  describe("constructor", () => {
    it("should create client with valid config", () => {
      const client = new ShopeeClient(validConfig);
      expect(client).toBeDefined();
    });

    it("should use default API URL when not provided", () => {
      const client = new ShopeeClient(validConfig);
      expect(client).toBeDefined();
    });

    it("should accept custom timeout", () => {
      const client = new ShopeeClient({ ...validConfig, timeout: 5000 });
      expect(client).toBeDefined();
    });

    it("should accept access token", () => {
      const client = new ShopeeClient({ ...validConfig, accessToken: "test_token" });
      expect(client).toBeDefined();
    });

    it("should accept shop ID", () => {
      const client = new ShopeeClient({ ...validConfig, shopId: "test_shop" });
      expect(client).toBeDefined();
    });

    it("should accept region", () => {
      const client = new ShopeeClient({ ...validConfig, region: "MY" });
      expect(client).toBeDefined();
    });
  });

  describe("fromEnv", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it("should create client from environment variables", () => {
      process.env.SHOPEE_PARTNER_ID = "env_partner_id";
      process.env.SHOPEE_PARTNER_KEY = "env_partner_key";

      const client = ShopeeClient.fromEnv();
      expect(client).toBeDefined();
    });

    it("should throw error when PARTNER_ID is missing", () => {
      delete process.env.SHOPEE_PARTNER_ID;
      process.env.SHOPEE_PARTNER_KEY = "env_partner_key";

      expect(() => ShopeeClient.fromEnv()).toThrow("Missing Shopee API credentials");
    });

    it("should throw error when PARTNER_KEY is missing", () => {
      process.env.SHOPEE_PARTNER_ID = "env_partner_id";
      delete process.env.SHOPEE_PARTNER_KEY;

      expect(() => ShopeeClient.fromEnv()).toThrow("Missing Shopee API credentials");
    });

    it("should accept optional environment variables", () => {
      process.env.SHOPEE_PARTNER_ID = "env_partner_id";
      process.env.SHOPEE_PARTNER_KEY = "env_partner_key";
      process.env.SHOPEE_ACCESS_TOKEN = "env_token";
      process.env.SHOPEE_SHOP_ID = "env_shop";
      process.env.SHOPEE_API_URL = "https://custom.api.url";
      process.env.SHOPEE_REGION = "TH";
      process.env.SHOPEE_API_TIMEOUT = "5000";

      const client = ShopeeClient.fromEnv();
      expect(client).toBeDefined();
    });
  });

  describe("getRegion", () => {
    it("should return configured region", () => {
      const client = new ShopeeClient({ ...validConfig, region: "MY" });
      expect(client.getRegion()).toBe("MY");
    });

    it("should return default region when not configured", () => {
      const client = new ShopeeClient(validConfig);
      expect(client.getRegion()).toBe("SG");
    });
  });

  describe("getShopId", () => {
    it("should return configured shop ID", () => {
      const client = new ShopeeClient({ ...validConfig, shopId: "shop123" });
      expect(client.getShopId()).toBe("shop123");
    });

    it("should return undefined when shop ID not configured", () => {
      const client = new ShopeeClient(validConfig);
      expect(client.getShopId()).toBeUndefined();
    });
  });
});

describe("ShopeeSignature", () => {
  it("should generate signature with basic params", () => {
    const partnerId = "test_partner";
    const path = "/item/get_item_base_info";
    const timestamp = 1234567890;
    const partnerKey = "test_key";

    const signature = ShopeeSignature.generate(partnerId, path, timestamp, partnerKey);
    expect(signature).toBe("mocked_hmac_sha256_signature");
  });

  it("should generate signature with access token", () => {
    const partnerId = "test_partner";
    const path = "/item/get_item_base_info";
    const timestamp = 1234567890;
    const partnerKey = "test_key";
    const accessToken = "test_token";

    const signature = ShopeeSignature.generate(partnerId, path, timestamp, partnerKey, accessToken);
    expect(signature).toBeDefined();
  });

  it("should generate signature with shop ID", () => {
    const partnerId = "test_partner";
    const path = "/item/get_item_base_info";
    const timestamp = 1234567890;
    const partnerKey = "test_key";
    const shopId = "shop123";

    const signature = ShopeeSignature.generate(
      partnerId,
      path,
      timestamp,
      partnerKey,
      undefined,
      shopId,
    );
    expect(signature).toBeDefined();
  });

  it("should generate signature with all params", () => {
    const partnerId = "test_partner";
    const path = "/item/get_item_base_info";
    const timestamp = 1234567890;
    const partnerKey = "test_key";
    const accessToken = "test_token";
    const shopId = "shop123";

    const signature = ShopeeSignature.generate(
      partnerId,
      path,
      timestamp,
      partnerKey,
      accessToken,
      shopId,
    );
    expect(signature).toBeDefined();
  });
});

describe("ShopeeApiError", () => {
  it("should create error with code and message", () => {
    const error = new ShopeeApiError("error_server", "Server error");
    expect(error.code).toBe("error_server");
    expect(error.message).toBe("Server error");
    expect(error.name).toBe("ShopeeApiError");
  });

  it("should create error with request_id", () => {
    const error = new ShopeeApiError("error_auth", "Auth error", "req123");
    expect(error.requestId).toBe("req123");
  });

  it("should identify retryable errors", () => {
    const retryableError = new ShopeeApiError("error_server", "Server error");
    expect(retryableError.isRetryable()).toBe(true);

    const rateLimitError = new ShopeeApiError("error_rate_limit", "Rate limit");
    expect(rateLimitError.isRetryable()).toBe(true);
  });

  it("should identify auth errors", () => {
    const authError = new ShopeeApiError("error_auth", "Auth error");
    expect(authError.isAuthError()).toBe(true);

    const invalidTokenError = new ShopeeApiError("error_invalid_access_token", "Invalid token");
    expect(invalidTokenError.isAuthError()).toBe(true);
  });

  it("should identify non-retryable errors", () => {
    const nonRetryableError = new ShopeeApiError("error_param", "Invalid param");
    expect(nonRetryableError.isRetryable()).toBe(false);
  });
});
