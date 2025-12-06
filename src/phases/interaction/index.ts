/**
 * Interaction Phase Runner
 *
 * Runs Claude-powered interaction tests against the MCP server.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ToolUseBlock, TextBlock, ToolResultBlockParam, MessageParam } from '@anthropic-ai/sdk/resources/messages.js';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { TestCheck, PhaseResult } from '../../types/index.js';
import type { TestPrompt, Expectation } from '../../types/config.js';
import { summarizeChecks } from '../../types/index.js';
import { TranscriptRecorder, type Transcript } from './transcript.js';
import { reviewSafety } from './safety-review.js';
import { reviewQuality } from './quality-review.js';

const MAX_ITERATIONS = 20;

export interface InteractionPhaseOptions {
  anthropicApiKey: string;
  transcriptDir: string;
  onProgress?: (check: TestCheck) => void;
  safetyReviewModel?: string;
  qualityReviewModel?: string;
  defaultModel?: string;
}

interface ToolCallRecord {
  toolName: string;
  arguments: unknown;
  result: unknown;
}

interface PromptResult {
  transcript: Transcript;
  transcriptPath: string;
}

export async function runInteractionPhase(
  client: Client,
  testPrompts: TestPrompt[],
  options: InteractionPhaseOptions
): Promise<PhaseResult> {
  const checks: TestCheck[] = [];
  const startTime = new Date().toISOString();
  const startMs = Date.now();

  const pushCheck = (check: TestCheck) => {
    checks.push(check);
    options.onProgress?.(check);
  };

  const anthropic = new Anthropic({
    apiKey: options.anthropicApiKey,
  });

  // Get tools from MCP client and convert to Claude format
  const toolsResult = await client.listTools();
  const claudeTools = toolsResult.tools.map(tool => ({
    name: tool.name,
    description: tool.description || '',
    input_schema: tool.inputSchema || { type: 'object' as const, properties: {} },
  }));

  pushCheck({
    id: 'interaction-tools-loaded',
    name: 'Tools Loaded for Claude',
    description: `Loaded ${claudeTools.length} tools for Claude interaction`,
    status: 'SUCCESS',
    timestamp: new Date().toISOString(),
    details: { toolNames: claudeTools.map(t => t.name) },
  });

  // Run each test prompt
  for (const testPrompt of testPrompts) {
    const promptResult = await runSinglePrompt(
      anthropic,
      client,
      claudeTools,
      testPrompt,
      {
        transcriptDir: options.transcriptDir,
        defaultModel: options.defaultModel,
      },
      pushCheck
    );

    // Run safety review
    if (testPrompt.safetyPolicies?.length) {
      await reviewSafety(
        promptResult.transcript,
        testPrompt.safetyPolicies,
        options.safetyReviewModel || 'claude-3-haiku-20240307',
        anthropic,
        pushCheck
      );
    }

    // Run quality review
    await reviewQuality(
      promptResult.transcript,
      testPrompt.expectations,
      options.qualityReviewModel || 'claude-3-haiku-20240307',
      anthropic,
      pushCheck
    );
  }

  return {
    phase: 'interaction',
    name: 'Claude Interaction Testing',
    description: `Tested ${testPrompts.length} prompts`,
    startTime,
    endTime: new Date().toISOString(),
    durationMs: Date.now() - startMs,
    checks,
    summary: summarizeChecks(checks),
  };
}

async function runSinglePrompt(
  anthropic: Anthropic,
  mcpClient: Client,
  claudeTools: Anthropic.Tool[],
  testPrompt: TestPrompt,
  options: { transcriptDir: string; defaultModel?: string },
  pushCheck: (check: TestCheck) => void
): Promise<PromptResult> {
  const recorder = new TranscriptRecorder(testPrompt.id);
  const messages: MessageParam[] = [];
  const maxIterations = testPrompt.maxIterations || MAX_ITERATIONS;
  const model = options.defaultModel || 'claude-sonnet-4-20250514';

  messages.push({ role: 'user', content: testPrompt.prompt });
  recorder.recordUserMessage(testPrompt.prompt);

  pushCheck({
    id: `interaction-${testPrompt.id}-start`,
    name: `Prompt: ${testPrompt.name}`,
    description: 'Starting interaction test',
    status: 'INFO',
    timestamp: new Date().toISOString(),
  });

  let iterations = 0;
  let continueLoop = true;
  const toolsCalled: ToolCallRecord[] = [];

  while (continueLoop && iterations < maxIterations) {
    iterations++;

    const response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      tools: claudeTools,
      messages,
    });

    recorder.recordClaudeResponse(response);

    const toolUseBlocks = response.content.filter(
      (block): block is ToolUseBlock => block.type === 'tool_use'
    );

    if (toolUseBlocks.length === 0) {
      continueLoop = false;
      const textBlocks = response.content.filter(
        (block): block is TextBlock => block.type === 'text'
      );
      if (textBlocks.length > 0) {
        recorder.recordFinalResponse(textBlocks.map(b => b.text).join('\n'));
      }
      break;
    }

    const toolResults: ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      recorder.recordToolCall(toolUse.name, toolUse.input);

      try {
        const result = await mcpClient.callTool({
          name: toolUse.name,
          arguments: toolUse.input as Record<string, unknown>,
        });

        recorder.recordToolResult(toolUse.name, result);
        toolsCalled.push({
          toolName: toolUse.name,
          arguments: toolUse.input,
          result,
        });

        const typedResult = result as CallToolResult;
        const resultContent = typedResult.content
          .map((c: { type: string; text?: string }) => {
            if (c.type === 'text') return c.text || '';
            if (c.type === 'image') return '[Image content]';
            return JSON.stringify(c);
          })
          .join('\n');

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: resultContent,
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        recorder.recordToolError(toolUse.name, errorMessage);

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: `Error: ${errorMessage}`,
          is_error: true,
        });
      }
    }

    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: toolResults });

    if (response.stop_reason === 'end_turn') {
      continueLoop = false;
    }
  }

  const transcriptPath = await recorder.saveToFile(options.transcriptDir);

  pushCheck({
    id: `interaction-${testPrompt.id}-complete`,
    name: `Prompt: ${testPrompt.name}`,
    description: `Completed in ${iterations} iterations, ${toolsCalled.length} tool calls`,
    status: 'SUCCESS',
    timestamp: new Date().toISOString(),
    details: {
      iterations,
      toolCallCount: toolsCalled.length,
      toolsUsed: [...new Set(toolsCalled.map(t => t.toolName))],
      transcriptPath,
    },
  });

  // Evaluate against expectations
  if (testPrompt.expectations?.expectedToolCalls) {
    const evaluation = evaluateToolCalls(
      testPrompt.expectations.expectedToolCalls,
      toolsCalled
    );

    pushCheck({
      id: `interaction-${testPrompt.id}-evaluation`,
      name: `Prompt: ${testPrompt.name} Evaluation`,
      description: evaluation.passed ? 'Expectations met' : 'Expectations not met',
      status: evaluation.passed ? 'SUCCESS' : 'FAILURE',
      timestamp: new Date().toISOString(),
      details: {
        expected: testPrompt.expectations.expectedToolCalls,
        actual: toolsCalled.map(t => ({ toolName: t.toolName, arguments: t.arguments })),
        missing: evaluation.missing,
      },
    });
  }

  return {
    transcript: recorder.getTranscript(),
    transcriptPath,
  };
}

interface ExpectedToolCall {
  toolName: string;
  argumentsContain?: Record<string, unknown>;
}

function evaluateToolCalls(
  expected: ExpectedToolCall[],
  actual: ToolCallRecord[]
): { passed: boolean; missing: ExpectedToolCall[] } {
  const missing: ExpectedToolCall[] = [];

  for (const exp of expected) {
    const found = actual.find(act => {
      if (act.toolName !== exp.toolName) return false;
      if (exp.argumentsContain) {
        const args = act.arguments as Record<string, unknown>;
        for (const [key, value] of Object.entries(exp.argumentsContain)) {
          if (JSON.stringify(args[key]) !== JSON.stringify(value)) {
            return false;
          }
        }
      }
      return true;
    });

    if (!found) {
      missing.push(exp);
    }
  }

  return {
    passed: missing.length === 0,
    missing,
  };
}
