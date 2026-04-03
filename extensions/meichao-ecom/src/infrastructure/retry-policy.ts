import {
  createRateLimitRetryRunner,
  type RetryConfig,
  type RetryRunner,
} from "openclaw/plugin-sdk/infra-runtime";
import type { Platform } from "../domain/types.js";
import { classifyError, isSevereError } from "./classification/ErrorClassifier.js";

export type { RetryRunner };

export const TAOBAO_RETRY_DEFAULTS: Required<RetryConfig> = {
  attempts: 3,
  minDelayMs: 500,
  maxDelayMs: 30_000,
  jitter: 0.1,
};

export const AMAZON_RETRY_DEFAULTS: Required<RetryConfig> = {
  attempts: 3,
  minDelayMs: 1000,
  maxDelayMs: 60_000,
  jitter: 0.1,
};

export function createTaobaoRetryRunner(params?: {
  retry?: RetryConfig;
  verbose?: boolean;
}): RetryRunner {
  return createRateLimitRetryRunner({
    retry: params?.retry,
    defaults: TAOBAO_RETRY_DEFAULTS,
    logLabel: "taobao",
    shouldRetry: (err) => {
      const classified = classifyError(err, "taobao");
      return !isSevereError(classified.reason);
    },
    verbose: params?.verbose,
  });
}

export function createAmazonRetryRunner(params?: {
  retry?: RetryConfig;
  verbose?: boolean;
}): RetryRunner {
  return createRateLimitRetryRunner({
    retry: params?.retry,
    defaults: AMAZON_RETRY_DEFAULTS,
    logLabel: "amazon",
    shouldRetry: (err) => {
      const classified = classifyError(err, "amazon");
      return !isSevereError(classified.reason);
    },
    verbose: params?.verbose,
  });
}

export function createPlatformRetryRunner(
  platform: Platform,
  params?: {
    retry?: RetryConfig;
    verbose?: boolean;
  },
): RetryRunner {
  switch (platform) {
    case "taobao":
      return createTaobaoRetryRunner(params);
    case "amazon":
      return createAmazonRetryRunner(params);
    default:
      return createRateLimitRetryRunner({
        retry: params?.retry,
        defaults: TAOBAO_RETRY_DEFAULTS,
        logLabel: platform,
        shouldRetry: (err) => {
          const classified = classifyError(err, platform);
          return !isSevereError(classified.reason);
        },
        verbose: params?.verbose,
      });
  }
}
