# @mcp-qa/core

Shared runtime utilities for the MCP QA Platform.

## Purpose

This package provides core functionality shared between runners, CLI, and web:

- **OAuth Provider** - `TestOAuthProvider` implementing MCP SDK's `OAuthClientProvider`
- **Auth Handlers** - Interactive auth handlers for CLI and web contexts
- **Session Stores** - Cross-process OAuth session management
- **MCP Client Factory** - Consistent client creation with auth
- **Utilities** - Token counting, report generation

## Design Principles

1. **Leverage MCP SDK** - Use SDK's auth functions, not custom OAuth logic
2. **Observability** - Record checks during auth flow, not by reimplementing
3. **Context Agnostic** - Works in both CLI and web environments
4. **Pluggable Storage** - Session stores are injectable (memory, Redis)

## Structure

```
src/
├── auth/
│   ├── provider/
│   │   └── test-oauth-provider.ts   # OAuthClientProvider with check recording
│   │
│   ├── handlers/
│   │   ├── types.ts                 # InteractiveAuthHandler interface
│   │   ├── cli-handler.ts           # Opens browser, runs local callback server
│   │   └── web-handler.ts           # Uses session store + polling
│   │
│   ├── session/
│   │   ├── types.ts                 # AuthSession, AuthSessionStore interfaces
│   │   ├── memory-store.ts          # In-memory (development only)
│   │   └── redis-store.ts           # Redis/Upstash (production)
│   │
│   └── state-encoding.ts            # OAuth state parameter encoding
│
├── client/
│   └── factory.ts                   # MCP client factory with auth
│
└── utils/
    ├── tokens.ts                    # Token counting
    └── report.ts                    # Report generation helpers
```

## Usage

### OAuth Provider

```typescript
import { TestOAuthProvider, AuthCheckRecorder } from '@mcp-qa/core';

const recorder: AuthCheckRecorder = {
  pushCheck: (check) => console.log(check),
};

const provider = new TestOAuthProvider(
  {
    redirectUrl: 'http://localhost:3000/oauth/callback',
    clientMetadata: { /* ... */ },
  },
  recorder
);
```

### CLI Auth Handler

```typescript
import { createCLIAuthHandler } from '@mcp-qa/core';

const handler = createCLIAuthHandler(3456); // callback port
// Opens browser, waits for callback
```

### Web Auth Handler

```typescript
import { createWebAuthHandler, RedisSessionStore } from '@mcp-qa/core';

const store = new RedisSessionStore(redis);
const handler = createWebAuthHandler(store, runId, {
  onAuthUrlReady: (url) => sendToClient(url),
});
```

### Session Store

```typescript
import { getSessionStore } from '@mcp-qa/core';

// Returns Redis in production, memory in development
const store = getSessionStore();

await store.create(runId);
const session = await store.get(runId);
```

## Key Interfaces

### InteractiveAuthHandler
```typescript
interface InteractiveAuthHandler {
  onAuthorizationRequired(url: URL): Promise<void>;
  waitForCallback(): Promise<{ code: string; state?: string }>;
}
```

### AuthSessionStore
```typescript
interface AuthSessionStore {
  create(runId: string, expiresInMs?: number): Promise<void>;
  get(runId: string): Promise<AuthSession | null>;
  updateWithCallback(runId: string, code: string, state: string): Promise<void>;
  // ...
}
```

## Dependencies

- `@mcp-qa/types`
- `@modelcontextprotocol/sdk`
- `@upstash/redis` (optional, for production session store)
