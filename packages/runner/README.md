# @mcp-qa/runner

Main QA test runner with modular test phases.

## Purpose

This package provides the core test execution logic:

- **Phase Orchestration** - Run auth, protocol, tools, interaction phases
- **Configuration Loading** - Parse and validate JSON test configs
- **Progress Reporting** - Real-time check notifications
- **Report Generation** - Comprehensive test reports

## Design Principles

1. **Programmatic API** - Can be used as a library, not just via CLI
2. **Modular Phases** - Each phase is independent and testable
3. **Pluggable Auth** - Accepts any `InteractiveAuthHandler`
4. **Resource Cleanup** - Proper connection cleanup after tests

## Structure

```
src/
├── phases/
│   ├── base/
│   │   ├── types.ts             # Phase interface definition
│   │   └── phase-runner.ts      # Base phase utilities
│   │
│   ├── auth/
│   │   ├── auth-phase.ts        # OAuth discovery and validation
│   │   └── checks.ts            # Auth-specific check builders
│   │
│   ├── protocol/
│   │   ├── protocol-phase.ts    # MCP protocol conformance
│   │   └── checks.ts            # Protocol check builders
│   │
│   ├── tools/
│   │   ├── tools-phase.ts       # Tool quality analysis
│   │   └── metrics.ts           # Token counting, quality metrics
│   │
│   ├── interaction/
│   │   ├── interaction-phase.ts # Claude interaction testing
│   │   ├── transcript.ts        # Transcript recorder
│   │   ├── safety-review.ts     # LLM safety policy review
│   │   ├── quality-review.ts    # LLM quality assessment
│   │   └── expectation-eval.ts  # Tool call expectation matching
│   │
│   └── index.ts                 # Phase registry
│
├── runner.ts                    # Main orchestration
├── config-loader.ts             # Configuration loading
└── index.ts                     # Main entry point
```

## Usage

### Programmatic API

```typescript
import { runTests } from '@mcp-qa/runner';
import { createCLIAuthHandler } from '@mcp-qa/core';

const report = await runTests('./config.json', {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  interactive: true,
  onProgress: (phase, check) => {
    console.log(`[${phase}] ${check.name}: ${check.status}`);
  },
});

console.log(`Overall: ${report.overallStatus}`);
```

### Custom Auth Handler

```typescript
import { runTests } from '@mcp-qa/runner';

const report = await runTests('./config.json', {
  anthropicApiKey: 'sk-ant-...',
  interactiveHandler: myCustomHandler,
  onProgress: handleProgress,
});
```

## Test Phases

### 1. Auth Phase
- Discovers Protected Resource Metadata (RFC 9728)
- Discovers Authorization Server Metadata (RFC 8414)
- Validates PKCE, DCR, CIMD support
- Does NOT perform actual auth (deferred to protocol phase)

### 2. Protocol Phase
- Creates MCP client with auth provider
- Establishes connection (auth happens via 401 handling)
- Tests server info and capabilities
- Returns connected client for subsequent phases

### 3. Tools Phase
- Lists available tools
- Analyzes token counts (description + schema)
- Checks for quality issues (missing descriptions, large schemas)
- Reports tool metrics

### 4. Interaction Phase
- Executes test prompts via Claude
- Records full transcripts
- Runs safety policy reviews (LLM-based)
- Runs quality assessments (LLM-based)
- Evaluates against expected tool calls

## Phase Interface

```typescript
interface Phase {
  name: string;
  description: string;
  run(context: PhaseContext): Promise<PhaseResult>;
}

interface PhaseContext {
  config: TestConfig;
  client?: Client;
  provider?: TestOAuthProvider;
  onProgress: (check: TestCheck) => void;
}
```

## Adding New Phases

1. Create directory under `src/phases/`
2. Implement phase runner following existing patterns
3. Register in `src/phases/index.ts`
4. Add configuration schema in `@mcp-qa/types`

## Dependencies

- `@mcp-qa/types`
- `@mcp-qa/core`
- `@modelcontextprotocol/sdk`
- `@anthropic-ai/sdk`
