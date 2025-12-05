Your goal is to write clean and maintainable code that is as minimal as possible. We want to leverage existing SDKs and patterns as much as possible. 

Specifically, we want to make heavy use of the Model Context Protocol TypeScript SDK: https://github.com/modelcontextprotocol/typescript-sdk

For local development purposes we have checked out three repostitiees. NEVER directly use this code. Instead, you may read it carefully to understand the patents used in these repositories to guide the development of this new codebase. 

`/typescript-sdk/` -- the Model Context Protocol TypeScript SDK. 
`/conformance/` -- the conformance checking repository designed to validate if clients and server SDKs meet all specification requirements (this is from github.com/modelcontextprotocol/conformance)
`/mcpjam-inspector/` -- a fork of the inspector that has really good testing infrastructure and uses a client proxy method to connect the servers. This is from (https://github.com/MCPJam/inspector)

These repositories will not be checked out for remote development, only local. Make sure to read them to understand context where possible. 