# Packages

This directory contains all the packages for the MCP QA Platform monorepo.

## Package Overview

| Package | Name | Description |
|---------|------|-------------|
| [types](./types/) | `@mcp-qa/types` | Shared TypeScript types and Zod schemas |
| [core](./core/) | `@mcp-qa/core` | Auth providers, session stores, MCP client, utilities |
| [runner](./runner/) | `@mcp-qa/runner` | Main test runner with pluggable phases |
| [cli](./cli/) | `@mcp-qa/cli` | CLI interface for standalone use with Bun |
| [web](./web/) | `@mcp-qa/web` | Next.js interactive frontend |

## Dependency Graph

```
                    ┌─────────────────┐
                    │  @mcp-qa/types  │
                    │   (no deps)     │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  @mcp-qa/core   │
                    │  (auth, utils)  │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
     ┌────────────┐  ┌────────────┐  ┌────────────┐
     │   runner   │  │   cli      │  │   web      │
     │  (phases)  │  │  (thin UI) │  │ (Next.js)  │
     └────────────┘  └──────┬─────┘  └──────┬─────┘
              │             │               │
              └─────────────┴───────────────┘
                            │
                            ▼
                   Uses runner package
```

## Build Order

Packages must be built in dependency order:

```bash
# 1. Types first (no dependencies)
pnpm --filter @mcp-qa/types build

# 2. Core (depends on types)
pnpm --filter @mcp-qa/core build

# 3. Runner (depends on types, core)
pnpm --filter @mcp-qa/runner build

# 4. CLI and Web (depend on runner)
pnpm --filter @mcp-qa/cli build
pnpm --filter @mcp-qa/web build

# Or build all with turbo (handles order automatically)
pnpm build
```

## Development

```bash
# Run all packages in dev mode
pnpm dev

# Run specific package
pnpm --filter @mcp-qa/web dev

# Run tests
pnpm test

# Type check all packages
pnpm typecheck
```

## Adding a New Package

1. Create directory under `packages/`
2. Add `package.json` with appropriate name (`@mcp-qa/...`)
3. Add `tsconfig.json` extending `../../tsconfig.base.json`
4. Add package to `pnpm-workspace.yaml` if not using glob
5. Add build task to `turbo.json` if needed
