# expose-degradation-params

## Why

当前 meichao-ecom 降级策略的代码实现支持丰富的自定义参数（customOrder、preferredSource、skipSources），但这些参数未在 Tool 层暴露给用户。同时，默认值分散在多处定义，存在不一致问题。还有大量未使用的配置文件和代码造成维护困扰。

用户自定义降级策略的能力受限，代码行为与配置文档不符，增加了调试和维护成本。

## What Changes

### 暴露 Tool 参数

- 在 `product-fetch-tool.ts` 和 `product-search-tool.ts` 中暴露以下参数：
  - `customOrder`: 自定义数据源类型顺序
  - `preferredSource`: 优先使用的数据源 ID
  - `skipSources`: 跳过的数据源 ID 列表

### 统一默认值

- 确定 `types.ts` 为唯一默认值来源
- 移除 `data-source-config.ts` 中的重复默认值定义
- 移除 `degradation.config.ts` 中与 `types.ts` 冲突的默认值

### 清理未使用代码

- 删除或标记未使用的配置文件：
  - `config.default.json`
  - `config.schema.json`
  - `config.example.json`
- 简化 `DegradationPath`，移除 `getConfiguredPath()` 相关代码（因为配置未加载）
- 删除 `src/domain/config-loader.ts`
- 删除 `src/cli/source-config-commands.ts` 及其测试

## Capabilities

### New Capabilities

- `degradation-custom-order`: 支持用户自定义数据源类型降级顺序
- `degradation-preferred-source`: 支持用户指定优先数据源 ID
- `degradation-skip-sources`: 支持用户跳过特定数据源 ID

### Modified Capabilities

- `degradation-defaults`: 统一默认值定义来源，消除不一致

## Impact

### 修改文件

- `src/tools/product-fetch-tool.ts` - 添加参数定义
- `src/tools/product-search-tool.ts` - 添加参数定义
- `src/domain/types.ts` - 确定为默认值唯一来源
- `src/domain/data-source-config.ts` - 移除重复默认值
- `src/infrastructure/config/degradation.config.ts` - 统一默认值引用
- `src/infrastructure/degradation/DegradationPath.ts` - 简化，移除未使用代码

### 删除文件

- `config.default.json`
- `config.schema.json`
- `config.example.json`
- `src/domain/config-loader.ts`
- `src/cli/source-config-commands.ts`
- `src/cli/__tests__/source-config-commands.test.ts`

### 文档更新

- `extensions/meichao-ecom/skills/meichao-ecom/SKILL.md`
- `docs/集成/meichao-ecom-降级配置说明.md`

### 无破坏性变更

- 新增参数为可选参数，不影响现有调用
- 删除的代码未被实际使用
