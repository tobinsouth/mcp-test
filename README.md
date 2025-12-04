# Unifed MCP & Skills Testing Infrastructure

The goal of this repository is to provide a unified testing infrastructure for developers to identify if their MCP server meets the required standards for inclusion in the MCP marketplace. 

Developers will be able to work sequentially through unit test-like checks that their server functions correctly. Use will provide their remote server URL, and then perform authorization flow themselves, and then use the server. 

A given testing sequence is memoryless, fully performing a new set of connection steps, you test everything is okay. This will behave a lot like a CI/CD pipeline, except for the fact that the user may need to orchestrate the login flow themselves. 

The client implementation that actually runs all this under the hood will be drawn directly from the Model Context Protocol TypeScript SDK. 

This page will start as a single-page CI/CD style flow that the user can input details into and run tests. Eventually the end result of this will be to generate a manifest and store the responses from all interactions. This will then become part of a server submission management process. Similarly, extensions of this will be used for uploading and monitoring skills. 