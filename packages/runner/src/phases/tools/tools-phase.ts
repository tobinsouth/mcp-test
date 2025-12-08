import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { TestCheck, PhaseResult } from "@mcp-qa/types";
import { createCheckRecorder, createTimer } from "../base/index.js";
import { analyzeToolMetrics, calculateAggregateMetrics, type ToolMetrics } from "./metrics.js";

export interface ToolsPhaseOptions {
  onProgress?: (check: TestCheck) => void;
  analyzeTokenCounts?: boolean;
}

export interface ToolsPhaseResult extends PhaseResult {
  toolMetrics?: ToolMetrics[];
}

/**
 * Run tool quality analysis phase.
 * Lists tools, analyzes their definitions, and calculates quality metrics.
 */
export async function runToolsPhase(
  client: Client,
  options?: ToolsPhaseOptions
): Promise<ToolsPhaseResult> {
  const timer = createTimer();
  const recorder = createCheckRecorder(options?.onProgress);
  let toolMetrics: ToolMetrics[] = [];

  try {
    const result = await client.listTools();

    recorder.pushCheck({
      id: "tools-list-success",
      name: "List Tools",
      description: `Server exposes ${result.tools.length} tools`,
      status: "SUCCESS",
      timestamp: new Date().toISOString(),
      details: {
        toolCount: result.tools.length,
        toolNames: result.tools.map((t) => t.name),
      },
    });

    if (result.tools.length === 0) {
      recorder.pushCheck({
        id: "tools-none-available",
        name: "No Tools Available",
        description: "Server has no tools defined",
        status: "WARNING",
        timestamp: new Date().toISOString(),
      });
    }

    // Analyze each tool
    if (options?.analyzeTokenCounts !== false) {
      toolMetrics = result.tools.map((tool) => analyzeToolMetrics(tool));

      const aggregate = calculateAggregateMetrics(toolMetrics);

      recorder.pushCheck({
        id: "tools-token-analysis",
        name: "Token Analysis",
        description: `Total: ${aggregate.totalTokens} tokens, Average: ${aggregate.averageTokensPerTool} tokens/tool`,
        status: aggregate.totalTokens > 50000 ? "WARNING" : "SUCCESS",
        timestamp: new Date().toISOString(),
        details: {
          totalTokens: aggregate.totalTokens,
          averageTokensPerTool: aggregate.averageTokensPerTool,
          largestTool: aggregate.largestTool,
        },
      });

      // Check for quality issues
      for (const metrics of toolMetrics) {
        if (!metrics.hasDescription) {
          recorder.pushCheck({
            id: `tools-${metrics.name}-no-description`,
            name: `Tool: ${metrics.name}`,
            description: "Tool is missing a description",
            status: "WARNING",
            timestamp: new Date().toISOString(),
          });
        }

        if (metrics.totalTokens > 5000) {
          recorder.pushCheck({
            id: `tools-${metrics.name}-large`,
            name: `Tool: ${metrics.name}`,
            description: `Tool definition is large (${metrics.totalTokens} tokens)`,
            status: "WARNING",
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
  } catch (error) {
    recorder.pushCheck({
      id: "tools-list-failed",
      name: "List Tools Failed",
      description: "Failed to list tools from server",
      status: "FAILURE",
      timestamp: new Date().toISOString(),
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    phase: "tools",
    name: "Tool Quality Analysis",
    description: "Analyzing tool definitions and quality metrics",
    startTime: timer.startTime,
    endTime: timer.getEndTime(),
    durationMs: timer.getDurationMs(),
    checks: recorder.checks,
    summary: recorder.getSummary(),
    toolMetrics,
  };
}
