# @mcp-qa/cli

Command-line interface for the MCP QA Platform.

## Purpose

Thin CLI wrapper around `@mcp-qa/runner` that handles:

- **Argument Parsing** - Command-line options and flags
- **Interactive Auth** - Opens browser, runs local callback server
- **Progress Display** - Formatted terminal output with colors
- **Exit Codes** - Proper exit codes for CI/CD integration

## Design Principles

1. **Minimal Logic** - All test execution is in `@mcp-qa/runner`
2. **Terminal Friendly** - Clear output, proper colors, progress indicators
3. **CI/CD Ready** - Exit codes, JSON output option, non-interactive mode
4. **Bun Native** - Uses Bun runtime for fast startup

## Structure

```
src/
├── commands/
│   ├── run.ts           # Main test run command
│   ├── validate.ts      # Config validation (dry run)
│   └── init.ts          # Generate example configuration
│
├── output/
│   ├── progress.ts      # Progress display utilities
│   ├── reporter.ts      # Console report formatting
│   └── colors.ts        # Terminal color helpers
│
├── index.ts             # CLI entry point (argument parsing)
└── bin.ts               # Shebang entry for npx/bunx
```

## Usage

### Run Tests

```bash
# Basic usage
mcp-qa-cli config.json

# With options
mcp-qa-cli config.json --verbose --interactive

# CI mode (no colors, JSON output)
mcp-qa-cli config.json --json --no-color
```

### Validate Configuration

```bash
mcp-qa-cli validate config.json
```

### Generate Example Config

```bash
mcp-qa-cli init --output my-config.json
```

## Command-Line Options

| Option | Description |
|--------|-------------|
| `--verbose`, `-v` | Show detailed progress for each check |
| `--interactive`, `-i` | Enable OAuth browser flow |
| `--anthropic-key <key>` | Anthropic API key (or use `ANTHROPIC_API_KEY`) |
| `--json` | Output report as JSON |
| `--no-color` | Disable colored output |
| `--help`, `-h` | Show help |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All tests passed |
| 1 | One or more tests failed |
| 2 | Configuration error |
| 3 | Runtime error |

## Progress Output

```
[auth] ✓ PRM Discovery: Successfully discovered Protected Resource Metadata
[auth] ✓ AS Metadata Discovery: Successfully discovered Authorization Server
[protocol] ✓ Connection Established: Connected to MCP server
[tools] ✓ List Tools: Server exposes 5 tools
[tools] ⚠ Tool: large_schema: Tool definition is large (6000 tokens)
[interaction] ✓ Prompt: Basic Tool Usage: Completed in 3 iterations

Test completed: PASS
  Total: 12
  Passed: 10
  Failed: 0
  Warnings: 2
```

## Dependencies

- `@mcp-qa/runner`
- `@mcp-qa/core`
- `open` (for opening browser)
