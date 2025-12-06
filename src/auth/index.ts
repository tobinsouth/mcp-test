/**
 * Auth Phase Runner
 *
 * This phase ONLY performs discovery and validation checks.
 * It does NOT perform the actual auth flow - that's handled by the
 * transport in the protocol phase, allowing proper 401 handling.
 */

import {
  discoverOAuthProtectedResourceMetadata,
  discoverAuthorizationServerMetadata,
} from '@modelcontextprotocol/sdk/client/auth.js';
import {
  TestOAuthProvider,
  type AuthCheckRecorder,
  type InteractiveAuthHandler,
} from './test-oauth-provider.js';
import type { AuthConfig } from '../types/config.js';
import type { TestCheck, PhaseResult } from '../types/index.js';
import { summarizeChecks } from '../types/index.js';

export { TestOAuthProvider, type AuthCheckRecorder, type InteractiveAuthHandler };

export interface AuthPhaseResult extends PhaseResult {
  provider?: TestOAuthProvider;
}

/**
 * Run OAuth discovery/validation phase.
 */
export async function runAuthPhase(
  serverUrl: string,
  authConfig: AuthConfig,
  options: {
    recorder: AuthCheckRecorder;
    interactiveHandler?: InteractiveAuthHandler;
  }
): Promise<AuthPhaseResult> {
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
    provider, // Pass provider to protocol phase for use in transport
  };
}

async function testNoAuth(
  serverUrl: string,
  recorder: AuthCheckRecorder,
  startTime: string,
  startMs: number,
  checks: TestCheck[]
): Promise<AuthPhaseResult> {
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
        redirectUrl: authConfig.redirectUri || 'http://localhost:3456/oauth/callback',
        clientMetadata: {
          grant_types: ['authorization_code', 'refresh_token'],
          redirect_uris: [authConfig.redirectUri || 'http://localhost:3456/oauth/callback'],
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

  throw new Error(`Unsupported auth type: ${(authConfig as { type: string }).type}`);
}
