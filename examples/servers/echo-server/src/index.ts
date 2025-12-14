import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  InitializeRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

/**
 * Echo Server - A simple MCP server for testing
 *
 * Tools:
 * - echo: Returns the input message unchanged
 * - reverse: Reverses a string
 * - uppercase: Converts string to uppercase
 */

// Create the MCP server
const server = new Server(
  {
    name: 'echo-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle initialize request
server.setRequestHandler(InitializeRequestSchema, async (request) => {
  return {
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {},
    },
    serverInfo: {
      name: 'echo-server',
      version: '1.0.0',
    },
  };
});

// Handle tools/list
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'echo',
        description: 'Returns the input message unchanged. Use this to test basic tool functionality.',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'The message to echo back',
            },
          },
          required: ['message'],
        },
      },
      {
        name: 'reverse',
        description: 'Reverses the input string and returns it.',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'The text to reverse',
            },
          },
          required: ['text'],
        },
      },
      {
        name: 'uppercase',
        description: 'Converts the input string to uppercase.',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'The text to convert to uppercase',
            },
          },
          required: ['text'],
        },
      },
    ],
  };
});

// Handle tools/call
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'echo': {
      const message = (args as { message: string }).message;
      return {
        content: [
          {
            type: 'text',
            text: message,
          },
        ],
      };
    }

    case 'reverse': {
      const text = (args as { text: string }).text;
      const reversed = text.split('').reverse().join('');
      return {
        content: [
          {
            type: 'text',
            text: reversed,
          },
        ],
      };
    }

    case 'uppercase': {
      const text = (args as { text: string }).text;
      return {
        content: [
          {
            type: 'text',
            text: text.toUpperCase(),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Create HTTP server with Streamable HTTP transport
const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Session-Id');
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check endpoint
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', server: 'echo-server' }));
    return;
  }

  // MCP endpoint
  if (req.url === '/mcp' || req.url?.startsWith('/mcp')) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });

    await transport.handleRequest(req, res, async () => {
      await server.connect(transport);
    });
    return;
  }

  // Root - info page
  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'echo-server',
      version: '1.0.0',
      description: 'Simple echo MCP server for testing',
      endpoints: {
        mcp: '/mcp',
        health: '/health',
      },
      tools: ['echo', 'reverse', 'uppercase'],
    }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

httpServer.listen(PORT, () => {
  console.log(`Echo Server running at http://localhost:${PORT}`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log('\nAvailable tools:');
  console.log('  - echo: Returns the input message unchanged');
  console.log('  - reverse: Reverses a string');
  console.log('  - uppercase: Converts to uppercase');
});
