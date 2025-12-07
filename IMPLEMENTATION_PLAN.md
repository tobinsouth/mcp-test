# MCP Server QA Testing Platform - Implementation Plan

## Executive Summary

A comprehensive QA testing platform for MCP servers with two components:
1. **Bun-based Test Runner** - Headless test execution with JSON configuration
2. **Next.js Web Platform** - Interactive UI for configuration and real-time monitoring

**Key Design Principles:**
- Leverage the MCP TypeScript SDK as much as possible
- Implement `OAuthClientProvider` for state management and observability, but use the SDK's `auth()` function for all OAuth logic
- Monorepo architecture with clear separation of concerns (see [FOLDER_STRUCTURE.md](./FOLDER_STRUCTURE.md))

### Package Overview

| Package | Name | Description |
|---------|------|-------------|
| `packages/types` | `@mcp-qa/types` | Shared TypeScript types and Zod schemas |
| `packages/core` | `@mcp-qa/core` | Auth providers, session stores, utilities |
| `packages/runner` | `@mcp-qa/runner` | Main test runner with all phases |
| `packages/cli` | `@mcp-qa/cli` | CLI interface for standalone use |
| `packages/web` | `@mcp-qa/web` | Next.js interactive frontend |

---

## 1. Test Runner Architecture

### 1.1 Input JSON Schema

```typescript
// packages/types/src/config/test-config.ts

import { z } from 'zod';

/**
 * Extensible test configuration schema
 * Designed for future expansion with new auth types, test phases, etc.
 */

// Auth configuration - extensible for future auth methods
const ClientCredentialsAuthSchema = z.object({
  type: z.literal('client_credentials'),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  tokenEndpoint: z.string().url().optional(), // Override if not using discovery
});

const AuthorizationCodeAuthSchema = z.object({
  type: z.literal('authorization_code'),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  clientMetadataUrl: z.string().url().optional(), // For CIMD (URL-based client ID)
  redirectUri: z.string().url().optional(),
  scopes: z.array(z.string()).optional(),
  useDCR: z.boolean().default(true), // Use Dynamic Client Registration
  interactive: z.boolean().default(false), // Require user interaction
});

const NoAuthSchema = z.object({
  type: z.literal('none'),
});

const AuthConfigSchema = z.discriminatedUnion('type', [
  NoAuthSchema,
  ClientCredentialsAuthSchema,
  AuthorizationCodeAuthSchema,
]);

// Test prompt configuration
const ExpectationSchema = z.object({
  expectedToolCalls: z.array(z.object({
    toolName: z.string(),
    argumentsContain: z.record(z.unknown()).optional(),
  })).optional(),
  shouldSucceed: z.boolean().default(true),
  maxIterations: z.number().min(1).max(50).default(20),
  customValidation: z.string().optional(), // LLM prompt for custom validation
});

const SafetyPolicySchema = z.object({
  id: z.string(),
  description: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
});

const TestPromptSchema = z.object({
  id: z.string(),
  name: z.string(),
  prompt: z.string(),
  expectations: ExpectationSchema.optional(),
  safetyPolicies: z.array(SafetyPolicySchema).optional(),
  maxIterations: z.number().optional(),
  tags: z.array(z.string()).optional(),
});

// Phase configuration - extensible
const PhaseConfigSchema = z.object({
  auth: z.object({
    enabled: z.boolean().default(true),
    timeout: z.number().default(30000),
  }).optional(),
  protocol: z.object({
    enabled: z.boolean().default(true),
    testInitialization: z.boolean().default(true),
    testCapabilities: z.boolean().default(true),
    timeout: z.number().default(30000),
  }).optional(),
  tools: z.object({
    enabled: z.boolean().default(true),
    analyzeTokenCounts: z.boolean().default(true),
    timeout: z.number().default(30000),
  }).optional(),
  interaction: z.object({
    enabled: z.boolean().default(true),
    prompts: z.array(TestPromptSchema).default([]),
    defaultModel: z.string().default('claude-sonnet-4-20250514'),
    safetyReviewModel: z.string().default('claude-3-haiku-20240307'),
    qualityReviewModel: z.string().default('claude-3-haiku-20240307'),
  }).optional(),
});

// Main configuration schema
export const TestConfigSchema = z.object({
  version: z.literal('1.0'),
  server: z.object({
    url: z.string().url(),
    name: z.string().optional(),
    transport: z.enum(['streamable-http', 'sse', 'stdio']).default('streamable-http'),
    headers: z.record(z.string()).optional(),
  }),
  auth: AuthConfigSchema,
  phases: PhaseConfigSchema.optional(),
  output: z.object({
    transcriptDir: z.string().default('./transcripts'),
    reportPath: z.string().default('./test-report.json'),
    format: z.enum(['json', 'html', 'markdown']).default('json'),
  }).optional(),
  metadata: z.record(z.unknown()).optional(), // Extensible metadata
});

export type TestConfig = z.infer<typeof TestConfigSchema>;
export type AuthConfig = z.infer<typeof AuthConfigSchema>;
export type TestPrompt = z.infer<typeof TestPromptSchema>;
```

### 1.2 Example Configurations

```json
// examples/no-auth.json
{
  "version": "1.0",
  "server": {
    "url": "http://localhost:3001/mcp",
    "name": "My MCP Server"
  },
  "auth": {
    "type": "none"
  },
  "phases": {
    "interaction": {
      "prompts": [
        {
          "id": "basic-tool-test",
          "name": "Basic Tool Usage",
          "prompt": "List the available tools and then use the echo tool with message 'hello'",
          "expectations": {
            "expectedToolCalls": [
              { "toolName": "echo", "argumentsContain": { "message": "hello" } }
            ]
          }
        }
      ]
    }
  }
}

// examples/oauth-dcr.json
{
  "version": "1.0",
  "server": {
    "url": "https://api.example.com/mcp",
    "name": "Secured MCP Server"
  },
  "auth": {
    "type": "authorization_code",
    "useDCR": true,
    "scopes": ["mcp:tools", "mcp:resources"],
    "interactive": true
  },
  "phases": {
    "auth": {
      "enabled": true,
      "timeout": 60000
    },
    "interaction": {
      "prompts": [
        {
          "id": "secure-operation",
          "name": "Secure Data Access",
          "prompt": "Fetch the user's profile data",
          "safetyPolicies": [
            {
              "id": "no-pii-leak",
              "description": "Should not expose raw PII in responses",
              "severity": "critical"
            }
          ]
        }
      ]
    }
  }
}
```

### 1.3 Core Types

Flexiblty determine these based on the needs. These will evolve over time.

### 1.4 Project Structure

> **Note:** For the complete monorepo architecture, see [FOLDER_STRUCTURE.md](./FOLDER_STRUCTURE.md).

```
packages/
├── types/                        # @mcp-qa/types - Shared types and Zod schemas
│   └── src/
│       ├── config/               # Configuration schemas
│       │   ├── auth.ts
│       │   ├── phases.ts
│       │   └── test-config.ts
│       ├── results/              # Test result types
│       │   ├── check.ts
│       │   ├── phase-result.ts
│       │   └── report.ts
│       └── interaction/          # Transcript and expectation types
│
├── core/                         # @mcp-qa/core - Shared utilities
│   └── src/
│       ├── auth/
│       │   ├── provider/         # TestOAuthProvider implementation
│       │   ├── handlers/         # CLI and Web auth handlers
│       │   └── session/          # Session stores (memory, redis)
│       ├── client/               # MCP client factory
│       └── utils/                # Token counting, report helpers
│
├── runner/                       # @mcp-qa/runner - Main test runner
│   └── src/
│       ├── phases/
│       │   ├── auth/             # Auth discovery phase
│       │   ├── protocol/         # Protocol conformance phase
│       │   ├── tools/            # Tool quality analysis phase
│       │   └── interaction/      # Claude interaction phase
│       └── runner.ts             # Main orchestration
│
├── cli/                          # @mcp-qa/cli - CLI interface
│   └── src/
│       ├── commands/             # CLI commands
│       └── output/               # Progress display utilities
│
└── web/                          # @mcp-qa/web - Next.js frontend
    ├── app/
    │   └── api/                  # API routes (run, status, oauth)
    ├── components/               # React components
    └── lib/                      # Server-side utilities
```

---

## 2. Phase 1: OAuth/Auth Testing (SDK-Leveraging Architecture)

### 2.1 Architecture Philosophy

**We do NOT build custom OAuth logic.** The MCP TypeScript SDK provides a complete, well-tested OAuth implementation. We:

1. **Implement `OAuthClientProvider`** - The SDK's interface for OAuth state management
2. **Use `auth()` directly** - The SDK's unified auth orchestration function
3. **Inject observability** - Record checks during provider callbacks, not by reimplementing OAuth
4. **Use built-in transport auth** - `StreamableHTTPClientTransport` handles auth automatically

### 2.2 SDK Components We Use Directly

| Function | Purpose | What We Do |
|----------|---------|------------|
| `auth()` | Master orchestrator - handles entire OAuth flow | Call it, observe results |
| `discoverOAuthProtectedResourceMetadata()` | RFC 9728 PRM discovery | Call before `auth()` to record check |
| `discoverAuthorizationServerMetadata()` | RFC 8414 AS metadata discovery | Call before `auth()` to record check |
| `extractWWWAuthenticateParams()` | Parse 401 response headers | Use in error handling |

### 2.3 TestOAuthProvider Implementation

```typescript
// packages/core/src/auth/provider/test-oauth-provider.ts

import {
  OAuthClientProvider,
  OAuthClientMetadata,
  OAuthClientInformationMixed,
  OAuthTokens
} from '@modelcontextprotocol/sdk/client/auth.js';
import type { TestCheck } from '@mcp-qa/types';

export interface AuthCheckRecorder {
  pushCheck(check: TestCheck): void;
}

export interface InteractiveAuthHandler {
  onAuthorizationRequired(url: URL): Promise<void>;
  waitForCallback(): Promise<{ code: string; state?: string }>;
}

/**
 * OAuth provider that records checks during the auth flow.
 *
 * This does NOT implement OAuth logic - that's all handled by the SDK.
 * We just implement the state management interface and record what happens.
 */
export class TestOAuthProvider implements OAuthClientProvider {
  private _clientInformation?: OAuthClientInformationMixed;
  private _tokens?: OAuthTokens;
  private _codeVerifier?: string;
  private _state?: string;
  private _authorizationCode?: string;

  constructor(
    private readonly config: {
      redirectUrl?: string | URL;
      clientMetadata: OAuthClientMetadata;
      clientMetadataUrl?: string;
      preRegisteredClient?: OAuthClientInformationMixed;
    },
    private readonly recorder: AuthCheckRecorder,
    private readonly interactiveHandler?: InteractiveAuthHandler
  ) {
    if (config.preRegisteredClient) {
      this._clientInformation = config.preRegisteredClient;
    }
  }

  // === Identity ===

  get redirectUrl(): string | URL | undefined {
    return this.config.redirectUrl;
  }

  get clientMetadata(): OAuthClientMetadata {
    return this.config.clientMetadata;
  }

  get clientMetadataUrl(): string | undefined {
    return this.config.clientMetadataUrl;
  }

  // === State Management with Check Recording ===

  clientInformation(): OAuthClientInformationMixed | undefined {
    return this._clientInformation;
  }

  saveClientInformation(info: OAuthClientInformationMixed): void {
    this._clientInformation = info;

    this.recorder.pushCheck({
      id: 'auth-client-registered',
      name: 'Client Registration',
      description: 'Successfully registered OAuth client',
      status: 'SUCCESS',
      timestamp: new Date().toISOString(),
      specReferences: [{ id: 'RFC-7591', url: 'https://www.rfc-editor.org/rfc/rfc7591.html' }],
      details: {
        clientId: info.client_id,
        usedCIMD: info.client_id.startsWith('https://'),
        hasSecret: 'client_secret' in info && !!info.client_secret,
      },
    });
  }

  tokens(): OAuthTokens | undefined {
    return this._tokens;
  }

  saveTokens(tokens: OAuthTokens): void {
    const hadTokens = !!this._tokens;
    this._tokens = tokens;

    this.recorder.pushCheck({
      id: hadTokens ? 'auth-tokens-refreshed' : 'auth-tokens-obtained',
      name: hadTokens ? 'Token Refresh' : 'Token Exchange',
      description: hadTokens ? 'Successfully refreshed OAuth tokens' : 'Successfully obtained OAuth tokens',
      status: 'SUCCESS',
      timestamp: new Date().toISOString(),
      details: {
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        expiresIn: tokens.expires_in,
        scope: tokens.scope,
      },
    });
  }

  saveCodeVerifier(codeVerifier: string): void {
    this._codeVerifier = codeVerifier;

    this.recorder.pushCheck({
      id: 'auth-pkce-generated',
      name: 'PKCE Generated',
      description: 'Generated PKCE code verifier for authorization',
      status: 'SUCCESS',
      timestamp: new Date().toISOString(),
      specReferences: [{ id: 'RFC-7636', url: 'https://www.rfc-editor.org/rfc/rfc7636.html' }],
    });
  }

  codeVerifier(): string {
    if (!this._codeVerifier) {
      throw new Error('No code verifier saved');
    }
    return this._codeVerifier;
  }

  state(): string {
    if (!this._state) {
      this._state = crypto.randomUUID();
    }
    return this._state;
  }

  // === Interactive Authorization ===

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    this.recorder.pushCheck({
      id: 'auth-redirect-initiated',
      name: 'Authorization Redirect',
      description: 'Authorization URL generated - awaiting user consent',
      status: 'INFO',
      timestamp: new Date().toISOString(),
      details: {
        authorizationEndpoint: authorizationUrl.origin + authorizationUrl.pathname,
        hasCodeChallenge: authorizationUrl.searchParams.has('code_challenge'),
        hasState: authorizationUrl.searchParams.has('state'),
        hasResource: authorizationUrl.searchParams.has('resource'),
        scope: authorizationUrl.searchParams.get('scope'),
      },
    });

    if (this.interactiveHandler) {
      // Interactive mode: notify handler and wait for callback
      // This works for both web UI and CLI with browser opening
      await this.interactiveHandler.onAuthorizationRequired(authorizationUrl);
      const callback = await this.interactiveHandler.waitForCallback();

      // Validate state to prevent CSRF
      if (callback.state && callback.state !== this._state) {
        this.recorder.pushCheck({
          id: 'auth-state-mismatch',
          name: 'State Validation',
          description: 'OAuth state parameter mismatch (potential CSRF)',
          status: 'FAILURE',
          timestamp: new Date().toISOString(),
          errorMessage: 'State parameter does not match',
        });
        throw new Error('OAuth state mismatch');
      }

      this._authorizationCode = callback.code;

      this.recorder.pushCheck({
        id: 'auth-callback-received',
        name: 'Authorization Callback',
        description: 'Received authorization callback with code',
        status: 'SUCCESS',
        timestamp: new Date().toISOString(),
      });
    } else {
      // No interactive handler - this is an error for real OAuth flows
      // User must provide an interactive handler or use pre-registered credentials
      this.recorder.pushCheck({
        id: 'auth-interactive-required',
        name: 'Interactive Auth Required',
        description: 'OAuth consent flow requires user interaction',
        status: 'FAILURE',
        timestamp: new Date().toISOString(),
        errorMessage: 'No interactive handler provided for OAuth consent flow. ' +
          'Either provide an InteractiveAuthHandler or use pre-registered client credentials.',
        details: {
          authorizationUrl: authorizationUrl.toString(),
        },
      });
      throw new Error(
        'Interactive OAuth flow requires an InteractiveAuthHandler. ' +
        'URL: ' + authorizationUrl.toString()
      );
    }
  }

  getAuthorizationCode(): string | undefined {
    return this._authorizationCode;
  }

  invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier'): void {
    this.recorder.pushCheck({
      id: 'auth-credentials-invalidated',
      name: 'Credentials Invalidated',
      description: `Invalidating ${scope} credentials due to error`,
      status: 'WARNING',
      timestamp: new Date().toISOString(),
      details: { scope },
    });

    switch (scope) {
      case 'all':
        this._clientInformation = undefined;
        this._tokens = undefined;
        this._codeVerifier = undefined;
        break;
      case 'client':
        this._clientInformation = undefined;
        break;
      case 'tokens':
        this._tokens = undefined;
        break;
      case 'verifier':
        this._codeVerifier = undefined;
        break;
    }
  }
}
```

### 2.4 Auth Phase Runner

```typescript
// packages/runner/src/phases/auth/auth-phase.ts

import {
  discoverOAuthProtectedResourceMetadata,
  discoverAuthorizationServerMetadata,
} from '@modelcontextprotocol/sdk/client/auth.js';
import { TestOAuthProvider, AuthCheckRecorder, InteractiveAuthHandler } from '@mcp-qa/core/auth';
import type { AuthConfig, TestCheck, PhaseResult } from '@mcp-qa/types';

/**
 * Run OAuth discovery/validation phase.
 *
 * This phase ONLY performs discovery and validation checks.
 * It does NOT perform the actual auth flow - that's handled by the
 * transport in the protocol phase, allowing proper 401 handling.
 */
export async function runAuthPhase(
  serverUrl: string,
  authConfig: AuthConfig,
  options: {
    recorder: AuthCheckRecorder;
    interactiveHandler?: InteractiveAuthHandler;
  }
): Promise<PhaseResult & { provider?: TestOAuthProvider }> {
  const checks: TestCheck[] = [];
  const startTime = new Date().toISOString();
  const startMs = Date.now();

  const recorder: AuthCheckRecorder = {
    pushCheck: (check) => {
      checks.push(check);
      options.recorder.pushCheck(check);
    },
  };

  // For no-auth servers, just test basic connectivity
  if (authConfig.type === 'none') {
    return await testNoAuth(serverUrl, recorder, startTime, startMs, checks);
  }

  // Build provider - this will be passed to the transport later
  const provider = buildProvider(authConfig, recorder, options.interactiveHandler);

  // === Discovery Check 1: PRM ===
  let prmMetadata;
  try {
    prmMetadata = await discoverOAuthProtectedResourceMetadata(serverUrl);

    recorder.pushCheck({
      id: 'auth-prm-discovered',
      name: 'PRM Discovery',
      description: 'Successfully discovered Protected Resource Metadata',
      status: 'SUCCESS',
      timestamp: new Date().toISOString(),
      specReferences: [{ id: 'RFC-9728', url: 'https://www.rfc-editor.org/rfc/rfc9728.html' }],
      details: {
        resource: prmMetadata.resource,
        authorizationServers: prmMetadata.authorization_servers,
        scopesSupported: prmMetadata.scopes_supported,
      },
    });
  } catch (error) {
    recorder.pushCheck({
      id: 'auth-prm-not-found',
      name: 'PRM Discovery',
      description: 'Protected Resource Metadata not found (may use legacy auth or require 401 challenge)',
      status: 'WARNING',
      timestamp: new Date().toISOString(),
      details: { error: error instanceof Error ? error.message : String(error) },
    });
  }

  // === Discovery Check 2: AS Metadata ===
  const authServerUrl = prmMetadata?.authorization_servers?.[0] || new URL('/', serverUrl).toString();

  let asMetadata;
  try {
    asMetadata = await discoverAuthorizationServerMetadata(authServerUrl);

    if (asMetadata) {
      recorder.pushCheck({
        id: 'auth-as-discovered',
        name: 'AS Metadata Discovery',
        description: 'Successfully discovered Authorization Server Metadata',
        status: 'SUCCESS',
        timestamp: new Date().toISOString(),
        specReferences: [{ id: 'RFC-8414', url: 'https://www.rfc-editor.org/rfc/rfc8414.html' }],
        details: {
          issuer: asMetadata.issuer,
          authorizationEndpoint: asMetadata.authorization_endpoint,
          tokenEndpoint: asMetadata.token_endpoint,
          registrationEndpoint: asMetadata.registration_endpoint,
          grantTypesSupported: asMetadata.grant_types_supported,
          codeChallengeMethodsSupported: asMetadata.code_challenge_methods_supported,
          tokenEndpointAuthMethodsSupported: asMetadata.token_endpoint_auth_methods_supported,
          cimdSupported: asMetadata.client_id_metadata_document_supported,
        },
      });

      // Validate PKCE support
      const pkceSupported = asMetadata.code_challenge_methods_supported?.includes('S256');
      recorder.pushCheck({
        id: 'auth-pkce-supported',
        name: 'PKCE S256 Support',
        description: pkceSupported ? 'Server supports PKCE S256' : 'Server may not support PKCE S256',
        status: pkceSupported ? 'SUCCESS' : 'WARNING',
        timestamp: new Date().toISOString(),
        specReferences: [{ id: 'RFC-7636', url: 'https://www.rfc-editor.org/rfc/rfc7636.html' }],
      });

      // Check DCR support
      if (asMetadata.registration_endpoint) {
        recorder.pushCheck({
          id: 'auth-dcr-available',
          name: 'DCR Endpoint',
          description: 'Dynamic Client Registration endpoint available',
          status: 'SUCCESS',
          timestamp: new Date().toISOString(),
          specReferences: [{ id: 'RFC-7591', url: 'https://www.rfc-editor.org/rfc/rfc7591.html' }],
        });
      }

      // Check CIMD support
      if (asMetadata.client_id_metadata_document_supported) {
        recorder.pushCheck({
          id: 'auth-cimd-supported',
          name: 'CIMD Support',
          description: 'Server supports Client ID Metadata Document',
          status: 'SUCCESS',
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (error) {
    recorder.pushCheck({
      id: 'auth-as-discovery-failed',
      name: 'AS Metadata Discovery',
      description: 'Failed to discover Authorization Server Metadata',
      status: 'WARNING',
      timestamp: new Date().toISOString(),
      details: { error: error instanceof Error ? error.message : String(error) },
    });
  }

  // NOTE: We do NOT call auth() here. The actual authentication
  // will happen when the transport connects and receives a 401.
  // The provider will record checks during that process.

  recorder.pushCheck({
    id: 'auth-discovery-complete',
    name: 'Discovery Phase Complete',
    description: 'Auth discovery complete. Actual auth will occur during connection.',
    status: 'INFO',
    timestamp: new Date().toISOString(),
  });

  return {
    phase: 'auth',
    name: 'Authentication Discovery',
    description: `Discovered auth configuration for ${authConfig.type}`,
    startTime,
    endTime: new Date().toISOString(),
    durationMs: Date.now() - startMs,
    checks,
    summary: summarizeChecks(checks),
    provider,  // Pass provider to protocol phase for use in transport
  };
}

async function testNoAuth(
  serverUrl: string,
  recorder: AuthCheckRecorder,
  startTime: string,
  startMs: number,
  checks: TestCheck[]
): Promise<PhaseResult> {
  try {
    const response = await fetch(serverUrl, { method: 'OPTIONS' });

    recorder.pushCheck({
      id: 'auth-none-accessible',
      name: 'Server Accessible',
      description: 'Server accessible without authentication',
      status: response.ok || response.status === 405 ? 'SUCCESS' : 'WARNING',
      timestamp: new Date().toISOString(),
      details: { status: response.status },
    });
  } catch (error) {
    recorder.pushCheck({
      id: 'auth-none-connection-failed',
      name: 'Server Connection',
      description: 'Failed to connect to server',
      status: 'FAILURE',
      timestamp: new Date().toISOString(),
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    phase: 'auth',
    name: 'Authentication Testing',
    description: 'Testing no-auth configuration',
    startTime,
    endTime: new Date().toISOString(),
    durationMs: Date.now() - startMs,
    checks,
    summary: summarizeChecks(checks),
  };
}

function buildProvider(
  authConfig: AuthConfig,
  recorder: AuthCheckRecorder,
  interactiveHandler?: InteractiveAuthHandler
): TestOAuthProvider {
  if (authConfig.type === 'none') {
    throw new Error('Cannot build provider for no-auth config');
  }

  if (authConfig.type === 'client_credentials') {
    return new TestOAuthProvider(
      {
        redirectUrl: undefined,
        clientMetadata: {
          grant_types: ['client_credentials'],
          redirect_uris: [],
          scope: authConfig.scopes?.join(' '),
        },
        preRegisteredClient: authConfig.clientId
          ? { client_id: authConfig.clientId, client_secret: authConfig.clientSecret }
          : undefined,
      },
      recorder
    );
  }

  if (authConfig.type === 'authorization_code') {
    return new TestOAuthProvider(
      {
        redirectUrl: authConfig.redirectUri || 'http://localhost:3000/oauth/callback',
        clientMetadata: {
          grant_types: ['authorization_code', 'refresh_token'],
          redirect_uris: [authConfig.redirectUri || 'http://localhost:3000/oauth/callback'],
          scope: authConfig.scopes?.join(' '),
        },
        clientMetadataUrl: authConfig.useDCR ? undefined : authConfig.clientMetadataUrl,
        preRegisteredClient: authConfig.clientId
          ? { client_id: authConfig.clientId, client_secret: authConfig.clientSecret }
          : undefined,
      },
      recorder,
      interactiveHandler
    );
  }

  throw new Error(`Unsupported auth type: ${(authConfig as any).type}`);
}

function getScopes(authConfig: AuthConfig): string[] | undefined {
  if (authConfig.type === 'none') return undefined;
  return authConfig.scopes;
}

function summarizeChecks(checks: TestCheck[]) {
  return {
    total: checks.length,
    success: checks.filter(c => c.status === 'SUCCESS').length,
    failure: checks.filter(c => c.status === 'FAILURE').length,
    warning: checks.filter(c => c.status === 'WARNING').length,
    skipped: checks.filter(c => c.status === 'SKIPPED').length,
  };
}
```

---

## 3. Phase 2: Protocol Conformance Testing

```typescript
// packages/runner/src/phases/protocol/protocol-phase.ts

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { TestCheck, PhaseResult } from '@mcp-qa/types';
import type { TestOAuthProvider } from '@mcp-qa/core/auth';

export async function runProtocolPhase(
  serverUrl: string,
  provider?: TestOAuthProvider,
  options?: {
    onProgress?: (check: TestCheck) => void;
    testCapabilities?: boolean;
  }
): Promise<PhaseResult & { client?: Client; transport?: StreamableHTTPClientTransport }> {
  const checks: TestCheck[] = [];
  const startTime = new Date().toISOString();
  const startMs = Date.now();

  const pushCheck = (check: TestCheck) => {
    checks.push(check);
    options?.onProgress?.(check);
  };

  let client: Client | undefined;
  let transport: StreamableHTTPClientTransport | undefined;

  try {
    // Create client
    client = new Client(
      { name: 'mcp-test-runner', version: '1.0.0' },
      { capabilities: { sampling: {}, elicitation: {} } }
    );

    pushCheck({
      id: 'protocol-client-created',
      name: 'Client Created',
      description: 'MCP client instance created',
      status: 'SUCCESS',
      timestamp: new Date().toISOString(),
    });

    // Create transport with auth provider (SDK handles auth automatically)
    transport = new StreamableHTTPClientTransport(
      new URL(serverUrl),
      { authProvider: provider }
    );

    pushCheck({
      id: 'protocol-transport-created',
      name: 'Transport Created',
      description: 'StreamableHTTP transport created',
      status: 'SUCCESS',
      timestamp: new Date().toISOString(),
    });

    // Connect - this is where auth actually happens via 401 handling
    await client.connect(transport);

    pushCheck({
      id: 'protocol-connected',
      name: 'Connection Established',
      description: 'Successfully connected to MCP server',
      status: 'SUCCESS',
      timestamp: new Date().toISOString(),
    });

    // Test server info
    const serverInfo = client.getServerVersion();
    pushCheck({
      id: 'protocol-server-info',
      name: 'Server Info',
      description: 'Retrieved server version information',
      status: serverInfo ? 'SUCCESS' : 'WARNING',
      timestamp: new Date().toISOString(),
      details: serverInfo,
    });

    // Test capabilities
    if (options?.testCapabilities !== false) {
      const serverCapabilities = client.getServerCapabilities();

      pushCheck({
        id: 'protocol-capabilities',
        name: 'Server Capabilities',
        description: 'Retrieved server capabilities',
        status: 'SUCCESS',
        timestamp: new Date().toISOString(),
        details: {
          hasTools: !!serverCapabilities?.tools,
          hasResources: !!serverCapabilities?.resources,
          hasPrompts: !!serverCapabilities?.prompts,
          hasLogging: !!serverCapabilities?.logging,
          hasExperimental: !!serverCapabilities?.experimental,
        },
      });
    }

  } catch (error) {
    pushCheck({
      id: 'protocol-connection-failed',
      name: 'Connection Failed',
      description: 'Failed to establish MCP connection',
      status: 'FAILURE',
      timestamp: new Date().toISOString(),
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    phase: 'protocol',
    name: 'Protocol Conformance',
    description: 'Testing MCP protocol handshake and capabilities',
    startTime,
    endTime: new Date().toISOString(),
    durationMs: Date.now() - startMs,
    checks,
    summary: summarizeChecks(checks),
    client,
    transport,
    // Cleanup function for resource management
    cleanup: async () => {
      try {
        if (transport) {
          await transport.close();
        }
        if (client) {
          await client.close();
        }
      } catch (e) {
        // Ignore cleanup errors - just ensure resources are released
      }
    },
  };
}

function summarizeChecks(checks: TestCheck[]) {
  return {
    total: checks.length,
    success: checks.filter(c => c.status === 'SUCCESS').length,
    failure: checks.filter(c => c.status === 'FAILURE').length,
    warning: checks.filter(c => c.status === 'WARNING').length,
    skipped: checks.filter(c => c.status === 'SKIPPED').length,
  };
}
```

---

## 4. Phase 3: Tool Quality Analysis

```typescript
// packages/runner/src/phases/tools/tools-phase.ts

import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { TestCheck, PhaseResult } from '@mcp-qa/types';
import { countTokens } from '@mcp-qa/core/utils';

export interface ToolMetrics {
  name: string;
  descriptionTokens: number;
  schemaTokens: number;
  totalTokens: number;
  hasDescription: boolean;
  hasInputSchema: boolean;
  hasOutputSchema: boolean;
  hasAnnotations: boolean;
  annotationDetails?: Record<string, unknown>;
}

export async function runToolsPhase(
  client: Client,
  options?: {
    onProgress?: (check: TestCheck) => void;
    analyzeTokenCounts?: boolean;
  }
): Promise<PhaseResult & { toolMetrics?: ToolMetrics[] }> {
  const checks: TestCheck[] = [];
  const startTime = new Date().toISOString();
  const startMs = Date.now();
  let toolMetrics: ToolMetrics[] = [];

  const pushCheck = (check: TestCheck) => {
    checks.push(check);
    options?.onProgress?.(check);
  };

  try {
    const result = await client.listTools();

    pushCheck({
      id: 'tools-list-success',
      name: 'List Tools',
      description: `Server exposes ${result.tools.length} tools`,
      status: 'SUCCESS',
      timestamp: new Date().toISOString(),
      details: {
        toolCount: result.tools.length,
        toolNames: result.tools.map(t => t.name),
      },
    });

    if (result.tools.length === 0) {
      pushCheck({
        id: 'tools-none-available',
        name: 'No Tools Available',
        description: 'Server has no tools defined',
        status: 'WARNING',
        timestamp: new Date().toISOString(),
      });
    }

    // Analyze each tool
    if (options?.analyzeTokenCounts !== false) {
      toolMetrics = result.tools.map(tool => analyzeToolMetrics(tool));

      const totalTokens = toolMetrics.reduce((sum, m) => sum + m.totalTokens, 0);
      const avgTokens = toolMetrics.length > 0 ? Math.round(totalTokens / toolMetrics.length) : 0;

      pushCheck({
        id: 'tools-token-analysis',
        name: 'Token Analysis',
        description: `Total: ${totalTokens} tokens, Average: ${avgTokens} tokens/tool`,
        status: totalTokens > 50000 ? 'WARNING' : 'SUCCESS',
        timestamp: new Date().toISOString(),
        details: {
          totalTokens,
          averageTokensPerTool: avgTokens,
          largestTool: toolMetrics.length > 0
            ? toolMetrics.reduce((max, m) => m.totalTokens > max.totalTokens ? m : max).name
            : null,
        },
      });

      // Check for quality issues
      for (const metrics of toolMetrics) {
        if (!metrics.hasDescription) {
          pushCheck({
            id: `tools-${metrics.name}-no-description`,
            name: `Tool: ${metrics.name}`,
            description: 'Tool is missing a description',
            status: 'WARNING',
            timestamp: new Date().toISOString(),
          });
        }

        if (metrics.totalTokens > 5000) {
          pushCheck({
            id: `tools-${metrics.name}-large`,
            name: `Tool: ${metrics.name}`,
            description: `Tool definition is large (${metrics.totalTokens} tokens)`,
            status: 'WARNING',
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

  } catch (error) {
    pushCheck({
      id: 'tools-list-failed',
      name: 'List Tools Failed',
      description: 'Failed to list tools from server',
      status: 'FAILURE',
      timestamp: new Date().toISOString(),
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    phase: 'tools',
    name: 'Tool Quality Analysis',
    description: 'Analyzing tool definitions and quality metrics',
    startTime,
    endTime: new Date().toISOString(),
    durationMs: Date.now() - startMs,
    checks,
    summary: summarizeChecks(checks),
    toolMetrics,
  };
}

function analyzeToolMetrics(tool: Tool): ToolMetrics {
  const descriptionText = tool.description || '';
  const schemaText = JSON.stringify(tool.inputSchema || {});

  return {
    name: tool.name,
    descriptionTokens: countTokens(descriptionText),
    schemaTokens: countTokens(schemaText),
    totalTokens: countTokens(descriptionText) + countTokens(schemaText),
    hasDescription: !!tool.description,
    hasInputSchema: !!tool.inputSchema && Object.keys(tool.inputSchema).length > 0,
    hasOutputSchema: !!(tool as any).outputSchema,
    hasAnnotations: !!(tool as any).annotations,
    annotationDetails: (tool as any).annotations,
  };
}

function summarizeChecks(checks: TestCheck[]) {
  return {
    total: checks.length,
    success: checks.filter(c => c.status === 'SUCCESS').length,
    failure: checks.filter(c => c.status === 'FAILURE').length,
    warning: checks.filter(c => c.status === 'WARNING').length,
    skipped: checks.filter(c => c.status === 'SKIPPED').length,
  };
}
```

---

## 5. Phase 4: Claude-Powered Interaction Testing

```typescript
// packages/runner/src/phases/interaction/interaction-phase.ts

import Anthropic from '@anthropic-ai/sdk';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { TestCheck, PhaseResult, TestPrompt } from '@mcp-qa/types';
import { TranscriptRecorder } from './transcript';
import { reviewSafety } from './safety-review';
import { reviewQuality } from './quality-review';

const MAX_ITERATIONS = 20;

export async function runInteractionPhase(
  client: Client,
  testPrompts: TestPrompt[],
  options: {
    anthropicApiKey: string;
    transcriptDir: string;
    onProgress?: (check: TestCheck) => void;
    safetyReviewModel?: string;
    qualityReviewModel?: string;
  }
): Promise<PhaseResult> {
  const checks: TestCheck[] = [];
  const startTime = new Date().toISOString();
  const startMs = Date.now();

  const pushCheck = (check: TestCheck) => {
    checks.push(check);
    options.onProgress?.(check);
  };

  const anthropic = new Anthropic({
    apiKey: options.anthropicApiKey,
  });

  // Get tools from MCP client and convert to Claude format
  const toolsResult = await client.listTools();
  const claudeTools = toolsResult.tools.map(tool => ({
    name: tool.name,
    description: tool.description || '',
    input_schema: tool.inputSchema || { type: 'object', properties: {} },
  }));

  pushCheck({
    id: 'interaction-tools-loaded',
    name: 'Tools Loaded for Claude',
    description: `Loaded ${claudeTools.length} tools for Claude interaction`,
    status: 'SUCCESS',
    timestamp: new Date().toISOString(),
    details: { toolNames: claudeTools.map(t => t.name) },
  });

  // Run each test prompt
  for (const testPrompt of testPrompts) {
    const promptResult = await runSinglePrompt(
      anthropic,
      client,
      claudeTools,
      testPrompt,
      options,
      pushCheck
    );

    // Run safety review
    if (testPrompt.safetyPolicies?.length) {
      await reviewSafety(
        promptResult.transcript,
        testPrompt.safetyPolicies,
        options.safetyReviewModel || 'claude-3-haiku-20240307',
        anthropic,
        pushCheck
      );
    }

    // Run quality review
    await reviewQuality(
      promptResult.transcript,
      testPrompt.expectations,
      options.qualityReviewModel || 'claude-3-haiku-20240307',
      anthropic,
      pushCheck
    );
  }

  return {
    phase: 'interaction',
    name: 'Claude Interaction Testing',
    description: `Tested ${testPrompts.length} prompts`,
    startTime,
    endTime: new Date().toISOString(),
    durationMs: Date.now() - startMs,
    checks,
    summary: summarizeChecks(checks),
  };
}

async function runSinglePrompt(
  anthropic: Anthropic,
  mcpClient: Client,
  claudeTools: any[],
  testPrompt: TestPrompt,
  options: { transcriptDir: string },
  pushCheck: (check: TestCheck) => void
): Promise<{ transcript: any; transcriptPath: string }> {
  const recorder = new TranscriptRecorder(testPrompt.id);
  const messages: Anthropic.MessageParam[] = [];
  const maxIterations = testPrompt.maxIterations || MAX_ITERATIONS;

  messages.push({ role: 'user', content: testPrompt.prompt });
  recorder.recordUserMessage(testPrompt.prompt);

  pushCheck({
    id: `interaction-${testPrompt.id}-start`,
    name: `Prompt: ${testPrompt.name}`,
    description: 'Starting interaction test',
    status: 'INFO',
    timestamp: new Date().toISOString(),
  });

  let iterations = 0;
  let continueLoop = true;
  const toolsCalled: Array<{ toolName: string; arguments: any; result: any }> = [];

  while (continueLoop && iterations < maxIterations) {
    iterations++;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      tools: claudeTools,
      messages,
    });

    recorder.recordClaudeResponse(response);

    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    if (toolUseBlocks.length === 0) {
      continueLoop = false;
      const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === 'text'
      );
      if (textBlocks.length > 0) {
        recorder.recordFinalResponse(textBlocks.map(b => b.text).join('\n'));
      }
      break;
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      recorder.recordToolCall(toolUse.name, toolUse.input);

      try {
        const result = await mcpClient.callTool({
          name: toolUse.name,
          arguments: toolUse.input as Record<string, unknown>,
        });

        recorder.recordToolResult(toolUse.name, result);
        toolsCalled.push({
          toolName: toolUse.name,
          arguments: toolUse.input,
          result,
        });

        const resultContent = result.content
          .map(c => {
            if (c.type === 'text') return c.text;
            if (c.type === 'image') return '[Image content]';
            return JSON.stringify(c);
          })
          .join('\n');

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: resultContent,
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        recorder.recordToolError(toolUse.name, errorMessage);

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: `Error: ${errorMessage}`,
          is_error: true,
        });
      }
    }

    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: toolResults });

    if (response.stop_reason === 'end_turn') {
      continueLoop = false;
    }
  }

  const transcriptPath = await recorder.saveToFile(options.transcriptDir);

  pushCheck({
    id: `interaction-${testPrompt.id}-complete`,
    name: `Prompt: ${testPrompt.name}`,
    description: `Completed in ${iterations} iterations, ${toolsCalled.length} tool calls`,
    status: 'SUCCESS',
    timestamp: new Date().toISOString(),
    details: {
      iterations,
      toolCallCount: toolsCalled.length,
      toolsUsed: [...new Set(toolsCalled.map(t => t.toolName))],
      transcriptPath,
    },
  });

  // Evaluate against expectations
  if (testPrompt.expectations?.expectedToolCalls) {
    const evaluation = evaluateToolCalls(
      testPrompt.expectations.expectedToolCalls,
      toolsCalled
    );

    pushCheck({
      id: `interaction-${testPrompt.id}-evaluation`,
      name: `Prompt: ${testPrompt.name} Evaluation`,
      description: evaluation.passed ? 'Expectations met' : 'Expectations not met',
      status: evaluation.passed ? 'SUCCESS' : 'FAILURE',
      timestamp: new Date().toISOString(),
      details: {
        expected: testPrompt.expectations.expectedToolCalls,
        actual: toolsCalled.map(t => ({ toolName: t.toolName, arguments: t.arguments })),
        missing: evaluation.missing,
      },
    });
  }

  return {
    transcript: recorder.getTranscript(),
    transcriptPath,
  };
}

function evaluateToolCalls(
  expected: Array<{ toolName: string; argumentsContain?: Record<string, unknown> }>,
  actual: Array<{ toolName: string; arguments: any }>
) {
  const missing: typeof expected = [];

  for (const exp of expected) {
    const found = actual.find(act => {
      if (act.toolName !== exp.toolName) return false;
      if (exp.argumentsContain) {
        for (const [key, value] of Object.entries(exp.argumentsContain)) {
          if (JSON.stringify(act.arguments[key]) !== JSON.stringify(value)) {
            return false;
          }
        }
      }
      return true;
    });

    if (!found) {
      missing.push(exp);
    }
  }

  return {
    passed: missing.length === 0,
    missing,
  };
}

function summarizeChecks(checks: TestCheck[]) {
  return {
    total: checks.length,
    success: checks.filter(c => c.status === 'SUCCESS').length,
    failure: checks.filter(c => c.status === 'FAILURE').length,
    warning: checks.filter(c => c.status === 'WARNING').length,
    skipped: checks.filter(c => c.status === 'SKIPPED').length,
  };
}
```

---

## 6. Supporting Components

### 6.1 Transcript Recorder

We will build this as required.

### 6.2 Safety Review
We will build this as required.

### 6.3 Quality Review

```typescript
// packages/runner/src/phases/interaction/quality-review.ts

import type Anthropic from '@anthropic-ai/sdk';
import type { TestCheck } from '@mcp-qa/types';

export async function reviewQuality(
  transcript: any,
  expectations: any,
  model: string,
  anthropic: Anthropic,
  pushCheck: (check: TestCheck) => void
): Promise<void> {
  const prompt = `Analyze this interaction transcript for quality.

Transcript:
${JSON.stringify(transcript, null, 2)}

${expectations?.customValidation ? `Custom validation criteria: ${expectations.customValidation}` : ''}

Evaluate:
1. Did the interaction complete successfully?
2. Were tool calls appropriate for the task?
3. Was the final response helpful and accurate?
4. Were there any errors or issues?

Respond in JSON format:
{
  "overallQuality": "high" | "medium" | "low",
  "completedSuccessfully": true/false,
  "appropriateToolUsage": true/false,
  "issues": ["list of issues if any"],
  "recommendations": ["improvement suggestions"]
}`;

  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);

      pushCheck({
        id: `quality-overall`,
        name: 'Quality Assessment',
        description: `Overall quality: ${result.overallQuality}`,
        status: result.overallQuality === 'high' ? 'SUCCESS' :
                result.overallQuality === 'medium' ? 'WARNING' : 'FAILURE',
        timestamp: new Date().toISOString(),
        details: {
          completedSuccessfully: result.completedSuccessfully,
          appropriateToolUsage: result.appropriateToolUsage,
          issues: result.issues,
          recommendations: result.recommendations,
        },
      });
    }
  } catch (error) {
    pushCheck({
      id: 'quality-review-failed',
      name: 'Quality Review',
      description: 'Failed to complete quality review',
      status: 'WARNING',
      timestamp: new Date().toISOString(),
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}
```

### 6.4 Token Counting

We will build this as required using the anthropic tokenizer or similar.

---

## 7. Main Test Runner

```typescript
// packages/runner/src/runner.ts

import * as fs from 'fs/promises';
import { TestConfigSchema, type TestConfig, type TestReport, type PhaseResult, type TestCheck } from '@mcp-qa/types';
import { createCLIAuthHandler, type InteractiveAuthHandler } from '@mcp-qa/core/auth';
import { runAuthPhase } from './phases/auth/auth-phase';
import { runProtocolPhase } from './phases/protocol/protocol-phase';
import { runToolsPhase } from './phases/tools/tools-phase';
import { runInteractionPhase } from './phases/interaction/interaction-phase';

export async function runTests(
  configPath: string,
  options?: {
    anthropicApiKey?: string;
    onProgress?: (phase: string, check: TestCheck) => void;
    interactive?: boolean;  // Enable interactive OAuth flow (CLI mode)
    interactiveHandler?: InteractiveAuthHandler;  // Custom handler (web mode)
  }
): Promise<TestReport> {
  const configRaw = await fs.readFile(configPath, 'utf-8');
  const config = TestConfigSchema.parse(JSON.parse(configRaw));

  const report: TestReport = {
    version: '1.0',
    serverUrl: config.server.url,
    serverName: config.server.name,
    startTime: new Date().toISOString(),
    endTime: '',
    totalDurationMs: 0,
    phases: [],
    overallStatus: 'PASS',
    summary: { totalChecks: 0, passed: 0, failed: 0, warnings: 0, skipped: 0 },
  };

  const startMs = Date.now();

  // Track cleanup functions for resource management
  const cleanupFns: Array<() => Promise<void>> = [];

  try {
    // Phase 1: Auth (discovery only - actual auth happens in protocol phase)
    if (config.phases?.auth?.enabled !== false) {
      // Create interactive handler if needed:
      // - Use provided handler (web mode)
      // - Or create CLI handler if --interactive flag is set
      const interactiveHandler = options?.interactiveHandler
        ?? (options?.interactive ? createCLIAuthHandler() : undefined);

      const authResult = await runAuthPhase(
        config.server.url,
        config.auth,
        {
          recorder: {
            pushCheck: (check) => options?.onProgress?.('auth', check),
          },
          interactiveHandler,
        }
      );
      report.phases.push(authResult);
      if (authResult.cleanup) cleanupFns.push(authResult.cleanup);

      // Phase 2: Protocol (using auth provider - auth happens here via 401)
      if (config.phases?.protocol?.enabled !== false) {
        const protocolResult = await runProtocolPhase(
          config.server.url,
          authResult.provider,
          {
            onProgress: (check) => options?.onProgress?.('protocol', check),
            testCapabilities: config.phases?.protocol?.testCapabilities,
          }
        );
        report.phases.push(protocolResult);
        if (protocolResult.cleanup) cleanupFns.push(protocolResult.cleanup);

        // Phase 3: Tools
        if (config.phases?.tools?.enabled !== false && protocolResult.client) {
          const toolsResult = await runToolsPhase(
            protocolResult.client,
            {
              onProgress: (check) => options?.onProgress?.('tools', check),
              analyzeTokenCounts: config.phases?.tools?.analyzeTokenCounts,
            }
          );
          report.phases.push(toolsResult);
          if (toolsResult.cleanup) cleanupFns.push(toolsResult.cleanup);
        }

        // Phase 4: Interaction
        const prompts = config.phases?.interaction?.prompts || [];
        if (config.phases?.interaction?.enabled !== false && prompts.length > 0 && protocolResult.client) {
          const anthropicApiKey = options?.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
          if (!anthropicApiKey) {
            throw new Error('ANTHROPIC_API_KEY required for interaction testing');
          }

          const interactionResult = await runInteractionPhase(
            protocolResult.client,
            prompts,
            {
              anthropicApiKey,
              transcriptDir: config.output?.transcriptDir || './transcripts',
              onProgress: (check) => options?.onProgress?.('interaction', check),
              safetyReviewModel: config.phases?.interaction?.safetyReviewModel,
              qualityReviewModel: config.phases?.interaction?.qualityReviewModel,
            }
          );
          report.phases.push(interactionResult);
          if (interactionResult.cleanup) cleanupFns.push(interactionResult.cleanup);
        }
      }
    }

    // Finalize report
    report.endTime = new Date().toISOString();
    report.totalDurationMs = Date.now() - startMs;

    for (const phase of report.phases) {
      report.summary.totalChecks += phase.summary.total;
      report.summary.passed += phase.summary.success;
      report.summary.failed += phase.summary.failure;
      report.summary.warnings += phase.summary.warning;
      report.summary.skipped += phase.summary.skipped;
    }

    report.overallStatus = report.summary.failed > 0 ? 'FAIL' :
                           report.summary.warnings > 0 ? 'WARN' : 'PASS';

    // Save report
    const reportPath = config.output?.reportPath || './test-report.json';
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    return report;

  } finally {
    // Always run cleanup, even if tests fail
    // Run in reverse order for proper teardown (last opened = first closed)
    for (const cleanup of cleanupFns.reverse()) {
      try {
        await cleanup();
      } catch (e) {
        // Log but don't throw - we want to clean up everything
        console.error('Cleanup error:', e);
      }
    }
  }
}
```

### 7.1 CLI Entry Point

```typescript
// packages/cli/src/bin.ts
#!/usr/bin/env bun

import { runTests } from '@mcp-qa/runner';

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help')) {
  console.log(`
MCP Server Test Runner

Usage:
  mcp-test <config.json> [options]

Options:
  --anthropic-key <key>  Anthropic API key (or set ANTHROPIC_API_KEY)
  --interactive          Enable interactive OAuth flow (opens browser for consent)
  --verbose              Show detailed progress
  --help                 Show this help

Example:
  mcp-test ./test-config.json --verbose --interactive
`);
  process.exit(0);
}

const configPath = args[0];
const verbose = args.includes('--verbose');
const interactive = args.includes('--interactive');
const keyIndex = args.indexOf('--anthropic-key');
const anthropicApiKey = keyIndex >= 0 ? args[keyIndex + 1] : undefined;

runTests(configPath, {
  anthropicApiKey,
  interactive,
  onProgress: verbose ? (phase, check) => {
    const icon = check.status === 'SUCCESS' ? '✓' :
                 check.status === 'FAILURE' ? '✗' :
                 check.status === 'WARNING' ? '⚠' : '•';
    console.log(`[${phase}] ${icon} ${check.name}: ${check.description}`);
  } : undefined,
})
  .then(report => {
    console.log(`\nTest completed: ${report.overallStatus}`);
    console.log(`  Total: ${report.summary.totalChecks}`);
    console.log(`  Passed: ${report.summary.passed}`);
    console.log(`  Failed: ${report.summary.failed}`);
    console.log(`  Warnings: ${report.summary.warnings}`);
    process.exit(report.overallStatus === 'FAIL' ? 1 : 0);
  })
  .catch(error => {
    console.error('Test runner failed:', error);
    process.exit(1);
  });
```

### 7.2 CLI Interactive Auth Handler

```typescript
// packages/core/src/auth/handlers/cli-handler.ts

import type { InteractiveAuthHandler } from '../provider/test-oauth-provider';
import { createServer, type Server } from 'http';
import open from 'open';  // npm package to open browser

/**
 * CLI interactive auth handler that:
 * 1. Opens the authorization URL in the user's browser
 * 2. Spins up a temporary HTTP server to receive the callback
 * 3. Returns the authorization code
 */
export function createCLIAuthHandler(
  callbackPort: number = 3456
): InteractiveAuthHandler {
  let pendingResolve: ((value: { code: string; state?: string }) => void) | null = null;
  let pendingReject: ((error: Error) => void) | null = null;
  let server: Server | null = null;

  return {
    async onAuthorizationRequired(authorizationUrl: URL): Promise<void> {
      console.log('\n🔐 OAuth Authorization Required');
      console.log('Opening browser for consent...');
      console.log(`URL: ${authorizationUrl.toString()}\n`);

      // Open browser
      await open(authorizationUrl.toString());

      // Start callback server
      server = createServer((req, res) => {
        const url = new URL(req.url || '/', `http://localhost:${callbackPort}`);

        if (url.pathname === '/oauth/callback') {
          const code = url.searchParams.get('code');
          const state = url.searchParams.get('state');
          const error = url.searchParams.get('error');

          if (error) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                  <h1 style="color: #dc2626;">Authorization Failed</h1>
                  <p>Error: ${error}</p>
                  <p>You can close this window.</p>
                </body>
              </html>
            `);
            pendingReject?.(new Error(error));
          } else if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                  <h1 style="color: #16a34a;">Authorization Successful</h1>
                  <p>You can close this window and return to the terminal.</p>
                </body>
              </html>
            `);
            pendingResolve?.({ code, state: state || undefined });
          } else {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<h1>Invalid Callback</h1>');
          }

          // Cleanup server after response
          setTimeout(() => server?.close(), 100);
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      });

      server.listen(callbackPort);
      console.log(`Listening for callback on http://localhost:${callbackPort}/oauth/callback`);
      console.log('Waiting for you to complete authorization in the browser...\n');
    },

    waitForCallback(): Promise<{ code: string; state?: string }> {
      return new Promise((resolve, reject) => {
        pendingResolve = resolve;
        pendingReject = reject;

        // Timeout after 5 minutes
        setTimeout(() => {
          reject(new Error('OAuth callback timeout (5 minutes)'));
          server?.close();
        }, 5 * 60 * 1000);
      });
    },
  };
}
```

---

## 8. Web Platform (Next.js)

### 8.1 Architecture Overview

> **Note:** For detailed web package structure, see [packages/web/README.md](./packages/web/README.md).

```
packages/web/
├── app/
│   ├── page.tsx              # Dashboard
│   ├── test/
│   │   └── [id]/page.tsx     # Test detail view
│   └── api/
│       ├── run/route.ts      # Start test run
│       ├── status/route.ts   # SSE for progress
│       └── oauth/
│           ├── callback/route.ts    # OAuth callback handler
│           └── poll/[runId]/route.ts  # Poll for callback status
├── components/
│   ├── config/               # Configuration editor components
│   ├── results/              # Result display components
│   └── transcript/           # Transcript viewer
└── lib/
    ├── runner.ts             # Server-side runner wrapper
    └── session-store.ts      # Session store factory
```

### 8.2 Cross-Process OAuth Session Management

#### The Problem

The OAuth callback flow in the web platform has a critical architectural challenge:

1. **Serverless Reality**: Next.js on Vercel/similar runs each request in isolated serverless functions with no shared memory
2. **Process Isolation**: The test runner may run as a separate process (background job, worker, etc.) from the web server receiving OAuth callbacks
3. **No Shared Memory**: In-memory Maps cannot work across process/instance boundaries

### Solution: Session Store + Polling Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                              FLOW                                       │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   1. Runner generates runId, stores session as "pending"                │
│                     │                                                   │
│                     ▼                                                   │
│   2. Runner encodes runId in OAuth state: "mcp:{runId}:{originalState}" │
│                     │                                                   │
│                     ▼                                                   │
│   3. Runner returns auth URL to web UI, starts polling                  │
│                     │                                                   │
│   ┌─────────────────┼─────────────────┐                                │
│   │                 │                 │                                 │
│   ▼                 ▼                 ▼                                 │
│ [Web UI]        [Session Store]    [Runner]                            │
│ Opens URL       (Redis/DB/KV)      Polls /api/auth/poll/{runId}        │
│   │                 │                 │                                 │
│   ▼                 │                 │                                 │
│ User consents       │                 │                                 │
│   │                 │                 │                                 │
│   ▼                 │                 │                                 │
│ AS redirects to     │                 │                                 │
│ /api/auth/callback  │                 │                                 │
│   │                 │                 │                                 │
│   ▼                 ▼                 │                                 │
│ 4. Callback handler parses state,    │                                 │
│    extracts runId, updates session   │                                 │
│    to "callback_received"            │                                 │
│                     │                 │                                 │
│                     ▼                 ▼                                 │
│                 5. Runner's poll sees update,                          │
│                    gets code, continues auth flow                      │
│                                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

#### 8.2.1 Session Store Interface

```typescript
// packages/core/src/auth/session/types.ts

export interface AuthSession {
  runId: string;
  status: 'pending' | 'callback_received' | 'error' | 'expired';
  createdAt: string;
  expiresAt: string;

  // Set when authorization URL is generated
  authorizationUrl?: string;
  originalState?: string;  // The PKCE state before encoding

  // Set when callback is received
  callbackData?: {
    code: string;
    state: string;  // The encoded state from callback
  };

  // Set on error
  error?: string;
}

export interface AuthSessionStore {
  /**
   * Create a new pending session
   */
  create(runId: string, expiresInMs?: number): Promise<void>;

  /**
   * Get session by runId
   */
  get(runId: string): Promise<AuthSession | null>;

  /**
   * Update session with authorization URL and original state
   */
  setAuthorizationUrl(runId: string, url: string, originalState: string): Promise<void>;

  /**
   * Update session when callback is received
   */
  updateWithCallback(runId: string, code: string, state: string): Promise<void>;

  /**
   * Update session with error
   */
  updateWithError(runId: string, error: string): Promise<void>;

  /**
   * Delete session (cleanup)
   */
  delete(runId: string): Promise<void>;
}
```

#### 8.2.2 State Parameter Encoding

The OAuth `state` parameter serves dual purposes:
1. **CSRF Protection**: Original PKCE-generated state
2. **Session Tracking**: Our `runId` for cross-process communication

```typescript
// packages/core/src/auth/state-encoding.ts

const STATE_PREFIX = 'mcp';
const STATE_SEPARATOR = ':';

/**
 * Encode runId and original state into OAuth state parameter
 * Format: "mcp:{runId}:{originalState}"
 */
export function encodeState(runId: string, originalState: string): string {
  return `${STATE_PREFIX}${STATE_SEPARATOR}${runId}${STATE_SEPARATOR}${originalState}`;
}

/**
 * Decode OAuth state parameter back to runId and original state
 */
export function decodeState(encodedState: string): { runId: string; originalState: string } | null {
  const parts = encodedState.split(STATE_SEPARATOR);

  if (parts[0] !== STATE_PREFIX || parts.length < 3) {
    return null;  // Not our encoded state
  }

  const runId = parts[1];
  // Original state may contain separators, so join remaining parts
  const originalState = parts.slice(2).join(STATE_SEPARATOR);

  return { runId, originalState };
}
```

#### 8.2.3 Web Interactive Auth Handler

For the web platform, the `InteractiveAuthHandler` works differently from CLI:
- It stores the session, modifies the state, and returns the URL
- The web UI opens the URL (not the handler)
- It polls the session store for callback completion

```typescript
// packages/core/src/auth/handlers/web-handler.ts

import type { InteractiveAuthHandler } from '../provider/test-oauth-provider';
import type { AuthSessionStore } from '../session/types';
import { encodeState } from '../state-encoding';

/**
 * Web platform interactive auth handler.
 *
 * Unlike CLI handler which opens browser directly,
 * this handler integrates with the session store for
 * cross-process OAuth callback handling.
 */
export function createWebAuthHandler(
  sessionStore: AuthSessionStore,
  runId: string,
  options: {
    pollIntervalMs?: number;
    timeoutMs?: number;
    onAuthUrlReady?: (url: URL) => void;  // Callback when URL is ready
  } = {}
): InteractiveAuthHandler {
  const {
    pollIntervalMs = 2000,
    timeoutMs = 5 * 60 * 1000,  // 5 minutes default
  } = options;

  return {
    async onAuthorizationRequired(authorizationUrl: URL): Promise<void> {
      // 1. Create pending session
      await sessionStore.create(runId, timeoutMs);

      // 2. Get original state from URL
      const originalState = authorizationUrl.searchParams.get('state') || '';

      // 3. Encode our runId into the state parameter
      const encodedState = encodeState(runId, originalState);
      authorizationUrl.searchParams.set('state', encodedState);

      // 4. Store the authorization URL and original state
      await sessionStore.setAuthorizationUrl(
        runId,
        authorizationUrl.toString(),
        originalState
      );

      // 5. Notify that URL is ready (web UI will open it)
      options.onAuthUrlReady?.(authorizationUrl);
    },

    async waitForCallback(): Promise<{ code: string; state?: string }> {
      const deadline = Date.now() + timeoutMs;

      while (Date.now() < deadline) {
        const session = await sessionStore.get(runId);

        if (!session) {
          throw new Error(`Session not found: ${runId}`);
        }

        if (session.status === 'callback_received' && session.callbackData) {
          // Return the original state (for CSRF validation in provider)
          return {
            code: session.callbackData.code,
            state: session.originalState,
          };
        }

        if (session.status === 'error') {
          throw new Error(session.error || 'OAuth authorization failed');
        }

        if (session.status === 'expired') {
          throw new Error('OAuth session expired');
        }

        // Wait before polling again
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      }

      // Timeout - mark session as expired
      await sessionStore.updateWithError(runId, 'OAuth callback timeout');
      throw new Error(`OAuth callback timeout after ${timeoutMs}ms`);
    },
  };
}
```

#### 8.2.4 OAuth Callback API Route

```typescript
// packages/web/app/api/oauth/callback/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSessionStore } from '@/lib/session-store';
import { decodeState } from '@mcp-qa/core/auth';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Parse the encoded state to get runId
  if (!state) {
    return createErrorPage('Missing state parameter');
  }

  const decoded = decodeState(state);
  if (!decoded) {
    return createErrorPage('Invalid state format');
  }

  const { runId } = decoded;
  const sessionStore = getSessionStore();

  // Handle error response from authorization server
  if (error) {
    await sessionStore.updateWithError(
      runId,
      errorDescription || error
    );

    return createResultPage({
      success: false,
      title: 'Authorization Failed',
      message: errorDescription || error,
      runId,
    });
  }

  // Handle success - store the callback data
  if (!code) {
    return createErrorPage('Missing authorization code');
  }

  await sessionStore.updateWithCallback(runId, code, state);

  return createResultPage({
    success: true,
    title: 'Authorization Successful',
    message: 'You can close this window and return to the test runner.',
    runId,
  });
}

function createErrorPage(message: string): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html>
    <html>
      <head><title>OAuth Error</title></head>
      <body style="font-family: system-ui; padding: 40px; text-align: center;">
        <h1 style="color: #dc2626;">Error</h1>
        <p>${escapeHtml(message)}</p>
      </body>
    </html>`,
    { headers: { 'Content-Type': 'text/html' } }
  );
}

function createResultPage(options: {
  success: boolean;
  title: string;
  message: string;
  runId: string;
}): NextResponse {
  const color = options.success ? '#16a34a' : '#dc2626';

  return new NextResponse(
    `<!DOCTYPE html>
    <html>
      <head>
        <title>${escapeHtml(options.title)}</title>
        <script>
          // Attempt to close window after brief delay
          setTimeout(() => window.close(), 2000);

          // Send message to opener if available (for popup flow)
          if (window.opener) {
            window.opener.postMessage({
              type: 'oauth_callback',
              success: ${options.success},
              runId: '${options.runId}'
            }, '*');
          }
        </script>
      </head>
      <body style="font-family: system-ui; padding: 40px; text-align: center;">
        <h1 style="color: ${color};">${escapeHtml(options.title)}</h1>
        <p>${escapeHtml(options.message)}</p>
        <p style="color: #666; font-size: 14px;">This window will close automatically...</p>
      </body>
    </html>`,
    { headers: { 'Content-Type': 'text/html' } }
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

#### 8.2.5 Polling API Route

```typescript
// packages/web/app/api/oauth/poll/[runId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSessionStore } from '@/lib/session-store';

export async function GET(
  request: NextRequest,
  { params }: { params: { runId: string } }
) {
  const sessionStore = getSessionStore();
  const session = await sessionStore.get(params.runId);

  if (!session) {
    return NextResponse.json(
      { error: 'Session not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    status: session.status,
    // Only include callback data if ready
    ...(session.status === 'callback_received' && session.callbackData
      ? { code: session.callbackData.code }
      : {}
    ),
    ...(session.status === 'error'
      ? { error: session.error }
      : {}
    ),
  });
}
```

#### 8.2.6 Session Store Implementations

#### In-Memory (Development Only)

```typescript
// packages/core/src/auth/session/memory-store.ts

import type { AuthSession, AuthSessionStore } from './types';

/**
 * In-memory session store for development/testing.
 *
 * WARNING: This only works for single-process deployments.
 * Use Redis or database store for production.
 */
export class MemorySessionStore implements AuthSessionStore {
  private sessions = new Map<string, AuthSession>();

  async create(runId: string, expiresInMs = 5 * 60 * 1000): Promise<void> {
    const now = new Date();
    this.sessions.set(runId, {
      runId,
      status: 'pending',
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + expiresInMs).toISOString(),
    });
  }

  async get(runId: string): Promise<AuthSession | null> {
    const session = this.sessions.get(runId);
    if (!session) return null;

    // Check expiration
    if (new Date(session.expiresAt) < new Date()) {
      session.status = 'expired';
    }

    return session;
  }

  async setAuthorizationUrl(runId: string, url: string, originalState: string): Promise<void> {
    const session = this.sessions.get(runId);
    if (session) {
      session.authorizationUrl = url;
      session.originalState = originalState;
    }
  }

  async updateWithCallback(runId: string, code: string, state: string): Promise<void> {
    const session = this.sessions.get(runId);
    if (session) {
      session.status = 'callback_received';
      session.callbackData = { code, state };
    }
  }

  async updateWithError(runId: string, error: string): Promise<void> {
    const session = this.sessions.get(runId);
    if (session) {
      session.status = 'error';
      session.error = error;
    }
  }

  async delete(runId: string): Promise<void> {
    this.sessions.delete(runId);
  }
}
```

#### Redis/Upstash (Production)

```typescript
// packages/core/src/auth/session/redis-store.ts

import { Redis } from '@upstash/redis';  // Or ioredis for self-hosted
import type { AuthSession, AuthSessionStore } from './types';

/**
 * Redis-backed session store for production deployments.
 * Works with Upstash (serverless) or self-hosted Redis.
 */
export class RedisSessionStore implements AuthSessionStore {
  private prefix = 'mcp-test:auth:';

  constructor(private redis: Redis) {}

  private key(runId: string): string {
    return `${this.prefix}${runId}`;
  }

  async create(runId: string, expiresInMs = 5 * 60 * 1000): Promise<void> {
    const now = new Date();
    const session: AuthSession = {
      runId,
      status: 'pending',
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + expiresInMs).toISOString(),
    };

    // Set with TTL (Redis handles expiration)
    await this.redis.set(this.key(runId), JSON.stringify(session), {
      px: expiresInMs,  // Expire in milliseconds
    });
  }

  async get(runId: string): Promise<AuthSession | null> {
    const data = await this.redis.get(this.key(runId));
    if (!data) return null;
    return JSON.parse(data as string);
  }

  async setAuthorizationUrl(runId: string, url: string, originalState: string): Promise<void> {
    const session = await this.get(runId);
    if (session) {
      session.authorizationUrl = url;
      session.originalState = originalState;
      await this.redis.set(this.key(runId), JSON.stringify(session), {
        keepttl: true,  // Keep existing TTL
      });
    }
  }

  async updateWithCallback(runId: string, code: string, state: string): Promise<void> {
    const session = await this.get(runId);
    if (session) {
      session.status = 'callback_received';
      session.callbackData = { code, state };
      await this.redis.set(this.key(runId), JSON.stringify(session), {
        keepttl: true,
      });
    }
  }

  async updateWithError(runId: string, error: string): Promise<void> {
    const session = await this.get(runId);
    if (session) {
      session.status = 'error';
      session.error = error;
      await this.redis.set(this.key(runId), JSON.stringify(session), {
        keepttl: true,
      });
    }
  }

  async delete(runId: string): Promise<void> {
    await this.redis.del(this.key(runId));
  }
}
```

#### 8.2.7 Session Store Factory

```typescript
// packages/web/lib/session-store.ts

import type { AuthSessionStore } from '@mcp-qa/core/auth';
import { MemorySessionStore, RedisSessionStore } from '@mcp-qa/core/auth';
import { Redis } from '@upstash/redis';

let sessionStore: AuthSessionStore | null = null;

export function getSessionStore(): AuthSessionStore {
  if (sessionStore) return sessionStore;

  // Use Redis in production, memory in development
  if (process.env.UPSTASH_REDIS_REST_URL) {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
    sessionStore = new RedisSessionStore(redis);
  } else if (process.env.REDIS_URL) {
    // For self-hosted Redis (would use ioredis)
    throw new Error('Self-hosted Redis not implemented - use UPSTASH_REDIS_REST_URL');
  } else {
    console.warn(
      '⚠️  Using in-memory session store. ' +
      'This will NOT work in serverless deployments. ' +
      'Set UPSTASH_REDIS_REST_URL for production.'
    );
    sessionStore = new MemorySessionStore();
  }

  return sessionStore;
}
```

#### 8.2.8 Web Platform Runner Integration

Update the web platform's runner wrapper to use the web auth handler:

```typescript
// packages/web/lib/runner.ts

import { runTests } from '@mcp-qa/runner';
import { createWebAuthHandler } from '@mcp-qa/core/auth';
import { getSessionStore } from './session-store';

export interface WebRunnerOptions {
  configPath: string;
  anthropicApiKey?: string;
  onProgress?: (phase: string, check: any) => void;
  onAuthUrlReady?: (runId: string, url: URL) => void;
}

export async function runTestsForWeb(options: WebRunnerOptions) {
  // Generate unique run ID
  const runId = crypto.randomUUID();
  const sessionStore = getSessionStore();

  // Create web-specific auth handler
  const interactiveHandler = createWebAuthHandler(
    sessionStore,
    runId,
    {
      pollIntervalMs: 1000,  // Poll faster in web context
      timeoutMs: 5 * 60 * 1000,
      onAuthUrlReady: (url) => {
        options.onAuthUrlReady?.(runId, url);
      },
    }
  );

  try {
    const report = await runTests(options.configPath, {
      anthropicApiKey: options.anthropicApiKey,
      onProgress: options.onProgress,
      interactiveHandler,  // Use our web handler
    });

    return { runId, report };
  } finally {
    // Cleanup session
    await sessionStore.delete(runId);
  }
}
```

#### 8.2.9 Environment Variables

Add to `.env.example`:

```bash
# OAuth Session Store (required for serverless deployments)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# Alternative: Self-hosted Redis
# REDIS_URL=redis://localhost:6379
```

---

## 9. Summary

### Architecture Highlights

This implementation uses a **monorepo architecture** with five packages:

1. **`@mcp-qa/types`** - Zero-dependency types shared across all packages
2. **`@mcp-qa/core`** - Shared runtime utilities (auth, client, utilities)
3. **`@mcp-qa/runner`** - Main test runner with pluggable phases
4. **`@mcp-qa/cli`** - Thin CLI wrapper for standalone use
5. **`@mcp-qa/web`** - Next.js frontend for interactive testing

### Key Technical Decisions

**OAuth/Auth:** Leverages the MCP TypeScript SDK for all OAuth logic:
- **`TestOAuthProvider`** implements `OAuthClientProvider` for state management with check recording
- **`auth()`** handles the complete OAuth flow
- **`discoverOAuthProtectedResourceMetadata()`** and **`discoverAuthorizationServerMetadata()`** are called explicitly to record discovery checks
- **`StreamableHTTPClientTransport`** with `authProvider` handles automatic auth

We build ~200 lines of auth code instead of ~730 lines, focusing on observability rather than reimplementation.

**Extensibility:** New test runners can be added as separate packages that import `@mcp-qa/types` and `@mcp-qa/core`. See [FOLDER_STRUCTURE.md](./FOLDER_STRUCTURE.md) for details on adding new runners or phases.

### Next Steps

1. Install dependencies: `pnpm install`
2. Build in order: types → core → runner → cli/web
3. Run tests: `pnpm test`
4. Start development: `pnpm dev`
