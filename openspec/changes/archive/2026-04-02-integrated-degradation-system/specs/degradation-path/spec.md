# Capability: Degradation Path

## Overview

管理固定降级路径，基于 DataSource.type 自动排序，支持预设模板和自定义选项。

**核心特性**：

- 固定降级路径（official_api → third_party_api → skill_crawler → open_search）
- 预设模板（standard, cost-optimized, speed-optimized, reliability-first）
- 可配置选项（skipTypes, maxSources, customOrder）
- 平台无关，自动跳过不存在的数据源类型

## Interface

```typescript
/**
 * 降级路径管理器
 */
class DegradationPath {
  /**
   * 核心降级顺序（固定）
   */
  static readonly CORE_ORDER: DataSourceType[] = [
    "official_api",
    "third_party_api",
    "skill_crawler",
    "open_search",
  ];

  /**
   * 预设模板
   */
  static readonly PRESETS: Record<string, DataSourceType[]> = {
    standard: ["official_api", "third_party_api", "skill_crawler", "open_search"],
    "cost-optimized": ["official_api", "skill_crawler", "open_search"],
    "speed-optimized": ["third_party_api", "official_api", "open_search"],
    "reliability-first": ["official_api", "third_party_api"],
  };

  /**
   * 构造函数
   */
  constructor(platform: Platform, sources: DataSource[], config?: PlatformDataSourceConfig);

  /**
   * 获取降级路径
   */
  getPath(options?: DegradationOptions): DataSource[];

  /**
   * 从配置构建（向后兼容）
   */
  static fromConfig(
    platform: Platform,
    sources: DataSource[],
    config: PlatformDataSourceConfig,
  ): DegradationPath;
}

/**
 * 降级选项
 */
interface DegradationOptions {
  // 预设模板
  preset?: "standard" | "cost-optimized" | "speed-optimized" | "reliability-first";

  // 跳过的数据源类型
  skipTypes?: DataSourceType[];

  // 最大数据源数量
  maxSources?: number;

  // 是否允许爬虫（默认 true）
  allowCrawler?: boolean;

  // 是否允许开放搜索（默认 true）
  allowOpenSearch?: boolean;

  // 自定义降级顺序（高级模式）
  customOrder?: DataSourceType[];

  // 验证模式（测试所有数据源，忽略冷却和熔断）
  validateMode?: boolean;
}
```

## Behavior

### getPath() 执行流程

```typescript
getPath(options?: DegradationOptions): DataSource[] {
  // 1. 确定降级顺序（优先级：自定义 > 预设 > 默认）
  let typeOrder: DataSourceType[];

  if (options?.customOrder) {
    // 高级模式：显式配置
    typeOrder = options.customOrder;
  } else if (options?.preset) {
    // 预设模式：选择预设模板
    typeOrder = DegradationPath.PRESETS[options.preset];
  } else {
    // 默认模式：固定降级路径
    typeOrder = DegradationPath.CORE_ORDER;
  }

  // 2. 应用过滤规则
  let filteredTypes = typeOrder.filter(
    type => !options?.skipTypes?.includes(type)
  );

  // 3. 应用 allowCrawler 和 allowOpenSearch
  if (options?.allowCrawler === false) {
    filteredTypes = filteredTypes.filter(t => t !== "skill_crawler");
  }
  if (options?.allowOpenSearch === false) {
    filteredTypes = filteredTypes.filter(t => t !== "open_search");
  }

  // 4. 映射到实际数据源
  const result: DataSource[] = [];
  for (const type of filteredTypes) {
    const source = this.findSourceByType(type);

    if (source && source.isAvailable && source.hasRemainingQuota()) {
      result.push(source);
    }

    // 5. 应用数量限制
    if (options?.maxSources && result.length >= options.maxSources) {
      break;
    }
  }

  return result;
}

/**
 * 根据 type 查找数据源
 */
private findSourceByType(type: DataSourceType): DataSource | null {
  for (const source of this.sources.values()) {
    if (source.type === type) {
      return source;
    }
  }
  return null;
}
```

### 三种模式对比

```
┌──────────────────┬──────────────────┬──────────────────┐
│ 模式             │ 触发条件         │ 降级顺序         │
├──────────────────┼──────────────────┼──────────────────┤
│ 默认模式         │ 无 options       │ CORE_ORDER       │
│                  │                  │ （固定路径）     │
│                  │                  │                  │
│ 预设模式         │ options.preset   │ PRESETS[preset]  │
│                  │                  │ （成本优化等）   │
│                  │                  │                  │
│ 高级模式         │ options.custom   │ customOrder      │
│                  │ Order            │ （完全自定义）   │
└──────────────────┴──────────────────┴──────────────────┘
```

### 使用示例

```typescript
// 方式 1: 默认模式（固定路径）
const path1 = new DegradationPath("taobao", sources);
const sources1 = path1.getPath();
// 返回: [taobao_official_api, taobao_third_party_api, taobao_skill_crawler]

// 方式 2: 预设模式（成本优化）
const sources2 = path1.getPath({ preset: "cost-optimized" });
// 返回: [taobao_official_api, taobao_skill_crawler]
// 跳过 third_party_api（通常更贵）

// 方式 3: 自定义选项
const sources3 = path1.getPath({
  skipTypes: ["skill_crawler"],
  maxSources: 2,
});
// 返回: [taobao_official_api, taobao_third_party_api]

// 方式 4: 从配置构建（向后兼容）
const path2 = DegradationPath.fromConfig("taobao", sources, {
  primary: "taobao_official_api",
  fallbacks: ["taobao_skill_crawler"],
});
const sources4 = path2.getPath();
// 返回: [taobao_official_api, taobao_skill_crawler]
```

## Error Handling

- 无效的 preset → 使用 CORE_ORDER
- 不存在的数据源类型 → 自动跳过
- 空数据源列表 → 返回空数组
- 无效的 customOrder → 使用 CORE_ORDER

## Tests

1. **默认路径**: 无 options → 返回 CORE_ORDER 顺序的数据源
2. **预设模板**: preset="cost-optimized" → 跳过 third_party_api
3. **自定义选项**: skipTypes=["skill_crawler"] → 跳过爬虫
4. **数量限制**: maxSources=2 → 只返回前 2 个
5. **可用性检查**: isAvailable=false → 被跳过
6. **配额检查**: hasRemainingQuota()=false → 被跳过
7. **从配置构建**: fromConfig() → 按配置的 primary + fallbacks
8. **平台特性**: Amazon 没有 open_search → 自动跳过

## Dependencies

- `domain/types.ts` - DataSource, DataSourceType, Platform
- `domain/value-objects/DataSource.ts` - DataSource value object
- `domain/data-source-config.ts` - PlatformDataSourceConfig
