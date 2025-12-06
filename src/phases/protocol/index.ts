/**
 * Protocol Phase Runner
 *
 * Tests MCP protocol handshake and capabilities.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { TestCheck, PhaseResult } from '../../types/index.js';
import type { TestOAuthProvider } from '../../auth/test-oauth-provider.js';
import { summarizeChecks } from '../../types/index.js';

export interface ProtocolPhaseResult extends PhaseResult {
  client?: Client;
  transport?: StreamableHTTPClientTransport;
}

export interface ProtocolPhaseOptions {
  onProgress?: (check: TestCheck) => void;
  testCapabilities?: boolean;
}

export async function runProtocolPhase(
  serverUrl: string,
  provider?: TestOAuthProvider,
  options?: ProtocolPhaseOptions
): Promise<ProtocolPhaseResult> {
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
      description: serverInfo
        ? `Server: ${serverInfo.name} v${serverInfo.version}`
        : 'Server did not provide version information',
      status: serverInfo ? 'SUCCESS' : 'WARNING',
      timestamp: new Date().toISOString(),
      details: serverInfo || undefined,
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

      // Detailed capability checks
      if (serverCapabilities?.tools) {
        pushCheck({
          id: 'protocol-capability-tools',
          name: 'Tools Capability',
          description: 'Server supports tools',
          status: 'SUCCESS',
          timestamp: new Date().toISOString(),
        });
      }

      if (serverCapabilities?.resources) {
        pushCheck({
          id: 'protocol-capability-resources',
          name: 'Resources Capability',
          description: 'Server supports resources',
          status: 'SUCCESS',
          timestamp: new Date().toISOString(),
        });
      }

      if (serverCapabilities?.prompts) {
        pushCheck({
          id: 'protocol-capability-prompts',
          name: 'Prompts Capability',
          description: 'Server supports prompts',
          status: 'SUCCESS',
          timestamp: new Date().toISOString(),
        });
      }
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
      } catch {
        // Ignore cleanup errors - just ensure resources are released
      }
    },
  };
}
