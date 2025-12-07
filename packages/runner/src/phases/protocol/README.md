# Protocol Phase

MCP protocol conformance testing.

## Purpose

This phase establishes the MCP connection and verifies protocol conformance.
**This is where OAuth authentication actually happens** via the SDK's 401 handling.

## What It Does

1. **Client Creation**
   - Creates MCP `Client` instance
   - Configures capabilities (sampling, elicitation)

2. **Transport Setup**
   - Creates `StreamableHTTPClientTransport`
   - Attaches `TestOAuthProvider` from Auth phase

3. **Connection**
   - Calls `client.connect(transport)`
   - SDK handles 401 → OAuth flow → retry
   - `TestOAuthProvider` records auth checks

4. **Capability Verification**
   - Retrieves server version info
   - Retrieves server capabilities
   - Records what the server supports

## Files

### protocol-phase.ts

```typescript
export async function runProtocolPhase(
  serverUrl: string,
  provider?: TestOAuthProvider,
  options?: {
    onProgress?: (check: TestCheck) => void;
    testCapabilities?: boolean;
  }
): Promise<PhaseResult & {
  client?: Client;
  transport?: StreamableHTTPClientTransport
}>;
```

## Check IDs

| ID | Description |
|----|-------------|
| `protocol-client-created` | MCP client instance created |
| `protocol-transport-created` | Transport created |
| `protocol-connected` | Connection established |
| `protocol-server-info` | Server version retrieved |
| `protocol-capabilities` | Server capabilities retrieved |
| `protocol-connection-failed` | Connection failed |

## Auth Checks (via Provider)

During connection, `TestOAuthProvider` may record:
- `auth-client-registered` - DCR succeeded
- `auth-pkce-generated` - PKCE code verifier created
- `auth-redirect-initiated` - Authorization URL generated
- `auth-callback-received` - Callback received
- `auth-tokens-obtained` - Tokens received

## Cleanup

The phase returns a `cleanup` function to close resources:

```typescript
const result = await runProtocolPhase(serverUrl, provider);

// ... use result.client ...

// Cleanup when done
await result.cleanup?.();
```

This is called automatically by the main runner.
