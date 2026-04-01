# Capability: Failover Error Classification

## Overview

借鉴 OpenClaw `FailoverReason`，为数据采集错误提供统一分类，支持不同错误类型的不同处理策略。

## Interface

```typescript
type DataSourceFailoverReason =
  | "auth"              // 认证失败 (token 过期、签名错误)
  | "auth_permanent"    // 认证永久失效 (账号被封、密钥撤销)
  | "rate_limit"        // 速率限制 (429 Too Many Requests)
  | "overloaded"        // 服务过载 (503 Service Unavailable)
  | "billing"           // 计费问题 (余额不足、套餐过期)
  | "timeout"           // 请求超时
  | "not_found"         // 数据不存在 (404 Not Found)
  | "blocked"           // IP 被封 (403 Forbidden)
  | "captcha"           // 需要验证码
  | "unknown";          // 未知错误

interface ClassifiedError {
  reason: DataSourceFailoverReason;
  originalError: Error;
  message: string;
  status?: number;      // HTTP 状态码
  code?: string;        // 平台特定错误码
  isSevere: boolean;    // 是否严重错误 (需要长冷却)
}

function classifyError(error: unknown): ClassifiedError;

// 严重错误判断
function isSevereError(reason: DataSourceFailoverReason): boolean;
// 返回 true: auth_permanent, billing, blocked
```

## Behavior

### HTTP 状态码映射

| Status | Reason |
|--------|--------|
| 401 | auth |
| 403 | blocked |
| 404 | not_found |
| 429 | rate_limit |
| 503 | overloaded |
| ETIMEDOUT | timeout |
| ECONNREFUSED | unknown |

### 平台错误码映射 (示例)

```typescript
// 淘宝
{ code: "isp.session-not-exist", reason: "auth" }
{ code: "isp.insufficient-isv-permissions", reason: "auth_permanent" }
{ code: "isp.api-service-overloaded", reason: "overloaded" }

// 亚马逊
{ code: "ThrottlingException", reason: "rate_limit" }
{ code: "AccessDenied", reason: "auth" }
```

### 严重错误标记

```typescript
const SEVERE_REASONS: DataSourceFailoverReason[] = [
  "auth_permanent",
  "billing",
  "blocked"
];
```

## Error Handling

- 未知错误类型 → `reason: "unknown"`
- 错误解析失败 → `reason: "unknown"`, 保留原始错误

## Tests

1. **HTTP 401** → `reason: "auth"`
2. **HTTP 403** → `reason: "blocked"`, `isSevere: true`
3. **HTTP 429** → `reason: "rate_limit"`
4. **HTTP 503** → `reason: "overloaded"`
5. **Timeout** → `reason: "timeout"`
6. **平台错误码** → 正确映射
7. **未知错误** → `reason: "unknown"`
8. **严重错误判断** → `isSevereError("auth_permanent") === true`

## Dependencies

- 无外部依赖