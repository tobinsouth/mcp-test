# Base Phase Utilities

Common interfaces and utilities for implementing test phases.

## Files

### types.ts
Phase interface definitions:

```typescript
export interface PhaseContext {
  config: TestConfig;
  client?: Client;
  provider?: TestOAuthProvider;
  onProgress?: (check: TestCheck) => void;
}

export interface Phase {
  name: string;
  description: string;
  run(context: PhaseContext): Promise<PhaseResult>;
}
```

### phase-runner.ts
Utilities for running phases:

```typescript
// Helper to push checks with consistent formatting
export function createCheckPusher(
  checks: TestCheck[],
  onProgress?: (check: TestCheck) => void
): (check: TestCheck) => void;

// Helper to summarize check results
export function summarizeChecks(checks: TestCheck[]): CheckSummary;

// Helper to create phase result
export function createPhaseResult(
  phase: string,
  name: string,
  description: string,
  checks: TestCheck[],
  startMs: number
): PhaseResult;
```

## Creating a New Phase

```typescript
// my-phase.ts
import type { PhaseContext, PhaseResult } from '../base/types';
import { createCheckPusher, createPhaseResult } from '../base/phase-runner';

export async function runMyPhase(
  context: PhaseContext
): Promise<PhaseResult> {
  const checks: TestCheck[] = [];
  const pushCheck = createCheckPusher(checks, context.onProgress);
  const startMs = Date.now();

  // Run your tests
  pushCheck({
    id: 'my-check',
    name: 'My Check',
    description: 'Testing something',
    status: 'SUCCESS',
    timestamp: new Date().toISOString(),
  });

  return createPhaseResult('my-phase', 'My Phase', 'Testing...', checks, startMs);
}
```

## Phase Registration

Phases are registered in `phases/index.ts`:

```typescript
export const phases = {
  auth: runAuthPhase,
  protocol: runProtocolPhase,
  tools: runToolsPhase,
  interaction: runInteractionPhase,
  // Add new phases here
};
```
