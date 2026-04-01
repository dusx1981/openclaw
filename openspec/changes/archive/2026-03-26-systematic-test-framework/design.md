## Context

当前 meichao-ecom 测试系统状态：
- 370 个单元测试，覆盖率约 70%
- 基准测试仅覆盖管道组件性能
- 所有集成测试使用 Mock，无真实外部依赖测试
- 无混沌工程、压力测试、竞态条件测试

**约束**:
- 测试需在 CI 环境中运行（无 root 权限）
- 测试需支持本地开发和 CI 自动化
- 测试不能影响生产环境

## Goals / Non-Goals

**Goals:**
- 建立混沌工程测试能力，验证系统在故障下的鲁棒性
- 建立压力测试能力，验证系统性能边界和资源使用
- 建立真实集成测试，验证与 PostgreSQL/Redis 的实际交互
- 建立并发竞态测试，验证并发安全性
- 建立测试工具库，提高测试开发效率

**Non-Goals:**
- 不做生产环境混沌测试
- 不做分布式系统测试（单机场景）
- 不做安全渗透测试

## Decisions

### Decision 1: 混沌测试框架设计

**选择**: 使用 Vitest + 自定义 Chaos 助手

```
┌─────────────────────────────────────────────────────────────────┐
│                      Chaos Testing Framework                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Chaos.injectLatency(ms)         - 注入延迟                      │
│  Chaos.injectFailure(rate)       - 注入随机失败                  │
│  Chaos.injectPartialResponse()   - 注入部分响应                  │
│  Chaos.injectNetworkError()      - 注入网络错误                  │
│  Chaos.injectTimeout()           - 注入超时                      │
│  Chaos.injectMemoryPressure()    - 注入内存压力                  │
│                                                                  │
│  ChaosScenario                   - 场景组合                       │
│  └── sequential([latency, failure])                              │
│  └── random([latency, failure, timeout])                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**理由**: Vitest 已有良好的 Mock 支持，自定义 Chaos 助手可复用现有测试结构

### Decision 2: 压力测试设计

**选择**: 分层压力测试

```
Layer 1: 单组件压力测试
    - 验证单个组件在高负载下的表现
    - 识别性能瓶颈

Layer 2: 集成压力测试
    - 验证组件组合的性能
    - 测试资源竞争

Layer 3: 端到端压力测试
    - 模拟真实用户负载
    - 验证整体系统容量
```

**指标收集**:
- 吞吐量 (requests/second)
- 延迟分布 (p50, p95, p99)
- 资源使用 (CPU, Memory, Connections)
- 错误率

**理由**: 分层测试便于定位性能瓶颈

### Decision 3: 集成测试环境

**选择**: Docker + testcontainers

```yaml
# docker-compose.test.yml
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: meichao_test
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    ports:
      - "5433:5432"

  redis:
    image: redis:7
    ports:
      - "6380:6379"
```

**理由**: testcontainers 提供隔离的测试环境，支持并行测试

### Decision 4: 测试数据工厂

**选择**: Factory 模式 + Faker

```typescript
// test/fixtures/product-factory.ts
export const ProductFactory = {
  create: (overrides = {}) => ({
    platform: "taobao",
    platformId: faker.string.uuid(),
    title: faker.commerce.productName(),
    price: faker.number.float({ min: 1, max: 10000 }),
    // ... 默认值
    ...overrides,
  }),
  
  createList: (count: number, overrides = {}) => 
    Array.from({ length: count }, () => this.create(overrides)),
};
```

**理由**: Factory 模式灵活，Faker 提供真实感数据

### Decision 5: 测试组织结构

**选择**: 按测试类型分层

```
extensions/meichao-ecom/
├── test/
│   ├── setup.ts              # 全局设置
│   ├── fixtures/             # 数据工厂
│   │   ├── product-factory.ts
│   │   └── index.ts
│   ├── helpers/              # 测试助手
│   │   ├── chaos.ts
│   │   ├── assertions.ts
│   │   └── database.ts
│   └── mocks/                # Mock 实现
│       └── mock-server.ts
├── src/
│   └── infrastructure/
│       └── __tests__/
│           ├── chaos.test.ts          # 混沌测试
│           ├── stress.test.ts         # 压力测试
│           ├── concurrency.test.ts    # 并发测试
│           └── integration/           # 集成测试
│               ├── postgres.test.ts
│               └── redis.test.ts
```

**理由**: 清晰的测试组织，便于维护和扩展

## Risks / Trade-offs

**Risk 1**: 集成测试增加 CI 运行时间
→ Mitigation: 使用 `--run` 模式，标记慢测试为 `@slow`

**Risk 2**: Docker 环境在 CI 中不稳定
→ Mitigation: 增加重试机制，使用固定端口

**Risk 3**: 混沌测试可能掩盖真实问题
→ Mitigation: 使用种子随机，记录测试场景

**Trade-off**: 不使用专业混沌工具 (Chaos Mesh)
→ 可接受：单机测试场景足够，专业工具增加运维复杂度