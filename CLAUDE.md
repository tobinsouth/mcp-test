Your goal is to write clean and maintainable code that is as minimal as possible. Your code will be hosted and used by Anthropic. We want to leverage existing SDKs and patterns as much as possible. 

Specifically, we want to make heavy use of the Model Context Protocol TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk

For local development purposes we have checked out three repositories. You may read it carefully to understand the patents used in these repositories to guide the development of this new codebase. If you need to understand these packages and they are not available, clone them to examine more.

`/typescript-sdk/` -- the Model Context Protocol TypeScript SDK. 
`/conformance/` -- the conformance checking repository designed to validate if clients and server SDKs meet all specification requirements (this is from github.com/modelcontextprotocol/conformance)
`/mcpjam-inspector/` -- a fork of the inspector that has really good testing infrastructure and uses a client proxy method to connect the servers. This is from (https://github.com/MCPJam/inspector)

When writing code, ensure that you follow best practices for TypeScript development, including proper typing, modularization, and documentation. Make sure to include unit tests where applicable to ensure code reliability and maintainability.