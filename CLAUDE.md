## Project Overview

**Read `PROJECT.md` first** - it contains the complete project structure, architecture, and technical decisions.

## Development Guidelines

Your goal is to write clean and maintainable code that is as minimal as possible. Your code will be hosted and used by Anthropic. We want to leverage existing SDKs and patterns as much as possible.

Specifically, we want to make heavy use of the Model Context Protocol TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk

When writing code, ensure that you follow best practices for TypeScript development, including proper typing, modularization, and documentation. Make sure to include unit tests where applicable to ensure code reliability and maintainability.

## Reference Repositories

These are checked out locally for reference patterns:

- `/typescript-sdk/` - MCP TypeScript SDK (primary dependency)
- `/conformance/` - MCP conformance test suite (github.com/modelcontextprotocol/conformance)
- `/mcpjam-inspector/` - MCPJam Inspector fork with testing infrastructure (github.com/MCPJam/inspector)

## Maintaining PROJECT.md

**Important:** After making significant changes to the repository structure, packages, or architecture, update `PROJECT.md` to reflect those changes. This includes:

- Adding/removing packages
- Changing dependency relationships
- Adding new test phases
- Modifying key entry points or APIs
- Changing build configuration

Keep updates minimal and focused on structural information (no code snippets). The goal is to give future Claude instances a quick understanding of the codebase.