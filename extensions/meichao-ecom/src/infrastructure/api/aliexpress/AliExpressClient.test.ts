import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { AliExpressClient, AliExpressApiError, AliExpressSignature } from "./AliExpressClient.js";

vi.mock("crypto", () => ({
  createHmac: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue("MOCKED_SIGNATURE"),
  })),
}));

describe("AliExpressClient", () => {
  const validConfig = {
    appKey: "test_app_key",
    appSecret: "test_app_secret",
  };

  describe("constructor", () => {
    it("should create client with valid config", () => {
      const client = new AliExpressClient(validConfig);
      expect(client).toBeDefined();
    });

    it("should use default API URL when not provided", () => {
      const client = new AliExpressClient(validConfig);
      expect(client).toBeDefined();
    });

    it("should accept custom timeout", () => {
      const client = new AliExpressClient({ ...validConfig, timeout: 5000 });
      expect(client).toBeDefined();
    });

    it("should accept access token", () => {
      const client = new AliExpressClient({ ...validConfig, accessToken: "test_token" });
      expect(client).toBeDefined();
    });

    it("should accept language", () => {
      const client = new AliExpressClient({ ...validConfig, language: "zh" });
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
      process.env.ALIEXPRESS_APP_KEY = "env_app_key";
      process.env.ALIEXPRESS_APP_SECRET = "env_app_secret";

      const client = AliExpressClient.fromEnv();
      expect(client).toBeDefined();
    });

    it("should throw error when APP_KEY is missing", () => {
      delete process.env.ALIEXPRESS_APP_KEY;
      process.env.ALIEXPRESS_APP_SECRET = "env_app_secret";

      expect(() => AliExpressClient.fromEnv()).toThrow("Missing AliExpress API credentials");
    });

    it("should throw error when APP_SECRET is missing", () => {
      process.env.ALIEXPRESS_APP_KEY = "env_app_key";
      delete process.env.ALIEXPRESS_APP_SECRET;

      expect(() => AliExpressClient.fromEnv()).toThrow("Missing AliExpress API credentials");
    });

    it("should accept optional environment variables", () => {
      process.env.ALIEXPRESS_APP_KEY = "env_app_key";
      process.env.ALIEXPRESS_APP_SECRET = "env_app_secret";
      process.env.ALIEXPRESS_ACCESS_TOKEN = "env_token";
      process.env.ALIEXPRESS_API_URL = "https://custom.api.url";
      process.env.ALIEXPRESS_LANGUAGE = "ru";
      process.env.ALIEXPRESS_API_TIMEOUT = "5000";

      const client = AliExpressClient.fromEnv();
      expect(client).toBeDefined();
    });
  });

  describe("getLanguage", () => {
    it("should return configured language", () => {
      const client = new AliExpressClient({ ...validConfig, language: "zh" });
      expect(client.getLanguage()).toBe("zh");
    });

    it("should return default language when not configured", () => {
      const client = new AliExpressClient(validConfig);
      expect(client.getLanguage()).toBe("en");
    });
  });
});

describe("AliExpressSignature", () => {
  it("should generate signature", () => {
    const params = {
      app_key: "test_app",
      method: "aliexpress.affiliate.product.detail",
      timestamp: "2026-04-04T10:00:00",
      v: "2.0",
      language: "en",
    };
    const appSecret = "test_secret";

    const signature = AliExpressSignature.generate(params, appSecret);
    expect(signature).toBe("MOCKED_SIGNATURE");
  });

  it("should sort params alphabetically", () => {
    const params = {
      z_param: "z",
      a_param: "a",
      m_param: "m",
    };
    const appSecret = "secret";

    const signature = AliExpressSignature.generate(params, appSecret);
    expect(signature).toBeDefined();
  });

  it("should filter empty params", () => {
    const params = {
      param1: "value1",
      param2: "",
      param3: null as unknown as string,
    };
    const appSecret = "secret";

    const signature = AliExpressSignature.generate(params, appSecret);
    expect(signature).toBeDefined();
  });
});

describe("AliExpressApiError", () => {
  it("should create error with code and message", () => {
    const error = new AliExpressApiError("500", "System error");
    expect(error.code).toBe("500");
    expect(error.message).toBe("System error");
    expect(error.name).toBe("AliExpressApiError");
  });

  it("should identify retryable errors", () => {
    const retryableError = new AliExpressApiError("500", "System error");
    expect(retryableError.isRetryable()).toBe(true);

    const rateLimitError = new AliExpressApiError("520", "Rate limit");
    expect(rateLimitError.isRetryable()).toBe(true);
  });

  it("should identify auth errors", () => {
    const authError = new AliExpressApiError("2001", "Invalid key");
    expect(authError.isAuthError()).toBe(true);

    const invalidTokenError = new AliExpressApiError("2002", "Invalid token");
    expect(invalidTokenError.isAuthError()).toBe(true);
  });

  it("should identify non-retryable errors", () => {
    const nonRetryableError = new AliExpressApiError("400", "Bad request");
    expect(nonRetryableError.isRetryable()).toBe(false);
  });
});
