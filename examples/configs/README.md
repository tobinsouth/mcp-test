# Example Configurations

Example test configuration files for different scenarios.

## Files

### no-auth.json
Basic configuration for servers without authentication:

```json
{
  "version": "1.0",
  "server": {
    "url": "http://localhost:3001/mcp",
    "name": "My MCP Server"
  },
  "auth": {
    "type": "none"
  },
  "phases": {
    "interaction": {
      "prompts": [
        {
          "id": "basic-tool-test",
          "name": "Basic Tool Usage",
          "prompt": "List the available tools and use the echo tool",
          "expectations": {
            "expectedToolCalls": [
              { "toolName": "echo" }
            ]
          }
        }
      ]
    }
  }
}
```

### oauth-dcr.json
Configuration for OAuth with Dynamic Client Registration:

```json
{
  "version": "1.0",
  "server": {
    "url": "https://api.example.com/mcp",
    "name": "Secured MCP Server"
  },
  "auth": {
    "type": "authorization_code",
    "useDCR": true,
    "scopes": ["mcp:tools", "mcp:resources"],
    "interactive": true
  },
  "phases": {
    "auth": {
      "enabled": true,
      "timeout": 60000
    }
  }
}
```

### oauth-preregistered.json
Configuration with pre-registered OAuth credentials:

```json
{
  "version": "1.0",
  "server": {
    "url": "https://api.example.com/mcp"
  },
  "auth": {
    "type": "authorization_code",
    "clientId": "your-client-id",
    "clientSecret": "your-client-secret",
    "redirectUri": "http://localhost:3000/oauth/callback",
    "scopes": ["mcp:tools"],
    "useDCR": false
  }
}
```

### full-test.json
Comprehensive configuration with all options:

```json
{
  "version": "1.0",
  "server": {
    "url": "https://api.example.com/mcp",
    "name": "Production Server",
    "transport": "streamable-http",
    "headers": {
      "X-Custom-Header": "value"
    }
  },
  "auth": {
    "type": "authorization_code",
    "useDCR": true,
    "scopes": ["mcp:tools", "mcp:resources"],
    "interactive": true
  },
  "phases": {
    "auth": { "enabled": true, "timeout": 60000 },
    "protocol": { "enabled": true, "testCapabilities": true },
    "tools": { "enabled": true, "analyzeTokenCounts": true },
    "interaction": {
      "enabled": true,
      "defaultModel": "claude-sonnet-4-20250514",
      "prompts": [
        {
          "id": "comprehensive-test",
          "name": "Comprehensive Test",
          "prompt": "...",
          "expectations": { ... },
          "safetyPolicies": [ ... ]
        }
      ]
    }
  },
  "output": {
    "transcriptDir": "./transcripts",
    "reportPath": "./test-report.json",
    "format": "json"
  }
}
```

## Usage

```bash
# Run with CLI
mcp-qa-cli examples/configs/no-auth.json

# With interactive OAuth
mcp-qa-cli examples/configs/oauth-dcr.json --interactive
```

## Creating Your Own

1. Copy the closest example
2. Update `server.url` to your server
3. Adjust auth settings
4. Add test prompts for your use case
5. Validate: `mcp-qa-cli validate your-config.json`
