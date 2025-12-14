import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { TestConfig, TestCheck, PhaseResult } from "@mcp-qa/types";
import type { TestOAuthProvider } from "@mcp-qa/core";

/**
 * Context passed to phase runners
 */
export interface PhaseContext {
  /** Test configuration */
  config: TestConfig;
  /** MCP client (available after protocol phase) */
  client?: Client;
  /** OAuth provider (available after auth phase) */
  provider?: TestOAuthProvider;
  /** Callback for progress updates */
  onProgress: (check: TestCheck) => void;
}

/**
 * Extended phase result with optional resources
 */
export interface ExtendedPhaseResult extends PhaseResult {
  /** OAuth provider created during auth phase */
  provider?: TestOAuthProvider;
  /** MCP client created during protocol phase */
  client?: Client;
  /** Transport for cleanup */
  transport?: { close(): Promise<void> };
  /** Cleanup function */
  cleanup?: () => Promise<void>;
}

/**
 * Phase runner function type
 */
export type PhaseRunner<T extends ExtendedPhaseResult = ExtendedPhaseResult> = (
  context: PhaseContext
) => Promise<T>;
