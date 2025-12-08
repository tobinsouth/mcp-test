import type { Redis } from '@upstash/redis';
import type { AuthSession, AuthSessionStore } from './types.js';

/**
 * Redis-backed session store for production deployments.
 * Works with Upstash (serverless) or self-hosted Redis.
 */
export class RedisSessionStore implements AuthSessionStore {
  private prefix = 'mcp-test:auth:';

  constructor(private redis: Redis) {}

  private key(runId: string): string {
    return `${this.prefix}${runId}`;
  }

  async create(runId: string, expiresInMs = 5 * 60 * 1000): Promise<void> {
    const now = new Date();
    const session: AuthSession = {
      runId,
      status: 'pending',
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + expiresInMs).toISOString(),
    };

    // Set with TTL (Redis handles expiration)
    await this.redis.set(this.key(runId), JSON.stringify(session), {
      px: expiresInMs,
    });
  }

  async get(runId: string): Promise<AuthSession | null> {
    const data = await this.redis.get<string>(this.key(runId));
    if (!data) return null;
    return typeof data === 'string' ? JSON.parse(data) : data;
  }

  async setAuthorizationUrl(runId: string, url: string, originalState: string): Promise<void> {
    const session = await this.get(runId);
    if (session) {
      session.authorizationUrl = url;
      session.originalState = originalState;
      // Use KEEPTTL equivalent - get current TTL first
      const ttl = await this.redis.pttl(this.key(runId));
      if (ttl > 0) {
        await this.redis.set(this.key(runId), JSON.stringify(session), {
          px: ttl,
        });
      } else {
        await this.redis.set(this.key(runId), JSON.stringify(session));
      }
    }
  }

  async updateWithCallback(runId: string, code: string, state: string): Promise<void> {
    const session = await this.get(runId);
    if (session) {
      session.status = 'callback_received';
      session.callbackData = { code, state };
      const ttl = await this.redis.pttl(this.key(runId));
      if (ttl > 0) {
        await this.redis.set(this.key(runId), JSON.stringify(session), {
          px: ttl,
        });
      } else {
        await this.redis.set(this.key(runId), JSON.stringify(session));
      }
    }
  }

  async updateWithError(runId: string, error: string): Promise<void> {
    const session = await this.get(runId);
    if (session) {
      session.status = 'error';
      session.error = error;
      const ttl = await this.redis.pttl(this.key(runId));
      if (ttl > 0) {
        await this.redis.set(this.key(runId), JSON.stringify(session), {
          px: ttl,
        });
      } else {
        await this.redis.set(this.key(runId), JSON.stringify(session));
      }
    }
  }

  async delete(runId: string): Promise<void> {
    await this.redis.del(this.key(runId));
  }
}
