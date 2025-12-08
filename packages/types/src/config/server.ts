import { z } from 'zod';

/**
 * MCP Server connection configuration
 */
export const ServerConfigSchema = z.object({
  /** Server URL endpoint */
  url: z.string().url(),
  /** Human-readable server name */
  name: z.string().optional(),
  /** Transport protocol to use */
  transport: z.enum(['streamable-http', 'sse', 'stdio']).default('streamable-http'),
  /** Additional headers to send with requests */
  headers: z.record(z.string()).optional(),
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;
