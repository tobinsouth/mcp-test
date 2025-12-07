# MCP Client Factory

Factory for creating MCP clients with integrated authentication.

## Purpose

Provides a consistent way to create MCP clients that:
- Handle OAuth authentication automatically via `authProvider`
- Support different transport types
- Integrate with the test runner's check recording

## Usage

```typescript
import { createMCPClient } from '@mcp-qa/core/client';
import { TestOAuthProvider } from '@mcp-qa/core/auth';

// Create with auth provider
const { client, transport } = await createMCPClient(
  'https://api.example.com/mcp',
  {
    authProvider: provider,
    clientInfo: {
      name: 'mcp-test-runner',
      version: '1.0.0',
    },
  }
);

// Use the client
const tools = await client.listTools();
const result = await client.callTool({ name: 'echo', arguments: { msg: 'hi' } });

// Cleanup
await transport.close();
await client.close();
```

## Files

### factory.ts

```typescript
export interface CreateMCPClientOptions {
  authProvider?: TestOAuthProvider;
  clientInfo?: {
    name: string;
    version: string;
  };
  capabilities?: {
    sampling?: Record<string, unknown>;
    elicitation?: Record<string, unknown>;
  };
}

export async function createMCPClient(
  serverUrl: string,
  options?: CreateMCPClientOptions
): Promise<{
  client: Client;
  transport: StreamableHTTPClientTransport;
}>;
```

## How Auth Works

1. Client connects to server
2. Server returns 401 with `WWW-Authenticate` header
3. SDK's `StreamableHTTPClientTransport` triggers auth flow
4. `TestOAuthProvider` manages state and records checks
5. Transport retries request with token

The auth flow is entirely handled by the SDK - we just provide the provider.

## Transport Types

Currently supports:
- `StreamableHTTPClientTransport` - HTTP with streaming (default)

Future:
- `SSEClientTransport` - Server-Sent Events
- `StdioClientTransport` - Standard I/O (for local servers)
