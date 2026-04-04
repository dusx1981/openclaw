import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { LazadaClient, LazadaApiError, LazadaSignature } from "./LazadaClient.js";

vi.mock("crypto", () => ({
  createHmac: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue("MOCKED_SIGNATURE"),
  })),
}));

describe("LazadaClient", () => {
  const validConfig = {
    appKey: "test_app_key",
    appSecret: "test_app_secret",
  };

  describe("constructor", () => {
    it("should create client with valid config", () => {
      const client = new LazadaClient(validConfig);
      expect(client).toBeDefined();
    });

    it("should accept country", () => {
      const client = new LazadaClient({ ...validConfig, country: "MY" });
      expect(client.getCountry()).toBe("MY");
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
      process.env.LAZADA_APP_KEY = "env_app_key";
      process.env.LAZADA_APP_SECRET = "env_app_secret";

      const client = LazadaClient.fromEnv();
      expect(client).toBeDefined();
    });

    it("should throw error when APP_KEY is missing", () => {
      delete process.env.LAZADA_APP_KEY;
      process.env.LAZADA_APP_SECRET = "env_app_secret";

      expect(() => LazadaClient.fromEnv()).toThrow("Missing Lazada API credentials");
    });
  });
});

describe("LazadaApiError", () => {
  it("should create error with code and message", () => {
    const error = new LazadaApiError("InvalidAccessKeyId", "Auth error");
    expect(error.code).toBe("InvalidAccessKeyId");
    expect(error.message).toBe("Auth error");
  });

  it("should identify retryable errors", () => {
    const error = new LazadaApiError("InternalError", "System error");
    expect(error.isRetryable()).toBe(true);
  });

  it("should identify auth errors", () => {
    const error = new LazadaApiError("InvalidAccessKeyId", "Auth error");
    expect(error.isAuthError()).toBe(true);
  });
});
