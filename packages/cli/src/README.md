# @mcp-qa/cli Source

CLI interface for the MCP QA Platform.

## Directory Structure

```
src/
├── commands/         # CLI commands
├── output/           # Output formatting utilities
├── index.ts          # CLI entry point (argument parsing)
└── bin.ts            # Shebang entry for npx/bunx
```

## Entry Points

### bin.ts
Executable entry point with shebang:

```typescript
#!/usr/bin/env bun
import { main } from './index';
main();
```

### index.ts
Main CLI logic:
- Argument parsing
- Command routing
- Error handling

## Usage

```bash
# Run tests
mcp-qa-cli config.json

# With options
mcp-qa-cli config.json --verbose --interactive

# Validate config
mcp-qa-cli validate config.json

# Generate example config
mcp-qa-cli init --output my-config.json
```

## Command-Line Options

| Option | Description |
|--------|-------------|
| `--verbose`, `-v` | Show detailed progress |
| `--interactive`, `-i` | Enable OAuth browser flow |
| `--anthropic-key <key>` | API key (or use env var) |
| `--json` | Output report as JSON |
| `--no-color` | Disable colors |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All tests passed |
| 1 | Tests failed |
| 2 | Configuration error |
| 3 | Runtime error |

## Design Principles

1. **Minimal Logic** - All test logic in `@mcp-qa/runner`
2. **CI/CD Ready** - Proper exit codes, JSON output
3. **User Friendly** - Clear progress, colored output
4. **Bun Native** - Fast startup with Bun runtime
