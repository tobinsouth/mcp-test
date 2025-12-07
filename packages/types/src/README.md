# @mcp-qa/types Source

This directory contains all type definitions and Zod schemas for the MCP QA Platform.

## Directory Structure

```
src/
├── config/           # Configuration schemas (Zod)
├── results/          # Test result types
├── interaction/      # Transcript and expectation types
└── index.ts          # Main entry point (re-exports all)
```

## Modules

### config/
Zod schemas for test configuration validation:
- `auth.ts` - Auth configuration (none, client_credentials, authorization_code)
- `phases.ts` - Phase configuration schemas
- `server.ts` - Server connection configuration
- `test-config.ts` - Main TestConfigSchema

### results/
Types for test execution results:
- `check.ts` - TestCheck type and CheckStatus enum
- `phase-result.ts` - PhaseResult type
- `report.ts` - TestReport type

### interaction/
Types for Claude interaction testing:
- `transcript.ts` - TranscriptEntry, Transcript types
- `expectations.ts` - Expectation and SafetyPolicy types

## Usage

```typescript
// Import everything from main entry
import {
  TestConfigSchema,
  type TestConfig,
  type TestCheck,
  type PhaseResult,
  type TestReport,
} from '@mcp-qa/types';

// Or import specific modules
import { TestConfigSchema } from '@mcp-qa/types/config';
import type { TestCheck } from '@mcp-qa/types/results';
```

## Design Principles

1. **Zero runtime dependencies** (except Zod)
2. **Strict typing** - No `any` types
3. **Exportable schemas** - Zod schemas for runtime validation
4. **Single source of truth** - All types defined here
