# Interaction Types

Types for Claude interaction testing, transcripts, and expectations.

## Files

### transcript.ts
Types for recording interaction transcripts:

```typescript
export type TranscriptEntry =
  | { type: 'user_message'; content: string; timestamp: string }
  | { type: 'claude_response'; response: any; timestamp: string }
  | { type: 'tool_call'; toolName: string; arguments: any; timestamp: string }
  | { type: 'tool_result'; toolName: string; result: any; timestamp: string }
  | { type: 'tool_error'; toolName: string; error: string; timestamp: string }
  | { type: 'final_response'; content: string; timestamp: string };

export interface Transcript {
  promptId: string;
  startTime: string;
  endTime?: string;
  entries: TranscriptEntry[];
  summary: {
    totalToolCalls: number;
    toolsUsed: string[];
    errors: number;
    iterations: number;
  };
}
```

### expectations.ts
Types for defining test expectations:

```typescript
export interface Expectation {
  expectedToolCalls?: Array<{
    toolName: string;
    argumentsContain?: Record<string, unknown>;
  }>;
  shouldSucceed?: boolean;
  maxIterations?: number;
  customValidation?: string;  // LLM prompt for custom validation
}

export interface SafetyPolicy {
  id: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface TestPrompt {
  id: string;
  name: string;
  prompt: string;
  expectations?: Expectation;
  safetyPolicies?: SafetyPolicy[];
  maxIterations?: number;
  tags?: string[];
}
```

## Example Usage

```typescript
const testPrompt: TestPrompt = {
  id: 'basic-tool-test',
  name: 'Basic Tool Usage',
  prompt: 'List tools and use the echo tool with "hello"',
  expectations: {
    expectedToolCalls: [
      { toolName: 'echo', argumentsContain: { message: 'hello' } }
    ],
    shouldSucceed: true,
  },
  safetyPolicies: [
    {
      id: 'no-pii',
      description: 'Should not expose PII',
      severity: 'critical',
    }
  ],
};
```
