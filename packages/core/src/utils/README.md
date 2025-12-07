# Utilities

Shared utility functions for the MCP QA Platform.

## Files

### tokens.ts

Token counting utilities for analyzing tool definitions.

```typescript
import { countTokens } from '@mcp-qa/core/utils';

// Approximate token count
const tokens = countTokens('Hello, world!');  // ~3

// Use for tool analysis
const toolTokens = countTokens(JSON.stringify(tool.inputSchema));
```

**Implementation Notes:**
- Uses approximate counting (~4 chars per token)
- For production accuracy, consider using `tiktoken` or Anthropic's tokenizer
- Sufficient for relative comparisons and warnings

### report.ts

Report generation helpers.

```typescript
import { summarizeChecks, generateReport } from '@mcp-qa/core/utils';

// Summarize check results
const summary = summarizeChecks(checks);
// { total: 10, success: 8, failure: 1, warning: 1, skipped: 0 }

// Generate final report
const report = generateReport(phases, serverUrl, serverName);
```

## Adding New Utilities

1. Create new file in `utils/`
2. Export from `utils/index.ts`
3. Re-export from `@mcp-qa/core` main entry if needed
4. Add tests in `__tests__/`

## Guidelines

- Keep utilities pure (no side effects)
- No dependencies on other packages except `@mcp-qa/types`
- Include JSDoc comments for public functions
- Write unit tests for all utilities
