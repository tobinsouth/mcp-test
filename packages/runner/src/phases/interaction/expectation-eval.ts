import type { ExpectedToolCall } from '@mcp-qa/types';

export interface ToolCallRecord {
  toolName: string;
  arguments: Record<string, unknown>;
  result?: unknown;
}

export interface ExpectationEvalResult {
  passed: boolean;
  matched: Array<{ toolName: string; arguments: Record<string, unknown> }>;
  missing: ExpectedToolCall[];
}

/**
 * Evaluate actual tool calls against expected tool calls.
 */
export function evaluateToolCalls(
  expected: ExpectedToolCall[],
  actual: ToolCallRecord[]
): ExpectationEvalResult {
  const missing: ExpectedToolCall[] = [];
  const matched: Array<{ toolName: string; arguments: Record<string, unknown> }> = [];

  for (const exp of expected) {
    const found = actual.find(act => {
      if (act.toolName !== exp.toolName) return false;

      if (exp.argumentsContain) {
        for (const [key, value] of Object.entries(exp.argumentsContain)) {
          const actualValue = act.arguments[key];
          if (!deepContains(actualValue, value)) {
            return false;
          }
        }
      }

      return true;
    });

    if (found) {
      matched.push({ toolName: found.toolName, arguments: found.arguments });
    } else {
      missing.push(exp);
    }
  }

  return {
    passed: missing.length === 0,
    matched,
    missing,
  };
}

/**
 * Check if actual value contains expected value.
 * For objects, checks if all keys/values in expected exist in actual.
 * For arrays, checks if expected is a subset of actual.
 * For primitives, checks equality.
 */
function deepContains(actual: unknown, expected: unknown): boolean {
  if (expected === undefined || expected === null) {
    return actual === expected;
  }

  if (typeof expected !== typeof actual) {
    return false;
  }

  if (typeof expected !== 'object') {
    return actual === expected;
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return false;
    return expected.every(exp =>
      actual.some(act => deepContains(act, exp))
    );
  }

  // Object comparison
  const expectedObj = expected as Record<string, unknown>;
  const actualObj = actual as Record<string, unknown>;

  return Object.entries(expectedObj).every(([key, value]) =>
    deepContains(actualObj[key], value)
  );
}
