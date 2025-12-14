import { loadConfig } from "@mcp-qa/runner";
import { green, red, setColorsEnabled } from "../output/index.js";

export interface ValidateCommandOptions {
  configPath: string;
  noColor: boolean;
}

/**
 * Execute the validate command
 */
export async function validateCommand(options: ValidateCommandOptions): Promise<number> {
  if (options.noColor) {
    setColorsEnabled(false);
  }

  try {
    const config = await loadConfig(options.configPath);

    console.log(green("✓") + " Configuration is valid\n");
    console.log("Server URL:", config.server.url);
    console.log("Auth Type:", config.auth.type);
    console.log("Phases:");
    console.log("  Auth:", config.phases?.auth?.enabled !== false ? "enabled" : "disabled");
    console.log("  Protocol:", config.phases?.protocol?.enabled !== false ? "enabled" : "disabled");
    console.log("  Tools:", config.phases?.tools?.enabled !== false ? "enabled" : "disabled");
    console.log(
      "  Interaction:",
      config.phases?.interaction?.enabled !== false ? "enabled" : "disabled"
    );

    if (config.phases?.interaction?.prompts?.length) {
      console.log("\nTest Prompts:", config.phases.interaction.prompts.length);
      for (const prompt of config.phases.interaction.prompts) {
        console.log(`  - ${prompt.name} (${prompt.id})`);
      }
    }

    return 0;
  } catch (error) {
    console.error(red("✗") + " Configuration is invalid\n");

    if (error instanceof Error) {
      // Check for Zod errors
      if ("issues" in error) {
        const zodError = error as { issues: Array<{ path: (string | number)[]; message: string }> };
        console.error("Validation errors:");
        for (const issue of zodError.issues) {
          console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
        }
      } else {
        console.error(error.message);
      }
    } else {
      console.error(String(error));
    }

    return 2; // Configuration error
  }
}
