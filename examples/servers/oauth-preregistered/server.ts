#!/usr/bin/env node
/**
 * OAuth-Protected MCP Test Server with Pre-registered Credentials
 *
 * This server demonstrates OAuth client_credentials flow:
 * 1. Client obtains access token using client_id/client_secret
 * 2. Client uses bearer token to access MCP endpoints
 *
 * Pre-registered credentials:
 *   Client ID:     test-client
 *   Client Secret: test-secret
 *
 * Usage:
 *   npm start              # Run on default port 3002
 *   PORT=8080 npm start    # Run on custom port
 */

import express, { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import {
  McpServer,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  StreamableHTTPServerTransport,
  EventStore,
  EventId,
  StreamId,
} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

// ============================================================================
// Configuration
// ============================================================================

const PORT = parseInt(process.env.PORT || '3002', 10);
const SERVER_NAME = 'oauth-preregistered-server';
const SERVER_VERSION = '1.0.0';

// Pre-registered OAuth client credentials
const PREREGISTERED_CLIENTS: Record<string, { secret: string; scopes: string[] }> = {
  'test-client': {
    secret: 'test-secret',
    scopes: ['mcp:tools', 'mcp:resources'],
  },
};

// Token storage (in-memory for demo)
const tokens = new Map<string, {
  clientId: string;
  scopes: string[];
  expiresAt: number;
}>();

// ============================================================================
// OAuth Endpoints
// ============================================================================

/**
 * OAuth Authorization Server Metadata (RFC 8414)
 * Note: authorization_endpoint is required by the schema but not used for client_credentials
 */
function getOAuthMetadata(baseUrl: string) {
  return {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`, // Required by schema, not used for client_credentials
    token_endpoint: `${baseUrl}/oauth/token`,
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
    grant_types_supported: ['client_credentials'],
    response_types_supported: ['token'],
    scopes_supported: ['mcp:tools', 'mcp:resources'],
    introspection_endpoint: `${baseUrl}/oauth/introspect`,
    code_challenge_methods_supported: ['S256'], // For PKCE support indication
  };
}

/**
 * OAuth Token Endpoint - handles client_credentials grant
 */
function handleTokenRequest(req: Request, res: Response) {
  // Parse client credentials from Basic auth header or body
  let clientId: string | undefined;
  let clientSecret: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Basic ')) {
    const base64 = authHeader.slice(6);
    const decoded = Buffer.from(base64, 'base64').toString('utf-8');
    const [id, secret] = decoded.split(':');
    clientId = id;
    clientSecret = secret;
  } else {
    // Try body params
    clientId = req.body.client_id;
    clientSecret = req.body.client_secret;
  }

  const grantType = req.body.grant_type;
  const scope = req.body.scope;

  // Validate grant type
  if (grantType !== 'client_credentials') {
    res.status(400).json({
      error: 'unsupported_grant_type',
      error_description: 'Only client_credentials grant is supported',
    });
    return;
  }

  // Validate client credentials
  if (!clientId || !clientSecret) {
    res.status(401).json({
      error: 'invalid_client',
      error_description: 'Client credentials required',
    });
    return;
  }

  const client = PREREGISTERED_CLIENTS[clientId];
  if (!client || client.secret !== clientSecret) {
    res.status(401).json({
      error: 'invalid_client',
      error_description: 'Invalid client credentials',
    });
    return;
  }

  // Determine granted scopes
  const requestedScopes = scope ? scope.split(' ') : client.scopes;
  const grantedScopes = requestedScopes.filter((s: string) => client.scopes.includes(s));

  // Generate access token
  const accessToken = randomUUID();
  const expiresIn = 3600; // 1 hour

  tokens.set(accessToken, {
    clientId,
    scopes: grantedScopes,
    expiresAt: Date.now() + expiresIn * 1000,
  });

  console.log(`[OAuth] Token issued for client: ${clientId}`);

  res.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: expiresIn,
    scope: grantedScopes.join(' '),
  });
}

/**
 * OAuth Token Introspection Endpoint (RFC 7662)
 */
function handleIntrospection(req: Request, res: Response) {
  const token = req.body.token;

  if (!token) {
    res.status(400).json({ error: 'invalid_request', error_description: 'Token required' });
    return;
  }

  const tokenData = tokens.get(token);

  if (!tokenData || tokenData.expiresAt < Date.now()) {
    res.json({ active: false });
    return;
  }

  res.json({
    active: true,
    client_id: tokenData.clientId,
    scope: tokenData.scopes.join(' '),
    exp: Math.floor(tokenData.expiresAt / 1000),
    token_type: 'Bearer',
  });
}

/**
 * Bearer Auth Middleware
 */
function requireBearerAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'invalid_token',
      error_description: 'Bearer token required',
    });
    return;
  }

  const token = authHeader.slice(7);
  const tokenData = tokens.get(token);

  if (!tokenData) {
    res.status(401).json({
      error: 'invalid_token',
      error_description: 'Invalid or unknown token',
    });
    return;
  }

  if (tokenData.expiresAt < Date.now()) {
    res.status(401).json({
      error: 'invalid_token',
      error_description: 'Token has expired',
    });
    return;
  }

  // Attach auth info to request
  (req as any).auth = {
    clientId: tokenData.clientId,
    scopes: tokenData.scopes,
  };

  next();
}

// ============================================================================
// MCP Server
// ============================================================================

const transports: Record<string, StreamableHTTPServerTransport> = {};
const servers: Record<string, McpServer> = {};

const eventStoreData = new Map<
  string,
  { eventId: string; message: unknown; streamId: string }
>();

function createEventStore(): EventStore {
  return {
    async storeEvent(streamId: StreamId, message: unknown): Promise<EventId> {
      const eventId = `${streamId}::${Date.now()}_${randomUUID()}`;
      eventStoreData.set(eventId, { eventId, message, streamId });
      return eventId;
    },
    async replayEventsAfter(
      lastEventId: EventId,
      { send }: { send: (eventId: EventId, message: unknown) => Promise<void> }
    ): Promise<StreamId> {
      const streamId = lastEventId.split('::')[0];
      const eventsToReplay: Array<[string, { message: unknown }]> = [];

      for (const [eventId, data] of eventStoreData.entries()) {
        if (data.streamId === streamId && eventId > lastEventId) {
          eventsToReplay.push([eventId, data]);
        }
      }

      eventsToReplay.sort(([a], [b]) => a.localeCompare(b));
      for (const [eventId, { message }] of eventsToReplay) {
        if (message && typeof message === 'object' && Object.keys(message).length > 0) {
          await send(eventId, message);
        }
      }

      return streamId;
    },
  };
}

function createMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: { listChanged: true },
        logging: {},
      },
    }
  );

  // Simple "ping" tool for testing
  server.tool('ping', 'Returns pong - simple connectivity test', {}, async () => ({
    content: [{ type: 'text', text: 'pong' }],
  }));

  // Echo tool that shows authenticated client info
  server.tool('whoami', 'Returns information about the authenticated client', {}, async () => ({
    content: [{
      type: 'text',
      text: JSON.stringify({
        server: SERVER_NAME,
        version: SERVER_VERSION,
        message: 'You are authenticated via OAuth client_credentials',
        timestamp: new Date().toISOString(),
      }, null, 2),
    }],
  }));

  return server;
}

// ============================================================================
// Express App
// ============================================================================

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check (no auth required)
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    server: SERVER_NAME,
    version: SERVER_VERSION,
    oauth: 'enabled',
  });
});

// OAuth metadata endpoint (no auth required)
app.get('/.well-known/oauth-authorization-server', (_req: Request, res: Response) => {
  const baseUrl = `http://localhost:${PORT}`;
  res.json(getOAuthMetadata(baseUrl));
});

// Protected Resource Metadata (RFC 9728) - required for MCP OAuth discovery
app.get('/.well-known/oauth-protected-resource', (_req: Request, res: Response) => {
  const baseUrl = `http://localhost:${PORT}`;
  res.json({
    resource: `${baseUrl}/mcp`,
    authorization_servers: [baseUrl],
    scopes_supported: ['mcp:tools', 'mcp:resources'],
  });
});

// OAuth token endpoint (no auth required - credentials in request)
app.post('/oauth/token', handleTokenRequest);

// OAuth introspection endpoint
app.post('/oauth/introspect', handleIntrospection);

// MCP POST endpoint (requires bearer auth)
app.post('/mcp', requireBearerAuth, async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  try {
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      const mcpServer = createMcpServer();

      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        eventStore: createEventStore(),
        onsessioninitialized: (newSessionId) => {
          transports[newSessionId] = transport;
          servers[newSessionId] = mcpServer;
          console.log(`[MCP] Session initialized: ${newSessionId}`);
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) {
          delete transports[sid];
          servers[sid]?.close();
          delete servers[sid];
          console.log(`[MCP] Session closed: ${sid}`);
        }
      };

      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    } else {
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Invalid or missing session ID' },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

// MCP GET endpoint (requires bearer auth)
app.get('/mcp', requireBearerAuth, async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  try {
    await transports[sessionId].handleRequest(req, res);
  } catch (error) {
    console.error('Error handling SSE stream:', error);
    if (!res.headersSent) {
      res.status(500).send('Error establishing SSE stream');
    }
  }
});

// MCP DELETE endpoint (requires bearer auth)
app.delete('/mcp', requireBearerAuth, async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  try {
    await transports[sessionId].handleRequest(req, res);
  } catch (error) {
    console.error('Error handling session termination:', error);
    if (!res.headersSent) {
      res.status(500).send('Error processing session termination');
    }
  }
});

// ============================================================================
// Start Server
// ============================================================================

app.listen(PORT, () => {
  console.log(`
============================================================
  ${SERVER_NAME} v${SERVER_VERSION}
  ** OAuth-Protected MCP Server **
============================================================
  MCP endpoint:    http://localhost:${PORT}/mcp (requires auth)
  Health check:    http://localhost:${PORT}/health
  OAuth metadata:  http://localhost:${PORT}/.well-known/oauth-authorization-server
  Token endpoint:  http://localhost:${PORT}/oauth/token

  Pre-registered credentials:
    Client ID:     test-client
    Client Secret: test-secret

  Tools: 2 (ping, whoami)
============================================================

  Test with curl:
    # Get token
    curl -X POST http://localhost:${PORT}/oauth/token \\
      -d "grant_type=client_credentials" \\
      -d "client_id=test-client" \\
      -d "client_secret=test-secret"

============================================================
`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  for (const sessionId of Object.keys(transports)) {
    try {
      await transports[sessionId].close();
      delete transports[sessionId];
      delete servers[sessionId];
    } catch (e) {
      // Ignore cleanup errors
    }
  }
  process.exit(0);
});
