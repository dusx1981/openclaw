import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { TumeClient, TumeApiError } from "./TumeClient.js";

vi.mock("crypto", () => ({
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue("MOCKED_MD5"),
  })),
}));

describe("TumeClient", () => {
  const validConfig = { appKey: "key", appSecret: "secret" };

  it("should create client", () => {
    expect(new TumeClient(validConfig)).toBeDefined();
  });

  describe("fromEnv", () => {
    const originalEnv = process.env;
    beforeEach(() => {
      process.env = { ...originalEnv };
    });
    afterAll(() => {
      process.env = originalEnv;
    });

    it("should create from env", () => {
      process.env.TUME_APP_KEY = "key";
      process.env.TUME_APP_SECRET = "secret";
      expect(TumeClient.fromEnv()).toBeDefined();
    });

    it("should throw when missing credentials", () => {
      delete process.env.TUME_APP_KEY;
      process.env.TUME_APP_SECRET = "secret";
      expect(() => TumeClient.fromEnv()).toThrow("Missing TUME API credentials");
    });
  });
});

describe("TumeApiError", () => {
  it("should create error", () => {
    const error = new TumeApiError(1000, "Error");
    expect(error.code).toBe(1000);
    expect(error.isRetryable()).toBe(true);
  });
});
