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
  "1688": {
    codes: {
      "system.error": "overloaded",
      "insufficient.permissions": "auth",
      "item.not.exist": "not_found",
      "session.expired": "auth",
      "rate.limit.exceeded": "rate_limit",
      "service.unavailable": "overloaded",
    },
    patterns: [
      { pattern: /permission/i, reason: "auth" },
      { pattern: /rate.*limit/i, reason: "rate_limit" },
      { pattern: /unavailable/i, reason: "overloaded" },
    ],
  },
  jd: {
    codes: {
      "400": "unknown",
      "401": "auth",
      "403": "auth_permanent",
      "404": "not_found",
      "429": "rate_limit",
      "500": "overloaded",
      "503": "overloaded",
    },
    patterns: [
      { pattern: /unauthorized/i, reason: "auth" },
      { pattern: /forbidden/i, reason: "auth_permanent" },
      { pattern: /rate.*limit/i, reason: "rate_limit" },
    ],
  },
  pinduoduo: {
    codes: {
      "40001": "auth",
      "40002": "auth_permanent",
      "50000": "overloaded",
      "52001": "rate_limit",
      "52002": "rate_limit",
    },
    patterns: [
      { pattern: /access.*denied/i, reason: "auth" },
      { pattern: /throttl/i, reason: "rate_limit" },
      { pattern: /server.*error/i, reason: "overloaded" },
    ],
  },
  douyin: {
    codes: {
      "10001": "overloaded",
      "10002": "auth",
      "10003": "rate_limit",
      "10004": "auth_permanent",
    },
    patterns: [
      { pattern: /access.*denied/i, reason: "auth" },
      { pattern: /rate.*limit/i, reason: "rate_limit" },
      { pattern: /server.*error/i, reason: "overloaded" },
    ],
  },
  shopee: {
    codes: {
      error_auth: "auth",
      error_param: "unknown",
      error_server: "overloaded",
      error_rate_limit: "rate_limit",
    },
    patterns: [
      { pattern: /auth.*fail/i, reason: "auth" },
      { pattern: /rate.*limit/i, reason: "rate_limit" },
      { pattern: /server.*error/i, reason: "overloaded" },
    ],
  },
  aliexpress: {
    codes: {
      "200": "unknown",
      "401": "auth",
      "403": "auth_permanent",
      "500": "overloaded",
      "520": "rate_limit",
    },
    patterns: [
      { pattern: /unauthorized/i, reason: "auth" },
      { pattern: /forbidden/i, reason: "auth_permanent" },
      { pattern: /rate.*limit/i, reason: "rate_limit" },
    ],
  },
  tiktok_shop: {
    codes: {
      "10000": "overloaded",
      "10001": "auth",
      "10002": "rate_limit",
      "10003": "unknown",
      "10004": "not_found",
    },
    patterns: [
      { pattern: /access.*denied/i, reason: "auth" },
      { pattern: /rate.*limit/i, reason: "rate_limit" },
      { pattern: /not.*found/i, reason: "not_found" },
    ],
  },
  lazada: {
    codes: {
      InvalidAccessKeyId: "auth",
      SignatureMismatch: "auth",
      InvalidParameters: "unknown",
      InternalError: "overloaded",
      RateLimitExceeded: "rate_limit",
    },
    patterns: [
      { pattern: /invalid.*key/i, reason: "auth" },
      { pattern: /rate.*limit/i, reason: "rate_limit" },
    ],
  },
  tume: {
    codes: {
      "1000": "overloaded",
      "2000": "auth",
      "3000": "rate_limit",
      "4000": "unknown",
      "5000": "not_found",
    },
    patterns: [
      { pattern: /unauthorized/i, reason: "auth" },
      { pattern: /rate.*limit/i, reason: "rate_limit" },
    ],
  },
  tmall: {
    codes: {
      "isp.session-not-exist": "auth",
      "isp.session-expired": "auth",
      "isp.rate-limit-exceeded": "rate_limit",
      "isp.item-not-found": "not_found",
    },
    patterns: [
      { pattern: /session/i, reason: "auth" },
      { pattern: /rate.*limit/i, reason: "rate_limit" },
    ],
  },
  taogongchang: {
    codes: {
      "system.error": "overloaded",
      "insufficient.permissions": "auth",
      "item.not.exist": "not_found",
      "rate.limit.exceeded": "rate_limit",
    },
    patterns: [
      { pattern: /permission/i, reason: "auth" },
      { pattern: /rate.*limit/i, reason: "rate_limit" },
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
