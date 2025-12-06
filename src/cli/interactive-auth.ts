/**
 * CLI Interactive Auth Handler
 *
 * Opens the authorization URL in the user's browser and
 * spins up a temporary HTTP server to receive the callback.
 */

import type { InteractiveAuthHandler } from '../auth/test-oauth-provider.js';
import { createServer, type Server } from 'http';
import open from 'open';

const DEFAULT_CALLBACK_PORT = 3456;

/**
 * CLI interactive auth handler that:
 * 1. Opens the authorization URL in the user's browser
 * 2. Spins up a temporary HTTP server to receive the callback
 * 3. Returns the authorization code
 */
export function createCLIAuthHandler(
  callbackPort: number = DEFAULT_CALLBACK_PORT
): InteractiveAuthHandler {
  let pendingResolve: ((value: { code: string; state?: string }) => void) | null = null;
  let pendingReject: ((error: Error) => void) | null = null;
  let server: Server | null = null;

  return {
    async onAuthorizationRequired(authorizationUrl: URL): Promise<void> {
      console.log('\n🔐 OAuth Authorization Required');
      console.log('Opening browser for consent...');
      console.log(`URL: ${authorizationUrl.toString()}\n`);

      // Open browser
      await open(authorizationUrl.toString());

      // Start callback server
      server = createServer((req, res) => {
        const url = new URL(req.url || '/', `http://localhost:${callbackPort}`);

        if (url.pathname === '/oauth/callback') {
          const code = url.searchParams.get('code');
          const state = url.searchParams.get('state');
          const error = url.searchParams.get('error');

          if (error) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                  <h1 style="color: #dc2626;">Authorization Failed</h1>
                  <p>Error: ${escapeHtml(error)}</p>
                  <p>You can close this window.</p>
                </body>
              </html>
            `);
            pendingReject?.(new Error(error));
          } else if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                  <h1 style="color: #16a34a;">Authorization Successful</h1>
                  <p>You can close this window and return to the terminal.</p>
                </body>
              </html>
            `);
            pendingResolve?.({ code, state: state || undefined });
          } else {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<h1>Invalid Callback</h1>');
          }

          // Cleanup server after response
          setTimeout(() => server?.close(), 100);
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      });

      server.listen(callbackPort);
      console.log(`Listening for callback on http://localhost:${callbackPort}/oauth/callback`);
      console.log('Waiting for you to complete authorization in the browser...\n');
    },

    waitForCallback(): Promise<{ code: string; state?: string }> {
      return new Promise((resolve, reject) => {
        pendingResolve = resolve;
        pendingReject = reject;

        // Timeout after 5 minutes
        setTimeout(() => {
          reject(new Error('OAuth callback timeout (5 minutes)'));
          server?.close();
        }, 5 * 60 * 1000);
      });
    },
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
