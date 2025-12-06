/**
 * Tools Phase Runner
 *
 * Analyzes tool definitions and quality metrics.
 */

import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { TestCheck, PhaseResult } from '../../types/index.js';
import { summarizeChecks } from '../../types/index.js';
import { countTokens } from '../../utils/tokens.js';

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

export interface ToolsPhaseResult extends PhaseResult {
  toolMetrics?: ToolMetrics[];
}

export interface ToolsPhaseOptions {
  onProgress?: (check: TestCheck) => void;
  analyzeTokenCounts?: boolean;
}

export async function runToolsPhase(
  client: Client,
  options?: ToolsPhaseOptions
): Promise<ToolsPhaseResult> {
  const checks: TestCheck[] = [];
  const startTime = new Date().toISOString();
  const startMs = Date.now();
  let toolMetrics: ToolMetrics[] = [];

  const pushCheck = (check: TestCheck) => {
    checks.push(check);
    options?.onProgress?.(check);
  };

  try {
    const result = await client.listTools();

    pushCheck({
      id: 'tools-list-success',
      name: 'List Tools',
      description: `Server exposes ${result.tools.length} tools`,
      status: 'SUCCESS',
      timestamp: new Date().toISOString(),
      details: {
        toolCount: result.tools.length,
        toolNames: result.tools.map(t => t.name),
      },
    });

    if (result.tools.length === 0) {
      pushCheck({
        id: 'tools-none-available',
        name: 'No Tools Available',
        description: 'Server has no tools defined',
        status: 'WARNING',
        timestamp: new Date().toISOString(),
      });
    }

    // Analyze each tool
    if (options?.analyzeTokenCounts !== false) {
      toolMetrics = result.tools.map(tool => analyzeToolMetrics(tool));

      const totalTokens = toolMetrics.reduce((sum, m) => sum + m.totalTokens, 0);
      const avgTokens = toolMetrics.length > 0 ? Math.round(totalTokens / toolMetrics.length) : 0;

      pushCheck({
        id: 'tools-token-analysis',
        name: 'Token Analysis',
        description: `Total: ${totalTokens} tokens, Average: ${avgTokens} tokens/tool`,
        status: totalTokens > 50000 ? 'WARNING' : 'SUCCESS',
        timestamp: new Date().toISOString(),
        details: {
          totalTokens,
          averageTokensPerTool: avgTokens,
          largestTool: toolMetrics.length > 0
            ? toolMetrics.reduce((max, m) => m.totalTokens > max.totalTokens ? m : max).name
            : null,
        },
      });

      // Check for quality issues
      for (const metrics of toolMetrics) {
        if (!metrics.hasDescription) {
          pushCheck({
            id: `tools-${metrics.name}-no-description`,
            name: `Tool: ${metrics.name}`,
            description: 'Tool is missing a description',
            status: 'WARNING',
            timestamp: new Date().toISOString(),
          });
        }

        if (metrics.totalTokens > 5000) {
          pushCheck({
            id: `tools-${metrics.name}-large`,
            name: `Tool: ${metrics.name}`,
            description: `Tool definition is large (${metrics.totalTokens} tokens)`,
            status: 'WARNING',
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    // Additional tool quality checks
    for (const tool of result.tools) {
      // Check for input schema
      if (!tool.inputSchema || Object.keys(tool.inputSchema).length === 0) {
        pushCheck({
          id: `tools-${tool.name}-no-schema`,
          name: `Tool: ${tool.name}`,
          description: 'Tool has no input schema defined',
          status: 'WARNING',
          timestamp: new Date().toISOString(),
        });
      }

      // Check for annotations (tool metadata)
      const toolWithAnnotations = tool as Tool & { annotations?: Record<string, unknown> };
      if (toolWithAnnotations.annotations) {
        pushCheck({
          id: `tools-${tool.name}-has-annotations`,
          name: `Tool: ${tool.name}`,
          description: 'Tool has annotations defined',
          status: 'SUCCESS',
          timestamp: new Date().toISOString(),
          details: { annotations: toolWithAnnotations.annotations },
        });
      }
    }

  } catch (error) {
    pushCheck({
      id: 'tools-list-failed',
      name: 'List Tools Failed',
      description: 'Failed to list tools from server',
      status: 'FAILURE',
      timestamp: new Date().toISOString(),
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    phase: 'tools',
    name: 'Tool Quality Analysis',
    description: 'Analyzing tool definitions and quality metrics',
    startTime,
    endTime: new Date().toISOString(),
    durationMs: Date.now() - startMs,
    checks,
    summary: summarizeChecks(checks),
    toolMetrics,
  };
}

function analyzeToolMetrics(tool: Tool): ToolMetrics {
  const descriptionText = tool.description || '';
  const schemaText = JSON.stringify(tool.inputSchema || {});
  const toolWithExtras = tool as Tool & {
    outputSchema?: unknown;
    annotations?: Record<string, unknown>;
  };

  return {
    name: tool.name,
    descriptionTokens: countTokens(descriptionText),
    schemaTokens: countTokens(schemaText),
    totalTokens: countTokens(descriptionText) + countTokens(schemaText),
    hasDescription: !!tool.description,
    hasInputSchema: !!tool.inputSchema && Object.keys(tool.inputSchema).length > 0,
    hasOutputSchema: !!toolWithExtras.outputSchema,
    hasAnnotations: !!toolWithExtras.annotations,
    annotationDetails: toolWithExtras.annotations,
  };
}
