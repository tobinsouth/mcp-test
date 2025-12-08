import { z } from 'zod';

/**
 * Safety policy for interaction testing
 */
export const SafetyPolicySchema = z.object({
  id: z.string(),
  description: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
});

/**
 * Expected tool call configuration
 */
export const ExpectedToolCallSchema = z.object({
  toolName: z.string(),
  argumentsContain: z.record(z.unknown()).optional(),
});

/**
 * Expectation configuration for test prompts
 */
export const ExpectationSchema = z.object({
  expectedToolCalls: z.array(ExpectedToolCallSchema).optional(),
  shouldSucceed: z.boolean().default(true),
  maxIterations: z.number().min(1).max(50).default(20),
  customValidation: z.string().optional(),
});

/**
 * Test prompt configuration
 */
export const TestPromptSchema = z.object({
  id: z.string(),
  name: z.string(),
  prompt: z.string(),
  expectations: ExpectationSchema.optional(),
  safetyPolicies: z.array(SafetyPolicySchema).optional(),
  maxIterations: z.number().optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * Auth phase configuration
 */
export const AuthPhaseConfigSchema = z.object({
  enabled: z.boolean().default(true),
  timeout: z.number().default(30000),
});

/**
 * Protocol phase configuration
 */
export const ProtocolPhaseConfigSchema = z.object({
  enabled: z.boolean().default(true),
  testInitialization: z.boolean().default(true),
  testCapabilities: z.boolean().default(true),
  timeout: z.number().default(30000),
});

/**
 * Tools phase configuration
 */
export const ToolsPhaseConfigSchema = z.object({
  enabled: z.boolean().default(true),
  analyzeTokenCounts: z.boolean().default(true),
  timeout: z.number().default(30000),
});

/**
 * Interaction phase configuration
 */
export const InteractionPhaseConfigSchema = z.object({
  enabled: z.boolean().default(true),
  prompts: z.array(TestPromptSchema).default([]),
  defaultModel: z.string().default('claude-sonnet-4-20250514'),
  safetyReviewModel: z.string().default('claude-3-haiku-20240307'),
  qualityReviewModel: z.string().default('claude-3-haiku-20240307'),
});

/**
 * Complete phase configuration
 */
export const PhaseConfigSchema = z.object({
  auth: AuthPhaseConfigSchema.optional(),
  protocol: ProtocolPhaseConfigSchema.optional(),
  tools: ToolsPhaseConfigSchema.optional(),
  interaction: InteractionPhaseConfigSchema.optional(),
});

export type SafetyPolicy = z.infer<typeof SafetyPolicySchema>;
export type ExpectedToolCall = z.infer<typeof ExpectedToolCallSchema>;
export type Expectation = z.infer<typeof ExpectationSchema>;
export type TestPrompt = z.infer<typeof TestPromptSchema>;
export type AuthPhaseConfig = z.infer<typeof AuthPhaseConfigSchema>;
export type ProtocolPhaseConfig = z.infer<typeof ProtocolPhaseConfigSchema>;
export type ToolsPhaseConfig = z.infer<typeof ToolsPhaseConfigSchema>;
export type InteractionPhaseConfig = z.infer<typeof InteractionPhaseConfigSchema>;
export type PhaseConfig = z.infer<typeof PhaseConfigSchema>;
