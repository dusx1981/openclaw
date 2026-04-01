## Why

当前 Adapter 内的数据源选择逻辑是硬编码的优先级顺序，无法根据成本、时效性、可靠性动态调整。需要一套优雅的策略将官方 API、第三方 API、爬虫智能整合，实现稳定、准确、低成本的数据获取。

## What Changes

- 新增 `SourceSelectionStrategy` 策略模式，统一管理数据源选择
- 支持多种选择策略：`priority`（优先级）、`cost-first`（成本优先）、`reliability-first`（可靠性优先）
- 数据源增加健康度追踪，自动避让不可用源
- 返回结果中标记具体数据来源类型

## Capabilities

### New Capabilities

- `source-selection-strategy`: 数据源选择策略能力，支持配置化的智能选择
- `source-health-tracker`: 数据源健康度追踪能力，自动记录成功/失败率

### Modified Capabilities

- None

## Impact

- `BasePlatformAdapter`: 重构 `fetchWithFailover` 使用策略模式
- `FetchResult`: 增加 `sourceType` 字段 (`official_api` | `third_party_api` | `crawler`)
- `DataSourceConfig`: 增加策略配置项
- `DataSource` 值对象: 增加健康度统计字段