# @mcp-qa/runner Source

Main test runner with modular test phases.

## Directory Structure

```
src/
├── phases/               # Test phase implementations
│   ├── base/             # Base phase utilities and interfaces
│   ├── auth/             # OAuth discovery phase
│   ├── protocol/         # Protocol conformance phase
│   ├── tools/            # Tool quality analysis phase
│   └── interaction/      # Claude interaction phase
├── runner.ts             # Main orchestration
├── config-loader.ts      # Configuration loading
└── index.ts              # Main entry point
```

## Main Entry Points

### runner.ts
Main test orchestration:

```typescript
import { runTests } from '@mcp-qa/runner';

const report = await runTests('./config.json', {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  interactive: true,
  onProgress: (phase, check) => {
    console.log(`[${phase}] ${check.name}: ${check.status}`);
  },
});
```

### config-loader.ts
Configuration loading and validation:

```typescript
import { loadConfig } from '@mcp-qa/runner';

const config = await loadConfig('./config.json');
// Throws if validation fails
```

## Phase Execution Order

1. **Auth Phase** - Discovery only (PRM, AS metadata)
2. **Protocol Phase** - Connection establishment (auth happens here via 401)
3. **Tools Phase** - Tool listing and quality analysis
4. **Interaction Phase** - Claude interaction testing

Each phase receives context from previous phases:
- Auth → provides `TestOAuthProvider`
- Protocol → provides connected `Client`
- Tools → uses `Client` to list tools
- Interaction → uses `Client` for tool calls

## Exports

```typescript
// Main API
import { runTests, loadConfig } from '@mcp-qa/runner';

// Phase runners (for custom orchestration)
import { runAuthPhase } from '@mcp-qa/runner/phases';
import { runProtocolPhase } from '@mcp-qa/runner/phases';
import { runToolsPhase } from '@mcp-qa/runner/phases';
import { runInteractionPhase } from '@mcp-qa/runner/phases';
```

## Design Principles

1. **Programmatic API** - Can be used as a library
2. **Modular Phases** - Each phase is independent
3. **Progress Callbacks** - Real-time check notifications
4. **Resource Cleanup** - Proper connection cleanup
