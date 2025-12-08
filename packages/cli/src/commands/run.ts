import { runTests } from '@mcp-qa/runner';
import {
  setColorsEnabled,
  createVerboseProgressCallback,
  createQuietProgressCallback,
  formatReport,
  formatReportJson,
} from '../output/index.js';

export interface RunCommandOptions {
  configPath: string;
  verbose: boolean;
  interactive: boolean;
  anthropicKey?: string;
  json: boolean;
  noColor: boolean;
}

/**
 * Execute the run command
 */
export async function runCommand(options: RunCommandOptions): Promise<number> {
  // Configure colors
  if (options.noColor) {
    setColorsEnabled(false);
  }

  // Set up progress callback
  const onProgress = options.json
    ? undefined
    : options.verbose
      ? createVerboseProgressCallback()
      : createQuietProgressCallback();

  try {
    const report = await runTests(options.configPath, {
      anthropicApiKey: options.anthropicKey,
      interactive: options.interactive,
      onProgress,
    });

    // Output report
    if (options.json) {
      console.log(formatReportJson(report));
    } else {
      console.log(formatReport(report));
    }

    // Return exit code based on status
    return report.overallStatus === 'FAIL' ? 1 : 0;

  } catch (error) {
    if (!options.json) {
      console.error('\nError running tests:');
      console.error(error instanceof Error ? error.message : String(error));
    } else {
      console.log(JSON.stringify({
        error: true,
        message: error instanceof Error ? error.message : String(error),
      }));
    }
    return 3; // Runtime error
  }
}
