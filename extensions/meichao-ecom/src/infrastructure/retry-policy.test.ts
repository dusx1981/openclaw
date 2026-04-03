import type { RetryRunner } from "openclaw/plugin-sdk/infra-runtime";
import { describe, it, expect, beforeEach } from "vitest";
import {
  createPlatformRetryRunner,
  TAOBAO_RETRY_DEFAULTS,
  AMAZON_RETRY_DEFAULTS,
} from "./retry-policy.js";

describe("Retry Policy", () => {
  describe("createPlatformRetryRunner", () => {
    it("should create Taobao retry runner with correct defaults", () => {
      const runner = createPlatformRetryRunner("taobao");
      expect(runner).toBeDefined();
      expect(typeof runner).toBe("function");
    });

    it("should create Amazon retry runner with correct defaults", () => {
      const runner = createPlatformRetryRunner("amazon");
      expect(runner).toBeDefined();
      expect(typeof runner).toBe("function");
    });

    it("should create generic retry runner for other platforms", () => {
      const runner = createPlatformRetryRunner("jd");
      expect(runner).toBeDefined();
      expect(typeof runner).toBe("function");
    });
  });

  describe("TAOBAO_RETRY_DEFAULTS", () => {
    it("should have correct values", () => {
      expect(TAOBAO_RETRY_DEFAULTS.attempts).toBe(3);
      expect(TAOBAO_RETRY_DEFAULTS.minDelayMs).toBe(500);
      expect(TAOBAO_RETRY_DEFAULTS.maxDelayMs).toBe(30000);
      expect(TAOBAO_RETRY_DEFAULTS.jitter).toBe(0.1);
    });
  });

  describe("AMAZON_RETRY_DEFAULTS", () => {
    it("should have correct values", () => {
      expect(AMAZON_RETRY_DEFAULTS.attempts).toBe(3);
      expect(AMAZON_RETRY_DEFAULTS.minDelayMs).toBe(1000);
      expect(AMAZON_RETRY_DEFAULTS.maxDelayMs).toBe(60000);
      expect(AMAZON_RETRY_DEFAULTS.jitter).toBe(0.1);
    });
  });
});
