## Context

The meichao-ecom extension (`extensions/meichao-ecom/`) is a complete e-commerce data collection system with:
- Domain models: `Product`, `DataSource`, `Quota` entities and value objects
- Use cases: `FetchProductUseCase`, `SearchProductsUseCase`
- Platform adapters: `TaobaoAdapter`, `AmazonAdapter` with failover support
- Validation framework: `PlatformValidator`, `ValidationReport`
- Storage: PostgreSQL repository, Redis cache provider

Current state: The plugin exports a `plugin` object but uses a custom interface, not `OpenClawPluginDefinition`. No tools or CLI commands are registered with OpenClaw.

## Goals / Non-Goals

**Goals:**
- Register meichao-ecom as a proper OpenClaw plugin using `OpenClawPluginDefinition`
- Expose core capabilities as agent tools callable from any OpenClaw channel
- Add CLI commands for direct invocation without agent
- Provide plugin-sdk surface for type-safe imports
- Support optional configuration (PostgreSQL/Redis connection params)

**Non-Goals:**
- Adding new platforms (douyin, 1688, shopee) - out of scope
- Modifying existing domain logic or use cases
- Adding new API integrations (keep existing Taobao/Amazon)
- Building a web UI (channels already provide UI)

## Decisions

### D1: Use `OpenClawPluginDefinition` format

**Rationale:** Matches the pattern used by other OpenClaw extensions (llm-task, lobster). Provides `register(api)` callback for tool/command registration.

**Alternatives considered:**
- Custom plugin interface: Would not integrate with OpenClaw plugin loader
- Direct registration: Bypasses plugin lifecycle, harder to test

### D2: Three agent tools with focused responsibilities

| Tool | Description | Parameters |
|------|-------------|------------|
| `ecom-product-fetch` | Fetch single product | `platform`, `productId` |
| `ecom-product-search` | Search products | `platform`, `keyword`, `limit?` |
| `ecom-validate-platform` | Run validation | `platform`, `count?` |

**Rationale:** Mirrors existing use cases (`FetchProductUseCase`, `SearchProductsUseCase`, validators). Each tool is independently useful and composable.

**Alternatives considered:**
- Single `ecom` tool with sub-commands: Harder to document, unclear parameter schema
- More granular tools (per-source): Too complex, use cases already aggregate sources

### D3: CLI commands under `meichao` namespace

```
openclaw meichao fetch <platform> <productId>
openclaw meichao search <platform> <keyword>
openclaw meichao validate <platform> [--count N]
```

**Rationale:** Consistent with OpenClaw CLI patterns. Clear namespace prevents conflicts.

### D4: Lazy initialization of adapters

Adapters and connections are initialized on first use, not at plugin registration time.

**Rationale:** Allows plugin to load without PostgreSQL/Redis running. Fails gracefully when tools are invoked without infrastructure.

### D5: Plugin-sdk surface at `openclaw/plugin-sdk/meichao-ecom`

Exports: `OpenClawPluginApi`, `AnyAgentTool`, and helper types.

**Rationale:** Matches pattern used by other extensions (llm-task, feishu, etc.).

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| PostgreSQL/Redis not configured | Tools return helpful error with setup instructions |
| API credentials missing | TaobaoAdapter/AmazonAdapter handle missing creds gracefully |
| Large product datasets | Search results limited to configurable max (default 50) |
| Validation runs long | Timeout support in validation command, async by default for CLI |

## Open Questions

- Should we add a `meichao status` command to check infrastructure health? (Deferred to future change)
- Should tools support batch operations? (No, use composition from agent)