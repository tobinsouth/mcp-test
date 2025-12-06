/**
 * OAuth State Parameter Encoding
 *
 * The OAuth `state` parameter serves dual purposes:
 * 1. CSRF Protection: Original PKCE-generated state
 * 2. Session Tracking: Our `runId` for cross-process communication
 */

const STATE_PREFIX = 'mcp';
const STATE_SEPARATOR = ':';

/**
 * Encode runId and original state into OAuth state parameter
 * Format: "mcp:{runId}:{originalState}"
 */
export function encodeState(runId: string, originalState: string): string {
  return `${STATE_PREFIX}${STATE_SEPARATOR}${runId}${STATE_SEPARATOR}${originalState}`;
}

/**
 * Decode OAuth state parameter back to runId and original state
 */
export function decodeState(encodedState: string): { runId: string; originalState: string } | null {
  const parts = encodedState.split(STATE_SEPARATOR);

  if (parts[0] !== STATE_PREFIX || parts.length < 3) {
    return null; // Not our encoded state
  }

  const runId = parts[1]!;
  // Original state may contain separators, so join remaining parts
  const originalState = parts.slice(2).join(STATE_SEPARATOR);

  return { runId, originalState };
}
