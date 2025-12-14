import { z } from "zod";

/**
 * Type of transcript entry
 */
export const TranscriptEntryTypeSchema = z.enum([
  "user_message",
  "assistant_message",
  "tool_call",
  "tool_result",
  "tool_error",
  "final_response",
  "system",
]);

export type TranscriptEntryType = z.infer<typeof TranscriptEntryTypeSchema>;

/**
 * Single entry in a transcript
 */
export const TranscriptEntrySchema = z.object({
  /** Entry type */
  type: TranscriptEntryTypeSchema,
  /** Timestamp of the entry */
  timestamp: z.string(),
  /** Content depends on type */
  content: z.unknown(),
  /** Metadata about the entry */
  metadata: z.record(z.unknown()).optional(),
});

export type TranscriptEntry = z.infer<typeof TranscriptEntrySchema>;

/**
 * Tool call entry content
 */
export const ToolCallContentSchema = z.object({
  toolName: z.string(),
  toolCallId: z.string().optional(),
  arguments: z.record(z.unknown()),
});

export type ToolCallContent = z.infer<typeof ToolCallContentSchema>;

/**
 * Tool result entry content
 */
export const ToolResultContentSchema = z.object({
  toolName: z.string(),
  toolCallId: z.string().optional(),
  result: z.unknown(),
  isError: z.boolean().default(false),
});

export type ToolResultContent = z.infer<typeof ToolResultContentSchema>;

/**
 * Complete interaction transcript
 */
export const TranscriptSchema = z.object({
  /** Unique identifier for the transcript */
  id: z.string(),
  /** Test prompt ID this transcript is for */
  testPromptId: z.string(),
  /** When the interaction started */
  startTime: z.string(),
  /** When the interaction ended */
  endTime: z.string().optional(),
  /** Total iterations/turns */
  iterations: z.number(),
  /** All entries in order */
  entries: z.array(TranscriptEntrySchema),
  /** Summary of tools called */
  toolsCalled: z.array(z.string()),
  /** Final response text if any */
  finalResponse: z.string().optional(),
});

export type Transcript = z.infer<typeof TranscriptSchema>;
