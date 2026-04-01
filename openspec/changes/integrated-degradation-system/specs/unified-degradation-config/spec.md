# Capability: Unified Degradation Config

## Overview

借鉴 OpenClaw `AgentModelConfig` 设计，为数据采集提供简洁且灵活的降级配置格式。

## Interface

```typescript
type SelectionStrategy = "priority" | "cost-first" | "reliability-first";

interface CooldownSettings {
  baseMinutes?: number;        // 基础冷却时间，默认 5
  maxMinutes?: number;         // 最大冷却时间，默认 60
  severeMultiplier?: number;   // 严重错误倍数，默认 12
}

type DataSourceConfig = 
  | string                                    // 简写: "taobao_official_api"
  | {
      primary?: string;                       // 主数据源
      fallbacks?: string[];                    // 备用数据源
      strategy?: SelectionStrategy;            // 选择策略，默认 "priority"
      cooldown?: CooldownSettings;             // 冷却设置
    };

// 默认值解析
function parseDataSourceConfig(config: DataSourceConfig): ResolvedDataSourceConfig;

interface ResolvedDataSourceConfig {
  primary: string;
  fallbacks: string[];
  strategy: SelectionStrategy;
  cooldown: Required<CooldownSettings>;
}
```

## Behavior

### 简写格式

```typescript
// 单数据源，无备用
const config1: DataSourceConfig = "taobao_official_api";
// 等价于
const config1Full: ResolvedDataSourceConfig = {
  primary: "taobao_official_api",
  fallbacks: [],
  strategy: "priority",
  cooldown: { baseMinutes: 5, maxMinutes: 60, severeMultiplier: 12 }
};
```

### 完整格式

```typescript
// 多数据源降级
const config2: DataSourceConfig = {
  primary: "taobao_official_api",
  fallbacks: ["taobao_third_party_api", "taobao_crawler"],
  strategy: "cost-first",
  cooldown: { baseMinutes: 1, maxMinutes: 30 }
};
```

## Error Handling

- 无效数据源 ID → 抛出 `InvalidDataSourceError`
- 空配置 → 使用默认配置

## Tests

1. **简写解析**: `"taobao_official_api"` → 正确解析
2. **完整解析**: `{ primary, fallbacks, strategy, cooldown }` → 正确解析
3. **默认值填充**: 部分字段缺失 → 使用默认值
4. **无效 ID**: 抛出错误
5. **空配置**: 返回默认配置

## Dependencies

- `domain/types.ts` - DataSource 基础类型
- `domain/data-source-config.ts` - 现有数据源配置