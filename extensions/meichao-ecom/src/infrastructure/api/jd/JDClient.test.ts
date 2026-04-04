import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { JDClient, JDApiError } from "./JDClient.js";

vi.mock("crypto", () => ({
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue("MOCKED_SIGNATURE"),
  })),
}));

describe("JDClient", () => {
  const validConfig = {
    appKey: "test_app_key",
    appSecret: "test_app_secret",
  };

  describe("constructor", () => {
    it("should create client with valid config", () => {
      const client = new JDClient(validConfig);
      expect(client).toBeDefined();
    });

    it("should use default API URL when not provided", () => {
      const client = new JDClient(validConfig);
      expect(client).toBeDefined();
    });

    it("should use custom API URL when provided", () => {
      const client = new JDClient({
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
      process.env.JD_APP_KEY = "env_app_key";
      process.env.JD_APP_SECRET = "env_app_secret";

      const client = JDClient.fromEnv();
      expect(client).toBeDefined();
    });

    it("should throw error when APP_KEY is missing", () => {
      delete process.env.JD_APP_KEY;
      process.env.JD_APP_SECRET = "env_app_secret";

      expect(() => JDClient.fromEnv()).toThrow("Missing JD API credentials");
    });

    it("should throw error when APP_SECRET is missing", () => {
      process.env.JD_APP_KEY = "env_app_key";
      delete process.env.JD_APP_SECRET;

      expect(() => JDClient.fromEnv()).toThrow("Missing JD API credentials");
    });
  });
});

describe("JDApiError", () => {
  it("should create error with code and message", () => {
    const error = new JDApiError("500", "System error");
    expect(error.code).toBe("500");
    expect(error.message).toBe("System error");
    expect(error.name).toBe("JDApiError");
  });

  it("should identify retryable errors", () => {
    const retryableError = new JDApiError("500", "System error");
    expect(retryableError.isRetryable()).toBe(true);
  });

  it("should identify auth errors", () => {
    const authError = new JDApiError("403", "Forbidden");
    expect(authError.isAuthError()).toBe(true);
  });
});
