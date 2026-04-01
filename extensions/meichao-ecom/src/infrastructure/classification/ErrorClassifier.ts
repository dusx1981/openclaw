import {
  DataSourceFailoverReason,
  ClassifiedError,
  SEVERE_FAILOVER_REASONS,
} from "../../domain/types.js";

const HTTP_STATUS_REASON_MAP: Record<number, DataSourceFailoverReason> = {
  401: "auth",
  403: "blocked",
  404: "not_found",
  429: "rate_limit",
  500: "overloaded",
  502: "overloaded",
  503: "overloaded",
  504: "timeout",
};

interface PlatformErrorMapping {
  codes: Record<string, DataSourceFailoverReason>;
  patterns: Array<{ pattern: RegExp; reason: DataSourceFailoverReason }>;
}

const PLATFORM_ERROR_MAPPINGS: Record<string, PlatformErrorMapping> = {
  taobao: {
    codes: {
      "isp.session-not-exist": "auth",
      "isp.session-expired": "auth",
      "isp.invalid-session": "auth",
      "isp.insufficient-isv-permissions": "auth_permanent",
      "isp.isv-account-frozen": "auth_permanent",
      "isp.api-service-overloaded": "overloaded",
      "isp.remote-service-unavailable": "overloaded",
      "isp.remote-service-error": "overloaded",
      "isp.rate-limit-exceeded": "rate_limit",
      "isp.item-not-found": "not_found",
    },
    patterns: [
      { pattern: /session/i, reason: "auth" },
      { pattern: /rate.*limit/i, reason: "rate_limit" },
      { pattern: /overload/i, reason: "overloaded" },
    ],
  },
  amazon: {
    codes: {
      ThrottlingException: "rate_limit",
      AccessDenied: "auth",
      UnauthorizedAccess: "auth",
      InvalidAccessToken: "auth",
      ResourceNotFound: "not_found",
      ServiceUnavailable: "overloaded",
      InternalError: "overloaded",
    },
    patterns: [
      { pattern: /throttl/i, reason: "rate_limit" },
      { pattern: /access.*denied/i, reason: "auth" },
      { pattern: /unavailable/i, reason: "overloaded" },
    ],
  },
};

export function classifyError(error: unknown, platform?: string): ClassifiedError {
  const originalError = error instanceof Error ? error : new Error(String(error));

  const message = originalError.message || "Unknown error";

  let reason: DataSourceFailoverReason = "unknown";
  let status: number | undefined;
  let code: string | undefined;

  if (isAxiosError(originalError)) {
    const axiosError = originalError as AxiosErrorLike;
    status = axiosError.response?.status;
    code = axiosError.response?.data?.code || axiosError.code;

    if (status && HTTP_STATUS_REASON_MAP[status]) {
      reason = HTTP_STATUS_REASON_MAP[status];
    }
  }

  if (isNodeError(originalError)) {
    if (originalError.code === "ETIMEDOUT") {
      reason = "timeout";
    } else if (originalError.code === "ECONNREFUSED") {
      reason = "overloaded";
    } else if (originalError.code === "ECONNRESET") {
      reason = "overloaded";
    }
    code = originalError.code;
  }

  if (platform && PLATFORM_ERROR_MAPPINGS[platform]) {
    const mapping = PLATFORM_ERROR_MAPPINGS[platform];

    if (code && mapping.codes[code]) {
      reason = mapping.codes[code];
    }

    if (reason === "unknown") {
      for (const { pattern, reason: mappedReason } of mapping.patterns) {
        if (pattern.test(message)) {
          reason = mappedReason;
          break;
        }
      }
    }
  }

  if (isTimeoutError(originalError)) {
    reason = "timeout";
  }

  if (isCaptchaError(originalError)) {
    reason = "captcha";
  }

  const isSevere = isSevereError(reason);

  return {
    reason,
    originalError,
    message,
    status,
    code,
    isSevere,
  };
}

export function isSevereError(reason: DataSourceFailoverReason): boolean {
  return SEVERE_FAILOVER_REASONS.includes(reason);
}

function isAxiosError(error: Error): boolean {
  return (
    "isAxiosError" in error ||
    ("response" in error && "config" in error) ||
    error.constructor.name === "AxiosError"
  );
}

function isNodeError(error: Error): error is NodeJS.ErrnoException {
  return "code" in error && typeof (error as NodeJS.ErrnoException).code === "string";
}

function isTimeoutError(error: Error): boolean {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();
  return (
    name.includes("timeout") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("etimedout")
  );
}

function isCaptchaError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return message.includes("captcha") || message.includes("验证码") || message.includes("verify");
}

interface AxiosErrorLike extends Error {
  response?: {
    status: number;
    data?: { code?: string };
  };
  code?: string;
}
