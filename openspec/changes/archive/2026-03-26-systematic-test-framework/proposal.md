## Why

当前 meichao-ecom 测试系统缺乏系统化的故障注入、压力测试和真实集成测试，无法有效验证系统在生产环境中的性能、鲁棒性、可靠性。现有 370 个单元测试仅覆盖正常流程和部分降级场景，无法发现边界条件下的潜在问题。

## What Changes

- 新增混沌工程测试框架：随机故障注入、延迟注入、部分响应模拟
- 新增压力测试套件：持续负载测试、内存泄漏检测、连接池耗尽测试
- 新增真实集成测试：Docker 化 PostgreSQL/Redis 测试环境
- 新增并发竞态测试：熔断器并发、配额并发、缓存并发
- 新增测试工具库：数据工厂、断言助手、Mock 服务器
- 新增性能回归检测：基准测试自动化、性能阈值告警

## Capabilities

### New Capabilities

- `chaos-testing`: 混沌工程测试能力，包括故障注入、延迟注入、网络分区模拟
- `stress-testing`: 压力测试能力，包括持续负载、资源耗尽、边界条件测试
- `integration-testing`: 真实集成测试能力，包括 Docker 化测试环境、真实数据库/缓存测试
- `concurrency-testing`: 并发竞态测试能力，包括熔断器并发、配额竞态、缓存一致性
- `test-utilities`: 测试工具库，包括数据工厂、断言助手、Mock 服务器、性能收集器

### Modified Capabilities

- `data-pipeline`: 扩展基准测试，增加性能回归检测

## Impact

**新增文件**:
- `test/helpers/` - 测试工具库
- `test/fixtures/` - 测试数据工厂
- `test/mocks/` - Mock 实现
- `src/infrastructure/__tests__/chaos.test.ts`
- `src/infrastructure/__tests__/stress.test.ts`
- `src/infrastructure/__tests__/integration/`
- `src/infrastructure/__tests__/concurrency.test.ts`

**配置变更**:
- `vitest.config.ts` - 增加覆盖率阈值
- `docker-compose.test.yml` - 测试环境编排
- `package.json` - 增加测试脚本

**依赖变更**:
- 增加 `testcontainers` 用于 Docker 化测试
- 增加 `faker` 用于测试数据生成