# CLI Commands

Command implementations for the CLI.

## Files

### run.ts
Main test run command:

```typescript
export async function runCommand(
  configPath: string,
  options: RunOptions
): Promise<void>;

interface RunOptions {
  verbose?: boolean;
  interactive?: boolean;
  anthropicKey?: string;
  json?: boolean;
  noColor?: boolean;
}
```

Usage:
```bash
mcp-qa-cli config.json [options]
```

### validate.ts
Configuration validation command:

```typescript
export async function validateCommand(
  configPath: string
): Promise<void>;
```

Usage:
```bash
mcp-qa-cli validate config.json
```

Validates the configuration without running tests:
- JSON syntax
- Schema validation (Zod)
- Auth configuration
- Phase configuration

### init.ts
Generate example configuration:

```typescript
export async function initCommand(
  options: InitOptions
): Promise<void>;

interface InitOptions {
  output?: string;
  auth?: 'none' | 'oauth';
  interactive?: boolean;
}
```

Usage:
```bash
mcp-qa-cli init --output my-config.json
mcp-qa-cli init --auth oauth
```

## Adding New Commands

1. Create new file in `commands/`
2. Export command function
3. Register in `index.ts`:

```typescript
// index.ts
import { newCommand } from './commands/new';

if (command === 'new') {
  await newCommand(args);
}
```

## Error Handling

Commands should:
- Throw with descriptive error messages
- Use appropriate exit codes
- Clean up resources on failure
