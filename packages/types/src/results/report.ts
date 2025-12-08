import { z } from 'zod';
import { PhaseResultSchema } from './phase-result.js';

/**
 * Overall test status
 */
export const OverallStatusSchema = z.enum(['PASS', 'FAIL', 'WARN']);

export type OverallStatus = z.infer<typeof OverallStatusSchema>;

/**
 * Report summary statistics
 */
export const ReportSummarySchema = z.object({
  totalChecks: z.number(),
  passed: z.number(),
  failed: z.number(),
  warnings: z.number(),
  skipped: z.number(),
});

export type ReportSummary = z.infer<typeof ReportSummarySchema>;

/**
 * Complete test run report
 */
export const TestReportSchema = z.object({
  /** Report schema version */
  version: z.string(),
  /** Server URL tested */
  serverUrl: z.string(),
  /** Server name (if provided) */
  serverName: z.string().optional(),
  /** Test run start time */
  startTime: z.string(),
  /** Test run end time */
  endTime: z.string(),
  /** Total duration in milliseconds */
  totalDurationMs: z.number(),
  /** Results from each phase */
  phases: z.array(PhaseResultSchema),
  /** Overall pass/fail status */
  overallStatus: OverallStatusSchema,
  /** Summary statistics */
  summary: ReportSummarySchema,
  /** Configuration used for the test */
  config: z.record(z.unknown()).optional(),
});

export type TestReport = z.infer<typeof TestReportSchema>;
