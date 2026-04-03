# OpenClaw Plugin SDK 使用指南

## 概述

OpenClaw Plugin SDK 是为插件开发者提供的标准工具集，包含了一系列经过验证的基础设施功能。通过使用 SDK，插件可以：

- ✓ 复用核心基础设施，避免重复造轮子
- ✓ 保持与 OpenClaw 核心的一致性
- ✓ 获得 Battle-tested 的可靠实现
- ✓ 减少维护成本和 Bug 风险

本文档重点介绍 `plugin-sdk/infra-runtime` 模块，这是插件开发中最常用的基础设施集合。

---

## 1. SDK 架构

### 1.1 模块结构

```
openclaw/plugin-sdk/
├── infra-runtime.ts      ← 本文档重点
├── provider-entry.ts      Provider 入口定义
├── secret-input.ts        密钥输入处理
├── channel-setup.ts        频道设置工具
├── runtime.ts              运行时 API
└── ...                     其他模块
```

### 1.2 infra-runtime 导出清单

`infra-runtime` 聚合了以下基础设施模块：

| 模块                  | 功能         | 典型用途             |
| --------------------- | ------------ | -------------------- |
| **retry**             | 重试机制     | API 调用失败重试     |
| **retry-policy**      | 重试策略工厂 | 创建平台特定重试策略 |
| **backoff**           | 退避算法     | 指数退避计算         |
| **errors**            | 错误处理     | 错误格式化、分类     |
| **fetch**             | HTTP 客户端  | 网络请求             |
| **dedupe**            | 去重         | 防止重复操作         |
| **diagnostic-events** | 诊断事件     | 可观测性             |
| **env**               | 环境变量     | 配置管理             |
| **ssrf**              | SSRF 防护    | 安全检查             |

---

## 2. Retry 机制详解

### 2.1 核心 API

#### retryAsync()

基础重试函数，提供灵活的重试能力。

```typescript
import { retryAsync, type RetryOptions } from "openclaw/plugin-sdk/infra-runtime";

// 简单用法：指定重试次数
const result = await retryAsync(
  async () => {
    const response = await fetch("https://api.example.com/data");
    if (!response.ok) throw new Error("Request failed");
    return response.json();
  },
  3, // 最多重试 3 次
);

// 高级用法：完整配置
const options: RetryOptions = {
  attempts: 3, // 最多 3 次尝试
  minDelayMs: 500, // 最小延迟 500ms
  maxDelayMs: 30_000, // 最大延迟 30 秒
  jitter: 0.1, // 10% 抖动
  shouldRetry: (err, attempt) => {
    // 自定义重试判断逻辑
    return err instanceof NetworkError;
  },
  retryAfterMs: (err) => {
    // 从响应中提取 retry-after 值
    if (err instanceof RateLimitError) {
      return err.retryAfter * 1000;
    }
    return undefined;
  },
  onRetry: (info) => {
    console.log(`Retry ${info.attempt}/${info.maxAttempts}, waiting ${info.delayMs}ms`);
  },
};

const result = await retryAsync(fn, options);
```

**关键参数说明：**

| 参数           | 类型     | 说明                     | 默认值        |
| -------------- | -------- | ------------------------ | ------------- |
| `attempts`     | number   | 最大尝试次数             | 3             |
| `minDelayMs`   | number   | 最小延迟（毫秒）         | 300           |
| `maxDelayMs`   | number   | 最大延迟（毫秒）         | 30_000        |
| `jitter`       | number   | 抖动系数 (0-1)           | 0             |
| `shouldRetry`  | function | 判断是否重试             | 总是返回 true |
| `retryAfterMs` | function | 从错误提取服务器建议延迟 | undefined     |
| `onRetry`      | function | 重试回调                 | undefined     |

**退避算法：**

```
实际延迟 = min(maxDelayMs, minDelayMs × 2^(attempt-1)) × (1 + jitter × random())

示例 (minDelay=500ms, maxDelay=30s, jitter=0.1):
  Attempt 1: 失败 → 等待 500ms × 2^0 × (0.9~1.1) = 450~550ms
  Attempt 2: 失败 → 等待 500ms × 2^1 × (0.9~1.1) = 900~1100ms
  Attempt 3: 失败 → 放弃
```

### 2.2 RetryRunner 模式

`RetryRunner` 是一个函数类型，封装了特定的重试策略：

```typescript
export type RetryRunner = <T>(fn: () => Promise<T>, label?: string) => Promise<T>;
```

**优势：**

- 策略预配置，使用时无需重复设置
- 类型安全，易于组合
- 可测试性强

#### createRateLimitRetryRunner()

专门用于处理速率限制的重试策略工厂。

```typescript
import {
  createRateLimitRetryRunner,
  type RetryConfig,
  type RetryRunner,
} from "openclaw/plugin-sdk/infra-runtime";

// 定义默认配置
const DEFAULT_CONFIG: Required<RetryConfig> = {
  attempts: 3,
  minDelayMs: 500,
  maxDelayMs: 30_000,
  jitter: 0.1,
};

// 创建 RetryRunner
const retryRunner: RetryRunner = createRateLimitRetryRunner({
  defaults: DEFAULT_CONFIG,
  logLabel: "my-service",
  shouldRetry: (err) => {
    // 只重试速率限制错误
    return err instanceof RateLimitError;
  },
  retryAfterMs: (err) => {
    // 从错误中提取 retry-after
    if (err instanceof RateLimitError) {
      return err.retryAfter * 1000;
    }
    return undefined;
  },
  verbose: true, // 启用日志
});

// 使用 RetryRunner
const data = await retryRunner(
  async () => fetchDataFromAPI(),
  "fetch-data", // 可选标签，用于日志
);
```

---

## 3. 实战案例

### 3.1 案例 1：电商插件重试策略

meichao-ecom 插件为不同电商平台实现了定制化的重试策略。

**需求：**

- 淘宝 API：快速重试，处理 rate_limit
- Amazon API：较慢重试，处理 ThrottlingException
- 区分严重错误（不重试）和可重试错误

**实现：**

```typescript
// extensions/meichao-ecom/src/infrastructure/retry-policy.ts

import {
  createRateLimitRetryRunner,
  type RetryConfig,
  type RetryRunner,
} from "openclaw/plugin-sdk/infra-runtime";
import { classifyError, isSevereError } from "./classification/ErrorClassifier.js";

// 淘宝专用配置
export const TAOBAO_RETRY_DEFAULTS: Required<RetryConfig> = {
  attempts: 3,
  minDelayMs: 500, // 500ms 起步
  maxDelayMs: 30_000, // 最大 30 秒
  jitter: 0.1, // 10% 抖动
};

// Amazon 专用配置
export const AMAZON_RETRY_DEFAULTS: Required<RetryConfig> = {
  attempts: 3,
  minDelayMs: 1000, // 1 秒起步
  maxDelayMs: 60_000, // 最大 60 秒
  jitter: 0.1,
};

// 创建淘宝重试策略
export function createTaobaoRetryRunner(params?: {
  retry?: RetryConfig;
  verbose?: boolean;
}): RetryRunner {
  return createRateLimitRetryRunner({
    retry: params?.retry,
    defaults: TAOBAO_RETRY_DEFAULTS,
    logLabel: "taobao",
    shouldRetry: (err) => {
      // 错误分类
      const classified = classifyError(err, "taobao");

      // 严重错误不重试
      if (isSevereError(classified.reason)) {
        return false;
      }

      // 可重试错误
      return ["rate_limit", "timeout", "overloaded"].includes(classified.reason);
    },
    verbose: params?.verbose,
  });
}

// 通用平台策略
export function createPlatformRetryRunner(
  platform: Platform,
  params?: { retry?: RetryConfig; verbose?: boolean },
): RetryRunner {
  switch (platform) {
    case "taobao":
      return createTaobaoRetryRunner(params);
    case "amazon":
      return createAmazonRetryRunner(params);
    default:
      // 默认策略
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
```

**使用：**

```typescript
// 在 BasePlatformAdapter 中
class TaobaoAdapter extends BasePlatformAdapter {
  private retryRunners: Map<string, RetryRunner> = new Map();

  constructor(config: AdapterConfig) {
    super(config);

    // 为每个数据源创建 RetryRunner
    for (const ds of config.dataSources) {
      this.retryRunners.set(ds.id, createPlatformRetryRunner(ds.platform));
    }
  }

  async fetchData(sourceId: string) {
    const retryRunner = this.retryRunners.get(sourceId);

    return await retryRunner(async () => {
      const response = await fetch(`${API_BASE_URL}/items/${sourceId}`);
      if (!response.ok) {
        throw new APIError(response.status, await response.text());
      }
      return response.json();
    });
  }
}
```

### 3.2 案例 2：Discord 插件重试策略

Discord 插件处理消息发送时的速率限制。

```typescript
// extensions/discord/src/retry.ts

import { RateLimitError } from "@buape/carbon";
import {
  createRateLimitRetryRunner,
  type RetryConfig,
  type RetryRunner,
} from "openclaw/plugin-sdk/infra-runtime";

export const DISCORD_RETRY_DEFAULTS: Required<RetryConfig> = {
  attempts: 3,
  minDelayMs: 500,
  maxDelayMs: 30_000,
  jitter: 0.1,
};

export function createDiscordRetryRunner(params: {
  retry?: RetryConfig;
  configRetry?: RetryConfig;
  verbose?: boolean;
}): RetryRunner {
  return createRateLimitRetryRunner({
    ...params,
    defaults: DISCORD_RETRY_DEFAULTS,
    logLabel: "discord",
    // 只重试速率限制错误
    shouldRetry: (err) => err instanceof RateLimitError,
    // 从 Discord 错误中提取 retry_after
    retryAfterMs: (err) => (err instanceof RateLimitError ? err.retryAfter * 1000 : undefined),
  });
}
```

**关键点：**

- 使用 Carbon 库的 `RateLimitError` 类型
- Discord API 返回 `retry_after` 字段，单位是秒
- 只重试速率限制错误，其他错误立即失败

### 3.3 案例 3：Telegram 插件退避策略

Telegram 插件处理 401 认证错误的退避。

```typescript
// extensions/telegram/src/sendchataction-401-backoff.ts

import {
  computeBackoff,
  sleepWithAbort,
  type BackoffPolicy,
} from "openclaw/plugin-sdk/infra-runtime";

const BACKOFF_POLICY: BackoffPolicy = {
  initialMs: 1000,      // 1 秒起步
  maxMs: 300_000,       // 最大 5 分钟
  factor: 2,            // 每次翻倍
  jitter: 0.1,          // 10% 抖动
};

export function createTelegramSendChatActionHandler(params: {
  sendChatActionFn: SendChatActionFn;
  logger: (message: string) => void;
  maxConsecutive401?: number;
}): TelegramSendChatActionHandler {
  let consecutive401Failures = 0;
  let suspended = false;

  const sendChatAction = async (chatId: string, action: string) => {
    if (suspended) return;

    if (consecutive401Failures > 0) {
      // 计算退避时间
      const backoffMs = computeBackoff(BACKOFF_POLICY, consecutive401Failures);
      logger(`Waiting ${backoffMs}ms before retry`);
      await sleepWithAbort(backoffMs);
    }

    try {
      await params.sendChatActionFn(chatId, action);
      consecutive401Failures = 0;  // 重置
    } catch (error) {
      if (is401Error(error)) {
        consecutive401Failures++;

        if (consecutive401Failures >= (params.maxConsecutive401 ?? 10)) {
          suspended = true;
          logger("CRITICAL: Suspended due to consecutive 401 errors");
        }
      }
      throw error;
    }
  };

  return { sendChatAction, isSuspended: () => suspended, reset: () => { ... } };
}
```

---

## 4. Backoff 算法

### 4.1 computeBackoff()

计算指数退避时间。

```typescript
import { computeBackoff, type BackoffPolicy } from "openclaw/plugin-sdk/infra-runtime";

const policy: BackoffPolicy = {
  initialMs: 1000, // 初始延迟 1 秒
  maxMs: 60000, // 最大延迟 60 秒
  factor: 2, // 指数基数
  jitter: 0.1, // 10% 抖动
};

// 计算第 N 次退避时间
const delay1 = computeBackoff(policy, 1); // ~1000ms (±10%)
const delay2 = computeBackoff(policy, 2); // ~2000ms (±10%)
const delay3 = computeBackoff(policy, 3); // ~4000ms (±10%)
const delay4 = computeBackoff(policy, 4); // ~8000ms (±10%)
const delay5 = computeBackoff(policy, 5); // ~16000ms (±10%)
const delay6 = computeBackoff(policy, 6); // ~32000ms (±10%)
const delay7 = computeBackoff(policy, 7); // ~60000ms (capped, ±10%)
```

**算法公式：**

```
base = initialMs × factor^(attempt-1)
jitter_offset = base × jitter × random()
delay = min(maxMs, base + jitter_offset)
```

### 4.2 sleepWithAbort()

带中断支持的延迟函数。

```typescript
import { sleepWithAbort } from "openclaw/plugin-sdk/infra-runtime";

const controller = new AbortController();

// 可中断的延迟
await sleepWithAbort(5000, controller.signal);

// 在其他地方中断
controller.abort(); // 立即抛出 Error("aborted")
```

**用途：**

- 实现可取消的重试
- 优雅关闭时快速退出
- 用户中断操作

---

## 5. 错误处理

### 5.1 formatErrorMessage()

格式化错误信息，提取可读的错误描述。

```typescript
import { formatErrorMessage } from "openclaw/plugin-sdk/infra-runtime";

try {
  await riskyOperation();
} catch (error) {
  const message = formatErrorMessage(error);
  console.error(`Operation failed: ${message}`);
}
```

### 5.2 错误分类最佳实践

```typescript
import { formatErrorMessage } from "openclaw/plugin-sdk/infra-runtime";

// 自定义错误分类器
function classifyError(error: unknown, platform: string): ErrorClassification {
  const message = formatErrorMessage(error);

  // HTTP 状态码分类
  if (error instanceof Response) {
    switch (error.status) {
      case 401:
        return { reason: "auth", severity: "severe" };
      case 403:
        return { reason: "blocked", severity: "severe" };
      case 429:
        return { reason: "rate_limit", severity: "retryable" };
      case 500:
        return { reason: "overloaded", severity: "retryable" };
      case 504:
        return { reason: "timeout", severity: "retryable" };
    }
  }

  // 平台特定错误码
  if (platform === "taobao") {
    if (message.includes("isp.session-not-exist")) {
      return { reason: "auth", severity: "severe" };
    }
    if (message.includes("isp.rate-limit-exceeded")) {
      return { reason: "rate_limit", severity: "retryable" };
    }
  }

  return { reason: "unknown", severity: "retryable" };
}

// 在 Retry 中使用
const runner = createRateLimitRetryRunner({
  defaults: { attempts: 3, minDelayMs: 500, maxDelayMs: 30_000, jitter: 0.1 },
  logLabel: "api",
  shouldRetry: (err) => {
    const classified = classifyError(err, "taobao");
    return classified.severity !== "severe";
  },
});
```

---

## 6. 其他实用工具

### 6.1 网络请求工具

```typescript
import { fetch } from "openclaw/plugin-sdk/infra-runtime";

// 使用 SDK 的 fetch（带超时、重试等）
const response = await fetch("https://api.example.com/data", {
  method: "GET",
  headers: { Authorization: `Bearer ${token}` },
});
```

### 6.2 去重工具

```typescript
import { createDedupeCache } from "openclaw/plugin-sdk/infra-runtime";

// 创建去重缓存
const cache = createDedupeCache<string>({ maxAge: 60000 }); // 1 分钟

// 防止重复处理
if (!cache.has(messageId)) {
  cache.set(messageId, "processed");
  await processMessage(messageId);
}
```

### 6.3 环境变量工具

```typescript
import { getEnv, requireEnv } from "openclaw/plugin-sdk/infra-runtime";

// 获取可选环境变量
const apiKey = getEnv("API_KEY");

// 获取必需环境变量（不存在则抛错）
const dbUrl = requireEnv("DATABASE_URL");
```

### 6.4 SSRF 防护

```typescript
import { fetchWithSsrFGuard } from "openclaw/plugin-sdk/infra-runtime";

// 自动防护 SSRF 攻击
const response = await fetchWithSsrFGuard(userProvidedUrl);
```

---

## 7. 最佳实践

### 7.1 重试策略设计原则

**DO ✓**

- 使用 `createRateLimitRetryRunner` 创建策略
- 为不同平台创建定制化配置
- 实现错误分类，区分严重错误和可重试错误
- 使用 Jitter 避免惊群效应
- 尊重服务器的 `retry-after` 建议

**DON'T ✗**

- 为所有错误都重试（可能掩盖真正的问题）
- 设置过长的重试时间（影响用户体验）
- 忽略 Jitter（可能导致同步重试风暴）
- 硬编码重试配置（应该可配置）

### 7.2 配置建议

**速率限制场景（rate limit）：**

```typescript
{
  attempts: 3,
  minDelayMs: 500,      // 快速开始
  maxDelayMs: 30_000,   // 适中的上限
  jitter: 0.1,          // 必须有抖动
}
```

**网络不稳定场景（timeout, overload）：**

```typescript
{
  attempts: 5,          // 更多重试机会
  minDelayMs: 1000,     // 稍长延迟
  maxDelayMs: 60_000,   // 更长的上限
  jitter: 0.2,          // 更大的抖动
}
```

**认证错误场景（auth）：**

```typescript
// 认证错误通常不应重试
shouldRetry: (err) => {
  const classified = classifyError(err);
  return classified.reason !== "auth_permanent";
};
```

### 7.3 测试策略

```typescript
describe("Retry Policy", () => {
  it("should retry rate limit errors", async () => {
    const runner = createMyRetryRunner();
    let attempts = 0;

    const result = await runner(async () => {
      attempts++;
      if (attempts < 2) throw new RateLimitError(429, "Rate limit");
      return "success";
    });

    expect(result).toBe("success");
    expect(attempts).toBe(2);
  });

  it("should not retry severe errors", async () => {
    const runner = createMyRetryRunner();
    let attempts = 0;

    await expect(
      runner(async () => {
        attempts++;
        throw new AuthError("Invalid credentials");
      }),
    ).rejects.toThrow();

    expect(attempts).toBe(1); // 不重试
  });
});
```

---

## 8. 故障排查

### 8.1 常见问题

**问题 1：重试次数过多**

症状：API 调用耗时过长

排查：

```typescript
// 检查配置
console.log("Retry config:", {
  attempts: config.attempts,
  maxDelayMs: config.maxDelayMs,
});

// 启用详细日志
const runner = createRetryRunner({ verbose: true });
```

**问题 2：应该重试的错误没有重试**

症状：偶发性错误直接失败

排查：

```typescript
// 检查 shouldRetry 逻辑
const runner = createRetryRunner({
  shouldRetry: (err) => {
    console.log("Error type:", err.constructor.name);
    console.log("Error message:", formatErrorMessage(err));
    // ...判断逻辑
  },
});
```

**问题 3：重试风暴**

症状：大量请求同时重试

解决：

```typescript
// 确保 Jitter 配置
{
  jitter: 0.1,  // 至少 10% 抖动
}
```

---

## 9. 迁移指南

### 9.1 从自定义重试迁移

**旧代码：**

```typescript
// 自定义重试实现
async function withRetry<T>(fn: () => Promise<T>, maxRetries: number): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await delay(1000 * Math.pow(2, i));
    }
  }
  throw new Error("Unreachable");
}
```

**新代码：**

```typescript
// 使用 SDK
import { retryAsync } from "openclaw/plugin-sdk/infra-runtime";

const result = await retryAsync(fn, {
  attempts: maxRetries,
  minDelayMs: 1000,
  jitter: 0.1, // 新增：避免重试风暴
});
```

### 9.2 优势对比

| 维度            | 自定义实现    | SDK 实现       |
| --------------- | ------------- | -------------- |
| **代码量**      | 15-20 行      | 3-5 行         |
| **Jitter**      | ❌ 无         | ✓ 有           |
| **retry-after** | ❌ 无         | ✓ 有           |
| **日志**        | ❌ 需自己实现 | ✓ 内置         |
| **测试**        | 需自己测试    | ✓ 已验证       |
| **维护**        | 需自己维护    | ✓ 核心团队维护 |

---

## 10. 参考资源

### 10.1 代码示例

- meichao-ecom Retry 策略：`extensions/meichao-ecom/src/infrastructure/retry-policy.ts`
- Discord Retry：`extensions/discord/src/retry.ts`
- Telegram Backoff：`extensions/telegram/src/sendchataction-401-backoff.ts`

### 10.2 源码位置

- Retry 核心：`src/infra/retry.ts`
- Retry 策略：`src/infra/retry-policy.ts`
- Backoff：`src/infra/backoff.ts`
- SDK 入口：`src/plugin-sdk/infra-runtime.ts`

### 10.3 相关文档

- [meichao-ecom 架构优化技术报告](./meichao-ecom-架构优化技术报告.md)
- [meichao-ecom 降级策略](./meichao-ecom-降级策略.md)
- [meichao-ecom 熔断与冷却机制设计](./meichao-ecom-熔断与冷却机制设计.md)

---

**文档版本**: 1.0  
**编写日期**: 2026-04-02  
**维护者**: OpenClaw Team
