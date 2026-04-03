# Capability: Source Cooldown

## Overview

借鉴 OpenClaw 指数退避冷却机制，为数据源提供智能冷却管理，避免重复请求失败的数据源。

**关键特性**：

- 冷却窗口保持不变（借鉴 OpenClaw）
- 区分临时/严重错误
- 可配置冷却时间
- 自动恢复

## Interface

```typescript
// 冷却状态
interface CooldownState {
  sourceId: string;
  errorCount: number; // 连续错误次数
  lastErrorAt?: number; // 上次错误时间
  lastErrorReason?: DataSourceFailoverReason;
  cooldownUntil?: number; // 冷却结束时间
  lastSuccessAt?: number; // 上次成功时间
}

// 冷却管理器
class CooldownManager {
  constructor(settings?: CooldownSettings);

  // 查询
  isInCooldown(sourceId: string): boolean;
  getCooldownState(sourceId: string): CooldownState | undefined;

  // 更新
  recordFailure(sourceId: string, error: ClassifiedError): void;
  recordSuccess(sourceId: string): void;

  // 管理
  clearCooldown(sourceId: string): void;
}

// 冷却时间配置
interface CooldownSettings {
  // 普通错误冷却时间（分钟）
  normalDurations?: number[]; // 默认 [1, 5, 15, 30]

  // 严重错误冷却时间（小时）
  severeDurations?: number[]; // 默认 [1, 2, 4, 24]

  // 是否启用冷却
  enabled?: boolean; // 默认 true
}
```

## Behavior

### 冷却时间计算

```typescript
// 使用数组索引方式（简化）
private calculateCooldown(error: ClassifiedError, errorCount: number): number {
  const durations = error.isSevere
    ? this.settings.severeDurations.map(h => h * 60 * 60 * 1000)  // 小时转毫秒
    : this.settings.normalDurations.map(m => m * 60 * 1000);      // 分钟转毫秒

  return durations[Math.min(errorCount - 1, durations.length - 1)];
}

// 示例：
// normalDurations = [1, 5, 15, 30]
// errorCount=1 → 1m
// errorCount=2 → 5m
// errorCount=3 → 15m
// errorCount=4 → 30m (最大)
```

### 冷却窗口保持不变（关键）

```typescript
recordFailure(sourceId: string, error: ClassifiedError): void {
  const currentState = this.cooldowns.get(sourceId);
  const now = Date.now();

  // 关键：如果已经在冷却中，不延长冷却时间
  if (currentState?.cooldownUntil && now < currentState.cooldownUntil) {
    this.cooldowns.set(sourceId, {
      ...currentState,
      errorCount: currentState.errorCount + 1,  // 只增加计数
      lastErrorAt: now,
      lastErrorReason: error.reason,
    });
    return;
  }

  // 否则，计算新的冷却时间
  const duration = this.calculateCooldown(error, (currentState?.errorCount ?? 0) + 1);
  this.cooldowns.set(sourceId, {
    sourceId,
    errorCount: (currentState?.errorCount ?? 0) + 1,
    cooldownUntil: now + duration,
    ...
  });
}
```

**理由**（借鉴 OpenClaw）：

- 如果数据源在冷却中，不应该因为新的错误而延长冷却
- errorCount 会累加，影响下次冷却时间的计算
- 避免"冷却时间无限延长"的问题

### 成功后重置

```typescript
recordSuccess(sourceId: string): void {
  this.cooldowns.set(sourceId, {
    sourceId,
    errorCount: 0,
    lastSuccessAt: Date.now(),
    cooldownUntil: undefined,      // 清除冷却
    lastErrorAt: undefined,
    lastErrorReason: undefined,
  });
}
```

### 可配置性

```typescript
// 使用默认配置
const manager1 = new CooldownManager();

// 自定义配置
const manager2 = new CooldownManager({
  normalDurations: [2, 10, 30, 60],   // 2m, 10m, 30m, 60m
  severeDurations: [2, 6, 12, 48],    // 2h, 6h, 12h, 48h
});

// 禁用冷却
const manager3 = new DegradationExecutor({
  cooldownSettings: { enabled: false },
  ...
});
```

## Error Handling

- 无效 sourceId → 返回 undefined
- 冷却时间溢出 → 使用最大值
- disabled cooling → 不记录任何状态

## Tests

1. **首次失败**: errorCount=1 → 1 分钟冷却
2. **连续失败**: errorCount=3 → 15 分钟冷却
3. **严重错误**: billing → 1 小时冷却
4. **成功重置**: 清除所有冷却状态
5. **冷却窗口保持（关键）**:
   - 数据源在冷却中再次失败
   - 不延长冷却时间
   - 只增加 errorCount
6. **自定义配置**: normalDurations=[2,10,30,60] → 2m, 10m, 30m, 60m
7. **禁用冷却**: enabled=false → 不记录冷却状态
8. **清除冷却**: clearCooldown() → 移除冷却状态

## Dependencies

- `failover-error-classification` - ClassifiedError, DataSourceFailoverReason
- `degradation-executor` - DegradationExecutor 使用 CooldownManager

## Notes

**Probe 机制**（P2 阶段可选）：

- 当前阶段不实现 Probe 机制
- 冷却时间已经较短（1m → 30m），可以等待
- 如果需要，可以在 P2 阶段添加 canProbe() 方法
