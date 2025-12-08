import type { TestCheck } from '@mcp-qa/types';

export function clientCreatedCheck(): TestCheck {
  return {
    id: 'protocol-client-created',
    name: 'Client Created',
    description: 'MCP client instance created',
    status: 'SUCCESS',
    timestamp: new Date().toISOString(),
  };
}

export function transportCreatedCheck(transportType: string): TestCheck {
  return {
    id: 'protocol-transport-created',
    name: 'Transport Created',
    description: `${transportType} transport created`,
    status: 'SUCCESS',
    timestamp: new Date().toISOString(),
    details: { transportType },
  };
}

export function connectedCheck(): TestCheck {
  return {
    id: 'protocol-connected',
    name: 'Connection Established',
    description: 'Successfully connected to MCP server',
    status: 'SUCCESS',
    timestamp: new Date().toISOString(),
  };
}

export function serverInfoCheck(serverInfo?: { name?: string; version?: string }): TestCheck {
  return {
    id: 'protocol-server-info',
    name: 'Server Info',
    description: 'Retrieved server version information',
    status: serverInfo ? 'SUCCESS' : 'WARNING',
    timestamp: new Date().toISOString(),
    details: serverInfo,
  };
}

export function capabilitiesCheck(capabilities: {
  hasTools?: boolean;
  hasResources?: boolean;
  hasPrompts?: boolean;
  hasLogging?: boolean;
  hasExperimental?: boolean;
}): TestCheck {
  return {
    id: 'protocol-capabilities',
    name: 'Server Capabilities',
    description: 'Retrieved server capabilities',
    status: 'SUCCESS',
    timestamp: new Date().toISOString(),
    details: capabilities,
  };
}

export function connectionFailedCheck(error: string): TestCheck {
  return {
    id: 'protocol-connection-failed',
    name: 'Connection Failed',
    description: 'Failed to establish MCP connection',
    status: 'FAILURE',
    timestamp: new Date().toISOString(),
    errorMessage: error,
  };
}
