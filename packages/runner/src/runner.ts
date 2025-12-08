import * as fs from "node:fs/promises";
import type { TestConfig, TestReport, TestCheck } from "@mcp-qa/types";
import { createCLIAuthHandler, type InteractiveAuthHandler } from "@mcp-qa/core";
import { loadConfig } from "./config-loader.js";
import { runAuthPhase } from "./phases/auth/index.js";
import { runProtocolPhase } from "./phases/protocol/index.js";
import { runToolsPhase } from "./phases/tools/index.js";
import { runInteractionPhase } from "./phases/interaction/index.js";

export interface RunTestsOptions {
  /** Anthropic API key for interaction testing */
  anthropicApiKey?: string;
  /** Progress callback */
  onProgress?: (phase: string, check: TestCheck) => void;
  /** Enable interactive OAuth flow (CLI mode) */
  interactive?: boolean;
  /** Custom interactive auth handler (web mode) */
  interactiveHandler?: InteractiveAuthHandler;
}

/**
 * Run tests against an MCP server.
 *
 * @param configPath - Path to the test configuration JSON file
 * @param options - Runner options
 * @returns Complete test report
 */
export async function runTests(configPath: string, options?: RunTestsOptions): Promise<TestReport> {
  const config = await loadConfig(configPath);
  return runTestsWithConfig(config, options);
}

/**
 * Run tests with an already-loaded configuration.
 *
 * @param config - Test configuration
 * @param options - Runner options
 * @returns Complete test report
 */
export async function runTestsWithConfig(
  config: TestConfig,
  options?: RunTestsOptions
): Promise<TestReport> {
  const report: TestReport = {
    version: "1.0",
    serverUrl: config.server.url,
    serverName: config.server.name,
    startTime: new Date().toISOString(),
    endTime: "",
    totalDurationMs: 0,
    phases: [],
    overallStatus: "PASS",
    summary: { totalChecks: 0, passed: 0, failed: 0, warnings: 0, skipped: 0 },
  };

  const startMs = Date.now();
  const cleanupFns: Array<() => Promise<void>> = [];

  try {
    // Phase 1: Auth (discovery only - actual auth happens in protocol phase)
    if (config.phases?.auth?.enabled !== false) {
      const interactiveHandler =
        options?.interactiveHandler ?? (options?.interactive ? createCLIAuthHandler() : undefined);

      const authResult = await runAuthPhase(config.server.url, config.auth, {
        recorder: {
          pushCheck: (check) => options?.onProgress?.("auth", check),
        },
        interactiveHandler,
      });
      report.phases.push(authResult);

      // Phase 2: Protocol (using auth provider - auth happens here via 401)
      if (config.phases?.protocol?.enabled !== false) {
        const protocolResult = await runProtocolPhase(config.server.url, authResult.provider, {
          onProgress: (check) => options?.onProgress?.("protocol", check),
          testCapabilities: config.phases?.protocol?.testCapabilities,
        });
        report.phases.push(protocolResult);
        if (protocolResult.cleanup) cleanupFns.push(protocolResult.cleanup);

        // Phase 3: Tools
        if (config.phases?.tools?.enabled !== false && protocolResult.client) {
          const toolsResult = await runToolsPhase(protocolResult.client, {
            onProgress: (check) => options?.onProgress?.("tools", check),
            analyzeTokenCounts: config.phases?.tools?.analyzeTokenCounts,
          });
          report.phases.push(toolsResult);
        }

        // Phase 4: Interaction
        const prompts = config.phases?.interaction?.prompts || [];
        if (
          config.phases?.interaction?.enabled !== false &&
          prompts.length > 0 &&
          protocolResult.client
        ) {
          const anthropicApiKey = options?.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
          if (!anthropicApiKey) {
            throw new Error("ANTHROPIC_API_KEY required for interaction testing");
          }

          const interactionResult = await runInteractionPhase(protocolResult.client, prompts, {
            anthropicApiKey,
            transcriptDir: config.output?.transcriptDir || "./transcripts",
            onProgress: (check) => options?.onProgress?.("interaction", check),
            defaultModel: config.phases?.interaction?.defaultModel,
            safetyReviewModel: config.phases?.interaction?.safetyReviewModel,
            qualityReviewModel: config.phases?.interaction?.qualityReviewModel,
          });
          report.phases.push(interactionResult);
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

    report.overallStatus =
      report.summary.failed > 0 ? "FAIL" : report.summary.warnings > 0 ? "WARN" : "PASS";

    // Save report
    const reportPath = config.output?.reportPath || "./test-report.json";
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    return report;
  } finally {
    // Always run cleanup, even if tests fail
    for (const cleanup of cleanupFns.reverse()) {
      try {
        await cleanup();
      } catch {
        // Log but don't throw - we want to clean up everything
        console.error("Cleanup error");
      }
    }
  }
}
