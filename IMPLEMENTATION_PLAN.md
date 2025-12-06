# MCP Server QA Testing Platform - Implementation Plan

## Executive Summary

A comprehensive QA testing platform for MCP servers with two components:
1. **Bun-based Test Runner** - Headless test execution with JSON configuration
2. **Next.js Web Platform** - Interactive UI for configuration and real-time monitoring

**Key Design Principle:** Leverage the MCP TypeScript SDK as much as possible. We implement `OAuthClientProvider` for state management and observability, but use the SDK's `auth()` function for all OAuth logic.

---

## 1. Test Runner Architecture

### 1.1 Input JSON Schema

```typescript
// src/types/config.ts

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

```typescript
// src/types/index.ts

export type CheckStatus = 'SUCCESS' | 'FAILURE' | 'WARNING' | 'SKIPPED' | 'INFO';

export interface SpecReference {
  id: string;
  url?: string;
  section?: string;
}

export interface TestCheck {
  id: string;
  name: string;
  description: string;
  status: CheckStatus;
  timestamp: string;
  durationMs?: number;
  errorMessage?: string;
  details?: Record<string, unknown>;
  specReferences?: SpecReference[];
}

export interface PhaseResult {
  phase: string;
  name: string;
  description: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  checks: TestCheck[];
  summary: {
    total: number;
    success: number;
    failure: number;
    warning: number;
    skipped: number;
  };
}

export interface TestReport {
  version: '1.0';
  serverUrl: string;
  serverName?: string;
  startTime: string;
  endTime: string;
  totalDurationMs: number;
  phases: PhaseResult[];
  overallStatus: 'PASS' | 'FAIL' | 'WARN';
  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
  };
}
```

### 1.4 Project Structure

```
src/
├── index.ts                      # CLI entry point
├── runner.ts                     # Main test runner orchestration
├── types/
│   ├── index.ts                  # Core types
│   └── config.ts                 # JSON schema definitions
├── auth/
│   ├── index.ts                  # Auth phase runner
│   └── test-oauth-provider.ts    # OAuthClientProvider with check recording
├── phases/
│   ├── protocol/
│   │   └── index.ts              # Protocol conformance phase
│   ├── tools/
│   │   └── index.ts              # Tool quality analysis phase
│   └── interaction/
│       ├── index.ts              # Claude interaction phase
│       ├── transcript.ts         # Transcript recording
│       ├── safety-review.ts      # LLM safety review
│       └── quality-review.ts     # LLM quality review
├── client/
│   └── index.ts                  # MCP client factory with auth
├── utils/
│   ├── tokens.ts                 # Token counting utilities
│   └── report.ts                 # Report generation
└── web/                          # Next.js web platform (separate package)
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
// src/auth/test-oauth-provider.ts

import {
  OAuthClientProvider,
  OAuthClientMetadata,
  OAuthClientInformationMixed,
  OAuthTokens
} from '@modelcontextprotocol/sdk/client/auth.js';
import type { TestCheck } from '../types';

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
      description: 'Initiating authorization redirect',
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
      // Web UI mode: notify handler and wait for callback
      await this.interactiveHandler.onAuthorizationRequired(authorizationUrl);
      const callback = await this.interactiveHandler.waitForCallback();

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
      // Headless mode: auto-approve by following redirect (for testing)
      const response = await fetch(authorizationUrl.toString(), {
        redirect: 'manual',
      });

      const location = response.headers.get('location');
      if (location) {
        const redirectUrl = new URL(location);
        const code = redirectUrl.searchParams.get('code');
        if (code) {
          this._authorizationCode = code;
          this.recorder.pushCheck({
            id: 'auth-auto-approved',
            name: 'Auto-Approval',
            description: 'Authorization auto-approved (testing mode)',
            status: 'SUCCESS',
            timestamp: new Date().toISOString(),
          });
        } else {
          throw new Error('No authorization code in redirect');
        }
      } else {
        throw new Error('No redirect location from authorization endpoint');
      }
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
// src/auth/index.ts

import {
  auth,
  discoverOAuthProtectedResourceMetadata,
  discoverAuthorizationServerMetadata,
} from '@modelcontextprotocol/sdk/client/auth.js';
import { TestOAuthProvider, AuthCheckRecorder, InteractiveAuthHandler } from './test-oauth-provider';
import type { AuthConfig, TestCheck, PhaseResult } from '../types';

/**
 * Run OAuth testing phase using SDK directly.
 *
 * This does NOT reimplement OAuth - it uses the SDK's auth() function
 * and records checks via the TestOAuthProvider callbacks.
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

  // For no-auth servers, just test connection
  if (authConfig.type === 'none') {
    return await testNoAuth(serverUrl, recorder, startTime, startMs, checks);
  }

  // Build provider based on auth config
  const provider = buildProvider(authConfig, recorder, options.interactiveHandler);

  // === Test 1: PRM Discovery ===
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
      description: 'Protected Resource Metadata not found (may use legacy auth)',
      status: 'WARNING',
      timestamp: new Date().toISOString(),
      details: { error: error instanceof Error ? error.message : String(error) },
    });
  }

  // === Test 2: AS Metadata Discovery ===
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

  // === Test 3: Run Auth Flow Using SDK ===
  try {
    recorder.pushCheck({
      id: 'auth-flow-starting',
      name: 'Auth Flow',
      description: 'Starting OAuth authorization flow',
      status: 'INFO',
      timestamp: new Date().toISOString(),
    });

    let result = await auth(provider, {
      serverUrl,
      resourceMetadataUrl: prmMetadata ? new URL(prmMetadata.resource) : undefined,
      scope: getScopes(authConfig)?.join(' '),
    });

    // Handle redirect case (interactive flow)
    if (result === 'REDIRECT') {
      const authCode = provider.getAuthorizationCode();
      if (!authCode) {
        throw new Error('No authorization code after redirect');
      }

      result = await auth(provider, {
        serverUrl,
        authorizationCode: authCode,
        resourceMetadataUrl: prmMetadata ? new URL(prmMetadata.resource) : undefined,
        scope: getScopes(authConfig)?.join(' '),
      });
    }

    if (result === 'AUTHORIZED') {
      recorder.pushCheck({
        id: 'auth-flow-complete',
        name: 'Auth Flow Complete',
        description: 'Successfully completed OAuth authorization',
        status: 'SUCCESS',
        timestamp: new Date().toISOString(),
      });
    }

  } catch (error) {
    recorder.pushCheck({
      id: 'auth-flow-failed',
      name: 'Auth Flow Failed',
      description: 'OAuth authorization failed',
      status: 'FAILURE',
      timestamp: new Date().toISOString(),
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    phase: 'auth',
    name: 'Authentication Testing',
    description: `Testing ${authConfig.type} authentication`,
    startTime,
    endTime: new Date().toISOString(),
    durationMs: Date.now() - startMs,
    checks,
    summary: summarizeChecks(checks),
    provider,
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
// src/phases/protocol/index.ts

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { TestCheck, PhaseResult } from '../../types';
import type { TestOAuthProvider } from '../../auth/test-oauth-provider';

export async function runProtocolPhase(
  serverUrl: string,
  provider?: TestOAuthProvider,
  options?: {
    onProgress?: (check: TestCheck) => void;
    testCapabilities?: boolean;
  }
): Promise<PhaseResult & { client?: Client }> {
  const checks: TestCheck[] = [];
  const startTime = new Date().toISOString();
  const startMs = Date.now();

  const pushCheck = (check: TestCheck) => {
    checks.push(check);
    options?.onProgress?.(check);
  };

  let client: Client | undefined;

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
    const transport = new StreamableHTTPClientTransport(
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

    // Connect
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
// src/phases/tools/index.ts

import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { TestCheck, PhaseResult } from '../../types';
import { countTokens } from '../../utils/tokens';

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
// src/phases/interaction/index.ts

import Anthropic from '@anthropic-ai/sdk';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { TestCheck, PhaseResult, TestPrompt } from '../../types';
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

```typescript
// src/phases/interaction/transcript.ts

import * as fs from 'fs/promises';
import * as path from 'path';

type TranscriptEntry =
  | { type: 'user_message'; content: string; timestamp: string }
  | { type: 'claude_response'; response: any; timestamp: string }
  | { type: 'tool_call'; toolName: string; arguments: any; timestamp: string }
  | { type: 'tool_result'; toolName: string; result: any; timestamp: string }
  | { type: 'tool_error'; toolName: string; error: string; timestamp: string }
  | { type: 'final_response'; content: string; timestamp: string };

interface Transcript {
  promptId: string;
  startTime: string;
  endTime?: string;
  entries: TranscriptEntry[];
  summary: {
    totalToolCalls: number;
    toolsUsed: string[];
    errors: number;
    iterations: number;
  };
}

export class TranscriptRecorder {
  private entries: TranscriptEntry[] = [];
  private startTime: string;
  private toolCalls: string[] = [];
  private errors = 0;

  constructor(private promptId: string) {
    this.startTime = new Date().toISOString();
  }

  recordUserMessage(content: string): void {
    this.entries.push({ type: 'user_message', content, timestamp: new Date().toISOString() });
  }

  recordClaudeResponse(response: any): void {
    this.entries.push({ type: 'claude_response', response, timestamp: new Date().toISOString() });
  }

  recordToolCall(toolName: string, args: any): void {
    this.entries.push({ type: 'tool_call', toolName, arguments: args, timestamp: new Date().toISOString() });
    this.toolCalls.push(toolName);
  }

  recordToolResult(toolName: string, result: any): void {
    this.entries.push({ type: 'tool_result', toolName, result, timestamp: new Date().toISOString() });
  }

  recordToolError(toolName: string, error: string): void {
    this.entries.push({ type: 'tool_error', toolName, error, timestamp: new Date().toISOString() });
    this.errors++;
  }

  recordFinalResponse(content: string): void {
    this.entries.push({ type: 'final_response', content, timestamp: new Date().toISOString() });
  }

  getTranscript(): Transcript {
    return {
      promptId: this.promptId,
      startTime: this.startTime,
      endTime: new Date().toISOString(),
      entries: this.entries,
      summary: {
        totalToolCalls: this.toolCalls.length,
        toolsUsed: [...new Set(this.toolCalls)],
        errors: this.errors,
        iterations: this.entries.filter(e => e.type === 'claude_response').length,
      },
    };
  }

  async saveToFile(dir: string): Promise<string> {
    await fs.mkdir(dir, { recursive: true });
    const filename = `${this.promptId}-${Date.now()}.json`;
    const filepath = path.join(dir, filename);
    await fs.writeFile(filepath, JSON.stringify(this.getTranscript(), null, 2));
    return filepath;
  }
}
```

### 6.2 Safety Review

```typescript
// src/phases/interaction/safety-review.ts

import type Anthropic from '@anthropic-ai/sdk';
import type { TestCheck } from '../../types';

interface SafetyPolicy {
  id: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export async function reviewSafety(
  transcript: any,
  policies: SafetyPolicy[],
  model: string,
  anthropic: Anthropic,
  pushCheck: (check: TestCheck) => void
): Promise<void> {
  const policyDescriptions = policies
    .map(p => `- ${p.id}: ${p.description} (${p.severity})`)
    .join('\n');

  const prompt = `Analyze this interaction transcript for potential safety policy violations.

Policies to check:
${policyDescriptions}

Transcript:
${JSON.stringify(transcript, null, 2)}

For each policy, respond in JSON format:
{
  "violations": [
    {
      "policyId": "policy-id",
      "violated": true/false,
      "evidence": "quote from transcript if violated",
      "reasoning": "explanation"
    }
  ]
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

      for (const violation of result.violations || []) {
        const policy = policies.find(p => p.id === violation.policyId);
        if (!policy) continue;

        pushCheck({
          id: `safety-${violation.policyId}`,
          name: `Safety: ${violation.policyId}`,
          description: policy.description,
          status: violation.violated ? 'FAILURE' : 'SUCCESS',
          timestamp: new Date().toISOString(),
          details: {
            severity: policy.severity,
            evidence: violation.evidence,
            reasoning: violation.reasoning,
          },
        });
      }
    }
  } catch (error) {
    pushCheck({
      id: 'safety-review-failed',
      name: 'Safety Review',
      description: 'Failed to complete safety review',
      status: 'WARNING',
      timestamp: new Date().toISOString(),
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}
```

### 6.3 Quality Review

```typescript
// src/phases/interaction/quality-review.ts

import type Anthropic from '@anthropic-ai/sdk';
import type { TestCheck } from '../../types';

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

```typescript
// src/utils/tokens.ts

/**
 * Approximate token count using cl100k_base-like estimation.
 * For production, consider using tiktoken or similar.
 */
export function countTokens(text: string): number {
  if (!text) return 0;

  // Rough approximation: ~4 characters per token for English
  // JSON tends to be more verbose, so adjust slightly
  const charCount = text.length;
  const wordCount = text.split(/\s+/).length;

  // Use a weighted average
  return Math.ceil((charCount / 4 + wordCount) / 2);
}
```

---

## 7. Main Test Runner

```typescript
// src/runner.ts

import * as fs from 'fs/promises';
import { TestConfigSchema, type TestConfig } from './types/config';
import type { TestReport, PhaseResult, TestCheck } from './types';
import { runAuthPhase } from './auth';
import { runProtocolPhase } from './phases/protocol';
import { runToolsPhase } from './phases/tools';
import { runInteractionPhase } from './phases/interaction';

export async function runTests(
  configPath: string,
  options?: {
    anthropicApiKey?: string;
    onProgress?: (phase: string, check: TestCheck) => void;
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

  // Phase 1: Auth
  if (config.phases?.auth?.enabled !== false) {
    const authResult = await runAuthPhase(
      config.server.url,
      config.auth,
      {
        recorder: {
          pushCheck: (check) => options?.onProgress?.('auth', check),
        },
      }
    );
    report.phases.push(authResult);

    // Phase 2: Protocol (using auth provider)
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
}
```

### 7.1 CLI Entry Point

```typescript
// src/index.ts
#!/usr/bin/env bun

import { runTests } from './runner';

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help')) {
  console.log(`
MCP Server Test Runner

Usage:
  mcp-test <config.json> [options]

Options:
  --anthropic-key <key>  Anthropic API key (or set ANTHROPIC_API_KEY)
  --verbose              Show detailed progress
  --help                 Show this help

Example:
  mcp-test ./test-config.json --verbose
`);
  process.exit(0);
}

const configPath = args[0];
const verbose = args.includes('--verbose');
const keyIndex = args.indexOf('--anthropic-key');
const anthropicApiKey = keyIndex >= 0 ? args[keyIndex + 1] : undefined;

runTests(configPath, {
  anthropicApiKey,
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

---

## 8. Web Platform (Next.js)

### 8.1 Architecture Overview

```
web/
├── app/
│   ├── page.tsx              # Dashboard
│   ├── test/
│   │   └── [id]/page.tsx     # Test detail view
│   └── api/
│       ├── run/route.ts      # Start test run
│       ├── status/route.ts   # SSE for progress
│       └── oauth/
│           └── callback/route.ts  # OAuth callback handler
├── components/
│   ├── ConfigEditor.tsx      # JSON config editor
│   ├── CheckList.tsx         # Real-time check list
│   └── TranscriptViewer.tsx  # Transcript viewer
└── lib/
    └── runner.ts             # Server-side runner wrapper
```

### 8.2 OAuth Callback Handler

```typescript
// web/app/api/oauth/callback/route.ts

import { NextRequest, NextResponse } from 'next/server';

// Global map of pending auth sessions
const pendingAuthSessions = new Map<string, {
  resolve: (value: { code: string; state?: string }) => void;
  reject: (error: Error) => void;
}>();

export function registerAuthSession(
  state: string,
  resolve: (value: { code: string; state?: string }) => void,
  reject: (error: Error) => void
): void {
  pendingAuthSessions.set(state, { resolve, reject });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    const session = state ? pendingAuthSessions.get(state) : null;
    if (session) {
      session.reject(new Error(error));
      pendingAuthSessions.delete(state!);
    }
    return NextResponse.redirect(new URL('/test?error=' + error, request.url));
  }

  if (code && state) {
    const session = pendingAuthSessions.get(state);
    if (session) {
      session.resolve({ code, state });
      pendingAuthSessions.delete(state);
    }
    return NextResponse.redirect(new URL('/test?success=true', request.url));
  }

  return NextResponse.redirect(new URL('/test?error=invalid_callback', request.url));
}
```

---

## 9. Code Patterns from SDK

### 9.1 SDK Functions We Use Directly

```typescript
// These are imported from the SDK - we don't reimplement them
import {
  auth,
  discoverOAuthProtectedResourceMetadata,
  discoverAuthorizationServerMetadata,
  extractWWWAuthenticateParams,
  UnauthorizedError,
} from '@modelcontextprotocol/sdk/client/auth.js';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
```

### 9.2 Pattern: Provider with Built-in Auth

```typescript
// Simplest pattern - SDK handles everything
const transport = new StreamableHTTPClientTransport(
  new URL(serverUrl),
  { authProvider: testOAuthProvider }  // SDK manages auth automatically
);
await client.connect(transport);
```

### 9.3 Pattern: Explicit Discovery for Checks

```typescript
// For detailed testing, call discovery explicitly before auth()
const prm = await discoverOAuthProtectedResourceMetadata(serverUrl);
recordCheck('PRM found', prm);

const as = await discoverAuthorizationServerMetadata(prm.authorization_servers[0]);
recordCheck('AS metadata found', as);

// Then use auth() which will use cached metadata
await auth(provider, { serverUrl });
```

---

## 10. Implementation Roadmap

### Phase 1: Core Test Runner (Week 1)
- [ ] Set up Bun project with TypeScript
- [ ] Implement types and config schema
- [ ] Implement `TestOAuthProvider`
- [ ] Implement auth phase using SDK's `auth()`
- [ ] Implement protocol phase
- [ ] Basic CLI

### Phase 2: Tool & Interaction Testing (Week 2)
- [ ] Implement tool analysis phase
- [ ] Implement Claude interaction loop
- [ ] Implement transcript recording
- [ ] Implement basic evaluation

### Phase 3: LLM Review & Reports (Week 3)
- [ ] Implement safety review
- [ ] Implement quality review
- [ ] Report generation (JSON, HTML)
- [ ] Polish CLI output

### Phase 4: Web Platform (Week 4)
- [ ] Next.js project setup
- [ ] Config editor UI
- [ ] Real-time progress via SSE
- [ ] OAuth callback handling
- [ ] Transcript viewer

---

## Summary

This implementation leverages the MCP TypeScript SDK for all OAuth logic:

- **`TestOAuthProvider`** implements `OAuthClientProvider` for state management with check recording
- **`auth()`** handles the complete OAuth flow
- **`discoverOAuthProtectedResourceMetadata()`** and **`discoverAuthorizationServerMetadata()`** are called explicitly to record discovery checks
- **`StreamableHTTPClientTransport`** with `authProvider` handles automatic auth

We build ~200 lines of auth code instead of ~730 lines, focusing on observability rather than reimplementation.
