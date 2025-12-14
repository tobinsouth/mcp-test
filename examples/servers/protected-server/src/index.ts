import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  InitializeRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { URL, URLSearchParams } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3002;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

/**
 * Protected Server - OAuth-protected MCP server for testing auth flows
 *
 * Features:
 * - RFC 9728 Protected Resource Metadata
 * - RFC 8414 Authorization Server Metadata
 * - Dynamic Client Registration (RFC 7591)
 * - PKCE support (RFC 7636)
 */

// In-memory stores (for testing only)
interface RegisteredClient {
  client_id: string;
  client_secret?: string;
  client_name?: string;
  redirect_uris: string[];
  created_at: number;
}

interface AuthorizationCode {
  code: string;
  client_id: string;
  redirect_uri: string;
  code_challenge?: string;
  code_challenge_method?: string;
  scope?: string;
  expires_at: number;
}

interface AccessToken {
  token: string;
  client_id: string;
  scope?: string;
  expires_at: number;
}

const clients = new Map<string, RegisteredClient>();
const authCodes = new Map<string, AuthorizationCode>();
const tokens = new Map<string, AccessToken>();
const pendingAuthorizations = new Map<string, { client_id: string; redirect_uri: string; state?: string; code_challenge?: string; code_challenge_method?: string; scope?: string }>();

// Create the MCP server
const mcpServer = new Server(
  {
    name: 'protected-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle initialize request
mcpServer.setRequestHandler(InitializeRequestSchema, async () => {
  return {
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {},
    },
    serverInfo: {
      name: 'protected-server',
      version: '1.0.0',
    },
  };
});

// Handle tools/list
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_secret',
        description: 'Returns a secret message (requires authentication)',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'whoami',
        description: 'Returns information about the authenticated client',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Handle tools/call
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params;

  switch (name) {
    case 'get_secret':
      return {
        content: [{ type: 'text', text: 'The secret message is: MCP OAuth works!' }],
      };

    case 'whoami':
      return {
        content: [{ type: 'text', text: 'You are an authenticated MCP client.' }],
      };

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Helper functions
function generateId(prefix: string): string {
  return `${prefix}_${randomBytes(16).toString('hex')}`;
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64url');
}

function sha256(str: string): Buffer {
  return createHash('sha256').update(str).digest();
}

function verifyCodeChallenge(verifier: string, challenge: string, method: string = 'S256'): boolean {
  if (method === 'plain') {
    return verifier === challenge;
  }
  // S256
  const computed = base64UrlEncode(sha256(verifier));
  return computed === challenge;
}

async function parseBody(req: IncomingMessage): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString();
      const contentType = req.headers['content-type'] || '';

      if (contentType.includes('application/json')) {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve({});
        }
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        resolve(Object.fromEntries(new URLSearchParams(body)));
      } else {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function validateBearerToken(req: IncomingMessage): AccessToken | null {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return null;
  }
  const tokenStr = auth.substring(7);
  const token = tokens.get(tokenStr);
  if (!token || token.expires_at < Date.now()) {
    return null;
  }
  return token;
}

// HTTP Server
const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, Mcp-Session-Id');
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id, WWW-Authenticate');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', BASE_URL);

  // RFC 9728: Protected Resource Metadata
  if (url.pathname === '/.well-known/oauth-protected-resource' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      resource: BASE_URL,
      authorization_servers: [BASE_URL],
      bearer_methods_supported: ['header'],
      scopes_supported: ['mcp:tools', 'mcp:resources'],
    }));
    return;
  }

  // RFC 8414: Authorization Server Metadata
  if (url.pathname === '/.well-known/oauth-authorization-server' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      issuer: BASE_URL,
      authorization_endpoint: `${BASE_URL}/oauth/authorize`,
      token_endpoint: `${BASE_URL}/oauth/token`,
      registration_endpoint: `${BASE_URL}/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'client_credentials'],
      code_challenge_methods_supported: ['S256', 'plain'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
      scopes_supported: ['mcp:tools', 'mcp:resources'],
    }));
    return;
  }

  // RFC 7591: Dynamic Client Registration
  if (url.pathname === '/oauth/register' && req.method === 'POST') {
    const body = await parseBody(req);

    const client: RegisteredClient = {
      client_id: generateId('client'),
      client_secret: body.token_endpoint_auth_method === 'none' ? undefined : generateId('secret'),
      client_name: body.client_name,
      redirect_uris: body.redirect_uris ?
        (Array.isArray(body.redirect_uris) ? body.redirect_uris : [body.redirect_uris]) :
        [],
      created_at: Date.now(),
    };

    clients.set(client.client_id, client);

    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      client_id: client.client_id,
      client_secret: client.client_secret,
      client_name: client.client_name,
      redirect_uris: client.redirect_uris,
      token_endpoint_auth_method: client.client_secret ? 'client_secret_basic' : 'none',
    }));
    return;
  }

  // Authorization endpoint
  if (url.pathname === '/oauth/authorize' && req.method === 'GET') {
    const clientId = url.searchParams.get('client_id');
    const redirectUri = url.searchParams.get('redirect_uri');
    const state = url.searchParams.get('state') || undefined;
    const codeChallenge = url.searchParams.get('code_challenge') || undefined;
    const codeChallengeMethod = url.searchParams.get('code_challenge_method') || 'S256';
    const scope = url.searchParams.get('scope') || undefined;

    if (!clientId || !redirectUri) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid_request', error_description: 'Missing client_id or redirect_uri' }));
      return;
    }

    // Store pending authorization
    const authId = generateId('auth');
    pendingAuthorizations.set(authId, {
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      scope,
    });

    // Return a simple consent page
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head><title>Authorization</title></head>
      <body style="font-family: system-ui; max-width: 400px; margin: 50px auto; padding: 20px;">
        <h2>Authorization Request</h2>
        <p>Client <strong>${clientId}</strong> is requesting access.</p>
        <p>Scope: <code>${scope || 'default'}</code></p>
        <form method="POST" action="/oauth/authorize">
          <input type="hidden" name="auth_id" value="${authId}">
          <button type="submit" name="action" value="approve" style="padding: 10px 20px; margin-right: 10px;">Approve</button>
          <button type="submit" name="action" value="deny" style="padding: 10px 20px;">Deny</button>
        </form>
      </body>
      </html>
    `);
    return;
  }

  // Handle authorization consent form
  if (url.pathname === '/oauth/authorize' && req.method === 'POST') {
    const body = await parseBody(req);
    const authId = body.auth_id;
    const action = body.action;

    const pending = pendingAuthorizations.get(authId);
    if (!pending) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid_request' }));
      return;
    }

    pendingAuthorizations.delete(authId);

    if (action !== 'approve') {
      const redirectUrl = new URL(pending.redirect_uri);
      redirectUrl.searchParams.set('error', 'access_denied');
      if (pending.state) redirectUrl.searchParams.set('state', pending.state);
      res.writeHead(302, { Location: redirectUrl.toString() });
      res.end();
      return;
    }

    // Generate authorization code
    const code = generateId('code');
    authCodes.set(code, {
      code,
      client_id: pending.client_id,
      redirect_uri: pending.redirect_uri,
      code_challenge: pending.code_challenge,
      code_challenge_method: pending.code_challenge_method,
      scope: pending.scope,
      expires_at: Date.now() + 600000, // 10 minutes
    });

    const redirectUrl = new URL(pending.redirect_uri);
    redirectUrl.searchParams.set('code', code);
    if (pending.state) redirectUrl.searchParams.set('state', pending.state);

    res.writeHead(302, { Location: redirectUrl.toString() });
    res.end();
    return;
  }

  // Token endpoint
  if (url.pathname === '/oauth/token' && req.method === 'POST') {
    const body = await parseBody(req);
    const grantType = body.grant_type;

    // Client Credentials flow
    if (grantType === 'client_credentials') {
      let clientId = body.client_id;
      let clientSecret = body.client_secret;

      // Check Basic auth header
      const auth = req.headers['authorization'];
      if (auth && auth.startsWith('Basic ')) {
        const decoded = Buffer.from(auth.substring(6), 'base64').toString();
        const [id, secret] = decoded.split(':');
        clientId = id;
        clientSecret = secret;
      }

      const client = clients.get(clientId);
      if (!client || (client.client_secret && client.client_secret !== clientSecret)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_client' }));
        return;
      }

      const accessToken = generateId('token');
      tokens.set(accessToken, {
        token: accessToken,
        client_id: clientId,
        scope: body.scope,
        expires_at: Date.now() + 3600000, // 1 hour
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: body.scope,
      }));
      return;
    }

    // Authorization Code flow
    if (grantType === 'authorization_code') {
      const code = body.code;
      const codeVerifier = body.code_verifier;
      const redirectUri = body.redirect_uri;

      const authCode = authCodes.get(code);
      if (!authCode || authCode.expires_at < Date.now()) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid or expired code' }));
        return;
      }

      // Verify PKCE
      if (authCode.code_challenge) {
        if (!codeVerifier || !verifyCodeChallenge(codeVerifier, authCode.code_challenge, authCode.code_challenge_method)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid code_verifier' }));
          return;
        }
      }

      // Verify redirect_uri
      if (redirectUri !== authCode.redirect_uri) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid_grant', error_description: 'Redirect URI mismatch' }));
        return;
      }

      authCodes.delete(code);

      const accessToken = generateId('token');
      tokens.set(accessToken, {
        token: accessToken,
        client_id: authCode.client_id,
        scope: authCode.scope,
        expires_at: Date.now() + 3600000, // 1 hour
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        scope: authCode.scope,
      }));
      return;
    }

    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'unsupported_grant_type' }));
    return;
  }

  // Health check
  if (url.pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', server: 'protected-server' }));
    return;
  }

  // MCP endpoint (requires auth)
  if (url.pathname === '/mcp' || url.pathname.startsWith('/mcp')) {
    const token = validateBearerToken(req);
    if (!token) {
      res.writeHead(401, {
        'Content-Type': 'application/json',
        'WWW-Authenticate': `Bearer resource_metadata="${BASE_URL}/.well-known/oauth-protected-resource"`,
      });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
    });

    await transport.handleRequest(req, res, async () => {
      await mcpServer.connect(transport);
    });
    return;
  }

  // Root info
  if (url.pathname === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'protected-server',
      version: '1.0.0',
      description: 'OAuth-protected MCP server for testing',
      endpoints: {
        mcp: '/mcp (requires Bearer token)',
        health: '/health',
        oauth_metadata: '/.well-known/oauth-authorization-server',
        resource_metadata: '/.well-known/oauth-protected-resource',
        register: '/oauth/register',
        authorize: '/oauth/authorize',
        token: '/oauth/token',
      },
    }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

httpServer.listen(PORT, () => {
  console.log(`Protected Server running at ${BASE_URL}`);
  console.log(`\nOAuth endpoints:`);
  console.log(`  Metadata:     ${BASE_URL}/.well-known/oauth-authorization-server`);
  console.log(`  Resource:     ${BASE_URL}/.well-known/oauth-protected-resource`);
  console.log(`  Register:     ${BASE_URL}/oauth/register`);
  console.log(`  Authorize:    ${BASE_URL}/oauth/authorize`);
  console.log(`  Token:        ${BASE_URL}/oauth/token`);
  console.log(`\nMCP endpoint:   ${BASE_URL}/mcp (requires Bearer token)`);
});
