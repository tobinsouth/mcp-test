/**
 * Extensible test configuration schema
 * Designed for future expansion with new auth types, test phases, etc.
 */

import { z } from 'zod';

// Auth configuration - extensible for future auth methods
const ClientCredentialsAuthSchema = z.object({
  type: z.literal('client_credentials'),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  tokenEndpoint: z.string().url().optional(), // Override if not using discovery
});

const AuthorizationCodeAuthSchema = z.object({
  type: z.literal('authorization_code'),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  clientMetadataUrl: z.string().url().optional(), // For CIMD (URL-based client ID)
  redirectUri: z.string().url().optional(),
  scopes: z.array(z.string()).optional(),
  useDCR: z.boolean().optional().default(true), // Use Dynamic Client Registration
  interactive: z.boolean().optional().default(false), // Require user interaction
});

const NoAuthSchema = z.object({
  type: z.literal('none'),
});

const AuthConfigSchema = z.discriminatedUnion('type', [
  NoAuthSchema,
  ClientCredentialsAuthSchema,
  AuthorizationCodeAuthSchema,
]);

// Test prompt configuration
const ExpectationSchema = z.object({
  expectedToolCalls: z.array(z.object({
    toolName: z.string(),
    argumentsContain: z.record(z.string(), z.unknown()).optional(),
  })).optional(),
  shouldSucceed: z.boolean().optional().default(true),
  maxIterations: z.number().min(1).max(50).optional().default(20),
  customValidation: z.string().optional(), // LLM prompt for custom validation
});

const SafetyPolicySchema = z.object({
  id: z.string(),
  description: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
});

const TestPromptSchema = z.object({
  id: z.string(),
  name: z.string(),
  prompt: z.string(),
  expectations: ExpectationSchema.optional(),
  safetyPolicies: z.array(SafetyPolicySchema).optional(),
  maxIterations: z.number().optional(),
  tags: z.array(z.string()).optional(),
});

// Phase configuration - extensible
const PhaseConfigSchema = z.object({
  auth: z.object({
    enabled: z.boolean().optional().default(true),
    timeout: z.number().optional().default(30000),
  }).optional(),
  protocol: z.object({
    enabled: z.boolean().optional().default(true),
    testInitialization: z.boolean().optional().default(true),
    testCapabilities: z.boolean().optional().default(true),
    timeout: z.number().optional().default(30000),
  }).optional(),
  tools: z.object({
    enabled: z.boolean().optional().default(true),
    analyzeTokenCounts: z.boolean().optional().default(true),
    timeout: z.number().optional().default(30000),
  }).optional(),
  interaction: z.object({
    enabled: z.boolean().optional().default(true),
    prompts: z.array(TestPromptSchema).optional().default([]),
    defaultModel: z.string().optional().default('claude-sonnet-4-20250514'),
    safetyReviewModel: z.string().optional().default('claude-3-haiku-20240307'),
    qualityReviewModel: z.string().optional().default('claude-3-haiku-20240307'),
  }).optional(),
});

// Main configuration schema
export const TestConfigSchema = z.object({
  version: z.literal('1.0'),
  server: z.object({
    url: z.string().url(),
    name: z.string().optional(),
    transport: z.enum(['streamable-http', 'sse', 'stdio']).optional().default('streamable-http'),
    headers: z.record(z.string(), z.string()).optional(),
  }),
  auth: AuthConfigSchema,
  phases: PhaseConfigSchema.optional(),
  output: z.object({
    transcriptDir: z.string().optional().default('./transcripts'),
    reportPath: z.string().optional().default('./test-report.json'),
    format: z.enum(['json', 'html', 'markdown']).optional().default('json'),
  }).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(), // Extensible metadata
});

// Export types inferred from schemas
export type TestConfig = z.infer<typeof TestConfigSchema>;
export type AuthConfig = z.infer<typeof AuthConfigSchema>;
export type NoAuthConfig = z.infer<typeof NoAuthSchema>;
export type ClientCredentialsAuthConfig = z.infer<typeof ClientCredentialsAuthSchema>;
export type AuthorizationCodeAuthConfig = z.infer<typeof AuthorizationCodeAuthSchema>;
export type TestPrompt = z.infer<typeof TestPromptSchema>;
export type Expectation = z.infer<typeof ExpectationSchema>;
export type SafetyPolicy = z.infer<typeof SafetyPolicySchema>;
export type PhaseConfig = z.infer<typeof PhaseConfigSchema>;
