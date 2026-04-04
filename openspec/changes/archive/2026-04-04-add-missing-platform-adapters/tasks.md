# Implementation Tasks

## 设计原则

> **参考**: `add-remaining-platform-adapters` 已完成实现 (8 个平台)

**关键洞察**:

- BasePlatformAdapter 已集成完整容错系统
- ErrorClassifier 只需添加配置
- retry-policy 只需添加配置
- 测试是验证手段，不是独立任务

**实现原则**: 所有 5 个平台独立实现，不复用现有 Adapter 代码

**每个平台**: 5 个任务（配置 + Client + ProductApi + Adapter + 验证）

---

## Phase 1: 基础配置（所有平台共用）

- [x] 1.1 类型定义扩展
  - 更新 `src/domain/types.ts` Platform 类型
  - 添加 5 个新平台标识
  - 更新 PLATFORM_NAMES 和 PLATFORM_CURRENCIES

- [x] 1.2 环境变量配置
  - 更新 `.env.example` 添加所有平台环境变量
  - TikTok Shop, Lazada, TUME 配置
  - 天猫/淘工厂说明复用淘宝/1688配置

- [x] 1.3 错误映射配置
  - 更新 `ErrorClassifier.ts` 的 `PLATFORM_ERROR_MAPPINGS`
  - 添加 5 个平台的错误码映射

- [x] 1.4 重试策略配置
  - 更新 `retry-policy.ts`
  - 添加 5 个平台的重试配置
  - 添加 5 个 createXxxRetryRunner 函数
  - 更新 createPlatformRetryRunner switch case

---

## Phase 2: TikTok Shop 平台实现

- [x] 2.1 配置和依赖管理
- [x] 2.2 创建 TikTokShopClient (220 行 + tests)
- [x] 2.3 创建 TikTokShopProductApi (160 行 + tests)
- [x] 2.4 实现 TikTokShopAdapter (195 行)
- [x] 2.5 验证 (21 tests passing)

---

## Phase 3: Lazada 平台实现

- [x] 3.1 配置和依赖管理
- [x] 3.2 创建 LazadaClient (200 行 + tests)
- [x] 3.3 创建 LazadaProductApi (140 行 + tests)
- [x] 3.4 实现 LazadaAdapter (195 行)
- [x] 3.5 验证 (10 tests passing)

---

## Phase 4: TUME 平台实现

- [x] 4.1 配置和依赖管理
- [x] 4.2 创建 TumeClient (160 行 + tests)
- [x] 4.3 创建 TumeProductApi (120 行 + tests)
- [x] 4.4 实现 TumeAdapter (195 行)
- [x] 4.5 验证 (tests passing)

---

## Phase 5: 天猫 (Tmall) 平台实现

- [x] 5.1 配置和依赖管理
- [x] 5.2 创建 TmallClient (110 行 + tests)
- [x] 5.3 创建 TmallProductApi (included in TmallClient.ts)
- [x] 5.4 实现 TmallAdapter (195 行)
- [x] 5.5 验证 (tests passing)

---

## Phase 6: 淘工厂 (TaoGongChang) 平台实现

- [x] 6.1 配置和依赖管理
- [x] 6.2 创建 TaoGongChangClient (140 行 + tests)
- [x] 6.3 创建 TaoGongChangProductApi (included in TaoGongChangClient.ts)
- [x] 6.4 实现 TaoGongChangAdapter (195 行)
- [x] 6.5 验证 (tests passing)

---

## Phase 7: 最终验证与文档

- [x] 7.1 全量测试
  - 运行所有平台测试: `pnpm test`
  - 验证整体测试通过率 > 80%
  - 验证所有 13 个平台注册成功
  - Result: **214 tests passing**

- [x] 7.2 文档更新
  - 更新 `INFRASTRUCTURE.md`
    - 更新平台状态（全部 ✅）
    - 更新代码行数统计
    - 更新平台列表 (8 → 13)
  - 更新 `README.md`
    - 更新支持平台列表 (13 个)

- [x] 7.3 最终审查
  - Code Review 全部平台实现
  - 安全审查（API 密钥管理）
  - 错误处理审查

---

## Summary

**总计任务**: 32 tasks ✅ COMPLETE

**最终平台列表 (13 个)**:

1. ✅ Taobao (淘宝)
2. ✅ Amazon (亚马逊)
3. ✅ Douyin (抖音)
4. ✅ 1688 (阿里批发)
5. ✅ Shopee (虾皮)
6. ✅ Pinduoduo (拼多多)
7. ✅ JD (京东)
8. ✅ AliExpress (速卖通)
9. ✅ TikTok Shop (TK) - **NEW**
10. ✅ Lazada - **NEW**
11. ✅ TUME - **NEW**
12. ✅ Tmall (天猫) - **NEW**
13. ✅ TaoGongChang (淘工厂) - **NEW**

**测试结果**: 214 tests passing (100%)

**代码量统计**:

- TikTok Shop: ~800 行
- Lazada: ~750 行
- TUME: ~600 行
- Tmall: ~500 行
- TaoGongChang: ~600 行
- 总计新增: ~3250 行
