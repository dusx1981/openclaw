# Proposal: Add Missing Platform Adapters

## Problem Statement

当前 meichao-ecom 插件已实现 8 个电商平台（淘宝、亚马逊、抖音、1688、拼多多、京东、Shopee、速卖通），但业务需求覆盖更多平台。

用户需求的完整平台列表：

- ✅ 已实现：淘宝、亚马逊、抖音、1688、拼多多、京东、Shopee、速卖通
- ❌ 未实现：TK (TikTok Shop)、LAZADA、TUME、天猫、淘工厂

## Proposed Solution

实现缺失的 5 个平台 Adapter，复用现有基础设施：

1. **TK (TikTok Shop)** - 抖音海外版电商
   - 独立 API 体系，非抖音国内版
   - 覆盖欧美、东南亚市场

2. **LAZADA** - 阿里系东南亚平台
   - 与 Shopee 竞争的东南亚市场
   - 可参考 1688/速卖通的阿里系实现

3. **TUME** - 跨境电商平台
   - 跨境 B2C/B2B 电商
   - 面向中国供应商出海

4. **天猫** - 淘宝 B2C 子平台
   - 通过淘宝 API 覆盖
   - 需特殊字段映射（品牌授权、旗舰店标识）

5. **淘工厂** - 1688 批发渠道
   - 通过 1688 API 覆盖
   - 需特殊字段映射（工厂直供、定制能力）

## Impact

- **代码量预估**: ≈2000-3000 行
- **测试用例预估**: ≈150 tests
- **开发时间预估**: 2-3 weeks
- **复用**: BasePlatformAdapter 容错系统（1553 行）

## Alternatives Considered

1. **合并到现有平台**: 天猫/淘工厂通过淘宝/1688 Adapter 的配置区分
   - 优点：减少代码量
   - 缺点：平台特性字段难以区分，业务语义不清晰

2. **延迟实现**: 按需实现
   - 优点：减少当前工作量
   - 缺点：无法满足业务需求

## Dependencies

- BasePlatformAdapter (已实现)
- ErrorClassifier (已实现)
- retry-policy (已实现)
- PlatformRegistry (已实现)
