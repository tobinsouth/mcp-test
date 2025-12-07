# Interaction Phase

Claude-powered interaction testing phase.

## Purpose

Tests the MCP server through realistic Claude interactions, including:
- Tool usage verification
- Safety policy compliance
- Quality assessment
- Custom validation

## What It Does

1. **Load Tools for Claude**
   - Converts MCP tools to Claude tool format
   - Validates tool schemas

2. **Run Test Prompts**
   - Sends user prompt to Claude
   - Claude uses MCP tools via server
   - Records full transcript

3. **Evaluate Results**
   - Expected tool calls (did Claude call the right tools?)
   - Safety review (LLM-based policy checking)
   - Quality review (LLM-based assessment)
   - Custom validation

## Files

### interaction-phase.ts
Main phase runner.

### transcript.ts
`TranscriptRecorder` class for recording interactions:

```typescript
const recorder = new TranscriptRecorder(promptId);
recorder.recordUserMessage(prompt);
recorder.recordToolCall(name, args);
recorder.recordToolResult(name, result);
recorder.recordFinalResponse(text);
await recorder.saveToFile(transcriptDir);
```

### safety-review.ts
LLM-based safety policy review:

```typescript
await reviewSafety(
  transcript,
  safetyPolicies,
  'claude-3-haiku-20240307',
  anthropic,
  pushCheck
);
```

### quality-review.ts
LLM-based quality assessment:

```typescript
await reviewQuality(
  transcript,
  expectations,
  'claude-3-haiku-20240307',
  anthropic,
  pushCheck
);
```

### expectation-eval.ts
Tool call expectation matching.

## Check IDs

| ID | Description |
|----|-------------|
| `interaction-tools-loaded` | Tools loaded for Claude |
| `interaction-{id}-start` | Prompt test starting |
| `interaction-{id}-complete` | Prompt test completed |
| `interaction-{id}-evaluation` | Expectations evaluated |
| `safety-{policyId}` | Safety policy check |
| `quality-overall` | Quality assessment |

## Agentic Loop

The interaction follows Claude's agentic loop:

```
User Prompt → Claude → Tool Call → MCP Server → Tool Result → Claude → ...
```

Loop continues until:
- Claude provides final response (no tool calls)
- Max iterations reached
- Error occurs

## Models Used

| Purpose | Default Model |
|---------|---------------|
| Main interaction | claude-sonnet-4-20250514 |
| Safety review | claude-3-haiku-20240307 |
| Quality review | claude-3-haiku-20240307 |

Models are configurable in test configuration.
