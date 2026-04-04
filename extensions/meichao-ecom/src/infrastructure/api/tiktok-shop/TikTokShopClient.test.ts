import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { TikTokShopClient, TikTokShopApiError, TikTokShopSignature } from "./TikTokShopClient.js";

vi.mock("crypto", () => ({
  createHmac: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue("mocked_hmac_sha256_signature"),
  })),
}));

describe("TikTokShopClient", () => {
  const validConfig = {
    appKey: "test_app_key",
    appSecret: "test_app_secret",
  };

  describe("constructor", () => {
    it("should create client with valid config", () => {
      const client = new TikTokShopClient(validConfig);
      expect(client).toBeDefined();
    });

    it("should use default API URL when not provided", () => {
      const client = new TikTokShopClient(validConfig);
      expect(client).toBeDefined();
    });

    it("should accept custom timeout", () => {
      const client = new TikTokShopClient({ ...validConfig, timeout: 5000 });
      expect(client).toBeDefined();
    });

    it("should accept access token", () => {
      const client = new TikTokShopClient({ ...validConfig, accessToken: "test_token" });
      expect(client).toBeDefined();
    });

    it("should accept region", () => {
      const client = new TikTokShopClient({ ...validConfig, region: "UK" });
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
      process.env.TIKTOK_SHOP_APP_KEY = "env_app_key";
      process.env.TIKTOK_SHOP_APP_SECRET = "env_app_secret";

      const client = TikTokShopClient.fromEnv();
      expect(client).toBeDefined();
    });

    it("should throw error when APP_KEY is missing", () => {
      delete process.env.TIKTOK_SHOP_APP_KEY;
      process.env.TIKTOK_SHOP_APP_SECRET = "env_app_secret";

      expect(() => TikTokShopClient.fromEnv()).toThrow("Missing TikTok Shop API credentials");
    });

    it("should throw error when APP_SECRET is missing", () => {
      process.env.TIKTOK_SHOP_APP_KEY = "env_app_key";
      delete process.env.TIKTOK_SHOP_APP_SECRET;

      expect(() => TikTokShopClient.fromEnv()).toThrow("Missing TikTok Shop API credentials");
    });

    it("should accept optional environment variables", () => {
      process.env.TIKTOK_SHOP_APP_KEY = "env_app_key";
      process.env.TIKTOK_SHOP_APP_SECRET = "env_app_secret";
      process.env.TIKTOK_SHOP_ACCESS_TOKEN = "env_token";
      process.env.TIKTOK_SHOP_API_URL = "https://custom.api.url";
      process.env.TIKTOK_SHOP_REGION = "MY";
      process.env.TIKTOK_SHOP_API_TIMEOUT = "5000";

      const client = TikTokShopClient.fromEnv();
      expect(client).toBeDefined();
    });
  });

  describe("getRegion", () => {
    it("should return configured region", () => {
      const client = new TikTokShopClient({ ...validConfig, region: "UK" });
      expect(client.getRegion()).toBe("UK");
    });

    it("should return default region when not configured", () => {
      const client = new TikTokShopClient(validConfig);
      expect(client.getRegion()).toBe("US");
    });
  });
});

describe("TikTokShopSignature", () => {
  it("should generate signature with basic params", () => {
    const path = "/api/products/detail";
    const timestamp = 1234567890;
    const appKey = "test_key";
    const appSecret = "test_secret";

    const signature = TikTokShopSignature.generate(path, timestamp, appKey, appSecret);
    expect(signature).toBe("mocked_hmac_sha256_signature");
  });

  it("should generate signature with access token", () => {
    const path = "/api/products/detail";
    const timestamp = 1234567890;
    const appKey = "test_key";
    const appSecret = "test_secret";
    const accessToken = "test_token";

    const signature = TikTokShopSignature.generate(path, timestamp, appKey, appSecret, accessToken);
    expect(signature).toBeDefined();
  });
});

describe("TikTokShopApiError", () => {
  it("should create error with code and message", () => {
    const error = new TikTokShopApiError(10000, "System error");
    expect(error.code).toBe(10000);
    expect(error.message).toBe("System error");
    expect(error.name).toBe("TikTokShopApiError");
  });

  it("should create error with request_id", () => {
    const error = new TikTokShopApiError(10001, "Auth error", "req123");
    expect(error.requestId).toBe("req123");
  });

  it("should identify retryable errors", () => {
    const retryableError = new TikTokShopApiError(10000, "System error");
    expect(retryableError.isRetryable()).toBe(true);

    const rateLimitError = new TikTokShopApiError(10002, "Rate limit");
    expect(rateLimitError.isRetryable()).toBe(true);
  });

  it("should identify auth errors", () => {
    const authError = new TikTokShopApiError(10001, "Auth error");
    expect(authError.isAuthError()).toBe(true);

    const invalidTokenError = new TikTokShopApiError(10005, "Invalid token");
    expect(invalidTokenError.isAuthError()).toBe(true);
  });

  it("should identify non-retryable errors", () => {
    const nonRetryableError = new TikTokShopApiError(10003, "Invalid params");
    expect(nonRetryableError.isRetryable()).toBe(false);
  });
});
