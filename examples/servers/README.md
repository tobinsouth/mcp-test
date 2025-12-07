# Example MCP Servers

Example MCP servers for testing the QA platform locally.

## Servers

### echo-server/
Simple echo tool server (no authentication):

```bash
cd examples/servers/echo-server
bun install
bun run start
# Server running at http://localhost:3001/mcp
```

Tools provided:
- `echo` - Returns the input message
- `reverse` - Reverses a string
- `uppercase` - Converts to uppercase

### protected-server/
OAuth-protected server for testing auth flows:

```bash
cd examples/servers/protected-server
bun install
bun run start
# Server running at http://localhost:3002/mcp
# OAuth at http://localhost:3002/.well-known/oauth-authorization-server
```

Features:
- RFC 9728 Protected Resource Metadata
- RFC 8414 Authorization Server Metadata
- Dynamic Client Registration
- PKCE support

## Running Tests Against Examples

```bash
# Start echo server
cd examples/servers/echo-server && bun run start &

# Run tests
mcp-qa-cli examples/configs/no-auth.json --verbose
```

## Creating a New Example Server

1. Create directory under `examples/servers/`
2. Initialize package: `bun init`
3. Install MCP SDK: `bun add @modelcontextprotocol/sdk`
4. Implement server using SDK patterns
5. Add to workspace if needed

### Minimal Server Template

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server(
  { name: 'example-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'example',
      description: 'An example tool',
      inputSchema: {
        type: 'object',
        properties: {
          input: { type: 'string' }
        }
      }
    }
  ]
}));

server.setRequestHandler('tools/call', async (request) => {
  // Handle tool calls
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

## Notes

- Example servers are for testing only
- Do not use in production
- May not implement full MCP specification
