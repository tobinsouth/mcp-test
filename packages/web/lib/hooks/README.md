# React Hooks

Custom React hooks for the web platform.

## Files

### useTestRun.ts
Complete test run state management:

```typescript
interface UseTestRunReturn {
  // State
  runId: string | null;
  status: 'idle' | 'running' | 'completed' | 'failed';
  checks: TestCheck[];
  report: TestReport | null;
  error: Error | null;

  // OAuth state
  authUrl: string | null;
  authRequired: boolean;

  // Actions
  startRun: (config: TestConfig) => Promise<void>;
  cancelRun: () => void;
  clearRun: () => void;
}

// Usage
function TestPage() {
  const { status, checks, startRun } = useTestRun();

  return (
    <div>
      <button onClick={() => startRun(config)}>Run Tests</button>
      {status === 'running' && <CheckList checks={checks} />}
    </div>
  );
}
```

### useOAuthPopup.ts
OAuth popup window management:

```typescript
interface UseOAuthPopupOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  pollInterval?: number;
}

interface UseOAuthPopupReturn {
  openPopup: (url: string) => void;
  closePopup: () => void;
  isWaiting: boolean;
  error: string | null;
}

// Usage
function AuthButton({ authUrl }: { authUrl: string }) {
  const { openPopup, isWaiting } = useOAuthPopup({
    onSuccess: () => console.log('Auth complete'),
  });

  return (
    <button onClick={() => openPopup(authUrl)} disabled={isWaiting}>
      {isWaiting ? 'Waiting...' : 'Authorize'}
    </button>
  );
}
```

## Implementation Notes

### SSE Connection
`useTestRun` uses EventSource for real-time updates:
- Automatically reconnects on disconnect
- Cleans up on unmount
- Handles error events

### Popup Communication
`useOAuthPopup` uses multiple strategies:
1. `postMessage` from popup (immediate)
2. Polling `/api/oauth/poll` (fallback)
3. Popup close detection

### State Persistence
Consider persisting run state:
- `localStorage` for client-side
- Server-side for multi-tab support
