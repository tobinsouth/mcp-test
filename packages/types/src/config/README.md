# Configuration Schemas

Zod schemas for validating test configuration JSON files.

## Files

### test-config.ts
Main `TestConfigSchema` that validates the complete test configuration:

```typescript
import { TestConfigSchema, type TestConfig } from '@mcp-qa/types';

const config = TestConfigSchema.parse(jsonData);
```

### auth.ts
Auth configuration schemas:

```typescript
// Discriminated union for auth types
const AuthConfigSchema = z.discriminatedUnion('type', [
  NoAuthSchema,
  ClientCredentialsAuthSchema,
  AuthorizationCodeAuthSchema,
]);
```

Supported auth types:
- `none` - No authentication
- `client_credentials` - OAuth client credentials flow
- `authorization_code` - OAuth authorization code flow (with DCR support)

### phases.ts
Phase configuration schemas:

```typescript
const PhaseConfigSchema = z.object({
  auth: z.object({ enabled: z.boolean(), timeout: z.number() }).optional(),
  protocol: z.object({ enabled: z.boolean(), ... }).optional(),
  tools: z.object({ enabled: z.boolean(), ... }).optional(),
  interaction: z.object({ enabled: z.boolean(), prompts: ... }).optional(),
});
```

### server.ts
Server connection configuration:

```typescript
const ServerConfigSchema = z.object({
  url: z.string().url(),
  name: z.string().optional(),
  transport: z.enum(['streamable-http', 'sse', 'stdio']),
  headers: z.record(z.string()).optional(),
});
```

## Example Configuration

```json
{
  "version": "1.0",
  "server": {
    "url": "https://api.example.com/mcp",
    "name": "My MCP Server"
  },
  "auth": {
    "type": "authorization_code",
    "useDCR": true,
    "scopes": ["mcp:tools"]
  },
  "phases": {
    "interaction": {
      "prompts": [...]
    }
  }
}
```

## Adding New Auth Types

1. Create new schema in `auth.ts`
2. Add to discriminated union
3. Update `buildProvider()` in `@mcp-qa/core`
