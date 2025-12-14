// Auth configuration
export {
  NoAuthSchema,
  ClientCredentialsAuthSchema,
  AuthorizationCodeAuthSchema,
  AuthConfigSchema,
  type NoAuthConfig,
  type ClientCredentialsAuthConfig,
  type AuthorizationCodeAuthConfig,
  type AuthConfig,
} from "./auth.js";

// Server configuration
export { ServerConfigSchema, type ServerConfig } from "./server.js";

// Phase configuration
export {
  SafetyPolicySchema,
  ExpectedToolCallSchema,
  ExpectationSchema,
  TestPromptSchema,
  AuthPhaseConfigSchema,
  ProtocolPhaseConfigSchema,
  ToolsPhaseConfigSchema,
  InteractionPhaseConfigSchema,
  PhaseConfigSchema,
  type SafetyPolicy,
  type ExpectedToolCall,
  type Expectation,
  type TestPrompt,
  type AuthPhaseConfig,
  type ProtocolPhaseConfig,
  type ToolsPhaseConfig,
  type InteractionPhaseConfig,
  type PhaseConfig,
} from "./phases.js";

// Output configuration
export { OutputConfigSchema, type OutputConfig } from "./output.js";

// Main test configuration
export { TestConfigSchema, type TestConfig } from "./test-config.js";
