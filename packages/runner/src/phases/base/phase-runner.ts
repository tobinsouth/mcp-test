import type { TestCheck, CheckSummary } from '@mcp-qa/types';
import { summarizeChecks } from '@mcp-qa/core';

/**
 * Create a check recorder that tracks checks and reports progress.
 */
export function createCheckRecorder(onProgress?: (check: TestCheck) => void) {
  const checks: TestCheck[] = [];

  return {
    checks,
    pushCheck(check: TestCheck) {
      checks.push(check);
      onProgress?.(check);
    },
    getSummary(): CheckSummary {
      return summarizeChecks(checks);
    },
  };
}

/**
 * Create timing utilities for phase execution.
 */
export function createTimer() {
  const startTime = new Date().toISOString();
  const startMs = Date.now();

  return {
    startTime,
    getEndTime(): string {
      return new Date().toISOString();
    },
    getDurationMs(): number {
      return Date.now() - startMs;
    },
  };
}

/**
 * Create a success check.
 */
export function successCheck(
  id: string,
  name: string,
  description: string,
  details?: Record<string, unknown>
): TestCheck {
  return {
    id,
    name,
    description,
    status: 'SUCCESS',
    timestamp: new Date().toISOString(),
    details,
  };
}

/**
 * Create a failure check.
 */
export function failureCheck(
  id: string,
  name: string,
  description: string,
  errorMessage: string,
  details?: Record<string, unknown>
): TestCheck {
  return {
    id,
    name,
    description,
    status: 'FAILURE',
    timestamp: new Date().toISOString(),
    errorMessage,
    details,
  };
}

/**
 * Create a warning check.
 */
export function warningCheck(
  id: string,
  name: string,
  description: string,
  details?: Record<string, unknown>
): TestCheck {
  return {
    id,
    name,
    description,
    status: 'WARNING',
    timestamp: new Date().toISOString(),
    details,
  };
}

/**
 * Create an info check.
 */
export function infoCheck(
  id: string,
  name: string,
  description: string,
  details?: Record<string, unknown>
): TestCheck {
  return {
    id,
    name,
    description,
    status: 'INFO',
    timestamp: new Date().toISOString(),
    details,
  };
}
