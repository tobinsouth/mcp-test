# Examples

Example configurations and test servers for the MCP QA Platform.

## Structure

```
examples/
├── configs/          # Example test configurations
│   ├── no-auth.json           # Basic no-auth server test
│   ├── oauth-dcr.json         # OAuth with Dynamic Client Registration
│   ├── oauth-preregistered.json # OAuth with pre-registered credentials
│   └── full-test.json         # Comprehensive test with all phases
│
└── servers/          # Example MCP servers for testing
    ├── echo-server/           # Simple echo tool server
    └── protected-server/      # OAuth-protected server
```

## Using Examples

### Run with CLI

```bash
# No-auth server
mcp-qa-cli examples/configs/no-auth.json

# OAuth server (interactive)
mcp-qa-cli examples/configs/oauth-dcr.json --interactive
```

### Configuration Templates

Use these as starting points for your own test configurations:

1. `no-auth.json` - Start here for servers without authentication
2. `oauth-dcr.json` - For servers using Dynamic Client Registration
3. `full-test.json` - Reference for all available configuration options

## Example Servers

The example servers can be used for local testing:

```bash
# Start echo server
cd examples/servers/echo-server
bun run start

# In another terminal
mcp-qa-cli examples/configs/no-auth.json
```
