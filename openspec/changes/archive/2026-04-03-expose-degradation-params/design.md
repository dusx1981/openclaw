# expose-degradation-params Design

## Context

### 当前状态

meichao-ecom 插件的降级系统存在以下问题：

1. **参数未暴露**：DegradationOptions 支持 customOrder、preferredSource、skipSources 参数，但 Tool 层未暴露
2. **默认值分散**：默认值在 types.ts、data-source-config.ts、degradation.config.ts 三处定义，存在不一致
3. **死代码**：config.default.json 等配置文件定义了完整的配置体系，但未被加载使用

### 技术栈

- TypeScript (ESM)
- TypeBox 用于参数验证
- Vitest 用于测试

### 约束

- 不引入新依赖
- 保持向后兼容
- 不改变现有 API 行为

## Goals / Non-Goals

**Goals:**

1. 暴露 customOrder、preferredSource、skipSources 参数给用户
2. 统一默认值来源，消除不一致
3. 清理未使用的代码和配置文件

**Non-Goals:**

- 不实现 config.default.json 的加载逻辑
- 不添加 CLI 配置管理命令
- 不改变降级执行的核心逻辑

## Decisions

### D1: 在 Tool 层暴露新参数

**Decision:** 在 TypeBox 参数定义中添加 customOrder、preferredSource、skipSources

**Rationale:**

- 这些参数在 DegradationOptions 中已定义
- DegradationPath.getTypeBasedPath() 已实现对这些参数的处理
- 只需在 Tool 参数定义中添加，无需修改核心逻辑

**Design:**

```typescript
degradation: Type.Optional(
  Type.Object({
    // 现有参数
    preset: Type.Optional(Type.String({ ... })),
    skipTypes: Type.Optional(Type.Array(Type.String(), { ... })),
    maxSources: Type.Optional(Type.Number({ ... })),
    allowCrawler: Type.Optional(Type.Boolean({ ... })),
    allowOpenSearch: Type.Optional(Type.Boolean({ ... })),

    // 新增参数
    customOrder: Type.Optional(
      Type.Array(Type.String(), {
        description: "Custom order of data source types. Options: official_api, third_party_api, skill_crawler, open_search"
      })
    ),
    preferredSource: Type.Optional(
      Type.String({
        description: "Preferred data source ID to use first (e.g., taobao_official_api)"
      })
    ),
    skipSources: Type.Optional(
      Type.Array(Type.String(), {
        description: "Data source IDs to skip in degradation path"
      })
    ),
  })
)
```

**Alternatives Considered:**

- 创建新的高级参数对象：增加复杂度，无必要
- 通过配置文件配置：当前配置文件未生效，需要额外工作

### D2: 统一默认值到 types.ts

**Decision:** types.ts 中的 DEFAULT\_\* 常量为唯一默认值来源

**Rationale:**

- types.ts 是类型定义的核心位置
- 其他地方应该导入并使用这些常量
- 避免重复定义导致不一致

**Changes:**

```
types.ts
├── DEFAULT_CIRCUIT_BREAKER_CONFIG    ← 唯一来源
├── DEFAULT_HEALTH_PROBE_CONFIG       ← 唯一来源
└── (其他默认值)

data-source-config.ts
├── DEFAULT_DATA_COLLECTION_SETTINGS
│   ├── circuitBreaker: DEFAULT_CIRCUIT_BREAKER_CONFIG  ← 引用 types.ts
│   └── healthProbe: DEFAULT_HEALTH_PROBE_CONFIG        ← 引用 types.ts
└── 移除重复定义

degradation.config.ts
├── loadDegradationConfig()
│   └── 使用 types.ts 的 DEFAULT_* 常量
└── 移除 DEFAULT_DEGRADATION_CONFIG 常量（重复定义）
```

**Alternatives Considered:**

- 创建单独的 defaults.ts：增加文件数量，无必要
- 使用环境变量覆盖：当前已支持，不冲突

### D3: 删除未使用的配置文件

**Decision:** 删除 config.default.json、config.schema.json、config.example.json 及相关代码

**Rationale:**

- 这些文件未被任何代码加载
- 配置加载逻辑（config-loader.ts）未实现
- CLI 命令未注册
- 保留这些文件会造成用户困惑

**Files to Delete:**

```
extensions/meichao-ecom/
├── config.default.json          ← 删除
├── config.schema.json           ← 删除
├── config.example.json          ← 删除
└── src/
    ├── domain/
    │   └── config-loader.ts     ← 删除
    └── cli/
        ├── source-config-commands.ts           ← 删除
        └── __tests__/
            └── source-config-commands.test.ts  ← 删除
```

**Alternatives Considered:**

- 保留文件并添加 "未使用" 注释：仍会造成困惑
- 实现 config 加载：工作量大，当前需求不明确

### D4: 简化 DegradationPath

**Decision:** 移除 getConfiguredPath() 相关代码

**Rationale:**

- getConfiguredPath() 依赖 this.config
- this.config 永远是 undefined（bootstrap 未传入）
- 移除死代码，简化逻辑

**Changes:**

```typescript
// 移除前
getPath(options?) {
  if (this.config && !options?.customOrder && !options?.preset) {
    return this.getConfiguredPath(options);  // 永远不执行
  }
  return this.getTypeBasedPath(options);
}

// 移除后
getPath(options?) {
  return this.getTypeBasedPath(options);
}
```

**Removed:**

- `getConfiguredPath()` 方法
- `getConfiguredSourceIds()` 方法
- `this.config` 属性

## Risks / Trade-offs

### 风险 1: 参数误用

用户可能传入无效的数据源类型或 ID

**Mitigation:**

- 在参数描述中明确列出有效选项
- DegradationPath.validateCustomOrder() 已有验证逻辑
- 无效输入会回退到 CORE_ORDER

### 风险 2: 删除代码后发现需要

删除配置文件后，未来可能需要重新实现

**Mitigation:**

- 保留设计文档记录配置格式
- Git 历史保留删除的代码
- 可以从 Git 历史恢复

### Trade-off: 灵活性 vs 简洁性

删除 config.default.json 后，用户无法通过配置文件定义默认降级路径

**Acceptance:**

- 运行时参数已足够灵活
- preset 模板覆盖常见场景
- 减少维护负担的价值更大

## Migration Plan

### Phase 1: 暴露参数（向后兼容）

1. 修改 product-fetch-tool.ts 和 product-search-tool.ts
2. 添加参数定义和描述
3. 验证参数正确传递

### Phase 2: 统一默认值

1. 确认 types.ts 中的默认值正确
2. 更新其他文件的引用
3. 移除重复定义

### Phase 3: 清理代码

1. 删除未使用的配置文件
2. 删除未使用的代码
3. 简化 DegradationPath
4. 更新文档

### Rollback

如果发现问题，可以：

1. 回滚 Git commit
2. 或单独修复问题

## Open Questions

1. **是否需要验证 preferredSource 和 skipSources 的值？**
   - 当前实现：无效 ID 会被忽略，不影响降级
   - 建议：保持当前行为，不添加严格验证

2. **是否需要更新 SKILL.md 文档？**
   - 是，需要添加新参数的说明和使用示例
