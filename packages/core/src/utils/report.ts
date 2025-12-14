import type { CheckSummary, TestCheck } from "@mcp-qa/types";

/**
 * Summarize a list of checks into counts by status.
 *
 * @param checks - The checks to summarize
 * @returns Summary with counts by status
 */
export function summarizeChecks(checks: TestCheck[]): CheckSummary {
  return {
    total: checks.length,
    success: checks.filter((c) => c.status === "SUCCESS").length,
    failure: checks.filter((c) => c.status === "FAILURE").length,
    warning: checks.filter((c) => c.status === "WARNING").length,
    skipped: checks.filter((c) => c.status === "SKIPPED").length,
  };
}

/**
 * Create a test check object with defaults.
 *
 * @param partial - Partial check data
 * @returns Complete test check
 */
export function createCheck(
  partial: Partial<TestCheck> & { id: string; name: string; status: TestCheck["status"] }
): TestCheck {
  return {
    description: partial.name,
    timestamp: new Date().toISOString(),
    ...partial,
  };
}

/**
 * Format duration in milliseconds to human readable string.
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted string like "1.5s" or "250ms"
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}
