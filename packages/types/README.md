# @mcp-qa/types

Shared TypeScript types and Zod validation schemas for the MCP QA Platform.

## Purpose

This package provides the foundational type definitions used across all other packages:

- **Configuration schemas** - Zod schemas for test configuration validation
- **Result types** - Types for test checks, phase results, and reports
- **Interaction types** - Types for transcripts, expectations, and safety policies

## Design Principles

1. **Zero runtime dependencies** (except Zod for schema validation)
2. **Single source of truth** for all type definitions
3. **Strict typing** with no `any` types
4. **Exportable schemas** - Zod schemas can be used for runtime validation

## Structure

```
src/
├── config/           # Configuration schemas
│   ├── auth.ts       # AuthConfig (none, client_credentials, authorization_code)
│   ├── phases.ts     # PhaseConfig for each test phase
│   ├── server.ts     # Server connection configuration
│   └── test-config.ts # Main TestConfigSchema
│
├── results/          # Test result types
│   ├── check.ts      # TestCheck, CheckStatus
│   ├── phase-result.ts # PhaseResult
│   └── report.ts     # TestReport
│
├── interaction/      # Claude interaction types
│   ├── transcript.ts # TranscriptEntry, Transcript
│   └── expectations.ts # Expectations, SafetyPolicy
│
└── index.ts          # Main entry point
```

## Usage

```typescript
import {
  TestConfigSchema,
  type TestConfig,
  type TestCheck,
  type PhaseResult,
  type TestReport
} from '@mcp-qa/types';

// Validate configuration at runtime
const config = TestConfigSchema.parse(jsonConfig);

// Use types for strict typing
const check: TestCheck = {
  id: 'auth-pkce-supported',
  name: 'PKCE Support',
  description: 'Server supports PKCE S256',
  status: 'SUCCESS',
  timestamp: new Date().toISOString(),
};
```

## Key Types

### CheckStatus
```typescript
type CheckStatus = 'SUCCESS' | 'FAILURE' | 'WARNING' | 'SKIPPED' | 'INFO';
```

### TestCheck
Individual test assertion with status, description, and optional details.

### PhaseResult
Results from a single test phase (auth, protocol, tools, interaction).

### TestReport
Complete test run report with all phases and summary statistics.

## Dependencies

- `zod` - Runtime schema validation
