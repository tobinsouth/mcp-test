import type { AuthSession, AuthSessionStore } from "./types.js";

/**
 * In-memory session store for development/testing.
 *
 * WARNING: This only works for single-process deployments.
 * Use Redis or database store for production.
 */
export class MemorySessionStore implements AuthSessionStore {
  private sessions = new Map<string, AuthSession>();

  async create(runId: string, expiresInMs = 5 * 60 * 1000): Promise<void> {
    const now = new Date();
    this.sessions.set(runId, {
      runId,
      status: "pending",
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + expiresInMs).toISOString(),
    });
  }

  async get(runId: string): Promise<AuthSession | null> {
    const session = this.sessions.get(runId);
    if (!session) return null;

    // Check expiration
    if (new Date(session.expiresAt) < new Date()) {
      session.status = "expired";
    }

    return session;
  }

  async setAuthorizationUrl(runId: string, url: string, originalState: string): Promise<void> {
    const session = this.sessions.get(runId);
    if (session) {
      session.authorizationUrl = url;
      session.originalState = originalState;
    }
  }

  async updateWithCallback(runId: string, code: string, state: string): Promise<void> {
    const session = this.sessions.get(runId);
    if (session) {
      session.status = "callback_received";
      session.callbackData = { code, state };
    }
  }

  async updateWithError(runId: string, error: string): Promise<void> {
    const session = this.sessions.get(runId);
    if (session) {
      session.status = "error";
      session.error = error;
    }
  }

  async delete(runId: string): Promise<void> {
    this.sessions.delete(runId);
  }
}
