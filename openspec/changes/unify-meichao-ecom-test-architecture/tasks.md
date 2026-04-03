# Implementation Tasks

## 1. Phase 1: 紧急修复

- [x] 1.1 Add "meichao-ecom" to `scripts/lib/plugin-sdk-entrypoints.json` (line 230)
- [x] 1.2 Verify SDK import works: `pnpm test -- extensions/meichao-ecom/src/__tests__/index.test.ts`
- [ ] 1.3 Document that independent vitest 1.6.1 causes tinypool crash
- [ ] 1.4 Create temporary note in `extensions/meichao-ecom/README.md` about wrapper-only testing

## 2. Phase 2: 文件组织 - 单元测试迁移

- [ ] 2.1 Move `src/__tests__/index.test.ts` to `src/index.test.ts`
- [ ] 2.2 Move `src/application/__tests__/AlertService.test.ts` to `src/application/AlertService.test.ts`
- [ ] 2.3 Move `src/application/__tests__/DataPipeline.test.ts` to `src/application/DataPipeline.test.ts`
- [ ] 2.4 Move `src/application/__tests__/DedupeFilter.test.ts` to `src/application/DedupeFilter.test.ts`
- [ ] 2.5 Move `src/application/__tests__/FetchFilter.test.ts` to `src/application/FetchFilter.test.ts`
- [ ] 2.6 Move `src/application/__tests__/FetchProductUseCase.test.ts` to `src/application/FetchProductUseCase.test.ts`
- [ ] 2.7 Move `src/application/__tests__/QuotaService.test.ts` to `src/application/QuotaService.test.ts`
- [ ] 2.8 Move `src/application/__tests__/SearchProductsUseCase.test.ts` to `src/application/SearchProductsUseCase.test.ts`
- [ ] 2.9 Move `src/application/__tests__/ValidateFilter.test.ts` to `src/application/ValidateFilter.test.ts`
- [ ] 2.10 Remove empty `src/__tests__/` directory
- [ ] 2.11 Remove empty `src/application/__tests__/` directory
- [ ] 2.12 Verify all unit tests run: `pnpm test -- extensions/meichao-ecom`

## 3. Phase 2: 文件组织 - 测试工具迁移

- [ ] 3.1 Create `src/helpers/` directory
- [ ] 3.2 Move `test/helpers/stress.ts` to `src/helpers/stress.ts`
- [ ] 3.3 Move `test/helpers/chaos.ts` to `src/helpers/chaos.ts`
- [ ] 3.4 Move `test/helpers/concurrency.ts` to `src/helpers/concurrency.ts`
- [ ] 3.5 Move `test/helpers/assertions.ts` to `src/helpers/assertions.ts`
- [ ] 3.6 Move `test/helpers/stress.test.ts` to `src/helpers/stress.test.ts`
- [ ] 3.7 Move `test/helpers/chaos.test.ts` to `src/helpers/chaos.test.ts`
- [ ] 3.8 Move `test/helpers/concurrency.test.ts` to `src/helpers/concurrency.test.ts`
- [ ] 3.9 Move `test/helpers/assertions.test.ts` to `src/helpers/assertions.test.ts`
- [ ] 3.10 Update import paths in helper test files (relative imports)
- [ ] 3.11 Verify helper tests run: `pnpm test -- extensions/meichao-ecom/src/helpers`

## 4. Phase 2: 文件组织 - 测试数据迁移

- [ ] 4.1 Create `src/fixtures/` directory
- [ ] 4.2 Move `test/fixtures/product-factory.ts` to `src/fixtures/product-factory.ts`
- [ ] 4.3 Move `test/fixtures/product-factory.test.ts` to `src/fixtures/product-factory.test.ts`
- [ ] 4.4 Move `test/fixtures/data-source-factory.ts` to `src/fixtures/data-source-factory.ts`
- [ ] 4.5 Move `test/fixtures/quota-factory.ts` to `src/fixtures/quota-factory.ts`
- [ ] 4.6 Move `test/fixtures/index.ts` to `src/fixtures/index.ts`
- [ ] 4.7 Update import paths in fixture files
- [ ] 4.8 Verify fixture tests run: `pnpm test -- extensions/meichao-ecom/src/fixtures`

## 5. Phase 2: 文件组织 - Mocks 迁移

- [ ] 5.1 Create `src/mocks/` directory (if needed)
- [ ] 5.2 Move all files from `test/mocks/` to `src/mocks/`
- [ ] 5.3 Update import paths in mock files

## 6. Phase 3: Docker Helper 实现

- [ ] 6.1 Create `src/helpers/docker.ts`
- [ ] 6.2 Implement `runDockerCommand()` function with timeout support
- [ ] 6.3 Implement `dockerReady()` function
- [ ] 6.4 Implement `allocatePort()` function
- [ ] 6.5 Implement `startPostgres()` function
- [ ] 6.6 Implement `startRedis()` function
- [ ] 6.7 Implement `stopContainer()` function
- [ ] 6.8 Add TypeScript types: `ExecResult`, `ContainerInfo`
- [ ] 6.9 Add error handling for all Docker operations
- [ ] 6.10 Create unit tests for `src/helpers/docker.test.ts`
- [ ] 6.11 Verify Docker helper works: `pnpm test -- extensions/meichao-ecom/src/helpers/docker.test.ts`

## 7. Phase 3: 集成测试改造

- [ ] 7.1 Create `src/integration/` directory
- [ ] 7.2 Create `src/integration/postgres.test.ts` using spawn docker
- [ ] 7.3 Add `it.runIf(OPENCLAW_MEICHAO_INTEGRATION)` for conditional execution
- [ ] 7.4 Use `startPostgres()` and `stopContainer()` from docker helper
- [ ] 7.5 Create `src/integration/redis.test.ts` using spawn docker
- [ ] 7.6 Add `it.runIf(OPENCLAW_MEICHAO_INTEGRATION)` for conditional execution
- [ ] 7.7 Use `startRedis()` and `stopContainer()` from docker helper
- [ ] 7.8 Test integration tests with environment variable: `OPENCLAW_MEICHAO_INTEGRATION=1 pnpm test -- extensions/meichao-ecom`
- [ ] 7.9 Verify tests skip without environment variable: `pnpm test -- extensions/meichao-ecom`

## 8. Phase 3: 特殊测试处理

- [ ] 8.1 Update `src/helpers/stress.ts` to use environment variable control
- [ ] 8.2 Add `OPENCLAW_MEICHAO_STRESS` environment variable support
- [ ] 8.3 Update `src/helpers/chaos.ts` to use environment variable control
- [ ] 8.4 Add `OPENCLAW_MEICHAO_CHAOS` environment variable support
- [ ] 8.5 Verify stress tests work: `OPENCLAW_MEICHAO_STRESS=1 pnpm test -- extensions/meichao-ecom`
- [ ] 8.6 Verify chaos tests work: `OPENCLAW_MEICHAO_CHAOS=1 pnpm test -- extensions/meichao-ecom`

## 9. Phase 4: 依赖升级与同步

- [x] 9.1 Upgrade `vitest` in `extensions/meichao-ecom/package.json` from `^1.0.0` to `^4.1.2`
- [x] 9.2 Upgrade `@vitest/coverage-v8` in `extensions/meichao-ecom/package.json` from `^1.0.0` to `^4.1.2`
- [x] 9.3 Remove `testcontainers` from `extensions/meichao-ecom/package.json`
- [x] 9.4 Keep test scripts in `extensions/meichao-ecom/package.json` (test, test:chaos, etc.)
- [x] 9.5 Keep benchmark scripts
- [x] 9.6 Run `pnpm install` to update dependencies
- [x] 9.7 Verify extension can run tests independently: `cd extensions/meichao-ecom && pnpm test`
- [x] 9.8 Document version sync strategy in README

## 10. Phase 4: 清理旧文件

- [ ] 10.1 Delete `test/helpers/database.ts` (testcontainers related, replaced by docker helper)
- [ ] 10.2 Update imports in `test/helpers/index.ts` to remove database export
- [ ] 10.3 Keep `test/setup.ts` (for independent testing)
- [ ] 10.4 Keep `test/helpers/` (except database.ts)
- [ ] 10.5 Keep `test/fixtures/` (test data)
- [ ] 10.6 Keep `test/mocks/` (test mocks)
- [ ] 10.7 Keep `test/integration/` directory structure

## 11. 验证和文档

- [x] 11.1 Run full test suite from extension: `cd extensions/meichao-ecom && pnpm test`
- [ ] 11.2 Run full test suite from root: `pnpm test -- extensions/meichao-ecom`
- [ ] 11.3 Run integration tests from extension: `cd extensions/meichao-ecom && OPENCLAW_MEICHAO_INTEGRATION=1 pnpm test`
- [ ] 11.4 Run integration tests from root: `OPENCLAW_MEICHAO_INTEGRATION=1 pnpm test -- extensions/meichao-ecom`
- [ ] 11.5 Run with wrapper: `node scripts/test-parallel.mjs --surface extensions`
- [ ] 11.6 Verify no test files reference old paths
- [ ] 11.7 Verify all imports resolve correctly
- [x] 11.8 Verify vitest version matches root: `cat extensions/meichao-ecom/package.json | grep '"vitest"'`
- [x] 11.9 Update `extensions/meichao-ecom/README.md` with testing instructions
- [x] 11.10 Document environment variables: `OPENCLAW_MEICHAO_INTEGRATION`, `OPENCLAW_MEICHAO_STRESS`, `OPENCLAW_MEICHAO_CHAOS`
- [x] 11.11 Document version sync strategy
- [x] 11.12 Create example commands for running different test types (both independent and wrapper)

## 12. 最终验证

- [ ] 12.1 Verify test files are properly organized (colocated in src/)
- [ ] 12.2 Verify `test/helpers/database.ts` is deleted
- [ ] 12.3 Verify no `src/__tests__/` directories exist
- [x] 12.4 Verify vitest version in package.json matches root (^4.1.2)
- [x] 12.5 Verify extension can run tests independently
- [ ] 12.6 Verify all tests pass with wrapper
- [ ] 12.7 Verify integration tests pass with environment variable
- [ ] 12.8 Verify both independent and wrapper testing work correctly
- [ ] 12.9 Create final commit with all changes

## 13. 可选：文档更新

- [ ] 13.1 Consider adding guidance to AGENTS.md about extension test organization
- [ ] 13.2 Consider creating testing guide for extensions
- [ ] 13.3 Consider fixing nostr/twitch test organization (similar issues)
