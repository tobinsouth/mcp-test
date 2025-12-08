// Base phase utilities
export * from './base/index.js';

// Auth phase
export { runAuthPhase, type AuthPhaseOptions, authChecks } from './auth/index.js';

// Protocol phase
export { runProtocolPhase, type ProtocolPhaseOptions, protocolChecks } from './protocol/index.js';

// Tools phase
export {
  runToolsPhase,
  type ToolsPhaseOptions,
  type ToolsPhaseResult,
  analyzeToolMetrics,
  calculateAggregateMetrics,
  type ToolMetrics,
} from './tools/index.js';

// Interaction phase
export {
  runInteractionPhase,
  type InteractionPhaseOptions,
  TranscriptRecorder,
  reviewSafety,
  reviewQuality,
  evaluateToolCalls,
  type ToolCallRecord,
  type ExpectationEvalResult,
} from './interaction/index.js';
