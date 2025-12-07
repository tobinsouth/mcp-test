# @mcp-qa/core Source

Shared runtime utilities for the MCP QA Platform.

## Directory Structure

```
src/
├── auth/             # OAuth providers, handlers, session stores
│   ├── provider/     # TestOAuthProvider implementation
│   ├── handlers/     # CLI and Web interactive auth handlers
│   └── session/      # Session stores (memory, redis)
├── client/           # MCP client factory
├── utils/            # Token counting, report helpers
└── index.ts          # Main entry point
```

## Modules

### auth/
Complete OAuth authentication infrastructure:
- **provider/** - `TestOAuthProvider` implementing MCP SDK's `OAuthClientProvider`
- **handlers/** - Interactive auth handlers for CLI (browser) and Web (polling)
- **session/** - Cross-process session stores for serverless OAuth

See [auth/README.md](./auth/README.md) for details.

### client/
MCP client factory with integrated auth:

```typescript
import { createMCPClient } from '@mcp-qa/core/client';

const { client, transport } = await createMCPClient(serverUrl, {
  authProvider: provider,
});
```

### utils/
Shared utilities:
- `tokens.ts` - Token counting for tool analysis
- `report.ts` - Report generation helpers

## Exports

```typescript
// Main entry
import {
  TestOAuthProvider,
  createCLIAuthHandler,
  createWebAuthHandler,
  getSessionStore,
  createMCPClient,
  countTokens,
} from '@mcp-qa/core';

// Subpath exports
import { TestOAuthProvider } from '@mcp-qa/core/auth';
import { createMCPClient } from '@mcp-qa/core/client';
import { countTokens } from '@mcp-qa/core/utils';
```

## Design Principles

1. **SDK-First** - Leverage MCP SDK, don't reimplement
2. **Context-Agnostic** - Works in CLI, web, and programmatic contexts
3. **Observable** - Auth flow records checks for reporting
4. **Pluggable** - Session stores and handlers are injectable
