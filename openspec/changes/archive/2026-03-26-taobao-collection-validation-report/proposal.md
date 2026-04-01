## Why

当前缺少快速验证淘宝数据采集效果的工具。开发人员需要手动测试采集成功率、降级行为和数据质量，效率低下且难以复现。需要一个自动化验证工具来快速评估采集系统的健康状态和数据质量。

## What Changes

- 新增淘宝数据采集验证命令，支持快速测试采集成功率
- 支持模拟各种故障场景（网络错误、超时、限流）来验证降级流程
- 支持采样数据并展示采集到的商品信息
- 生成包含成功率、降级路径、数据样本的可读报告
- 支持指定采集数量、超时时间等参数

## Capabilities

### New Capabilities

- `taobao-validation`: 淘宝数据采集验证工具，包含成功率测试、降级流程验证、数据采样和报告生成功能

### Modified Capabilities

- 无现有 capability 需要修改

## Impact

- 新增命令行入口 `openclaw meichao validate taobao`
- 扩展 `TaobaoAdapter` 支持验证模式
- 新增验证报告生成模块
- 影响文件:
  - `extensions/meichao-ecom/src/commands/validate.ts`
  - `extensions/meichao-ecom/src/validation/`
  - `extensions/meichao-ecom/src/reports/`