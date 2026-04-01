## Context

现有平台适配器（TaobaoAdapter、AmazonAdapter）实现了数据采集逻辑，包含降级、熔断等可靠性机制。但缺少验证框架来：
- 模块化验证不同平台
- 采集真实数据评估采集效果
- 统一报告格式

当前 `BasePlatformAdapter` 定义了平台网关接口，验证框架需要在此基础上构建。

## Goals / Non-Goals

**Goals:**
- 创建抽象 `PlatformValidator` 基类，定义验证流程模板
- 实现平台特定验证器（TaobaoValidator、AmazonValidator）
- 调用真实适配器采集真实数据（非 Mock）
- 支持统计成功率、降级路径、数据样本
- 统一 CLI 入口支持多平台

**Non-Goals:**
- 不修改现有适配器的采集逻辑
- 不实现自动化调度（定时验证）
- 不实现监控告警系统

## Decisions

### Decision 1: 验证器架构

**选择**: 抽象基类 + 平台实现

```
PlatformValidator (abstract)
├── TaobaoValidator
├── AmazonValidator
└── (future validators...)
```

**理由**:
- 模板方法模式定义统一验证流程
- 平台特定逻辑封装在子类
- 新增平台只需实现新验证器

**备选方案**:
- 单一验证器 + 平台参数 ❌ 代码耦合，难维护
- 完全独立验证器 ❌ 逻辑重复

### Decision 2: 真实数据采集

**选择**: 直接调用现有平台适配器

**理由**:
- 已有完整的采集、降级、熔断逻辑
- 验证真实 API 行为和配置
- 可复用错误分类、冷却管理等机制

### Decision 3: CLI 命令格式

**选择**: `openclaw meichao validate <platform> [options]`

**理由**:
- 平台作为位置参数，直观易用
- 支持批量验证 `--all` 选项
- 与现有命令风格一致

## Risks / Trade-offs

| 风险 | 缓解措施 |
|------|----------|
| 真实采集消耗 API 配额 | 支持配置采集数量限制 |
| 网络不稳定影响验证 | 报告中记录重试和网络状态 |
| 敏感数据泄露 | 支持脱敏输出选项 |