# Unify Meichao-Ecom Test Architecture

## Why

meichao-ecom extension 的测试系统完全崩溃，无法运行任何测试。根本原因是使用了独立且不兼容的 vitest 1.x，而 OpenClaw 使用统一的 vitest 4.x。这导致：

1. **Extension 独立运行崩溃**：`vitest 1.6.1` 的 tinypool 配置逻辑与 forks pool 不兼容，导致 `RangeError: options.minThreads and options.maxThreads must not conflict`
2. **Wrapper 运行失败**：`openclaw/plugin-sdk/meichao-ecom` 未注册到 `plugin-sdk-entrypoints.json`，导致 vitest 无法解析导入
3. **与最佳实践不一致**：其他 98.6% (84/85) 的 extensions 都使用统一的测试架构，无独立 vitest 依赖

问题严重性：🔴 P0 - 测试完全无法运行，无法验证代码质量

**Why Now**: 测试系统崩溃阻塞了所有后续开发和质量保障工作，必须立即修复才能恢复正常的开发流程。

## What Changes

### Phase 1: 紧急修复（立即）

- 添加 `meichao-ecom` 到 `plugin-sdk-entrypoints.json`，修复 SDK 导入
- 升级 `vitest ^1.0.0` → `^4.1.2`，匹配 root 版本
- 升级 `@vitest/coverage-v8 ^1.0.0` → `^4.1.2`，匹配 root 版本
- 移除 `testcontainers ^10.0.0` 依赖，改用 spawn docker

### Phase 2: 文件组织统一

- 迁移 `src/__tests__/*.test.ts` → `src/*.test.ts` (colocated pattern)
- 迁移 `test/helpers/` → `src/helpers/` (测试工具)
- 迁移 `test/fixtures/` → `src/fixtures/` (测试数据)
- 迁移 `test/mocks/` → `src/mocks/` (mocks)
- 删除无用的 `test/setup.ts`

### Phase 3: 集成测试改造

- 创建 `src/helpers/docker.ts` (spawn wrapper)，替代 testcontainers
- 改造 `postgres.test.ts` 和 `redis.test.ts` 使用 spawn docker
- 使用 `it.runIf(OPENCLAW_MEICHAO_INTEGRATION)` 条件运行
- 定义环境变量规范：`OPENCLAW_MEICHAO_INTEGRATION`, `OPENCLAW_MEICHAO_STRESS`, `OPENCLAW_MEICHAO_CHAOS`

### Phase 4: 依赖升级与同步

- 升级所有独立测试依赖到 4.x，与 root 版本匹配
- 保留独立测试脚本
- 维护版本同步策略

**保留独立测试能力**: 可以继续使用 `cd extensions/meichao-ecom && pnpm test` 独立运行测试

## Capabilities

### New Capabilities

- `docker-test-helper`: Docker 容器管理辅助函数，使用 spawn 替代 testcontainers，支持 postgres/redis 等容器的启动、停止和健康检查
- `test-organization`: Extension 测试文件组织规范，colocated pattern (测试文件与源文件同级)，测试工具和数据统一放在 `src/helpers/` 和 `src/fixtures/`

### Modified Capabilities

无。这是新增能力，不修改现有 spec 级别的要求。

## Impact

### 新增文件

- `src/helpers/docker.ts` - Docker 容器管理辅助函数
- `src/helpers/stress.ts` (从 test/helpers/ 迁移)
- `src/helpers/chaos.ts` (从 test/helpers/ 迁移)
- `src/helpers/concurrency.ts` (从 test/helpers/ 迁移)
- `src/helpers/assertions.ts` (从 test/helpers/ 迁移)
- `src/fixtures/*.ts` (从 test/fixtures/ 迁移)
- `src/mocks/*` (从 test/mocks/ 迁移)

### 修改文件

- `scripts/lib/plugin-sdk-entrypoints.json` - 添加 "meichao-ecom"
- `extensions/meichao-ecom/package.json` - 升级测试依赖版本
- `extensions/meichao-ecom/test/integration/postgres.test.ts` - 改用 spawn docker
- `extensions/meichao-ecom/test/integration/redis.test.ts` - 改用 spawn docker
- 57 个测试文件从 `src/__tests__/` 迁移到 `src/` 同级

### 删除文件

- `test/helpers/database.ts` (testcontainers 相关，改用 docker helper)
- `src/__tests__/` 目录
- `src/**/__tests__/` 目录

### 保留文件

- `test/setup.ts` (保留独立 setup)
- `test/helpers/` (除 database.ts 外的其他工具)
- `test/fixtures/` (测试数据)
- `test/mocks/` (测试 mocks)

### 依赖变更

- ⬆️ 升级 `vitest ^1.0.0` → `^4.1.2`
- ⬆️ 升级 `@vitest/coverage-v8 ^1.0.0` → `^4.1.2`
- ❌ 移除 `testcontainers ^10.0.0`

### 运行方式

- ✅ **独立运行**: `cd extensions/meichao-ecom && pnpm test` (升级后正常工作)
- ✅ **Wrapper 运行**: `pnpm test -- extensions/meichao-ecom` (wrapper 管理，正常工作)
- ✅ **集成测试**: `OPENCLAW_MEICHAO_INTEGRATION=1 pnpm test` (包含集成测试)

### 改进

- 保留独立运行测试的能力
- 版本匹配后，两种运行方式都正常工作
- 集成测试通过环境变量灵活控制

### 兼容性

- ✅ 向后兼容：测试逻辑不变，只是组织方式和运行方式改变
- ✅ 与其他 extensions 一致：遵循 98.6% extensions 的最佳实践
- ✅ Wrapper 自动管理：无需手动配置

### 质量保障

- 测试覆盖率通过 root vitest coverage 计算
- 与其他 extensions 一起进行 CI 验证
- 统一的质量标准和覆盖率阈值
