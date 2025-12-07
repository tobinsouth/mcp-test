# CLI Output Utilities

Formatting utilities for terminal output.

## Files

### progress.ts
Progress display utilities:

```typescript
// Create progress callback for runner
export function createProgressHandler(
  verbose: boolean,
  useColor: boolean
): (phase: string, check: TestCheck) => void;

// Display spinner while waiting
export function withSpinner<T>(
  message: string,
  promise: Promise<T>
): Promise<T>;

// Progress bar for multi-step operations
export class ProgressBar {
  constructor(total: number, width?: number);
  increment(message?: string): void;
  complete(): void;
}
```

### reporter.ts
Report formatting:

```typescript
// Format final report for console
export function formatReport(
  report: TestReport,
  useColor: boolean
): string;

// Format as JSON (for --json flag)
export function formatReportJson(
  report: TestReport
): string;

// Summary line
export function formatSummary(
  summary: CheckSummary,
  useColor: boolean
): string;
```

### colors.ts
Terminal color helpers:

```typescript
export const colors = {
  success: (text: string) => `\x1b[32m${text}\x1b[0m`,
  failure: (text: string) => `\x1b[31m${text}\x1b[0m`,
  warning: (text: string) => `\x1b[33m${text}\x1b[0m`,
  info: (text: string) => `\x1b[36m${text}\x1b[0m`,
  dim: (text: string) => `\x1b[2m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
};

// No-op colors for --no-color
export const noColors = {
  success: (text: string) => text,
  // ...
};
```

## Output Format

```
[auth] ✓ PRM Discovery: Successfully discovered Protected Resource Metadata
[auth] ✓ AS Metadata Discovery: Successfully discovered Authorization Server
[protocol] ✓ Connection Established: Connected to MCP server
[tools] ✓ List Tools: Server exposes 5 tools
[tools] ⚠ Tool: large_schema: Tool definition is large (6000 tokens)
[interaction] ✓ Prompt: Basic Tool Usage: Completed in 3 iterations

Test completed: PASS
  Total: 12
  Passed: 10
  Failed: 0
  Warnings: 2
```

## Status Icons

| Status | Icon |
|--------|------|
| SUCCESS | ✓ (green) |
| FAILURE | ✗ (red) |
| WARNING | ⚠ (yellow) |
| SKIPPED | ○ (dim) |
| INFO | • (cyan) |
