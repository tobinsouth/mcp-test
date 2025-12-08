import type { TestCheck, SpecReference } from '@mcp-qa/types';

const RFC_9728: SpecReference = {
  id: 'RFC-9728',
  url: 'https://www.rfc-editor.org/rfc/rfc9728.html',
};

const RFC_8414: SpecReference = {
  id: 'RFC-8414',
  url: 'https://www.rfc-editor.org/rfc/rfc8414.html',
};

const RFC_7636: SpecReference = {
  id: 'RFC-7636',
  url: 'https://www.rfc-editor.org/rfc/rfc7636.html',
};

const RFC_7591: SpecReference = {
  id: 'RFC-7591',
  url: 'https://www.rfc-editor.org/rfc/rfc7591.html',
};

export function prmDiscoveredCheck(metadata: {
  resource?: string;
  authorization_servers?: string[];
  scopes_supported?: string[];
}): TestCheck {
  return {
    id: 'auth-prm-discovered',
    name: 'PRM Discovery',
    description: 'Successfully discovered Protected Resource Metadata',
    status: 'SUCCESS',
    timestamp: new Date().toISOString(),
    specReferences: [RFC_9728],
    details: {
      resource: metadata.resource,
      authorizationServers: metadata.authorization_servers,
      scopesSupported: metadata.scopes_supported,
    },
  };
}

export function prmNotFoundCheck(error: string): TestCheck {
  return {
    id: 'auth-prm-not-found',
    name: 'PRM Discovery',
    description: 'Protected Resource Metadata not found (may use legacy auth or require 401 challenge)',
    status: 'WARNING',
    timestamp: new Date().toISOString(),
    details: { error },
  };
}

export function asDiscoveredCheck(metadata: {
  issuer?: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  registration_endpoint?: string;
  grant_types_supported?: string[];
  code_challenge_methods_supported?: string[];
  token_endpoint_auth_methods_supported?: string[];
  client_id_metadata_document_supported?: boolean;
}): TestCheck {
  return {
    id: 'auth-as-discovered',
    name: 'AS Metadata Discovery',
    description: 'Successfully discovered Authorization Server Metadata',
    status: 'SUCCESS',
    timestamp: new Date().toISOString(),
    specReferences: [RFC_8414],
    details: {
      issuer: metadata.issuer,
      authorizationEndpoint: metadata.authorization_endpoint,
      tokenEndpoint: metadata.token_endpoint,
      registrationEndpoint: metadata.registration_endpoint,
      grantTypesSupported: metadata.grant_types_supported,
      codeChallengeMethodsSupported: metadata.code_challenge_methods_supported,
      tokenEndpointAuthMethodsSupported: metadata.token_endpoint_auth_methods_supported,
      cimdSupported: metadata.client_id_metadata_document_supported,
    },
  };
}

export function asDiscoveryFailedCheck(error: string): TestCheck {
  return {
    id: 'auth-as-discovery-failed',
    name: 'AS Metadata Discovery',
    description: 'Failed to discover Authorization Server Metadata',
    status: 'WARNING',
    timestamp: new Date().toISOString(),
    details: { error },
  };
}

export function pkceSupported(supported: boolean): TestCheck {
  return {
    id: 'auth-pkce-supported',
    name: 'PKCE S256 Support',
    description: supported ? 'Server supports PKCE S256' : 'Server may not support PKCE S256',
    status: supported ? 'SUCCESS' : 'WARNING',
    timestamp: new Date().toISOString(),
    specReferences: [RFC_7636],
  };
}

export function dcrAvailableCheck(): TestCheck {
  return {
    id: 'auth-dcr-available',
    name: 'DCR Endpoint',
    description: 'Dynamic Client Registration endpoint available',
    status: 'SUCCESS',
    timestamp: new Date().toISOString(),
    specReferences: [RFC_7591],
  };
}

export function cimdSupportedCheck(): TestCheck {
  return {
    id: 'auth-cimd-supported',
    name: 'CIMD Support',
    description: 'Server supports Client ID Metadata Document',
    status: 'SUCCESS',
    timestamp: new Date().toISOString(),
  };
}

export function serverAccessibleCheck(status: number): TestCheck {
  return {
    id: 'auth-none-accessible',
    name: 'Server Accessible',
    description: 'Server accessible without authentication',
    status: status === 200 || status === 405 ? 'SUCCESS' : 'WARNING',
    timestamp: new Date().toISOString(),
    details: { status },
  };
}

export function connectionFailedCheck(error: string): TestCheck {
  return {
    id: 'auth-none-connection-failed',
    name: 'Server Connection',
    description: 'Failed to connect to server',
    status: 'FAILURE',
    timestamp: new Date().toISOString(),
    errorMessage: error,
  };
}

export function discoveryCompleteCheck(): TestCheck {
  return {
    id: 'auth-discovery-complete',
    name: 'Discovery Phase Complete',
    description: 'Auth discovery complete. Actual auth will occur during connection.',
    status: 'INFO',
    timestamp: new Date().toISOString(),
  };
}
