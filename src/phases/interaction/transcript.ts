/**
 * Transcript Recorder
 *
 * Records the full interaction between Claude and the MCP server.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

type TranscriptEntry =
  | { type: 'user_message'; content: string; timestamp: string }
  | { type: 'claude_response'; response: unknown; timestamp: string }
  | { type: 'tool_call'; toolName: string; arguments: unknown; timestamp: string }
  | { type: 'tool_result'; toolName: string; result: unknown; timestamp: string }
  | { type: 'tool_error'; toolName: string; error: string; timestamp: string }
  | { type: 'final_response'; content: string; timestamp: string };

export interface Transcript {
  promptId: string;
  startTime: string;
  endTime?: string;
  entries: TranscriptEntry[];
  summary: {
    totalToolCalls: number;
    toolsUsed: string[];
    errors: number;
    iterations: number;
  };
}

export class TranscriptRecorder {
  private entries: TranscriptEntry[] = [];
  private startTime: string;
  private toolCalls: string[] = [];
  private errors = 0;

  constructor(private promptId: string) {
    this.startTime = new Date().toISOString();
  }

  recordUserMessage(content: string): void {
    this.entries.push({
      type: 'user_message',
      content,
      timestamp: new Date().toISOString(),
    });
  }

  recordClaudeResponse(response: unknown): void {
    this.entries.push({
      type: 'claude_response',
      response,
      timestamp: new Date().toISOString(),
    });
  }

  recordToolCall(toolName: string, args: unknown): void {
    this.entries.push({
      type: 'tool_call',
      toolName,
      arguments: args,
      timestamp: new Date().toISOString(),
    });
    this.toolCalls.push(toolName);
  }

  recordToolResult(toolName: string, result: unknown): void {
    this.entries.push({
      type: 'tool_result',
      toolName,
      result,
      timestamp: new Date().toISOString(),
    });
  }

  recordToolError(toolName: string, error: string): void {
    this.entries.push({
      type: 'tool_error',
      toolName,
      error,
      timestamp: new Date().toISOString(),
    });
    this.errors++;
  }

  recordFinalResponse(content: string): void {
    this.entries.push({
      type: 'final_response',
      content,
      timestamp: new Date().toISOString(),
    });
  }

  getTranscript(): Transcript {
    return {
      promptId: this.promptId,
      startTime: this.startTime,
      endTime: new Date().toISOString(),
      entries: this.entries,
      summary: {
        totalToolCalls: this.toolCalls.length,
        toolsUsed: [...new Set(this.toolCalls)],
        errors: this.errors,
        iterations: this.entries.filter(e => e.type === 'claude_response').length,
      },
    };
  }

  async saveToFile(dir: string): Promise<string> {
    await fs.mkdir(dir, { recursive: true });
    const filename = `${this.promptId}-${Date.now()}.json`;
    const filepath = path.join(dir, filename);
    await fs.writeFile(filepath, JSON.stringify(this.getTranscript(), null, 2));
    return filepath;
  }
}
