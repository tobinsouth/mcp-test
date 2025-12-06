/**
 * Core types for the MCP Server Test Runner
 */

export type CheckStatus = 'SUCCESS' | 'FAILURE' | 'WARNING' | 'SKIPPED' | 'INFO';

export interface SpecReference {
  id: string;
  url?: string;
  section?: string;
}

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

export interface PhaseResult {
  phase: string;
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

/**
 * Helper function to summarize checks into a summary object
 */
export function summarizeChecks(checks: TestCheck[]): PhaseResult['summary'] {
  return {
    total: checks.length,
    success: checks.filter(c => c.status === 'SUCCESS').length,
    failure: checks.filter(c => c.status === 'FAILURE').length,
    warning: checks.filter(c => c.status === 'WARNING').length,
    skipped: checks.filter(c => c.status === 'SKIPPED').length,
  };
}
