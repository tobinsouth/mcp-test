const STATE_PREFIX = "mcp";
const STATE_SEPARATOR = ":";

/**
 * Encode runId and original state into OAuth state parameter.
 * Format: "mcp:{runId}:{originalState}"
 *
 * @param runId - The unique run identifier
 * @param originalState - The original PKCE state
 * @returns Encoded state string
 */
export function encodeState(runId: string, originalState: string): string {
  return `${STATE_PREFIX}${STATE_SEPARATOR}${runId}${STATE_SEPARATOR}${originalState}`;
}

/**
 * Decode OAuth state parameter back to runId and original state.
 *
 * @param encodedState - The encoded state from OAuth callback
 * @returns Decoded runId and originalState, or null if not valid format
 */
export function decodeState(encodedState: string): { runId: string; originalState: string } | null {
  const parts = encodedState.split(STATE_SEPARATOR);

  const prefix = parts[0];
  const runId = parts[1];

  if (prefix !== STATE_PREFIX || parts.length < 3 || !runId) {
    return null;
  }

  // Original state may contain separators, so join remaining parts
  const originalState = parts.slice(2).join(STATE_SEPARATOR);

  return { runId, originalState };
}
