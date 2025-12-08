import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Transcript, TranscriptEntry, TranscriptEntryType } from "@mcp-qa/types";

/**
 * Records interactions between Claude and MCP tools
 */
export class TranscriptRecorder {
  private entries: TranscriptEntry[] = [];
  private toolsCalled: Set<string> = new Set();
  private startTime: string;
  private endTime?: string;
  private iterations = 0;
  private _finalResponse?: string;

  constructor(private testPromptId: string) {
    this.startTime = new Date().toISOString();
  }

  /**
   * Record a user message
   */
  recordUserMessage(content: string): void {
    this.addEntry("user_message", content);
  }

  /**
   * Record Claude's response
   */
  recordClaudeResponse(response: unknown): void {
    this.iterations++;
    this.addEntry("assistant_message", response);
  }

  /**
   * Record a tool call
   */
  recordToolCall(toolName: string, args: unknown): void {
    this.toolsCalled.add(toolName);
    this.addEntry("tool_call", {
      toolName,
      arguments: args,
    });
  }

  /**
   * Record a tool result
   */
  recordToolResult(toolName: string, result: unknown): void {
    this.addEntry("tool_result", {
      toolName,
      result,
      isError: false,
    });
  }

  /**
   * Record a tool error
   */
  recordToolError(toolName: string, error: string): void {
    this.addEntry("tool_error", {
      toolName,
      error,
      isError: true,
    });
  }

  /**
   * Record the final response
   */
  recordFinalResponse(response: string): void {
    this._finalResponse = response;
    this.addEntry("final_response", response);
    this.endTime = new Date().toISOString();
  }

  /**
   * Add a system note
   */
  recordSystemNote(note: string): void {
    this.addEntry("system", note);
  }

  /**
   * Get the current transcript
   */
  getTranscript(): Transcript {
    return {
      id: crypto.randomUUID(),
      testPromptId: this.testPromptId,
      startTime: this.startTime,
      endTime: this.endTime,
      iterations: this.iterations,
      entries: this.entries,
      toolsCalled: Array.from(this.toolsCalled),
      finalResponse: this._finalResponse,
    };
  }

  /**
   * Save transcript to a file
   */
  async saveToFile(dir: string): Promise<string> {
    const transcript = this.getTranscript();
    const filename = `${this.testPromptId}-${Date.now()}.json`;
    const filepath = path.join(dir, filename);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(filepath, JSON.stringify(transcript, null, 2));

    return filepath;
  }

  private addEntry(type: TranscriptEntryType, content: unknown): void {
    this.entries.push({
      type,
      timestamp: new Date().toISOString(),
      content,
    });
  }
}
