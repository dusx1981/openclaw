import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { PinduoduoClient, PinduoduoApiError } from "./PinduoduoClient.js";

vi.mock("crypto", () => ({
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue("MOCKED_SIGNATURE"),
  })),
}));

describe("PinduoduoClient", () => {
  const validConfig = {
    clientId: "test_client_id",
    clientSecret: "test_client_secret",
  };

  describe("constructor", () => {
    it("should create client with valid config", () => {
      const client = new PinduoduoClient(validConfig);
      expect(client).toBeDefined();
    });

    it("should use default API URL when not provided", () => {
      const client = new PinduoduoClient(validConfig);
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
      process.env.PINDUODUO_CLIENT_ID = "env_client_id";
      process.env.PINDUODUO_CLIENT_SECRET = "env_client_secret";

      const client = PinduoduoClient.fromEnv();
      expect(client).toBeDefined();
    });

    it("should throw error when CLIENT_ID is missing", () => {
      delete process.env.PINDUODUO_CLIENT_ID;
      process.env.PINDUODUO_CLIENT_SECRET = "env_client_secret";

      expect(() => PinduoduoClient.fromEnv()).toThrow("Missing Pinduoduo API credentials");
    });

    it("should throw error when CLIENT_SECRET is missing", () => {
      process.env.PINDUODUO_CLIENT_ID = "env_client_id";
      delete process.env.PINDUODUO_CLIENT_SECRET;

      expect(() => PinduoduoClient.fromEnv()).toThrow("Missing Pinduoduo API credentials");
    });
  });
});

describe("PinduoduoApiError", () => {
  it("should create error with code and message", () => {
    const error = new PinduoduoApiError(50000, "System error");
    expect(error.code).toBe(50000);
    expect(error.message).toBe("System error");
    expect(error.name).toBe("PinduoduoApiError");
  });

  it("should identify retryable errors", () => {
    const retryableError = new PinduoduoApiError(50000, "System error");
    expect(retryableError.isRetryable()).toBe(true);
  });

  it("should identify auth errors", () => {
    const authError = new PinduoduoApiError(40001, "Access denied");
    expect(authError.isAuthError()).toBe(true);
  });
});
