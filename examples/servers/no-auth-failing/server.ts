#!/usr/bin/env node
/**
 * No-Auth Failing MCP Test Server
 *
 * A deliberately problematic MCP server for testing the QA platform's
 * ability to detect various failure modes. Each tool/resource/prompt
 * has subtle issues that should be caught by the testing framework.
 *
 * Usage:
 *   npm start              # Run on default port 3001
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

const PORT = parseInt(process.env.PORT || '3001', 10);
const SERVER_NAME = 'no-auth-failing-server';
const SERVER_VERSION = '1.0.0';

// ============================================================================
// Session Management
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

// ============================================================================
// MCP Server Factory - WITH DELIBERATE FAILURES
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
  // TOOLS WITH DELIBERATE FAILURES
  // ==========================================================================

  // FAILURE 1: Tool that always throws an unexpected error
  // This should cause interaction tests to fail when Claude tries to use it
  server.tool('unreliable_echo', 'Echoes back the provided message (but is unreliable)', {
    message: z.string().describe('Message to echo'),
  }, async ({ message }) => {
    // 100% failure rate - always throws
    throw new Error(`Unexpected server error while processing: ${message.substring(0, 10)}...`);
  });

  // FAILURE 2: Tool with extremely bloated schema (high token count)
  // This should trigger token count warnings
  server.tool('bloated_tool', 'A tool with an unnecessarily complex schema', {
    requiredField1: z.string().describe('This is a very long description for a simple string field that goes on and on explaining what this field does in excessive detail, which is completely unnecessary but adds to the token count significantly'),
    requiredField2: z.string().describe('Another excessively documented field that describes in painstaking detail exactly what kind of string should be provided here, including examples and edge cases'),
    optionalField1: z.string().optional().describe('Yet another verbose description for an optional field that most users will never use but still contributes to the overall token bloat'),
    optionalField2: z.number().optional().describe('A numeric field with an overly detailed explanation of acceptable ranges, precision requirements, and usage patterns'),
    optionalField3: z.boolean().optional().describe('A boolean flag with extensive documentation about when to set it true versus false and all the implications'),
    nestedObject: z.object({
      subField1: z.string().describe('A deeply nested field with its own verbose description'),
      subField2: z.string().describe('Another nested field adding to the complexity'),
      subField3: z.number().describe('Even more nesting for maximum token usage'),
      subField4: z.array(z.string()).describe('An array field inside the nested object'),
    }).optional().describe('A nested object containing multiple sub-fields each with their own descriptions'),
    arrayField: z.array(z.object({
      itemName: z.string().describe('Name of the item in this array element'),
      itemValue: z.number().describe('Value associated with this array element'),
      itemMeta: z.object({
        createdAt: z.string().describe('Timestamp when this item was created'),
        updatedAt: z.string().describe('Timestamp when this item was last updated'),
      }).optional().describe('Optional metadata for the array item'),
    })).optional().describe('An array of complex objects demonstrating deeply nested schema patterns'),
  }, async ({ requiredField1 }) => ({
    content: [{ type: 'text', text: `Processed: ${requiredField1}` }],
  }));

  // FAILURE 3: Tool that returns wrong/misleading results
  // Claude asks for addition but gets subtraction
  server.tool('broken_math', 'Adds two numbers together', {
    a: z.number().describe('First number'),
    b: z.number().describe('Second number'),
  }, async ({ a, b }) => ({
    // BUG: Actually subtracts instead of adding!
    content: [{ type: 'text', text: `${a} + ${b} = ${a - b}` }],
  }));

  // FAILURE 4: Tool that returns success but empty/useless content
  server.tool('empty_response', 'Returns important data', {
    query: z.string().describe('Query to process'),
  }, async () => ({
    // Returns empty content - technically valid but useless
    content: [{ type: 'text', text: '' }],
  }));

  // FAILURE 5: Tool that works correctly (control - should pass)
  server.tool('working_echo', 'Echoes back the provided message reliably', {
    message: z.string().describe('Message to echo'),
  }, async ({ message }) => ({
    content: [{ type: 'text', text: `Echo: ${message}` }],
  }));

  // FAILURE 6: Tool that takes a very long time (potential timeout)
  server.tool('slow_tool', 'Processes data slowly', {
    data: z.string().describe('Data to process'),
  }, async ({ data }) => {
    // Deliberately slow - 5 seconds
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return {
      content: [{ type: 'text', text: `Slowly processed: ${data}` }],
    };
  });

  // FAILURE 7: Tool that ignores input and returns fixed response
  server.tool('ignoring_tool', 'Processes your custom greeting', {
    greeting: z.string().describe('Custom greeting to process'),
  }, async () => ({
    // Ignores input completely
    content: [{ type: 'text', text: 'Hello, World!' }],
  }));

  // ==========================================================================
  // RESOURCES
  // ==========================================================================

  // Working resource (control)
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
            status: 'failing-by-design',
          }, null, 2),
        },
      ],
    })
  );

  // Resource that throws
  server.resource(
    'broken-resource',
    'broken://data',
    { mimeType: 'application/json' },
    async () => {
      throw new Error('Resource unavailable');
    }
  );

  // ==========================================================================
  // PROMPTS
  // ==========================================================================

  // Working prompt (control)
  server.prompt('greeting', { description: 'A simple greeting prompt' }, async () => ({
    messages: [
      {
        role: 'user',
        content: { type: 'text', text: 'Please provide a friendly greeting.' },
      },
    ],
  }));

  // Prompt with misleading description
  server.prompt(
    'math_helper',
    {
      description: 'Helps with math calculations',
      arguments: [
        { name: 'problem', description: 'Math problem to solve', required: true },
      ],
    },
    async () => ({
      // Returns poetry instead of math help!
      messages: [
        {
          role: 'user',
          content: { type: 'text', text: 'Roses are red, violets are blue, math is hard, and so is glue.' },
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
  res.json({ status: 'ok', server: SERVER_NAME, version: SERVER_VERSION, note: 'failing-by-design' });
});

// MCP POST endpoint
app.post('/mcp', async (req: Request, res: Response) => {
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

  try {
    await transports[sessionId].handleRequest(req, res);
  } catch (error) {
    console.error('Error handling SSE stream:', error);
    if (!res.headersSent) {
      res.status(500).send('Error establishing SSE stream');
    }
  }
});

// MCP DELETE endpoint
app.delete('/mcp', async (req: Request, res: Response) => {
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
  ** DELIBERATELY FAILING SERVER FOR QA TESTING **
============================================================
  MCP endpoint: http://localhost:${PORT}/mcp
  Health check: http://localhost:${PORT}/health

  Tools (7 total - most with issues):
    - unreliable_echo: Always throws errors
    - bloated_tool: Excessive schema (high tokens)
    - broken_math: Returns wrong results (subtracts instead of adds)
    - empty_response: Returns empty content
    - working_echo: Actually works (control)
    - slow_tool: Takes 5 seconds
    - ignoring_tool: Ignores input

  Resources: 2 (1 broken)
  Prompts: 2 (1 misleading)
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
