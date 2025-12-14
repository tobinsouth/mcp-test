#!/usr/bin/env node
/**
 * No-Auth MCP Test Server
 *
 * A simple MCP server for testing that includes tools, resources, and prompts
 * without any authentication. Suitable for local development and QA testing.
 *
 * Usage:
 *   npm start              # Run on default port 3000
 *   PORT=8080 npm start    # Run on custom port
 */

import express, { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import {
  McpServer,
  ResourceTemplate,
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

const PORT = parseInt(process.env.PORT || '3000', 10);
const SERVER_NAME = 'no-auth-everything-server';
const SERVER_VERSION = '1.0.0';

// ============================================================================
// Session Management
// ============================================================================

const transports: Record<string, StreamableHTTPServerTransport> = {};
const servers: Record<string, McpServer> = {};

// In-memory event store for SSE resumability
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

// ============================================================================
// Test Data
// ============================================================================

// 1x1 red PNG pixel for image testing
const TEST_IMAGE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

// ============================================================================
// MCP Server Factory
// ============================================================================

function createMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: true, listChanged: true },
        prompts: { listChanged: true },
        logging: {},
      },
    }
  );

  // ==========================================================================
  // TOOLS
  // ==========================================================================

  // Simple text response tool
  server.tool('echo', 'Echoes back the provided message', {
    message: z.string().describe('Message to echo'),
  }, async ({ message }) => ({
    content: [{ type: 'text', text: `Echo: ${message}` }],
  }));

  // Tool with multiple parameters
  server.tool('add', 'Adds two numbers together', {
    a: z.number().describe('First number'),
    b: z.number().describe('Second number'),
  }, async ({ a, b }) => ({
    content: [{ type: 'text', text: `${a} + ${b} = ${a + b}` }],
  }));

  // Tool that returns structured data
  server.tool('get_time', 'Returns the current server time', {}, async () => {
    const now = new Date();
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            iso: now.toISOString(),
            unix: Math.floor(now.getTime() / 1000),
            readable: now.toLocaleString(),
          }, null, 2),
        },
      ],
    };
  });

  // Tool that returns image content
  server.tool('get_test_image', 'Returns a test image (1x1 red pixel)', {}, async () => ({
    content: [{ type: 'image', data: TEST_IMAGE_BASE64, mimeType: 'image/png' }],
  }));

  // Tool with logging (demonstrates notifications)
  server.tool('slow_operation', 'Simulates a slow operation with progress logging', {
    steps: z.number().min(1).max(10).default(3).describe('Number of steps (1-10)'),
  }, async ({ steps }, { sendNotification }) => {
    for (let i = 1; i <= steps; i++) {
      await sendNotification({
        method: 'notifications/message',
        params: { level: 'info', data: `Processing step ${i} of ${steps}...` },
      });
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return {
      content: [{ type: 'text', text: `Completed ${steps} steps successfully.` }],
    };
  });

  // Tool that intentionally errors
  server.tool('throw_error', 'Always throws an error (for testing error handling)', {
    message: z.string().optional().describe('Custom error message'),
  }, async ({ message }) => {
    throw new Error(message || 'This is a test error');
  });

  // Tool with complex input schema
  server.tool('create_user', 'Creates a mock user object', {
    name: z.string().min(1).describe('User name'),
    email: z.string().email().describe('User email'),
    age: z.number().int().min(0).max(150).optional().describe('User age'),
    roles: z.array(z.enum(['admin', 'user', 'guest'])).optional().describe('User roles'),
  }, async ({ name, email, age, roles }) => ({
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          id: randomUUID(),
          name,
          email,
          age: age ?? null,
          roles: roles ?? ['user'],
          createdAt: new Date().toISOString(),
        }, null, 2),
      },
    ],
  }));

  // ==========================================================================
  // RESOURCES
  // ==========================================================================

  // Static text resource
  server.resource(
    'server-info',
    'info://server',
    { mimeType: 'application/json' },
    async () => ({
      contents: [
        {
          uri: 'info://server',
          mimeType: 'application/json',
          text: JSON.stringify({
            name: SERVER_NAME,
            version: SERVER_VERSION,
            uptime: process.uptime(),
            platform: process.platform,
            nodeVersion: process.version,
          }, null, 2),
        },
      ],
    })
  );

  // Static image resource
  server.resource(
    'test-image',
    'image://test/pixel.png',
    { mimeType: 'image/png' },
    async () => ({
      contents: [
        {
          uri: 'image://test/pixel.png',
          mimeType: 'image/png',
          blob: TEST_IMAGE_BASE64,
        },
      ],
    })
  );

  // Dynamic template resource
  server.resource(
    'user-profile',
    new ResourceTemplate('user://{userId}/profile', { list: undefined }),
    { mimeType: 'application/json' },
    async (uri, { userId }) => ({
      contents: [
        {
          uri: uri.toString(),
          mimeType: 'application/json',
          text: JSON.stringify({
            userId,
            name: `User ${userId}`,
            email: `user${userId}@example.com`,
            retrievedAt: new Date().toISOString(),
          }, null, 2),
        },
      ],
    })
  );

  // ==========================================================================
  // PROMPTS
  // ==========================================================================

  // Simple prompt with no arguments
  server.prompt('greeting', { description: 'A simple greeting prompt' }, async () => ({
    messages: [
      {
        role: 'user',
        content: { type: 'text', text: 'Please provide a friendly greeting.' },
      },
    ],
  }));

  // Prompt with arguments
  server.prompt(
    'code_review',
    {
      description: 'Request a code review for a given language and code snippet',
      arguments: [
        { name: 'language', description: 'Programming language', required: true },
        { name: 'code', description: 'Code to review', required: true },
      ],
    },
    async ({ language, code }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Please review this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nProvide feedback on code quality, potential bugs, and suggestions for improvement.`,
          },
        },
      ],
    })
  );

  // Prompt with embedded resource
  server.prompt(
    'analyze_server',
    { description: 'Analyze the server configuration' },
    async () => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'resource',
            resource: {
              uri: 'info://server',
              mimeType: 'application/json',
              text: JSON.stringify({
                name: SERVER_NAME,
                version: SERVER_VERSION,
                uptime: process.uptime(),
              }),
            },
          },
        },
        {
          role: 'user',
          content: { type: 'text', text: 'Please analyze this server configuration.' },
        },
      ],
    })
  );

  return server;
}

// ============================================================================
// Express App
// ============================================================================

const app = express();
app.use(express.json());

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', server: SERVER_NAME, version: SERVER_VERSION });
});

// MCP POST endpoint - handles requests
app.post('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  try {
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      // Reuse existing transport
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New session initialization
      const mcpServer = createMcpServer();

      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        eventStore: createEventStore(),
        onsessioninitialized: (newSessionId) => {
          transports[newSessionId] = transport;
          servers[newSessionId] = mcpServer;
          console.log(`[${new Date().toISOString()}] Session initialized: ${newSessionId}`);
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) {
          delete transports[sid];
          servers[sid]?.close();
          delete servers[sid];
          console.log(`[${new Date().toISOString()}] Session closed: ${sid}`);
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

// MCP GET endpoint - SSE streams
app.get('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  const lastEventId = req.headers['last-event-id'] as string | undefined;
  if (lastEventId) {
    console.log(`[${new Date().toISOString()}] Client reconnecting: ${sessionId}, last-event-id: ${lastEventId}`);
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

// MCP DELETE endpoint - session termination
app.delete('/mcp', async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  console.log(`[${new Date().toISOString()}] Session termination requested: ${sessionId}`);

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
============================================================
  MCP endpoint: http://localhost:${PORT}/mcp
  Health check: http://localhost:${PORT}/health

  Tools:     7 (echo, add, get_time, get_test_image, slow_operation, throw_error, create_user)
  Resources: 3 (server-info, test-image, user-profile template)
  Prompts:   3 (greeting, code_review, analyze_server)
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
