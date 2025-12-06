/**
 * Auth Session Store Interface
 *
 * Provides cross-process OAuth session management for web deployments.
 */

export interface AuthSession {
  runId: string;
  status: 'pending' | 'callback_received' | 'error' | 'expired';
  createdAt: string;
  expiresAt: string;

  // Set when authorization URL is generated
  authorizationUrl?: string;
  originalState?: string; // The PKCE state before encoding

  // Set when callback is received
  callbackData?: {
    code: string;
    state: string; // The encoded state from callback
  };

  // Set on error
  error?: string;
}

export interface AuthSessionStore {
  /**
   * Create a new pending session
   */
  create(runId: string, expiresInMs?: number): Promise<void>;

  /**
   * Get session by runId
   */
  get(runId: string): Promise<AuthSession | null>;

  /**
   * Update session with authorization URL and original state
   */
  setAuthorizationUrl(runId: string, url: string, originalState: string): Promise<void>;

  /**
   * Update session when callback is received
   */
  updateWithCallback(runId: string, code: string, state: string): Promise<void>;

  /**
   * Update session with error
   */
  updateWithError(runId: string, error: string): Promise<void>;

  /**
   * Delete session (cleanup)
   */
  delete(runId: string): Promise<void>;
}
