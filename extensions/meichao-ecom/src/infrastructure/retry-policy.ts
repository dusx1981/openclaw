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

export const ALIBABA_1688_RETRY_DEFAULTS: Required<RetryConfig> = {
  attempts: 3,
  minDelayMs: 500,
  maxDelayMs: 30_000,
  jitter: 0.1,
};

export const JD_RETRY_DEFAULTS: Required<RetryConfig> = {
  attempts: 3,
  minDelayMs: 1000,
  maxDelayMs: 45_000,
  jitter: 0.1,
};

export const PINDUODUO_RETRY_DEFAULTS: Required<RetryConfig> = {
  attempts: 3,
  minDelayMs: 500,
  maxDelayMs: 30_000,
  jitter: 0.1,
};

export const DOUYIN_RETRY_DEFAULTS: Required<RetryConfig> = {
  attempts: 3,
  minDelayMs: 1000,
  maxDelayMs: 60_000,
  jitter: 0.1,
};

export const SHOPEE_RETRY_DEFAULTS: Required<RetryConfig> = {
  attempts: 3,
  minDelayMs: 1000,
  maxDelayMs: 60_000,
  jitter: 0.1,
};

export const ALIEXPRESS_RETRY_DEFAULTS: Required<RetryConfig> = {
  attempts: 3,
  minDelayMs: 1000,
  maxDelayMs: 45_000,
  jitter: 0.1,
};

export const TIKTOK_SHOP_RETRY_DEFAULTS: Required<RetryConfig> = {
  attempts: 3,
  minDelayMs: 1000,
  maxDelayMs: 60_000,
  jitter: 0.1,
};

export const LAZADA_RETRY_DEFAULTS: Required<RetryConfig> = {
  attempts: 3,
  minDelayMs: 1000,
  maxDelayMs: 60_000,
  jitter: 0.1,
};

export const TUME_RETRY_DEFAULTS: Required<RetryConfig> = {
  attempts: 3,
  minDelayMs: 500,
  maxDelayMs: 30_000,
  jitter: 0.1,
};

export const TMALL_RETRY_DEFAULTS: Required<RetryConfig> = {
  attempts: 3,
  minDelayMs: 500,
  maxDelayMs: 30_000,
  jitter: 0.1,
};

export const TAOGONGCHANG_RETRY_DEFAULTS: Required<RetryConfig> = {
  attempts: 3,
  minDelayMs: 500,
  maxDelayMs: 30_000,
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

export function createAlibaba1688RetryRunner(params?: {
  retry?: RetryConfig;
  verbose?: boolean;
}): RetryRunner {
  return createRateLimitRetryRunner({
    retry: params?.retry,
    defaults: ALIBABA_1688_RETRY_DEFAULTS,
    logLabel: "1688",
    shouldRetry: (err) => {
      const classified = classifyError(err, "1688");
      return !isSevereError(classified.reason);
    },
    verbose: params?.verbose,
  });
}

export function createJDRetryRunner(params?: {
  retry?: RetryConfig;
  verbose?: boolean;
}): RetryRunner {
  return createRateLimitRetryRunner({
    retry: params?.retry,
    defaults: JD_RETRY_DEFAULTS,
    logLabel: "jd",
    shouldRetry: (err) => {
      const classified = classifyError(err, "jd");
      return !isSevereError(classified.reason);
    },
    verbose: params?.verbose,
  });
}

export function createPinduoduoRetryRunner(params?: {
  retry?: RetryConfig;
  verbose?: boolean;
}): RetryRunner {
  return createRateLimitRetryRunner({
    retry: params?.retry,
    defaults: PINDUODUO_RETRY_DEFAULTS,
    logLabel: "pinduoduo",
    shouldRetry: (err) => {
      const classified = classifyError(err, "pinduoduo");
      return !isSevereError(classified.reason);
    },
    verbose: params?.verbose,
  });
}

export function createDouyinRetryRunner(params?: {
  retry?: RetryConfig;
  verbose?: boolean;
}): RetryRunner {
  return createRateLimitRetryRunner({
    retry: params?.retry,
    defaults: DOUYIN_RETRY_DEFAULTS,
    logLabel: "douyin",
    shouldRetry: (err) => {
      const classified = classifyError(err, "douyin");
      return !isSevereError(classified.reason);
    },
    verbose: params?.verbose,
  });
}

export function createShopeeRetryRunner(params?: {
  retry?: RetryConfig;
  verbose?: boolean;
}): RetryRunner {
  return createRateLimitRetryRunner({
    retry: params?.retry,
    defaults: SHOPEE_RETRY_DEFAULTS,
    logLabel: "shopee",
    shouldRetry: (err) => {
      const classified = classifyError(err, "shopee");
      return !isSevereError(classified.reason);
    },
    verbose: params?.verbose,
  });
}

export function createAliExpressRetryRunner(params?: {
  retry?: RetryConfig;
  verbose?: boolean;
}): RetryRunner {
  return createRateLimitRetryRunner({
    retry: params?.retry,
    defaults: ALIEXPRESS_RETRY_DEFAULTS,
    logLabel: "aliexpress",
    shouldRetry: (err) => {
      const classified = classifyError(err, "aliexpress");
      return !isSevereError(classified.reason);
    },
    verbose: params?.verbose,
  });
}

export function createTikTokShopRetryRunner(params?: {
  retry?: RetryConfig;
  verbose?: boolean;
}): RetryRunner {
  return createRateLimitRetryRunner({
    retry: params?.retry,
    defaults: TIKTOK_SHOP_RETRY_DEFAULTS,
    logLabel: "tiktok_shop",
    shouldRetry: (err) => {
      const classified = classifyError(err, "tiktok_shop");
      return !isSevereError(classified.reason);
    },
    verbose: params?.verbose,
  });
}

export function createLazadaRetryRunner(params?: {
  retry?: RetryConfig;
  verbose?: boolean;
}): RetryRunner {
  return createRateLimitRetryRunner({
    retry: params?.retry,
    defaults: LAZADA_RETRY_DEFAULTS,
    logLabel: "lazada",
    shouldRetry: (err) => {
      const classified = classifyError(err, "lazada");
      return !isSevereError(classified.reason);
    },
    verbose: params?.verbose,
  });
}

export function createTumeRetryRunner(params?: {
  retry?: RetryConfig;
  verbose?: boolean;
}): RetryRunner {
  return createRateLimitRetryRunner({
    retry: params?.retry,
    defaults: TUME_RETRY_DEFAULTS,
    logLabel: "tume",
    shouldRetry: (err) => {
      const classified = classifyError(err, "tume");
      return !isSevereError(classified.reason);
    },
    verbose: params?.verbose,
  });
}

export function createTmallRetryRunner(params?: {
  retry?: RetryConfig;
  verbose?: boolean;
}): RetryRunner {
  return createRateLimitRetryRunner({
    retry: params?.retry,
    defaults: TMALL_RETRY_DEFAULTS,
    logLabel: "tmall",
    shouldRetry: (err) => {
      const classified = classifyError(err, "tmall");
      return !isSevereError(classified.reason);
    },
    verbose: params?.verbose,
  });
}

export function createTaoGongChangRetryRunner(params?: {
  retry?: RetryConfig;
  verbose?: boolean;
}): RetryRunner {
  return createRateLimitRetryRunner({
    retry: params?.retry,
    defaults: TAOGONGCHANG_RETRY_DEFAULTS,
    logLabel: "taogongchang",
    shouldRetry: (err) => {
      const classified = classifyError(err, "taogongchang");
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
    case "1688":
      return createAlibaba1688RetryRunner(params);
    case "jd":
      return createJDRetryRunner(params);
    case "pinduoduo":
      return createPinduoduoRetryRunner(params);
    case "douyin":
      return createDouyinRetryRunner(params);
    case "shopee":
      return createShopeeRetryRunner(params);
    case "aliexpress":
      return createAliExpressRetryRunner(params);
    case "tiktok_shop":
      return createTikTokShopRetryRunner(params);
    case "lazada":
      return createLazadaRetryRunner(params);
    case "tume":
      return createTumeRetryRunner(params);
    case "tmall":
      return createTmallRetryRunner(params);
    case "taogongchang":
      return createTaoGongChangRetryRunner(params);
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
