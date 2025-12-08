import { z } from 'zod';
import { TestCheckSchema } from './check.js';

/**
 * Phase name enum
 */
export const PhaseNameSchema = z.enum([
  'auth',
  'protocol',
  'tools',
  'interaction',
]);

export type PhaseName = z.infer<typeof PhaseNameSchema>;

/**
 * Summary of checks in a phase
 */
export const CheckSummarySchema = z.object({
  total: z.number(),
  success: z.number(),
  failure: z.number(),
  warning: z.number(),
  skipped: z.number(),
});

export type CheckSummary = z.infer<typeof CheckSummarySchema>;

/**
 * Result of a single test phase
 */
export const PhaseResultSchema = z.object({
  /** Phase identifier */
  phase: PhaseNameSchema,
  /** Human-readable phase name */
  name: z.string(),
  /** Description of what the phase tested */
  description: z.string(),
  /** Phase start time */
  startTime: z.string(),
  /** Phase end time */
  endTime: z.string(),
  /** Duration in milliseconds */
  durationMs: z.number(),
  /** All checks run in this phase */
  checks: z.array(TestCheckSchema),
  /** Summary statistics */
  summary: CheckSummarySchema,
});

export type PhaseResult = z.infer<typeof PhaseResultSchema>;
