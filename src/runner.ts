/**
 * Main Test Runner
 *
 * Orchestrates all test phases and generates the final report.
 */

import * as fs from 'fs/promises';
import { TestConfigSchema, type TestConfig } from './types/config.js';
import type { TestReport, PhaseResult, TestCheck } from './types/index.js';
import { runAuthPhase, type InteractiveAuthHandler } from './auth/index.js';
import { runProtocolPhase } from './phases/protocol/index.js';
import { runToolsPhase } from './phases/tools/index.js';
import { runInteractionPhase } from './phases/interaction/index.js';
import { createCLIAuthHandler } from './cli/interactive-auth.js';

export interface RunTestsOptions {
  anthropicApiKey?: string;
  onProgress?: (phase: string, check: TestCheck) => void;
  interactive?: boolean; // Enable interactive OAuth flow (CLI mode)
  interactiveHandler?: InteractiveAuthHandler; // Custom handler (web mode)
}

export async function runTests(
  configPath: string,
  options?: RunTestsOptions
): Promise<TestReport> {
  const configRaw = await fs.readFile(configPath, 'utf-8');
  const config = TestConfigSchema.parse(JSON.parse(configRaw));

  const report: TestReport = {
    version: '1.0',
    serverUrl: config.server.url,
    serverName: config.server.name,
    startTime: new Date().toISOString(),
    endTime: '',
    totalDurationMs: 0,
    phases: [],
    overallStatus: 'PASS',
    summary: { totalChecks: 0, passed: 0, failed: 0, warnings: 0, skipped: 0 },
  };

  const startMs = Date.now();

  // Track cleanup functions for resource management
  const cleanupFns: Array<() => Promise<void>> = [];

  try {
    // Phase 1: Auth (discovery only - actual auth happens in protocol phase)
    if (config.phases?.auth?.enabled !== false) {
      // Create interactive handler if needed:
      // - Use provided handler (web mode)
      // - Or create CLI handler if --interactive flag is set
      const interactiveHandler = options?.interactiveHandler
        ?? (options?.interactive ? createCLIAuthHandler() : undefined);

      const authResult = await runAuthPhase(
        config.server.url,
        config.auth,
        {
          recorder: {
            pushCheck: (check) => options?.onProgress?.('auth', check),
          },
          interactiveHandler,
        }
      );
      report.phases.push(authResult);
      if (authResult.cleanup) cleanupFns.push(authResult.cleanup);

      // Phase 2: Protocol (using auth provider - auth happens here via 401)
      if (config.phases?.protocol?.enabled !== false) {
        const protocolResult = await runProtocolPhase(
          config.server.url,
          authResult.provider,
          {
            onProgress: (check) => options?.onProgress?.('protocol', check),
            testCapabilities: config.phases?.protocol?.testCapabilities,
          }
        );
        report.phases.push(protocolResult);
        if (protocolResult.cleanup) cleanupFns.push(protocolResult.cleanup);

        // Phase 3: Tools
        if (config.phases?.tools?.enabled !== false && protocolResult.client) {
          const toolsResult = await runToolsPhase(
            protocolResult.client,
            {
              onProgress: (check) => options?.onProgress?.('tools', check),
              analyzeTokenCounts: config.phases?.tools?.analyzeTokenCounts,
            }
          );
          report.phases.push(toolsResult);
          if (toolsResult.cleanup) cleanupFns.push(toolsResult.cleanup);
        }

        // Phase 4: Interaction
        const prompts = config.phases?.interaction?.prompts || [];
        if (config.phases?.interaction?.enabled !== false && prompts.length > 0 && protocolResult.client) {
          const anthropicApiKey = options?.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
          if (!anthropicApiKey) {
            throw new Error('ANTHROPIC_API_KEY required for interaction testing');
          }

          const interactionResult = await runInteractionPhase(
            protocolResult.client,
            prompts,
            {
              anthropicApiKey,
              transcriptDir: config.output?.transcriptDir || './transcripts',
              onProgress: (check) => options?.onProgress?.('interaction', check),
              safetyReviewModel: config.phases?.interaction?.safetyReviewModel,
              qualityReviewModel: config.phases?.interaction?.qualityReviewModel,
              defaultModel: config.phases?.interaction?.defaultModel,
            }
          );
          report.phases.push(interactionResult);
          if (interactionResult.cleanup) cleanupFns.push(interactionResult.cleanup);
        }
      }
    }

    // Finalize report
    report.endTime = new Date().toISOString();
    report.totalDurationMs = Date.now() - startMs;

    for (const phase of report.phases) {
      report.summary.totalChecks += phase.summary.total;
      report.summary.passed += phase.summary.success;
      report.summary.failed += phase.summary.failure;
      report.summary.warnings += phase.summary.warning;
      report.summary.skipped += phase.summary.skipped;
    }

    report.overallStatus = report.summary.failed > 0 ? 'FAIL' :
                           report.summary.warnings > 0 ? 'WARN' : 'PASS';

    // Save report - sanitize to remove non-serializable objects
    const reportPath = config.output?.reportPath || './test-report.json';
    const sanitizedReport = sanitizeReport(report);
    await fs.writeFile(reportPath, JSON.stringify(sanitizedReport, null, 2));

    return report;

  } finally {
    // Always run cleanup, even if tests fail
    // Run in reverse order for proper teardown (last opened = first closed)
    for (const cleanup of cleanupFns.reverse()) {
      try {
        await cleanup();
      } catch {
        // Log but don't throw - we want to clean up everything
        console.error('Cleanup error');
      }
    }
  }
}

/**
 * Run tests from a config object directly (useful for programmatic usage)
 */
export async function runTestsWithConfig(
  config: TestConfig,
  options?: RunTestsOptions
): Promise<TestReport> {
  // Write config to temp file and run tests
  const tempPath = `/tmp/mcp-test-config-${Date.now()}.json`;
  await fs.writeFile(tempPath, JSON.stringify(config));
  try {
    return await runTests(tempPath, options);
  } finally {
    await fs.unlink(tempPath).catch(() => {});
  }
}

/**
 * Remove non-serializable objects (client, transport, cleanup) from report
 */
function sanitizeReport(report: TestReport): TestReport {
  return {
    ...report,
    phases: report.phases.map(phase => {
      // Use rest to exclude non-serializable properties
      const { cleanup, ...sanitizedPhase } = phase as PhaseResult & {
        client?: unknown;
        transport?: unknown;
        provider?: unknown;
      };
      // Also remove client, transport, provider
      const { client, transport, provider, ...cleanPhase } = sanitizedPhase as typeof sanitizedPhase & {
        client?: unknown;
        transport?: unknown;
        provider?: unknown;
      };
      return cleanPhase;
    }),
  };
}
