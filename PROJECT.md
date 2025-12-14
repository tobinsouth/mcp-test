# MCP QA Testing Platform - Project Overview

> **For Claude:** This document is the single source of truth for understanding this repository. Read this first before making significant changes.

## What This Project Is

A comprehensive QA testing platform for MCP (Model Context Protocol) servers. It validates MCP server implementations through multiple test phases: authentication, protocol conformance, tool quality analysis, and Claude-powered interaction testing.

**Two interfaces:**
1. **CLI** - Headless test execution with JSON configuration
2. **Web** - Interactive UI for configuration and real-time monitoring

---

## Architecture

### Monorepo Structure

```
mcp-qa-platform/
├── packages/
│   ├── types/      # @mcp-qa/types - Shared TypeScript types & Zod schemas
│   ├── core/       # @mcp-qa/core - Auth providers, session stores, utilities
│   ├── runner/     # @mcp-qa/runner - Test phases and orchestration
│   ├── cli/        # @mcp-qa/cli - Command-line interface
│   └── web/        # @mcp-qa/web - Next.js frontend
├── examples/       # Example configurations and test servers
├── docs/           # Additional documentation
├── package.json    # Root (workspaces)
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── turbo.json      # Build orchestration
```

### Dependency Graph

```
         @mcp-qa/types (zero runtime deps except Zod)
                 │
                 ▼
         @mcp-qa/core (auth, utilities)
                 │
        ┌────────┼────────┐
        ▼        ▼        ▼
    runner      cli      web
```

---

## Package Details

### @mcp-qa/types

**Purpose:** Foundational type definitions shared across all packages.

**Key exports:**
- `TestConfigSchema` - Zod schema for test configuration validation
- `TestCheck`, `PhaseResult`, `TestReport` - Result types
- `CheckStatus` - `'SUCCESS' | 'FAILURE' | 'WARNING' | 'SKIPPED' | 'INFO'`

**Structure:**
- `src/config/` - Configuration schemas (auth, phases, server, test-config)
- `src/results/` - Test result types (check, phase-result, report)
- `src/interaction/` - Transcript and expectation types

---

### @mcp-qa/core

**Purpose:** Shared runtime utilities for auth, clients, and helpers.

**Key exports:**
- `TestOAuthProvider` - Implements MCP SDK's `OAuthClientProvider` with check recording
- `createCLIAuthHandler()` - Opens browser, runs local callback server
- `createWebAuthHandler()` - Uses session store + polling for serverless
- `MemorySessionStore`, `RedisSessionStore` - OAuth session stores

**Structure:**
- `src/auth/provider/` - OAuth provider with observability
- `src/auth/handlers/` - CLI and web auth handlers
- `src/auth/session/` - Session stores (memory, Redis)
- `src/client/` - MCP client factory
- `src/utils/` - Token counting, report helpers

**Design principle:** Leverage MCP SDK's `auth()` function for OAuth logic. We only implement `OAuthClientProvider` for state management and check recording.

---

### @mcp-qa/runner

**Purpose:** Core test execution with modular test phases.

**Entry point:** `runTests(configPath, options)` in `src/runner.ts`

**Test Phases:**

| Phase | Purpose | Key Checks |
|-------|---------|------------|
| `auth` | OAuth discovery | PRM (RFC 9728), AS metadata (RFC 8414), PKCE, DCR, CIMD support |
| `protocol` | MCP conformance | Client creation, transport setup, connection, capabilities |
| `tools` | Tool analysis | Tool listing, token counts, quality issues |
| `interaction` | Claude testing | Prompt execution, transcript recording, safety/quality reviews |

**Structure:**
- `src/phases/{auth,protocol,tools,interaction}/` - Each phase is isolated
- `src/runner.ts` - Main orchestration
- `src/config-loader.ts` - Configuration parsing

**Adding a new phase:**
1. Create `src/phases/<phase-name>/`
2. Implement phase runner following existing patterns
3. Register in `src/phases/index.ts`
4. Add config schema in `@mcp-qa/types`

---

### @mcp-qa/cli

**Purpose:** Thin CLI wrapper around runner.

**Entry point:** `src/bin.ts` (shebang entry for bunx/npx)

**Commands:**
- `mcp-qa-cli <config.json>` - Run tests
- `mcp-qa-cli validate <config.json>` - Validate config
- `mcp-qa-cli init` - Generate example config

**Exit codes:** 0 = pass, 1 = fail, 2 = config error, 3 = runtime error

---

### @mcp-qa/web

**Purpose:** Next.js frontend for interactive testing.

**Key routes:**
- `/` - Dashboard
- `/test/[id]` - Test detail view
- `/api/run` - Start test (POST)
- `/api/status` - Progress stream (SSE)
- `/api/oauth/callback` - OAuth callback handler
- `/api/oauth/poll/[runId]` - Poll callback status

**OAuth handling:** Uses session store + state encoding for serverless compatibility. Flow: Runner → Session Store → OAuth Popup → Callback API → Session Store → Runner

**Structure:**
- `app/` - Next.js App Router pages and API routes
- `components/` - React components (config, results, transcript, layout)
- `lib/` - Server-side utilities and hooks

---

## Key Technical Decisions

### OAuth/Auth Strategy

We do NOT implement custom OAuth logic. Instead:
1. `TestOAuthProvider` implements `OAuthClientProvider` from MCP SDK
2. MCP SDK's `auth()` handles the complete OAuth flow
3. `StreamableHTTPClientTransport` with `authProvider` handles automatic auth
4. We record checks during provider callbacks for observability

### Cross-Process OAuth (Web)

Serverless functions can't share memory, so:
1. Runner generates `runId`, stores session in Redis/KV
2. OAuth `state` parameter encodes `runId` for callback identification
3. Callback API updates session store
4. Runner polls session store for completion

### Test Configuration

JSON-based config with Zod validation. Key sections:
- `server` - URL, transport type, headers
- `auth` - Type (none, client_credentials, authorization_code) and credentials
- `phases` - Enable/disable and configure each phase
- `output` - Transcript directory, report path, format

---

## Development

### Prerequisites
- Node.js >= 20.0.0
- pnpm 9.x
- (Optional) Bun for CLI

### Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Build all packages (uses Turborepo)
pnpm dev              # Development mode
pnpm test             # Run tests
pnpm typecheck        # Type check all packages
```

### Build Order

Types → Core → Runner → CLI/Web (Turborepo handles this automatically)

### Environment Variables

```bash
# Required for interaction testing
ANTHROPIC_API_KEY=sk-ant-...

# Required for web in production (serverless OAuth)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# Optional
CLI_CALLBACK_PORT=3456
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Reference Repositories

These are checked out locally for reference patterns:

| Path | Description |
|------|-------------|
| `/typescript-sdk/` | MCP TypeScript SDK - primary dependency |
| `/conformance/` | MCP conformance test suite (github.com/modelcontextprotocol/conformance) |
| `/mcpjam-inspector/` | MCPJam Inspector fork with good testing infrastructure |

---

## Extending the Platform

### Adding a New Test Runner

Create a new package under `packages/`:
1. Import types from `@mcp-qa/types`
2. Import utilities from `@mcp-qa/core`
3. Implement independent phase logic
4. Can be used by CLI and web

### Adding a New Phase

1. Create directory under `packages/runner/src/phases/`
2. Implement `{phase}-phase.ts` with phase runner
3. Add check builders in `checks.ts`
4. Register in `packages/runner/src/phases/index.ts`
5. Add config schema to `packages/types/src/config/phases.ts`

---

## File Quick Reference

| Need to... | Look at... |
|------------|------------|
| Understand config schema | `packages/types/src/config/test-config.ts` |
| Modify auth flow | `packages/core/src/auth/` |
| Add test checks | `packages/runner/src/phases/<phase>/checks.ts` |
| Change CLI output | `packages/cli/src/output/` |
| Add web API routes | `packages/web/app/api/` |
| Add web components | `packages/web/components/` |
