# Capability: Degradation Decision Log

## Overview

借鉴 OpenClaw 决策日志，为降级流程提供结构化日志记录，支持问题排查和统计分析。

## Interface

```typescript
type DegradationDecision =
  | "skip_cooldown_source"      // 跳过冷却中的数据源
  | "probe_cooldown_source"     // 尝试 probe 冷却中的数据源
  | "source_failed"             // 数据源请求失败
  | "source_succeeded"          // 数据源请求成功
  | "fallback_to_stale_cache";  // 降级到过期缓存

interface DegradationDecisionLog {
  // 事件标识
  event: "degradation_decision";
  decision: DegradationDecision;
  
  // 运行上下文
  runId: string;
  timestamp: number;
  
  // 业务标识
  platform: string;
  productId: string;
  
  // 数据源信息
  source: {
    id: string;
    type: "official_api" | "third_party_api" | "crawler";
    priority: number;
  };
  
  // 错误信息 (可选)
  error?: {
    reason: DataSourceFailoverReason;
    message: string;
    status?: number;
    code?: string;
  };
  
  // 冷却信息 (可选)
  cooldown?: {
    errorCount: number;
    cooldownUntil: number;
    willProbe: boolean;
  };
  
  // 性能指标
  latencyMs: number;
  
  // 降级层级 (可选)
  degradationLevel?: number;
}

interface DecisionLogger {
  log(log: DegradationDecisionLog): void;
  getByRunId(runId: string): DegradationDecisionLog[];
  getRecent(limit: number): DegradationDecisionLog[];
  clear(): void;
}
```

## Behavior

### 日志写入

```typescript
function log(log: DegradationDecisionLog): void {
  // 内存存储 (可选持久化)
  this.logs.push(log);
  
  // 结构化输出到标准日志
  console.log(JSON.stringify(log));
}
```

### 按 runId 聚合

```typescript
function getByRunId(runId: string): DegradationDecisionLog[] {
  return this.logs.filter(log => log.runId === runId);
}
```

### 示例日志

```json
{
  "event": "degradation_decision",
  "decision": "source_failed",
  "runId": "run_abc123",
  "timestamp": 1711497600000,
  "platform": "taobao",
  "productId": "item_001",
  "source": {
    "id": "taobao_official_api",
    "type": "official_api",
    "priority": 1
  },
  "error": {
    "reason": "rate_limit",
    "message": "Too Many Requests",
    "status": 429
  },
  "cooldown": {
    "errorCount": 2,
    "cooldownUntil": 1711497900000,
    "willProbe": false
  },
  "latencyMs": 150,
  "degradationLevel": 3
}
```

### 使用场景

**问题排查**:
```bash
# 查看某次运行的所有决策
cat logs/degradation.log | jq 'select(.runId == "run_abc123")'

# 查看所有冷却事件
cat logs/degradation.log | jq 'select(.decision == "skip_cooldown_source")'

# 统计错误原因分布
cat logs/degradation.log | jq '.error.reason' | sort | uniq -c
```

**统计分析**:
```typescript
// 计算平均降级层级
const avgLevel = logs.reduce((sum, log) => 
  sum + (log.degradationLevel ?? 0), 0) / logs.length;

// 计算冷却命中率
const probeSuccessRate = logs
  .filter(log => log.decision === "probe_cooldown_source")
  .filter(log => !log.error)
  .length / logs.filter(log => log.decision === "probe_cooldown_source").length;
```

## Error Handling

- 日志写入失败 → 静默忽略，继续执行
- runId 不存在 → 返回空数组

## Tests

1. **日志写入**: 正确写入并存储
2. **runId 查询**: 返回匹配的日志
3. **JSON 序列化**: 正确序列化所有字段
4. **空 runId**: 返回空数组
5. **最近日志**: 返回最近 N 条
6. **清理**: 清除所有日志

## Dependencies

- `failover-error-classification` - DataSourceFailoverReason 类型