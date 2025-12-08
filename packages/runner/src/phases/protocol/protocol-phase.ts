import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { TestCheck } from '@mcp-qa/types';
import type { TestOAuthProvider } from '@mcp-qa/core';
import { createCheckRecorder, createTimer, type ExtendedPhaseResult } from '../base/index.js';
import * as checks from './checks.js';

export interface ProtocolPhaseOptions {
  onProgress?: (check: TestCheck) => void;
  testCapabilities?: boolean;
}

/**
 * Run protocol conformance phase.
 * Creates MCP client, establishes connection, and tests basic protocol operations.
 */
export async function runProtocolPhase(
  serverUrl: string,
  provider?: TestOAuthProvider,
  options?: ProtocolPhaseOptions
): Promise<ExtendedPhaseResult> {
  const timer = createTimer();
  const recorder = createCheckRecorder(options?.onProgress);

  let client: Client | undefined;
  let transport: StreamableHTTPClientTransport | undefined;

  try {
    // Create client
    client = new Client(
      { name: 'mcp-qa-runner', version: '1.0.0' },
      { capabilities: { sampling: {}, roots: { listChanged: true } } }
    );

    recorder.pushCheck(checks.clientCreatedCheck());

    // Create transport with auth provider (SDK handles auth automatically)
    transport = new StreamableHTTPClientTransport(
      new URL(serverUrl),
      { authProvider: provider }
    );

    recorder.pushCheck(checks.transportCreatedCheck('StreamableHTTP'));

    // Connect - this is where auth actually happens via 401 handling
    await client.connect(transport);

    recorder.pushCheck(checks.connectedCheck());

    // Test server info
    const serverInfo = client.getServerVersion();
    recorder.pushCheck(checks.serverInfoCheck(serverInfo));

    // Test capabilities
    if (options?.testCapabilities !== false) {
      const serverCapabilities = client.getServerCapabilities();

      recorder.pushCheck(checks.capabilitiesCheck({
        hasTools: !!serverCapabilities?.tools,
        hasResources: !!serverCapabilities?.resources,
        hasPrompts: !!serverCapabilities?.prompts,
        hasLogging: !!serverCapabilities?.logging,
        hasExperimental: !!serverCapabilities?.experimental,
      }));
    }

  } catch (error) {
    recorder.pushCheck(
      checks.connectionFailedCheck(error instanceof Error ? error.message : String(error))
    );
  }

  return {
    phase: 'protocol',
    name: 'Protocol Conformance',
    description: 'Testing MCP protocol handshake and capabilities',
    startTime: timer.startTime,
    endTime: timer.getEndTime(),
    durationMs: timer.getDurationMs(),
    checks: recorder.checks,
    summary: recorder.getSummary(),
    client,
    transport,
    cleanup: async () => {
      try {
        if (transport) {
          await transport.close();
        }
      } catch {
        // Ignore cleanup errors
      }
      try {
        if (client) {
          await client.close();
        }
      } catch {
        // Ignore cleanup errors
      }
    },
  };
}
