import { describe, it, expect } from "vitest";
import { DataSourceFailoverReason } from "../../domain/types.js";
import { classifyError, isSevereError } from "./ErrorClassifier.js";

describe("ErrorClassifier", () => {
  describe("HTTP status code mapping", () => {
    it("should classify HTTP 401 as auth", () => {
      const error = createAxiosError(401);
      const result = classifyError(error);
      expect(result.reason).toBe("auth");
      expect(result.status).toBe(401);
    });

    it("should classify HTTP 403 as blocked (severe)", () => {
      const error = createAxiosError(403);
      const result = classifyError(error);
      expect(result.reason).toBe("blocked");
      expect(result.isSevere).toBe(true);
    });

    it("should classify HTTP 404 as not_found", () => {
      const error = createAxiosError(404);
      const result = classifyError(error);
      expect(result.reason).toBe("not_found");
    });

    it("should classify HTTP 429 as rate_limit", () => {
      const error = createAxiosError(429);
      const result = classifyError(error);
      expect(result.reason).toBe("rate_limit");
    });

    it("should classify HTTP 503 as overloaded", () => {
      const error = createAxiosError(503);
      const result = classifyError(error);
      expect(result.reason).toBe("overloaded");
    });

    it("should classify HTTP 504 as timeout", () => {
      const error = createAxiosError(504);
      const result = classifyError(error);
      expect(result.reason).toBe("timeout");
    });
  });

  describe("Timeout classification", () => {
    it("should classify ETIMEDOUT as timeout", () => {
      const error = new Error("Connection timed out");
      (error as NodeJS.ErrnoException).code = "ETIMEDOUT";
      const result = classifyError(error);
      expect(result.reason).toBe("timeout");
    });

    it("should classify timeout error by message", () => {
      const error = new Error("Request timeout exceeded");
      const result = classifyError(error);
      expect(result.reason).toBe("timeout");
    });
  });

  describe("Captcha classification", () => {
    it("should classify captcha error by message", () => {
      const error = new Error("需要验证码验证");
      const result = classifyError(error);
      expect(result.reason).toBe("captcha");
    });
  });

  describe("Platform error code mapping", () => {
    it("should classify Taobao session error as auth", () => {
      const error = createAxiosError(200, "isp.session-not-exist");
      const result = classifyError(error, "taobao");
      expect(result.reason).toBe("auth");
    });

    it("should classify Taobao ISV permission error as auth_permanent", () => {
      const error = createAxiosError(200, "isp.insufficient-isv-permissions");
      const result = classifyError(error, "taobao");
      expect(result.reason).toBe("auth_permanent");
      expect(result.isSevere).toBe(true);
    });

    it("should classify Amazon ThrottlingException as rate_limit", () => {
      const error = createAxiosError(200, "ThrottlingException");
      const result = classifyError(error, "amazon");
      expect(result.reason).toBe("rate_limit");
    });

    it("should classify Amazon AccessDenied as auth", () => {
      const error = createAxiosError(200, "AccessDenied");
      const result = classifyError(error, "amazon");
      expect(result.reason).toBe("auth");
    });
  });

  describe("Unknown error fallback", () => {
    it("should classify unknown error as unknown", () => {
      const error = new Error("Some random error");
      const result = classifyError(error);
      expect(result.reason).toBe("unknown");
    });

    it("should handle non-Error objects", () => {
      const result = classifyError("string error");
      expect(result.reason).toBe("unknown");
      expect(result.message).toBe("string error");
    });
  });

  describe("isSevereError", () => {
    it("should return true for auth_permanent", () => {
      expect(isSevereError("auth_permanent")).toBe(true);
    });

    it("should return true for billing", () => {
      expect(isSevereError("billing")).toBe(true);
    });

    it("should return true for blocked", () => {
      expect(isSevereError("blocked")).toBe(true);
    });

    it("should return false for rate_limit", () => {
      expect(isSevereError("rate_limit")).toBe(false);
    });

    it("should return false for timeout", () => {
      expect(isSevereError("timeout")).toBe(false);
    });
  });
});

function createAxiosError(status: number, code?: string): Error {
  const error = new Error("Axios error") as Error & {
    response: { status: number; data?: { code?: string } };
    isAxiosError: boolean;
  };
  error.response = { status, data: code ? { code } : undefined };
  error.isAxiosError = true;
  return error;
}
