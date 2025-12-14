import { z } from "zod";

/**
 * Output configuration for test results
 */
export const OutputConfigSchema = z.object({
  /** Directory for storing transcripts */
  transcriptDir: z.string().default("./transcripts"),
  /** Path for the test report */
  reportPath: z.string().default("./test-report.json"),
  /** Output format */
  format: z.enum(["json", "html", "markdown"]).default("json"),
});

export type OutputConfig = z.infer<typeof OutputConfigSchema>;
