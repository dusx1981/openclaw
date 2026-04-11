# Repository Guidelines

- Repo: https://github.com/openclaw/openclaw
- In chat replies, file references must be repo-root relative only (example: `src/telegram/index.ts:80`); never absolute paths or `~/...`.
- Do not edit files covered by security-focused `CODEOWNERS` rules unless a listed owner explicitly asked for the change.

## Build, Lint, Test Commands

### Core Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Type-check + build (required before pushing main for build-affecting changes)
pnpm check            # TypeScript check + lint (run before commits)
pnpm test             # Run all tests (vitest)
pnpm test:coverage    # Run tests with coverage
```

### Running Single Tests

```bash
# Run a specific test file
pnpm test src/commands/onboard-search.test.ts

# Run tests matching a pattern
pnpm test src/commands/onboard-search.test.ts -t "shows registered plugin providers"

# Run tests for changed files (compared to origin/main)
pnpm test:changed

# Run a specific vitest config (for targeted testing)
pnpm test:fast                    # Unit tests only
pnpm test:gateway                 # Gateway tests
pnpm test:channels                # Channel tests
pnpm test:extensions              # Extension tests
```

### Test Environment Variables

```bash
OPENCLAW_VITEST_MAX_WORKERS=1 pnpm test   # Single worker (for debugging/memory issues)
OPENCLAW_VITEST_POOL=forks pnpm test       # Use forks pool instead of threads
OPENCLAW_LIVE_TEST=1 pnpm test:live        # Live tests (real API keys)
```

### Linting & Formatting

```bash
pnpm lint              # Run oxlint
pnpm lint:fix          # Fix lint issues + format
pnpm format            # Format with oxfmt
pnpm format:check      # Check formatting without changes
pnpm tsgo              # TypeScript check (faster native checker)
```

### Pre-commit Hooks

```bash
prek install           # Install pre-commit hooks (runs pnpm check)
FAST_COMMIT=1 git commit  # Skip format + check in hook (use when verifying manually)
```

## Project Structure

```
src/                   # Core source code
  cli/                 # CLI wiring
  commands/            # CLI commands
  plugin-sdk/          # Public plugin SDK (extensions import from here)
  channels/            # Core channel implementations
  plugins/             # Plugin loader, registry, contracts
  gateway/             # Gateway control plane
  agents/              # Agent runtime
  media/               # Media processing pipeline
extensions/            # Bundled plugins (Matrix, Feishu, QQ Bot, etc.)
docs/                  # Documentation (Mintlify)
test/                  # Test setup and utilities
dist/                  # Build output
```

## Code Style Guidelines

### Language & Formatting

- TypeScript (ESM), strict mode, Node 22+
- Formatting/linting: Oxlint + Oxfmt (no Prettier/ESLint)
- Never add `@ts-nocheck`. Fix root causes; only suppress when code is intentionally correct and the rule cannot express it safely.
- Use American English spelling (e.g., "color" not "colour", "behavior" not "behaviour")
- Use **OpenClaw** for product/app headings; `openclaw` for CLI, package, paths, config keys

### Types & Error Handling

- Prefer strict typing; avoid `any`. Use `unknown` or narrow adapters instead.
- Prefer `zod` or existing schema helpers at external boundaries (config, webhooks, API responses).
- Prefer discriminated unions when parameter shape changes runtime behavior.
- Prefer `Result<T, E>`-style outcomes and closed error-code unions for recoverable decisions.
- Do not branch on `error: string` or `reason: string` when a closed code union would work.
- Avoid `?? 0`, empty-string, empty-object, or magic-string sentinels that silently change meaning.

### Imports & Module Boundaries

- **Extension code**: Import only from `openclaw/plugin-sdk/*`, local `api.ts`/`runtime-api.ts`. Never import `src/**` or another extension's `src/**`.
- **Core code**: Never deep-import bundled plugin internals (`extensions/*/src/**`). Use plugin `api.ts` or `src/plugin-sdk/<id>.ts`.
- **Inside extension packages**: Do not import via `openclaw/plugin-sdk/<this-extension>`. Use local barrels (`./api.ts`).
- **Dynamic imports**: Do not mix `await import("x")` and static `import ... from "x"` for the same module. Create `*.runtime.ts` boundaries for lazy loading.
- After refactors touching lazy-loading boundaries, run `pnpm build` and check for `[INEFFECTIVE_DYNAMIC_IMPORT]` warnings.

### Class Design

- Never share class behavior via prototype mutation. Use explicit inheritance/composition (`A extends B extends C`).
- In tests, prefer per-instance stubs over `SomeClass.prototype.method = ...`.

### Comments & File Size

- Add brief comments for tricky or non-obvious logic.
- Keep files under ~700 LOC; split/refactor when it improves clarity.

## Testing Guidelines

- Framework: Vitest with V8 coverage (70% thresholds)
- Tests colocated: `*.test.ts`; e2e: `*.e2e.test.ts`
- Use `sonnet-4.6` and `gpt-5.4` for example model constants in tests
- Clean up timers, env, globals, mocks, sockets, temp dirs in tests
- Do not put `vi.resetModules()` + `await import(...)` in `beforeEach` loops for heavy modules
- Run `pnpm test` before pushing changes to logic

## Plugin Development

### Naming Conventions

- Plugin id must match: `openclaw.plugin.json:id`, folder name, package name (`@openclaw/<id>`)
- Keep `openclaw.install.npmSpec` equal to package name

### Dependencies

- Keep plugin-only deps in extension `package.json`, not root
- Runtime deps go in `dependencies`, not `devDependencies`
- Avoid `workspace:*` in `dependencies` (npm install breaks); put `openclaw` in `devDependencies`/`peerDependencies`

### Config Schema

- `hooks.internal.entries` is canonical hook config; `hooks.internal.handlers` is legacy compatibility
- When retiring config keys, remove from all public surfaces; handle backward compat via migration/doctor

## Architecture Boundaries

| Boundary         | Public Surface                                      | Rule                                                      |
| ---------------- | --------------------------------------------------- | --------------------------------------------------------- |
| Plugin SDK       | `src/plugin-sdk/*`                                  | Extensions must import only from here                     |
| Channels         | `src/channels/**`                                   | Core impl; add seams to Plugin SDK, not direct imports    |
| Providers        | `src/plugins/types.ts`, `src/plugin-sdk/provider-*` | Provider plugins own provider-specific behavior           |
| Gateway Protocol | `src/gateway/protocol/*`                            | Protocol changes are contract changes; version explicitly |
| Config           | Exported types, zod schemas, config metadata        | Keep all public surfaces aligned                          |

## Commit Guidelines

- Use `scripts/committer "<msg>" <file...>` for scoped commits
- Action-oriented commit messages (e.g., `CLI: add verbose flag to send`)
- Do not commit secrets, real phone numbers, or live config values
- Group related changes; avoid bundling unrelated refactors

## Key Reference Files

- Plugin SDK entrypoints: `scripts/lib/plugin-sdk-entrypoints.json`
- Plugin SDK exports: `package.json` exports field
- Vitest config: `vitest.config.ts`, `vitest.shared.config.ts`
- TypeScript config: `tsconfig.json`

## Documentation

- Hosted on Mintlify at docs.openclaw.ai
- Internal links: root-relative, no `.md` suffix (e.g., `[Config](/configuration)`)
- End replies with full `https://docs.openclaw.ai/...` URLs when touching docs
- `docs/zh-CN/**` is auto-generated; edit English docs + glossary instead
