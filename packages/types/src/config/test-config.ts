import { z } from 'zod';
import { AuthConfigSchema } from './auth.js';
import { ServerConfigSchema } from './server.js';
import { PhaseConfigSchema } from './phases.js';
import { OutputConfigSchema } from './output.js';

/**
 * Main test configuration schema
 */
export const TestConfigSchema = z.object({
  /** Configuration version */
  version: z.literal('1.0'),
  /** Server connection configuration */
  server: ServerConfigSchema,
  /** Authentication configuration */
  auth: AuthConfigSchema,
  /** Phase-specific configurations */
  phases: PhaseConfigSchema.optional(),
  /** Output configuration */
  output: OutputConfigSchema.optional(),
  /** Extensible metadata */
  metadata: z.record(z.unknown()).optional(),
});

export type TestConfig = z.infer<typeof TestConfigSchema>;
