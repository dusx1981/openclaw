# Capability: Source Cooldown

## Overview

借鉴 OpenClaw 指数退避冷却机制，为数据源提供智能冷却管理，避免重复请求失败的数据源。

## Interface

```typescript
interface SourceCooldownState {
  sourceId: string;
  errorCount: number;           // 连续错误次数
  lastErrorAt?: number;         // 上次错误时间
  lastErrorReason?: DataSourceFailoverReason;
  cooldownUntil?: number;       // 冷却结束时间
  lastSuccessAt?: number;       // 上次成功时间
  lastProbeAt?: number;         // 上次 probe 时间
}

interface CooldownManager {
  // 查询
  isInCooldown(sourceId: string): boolean;
  getCooldownState(sourceId: string): SourceCooldownState;
  canProbe(sourceId: string, hasFallback: boolean): boolean;
  
  // 更新
  recordSuccess(sourceId: string): void;
  recordError(sourceId: string, reason: DataSourceFailoverReason): void;
  
  // 配置
  setCooldownSettings(settings: CooldownSettings): void;
}

interface CooldownSettings {
  baseMinutes: number;          // 基础冷却时间
  maxMinutes: number;           // 最大冷却时间
  severeMultiplier: number;    // 严重错误倍数
  probeWindowMinutes: number;   // probe 窗口时间
  probeMinIntervalSeconds: number; // probe 最小间隔
}
```

## Behavior

### 冷却时间计算

```typescript
function calculateCooldownDuration(
  errorCount: number,
  reason: DataSourceFailoverReason,
  settings: CooldownSettings
): number {
  const isSevere = isSevereError(reason);
  const base = isSevere 
    ? settings.baseMinutes * settings.severeMultiplier 
    : settings.baseMinutes;
  const max = isSevere 
    ? settings.maxMinutes * settings.severeMultiplier 
    : settings.maxMinutes;
  
  // 指数退避: base * 5^(errorCount-1)
  const duration = base * Math.pow(5, errorCount - 1);
  return Math.min(max, duration);
}
```

### 成功后重置

```typescript
function recordSuccess(sourceId: string): void {
  state[sourceId] = {
    sourceId,
    errorCount: 0,
    lastSuccessAt: Date.now(),
    // 清除冷却状态
    cooldownUntil: undefined,
    lastErrorAt: undefined,
    lastErrorReason: undefined
  };
}
```

### Probe 条件

```typescript
function canProbe(sourceId: string, hasFallback: boolean): boolean {
  const state = getCooldownState(sourceId);
  
  // 只对冷却中的数据源 probe
  if (!state.cooldownUntil) return false;
  
  // 只在主数据源且有备用时 probe
  if (!isPrimary(sourceId) || !hasFallback) return false;
  
  // 距上次 probe > 最小间隔
  const now = Date.now();
  if (state.lastProbeAt && 
      now - state.lastProbeAt < settings.probeMinIntervalSeconds * 1000) {
    return false;
  }
  
  // 距冷却结束 < probe 窗口 或 已过期
  const timeToCooldownEnd = state.cooldownUntil - now;
  if (timeToCooldownEnd > settings.probeWindowMinutes * 60 * 1000) {
    return false;
  }
  
  return true;
}
```

### 示例

```
普通错误冷却:
  errorCount=1 → 5 分钟
  errorCount=2 → 25 分钟
  errorCount=3 → 125 分钟 → 60 分钟 (最大)
  
严重错误冷却 (blocked):
  errorCount=1 → 60 分钟 (5 * 12)
  errorCount=2 → 300 分钟 → 720 分钟 (最大)
```

## Error Handling

- 无效 sourceId → 返回默认状态
- 冷却时间溢出 → 使用最大值

## Tests

1. **首次错误**: errorCount=1 → 5 分钟冷却
2. **连续错误**: errorCount=3 → 125 分钟 → 截断到 60 分钟
3. **严重错误**: blocked → 60 分钟冷却
4. **成功重置**: 清除所有冷却状态
5. **Probe 条件**: 冷却中 + 主数据源 + 有备用 → 可以 probe
6. **Probe 非条件**: 非主数据源 → 不能 probe
7. **Probe 间隔**: 上次 probe < 30 秒 → 不能 probe
8. **Probe 窗口**: 距冷却结束 > 2 分钟 → 不能 probe

## Dependencies

- `failover-error-classification` - 错误分类
- `unified-degradation-config` - 配置解析