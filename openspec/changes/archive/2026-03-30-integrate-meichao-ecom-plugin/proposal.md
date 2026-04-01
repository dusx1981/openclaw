## Why

The meichao-ecom extension is a fully functional cross-border e-commerce data collection system with domain models, use cases, adapters, and validation framework. However, it lacks OpenClaw plugin integration - it cannot be used from the OpenClaw CLI or as agent tools. Users cannot invoke product search, fetch, or validation capabilities through the OpenClaw agent interface.

## What Changes

- Register meichao-ecom as an OpenClaw plugin with proper `OpenClawPluginDefinition` format
- Create agent tools for core capabilities:
  - `ecom-product-fetch`: Fetch product data from platforms (Taobao, Amazon)
  - `ecom-product-search`: Search products by keyword across platforms
  - `ecom-validate-platform`: Run platform validation and get reports
- Create CLI commands for direct invocation:
  - `openclaw meichao fetch <platform> <productId>`
  - `openclaw meichao search <platform> <keyword>`
  - `openclaw meichao validate <platform>`
- Add plugin-sdk surface for meichao-ecom (`openclaw/plugin-sdk/meichao-ecom`)
- Configure plugin schema for PostgreSQL/Redis connection settings

## Capabilities

### New Capabilities

- `meichao-plugin-tools`: Agent tools for e-commerce data collection (fetch, search, validate)
- `meichao-cli-commands`: CLI commands for direct meichao-ecom operations

### Modified Capabilities

(None - this is a new plugin integration, no existing specs are modified)

## Impact

- `extensions/meichao-ecom/index.ts` - Convert to OpenClawPluginDefinition format
- `extensions/meichao-ecom/src/tools/` - New directory with tool implementations
- `extensions/meichao-ecom/src/commands/` - New CLI command implementations
- `src/plugin-sdk/meichao-ecom.ts` - New plugin-sdk surface
- `extensions/meichao-ecom/package.json` - Update dependencies and plugin metadata