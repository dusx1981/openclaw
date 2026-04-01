## 1. Plugin SDK Surface

- [x] 1.1 Create `src/plugin-sdk/meichao-ecom.ts` with type exports
- [x] 1.2 Export `OpenClawPluginApi`, `AnyAgentTool` types from plugins/types.ts
- [x] 1.3 Add meichao-ecom subpath to package.json exports

## 2. Plugin Entry Point

- [x] 2.1 Convert `extensions/meichao-ecom/index.ts` to `OpenClawPluginDefinition` format
- [x] 2.2 Add `id`, `name`, `description`, `version` fields
- [x] 2.3 Implement `register(api)` function for tool/command registration
- [x] 2.4 Add `configSchema` for PostgreSQL/Redis connection settings (in openclaw.plugin.json)

## 3. Agent Tool: ecom-product-fetch

- [x] 3.1 Create `extensions/meichao-ecom/src/tools/product-fetch-tool.ts`
- [x] 3.2 Define TypeBox schema for parameters (`platform`, `productId`)
- [x] 3.3 Implement `execute()` calling `FetchProductUseCase`
- [x] 3.4 Handle platform validation and error messages
- [x] 3.5 Return structured result with product data or error
- [x] 3.6 Register tool in plugin `register()` function

## 4. Agent Tool: ecom-product-search

- [x] 4.1 Create `extensions/meichao-ecom/src/tools/product-search-tool.ts`
- [x] 4.2 Define TypeBox schema for parameters (`platform`, `keyword`, `limit?`)
- [x] 4.3 Implement `execute()` calling `SearchProductsUseCase`
- [x] 4.4 Apply default limit of 50, validate max 100
- [x] 4.5 Return structured result with product list
- [x] 4.6 Register tool in plugin `register()` function

## 5. Agent Tool: ecom-validate-platform

- [x] 5.1 Create `extensions/meichao-ecom/src/tools/validate-platform-tool.ts`
- [x] 5.2 Define TypeBox schema for parameters (`platform`, `count?`)
- [x] 5.3 Implement `execute()` using `ValidatorRegistry`
- [x] 5.4 Apply default count of 10, validate max 100
- [x] 5.5 Return validation report with stats, degradation, samples
- [x] 5.6 Register tool in plugin `register()` function

## 6. CLI: meichao fetch command

- [x] 6.1 Create `extensions/meichao-ecom/src/cli/fetch-command.ts`
- [x] 6.2 Implement command handler with platform and productId arguments
- [x] 6.3 Add `--json` flag for JSON output
- [x] 6.4 Format output as table for default mode
- [x] 6.5 Handle errors with exit code 1
- [x] 6.6 Register via `api.registerCli()` in plugin

## 7. CLI: meichao search command

- [x] 7.1 Create `extensions/meichao-ecom/src/cli/search-command.ts`
- [x] 7.2 Implement command handler with platform and keyword arguments
- [x] 7.3 Add `--limit` option (default 50)
- [x] 7.4 Add `--json` flag for JSON output
- [x] 7.5 Format results as table with pagination for large results
- [x] 7.6 Register via `api.registerCli()` in plugin

## 8. CLI: meichao validate command

- [x] 8.1 Create `extensions/meichao-ecom/src/cli/validate-command.ts`
- [x] 8.2 Implement command handler with platform argument
- [x] 8.3 Add `--count` option (default 10)
- [x] 8.4 Add `--all` flag to validate all platforms
- [x] 8.5 Add `--json` flag for JSON output
- [x] 8.6 Format output with summary table and details
- [x] 8.7 Register via `api.registerCli()` in plugin

## 9. CLI: meichao platforms command

- [x] 9.1 Create `extensions/meichao-ecom/src/cli/platforms-command.ts`
- [x] 9.2 List all registered platforms from `PlatformRegistry`
- [x] 9.3 Show data source count per platform
- [x] 9.4 Register via `api.registerCli()` in plugin

## 10. Tests

- [x] 10.1 Create `tools/product-fetch-tool.test.ts`
- [x] 10.2 Create `tools/product-search-tool.test.ts`
- [x] 10.3 Create `tools/validate-platform-tool.test.ts`
- [x] 10.4 Create `cli/fetch-command.test.ts`
- [x] 10.5 Create `cli/search-command.test.ts`
- [x] 10.6 Create `cli/validate-command.test.ts`

## 11. Package and Documentation

- [x] 11.1 Update `extensions/meichao-ecom/package.json` with plugin metadata
- [x] 11.2 Add `openclaw` field with `commands: ["meichao"]`
- [x] 11.3 Ensure dependencies include `@sinclair/typebox` for TypeBox schemas
- [x] 11.4 Add tool descriptions for agent discoverability

## 12. Agent Skill

- [x] 12.1 Create `extensions/meichao-ecom/skills/meichao-ecom/SKILL.md` with tool usage guidance