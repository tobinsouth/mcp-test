import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import type {
  OAuthClientMetadata,
  OAuthClientInformationMixed,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import type { TestCheck } from '@mcp-qa/types';
import type { InteractiveAuthHandler } from '../handlers/types.js';

/**
 * Interface for recording test checks during auth flow
 */
export interface AuthCheckRecorder {
  pushCheck(check: TestCheck): void;
}

export interface TestOAuthProviderConfig {
  /** Redirect URL for OAuth callback */
  redirectUrl?: string | URL;
  /** OAuth client metadata for registration */
  clientMetadata: OAuthClientMetadata;
  /** Client metadata URL for CIMD */
  clientMetadataUrl?: string;
  /** Pre-registered client information */
  preRegisteredClient?: OAuthClientInformationMixed;
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
    private readonly config: TestOAuthProviderConfig,
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

  /**
   * Get the authorization code received from callback
   */
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
