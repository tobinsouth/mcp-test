import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { TestOAuthProvider } from '../auth/provider/test-oauth-provider.js';

export interface CreateClientOptions {
  /** Server URL */
  serverUrl: string;
  /** Transport type */
  transport?: 'streamable-http' | 'sse';
  /** OAuth provider for authentication */
  authProvider?: TestOAuthProvider;
  /** Additional headers */
  headers?: Record<string, string>;
  /** Client name */
  clientName?: string;
  /** Client version */
  clientVersion?: string;
}

export interface CreateClientResult {
  /** The MCP client */
  client: Client;
  /** The transport (for cleanup) */
  transport: StreamableHTTPClientTransport | SSEClientTransport;
}

/**
 * Create an MCP client with the specified configuration.
 *
 * @param options - Client creation options
 * @returns The client and transport
 */
export async function createMCPClient(options: CreateClientOptions): Promise<CreateClientResult> {
  const {
    serverUrl,
    transport: transportType = 'streamable-http',
    authProvider,
    headers,
    clientName = 'mcp-qa-runner',
    clientVersion = '1.0.0',
  } = options;

  // Create the client
  const client = new Client(
    { name: clientName, version: clientVersion },
    { capabilities: { sampling: {}, roots: { listChanged: true } } }
  );

  // Create the transport
  let transport: StreamableHTTPClientTransport | SSEClientTransport;

  if (transportType === 'sse') {
    transport = new SSEClientTransport(
      new URL(serverUrl),
    );
  } else {
    transport = new StreamableHTTPClientTransport(
      new URL(serverUrl),
      {
        authProvider,
        requestInit: headers ? { headers } : undefined,
      }
    );
  }

  return { client, transport };
}

/**
 * Connect an MCP client to a server.
 *
 * @param client - The MCP client
 * @param transport - The transport to use
 */
export async function connectClient(
  client: Client,
  transport: StreamableHTTPClientTransport | SSEClientTransport
): Promise<void> {
  await client.connect(transport);
}

/**
 * Disconnect and cleanup an MCP client.
 *
 * @param client - The MCP client
 * @param transport - The transport to close
 */
export async function disconnectClient(
  client: Client,
  transport: StreamableHTTPClientTransport | SSEClientTransport
): Promise<void> {
  try {
    await transport.close();
  } catch {
    // Ignore close errors
  }
  try {
    await client.close();
  } catch {
    // Ignore close errors
  }
}
