# Test Architecture Unification Design

## Context

### Current State

meichao-ecom extension 测试系统处于完全崩溃状态：

```
当前测试架构：
├─ vitest 1.6.1 (独立)
├─ @vitest/coverage-v8 1.6.1
├─ testcontainers 10.0.0
├─ test/ 目录 (独立组织)
│  ├─ setup.ts (14行，未使用)
│  ├─ helpers/ (1681行测试工具)
│  ├─ integration/ (197行)
│  ├─ fixtures/
│  └─ mocks/
└─ src/__tests__/ (测试文件)

运行状态：
❌ Extension 独立运行 → RangeError: tinypool threads conflict
❌ Wrapper 运行     → Cannot find package 'openclaw/plugin-sdk/meichao-ecom'
```

### Industry Best Practices

OpenClaw 其他 84 个 extensions 的测试架构：

```
标准模式 (98.6%)：
├─ 无独立 vitest 依赖
├─ 使用 root vitest 4.1.2 (workspace)
├─ 测试文件在 src/ (colocated)
├─ 无独立 test/ 目录
└─ 继承 root setup.ts

成功案例：
- slack: 66 tests, 0 独立依赖
- discord: 101 tests, 0 独立依赖
- telegram: 78 tests, 0 独立依赖
- openshell: e2e tests with spawn docker
```

### Constraints

1. **版本约束**：OpenClaw 强制使用 vitest 4.x，禁止 threads pool
2. **架构约束**：Wrapper 统一管理所有测试，不支持独立运行
3. **依赖约束**：Extensions 不应引入 vitest 依赖，避免版本冲突
4. **组织约束**：AGENTS.md 要求 colocated pattern (测试与源文件同级)

### Stakeholders

- **开发团队**：需要可运行的测试系统验证代码质量
- **CI/CD**：需要统一的测试流程和覆盖率报告
- **维护者**：需要简化的依赖管理和一致的架构

## Goals / Non-Goals

**Goals:**

1. **让测试可运行** - 解决崩溃和导入失败问题
2. **与最佳实践一致** - 遵循 98.6% extensions 的标准模式
3. **简化维护** - 移除独立依赖，统一配置
4. **保留特殊测试** - 支持集成/压力/混沌测试（通过环境变量控制）
5. **向后兼容** - 测试逻辑不变，只改组织和运行方式

**Non-Goals:**

1. **独立运行能力** - 不支持 `cd extension && pnpm test`
2. **独立配置** - 不保留独立的 vitest.config 或 setup
3. **独立覆盖率** - Extension 不计算独立覆盖率，依赖 root
4. **功能改动** - 不改动测试逻辑本身，只改架构

## Decisions

### Decision 1: Test Organization Pattern

**Choice**: Colocated (测试文件与源文件同级)

**Alternatives Considered**:

- ❌ Separate test/ directory (当前方式)
  - 问题：与 wrapper 不兼容，未被 vitest 使用
  - 问题：与其他 extensions 不一致
- ❌ src/**tests**/ directory
  - 问题：不遵循 colocated 最佳实践
  - 问题：增加目录层级，降低可发现性

**Rationale**:

- ✅ 与 98.6% extensions 一致
- ✅ Wrapper 自动发现
- ✅ 测试与源代码邻近，易于维护
- ✅ 减少目录层级

**Implementation**:

```bash
# 迁移命令
mv src/__tests__/index.test.ts src/
mv src/application/__tests__/*.test.ts src/application/
mv test/helpers/*.ts src/helpers/
mv test/fixtures/*.ts src/fixtures/

# 删除空目录
rmdir src/__tests__
rmdir src/**/__tests__
rmdir test
```

### Decision 2: Integration Test Infrastructure

**Choice**: spawn docker commands (参考 openshell)

**Alternatives Considered**:

- ❌ testcontainers (当前方式)
  - 问题：额外依赖 (10.0.0)
  - 问题：与 wrapper 不兼容
  - 问题：复杂度高
- ❌ Real database instances
  - 问题：环境污染
  - 问题：状态管理复杂
  - 问题：CI 不友好

**Rationale**:

- ✅ 无需额外依赖
- ✅ 简单直接，易于调试
- ✅ 与 wrapper 完全兼容
- ✅ openshell 已验证此模式

**Implementation**:

```typescript
// src/helpers/docker.ts
import { spawn } from "node:child_process";

export async function runDockerCommand(
  args: string[],
  options?: { timeoutMs?: number; allowFailure?: boolean },
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
    // ... 实现参考 openshell/src/backend.e2e.test.ts
  });
}

export async function dockerReady(): Promise<boolean> {
  try {
    const result = await runDockerCommand(["version"], { allowFailure: true });
    return result.code === 0;
  } catch {
    return false;
  }
}

export async function startPostgres(): Promise<ContainerInfo> {
  const result = await runDockerCommand([
    "run",
    "--detach",
    "--rm",
    "-e",
    "POSTGRES_DB=meichao_test",
    "-e",
    "POSTGRES_USER=test",
    "-e",
    "POSTGRES_PASSWORD=test",
    "-p",
    "5432",
    "postgres:16-alpine",
  ]);
  // ... 返回 container ID 和端口映射
}
```

### Decision 3: Conditional Test Execution

**Choice**: `it.runIf(environment variable)`

**Alternatives Considered**:

- ❌ `describe.skip` (当前方式)
  - 问题：不灵活
  - 问题：代码中硬编码条件
- ❌ Separate test files
  - 问题：代码重复
  - 问题：维护负担

**Rationale**:

- ✅ Vitest 原生支持
- ✅ 清晰的条件控制
- ✅ 灵活的运行策略

**Implementation**:

```typescript
// src/integration/postgres.test.ts
const RUN_INTEGRATION = process.env.OPENCLAW_MEICHAO_INTEGRATION === "1";

describe("PostgreSQL Integration", () => {
  it.runIf(RUN_INTEGRATION)("should connect to postgres", { timeout: 60_000 }, async () => {
    if (!(await dockerReady())) return;

    const container = await startPostgres();
    try {
      // 测试逻辑
    } finally {
      await stopContainer(container.id);
    }
  });
});
```

**Environment Variables**:

- `OPENCLAW_MEICHAO_INTEGRATION=1` - 运行集成测试
- `OPENCLAW_MEICHAO_STRESS=1` - 运行压力测试
- `OPENCLAW_MEICHAO_CHAOS=1` - 运行混沌测试

### Decision 4: Dependency Management

**Choice**: Upgrade test dependencies to match root version

**Dependencies to Upgrade**:

```json
{
  "devDependencies": {
    "vitest": "^4.1.2", // ⬆️ 升级
    "@vitest/coverage-v8": "^4.1.2", // ⬆️ 升级
    "testcontainers": "^10.0.0" // ❌ 移除（替代方案：spawn docker）
  }
}
```

**Dependencies to Keep**:

```json
{
  "devDependencies": {
    "@faker-js/faker": "^8.4.0", // ✅ 保留
    "openclaw": "workspace:*", // ✅ 保留
    "typescript": "^5.0.0" // ✅ 保留
  }
}
```

**Rationale**:

- ✅ 保留独立运行能力
- ✅ 版本匹配避免崩溃
- ✅ 移除 testcontainers 简化依赖
- ✅ 开发者可以在 extension 内独立测试

**Version Sync Strategy**:

1. Extension 的 vitest 版本应与 root 保持同步
2. 在 root 升级 vitest 时，同步更新 extension
3. 使用 `^` 版本范围，允许小版本更新
4. CI 检查版本一致性（可选）

**Alternatives Considered**:

- ❌ 移除独立依赖
  - 问题：失去独立运行能力
  - 问题：不符合用户意图
- ❌ 使用 workspace 协议
  - 问题：root vitest 是 devDep，可能不工作
  - 问题：workspace 协议通常用于 runtime deps

## Risks / Trade-offs

### Risk 1: 失去独立运行能力

**Impact**: 无法 `cd extensions/meichao-ecom && pnpm test`

**Mitigation**:

- Wrapper 提供了更好的测试管理
- 可以通过 `pnpm test -- extensions/meichao-ecom` 精确运行
- 可以通过环境变量控制特殊测试
- 好处：与其他 extensions 一致，减少认知负担

### Risk 2: Docker 依赖

**Impact**: 集成测试需要 Docker 运行

**Mitigation**:

- 环境变量控制，默认跳过
- CI 可以选择是否运行
- 本地开发可以灵活控制
- openshell 已验证此模式可行

### Risk 3: 文件迁移可能破坏导入

**Impact**: 相对导入路径可能失效

**Mitigation**:

- 仔细检查所有导入
- 使用 TypeScript 编译器验证
- 逐步迁移，分阶段验证
- 保留旧文件直到验证完成

### Risk 4: Wrapper 并行可能影响特殊测试

**Impact**: 压力/混沌测试可能受干扰

**Mitigation**:

- 使用环境变量单独运行
- `OPENCLAW_MEICHAO_STRESS=1 pnpm test -- extensions/meichao-ecom`
- 或者使用 `--isolate` 参数

### Trade-off 1: 灵活性 vs 一致性

**选择了**: 一致性
**放弃了**: 独立配置和运行的灵活性

**理由**:

- 98.6% extensions 都选择了统一模式
- 一致性带来的简化收益 > 灵活性的收益
- 维护负担显著降低

### Trade-off 2: testcontainers vs spawn

**选择了**: spawn docker
**放弃了**: testcontainers 的高级功能

**理由**:

- 无需额外依赖
- 更简单、更可控
- openshell 验证了可行性
- 我们的需求简单，spawn 足够

## Migration Plan

### Phase 1: 紧急修复 (30分钟)

**目标**: 让测试能运行

1. 添加 SDK entry:

   ```bash
   # 编辑 scripts/lib/plugin-sdk-entrypoints.json
   # 在第 230 行添加 "meichao-ecom"
   ```

2. 验证导入:

   ```bash
   pnpm test -- extensions/meichao-ecom/src/__tests__/index.test.ts
   ```

3. 临时禁用集成测试:
   ```bash
   # 移除 vitest 依赖（避免崩溃）
   # 或者保留但忽略 test/ 目录
   ```

**Rollback**: 回滚 entrypoints.json 改动

### Phase 2: 文件组织 (1-2小时)

**目标**: 统一文件结构

1. 迁移测试文件:

   ```bash
   # src/__tests__ → src/
   mv src/__tests__/index.test.ts src/

   # src/**/__tests__ → src/**
   mv src/application/__tests__/*.test.ts src/application/

   # test/helpers → src/helpers
   mkdir -p src/helpers
   mv test/helpers/*.ts src/helpers/

   # test/fixtures → src/fixtures
   mkdir -p src/fixtures
   mv test/fixtures/*.ts src/fixtures/
   ```

2. 验证测试:
   ```bash
   pnpm test -- extensions/meichao-ecom
   ```

**Rollback**: 保留旧文件，验证通过后再删除

### Phase 3: 集成测试改造 (2-3小时)

**目标**: 用 spawn 替代 testcontainers

1. 创建 Docker helper:

   ```bash
   # 创建 src/helpers/docker.ts
   # 参考 openshell/src/backend.e2e.test.ts
   ```

2. 改造集成测试:

   ```bash
   # 编辑 src/integration/postgres.test.ts
   # 编辑 src/integration/redis.test.ts
   ```

3. 验证集成测试:
   ```bash
   OPENCLAW_MEICHAO_INTEGRATION=1 pnpm test -- extensions/meichao-ecom
   ```

**Rollback**: 保留 testcontainers 版本，创建新的 spawn 版本

### Phase 4: 依赖清理 (30分钟)

**目标**: 移除独立依赖

1. 编辑 package.json:

   ```bash
   # 移除 vitest, @vitest/coverage-v8, testcontainers
   ```

2. 删除 test/ 目录:

   ```bash
   rm -rf test/
   rm -rf src/__tests__/
   ```

3. 最终验证:
   ```bash
   pnpm test -- extensions/meichao-ecom
   node scripts/test-parallel.mjs --surface extensions
   ```

**Rollback**: Git revert 所有改动

## Open Questions

### Q1: 压力/混沌测试如何处理？

**问题**: 这些测试可能需要独立运行或特殊环境

**选项**:

- A. 使用环境变量控制，与 wrapper 并行运行
- B. 创建独立的测试脚本，不通过 vitest
- C. 移除这些测试（如果不需要）

**倾向**: 选项 A，使用环境变量控制

### Q2: 测试工具是否应该提取到共享包？

**问题**: `stress.ts`, `chaos.ts` 等工具可能对其他 extensions 有用

**选项**:

- A. 保留在 meichao-ecom
- B. 提取到 `src/test-utils/` (root)
- C. 创建 `@openclaw/test-helpers` 包

**倾向**: 选项 A，先保留，如果有其他 extensions 需要再提取

### Q3: 是否需要更新 AGENTS.md？

**问题**: AGENTS.md 是否需要明确规定 extension 测试必须用统一模式？

**选项**:

- A. 不需要，这是实现细节
- B. 需要添加明确的指导
- C. 创建专门的测试指南文档

**倾向**: 选项 B，添加一条明确的指导

### Q4: 是否需要为其他 extensions 做同样的事情？

**问题**: nostr 和 twitch 也有 test/ 目录和 setup.ts

**选项**:

- A. 只修复 meichao-ecom
- B. 顺便修复其他两个
- C. 创建通用的修复脚本

**倾向**: 选项 A，先修复 meichao-ecom，其他可以后续处理
