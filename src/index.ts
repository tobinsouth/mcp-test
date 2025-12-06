#!/usr/bin/env bun

/**
 * MCP Server Test Runner CLI
 *
 * Usage:
 *   mcp-test <config.json> [options]
 *
 * Options:
 *   --anthropic-key <key>  Anthropic API key (or set ANTHROPIC_API_KEY)
 *   --interactive          Enable interactive OAuth flow (opens browser for consent)
 *   --verbose              Show detailed progress
 *   --help                 Show this help
 */

import { runTests } from './runner.js';

const HELP_TEXT = `
MCP Server Test Runner

Usage:
  mcp-test <config.json> [options]

Options:
  --anthropic-key <key>  Anthropic API key (or set ANTHROPIC_API_KEY)
  --interactive          Enable interactive OAuth flow (opens browser for consent)
  --verbose              Show detailed progress
  --help                 Show this help

Example:
  mcp-test ./test-config.json --verbose --interactive
`;

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const configPath = args[0]!;
  const verbose = args.includes('--verbose') || args.includes('-v');
  const interactive = args.includes('--interactive') || args.includes('-i');
  const keyIndex = args.indexOf('--anthropic-key');
  const anthropicApiKey = keyIndex >= 0 ? args[keyIndex + 1] : undefined;

  console.log('MCP Server Test Runner');
  console.log('======================\n');
  console.log(`Config: ${configPath}`);
  console.log(`Interactive: ${interactive}`);
  console.log(`Verbose: ${verbose}\n`);

  try {
    const report = await runTests(configPath, {
      anthropicApiKey,
      interactive,
      onProgress: verbose ? (phase, check) => {
        const icon = check.status === 'SUCCESS' ? '✓' :
                     check.status === 'FAILURE' ? '✗' :
                     check.status === 'WARNING' ? '⚠' : '•';
        console.log(`[${phase}] ${icon} ${check.name}: ${check.description}`);
      } : undefined,
    });

    console.log(`\n${'='.repeat(40)}`);
    console.log(`Test completed: ${report.overallStatus}`);
    console.log(`${'='.repeat(40)}\n`);
    console.log(`  Total:    ${report.summary.totalChecks}`);
    console.log(`  Passed:   ${report.summary.passed}`);
    console.log(`  Failed:   ${report.summary.failed}`);
    console.log(`  Warnings: ${report.summary.warnings}`);
    console.log(`  Skipped:  ${report.summary.skipped}`);
    console.log(`\nDuration: ${report.totalDurationMs}ms`);
    console.log(`Report saved to: test-report.json\n`);

    process.exit(report.overallStatus === 'FAIL' ? 1 : 0);

  } catch (error) {
    console.error('\nTest runner failed:', error);
    process.exit(1);
  }
}

main();
