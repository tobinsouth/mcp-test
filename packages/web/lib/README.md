# Web Library Utilities

Server-side utilities for the web platform.

## Directory Structure

```
lib/
├── runner.ts             # Server-side runner wrapper
├── session-store.ts      # Session store factory
└── hooks/
    ├── useTestRun.ts     # Test run state management
    └── useOAuthPopup.ts  # OAuth popup handling
```

## Server-Side Utilities

### runner.ts
Wraps `@mcp-qa/runner` for web context:

```typescript
import { runTestsForWeb } from '@/lib/runner';

const { runId, report } = await runTestsForWeb({
  configPath: '/path/to/config.json',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  onProgress: (phase, check) => {
    // Stream to client via SSE
  },
  onAuthUrlReady: (runId, url) => {
    // Send to client to open popup
  },
});
```

### session-store.ts
Factory for OAuth session stores:

```typescript
import { getSessionStore } from '@/lib/session-store';

const store = getSessionStore();
// Returns Redis in production, memory in development
```

Environment detection:
- `UPSTASH_REDIS_REST_URL` → Upstash Redis
- `REDIS_URL` → Self-hosted Redis
- Neither → Memory store (dev only)

## Client-Side Hooks

### useTestRun.ts
Manages test run state:

```typescript
const {
  runId,
  status,
  checks,
  report,
  startRun,
  cancelRun,
} = useTestRun();

// Start a test
await startRun(config);

// Checks update in real-time via SSE
```

### useOAuthPopup.ts
Handles OAuth popup flow:

```typescript
const { openPopup, isWaiting } = useOAuthPopup({
  onSuccess: () => {
    // Popup closed, auth complete
  },
  onError: (error) => {
    // Handle error
  },
});

// When runner needs auth
openPopup(authUrl);
```

## SSE Streaming

Progress is streamed via Server-Sent Events:

```typescript
// Server (API route)
const stream = new ReadableStream({
  start(controller) {
    onProgress = (phase, check) => {
      controller.enqueue(`data: ${JSON.stringify({ phase, check })}\n\n`);
    };
  }
});

// Client (hook)
const eventSource = new EventSource(`/api/status?runId=${runId}`);
eventSource.onmessage = (e) => {
  const { phase, check } = JSON.parse(e.data);
  setChecks(prev => [...prev, check]);
};
```
