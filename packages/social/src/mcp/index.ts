// Social MCP tool registry barrel. `socialMcpTools` is the array the api-mcp
// server iterates to register tools alongside the other modules'. Own
// `read:social` / `write:social` scopes; additionally gated on the `social`
// module flag in api-mcp's server dispatch (MODULE_BY_SCOPE).

export type { McpScope, McpToolDefinition, SocialMcpCtx, AnyMcpTool } from './registry.js';

import { readTools, writeTools } from './tools.js';

export * from './tools.js';

/** The full social tool set the MCP server publishes. */
export const socialMcpTools = [...readTools, ...writeTools];
