import { z } from 'zod';

/**
 * Status of a test check
 */
export const CheckStatusSchema = z.enum([
  'SUCCESS',
  'FAILURE',
  'WARNING',
  'SKIPPED',
  'INFO',
]);

export type CheckStatus = z.infer<typeof CheckStatusSchema>;

/**
 * Specification reference
 */
export const SpecReferenceSchema = z.object({
  id: z.string(),
  url: z.string().url().optional(),
  section: z.string().optional(),
});

export type SpecReference = z.infer<typeof SpecReferenceSchema>;

/**
 * Individual test check/assertion
 */
export const TestCheckSchema = z.object({
  /** Unique identifier for the check */
  id: z.string(),
  /** Human-readable name */
  name: z.string(),
  /** Description of what was checked */
  description: z.string(),
  /** Check result status */
  status: CheckStatusSchema,
  /** Timestamp when check completed */
  timestamp: z.string(),
  /** References to specifications */
  specReferences: z.array(SpecReferenceSchema).optional(),
  /** Additional details about the check */
  details: z.record(z.unknown()).optional(),
  /** Error message if check failed */
  errorMessage: z.string().optional(),
  /** Duration in milliseconds */
  durationMs: z.number().optional(),
});

export type TestCheck = z.infer<typeof TestCheckSchema>;
