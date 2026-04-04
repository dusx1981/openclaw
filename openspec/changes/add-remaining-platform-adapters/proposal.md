# Add Remaining Platform Adapters

## Why

meichao-ecom 插件定义了 8 个电商平台，但只实现了 2 个（Taobao, Amazon）。剩余 6 个平台没有 Adapter 实现，导致：

1. **功能不完整**: 无法采集这些平台的产品数据
2. **验证系统受限**: PlatformValidator 无法验证这些平台
3. **商业价值受限**: 用户无法使用完整的平台覆盖

问题严重性: 🟡 P1 - 功能缺失，影响产品完整性

**Why Now**:

- Phase 2 刚完成 Amazon API 实现，建立了清晰的实现模式
- 基础设施已完善（容错系统、事务管理、Redis 优化）
- 测试架构正在统一，是添加新平台的好时机

## What Changes

### 实现范围

| 平台       | 优先级 | API 可用性          | 实现模式        | 工作量 |
| ---------- | ------ | ------------------- | --------------- | ------ |
| 1688       | P0     | ✅ 阿里巴巴开放平台 | 参考 Taobao     | 2-3 天 |
| JD         | P0     | ✅ 京东开放平台     | SDK 封装/自实现 | 2-3 天 |
| Pinduoduo  | P1     | ✅ 拼多多开放平台   | 参考 Taobao     | 2-3 天 |
| Douyin     | P1     | ✅ 抖音电商开放平台 | 参考 Taobao     | 2-3 天 |
| Shopee     | P2     | ✅ Shopee Open API  | SDK 封装/自实现 | 2-3 天 |
| AliExpress | P2     | ✅ 速卖通开放平台   | 参考 Taobao     | 2-3 天 |

**总计**: 12-18 天

### 复用基础设施

> **详见**: `INFRASTRUCTURE.md` "不做什么"清单 (line 336-398)

**核心原则**:

- ✅ 继承 `BasePlatformAdapter` 即可获得所有容错能力
- ❌ 不要重复实现熔断器、降级逻辑、冷却管理、决策日志

**实现模式判断**:

> **详见**: `INFRASTRUCTURE.md` 复用决策树 (line 456-482)

```
有官方 SDK → 封装 SDK (≈100 行)
无官方 SDK → 参考 Taobao API 实现 (≈500 行)
```

### 实现步骤

> **详见**: `INFRASTRUCTURE.md` 新平台 Adapter 实现清单 (line 431-453)

每个平台核心步骤:

1. 创建 Adapter 文件（继承 BasePlatformAdapter）
2. 定义数据源（1-4 个）
3. 创建 API 客户端（SDK 封装或自实现）
4. 实现 doFetchProduct / doSearchProducts
5. 注册到 PlatformRegistry
6. 添加错误映射到 ErrorClassifier

## Capabilities

### New Capabilities

- `platform-adapter-1688`: 1688 平台产品数据采集能力
- `platform-adapter-jd`: 京东平台产品数据采集能力
- `platform-adapter-pinduoduo`: 拼多多平台产品数据采集能力
- `platform-adapter-douyin`: 抖音电商平台产品数据采集能力
- `platform-adapter-shopee`: Shopee 平台产品数据采集能力
- `platform-adapter-aliexpress`: 速卖通平台产品数据采集能力

### Modified Capabilities

- `platform-validation`: 扩展验证系统支持新平台
- `platform-registry`: 注册新平台 Adapter

## Impact

### 新增文件结构

```
extensions/meichao-ecom/src/infrastructure/
├─ api/
│  ├─ alibaba/
│  │  ├─ Alibaba1688ApiClient.ts
│  │  └─ Alibaba1688ProductApi.ts
│  ├─ jd/
│  │  ├─ JDClient.ts
│  │  └─ JDProductApi.ts
│  ├─ pinduoduo/
│  │  ├─ PinduoduoClient.ts
│  │  └─ PinduoduoProductApi.ts
│  ├─ douyin/
│  │  ├─ DouyinClient.ts
│  │  └─ DouyinProductApi.ts
│  ├─ shopee/
│  │  ├─ ShopeeClient.ts
│  │  └─ ShopeeProductApi.ts
│  └─ aliexpress/
│     ├─ AliExpressClient.ts
│     └─ AliExpressProductApi.ts
└─ adapters/
   ├─ Alibaba1688Adapter.ts
   ├─ JDAdapter.ts
   ├─ PinduoduoAdapter.ts
   ├─ DouyinAdapter.ts
   ├─ ShopeeAdapter.ts
   └─ AliExpressAdapter.ts
```

### 修改文件

- `src/infrastructure/classification/ErrorClassifier.ts` - 添加平台错误映射
- `src/infrastructure/retry-policy.ts` - 添加平台重试配置
- `src/application/bootstrap.ts` - 注册新 Adapter
- `.env.example` - 添加平台 API 配置示例
- `INFRASTRUCTURE.md` - 更新平台状态

### 测试文件

每个平台 3 个测试文件：

- `XxxClient.test.ts` (11+ tests)
- `XxxProductApi.test.ts` (12+ tests)
- `XxxAdapter.test.ts` (8+ tests)

## Success Criteria

1. ✅ 所有 6 个平台 Adapter 实现完成
2. ✅ 每个平台测试通过率 > 80%
3. ✅ 所有平台集成到 PlatformRegistry
4. ✅ 错误分类和重试策略配置完整
5. ✅ 文档更新（INFRASTRUCTURE.md, README.md）
6. ✅ 容错系统正常工作（熔断、降级、冷却）

## Dependencies

- 需要各平台开发者账号和 API 凭证
- 可能需要商务合作（API 访问权限）
- 依赖 Phase 1 存储层修复完成 ✅
- 依赖 Phase 2 Amazon API 实现完成 ✅

## Risks and Mitigations

### Risk 1: API 访问权限

**风险**: 部分平台 API 需要企业认证或付费
**缓解**:

- 优先实现开放 API 的平台
- 使用第三方 API 作为备选数据源
- 实现降级策略（爬虫、开放搜索）

### Risk 2: SDK 质量

**风险**: 官方 SDK 可能不稳定或缺少 TypeScript 类型
**缓解**:

- 参考 Taobao 自实现模式
- 创建类型声明文件
- 封装隔离 SDK 问题

### Risk 3: 测试覆盖率

**风险**: 新平台测试可能不完整
**缓解**:

- 参考 Amazon/Taobao 测试模式
- 统一测试工具和 fixtures
- 目标 80%+ 通过率

## Timeline

**Phase 1: 国内平台（1688, JD）**

- Week 1: 1688 实现
- Week 2: JD 实现

**Phase 2: 更多国内平台**

- Week 3: Pinduoduo 实现
- Week 4: Douyin 实现

**Phase 3: 跨境平台**

- Week 5: Shopee 实现
- Week 6: AliExpress 实现

**总计**: 5-6 周

## References

### 关键文档

- **INFRASTRUCTURE.md** - 基础设施能力地图、复用决策树、"不做什么"清单
- **Taobao 实现**: `src/infrastructure/api/taobao/` (558 行)
- **Amazon 实现**: `src/infrastructure/api/amazon/` (260 行)

### 平台 API 文档

- 1688: https://open.1688.com
- JD: https://open.jd.com
- Pinduoduo: https://open.pinduoduo.com
- Douyin: https://developer.open-douyin.com
- Shopee: https://open.shopee.com
- AliExpress: https://developers.aliexpress.com
