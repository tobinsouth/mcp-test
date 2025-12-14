import * as fs from "node:fs/promises";
import { TestConfigSchema, type TestConfig } from "@mcp-qa/types";

/**
 * Load and validate a test configuration from a JSON file.
 *
 * @param configPath - Path to the JSON configuration file
 * @returns Validated test configuration
 * @throws If file doesn't exist or configuration is invalid
 */
export async function loadConfig(configPath: string): Promise<TestConfig> {
  const configRaw = await fs.readFile(configPath, "utf-8");
  const configJson = JSON.parse(configRaw);
  return TestConfigSchema.parse(configJson);
}

/**
 * Validate a configuration object without loading from file.
 *
 * @param config - Configuration object to validate
 * @returns Validated test configuration
 * @throws If configuration is invalid
 */
export function validateConfig(config: unknown): TestConfig {
  return TestConfigSchema.parse(config);
}

/**
 * Create a default test configuration.
 */
export function createDefaultConfig(serverUrl: string): TestConfig {
  return {
    version: "1.0",
    server: {
      url: serverUrl,
      transport: "streamable-http",
    },
    auth: {
      type: "none",
    },
    phases: {
      auth: { enabled: true, timeout: 30000 },
      protocol: { enabled: true, testInitialization: true, testCapabilities: true, timeout: 30000 },
      tools: { enabled: true, analyzeTokenCounts: true, timeout: 30000 },
      interaction: {
        enabled: false,
        prompts: [],
        defaultModel: "claude-sonnet-4-20250514",
        safetyReviewModel: "claude-3-haiku-20240307",
        qualityReviewModel: "claude-3-haiku-20240307",
      },
    },
    output: {
      transcriptDir: "./transcripts",
      reportPath: "./test-report.json",
      format: "json",
    },
  };
}

/**
 * Generate an example configuration as a JSON string.
 */
export function generateExampleConfig(): string {
  const example = {
    version: "1.0",
    server: {
      url: "http://localhost:3001/mcp",
      name: "My MCP Server",
      transport: "streamable-http",
    },
    auth: {
      type: "none",
    },
    phases: {
      auth: {
        enabled: true,
        timeout: 30000,
      },
      protocol: {
        enabled: true,
        testInitialization: true,
        testCapabilities: true,
        timeout: 30000,
      },
      tools: {
        enabled: true,
        analyzeTokenCounts: true,
        timeout: 30000,
      },
      interaction: {
        enabled: true,
        prompts: [
          {
            id: "basic-tool-test",
            name: "Basic Tool Usage",
            prompt: 'List the available tools and then use the echo tool with message "hello"',
            expectations: {
              expectedToolCalls: [{ toolName: "echo", argumentsContain: { message: "hello" } }],
              shouldSucceed: true,
              maxIterations: 20,
            },
          },
        ],
        defaultModel: "claude-sonnet-4-20250514",
        safetyReviewModel: "claude-3-haiku-20240307",
        qualityReviewModel: "claude-3-haiku-20240307",
      },
    },
    output: {
      transcriptDir: "./transcripts",
      reportPath: "./test-report.json",
      format: "json",
    },
  };

  return JSON.stringify(example, null, 2);
}
