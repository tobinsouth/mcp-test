# Auth Phase

OAuth discovery and validation phase.

## Purpose

This phase performs OAuth **discovery only** - it does NOT authenticate.
Actual authentication happens in the Protocol phase when the transport
connects and receives a 401 response.

## What It Does

1. **PRM Discovery** (RFC 9728)
   - Fetches `/.well-known/oauth-protected-resource`
   - Records authorization servers, scopes supported

2. **AS Metadata Discovery** (RFC 8414)
   - Fetches `/.well-known/oauth-authorization-server`
   - Records endpoints, supported flows, PKCE support

3. **Capability Checks**
   - PKCE S256 support
   - Dynamic Client Registration (DCR) availability
   - Client ID Metadata Document (CIMD) support

4. **Provider Setup**
   - Creates `TestOAuthProvider` for use by Protocol phase
   - Does NOT call `auth()` yet

## Files

### auth-phase.ts

```typescript
export async function runAuthPhase(
  serverUrl: string,
  authConfig: AuthConfig,
  options: {
    recorder: AuthCheckRecorder;
    interactiveHandler?: InteractiveAuthHandler;
  }
): Promise<PhaseResult & { provider?: TestOAuthProvider }>;
```

### checks.ts
Helper functions for creating auth-specific checks.

## Check IDs

| ID | Description |
|----|-------------|
| `auth-prm-discovered` | PRM discovery succeeded |
| `auth-prm-not-found` | PRM not found (warning) |
| `auth-as-discovered` | AS metadata discovered |
| `auth-pkce-supported` | PKCE S256 supported |
| `auth-dcr-available` | DCR endpoint available |
| `auth-cimd-supported` | CIMD supported |
| `auth-discovery-complete` | Discovery phase complete |

## Why Discovery Only?

The MCP SDK handles authentication via the transport's 401 handling.
By doing discovery separately, we can:

1. Record discovery checks before connection
2. Fail fast if discovery indicates problems
3. Let the SDK handle the actual OAuth flow
4. Record auth checks via `TestOAuthProvider` callbacks
