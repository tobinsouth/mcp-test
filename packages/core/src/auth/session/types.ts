/**
 * OAuth session status
 */
export type AuthSessionStatus = "pending" | "callback_received" | "error" | "expired";

/**
 * OAuth session data stored across processes
 */
export interface AuthSession {
  /** Unique run identifier */
  runId: string;
  /** Current session status */
  status: AuthSessionStatus;
  /** When session was created */
  createdAt: string;
  /** When session expires */
  expiresAt: string;
  /** The authorization URL (set when generated) */
  authorizationUrl?: string;
  /** Original PKCE state before encoding */
  originalState?: string;
  /** Callback data (set when callback received) */
  callbackData?: {
    code: string;
    state: string;
  };
  /** Error message (set on error) */
  error?: string;
}

/**
 * Interface for storing OAuth sessions across processes.
 * Implementations: MemorySessionStore (dev), RedisSessionStore (prod)
 */
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
