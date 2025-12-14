import type { InteractiveAuthHandler } from "./types.js";
import type { AuthSessionStore } from "../session/types.js";
import { encodeState } from "../state-encoding.js";

export interface WebAuthHandlerOptions {
  /** Interval between polling attempts in milliseconds */
  pollIntervalMs?: number;
  /** Timeout for waiting for callback in milliseconds */
  timeoutMs?: number;
  /** Callback when authorization URL is ready */
  onAuthUrlReady?: (url: URL) => void;
}

/**
 * Web platform interactive auth handler.
 *
 * Unlike CLI handler which opens browser directly,
 * this handler integrates with the session store for
 * cross-process OAuth callback handling.
 */
export function createWebAuthHandler(
  sessionStore: AuthSessionStore,
  runId: string,
  options: WebAuthHandlerOptions = {}
): InteractiveAuthHandler {
  const { pollIntervalMs = 2000, timeoutMs = 5 * 60 * 1000 } = options;

  return {
    async onAuthorizationRequired(authorizationUrl: URL): Promise<void> {
      // 1. Create pending session
      await sessionStore.create(runId, timeoutMs);

      // 2. Get original state from URL
      const originalState = authorizationUrl.searchParams.get("state") || "";

      // 3. Encode our runId into the state parameter
      const encodedState = encodeState(runId, originalState);
      authorizationUrl.searchParams.set("state", encodedState);

      // 4. Store the authorization URL and original state
      await sessionStore.setAuthorizationUrl(runId, authorizationUrl.toString(), originalState);

      // 5. Notify that URL is ready (web UI will open it)
      options.onAuthUrlReady?.(authorizationUrl);
    },

    async waitForCallback(): Promise<{ code: string; state?: string }> {
      const deadline = Date.now() + timeoutMs;

      while (Date.now() < deadline) {
        const session = await sessionStore.get(runId);

        if (!session) {
          throw new Error(`Session not found: ${runId}`);
        }

        if (session.status === "callback_received" && session.callbackData) {
          // Return the original state (for CSRF validation in provider)
          return {
            code: session.callbackData.code,
            state: session.originalState,
          };
        }

        if (session.status === "error") {
          throw new Error(session.error || "OAuth authorization failed");
        }

        if (session.status === "expired") {
          throw new Error("OAuth session expired");
        }

        // Wait before polling again
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }

      // Timeout - mark session as expired
      await sessionStore.updateWithError(runId, "OAuth callback timeout");
      throw new Error(`OAuth callback timeout after ${timeoutMs}ms`);
    },
  };
}
