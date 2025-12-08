import { runCommand, validateCommand, initCommand } from "./commands/index.js";

const HELP_TEXT = `
MCP Server QA Test Runner

Usage:
  mcp-qa-cli <config.json> [options]     Run tests with configuration file
  mcp-qa-cli validate <config.json>      Validate configuration file
  mcp-qa-cli init [options]              Generate example configuration

Options:
  --anthropic-key <key>  Anthropic API key (or set ANTHROPIC_API_KEY env var)
  --interactive, -i      Enable interactive OAuth flow (opens browser for consent)
  --verbose, -v          Show detailed progress for each check
  --json                 Output report as JSON
  --no-color             Disable colored output
  --help, -h             Show this help message

Init Options:
  --output, -o <path>    Output path for config file (default: mcp-qa-config.json)
  --force, -f            Overwrite existing file

Examples:
  mcp-qa-cli ./test-config.json --verbose
  mcp-qa-cli ./test-config.json --interactive --anthropic-key sk-ant-...
  mcp-qa-cli validate ./test-config.json
  mcp-qa-cli init --output my-config.json

Exit Codes:
  0  All tests passed
  1  One or more tests failed
  2  Configuration error
  3  Runtime error
`;

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): {
  command: "run" | "validate" | "init" | "help";
  configPath?: string;
  verbose: boolean;
  interactive: boolean;
  anthropicKey?: string;
  json: boolean;
  noColor: boolean;
  output: string;
  force: boolean;
} {
  const result = {
    command: "run" as "run" | "validate" | "init" | "help",
    configPath: undefined as string | undefined,
    verbose: false,
    interactive: false,
    anthropicKey: undefined as string | undefined,
    json: false,
    noColor: false,
    output: "mcp-qa-config.json",
    force: false,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      result.command = "help";
      return result;
    }

    if (arg === "validate") {
      result.command = "validate";
      i++;
      continue;
    }

    if (arg === "init") {
      result.command = "init";
      i++;
      continue;
    }

    if (arg === "--verbose" || arg === "-v") {
      result.verbose = true;
      i++;
      continue;
    }

    if (arg === "--interactive" || arg === "-i") {
      result.interactive = true;
      i++;
      continue;
    }

    if (arg === "--json") {
      result.json = true;
      i++;
      continue;
    }

    if (arg === "--no-color") {
      result.noColor = true;
      i++;
      continue;
    }

    if (arg === "--force" || arg === "-f") {
      result.force = true;
      i++;
      continue;
    }

    if (arg === "--anthropic-key" && args[i + 1]) {
      result.anthropicKey = args[i + 1];
      i += 2;
      continue;
    }

    if (arg === "--output" || arg === "-o") {
      const nextArg = args[i + 1];
      if (nextArg) {
        result.output = nextArg;
        i += 2;
        continue;
      }
    }

    // Assume it's a config path if it doesn't start with -
    if (arg && !arg.startsWith("-")) {
      result.configPath = arg;
      i++;
      continue;
    }

    // Unknown option
    console.error(`Unknown option: ${arg}`);
    result.command = "help";
    return result;
  }

  // Validate required arguments
  if (result.command === "run" && !result.configPath) {
    result.command = "help";
  }

  if (result.command === "validate" && !result.configPath) {
    result.command = "help";
  }

  return result;
}

/**
 * Main CLI entry point
 */
export async function main(args: string[]): Promise<number> {
  const parsed = parseArgs(args);

  if (parsed.command === "help") {
    console.log(HELP_TEXT);
    return 0;
  }

  if (parsed.command === "validate") {
    return validateCommand({
      configPath: parsed.configPath!,
      noColor: parsed.noColor,
    });
  }

  if (parsed.command === "init") {
    return initCommand({
      output: parsed.output,
      noColor: parsed.noColor,
      force: parsed.force,
    });
  }

  // Default: run command
  return runCommand({
    configPath: parsed.configPath!,
    verbose: parsed.verbose,
    interactive: parsed.interactive,
    anthropicKey: parsed.anthropicKey,
    json: parsed.json,
    noColor: parsed.noColor,
  });
}

// Export for programmatic use
export * from "./commands/index.js";
export * from "./output/index.js";
