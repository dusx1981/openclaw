## Why

当前缺少模块化的平台验证框架，验证逻辑与平台耦合，无法复用到多个平台。需要一个可扩展的验证框架，支持多平台真实数据采集验证，输出统一的验证报告。

## What Changes

- 新增 `PlatformValidator` 抽象基类，定义验证流程模板
- 为每个平台实现具体的验证器（TaobaoValidator、AmazonValidator 等）
- 验证器调用真实平台适配器采集真实数据（非模拟）
- 支持验证结果统计、样本收集、报告生成
- 统一 CLI 入口 `openclaw meichao validate <platform>`
- 支持批量验证所有平台

## Capabilities

### New Capabilities

- `platform-validator`: 模块化的平台验证框架，包含抽象验证器、统计收集、报告生成器

### Modified Capabilities

- 无现有 capability 需要修改

## Impact

- 新增 `src/validation/` 模块
  - `PlatformValidator.ts` - 抽象验证器基类
  - `TaobaoValidator.ts` - 淘宝验证器
  - `AmazonValidator.ts` - 亚马逊验证器
  - `ValidationStats.ts` - 统计收集
  - `ValidationReport.ts` - 报告生成
- 新增 CLI 命令 `src/commands/validate.ts`
- 复用现有 `BasePlatformAdapter` 和平台适配器