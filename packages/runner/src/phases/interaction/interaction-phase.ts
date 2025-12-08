import Anthropic from '@anthropic-ai/sdk';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { TestCheck, PhaseResult, TestPrompt } from '@mcp-qa/types';
import { createCheckRecorder, createTimer } from '../base/index.js';
import { TranscriptRecorder } from './transcript.js';
import { reviewSafety } from './safety-review.js';
import { reviewQuality } from './quality-review.js';
import { evaluateToolCalls, type ToolCallRecord } from './expectation-eval.js';

const MAX_ITERATIONS = 20;

export interface InteractionPhaseOptions {
  anthropicApiKey: string;
  transcriptDir: string;
  onProgress?: (check: TestCheck) => void;
  defaultModel?: string;
  safetyReviewModel?: string;
  qualityReviewModel?: string;
}

/**
 * Run interaction phase - execute test prompts using Claude with MCP tools.
 */
export async function runInteractionPhase(
  client: Client,
  testPrompts: TestPrompt[],
  options: InteractionPhaseOptions
): Promise<PhaseResult> {
  const timer = createTimer();
  const recorder = createCheckRecorder(options.onProgress);

  const anthropic = new Anthropic({
    apiKey: options.anthropicApiKey,
  });

  // Get tools from MCP client and convert to Claude format
  const toolsResult = await client.listTools();
  const claudeTools: Anthropic.Tool[] = toolsResult.tools.map(tool => ({
    name: tool.name,
    description: tool.description || '',
    input_schema: tool.inputSchema as Anthropic.Tool.InputSchema || { type: 'object' as const, properties: {} },
  }));

  recorder.pushCheck({
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
        defaultModel: options.defaultModel || 'claude-sonnet-4-20250514',
      },
      recorder.pushCheck.bind(recorder)
    );

    // Run safety review
    if (testPrompt.safetyPolicies?.length) {
      await reviewSafety(
        promptResult.transcript,
        testPrompt.safetyPolicies,
        options.safetyReviewModel || 'claude-3-haiku-20240307',
        anthropic,
        recorder.pushCheck.bind(recorder)
      );
    }

    // Run quality review
    await reviewQuality(
      promptResult.transcript,
      testPrompt.expectations,
      options.qualityReviewModel || 'claude-3-haiku-20240307',
      anthropic,
      recorder.pushCheck.bind(recorder)
    );
  }

  return {
    phase: 'interaction',
    name: 'Claude Interaction Testing',
    description: `Tested ${testPrompts.length} prompts`,
    startTime: timer.startTime,
    endTime: timer.getEndTime(),
    durationMs: timer.getDurationMs(),
    checks: recorder.checks,
    summary: recorder.getSummary(),
  };
}

async function runSinglePrompt(
  anthropic: Anthropic,
  mcpClient: Client,
  claudeTools: Anthropic.Tool[],
  testPrompt: TestPrompt,
  options: { transcriptDir: string; defaultModel: string },
  pushCheck: (check: TestCheck) => void
): Promise<{ transcript: ReturnType<TranscriptRecorder['getTranscript']>; transcriptPath: string }> {
  const transcriptRecorder = new TranscriptRecorder(testPrompt.id);
  const messages: Anthropic.MessageParam[] = [];
  const maxIterations = testPrompt.maxIterations || MAX_ITERATIONS;

  messages.push({ role: 'user', content: testPrompt.prompt });
  transcriptRecorder.recordUserMessage(testPrompt.prompt);

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
      model: options.defaultModel,
      max_tokens: 4096,
      tools: claudeTools,
      messages,
    });

    transcriptRecorder.recordClaudeResponse(response);

    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    if (toolUseBlocks.length === 0) {
      continueLoop = false;
      const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === 'text'
      );
      if (textBlocks.length > 0) {
        transcriptRecorder.recordFinalResponse(textBlocks.map(b => b.text).join('\n'));
      }
      break;
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      transcriptRecorder.recordToolCall(toolUse.name, toolUse.input);

      try {
        const result = await mcpClient.callTool({
          name: toolUse.name,
          arguments: toolUse.input as Record<string, unknown>,
        });

        transcriptRecorder.recordToolResult(toolUse.name, result);
        toolsCalled.push({
          toolName: toolUse.name,
          arguments: toolUse.input as Record<string, unknown>,
          result,
        });

        const contentArray = result.content as Array<{ type: string; text?: string; [key: string]: unknown }>;
        const resultContent = contentArray
          .map((c: { type: string; text?: string; [key: string]: unknown }) => {
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
        transcriptRecorder.recordToolError(toolUse.name, errorMessage);

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

  const transcriptPath = await transcriptRecorder.saveToFile(options.transcriptDir);
  const transcript = transcriptRecorder.getTranscript();

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
    transcript,
    transcriptPath,
  };
}
