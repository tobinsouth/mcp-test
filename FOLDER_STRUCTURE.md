# MCP QA Platform - Folder Structure

## Design Principles

1. **Monorepo with Workspaces**: Use pnpm/bun workspaces for shared dependencies and easy cross-package imports
2. **Separation of Concerns**: Each package has a single, clear responsibility
3. **Runner Independence**: Test runners are standalone packages that can be used by CLI, web, or programmatically
4. **Shared Foundation**: Types and core utilities are extracted to avoid duplication
5. **Future Extensibility**: New runners can be added without modifying existing packages

---

## Root Structure

```
mcp-qa-platform/
├── packages/
│   ├── types/                    # @mcp-qa/types - Shared TypeScript types and schemas
│   ├── core/                     # @mcp-qa/core - Shared utilities (auth, client, utils)
│   ├── runner/                   # @mcp-qa/runner - Main QA test runner with phases
│   ├── cli/                      # @mcp-qa/cli - Bun CLI interface
│   └── web/                      # @mcp-qa/web - Next.js frontend
│
├── examples/                     # Example configurations and test setups
│   ├── configs/                  # Example JSON configurations
│   └── servers/                  # Example MCP servers for testing
│
├── docs/                         # Documentation
│
├── package.json                  # Root package.json (workspaces)
├── pnpm-workspace.yaml           # Workspace configuration
├── tsconfig.base.json            # Base TypeScript configuration
├── turbo.json                    # Turborepo config (optional, for build orchestration)
├── .env.example                  # Environment variable template
└── README.md
```

---

## Package Details

### `packages/types` - @mcp-qa/types

Shared TypeScript types and Zod validation schemas. Zero runtime dependencies (except Zod).

```
packages/types/
├── src/
│   ├── config/
│   │   ├── auth.ts               # Auth configuration schemas
│   │   ├── phases.ts             # Phase configuration schemas
│   │   ├── server.ts             # Server configuration schemas
│   │   ├── test-config.ts        # Main TestConfig schema
│   │   └── index.ts              # Re-exports
│   │
│   ├── results/
│   │   ├── check.ts              # TestCheck type and CheckStatus
│   │   ├── phase-result.ts       # PhaseResult type
│   │   ├── report.ts             # TestReport type
│   │   └── index.ts              # Re-exports
│   │
│   ├── interaction/
│   │   ├── transcript.ts         # Transcript types
│   │   ├── expectations.ts       # Expectation and SafetyPolicy types
│   │   └── index.ts
│   │
│   └── index.ts                  # Main entry point
│
├── package.json
└── tsconfig.json
```

**Why separate?**
- Types can be imported by any package without pulling in implementation
- Clear contract between packages
- Single source of truth for schema definitions

---

### `packages/core` - @mcp-qa/core

Shared runtime utilities used by runners and the web platform.

```
packages/core/
├── src/
│   ├── auth/
│   │   ├── provider/
│   │   │   ├── test-oauth-provider.ts    # OAuthClientProvider implementation
│   │   │   └── index.ts
│   │   │
│   │   ├── handlers/
│   │   │   ├── types.ts                  # InteractiveAuthHandler interface
│   │   │   ├── cli-handler.ts            # CLI interactive handler
│   │   │   ├── web-handler.ts            # Web polling-based handler
│   │   │   └── index.ts
│   │   │
│   │   ├── session/
│   │   │   ├── types.ts                  # AuthSession, AuthSessionStore interfaces
│   │   │   ├── memory-store.ts           # In-memory store (dev only)
│   │   │   ├── redis-store.ts            # Redis/Upstash store (production)
│   │   │   └── index.ts
│   │   │
│   │   ├── state-encoding.ts             # OAuth state parameter encoding
│   │   └── index.ts
│   │
│   ├── client/
│   │   ├── factory.ts                    # MCP client factory with auth
│   │   └── index.ts
│   │
│   ├── utils/
│   │   ├── tokens.ts                     # Token counting utilities
│   │   ├── report.ts                     # Report generation helpers
│   │   └── index.ts
│   │
│   └── index.ts                          # Main entry point
│
├── package.json
└── tsconfig.json
```

**Why separate?**
- Auth logic is complex and shared between CLI, web, and runners
- Avoids circular dependencies between runner and web
- Can be tested independently

---

### `packages/runner` - @mcp-qa/runner

The main QA test runner. Contains all test phases and orchestration logic.

```
packages/runner/
├── src/
│   ├── phases/
│   │   ├── base/
│   │   │   ├── types.ts                  # Phase interface definition
│   │   │   ├── phase-runner.ts           # Base phase runner utilities
│   │   │   └── index.ts
│   │   │
│   │   ├── auth/
│   │   │   ├── auth-phase.ts             # Auth discovery phase
│   │   │   ├── checks.ts                 # Auth-specific check builders
│   │   │   └── index.ts
│   │   │
│   │   ├── protocol/
│   │   │   ├── protocol-phase.ts         # Protocol conformance phase
│   │   │   ├── checks.ts                 # Protocol-specific check builders
│   │   │   └── index.ts
│   │   │
│   │   ├── tools/
│   │   │   ├── tools-phase.ts            # Tool quality analysis phase
│   │   │   ├── metrics.ts                # Tool metrics calculation
│   │   │   └── index.ts
│   │   │
│   │   ├── interaction/
│   │   │   ├── interaction-phase.ts      # Claude interaction phase
│   │   │   ├── transcript.ts             # Transcript recorder
│   │   │   ├── safety-review.ts          # LLM safety review
│   │   │   ├── quality-review.ts         # LLM quality review
│   │   │   ├── expectation-eval.ts       # Expectation evaluation
│   │   │   └── index.ts
│   │   │
│   │   └── index.ts                      # Phase registry
│   │
│   ├── runner.ts                         # Main test runner orchestration
│   ├── config-loader.ts                  # Configuration loading and validation
│   └── index.ts                          # Main entry point
│
├── package.json
└── tsconfig.json
```

**Why this structure?**
- Each phase is isolated and can be tested independently
- Easy to add new phases without modifying existing code
- Phase registry allows dynamic phase selection
- Runner can be imported programmatically (not just via CLI)

---

### `packages/cli` - @mcp-qa/cli

Thin CLI wrapper around the runner. Handles terminal-specific concerns.

```
packages/cli/
├── src/
│   ├── commands/
│   │   ├── run.ts                        # Main test run command
│   │   ├── validate.ts                   # Config validation command
│   │   └── init.ts                       # Generate example config
│   │
│   ├── output/
│   │   ├── progress.ts                   # Progress display utilities
│   │   ├── reporter.ts                   # Console report formatting
│   │   └── colors.ts                     # Terminal color helpers
│   │
│   ├── index.ts                          # CLI entry point
│   └── bin.ts                            # #!/usr/bin/env bun shebang entry
│
├── package.json
└── tsconfig.json
```

**Why minimal?**
- CLI is just a user interface, not business logic
- All real work happens in `@mcp-qa/runner`
- Easy to maintain and update independently

---

### `packages/web` - @mcp-qa/web

Next.js frontend for interactive test configuration and monitoring.

```
packages/web/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                          # Dashboard
│   │
│   ├── test/
│   │   └── [id]/
│   │       └── page.tsx                  # Test detail view
│   │
│   └── api/
│       ├── run/
│       │   └── route.ts                  # Start test run
│       │
│       ├── status/
│       │   └── route.ts                  # SSE for progress
│       │
│       └── oauth/
│           ├── callback/
│           │   └── route.ts              # OAuth callback handler
│           └── poll/
│               └── [runId]/
│                   └── route.ts          # Poll for callback status
│
├── components/
│   ├── config/
│   │   ├── ConfigEditor.tsx              # JSON config editor
│   │   ├── AuthConfigForm.tsx            # Auth configuration form
│   │   └── PhaseConfigForm.tsx           # Phase configuration form
│   │
│   ├── results/
│   │   ├── CheckList.tsx                 # Real-time check list
│   │   ├── PhaseResult.tsx               # Phase result display
│   │   └── ReportSummary.tsx             # Overall report summary
│   │
│   ├── transcript/
│   │   └── TranscriptViewer.tsx          # Transcript viewer
│   │
│   └── layout/
│       ├── Header.tsx
│       └── Sidebar.tsx
│
├── lib/
│   ├── runner.ts                         # Server-side runner wrapper
│   ├── session-store.ts                  # Session store factory
│   └── hooks/
│       ├── useTestRun.ts                 # Test run state management
│       └── useOAuthPopup.ts              # OAuth popup handling
│
├── public/
├── package.json
├── next.config.js
└── tsconfig.json
```

**Why this structure?**
- Standard Next.js App Router conventions
- Clear separation between API routes, components, and utilities
- Components organized by feature domain

---

## Future Extensibility

### Adding a New Test Runner

When you need a new runner (e.g., performance testing, fuzz testing):

```
packages/
├── runner/                       # Existing QA runner (rename to qa-runner if desired)
└── perf-runner/                  # New performance test runner
    ├── src/
    │   ├── phases/
    │   │   ├── latency/
    │   │   ├── throughput/
    │   │   └── load/
    │   ├── runner.ts
    │   └── index.ts
    └── package.json
```

New runners:
- Import types from `@mcp-qa/types`
- Import core utilities from `@mcp-qa/core`
- Are completely independent in their phase implementations
- Can be used by CLI and web

### Adding a New Phase to Existing Runner

Add a new directory under `packages/runner/src/phases/`:

```
packages/runner/src/phases/
└── security/                     # New security testing phase
    ├── security-phase.ts
    ├── vulnerability-checks.ts
    └── index.ts
```

Then register in `packages/runner/src/phases/index.ts`.

---

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

---

## Build Configuration

### Root package.json

```json
{
  "name": "mcp-qa-platform",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.4.0"
  }
}
```

### pnpm-workspace.yaml

```yaml
packages:
  - 'packages/*'
  - 'examples/*'
```

### tsconfig.base.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true
  }
}
```

---

## Package Naming Convention

All packages use the `@mcp-qa/` scope:

| Package | Name | Description |
|---------|------|-------------|
| types | `@mcp-qa/types` | Shared types and schemas |
| core | `@mcp-qa/core` | Auth, client, utilities |
| runner | `@mcp-qa/runner` | Main QA test runner |
| cli | `@mcp-qa/cli` | CLI interface |
| web | `@mcp-qa/web` | Next.js frontend |

---

## Environment Variables

```bash
# Required for interaction testing
ANTHROPIC_API_KEY=sk-ant-...

# Required for web platform in production
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# Optional: Alternative Redis
# REDIS_URL=redis://localhost:6379

# Optional: Custom callback port for CLI
CLI_CALLBACK_PORT=3456
```
