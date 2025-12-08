import * as fs from 'node:fs/promises';
import { generateExampleConfig } from '@mcp-qa/runner';
import { green, red, setColorsEnabled } from '../output/index.js';

export interface InitCommandOptions {
  output: string;
  noColor: boolean;
  force: boolean;
}

/**
 * Execute the init command - generate example configuration
 */
export async function initCommand(options: InitCommandOptions): Promise<number> {
  if (options.noColor) {
    setColorsEnabled(false);
  }

  try {
    // Check if file exists
    if (!options.force) {
      try {
        await fs.access(options.output);
        console.error(red('✗') + ` File already exists: ${options.output}`);
        console.error('Use --force to overwrite');
        return 2;
      } catch {
        // File doesn't exist, continue
      }
    }

    const config = generateExampleConfig();
    await fs.writeFile(options.output, config);

    console.log(green('✓') + ` Created example configuration: ${options.output}`);
    console.log('\nNext steps:');
    console.log('  1. Edit the configuration file with your server URL');
    console.log('  2. Configure authentication if needed');
    console.log('  3. Add test prompts for interaction testing');
    console.log(`  4. Run: mcp-qa-cli ${options.output}`);

    return 0;

  } catch (error) {
    console.error(red('✗') + ' Failed to create configuration');
    console.error(error instanceof Error ? error.message : String(error));
    return 3;
  }
}
