# Tools Phase

Tool quality analysis phase.

## Purpose

Analyzes the MCP server's tool definitions for quality and potential issues.

## What It Does

1. **List Tools**
   - Calls `client.listTools()`
   - Records tool count and names

2. **Token Analysis**
   - Counts tokens in description + schema
   - Warns if individual tools are too large (>5000 tokens)
   - Warns if total is too large (>50000 tokens)

3. **Quality Checks**
   - Missing descriptions
   - Missing input schemas
   - Overly large schemas
   - Annotation presence

## Files

### tools-phase.ts

```typescript
export async function runToolsPhase(
  client: Client,
  options?: {
    onProgress?: (check: TestCheck) => void;
    analyzeTokenCounts?: boolean;
  }
): Promise<PhaseResult & { toolMetrics?: ToolMetrics[] }>;
```

### metrics.ts
Tool metrics calculation:

```typescript
export interface ToolMetrics {
  name: string;
  descriptionTokens: number;
  schemaTokens: number;
  totalTokens: number;
  hasDescription: boolean;
  hasInputSchema: boolean;
  hasOutputSchema: boolean;
  hasAnnotations: boolean;
  annotationDetails?: Record<string, unknown>;
}
```

## Check IDs

| ID | Description |
|----|-------------|
| `tools-list-success` | Successfully listed tools |
| `tools-none-available` | Server has no tools (warning) |
| `tools-token-analysis` | Token count summary |
| `tools-{name}-no-description` | Tool missing description |
| `tools-{name}-large` | Tool definition too large |
| `tools-list-failed` | Failed to list tools |

## Why This Matters

Large tool definitions impact:
- **Context window usage** - Less room for conversation
- **Response quality** - Claude may miss important details
- **Cost** - More tokens = higher API costs
- **Latency** - More data to process

## Thresholds

| Metric | Warning Threshold |
|--------|------------------|
| Single tool | >5000 tokens |
| Total all tools | >50000 tokens |

These can be adjusted in configuration.
