# Result Types

Types for test execution results and reports.

## Files

### check.ts
Individual test check types:

```typescript
export type CheckStatus = 'SUCCESS' | 'FAILURE' | 'WARNING' | 'SKIPPED' | 'INFO';

export interface TestCheck {
  id: string;
  name: string;
  description: string;
  status: CheckStatus;
  timestamp: string;
  durationMs?: number;
  errorMessage?: string;
  details?: Record<string, unknown>;
  specReferences?: SpecReference[];
}
```

### phase-result.ts
Results from a single test phase:

```typescript
export interface PhaseResult {
  phase: string;           // 'auth' | 'protocol' | 'tools' | 'interaction'
  name: string;
  description: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  checks: TestCheck[];
  summary: {
    total: number;
    success: number;
    failure: number;
    warning: number;
    skipped: number;
  };
  cleanup?: () => Promise<void>;
}
```

### report.ts
Complete test run report:

```typescript
export interface TestReport {
  version: '1.0';
  serverUrl: string;
  serverName?: string;
  startTime: string;
  endTime: string;
  totalDurationMs: number;
  phases: PhaseResult[];
  overallStatus: 'PASS' | 'FAIL' | 'WARN';
  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
  };
}
```

## Status Meanings

| Status | Meaning |
|--------|---------|
| `SUCCESS` | Check passed |
| `FAILURE` | Check failed (causes overall FAIL) |
| `WARNING` | Check passed with concerns (causes overall WARN) |
| `SKIPPED` | Check was not run |
| `INFO` | Informational only (no pass/fail) |

## Spec References

Checks can include references to specifications:

```typescript
export interface SpecReference {
  id: string;      // e.g., 'RFC-7636'
  url?: string;    // e.g., 'https://www.rfc-editor.org/rfc/rfc7636.html'
  section?: string;
}
```
