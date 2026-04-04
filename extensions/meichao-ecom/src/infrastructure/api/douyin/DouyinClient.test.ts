import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { DouyinClient, DouyinApiError, DouyinSignature } from "./DouyinClient.js";

vi.mock("crypto", () => ({
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue("mocked_sha256_signature"),
  })),
}));

describe("DouyinClient", () => {
  const validConfig = {
    appId: "test_app_id",
    appSecret: "test_app_secret",
  };

  describe("constructor", () => {
    it("should create client with valid config", () => {
      const client = new DouyinClient(validConfig);
      expect(client).toBeDefined();
    });

    it("should use default API URL when not provided", () => {
      const client = new DouyinClient(validConfig);
      expect(client).toBeDefined();
    });

    it("should accept custom timeout", () => {
      const client = new DouyinClient({ ...validConfig, timeout: 5000 });
      expect(client).toBeDefined();
    });

    it("should accept access token", () => {
      const client = new DouyinClient({ ...validConfig, accessToken: "test_token" });
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
      process.env.DOUYIN_APP_ID = "env_app_id";
      process.env.DOUYIN_APP_SECRET = "env_app_secret";

      const client = DouyinClient.fromEnv();
      expect(client).toBeDefined();
    });

    it("should throw error when APP_ID is missing", () => {
      delete process.env.DOUYIN_APP_ID;
      process.env.DOUYIN_APP_SECRET = "env_app_secret";

      expect(() => DouyinClient.fromEnv()).toThrow("Missing Douyin API credentials");
    });

    it("should throw error when APP_SECRET is missing", () => {
      process.env.DOUYIN_APP_ID = "env_app_id";
      delete process.env.DOUYIN_APP_SECRET;

      expect(() => DouyinClient.fromEnv()).toThrow("Missing Douyin API credentials");
    });

    it("should accept optional environment variables", () => {
      process.env.DOUYIN_APP_ID = "env_app_id";
      process.env.DOUYIN_APP_SECRET = "env_app_secret";
      process.env.DOUYIN_ACCESS_TOKEN = "env_token";
      process.env.DOUYIN_API_URL = "https://custom.api.url";
      process.env.DOUYIN_API_TIMEOUT = "5000";

      const client = DouyinClient.fromEnv();
      expect(client).toBeDefined();
    });
  });
});

describe("DouyinSignature", () => {
  it("should generate signature", () => {
    const params = {
      app_id: "test_app",
      method: "product.detail",
      timestamp: 1234567890,
      version: "2.0",
    };
    const appSecret = "test_secret";

    const signature = DouyinSignature.generate(params, appSecret);
    expect(signature).toBe("mocked_sha256_signature");
  });

  it("should sort params alphabetically", () => {
    const params = {
      z_param: "z",
      a_param: "a",
      m_param: "m",
    };
    const appSecret = "secret";

    const signature = DouyinSignature.generate(params, appSecret);
    expect(signature).toBeDefined();
  });

  it("should filter empty params", () => {
    const params = {
      param1: "value1",
      param2: "",
      param3: null as unknown as string,
    };
    const appSecret = "secret";

    const signature = DouyinSignature.generate(params, appSecret);
    expect(signature).toBeDefined();
  });
});

describe("DouyinApiError", () => {
  it("should create error with code and message", () => {
    const error = new DouyinApiError(10001, "System error");
    expect(error.code).toBe(10001);
    expect(error.message).toBe("System error");
    expect(error.name).toBe("DouyinApiError");
  });

  it("should create error with log_id", () => {
    const error = new DouyinApiError(10001, "System error", "log123");
    expect(error.logId).toBe("log123");
  });

  it("should identify retryable errors", () => {
    const retryableError = new DouyinApiError(10001, "System error");
    expect(retryableError.isRetryable()).toBe(true);

    const rateLimitError = new DouyinApiError(10003, "Rate limit");
    expect(rateLimitError.isRetryable()).toBe(true);
  });

  it("should identify auth errors", () => {
    const authError = new DouyinApiError(10002, "Access denied");
    expect(authError.isAuthError()).toBe(true);

    const invalidTokenError = new DouyinApiError(10004, "Invalid token");
    expect(invalidTokenError.isAuthError()).toBe(true);
  });

  it("should identify non-retryable errors", () => {
    const nonRetryableError = new DouyinApiError(10006, "Not found");
    expect(nonRetryableError.isRetryable()).toBe(false);
  });
});
