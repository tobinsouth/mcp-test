# Next.js App Directory

Next.js 14 App Router pages and API routes.

## Directory Structure

```
app/
├── layout.tsx            # Root layout
├── page.tsx              # Dashboard (home page)
│
├── test/
│   └── [id]/
│       └── page.tsx      # Test detail view
│
└── api/
    ├── run/
    │   └── route.ts      # POST: Start test run
    │
    ├── status/
    │   └── route.ts      # GET (SSE): Progress stream
    │
    └── oauth/
        ├── callback/
        │   └── route.ts  # GET: OAuth callback handler
        └── poll/
            └── [runId]/
                └── route.ts  # GET: Poll for callback status
```

## Pages

### / (Dashboard)
- Recent test runs
- Quick start configuration
- Server status overview

### /test/[id]
- Test detail view
- Real-time progress
- Phase results
- Transcript viewer

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
Handles OAuth authorization callbacks:
- Parses encoded state parameter
- Updates session store with code
- Displays result page to user

### GET /api/oauth/poll/[runId]
Poll for OAuth callback completion:

```typescript
// Response
{
  status: 'pending' | 'callback_received' | 'error',
  code?: string,  // Only if callback_received
  error?: string  // Only if error
}
```

## Layouts

### layout.tsx
Root layout with:
- HTML structure
- Global styles
- Header/navigation
- Providers (if any)

## Server Components

Most pages use React Server Components for:
- Data fetching
- Initial render
- SEO

Client components are used for:
- Interactive elements
- Real-time updates
- Form handling
