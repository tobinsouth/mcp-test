import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { countTokens } from '@mcp-qa/core';

/**
 * Metrics for a single tool definition
 */
export interface ToolMetrics {
  name: string;
  descriptionTokens: number;
  schemaTokens: number;
  totalTokens: number;
  hasDescription: boolean;
  hasInputSchema: boolean;
  hasAnnotations: boolean;
  annotationDetails?: Record<string, unknown>;
}

/**
 * Analyze a tool and calculate its metrics.
 */
export function analyzeToolMetrics(tool: Tool): ToolMetrics {
  const descriptionText = tool.description || '';
  const schemaText = JSON.stringify(tool.inputSchema || {});

  const descriptionTokens = countTokens(descriptionText);
  const schemaTokens = countTokens(schemaText);

  return {
    name: tool.name,
    descriptionTokens,
    schemaTokens,
    totalTokens: descriptionTokens + schemaTokens,
    hasDescription: !!tool.description,
    hasInputSchema: !!tool.inputSchema && Object.keys(tool.inputSchema).length > 0,
    hasAnnotations: !!(tool as Record<string, unknown>).annotations,
    annotationDetails: (tool as Record<string, unknown>).annotations as Record<string, unknown> | undefined,
  };
}

/**
 * Calculate aggregate metrics for all tools.
 */
export function calculateAggregateMetrics(toolMetrics: ToolMetrics[]): {
  totalTokens: number;
  averageTokensPerTool: number;
  largestTool: string | null;
  smallestTool: string | null;
  toolsWithoutDescription: string[];
  toolsWithLargeSchema: string[];
} {
  if (toolMetrics.length === 0) {
    return {
      totalTokens: 0,
      averageTokensPerTool: 0,
      largestTool: null,
      smallestTool: null,
      toolsWithoutDescription: [],
      toolsWithLargeSchema: [],
    };
  }

  const totalTokens = toolMetrics.reduce((sum, m) => sum + m.totalTokens, 0);
  const averageTokensPerTool = Math.round(totalTokens / toolMetrics.length);

  const sorted = [...toolMetrics].sort((a, b) => b.totalTokens - a.totalTokens);
  const largestTool = sorted[0]?.name ?? null;
  const smallestTool = sorted[sorted.length - 1]?.name ?? null;

  const toolsWithoutDescription = toolMetrics
    .filter(m => !m.hasDescription)
    .map(m => m.name);

  const toolsWithLargeSchema = toolMetrics
    .filter(m => m.totalTokens > 5000)
    .map(m => m.name);

  return {
    totalTokens,
    averageTokensPerTool,
    largestTool,
    smallestTool,
    toolsWithoutDescription,
    toolsWithLargeSchema,
  };
}
