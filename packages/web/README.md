# @mcp-qa/web

Next.js web platform for interactive MCP server testing.

## Purpose

Web-based interface for the MCP QA Platform:

- **Configuration Editor** - Visual JSON configuration builder
- **Real-time Progress** - SSE-based live test progress
- **OAuth Integration** - Browser-based OAuth flow with callback handling
- **Report Viewer** - Interactive test report exploration
- **Transcript Browser** - View Claude interaction transcripts

## Design Principles

1. **Server Components First** - Use React Server Components where possible
2. **Streaming Updates** - SSE for real-time progress, not polling
3. **Cross-Process Auth** - Session store for serverless OAuth handling
4. **Responsive Design** - Works on desktop and tablet

## Structure

```
app/
├── layout.tsx               # Root layout
├── page.tsx                 # Dashboard (recent runs, quick start)
│
├── test/
│   └── [id]/
│       └── page.tsx         # Test detail view (phases, checks)
│
└── api/
    ├── run/
    │   └── route.ts         # POST: Start test run
    │
    ├── status/
    │   └── route.ts         # GET (SSE): Progress stream
    │
    └── oauth/
        ├── callback/
        │   └── route.ts     # GET: OAuth callback handler
        └── poll/
            └── [runId]/
                └── route.ts # GET: Poll for callback completion

components/
├── config/
│   ├── ConfigEditor.tsx     # JSON editor with schema validation
│   ├── AuthConfigForm.tsx   # Auth type selector and form
│   └── PhaseConfigForm.tsx  # Phase enable/disable toggles
│
├── results/
│   ├── CheckList.tsx        # Real-time check list with status icons
│   ├── PhaseResult.tsx      # Phase summary with expandable checks
│   └── ReportSummary.tsx    # Overall pass/fail/warn counts
│
├── transcript/
│   └── TranscriptViewer.tsx # Message/tool call timeline
│
└── layout/
    ├── Header.tsx
    └── Sidebar.tsx

lib/
├── runner.ts                # Server-side runner wrapper
├── session-store.ts         # Session store factory
└── hooks/
    ├── useTestRun.ts        # Test run state management
    └── useOAuthPopup.ts     # OAuth popup window handling
```

## Key Features

### OAuth Flow

The web platform handles OAuth in a serverless-compatible way:

1. Runner generates `runId` and stores session as "pending"
2. State parameter encodes `runId` for callback identification
3. User is redirected to authorization server
4. Callback updates session store with code
5. Runner polls session store for completion

```
Runner → Session Store → OAuth Popup → Callback API → Session Store → Runner
```

### Real-time Progress

Uses Server-Sent Events for streaming:

```typescript
// Client
const eventSource = new EventSource(`/api/status?runId=${runId}`);
eventSource.onmessage = (e) => {
  const check = JSON.parse(e.data);
  setChecks((prev) => [...prev, check]);
};
```

### Configuration Editor

- Monaco editor with JSON schema validation
- Form-based auth configuration
- Phase toggle switches
- Template selection

## Environment Variables

```bash
# Required for interaction testing
ANTHROPIC_API_KEY=sk-ant-...

# Required for serverless deployments
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# App configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build
```

## API Routes

### POST /api/run

Start a new test run.

```typescript
// Request
{ config: TestConfig }

// Response
{ runId: string, status: 'started' }
```

### GET /api/status

SSE stream of test progress.

```typescript
// Query: ?runId=xxx
// Events: { phase: string, check: TestCheck }
```

### GET /api/oauth/callback

OAuth callback handler. Parses state, updates session store.

### GET /api/oauth/poll/[runId]

Poll for OAuth callback completion.

```typescript
// Response
{ status: 'pending' | 'callback_received' | 'error', code?: string, error?: string }
```

## Dependencies

- `@mcp-qa/runner`
- `@mcp-qa/core`
- `@mcp-qa/types`
- `next`
- `react`
- `@upstash/redis`
