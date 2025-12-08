/**
 * Interface for handling interactive OAuth authorization flows.
 * Implemented differently for CLI (opens browser) and web (uses polling).
 */
export interface InteractiveAuthHandler {
  /**
   * Called when user authorization is required.
   * The handler should present the authorization URL to the user.
   *
   * @param authorizationUrl - The URL to redirect the user to for authorization
   */
  onAuthorizationRequired(authorizationUrl: URL): Promise<void>;

  /**
   * Wait for the OAuth callback to be received.
   * Returns the authorization code and state from the callback.
   *
   * @returns The authorization code and optional state parameter
   */
  waitForCallback(): Promise<{ code: string; state?: string }>;
}
