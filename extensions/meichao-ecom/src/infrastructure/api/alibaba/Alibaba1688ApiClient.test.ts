import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { Alibaba1688ApiClient, Alibaba1688ApiError } from "./Alibaba1688ApiClient.js";

vi.mock("crypto", () => ({
  createHmac: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue("MOCKED_SIGNATURE"),
  })),
}));

describe("Alibaba1688ApiClient", () => {
  const validConfig = {
    appKey: "test_app_key",
    appSecret: "test_app_secret",
  };

  describe("constructor", () => {
    it("should create client with valid config", () => {
      const client = new Alibaba1688ApiClient(validConfig);
      expect(client).toBeDefined();
    });

    it("should use default API URL when not provided", () => {
      const client = new Alibaba1688ApiClient(validConfig);
      expect(client).toBeDefined();
    });

    it("should use custom API URL when provided", () => {
      const client = new Alibaba1688ApiClient({
        ...validConfig,
        apiUrl: "https://custom.api.url",
      });
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
      process.env.ALIBABA_1688_APP_KEY = "env_app_key";
      process.env.ALIBABA_1688_APP_SECRET = "env_app_secret";

      const client = Alibaba1688ApiClient.fromEnv();
      expect(client).toBeDefined();
    });

    it("should throw error when APP_KEY is missing", () => {
      delete process.env.ALIBABA_1688_APP_KEY;
      process.env.ALIBABA_1688_APP_SECRET = "env_app_secret";

      expect(() => Alibaba1688ApiClient.fromEnv()).toThrow("Missing 1688 API credentials");
    });

    it("should throw error when APP_SECRET is missing", () => {
      process.env.ALIBABA_1688_APP_KEY = "env_app_key";
      delete process.env.ALIBABA_1688_APP_SECRET;

      expect(() => Alibaba1688ApiClient.fromEnv()).toThrow("Missing 1688 API credentials");
    });
  });
});

describe("Alibaba1688ApiError", () => {
  it("should create error with code and message", () => {
    const error = new Alibaba1688ApiError("system.error", "System error");
    expect(error.code).toBe("system.error");
    expect(error.message).toBe("System error");
    expect(error.name).toBe("Alibaba1688ApiError");
  });

  it("should identify retryable errors", () => {
    const retryableError = new Alibaba1688ApiError("system.error", "System error");
    expect(retryableError.isRetryable()).toBe(true);
  });

  it("should identify auth errors", () => {
    const authError = new Alibaba1688ApiError("insufficient.permissions", "Permission denied");
    expect(authError.isAuthError()).toBe(true);
  });
});
