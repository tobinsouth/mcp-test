# Auth Module

OAuth authentication components for the MCP QA Platform.

## Components

### provider/
`TestOAuthProvider` - Implements MCP SDK's `OAuthClientProvider` interface with check recording.

Key points:
- Does NOT implement OAuth logic (SDK handles that)
- Records checks during provider callbacks
- Manages client info, tokens, PKCE state

### handlers/
Interactive auth handlers for different contexts:

- `cli-handler.ts` - Opens browser, runs local HTTP server for callback
- `web-handler.ts` - Uses session store + polling for serverless

Both implement the `InteractiveAuthHandler` interface.

### session/
Cross-process session management for OAuth flows:

- `memory-store.ts` - In-memory store (development only)
- `redis-store.ts` - Redis/Upstash store (production)

Required for serverless deployments where the callback handler runs in a different process than the test runner.

### state-encoding.ts
Encodes `runId` into OAuth state parameter for callback identification:

```
Original state: "abc123"
Encoded state: "mcp:run-uuid:abc123"
```

## Flow Diagram

```
┌─────────────┐     ┌──────────────────┐     ┌───────────────┐
│ TestRunner  │────>│ TestOAuthProvider│────>│ MCP SDK auth()│
└─────────────┘     └──────────────────┘     └───────────────┘
      │                      │                       │
      │ uses                 │ records checks        │ handles OAuth
      ▼                      ▼                       ▼
┌─────────────┐     ┌──────────────────┐     ┌───────────────┐
│ AuthHandler │────>│  SessionStore    │────>│ Callback API  │
└─────────────┘     └──────────────────┘     └───────────────┘
```
