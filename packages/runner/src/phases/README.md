# Test Phases

This directory contains the modular test phase implementations.

## Phase Architecture

Each phase:
1. Receives context from the runner (config, client, provider)
2. Executes its tests, emitting checks via `onProgress`
3. Returns a `PhaseResult` with summary statistics
4. Optionally provides a `cleanup` function for resource management

## Adding a New Phase

1. Create a new directory under `phases/`
2. Implement the phase following the pattern below
3. Register in `phases/index.ts`
4. Add configuration schema in `@mcp-qa/types`

### Phase Structure

```
my-phase/
├── my-phase.ts      # Main phase runner
├── checks.ts        # Check builder utilities
└── index.ts         # Exports
```

### Implementation Pattern

```typescript
// my-phase.ts
import type { TestCheck, PhaseResult } from '@mcp-qa/types';

export async function runMyPhase(
  context: PhaseContext
): Promise<PhaseResult> {
  const checks: TestCheck[] = [];
  const startTime = new Date().toISOString();
  const startMs = Date.now();

  const pushCheck = (check: TestCheck) => {
    checks.push(check);
    context.onProgress?.(check);
  };

  // Run your tests...
  pushCheck({
    id: 'my-check-1',
    name: 'My Check',
    description: 'Checking something',
    status: 'SUCCESS',
    timestamp: new Date().toISOString(),
  });

  return {
    phase: 'my-phase',
    name: 'My Phase',
    description: 'Testing something',
    startTime,
    endTime: new Date().toISOString(),
    durationMs: Date.now() - startMs,
    checks,
    summary: summarizeChecks(checks),
  };
}
```

## Existing Phases

| Phase | Purpose |
|-------|---------|
| `auth` | OAuth discovery and validation (RFC 9728, 8414) |
| `protocol` | MCP protocol conformance (connection, capabilities) |
| `tools` | Tool quality analysis (token counts, descriptions) |
| `interaction` | Claude interaction testing with transcripts |
