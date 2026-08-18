// @wizeworks/b2b — the trade (B2B / wholesale) service layer + its MCP tool registry.
// The package barrel is the service; the MCP tools live behind the `./mcp` subpath
// so a backend that only needs the service (api-rest) doesn't pull the tool defs.

export * from './service.js';
